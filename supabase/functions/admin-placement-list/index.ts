import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type JsonRecord = Record<string, unknown>;
function text(value: unknown) { return String(value ?? "").trim(); }
function pageValue(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), max) : fallback;
}
function cleanSearch(value: unknown) {
  return text(value).replace(/[%,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
function truthy(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}
function nullableText(value: unknown, maxLength: number) {
  const cleaned = text(value).slice(0, maxLength);
  return cleaned || null;
}
function hasOwn(source: JsonRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key);
}
async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", { p_bucket_key: key, p_limit: limit, p_window_seconds: seconds });
  return !error && data?.allowed !== false;
}
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
  return truthy(permissions.placement) || truthy(permissions.co_admin);
}
function canWrite(profile: JsonRecord | null, schoolId: string) {
  if (!profile) return false;
  if (text(profile.role) === "super_admin") return true;
  if (text(profile.role) !== "school_admin" || text(profile.school_id) !== schoolId) return false;
  if (profile.permissions == null) return true;
  const permissions = profile.permissions && typeof profile.permissions === "object" && !Array.isArray(profile.permissions)
    ? profile.permissions as JsonRecord
    : {};
  return truthy(permissions.co_admin);
}

function placementPatch(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
  const patch: JsonRecord = {};
  if (hasOwn(source, "student_name")) patch.student_name = nullableText(source.student_name, 180);
  if (hasOwn(source, "gender")) {
    const gender = text(source.gender).toLowerCase();
    patch.gender = gender === "male" || gender === "m" ? "Male" : gender === "female" || gender === "f" ? "Female" : null;
  }
  if (hasOwn(source, "residential_status")) {
    const residential = text(source.residential_status).toLowerCase().replace(/[^a-z]/g, "");
    patch.residential_status = ["boarding", "boarder", "resident", "b"].includes(residential)
      ? "Boarding"
      : ["day", "daystudent", "d"].includes(residential)
      ? "Day"
      : null;
  }
  if (hasOwn(source, "programme")) patch.programme = nullableText(source.programme, 160);
  if (hasOwn(source, "aggregate")) {
    const aggregate = Number(source.aggregate);
    patch.aggregate = source.aggregate == null || source.aggregate === "" || !Number.isFinite(aggregate)
      ? null
      : Math.trunc(aggregate);
  }
  if (hasOwn(source, "jhs_attended")) patch.jhs_attended = nullableText(source.jhs_attended, 200);
  if (hasOwn(source, "dob")) {
    const dob = text(source.dob);
    patch.dob = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null;
  }
  if (hasOwn(source, "sms_contact")) patch.sms_contact = nullableText(source.sms_contact, 30);
  if (hasOwn(source, "enrolment_code")) patch.enrolment_code = nullableText(source.enrolment_code, 60);
  return patch;
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
  if (!schoolId || !canRead(profile, schoolId)) return json({ ok: false, error: "forbidden", message: "You cannot access this placement list." }, 403);
  if (!await rateAllowed(admin, `admin-placement-list:${text(profile.id)}:${schoolId}`, 60, 60)) return json({ ok: false, error: "rate_limited", message: "Too many placement-list requests. Please wait a minute and try again." }, 429);
  const action = text(body.action).toLowerCase() || "list";

  if (action === "update" || action === "delete") {
    if (!canWrite(profile, schoolId)) {
      return json({ ok: false, error: "forbidden", message: "Only the school owner or a co-admin can change placement records." }, 403);
    }
    const indexNumber = text(body.index_number).slice(0, 80);
    if (!indexNumber) return json({ ok: false, error: "validation", message: "index_number is required." }, 400);

    if (action === "update") {
      const patch = placementPatch(body.patch);
      if (!Object.keys(patch).length) return json({ ok: false, error: "validation", message: "No supported placement fields were supplied." }, 400);
      if (hasOwn(patch, "student_name") && !patch.student_name) {
        return json({ ok: false, error: "validation", message: "Student name is required." }, 400);
      }
      const aggregate = patch.aggregate;
      if (aggregate != null && (Number(aggregate) < 6 || Number(aggregate) > 54)) {
        return json({ ok: false, error: "validation", message: "Aggregate must be between 6 and 54." }, 400);
      }
      const { data, error } = await admin
        .from("placement_list")
        .update(patch)
        .eq("school_id", schoolId)
        .eq("index_number", indexNumber)
        .select("index_number,student_name,gender,residential_status,programme,aggregate,jhs_attended,dob,sms_contact,enrolment_code,logged_in")
        .maybeSingle();
      if (error) return json({ ok: false, error: "update_failed", message: error.message }, 500);
      if (!data) return json({ ok: false, error: "not_found", message: "Placement record was not found." }, 404);
      return json({ ok: true, row: data });
    }

    const { data, error } = await admin
      .from("placement_list")
      .delete()
      .eq("school_id", schoolId)
      .eq("index_number", indexNumber)
      .select("index_number");
    if (error) return json({ ok: false, error: "delete_failed", message: error.message }, 500);
    if (!data?.length) return json({ ok: false, error: "not_found", message: "Placement record was not found." }, 404);
    return json({ ok: true, deleted: data.length });
  }

  if (action !== "list") return json({ ok: false, error: "validation", message: "Unknown action." }, 400);
  const page = pageValue(body.page, 1, 1_000_000);
  const pageSize = pageValue(body.page_size, 500, 5_000);
  const search = cleanSearch(body.search);
  let query = admin
    .from("placement_list")
    .select("index_number,student_name,gender,residential_status,programme,aggregate,jhs_attended,dob,sms_contact,enrolment_code,logged_in", { count: "exact" })
    .eq("school_id", schoolId)
    .order("index_number", { ascending: true });
  if (search) {
    const escaped = search.replace(/[%_]/g, (value) => `\\${value}`);
    query = query.or(`student_name.ilike.%${escaped}%,index_number.ilike.%${escaped}%`);
  }
  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error) return json({ ok: false, error: "query_failed", message: error.message }, 500);
  const total = count ?? 0;
  return json({ ok: true, school_id: schoolId, page, page_size: pageSize, total, total_pages: Math.max(Math.ceil(total / pageSize), 1), rows: data ?? [] });
});
