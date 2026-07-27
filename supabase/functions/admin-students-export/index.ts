import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
type JsonRecord = Record<string, unknown>;

const text = (value: unknown) => String(value ?? "").trim();
const cleanSearch = (value: unknown) => text(value).replace(/[%,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
const csv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

async function profileFor(admin: ReturnType<typeof createClient>, req: Request) {
  const token = text(req.headers.get("Authorization")).replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return null;
  const { data } = await admin.from("profiles").select("id,role,school_id,permissions").eq("id", auth.user.id).maybeSingle();
  return data as JsonRecord | null;
}

function allowed(profile: JsonRecord | null, schoolId: string) {
  if (!profile) return false;
  if (text(profile.role) === "super_admin") return true;
  if (text(profile.role) !== "school_admin" || text(profile.school_id) !== schoolId) return false;
  const permissions = profile.permissions;
  if (permissions == null) return true;
  const values = permissions as JsonRecord;
  return values.students === true || values.students === "true" || values.co_admin === true || values.co_admin === "true";
}

async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", { p_bucket_key: key, p_limit: limit, p_window_seconds: seconds });
  return !!error || data?.allowed !== false;
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { methods: ["POST", "OPTIONS"], maxBodyBytes: 16_384 });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ ok: false, error: "not_configured", message: "Supabase service credentials are missing." }, 500);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const profile = await profileFor(admin, req);
  if (!profile) return json({ ok: false, error: "unauthorized", message: "You must be signed in." }, 401);
  let body: JsonRecord = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "validation", message: "A JSON request body is required." }, 400); }
  const schoolId = text(body.school_id || profile.school_id);
  if (!schoolId || !allowed(profile, schoolId)) return json({ ok: false, error: "forbidden", message: "You cannot export students for this school." }, 403);
  const actorKey = text(profile.id) || text(req.headers.get("x-forwarded-for")) || "unknown";
  if (!await rateAllowed(admin, `student-export:${actorKey}:${schoolId}`, 5, 60)) return json({ ok: false, error: "rate_limited", message: "Too many exports requested. Please wait a minute and try again." }, 429);
  let query = admin.from("students").select("bece_index,admission_no,full_name,gender,programme_id,class_id,house_id,submitted_at,records", { count: "exact" }).eq("school_id", schoolId).not("submitted_at", "is", null).order("created_at", { ascending: false });
  const search = cleanSearch(body.search);
  if (search) {
    const escaped = search.replace(/[%_]/g, (value) => `\\${value}`);
    query = query.or(`full_name.ilike.%${escaped}%,bece_index.ilike.%${escaped}%,admission_no.ilike.%${escaped}%`);
  }
  const programmeId = text(body.programme_id), classId = text(body.class_id), houseId = text(body.house_id);
  if (programmeId) query = query.eq("programme_id", programmeId);
  if (classId) query = query.eq("class_id", classId);
  if (houseId) query = query.eq("house_id", houseId);
  const { count } = await query.range(0, 0);
  if ((count ?? 0) > 100_000) return json({ ok: false, error: "export_too_large", message: "This export exceeds 100,000 rows. Narrow the filters or use a background export." }, 413);
  const { data, error } = await query.range(0, Math.max((count ?? 1) - 1, 0));
  if (error) return json({ ok: false, error: "query_failed", message: error.message }, 500);
  const rows = (data ?? []) as JsonRecord[];
  const ids = (key: string) => [...new Set(rows.map((row) => text(row[key])).filter(Boolean))];
  const [programmes, classes, houses] = await Promise.all([
    ids("programme_id").length ? admin.from("programmes").select("id,name").eq("school_id", schoolId).in("id", ids("programme_id")) : Promise.resolve({ data: [] }),
    ids("class_id").length ? admin.from("classrooms").select("id,name").eq("school_id", schoolId).in("id", ids("class_id")) : Promise.resolve({ data: [] }),
    ids("house_id").length ? admin.from("houses").select("id,name").eq("school_id", schoolId).in("id", ids("house_id")) : Promise.resolve({ data: [] }),
  ]);
  const names = (items: unknown[] | null | undefined) => new Map((items ?? []).map((item) => { const row = item as JsonRecord; return [text(row.id), text(row.name)]; }));
  const pNames = names(programmes.data), cNames = names(classes.data), hNames = names(houses.data);
  const lines = [["S/N", "Admission No", "BECE Index No", "Student Name", "Gender", "Programme", "Class", "House", "Residential Status", "Date Registered", "SMS Contact", "Enrolment Code"]];
  rows.forEach((row, index) => {
    const record = (row.records as JsonRecord | null) ?? {};
    lines.push([index + 1, row.admission_no, row.bece_index, row.full_name, row.gender, pNames.get(text(row.programme_id)), cNames.get(text(row.class_id)), hNames.get(text(row.house_id)), record.residential_status || record.residential, text(row.submitted_at).slice(0, 10), record.sms_contact, record.enrolment_code]);
  });
  const content = "\ufeff" + lines.map((line) => line.map(csv).join(",")).join("\r\n");
  return new Response(content, { status: 200, headers: { ...corsHeaders(req), "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="admission-list-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
});
