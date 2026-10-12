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

function makeTemporaryPassword(length = 22): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_";
  const maxValidByte = 256 - (256 % alphabet.length);
  let result = "";
  while (result.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= maxValidByte) continue;
      result += alphabet[byte % alphabet.length];
      if (result.length === length) break;
    }
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!authorization || !supabaseUrl || !publicKey || !serviceKey) {
    return respond(500, { error: "Authentication or server configuration is missing" });
  }

  let createdUserId: string | null = null;

  try {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const callerClient = createClient(supabaseUrl, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !callerData.user) {
      return respond(401, { error: "A valid signed-in session is required" });
    }

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: platformAdmin, error: roleError } = await service
      .from("user_roles")
      .select("user_id")
      .eq("user_id", callerData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!platformAdmin) {
      return respond(403, { error: "Only eTaabo Super Admin can assign a merchant admin" });
    }

    const body = await req.json().catch(() => null);
    const merchantId = typeof body?.merchant_id === "string" ? body.merchant_id.trim() : "";
    const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!merchantId || !email || !fullName) {
      return respond(400, { error: "merchant_id, full_name and email are required" });
    }
    if (fullName.length < 2 || fullName.length > 120) {
      return respond(400, { error: "Full name must be between 2 and 120 characters" });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond(400, { error: "Enter a valid email address" });
    }

    const { data: merchant, error: merchantError } = await service
      .from("merchants")
      .select("id, name, merchant_id")
      .eq("id", merchantId)
      .maybeSingle();
    if (merchantError) throw merchantError;
    if (!merchant) return respond(404, { error: "Merchant not found" });

    let existingUser: { id: string; email?: string | null } | null = null;
    for (let page = 1; page <= 100; page += 1) {
      const { data: usersResult, error: usersError } = await service.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (usersError) throw usersError;
      existingUser = usersResult.users.find(
        (candidate) => candidate.email?.trim().toLowerCase() === email,
      ) ?? null;
      if (existingUser || usersResult.users.length < 1000) break;
    }

    let userId: string;
    let temporaryPassword: string | null = null;
    let accountExists = Boolean(existingUser);

    if (existingUser) {
      userId = existingUser.id;
    } else {
      temporaryPassword = makeTemporaryPassword();
      const { data: created, error: createError } = await service.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createError) throw createError;
      if (!created.user) throw new Error("Supabase did not return the created user");
      userId = created.user.id;
      createdUserId = userId;
    }

    const profilePayload: Record<string, unknown> = {
      id: userId,
      email,
      full_name: fullName,
    };
    if (!accountExists) profilePayload.must_change_password = true;

    const { error: profileError } = await service.from("profiles").upsert(
      profilePayload,
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    const { error: membershipError } = await service.from("merchant_memberships").upsert(
      {
        merchant_id: merchantId,
        user_id: userId,
        role: "owner",
        branch_id: null,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "merchant_id,user_id" },
    );
    if (membershipError) throw membershipError;

    return respond(200, {
      ok: true,
      account_exists: accountExists,
      password_generated: Boolean(temporaryPassword),
      temporary_password: temporaryPassword,
      email,
      admin_name: fullName,
      merchant_name: merchant.name,
      admin_url: "https://admin.etaabo.com/",
      payment_url: `https://etaabo.com/pay?merchant=${encodeURIComponent(merchant.merchant_id)}`,
      message: accountExists
        ? "Existing account linked as merchant owner. Its password was not changed; ask the user to sign in with their current password."
        : "Merchant admin account created. Share the temporary password securely and ask the user to change it at first sign-in.",
    });
  } catch (error) {
    if (createdUserId) {
      try {
        const service = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await service.auth.admin.deleteUser(createdUserId);
      } catch {
        // Preserve the original error, but never log or return the temporary password.
      }
    }
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return respond(500, { error: message });
  }
});
