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

function normalizeEvent(event: unknown): Record<string, unknown> | null {
  if (!event || typeof event !== "object" || Array.isArray(event)) return null;
  const value = event as Record<string, unknown>;

  const direction = typeof value.direction === "string" ? value.direction.toLowerCase() : "";
  const provider = typeof value.provider === "string" ? value.provider.toLowerCase() : "";
  const amount = typeof value.amount === "number" ? value.amount : Number(value.amount);
  const currency = typeof value.currency === "string" ? value.currency.toUpperCase() : "USD";
  const occurredAt = typeof value.occurred_at === "string" ? value.occurred_at : "";
  const dedupeKey = typeof value.dedupe_key === "string" ? value.dedupe_key.toLowerCase() : "";
  const txId = value.tx_id === null || value.tx_id === undefined || value.tx_id === ""
    ? null
    : typeof value.tx_id === "string" ? value.tx_id.trim() : "__invalid__";
  const counterparty = value.counterparty === null || value.counterparty === undefined || value.counterparty === ""
    ? null
    : typeof value.counterparty === "string" ? value.counterparty.trim() : "__invalid__";
  const smsBody = typeof value.sms_body === "string" ? value.sms_body : "";
  const counterpartyName = value.counterparty_name === null || value.counterparty_name === undefined || value.counterparty_name === ""
    ? null
    : typeof value.counterparty_name === "string"
      ? value.counterparty_name.trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 120)
      : "__invalid__";

  if (!["incoming", "outgoing"].includes(direction)) return null;
  if (!["evc", "edahab", "premier"].includes(provider)) return null;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000 || Math.round(amount * 100) !== amount * 100) return null;
  if (!["USD", "SOS"].includes(currency)) return null;
  if (!Number.isFinite(Date.parse(occurredAt)) || !/^\d{4}-\d{2}-\d{2}T/.test(occurredAt)) return null;
  if (!/^[a-f0-9:_-]{16,128}$/.test(dedupeKey)) return null;
  if (txId === "__invalid__" || (txId !== null && !/^[A-Za-z0-9_-]{1,100}$/.test(txId))) return null;
  if (counterparty === "__invalid__" || (counterparty !== null && !/^\+?[0-9*# -]{6,24}$/.test(counterparty))) return null;
  if (counterpartyName === "__invalid__") return null;
  if (smsBody.length > 5000 || smsBody.includes("\u0000")) return null;

  // Full body is accepted only alongside a validated, allowlisted financial event; the server binds it to the paired reader merchant.
  return {
    direction,
    provider,
    amount,
    currency,
    occurred_at: new Date(occurredAt).toISOString(),
    dedupe_key: dedupeKey,
    tx_id: txId,
    counterparty,
    counterparty_name: counterpartyName,
    sms_body: smsBody,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

  const rawSecret = req.headers.get("x-reader-secret") ?? "";
  if (!/^[a-f0-9]{64}$/.test(rawSecret)) return respond(401, { error: "Reader authentication failed" });

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 512 * 1024) return respond(413, { error: "Batch is too large" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !serviceKey) return respond(500, { error: "Server configuration is missing" });

  try {
    const body = await req.json().catch(() => null);
    const events = body?.events;
    const appVersion = typeof body?.app_version === "string" ? body.app_version.trim().slice(0, 40) : null;
    if (!Array.isArray(events) || events.length < 1 || events.length > 100) {
      return respond(400, { error: "Sync batch must contain 1 to 100 parsed financial events" });
    }

    const normalized = events.map(normalizeEvent);
    if (normalized.some((event) => event === null)) {
      return respond(400, { error: "Batch contains an invalid event. Send valid parsed financial events and an SMS body no longer than 5000 characters." });
    }

    const secretHash = await sha256(`etaabo-sms-reader-v1:${rawSecret}`);
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: insertedCount, error } = await service.rpc("ingest_sms_reader_batch", {
      _device_secret_hash: secretHash,
      _app_version: appVersion,
      _events: normalized,
    });
    if (error) {
      const authOrRevoked = /authentication failed|revoked/i.test(error.message);
      return respond(authOrRevoked ? 401 : 400, {
        error: authOrRevoked ? "Reader authentication failed or reader was revoked" : "Financial batch was rejected",
      });
    }

    return respond(200, {
      ok: true,
      received: normalized.length,
      inserted: insertedCount,
      duplicates_ignored: normalized.length - Number(insertedCount ?? 0),
      payment_status_note: "SMS ingestion does not confirm a Tap2Pay session. All ingested transactions remain unverified and need review.",
    });
  } catch {
    return respond(400, { error: "Sync batch could not be processed" });
  }
});
