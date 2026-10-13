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

function randomHex(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !serviceKey) return respond(500, { error: "Server configuration is missing" });

  try {
    const body = await req.json().catch(() => null);
    const code = typeof body?.pairing_code === "string" ? body.pairing_code.trim().toUpperCase() : "";
    const appVersion = typeof body?.app_version === "string" ? body.app_version.trim().slice(0, 40) : "";
    const simLast4 = typeof body?.sim_last4 === "string" ? body.sim_last4.trim() : "";

    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/.test(code)) {
      return respond(400, { error: "Pairing code is invalid or expired" });
    }
    if (simLast4 && !/^[0-9]{4}$/.test(simLast4)) {
      return respond(400, { error: "Only the SIM's last four digits can be sent" });
    }

    const pairingHash = await sha256(`etaabo-sms-pair-v1:${code}`);
    const deviceSecret = randomHex(32);
    const deviceSecretHash = await sha256(`etaabo-sms-reader-v1:${deviceSecret}`);

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: paired, error: pairError } = await service.rpc("complete_sms_reader_pairing", {
      _pairing_code_hash: pairingHash,
      _device_secret_hash: deviceSecretHash,
      _app_version: appVersion || null,
      _sim_last4: simLast4 || null,
    });
    if (pairError) return respond(400, { error: "Pairing code is invalid, expired, or already used" });

    const reader = Array.isArray(paired) ? paired[0] : paired;
    if (!reader?.reader_id) return respond(400, { error: "Pairing code is invalid, expired, or already used" });

    return respond(200, {
      ok: true,
      reader_id: reader.reader_id,
      reader_secret: deviceSecret,
      message: "Ku kaydi secret-kan si ammaan ah. Waxaa mar dambe loo baahan yahay marka la sync-gareynayo; server-ku mar dambe dib uma soo celin karo.",
    });
  } catch {
    return respond(400, { error: "Pairing request could not be completed" });
  }
});
