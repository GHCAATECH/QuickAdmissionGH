import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
type JsonRecord = Record<string, unknown>;
const structureCache = new Map<string, { expiresAt: number; value: unknown }>();

function text(value: unknown) { return String(value ?? "").trim(); }

async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_bucket_key: key,
    p_limit: limit,
    p_window_seconds: seconds,
  });
  return !!error || data?.allowed !== false;
}

async function resolveProfile(admin: ReturnType<typeof createClient>, req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: profile } = await admin.from("profiles")
    .select("id,role,school_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  return profile as JsonRecord | null;
}

function canRead(profile: JsonRecord | null, schoolId: string) {
  if (!profile) return false;
  const role = text(profile.role).toLowerCase().replace(/\s+/g, "_");
  return role === "super_admin" || (role === "school_admin" && text(profile.school_id) === schoolId);
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { methods: ["POST", "OPTIONS"], maxBodyBytes: 16_384 });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ ok: false, error: "not_configured", message: "Supabase service credentials are missing." }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const profile = await resolveProfile(admin, req);
  if (!profile) return json({ ok: false, error: "unauthorized", message: "You must be signed in." }, 401);

  let body: JsonRecord = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "validation", message: "A JSON request body is required." }, 400); }
  const schoolId = text(body.school_id || profile.school_id);
  if (!schoolId || !canRead(profile, schoolId)) return json({ ok: false, error: "forbidden", message: "You cannot access this school structure." }, 403);
  if (!await rateAllowed(admin, `admin-school-structure:${text(profile.id)}:${schoolId}`, 60, 60)) {
    return json({ ok: false, error: "rate_limited", message: "Too many structure requests. Please wait a minute and try again." }, 429);
  }
  const cached = structureCache.get(schoolId);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);

  const [programmes, houses, classrooms] = await Promise.all([
    admin.from("programmes").select("id,code,name,subjects,capacity").eq("school_id", schoolId).order("code").limit(5000),
    admin.from("houses").select("id,name,color,motto,capacity,priority,gender,residential_type").eq("school_id", schoolId).order("name").limit(5000),
    admin.from("classrooms").select("id,name,code,capacity,subjects,programme_id").eq("school_id", schoolId).order("name").limit(5000),
  ]);
  const error = programmes.error || houses.error || classrooms.error;
  if (error) return json({ ok: false, error: "query_failed", message: error.message }, 500);
  const payload = { ok: true, school_id: schoolId, programmes: programmes.data ?? [], houses: houses.data ?? [], classrooms: classrooms.data ?? [] };
  structureCache.set(schoolId, { expiresAt: Date.now() + 15_000, value: payload });
  if (structureCache.size > 100) {
    const oldest = structureCache.keys().next().value;
    if (oldest) structureCache.delete(oldest);
  }
  return json(payload);
});
