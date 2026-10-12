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

  let invitedUserId: string | null = null;
  let createdUser = false;

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
      .select("id, name")
      .eq("id", merchantId)
      .maybeSingle();
    if (merchantError) throw merchantError;
    if (!merchant) return respond(404, { error: "Merchant not found" });

    const { data: usersResult, error: usersError } = await service.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersError) throw usersError;
    const existingUser = usersResult.users.find(
      (candidate) => candidate.email?.trim().toLowerCase() === email,
    );

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(
        email,
        {
          data: { full_name: fullName },
          redirectTo: "https://admin.etaabo.com/set-password",
        },
      );
      if (inviteError) throw inviteError;
      if (!inviteData.user) throw new Error("Supabase did not return the invited user");
      userId = inviteData.user.id;
      invitedUserId = userId;
      createdUser = true;
    }

    const { error: profileError } = await service.from("profiles").upsert(
      { id: userId, email, full_name: fullName },
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
      invited: createdUser,
      email,
      merchant_name: merchant.name,
      message: createdUser
        ? "Invitation sent. The merchant admin must accept the email invite to sign in."
        : "Existing account linked as merchant owner.",
    });
  } catch (error) {
    if (createdUser && invitedUserId) {
      try {
        const service = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await service.auth.admin.deleteUser(invitedUserId);
      } catch {
        // Keep the original error as the useful outcome.
      }
    }
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return respond(500, { error: message });
  }
});
