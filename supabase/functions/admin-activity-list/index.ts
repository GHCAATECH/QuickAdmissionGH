import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
type JsonRecord = Record<string, unknown>;
const activityCache = new Map<string, { expiresAt: number; value: unknown }>();
const text = (value: unknown) => String(value ?? "").trim();
const truthy = (value: unknown) => value === true || value === "true" || value === 1 || value === "1";
async function resolveProfile(admin: ReturnType<typeof createClient>, req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: profile } = await admin.from("profiles").select("id,role,school_id,permissions").eq("id", authData.user.id).maybeSingle();
  return profile as JsonRecord | null;
}
function canRead(profile: JsonRecord | null, schoolId: string) {
  if (!profile) return false;
  if (text(profile.role) === "super_admin") return true;
  if (text(profile.role) !== "school_admin" || text(profile.school_id) !== schoolId) return false;
  if (profile.permissions == null) return true;
  if (typeof profile.permissions !== "object" || Array.isArray(profile.permissions)) return false;
  const permissions = profile.permissions as JsonRecord;
  return truthy(permissions.dashboard) || truthy(permissions.reports) || truthy(permissions.utilities) || truthy(permissions.co_admin);
}
async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", { p_bucket_key: key, p_limit: limit, p_window_seconds: seconds });
  return !error && data?.allowed !== false;
}
Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { methods: ["POST", "OPTIONS"], maxBodyBytes: 8_192, requireAal2: true });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ ok: false, error: "not_configured", message: "Supabase service credentials are missing." }, 500);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const profile = await resolveProfile(admin, req);
  if (!profile) return json({ ok: false, error: "unauthorized", message: "You must be signed in." }, 401);
  let body: JsonRecord = {};
  try { body = await req.json(); } catch { body = {}; }
  const schoolId = text(body.school_id || profile.school_id);
  if (!schoolId || !canRead(profile, schoolId)) return json({ ok: false, error: "forbidden", message: "You cannot access this activity log." }, 403);
  if (!await rateAllowed(admin, `admin-activity-list:${text(profile.id)}:${schoolId}`, 60, 60)) return json({ ok: false, error: "rate_limited", message: "Too many activity-log requests. Please wait a minute and try again." }, 429);
  const cached = activityCache.get(schoolId);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);
  const { data, error } = await admin.from("activity_log").select("created_at,action,actor").eq("school_id", schoolId).order("created_at", { ascending: false }).range(0, 499);
  if (error) return json({ ok: false, error: "query_failed", message: error.message }, 500);
  const payload = { ok: true, school_id: schoolId, rows: data ?? [] };
  activityCache.set(schoolId, { expiresAt: Date.now() + 10_000, value: payload });
  if (activityCache.size > 100) {
    const oldest = activityCache.keys().next().value;
    if (oldest) activityCache.delete(oldest);
  }
  return json(payload);
});
