import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const blocked = guardRequest(req, { maxBodyBytes: 16_384 });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "Missing Supabase service configuration" }, 500);

  const admin = createClient(url, serviceKey);
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerData.user) return json({ error: "Not authenticated" }, 401);

  const { data: callerProfile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .single();

  const callerRole = String(callerProfile?.role ?? "").trim().toLowerCase();
  if (profileError || !["super admin", "super_admin"].includes(callerRole)) {
    return json({ error: "Only Super Admin can create school administrators" }, 403);
  }

  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.full_name ?? "").trim();
  const role = String(body.role ?? "School Administrator");
  const schoolId = body.school_id || null;

  if (!email || !password || !fullName) {
    return json({ error: "Email, password, and full name are required" }, 400);
  }
  if (role !== "Super Admin" && !schoolId) {
    return json({ error: "Select a school for this user" }, 400);
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    phone: body.phone || undefined,
    user_metadata: {
      full_name: fullName,
      role,
      school_id: schoolId
    }
  });

  if (authError || !authData.user) return json({ error: authError }, 400);

  const { data: profile, error: upsertError } = await admin
    .from("profiles")
    .upsert({
      id: authData.user.id,
      school_id: schoolId,
      role,
      full_name: fullName,
      email,
      phone: body.phone || null,
      status: body.status || "Active",
      updated_at: new Date().toISOString()
    }, { onConflict: "id" })
    .select()
    .single();

  if (upsertError) return json({ error: upsertError }, 400);

  return json({ user: authData.user, profile });
});
