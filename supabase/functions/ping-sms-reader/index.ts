import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-reader-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function optionalText(value: unknown, max: number): string | null | "__invalid__" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return "__invalid__";
  const text = value.trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
  return text || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

  const rawSecret = req.headers.get("x-reader-secret") ?? "";
  if (!/^[a-f0-9]{64}$/.test(rawSecret)) return respond(401, { error: "Reader authentication failed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !serviceKey) return respond(500, { error: "Server configuration is missing" });

  try {
    const body = await req.json().catch(() => null);
    const appVersion = optionalText(body?.app_version, 40);
    const model = optionalText(body?.device_model, 100);
    const manufacturer = optionalText(body?.device_manufacturer, 100);
    const androidVersion = optionalText(body?.android_version, 40);
    const simLast4 = optionalText(body?.sim_last4, 4);
    if ([appVersion, model, manufacturer, androidVersion, simLast4].includes("__invalid__")) {
      return respond(400, { error: "Invalid reader metadata" });
    }
    if (simLast4 && !/^[0-9]{4}$/.test(simLast4)) return respond(400, { error: "SIM last-four value is invalid" });

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const secretHash = await sha256(`etaabo-sms-reader-v1:${rawSecret}`);
    const { data, error } = await service.rpc("ping_sms_reader", {
      _device_secret_hash: secretHash,
      _app_version: appVersion,
      _device_model: model,
      _device_manufacturer: manufacturer,
      _android_version: androidVersion,
      _sim_last4: simLast4,
    });
    if (error) {
      const denied = /authentication failed|revoked/i.test(error.message);
      return respond(denied ? 401 : 400, {
        error: denied ? "Reader authentication failed or reader was revoked" : "Heartbeat was rejected",
      });
    }
    const reader = Array.isArray(data) ? data[0] : data;
    if (!reader?.reader_id) return respond(401, { error: "Reader authentication failed" });
    return respond(200, { ok: true, reader_id: reader.reader_id, last_seen_at: reader.last_seen_at });
  } catch {
    return respond(400, { error: "Heartbeat could not be processed" });
  }
});
