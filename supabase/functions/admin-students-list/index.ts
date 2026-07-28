import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type JsonRecord = Record<string, unknown>;

const listCache = new Map<string, { expiresAt: number; value: unknown }>();

function text(value: unknown) {
  return String(value ?? "").trim();
}

function asPage(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), max) : fallback;
}

function cleanSearch(value: unknown) {
  return text(value)
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", { p_bucket_key: key, p_limit: limit, p_window_seconds: seconds });
  return !!error || data?.allowed !== false;
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
  return profile as JsonRecord | null;
}

function canReadStudents(profile: JsonRecord | null, schoolId: string) {
  if (!profile) return false;
  const role = text(profile.role);
  if (role === "super_admin") return true;
  if (role !== "school_admin" || text(profile.school_id) !== schoolId) return false;
  const permissions = profile.permissions;
  if (permissions == null) return true;
  if (typeof permissions !== "object" || Array.isArray(permissions)) return false;
  const values = permissions as JsonRecord;
  return values.students === true || values.students === "true" || values.co_admin === true || values.co_admin === "true";
}

function mapById(rows: unknown[] | null | undefined, nameKeys: string[]) {
  const result = new Map<string, string>();
  for (const row of rows ?? []) {
    const record = row as JsonRecord;
    const id = text(record.id);
    if (!id) continue;
    const name = nameKeys.map((key) => text(record[key])).find(Boolean) ?? "";
    result.set(id, name);
  }
  return result;
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { methods: ["POST", "OPTIONS"], maxBodyBytes: 16_384 });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "not_configured", message: "Supabase service credentials are missing." }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const profile = await resolveProfile(admin, req);
  if (!profile) return json({ ok: false, error: "unauthorized", message: "You must be signed in." }, 401);

  let body: JsonRecord = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "validation", message: "A JSON request body is required." }, 400);
  }

  const schoolId = text(body.school_id || profile.school_id);
  if (!schoolId || !canReadStudents(profile, schoolId)) {
    return json({ ok: false, error: "forbidden", message: "You cannot access students for this school." }, 403);
  }
  if (!await rateAllowed(admin, `admin-students-list:${text(profile.id)}:${schoolId}`, 120, 60)) {
    return json({ ok: false, error: "rate_limited", message: "Too many student-list requests. Please wait a minute and try again." }, 429);
  }

  const page = asPage(body.page, 1, 1_000_000);
  const pageSize = asPage(body.page_size, 50, 100);
  const search = cleanSearch(body.search);
  const status = text(body.status);
  const programmeId = text(body.programme_id);
  const classId = text(body.class_id);
  const houseId = text(body.house_id);
  const submittedOnly = body.submitted_only === true || body.submitted_only === "true";
  const cacheKey = [
    text(profile.id), schoolId, page, pageSize, search, status, programmeId, classId, houseId, submittedOnly ? "submitted" : "all",
  ].join("|");
  const cached = listCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);

  let query = admin
    .from("students")
    .select("id,school_id,full_name,bece_index,admission_no,permanent_admission_number,gender,programme_id,class_id,house_id,status,verification_status,verified_at,verified_by,verification_notes,passport_photo_url,enrolment_form_url,parent_name,payment_status,submitted_at,created_at,personal_done,programme_done,undertaking_done,records", { count: "exact" })
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (submittedOnly) query = query.not("submitted_at", "is", null);
  if (status) query = query.eq("status", status);
  if (programmeId) query = query.eq("programme_id", programmeId);
  if (classId) query = query.eq("class_id", classId);
  if (houseId) query = query.eq("house_id", houseId);
  if (search) {
    const escaped = search.replace(/[%_]/g, (value) => `\\${value}`);
    query = query.or(`full_name.ilike.%${escaped}%,bece_index.ilike.%${escaped}%,admission_no.ilike.%${escaped}%,permanent_admission_number.ilike.%${escaped}%`);
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error) return json({ ok: false, error: "query_failed", message: error.message }, 500);

  const rows = (data ?? []) as JsonRecord[];
  const programmeIds = [...new Set(rows.map((row) => text(row.programme_id)).filter(Boolean))];
  const classIds = [...new Set(rows.map((row) => text(row.class_id)).filter(Boolean))];
  const houseIds = [...new Set(rows.map((row) => text(row.house_id)).filter(Boolean))];
  const [programmes, classes, houses] = await Promise.all([
    programmeIds.length ? admin.from("programmes").select("id,name,code").eq("school_id", schoolId).in("id", programmeIds) : Promise.resolve({ data: [] }),
    classIds.length ? admin.from("classrooms").select("id,name,code").eq("school_id", schoolId).in("id", classIds) : Promise.resolve({ data: [] }),
    houseIds.length ? admin.from("houses").select("id,name").eq("school_id", schoolId).in("id", houseIds) : Promise.resolve({ data: [] }),
  ]);
  const programmeMap = mapById(programmes.data, ["name", "code"]);
  const classMap = mapById(classes.data, ["name", "code"]);
  const houseMap = mapById(houses.data, ["name"]);

  const result = rows.map((row) => ({
    ...row,
    programme_name: programmeMap.get(text(row.programme_id)) ?? "",
    class_name: classMap.get(text(row.class_id)) ?? "",
    house_name: houseMap.get(text(row.house_id)) ?? "",
  }));
  const total = count ?? 0;
  const payload = {
    ok: true,
    school_id: schoolId,
    page,
    page_size: pageSize,
    total,
    total_pages: Math.max(Math.ceil(total / pageSize), 1),
    rows: result,
  };
  listCache.set(cacheKey, { expiresAt: Date.now() + 10_000, value: payload });
  if (listCache.size > 250) {
    const oldest = listCache.keys().next().value;
    if (oldest) listCache.delete(oldest);
  }
  return json(payload);
});
