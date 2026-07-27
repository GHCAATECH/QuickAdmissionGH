import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function text(value: unknown) {
  return String(value ?? "").trim();
}

async function resolveProfile(admin: ReturnType<typeof createClient>, req: Request) {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("id,role,school_id,permissions")
    .eq("id", authData.user.id)
    .maybeSingle();
  return profile as Record<string, unknown> | null;
}

function canRead(profile: Record<string, unknown> | null, schoolId: string) {
  if (!profile) return false;
  if (text(profile.role) === "super_admin") return true;
  if (text(profile.role) !== "school_admin" || text(profile.school_id) !== schoolId) return false;
  if (profile.permissions == null) return true;
  const permissions = profile.permissions as Record<string, unknown>;
  return permissions.students === true || permissions.students === "true" || permissions.dashboard === true || permissions.dashboard === "true" || permissions.co_admin === true || permissions.co_admin === "true";
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { methods: ["POST", "OPTIONS"], maxBodyBytes: 8_192 });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ ok: false, error: "not_configured", message: "Supabase service credentials are missing." }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const profile = await resolveProfile(admin, req);
  if (!profile) return json({ ok: false, error: "unauthorized", message: "You must be signed in." }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "validation", message: "A JSON request body is required." }, 400); }
  const schoolId = text(body.school_id || profile.school_id);
  if (!schoolId || !canRead(profile, schoolId)) return json({ ok: false, error: "forbidden", message: "You cannot access this school summary." }, 403);

  const { data, error } = await admin.rpc("admin_school_summary", { p_school: schoolId });
  if (error) return json({ ok: false, error: "summary_failed", message: error.message }, 500);
  return json({ ok: true, school_id: schoolId, summary: data ?? {} });
});
