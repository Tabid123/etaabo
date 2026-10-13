import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function randomPairingCode(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const limit = 256 - (256 % alphabet.length);
  let code = "";
  while (code.length < length) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      code += alphabet[byte % alphabet.length];
      if (code.length === length) break;
    }
  }
  return code;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!authorization || !supabaseUrl || !publicKey || !serviceKey) {
    return respond(500, { error: "Server configuration is missing" });
  }

  try {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const callerClient = createClient(supabaseUrl, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !callerData.user) return respond(401, { error: "Sign in first" });

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await req.json().catch(() => null);
    const merchantId = typeof body?.merchant_id === "string" ? body.merchant_id.trim() : "";
    const branchId = body?.branch_id === null || body?.branch_id === undefined || body?.branch_id === ""
      ? null
      : typeof body.branch_id === "string" ? body.branch_id.trim() : "__invalid__";
    const label = typeof body?.label === "string" ? body.label.trim() : "";

    if (!merchantId || label.length < 2 || label.length > 100 || branchId === "__invalid__") {
      return respond(400, { error: "Merchant, reader label and optional branch are required" });
    }

    const { data: platformAdmin, error: roleError } = await service
      .from("user_roles")
      .select("user_id")
      .eq("user_id", callerData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;

    let authorized = Boolean(platformAdmin);
    if (!authorized) {
      const { data: memberships, error: membershipError } = await service
        .from("merchant_memberships")
        .select("branch_id,role,status")
        .eq("user_id", callerData.user.id)
        .eq("merchant_id", merchantId)
        .eq("status", "active")
        .in("role", ["owner", "admin"]);
      if (membershipError) throw membershipError;
      authorized = (memberships ?? []).some((membership) => {
        if (branchId === null) return membership.branch_id === null;
        return membership.branch_id === null || membership.branch_id === branchId;
      });
    }
    if (!authorized) return respond(403, { error: "Not authorized for this merchant or branch" });

    const { data: merchant, error: merchantError } = await service
      .from("merchants")
      .select("id,is_active")
      .eq("id", merchantId)
      .maybeSingle();
    if (merchantError) throw merchantError;
    if (!merchant || !merchant.is_active) return respond(404, { error: "Active merchant not found" });

    if (branchId) {
      const { data: branch, error: branchError } = await service
        .from("branches")
        .select("id")
        .eq("id", branchId)
        .eq("merchant_id", merchantId)
        .eq("is_active", true)
        .maybeSingle();
      if (branchError) throw branchError;
      if (!branch) return respond(400, { error: "Branch is not active for this merchant" });
    }

    const pairingCode = randomPairingCode();
    const pairingCodeHash = await sha256(`etaabo-sms-pair-v1:${pairingCode}`);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: created, error: createError } = await service.rpc("register_sms_reader_pairing", {
      _requested_by: callerData.user.id,
      _merchant_id: merchantId,
      _branch_id: branchId,
      _label: label,
      _pairing_code_hash: pairingCodeHash,
      _expires_at: expiresAt,
    });
    if (createError) throw createError;

    const reader = Array.isArray(created) ? created[0] : created;
    if (!reader?.reader_id) throw new Error("SMS Reader pairing record was not created");

    return respond(200, {
      ok: true,
      reader_id: reader.reader_id,
      label: reader.reader_label,
      pairing_code: pairingCode,
      expires_at: reader.expires_at,
      instructions: "Ku geli pairing code-kan Android SMS Reader-ka 10 daqiiqo gudahood. Koodhku hal mar ayuu shaqeeyaa.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return respond(400, { error: message });
  }
});
