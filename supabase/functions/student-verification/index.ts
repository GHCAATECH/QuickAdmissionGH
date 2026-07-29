import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type JsonRecord = Record<string, unknown>;

type Profile = {
  id: string;
  role: string;
  school_id: string | null;
  permissions: Record<string, unknown> | null;
  full_name: string | null;
  email: string | null;
};

function safeText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function storageObjectPath(value: unknown) {
  const text = safeText(value);
  if (!text) return "";
  const directBucket = text.match(/^enrolment-forms\/(.+)$/i);
  if (directBucket) return decodeURIComponent(directBucket[1]);
  const publicMatch = text.match(/\/storage\/v1\/object\/public\/enrolment-forms\/(.+)$/i)
    ?? text.match(/enrolment-forms\/(.+)$/i);
  if (publicMatch) return decodeURIComponent(publicMatch[1]);
  if (/^(passport-photos\/)?[^?#]+\.(?:jpe?g|png)$/i.test(text)) return text;
  return "";
}

function pickFirstYear(value: unknown): string {
  const text = safeText(value);
  const match = text.match(/(\d{4})/);
  return match ? match[1] : "";
}

function truthy(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

async function resolveProfile(admin: ReturnType<typeof createClient>, req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { user: null, profile: null as Profile | null };

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return { user: null, profile: null as Profile | null };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, school_id, permissions, full_name, email")
    .eq("id", userData.user.id)
    .maybeSingle();

  return { user: userData.user, profile: (profile ?? null) as Profile | null };
}

function hasSchoolAccess(profile: Profile | null, schoolId: string) {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  return profile.role === "school_admin" && safeText(profile.school_id) === schoolId;
}

function hasPerm(profile: Profile | null, key: string) {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role !== "school_admin") return false;
  if (profile.permissions == null) return true;
  if (truthy(profile.permissions.co_admin)) return true;
  return truthy(profile.permissions[key]);
}

function canReverse(profile: Profile | null) {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role !== "school_admin") return false;
  if (profile.permissions == null) return true;
  return truthy(profile.permissions.reverse_student_verification);
}

function sanitizeSearch(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", { p_bucket_key: key, p_limit: limit, p_window_seconds: seconds });
  return !!error || data?.allowed !== false;
}

function studentText(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    const text = safeText(value);
    if (text) return text;
  }
  return "";
}

function studentMatchesQuery(student: JsonRecord, query: string) {
  if (!query) return true;
  const q = sanitizeSearch(query);
  const records = student.records && typeof student.records === "object" && !Array.isArray(student.records)
    ? student.records as JsonRecord
    : {};
  const haystack = [
    safeText(student.full_name),
    safeText(student.bece_index),
    safeText(student.admission_no),
    safeText(student.parent_phone),
    safeText(student.permanent_admission_number),
    safeText(records.enrolment_code),
    safeText(records.registration_number),
    safeText(records.student_phone),
    safeText(records.phone_number),
    safeText(records.guardian_phone),
    safeText(records.whatsapp),
    safeText(records.other_phone),
  ].join(" \n").toLowerCase();
  return haystack.includes(q);
}

const schoolContextCache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<typeof loadSchoolContext>> }>();
const verificationSearchCache = new Map<string, { expiresAt: number; value: unknown }>();
const verifiedListCache = new Map<string, { expiresAt: number; value: unknown }>();

function residentialStatus(student: JsonRecord, placement: JsonRecord) {
  const records = student.records && typeof student.records === "object" && !Array.isArray(student.records)
    ? student.records as JsonRecord
    : {};
  return safeText(
    student.residential_status ||
    records.residential_status ||
    records.residential ||
    records.residentialStatus ||
    records.boarding_status ||
    placement.residential_status ||
    placement.residential ||
    placement.boarding_status
  );
}

function toStudentSummary(student: JsonRecord, maps: { programmes: Map<string,string>; classes: Map<string,string>; houses: Map<string,string>; users: Map<string,string>; placements: Map<string,JsonRecord>; schoolName: string; schoolCrest: string; academicYear: string; schoolCode: string; }) {
  const records = student.records && typeof student.records === "object" && !Array.isArray(student.records)
    ? student.records as JsonRecord
    : {};
  const placement = maps.placements.get(safeText(student.bece_index)) ?? {};
  const verifiedById = safeText(student.verified_by);
  return {
    id: safeText(student.id),
    school_id: safeText(student.school_id),
    programme_id: safeText(student.programme_id),
    class_id: safeText(student.class_id),
    house_id: safeText(student.house_id),
    full_name: safeText(student.full_name),
    bece_index: safeText(student.bece_index),
    application_number: safeText(student.admission_no),
    permanent_admission_number: safeText(student.permanent_admission_number),
    gender: safeText(student.gender || records.gender || placement.gender),
    programme: maps.programmes.get(safeText(student.programme_id)) ?? safeText(
      student.programme ||
      records.programme ||
      records.programme_name ||
      records.placed_programme ||
      placement.programme ||
      placement.programme_name
    ),
    class_name: maps.classes.get(safeText(student.class_id)) ?? safeText(records.class_name),
    residential_status: residentialStatus(student, placement),
    house_name: maps.houses.get(safeText(student.house_id)),
    student_phone: studentText(records,["student_phone","phone_number","sms_contact"]) || safeText(placement.sms_contact),
    guardian_contact: studentText(records,["guardian_phone","guardian_contact","father_phone","mother_phone"]) || safeText(student.parent_phone),
    registration_date: safeText(student.submitted_at || student.created_at).slice(0,10),
    verification_status: safeText(student.verification_status || "pending") || "pending",
    verified_at: safeText(student.verified_at),
    verified_by: verifiedById,
    verified_by_name: maps.users.get(verifiedById) ?? "",
    verification_notes: safeText(student.verification_notes),
    passport_photo_url: studentText(records,["passport_photo_url","photo_url"]) || safeText(student.passport_photo_url),
    passport_photo_path: studentText(records,["passport_photo_path"]) || storageObjectPath(studentText(records,["passport_photo_url","photo_url"]) || safeText(student.passport_photo_url)),
    enrolment_code: safeText(records.enrolment_code),
    registration_number: safeText(records.registration_number),
    school_name: maps.schoolName,
    school_crest: maps.schoolCrest,
    academic_year: maps.academicYear,
    school_code: maps.schoolCode,
  };
}

async function signStudentFiles(admin: ReturnType<typeof createClient>, row: JsonRecord) {
  const path = storageObjectPath(row.passport_photo_path || row.passport_photo_url);
  if (!path) return row;
  const { data } = await admin.storage.from("enrolment-forms").createSignedUrl(path, 60 * 10);
  if (data?.signedUrl) row.passport_photo_url = data.signedUrl;
  return row;
}

async function loadSchoolContext(admin: ReturnType<typeof createClient>, schoolId: string) {
  const cached = schoolContextCache.get(schoolId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const [schoolRes, cfgRes, programmesRes, classesRes, housesRes, usersRes, placementsRes] = await Promise.all([
    admin.from("schools").select("id,name,school_code,code,crest_url").eq("id", schoolId).maybeSingle(),
    admin.from("school_config").select("academic_year,admission_year").eq("school_id", schoolId).maybeSingle(),
    admin.from("programmes").select("id,name,code").eq("school_id", schoolId).limit(5_000),
    admin.from("classrooms").select("id,name").eq("school_id", schoolId).limit(5_000),
    admin.from("houses").select("id,name").eq("school_id", schoolId).limit(5_000),
    admin.from("profiles").select("id,full_name,email").eq("school_id", schoolId).limit(5_000),
    admin.from("placement_list").select("index_number,student_name,gender,residential_status,programme,sms_contact").eq("school_id", schoolId).order("index_number").limit(5_000),
  ]);
  const school = (schoolRes.data ?? {}) as JsonRecord;
  const cfg = (cfgRes.data ?? {}) as JsonRecord;
  const programmeMap = new Map<string,string>((programmesRes.data ?? []).map((row) => [safeText((row as JsonRecord).id), safeText((row as JsonRecord).name || (row as JsonRecord).code)]));
  const classMap = new Map<string,string>((classesRes.data ?? []).map((row) => [safeText((row as JsonRecord).id), safeText((row as JsonRecord).name)]));
  const houseMap = new Map<string,string>((housesRes.data ?? []).map((row) => [safeText((row as JsonRecord).id), safeText((row as JsonRecord).name)]));
  const userMap = new Map<string,string>((usersRes.data ?? []).map((row) => {
    const rec = row as JsonRecord;
    return [safeText(rec.id), safeText(rec.full_name || rec.email)];
  }));
  const placementEntries: Array<[string, JsonRecord]> = [];
  (placementsRes.data ?? []).forEach((row) => {
    const rec = row as JsonRecord;
    const index = safeText(rec.index_number);
    if (index) placementEntries.push([index, rec]);
  });
  const placementMap = new Map<string,JsonRecord>(placementEntries);
  const value = {
    programmes: programmeMap,
    classes: classMap,
    houses: houseMap,
    users: userMap,
    placements: placementMap,
    schoolName: safeText(school.name),
    schoolCrest: safeText(school.crest_url),
    academicYear: safeText(cfg.admission_year) || pickFirstYear(cfg.academic_year),
    schoolCode: safeText(school.school_code || school.code),
  };
  schoolContextCache.set(schoolId, { expiresAt: Date.now() + 30_000, value });
  if (schoolContextCache.size > 100) {
    const oldest = schoolContextCache.keys().next().value;
    if (oldest) schoolContextCache.delete(oldest);
  }
  return value;
}

async function searchCandidates(admin: ReturnType<typeof createClient>, schoolId: string, query: string) {
  const cacheKey = `${schoolId}:${sanitizeSearch(query)}`;
  const cached = verificationSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  let studentQuery = admin
    .from("students")
    .select("id,school_id,programme_id,class_id,house_id,full_name,bece_index,admission_no,permanent_admission_number,gender,parent_phone,submitted_at,created_at,verification_status,verified_at,verified_by,verification_notes,passport_photo_url,records")
    .eq("school_id", schoolId)
    .not("submitted_at", "is", null)
    .neq("status", "rejected")
    .order("submitted_at", { ascending: false });
  const search = sanitizeSearch(query);
  if (search) {
    const escaped = search.replace(/[%_]/g, (value) => `\\${value}`);
    studentQuery = studentQuery.or(`full_name.ilike.%${escaped}%,bece_index.ilike.%${escaped}%,admission_no.ilike.%${escaped}%,permanent_admission_number.ilike.%${escaped}%`);
  }
  const { data, error } = await studentQuery.limit(100);
  if (error) throw new Error("Could not search students.");
  const context = await loadSchoolContext(admin, schoolId);
  const rows = (data ?? [])
    .map((row) => row as JsonRecord)
    .filter((row) => studentMatchesQuery(row, query))
    .map((row) => toStudentSummary(row, context));
  const result = { ok: true, rows: await Promise.all(rows.slice(0, 60).map((row) => signStudentFiles(admin, row))) };
  verificationSearchCache.set(cacheKey, { expiresAt: Date.now() + 10_000, value: result });
  if (verificationSearchCache.size > 500) {
    const oldest = verificationSearchCache.keys().next().value;
    if (oldest) verificationSearchCache.delete(oldest);
  }
  return result;
}

async function listVerified(admin: ReturnType<typeof createClient>, schoolId: string, filters: JsonRecord) {
  const cacheKey = `${schoolId}:${JSON.stringify(filters)}`;
  const cached = verifiedListCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const search = safeText(filters.search);
  const gender = safeText(filters.gender).toUpperCase();
  const programme = safeText(filters.programme_id);
  const classId = safeText(filters.class_id);
  const houseId = safeText(filters.house_id);
  const residential = safeText(filters.residential_status).toLowerCase();
  const dateFrom = safeText(filters.date_from);
  const dateTo = safeText(filters.date_to);
  let verifiedQuery = admin
    .from("students")
    .select("id,school_id,programme_id,class_id,house_id,full_name,bece_index,admission_no,permanent_admission_number,gender,parent_phone,submitted_at,created_at,verification_status,verified_at,verified_by,verification_notes,passport_photo_url,records")
    .eq("school_id", schoolId)
    .eq("verification_status", "verified")
    .order("verified_at", { ascending: false })
    .limit(5_000);
  if (gender) verifiedQuery = verifiedQuery.ilike("gender", gender);
  if (programme) verifiedQuery = verifiedQuery.eq("programme_id", programme);
  if (classId) verifiedQuery = verifiedQuery.eq("class_id", classId);
  if (houseId) verifiedQuery = verifiedQuery.eq("house_id", houseId);
  if (dateFrom) verifiedQuery = verifiedQuery.gte("verified_at", `${dateFrom}T00:00:00.000Z`);
  if (dateTo) verifiedQuery = verifiedQuery.lte("verified_at", `${dateTo}T23:59:59.999Z`);
  const { data, error } = await verifiedQuery;
  if (error) throw new Error("Could not load verified students.");
  const context = await loadSchoolContext(admin, schoolId);
  let rows = (data ?? []).map((row) => toStudentSummary(row as JsonRecord, context));
  if (search) {
    const q = sanitizeSearch(search);
    rows = rows.filter((row) => [row.full_name, row.bece_index, row.permanent_admission_number, row.application_number, row.student_phone, row.guardian_contact].join(" \n").toLowerCase().includes(q));
  }
  if (gender) rows = rows.filter((row) => safeText(row.gender).toUpperCase() === gender);
  if (programme) rows = rows.filter((row) => safeText(row.programme_id || row.programme) === programme || safeText(row.programme) === safeText(context.programmes.get(programme)));
  if (classId) rows = rows.filter((row) => safeText(row.class_id || row.class_name) === classId || safeText(row.class_name) === safeText(context.classes.get(classId)));
  if (houseId) rows = rows.filter((row) => safeText(row.house_id || row.house_name) === houseId || safeText(row.house_name) === safeText(context.houses.get(houseId)));
  if (residential) rows = rows.filter((row) => safeText(row.residential_status).toLowerCase() === residential);
  if (dateFrom) rows = rows.filter((row) => safeText(row.verified_at).slice(0,10) >= dateFrom);
  if (dateTo) rows = rows.filter((row) => safeText(row.verified_at).slice(0,10) <= dateTo);
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.page_size) || 25, 1), 200);
  const total = rows.length;
  const start = (page - 1) * pageSize;
  const pagedSummaries = rows.slice(start, start + pageSize);
  const paged: JsonRecord[] = [];
  if (pageSize >= 5_000) {
    paged.push(...pagedSummaries);
  } else {
    for (let offset = 0; offset < pagedSummaries.length; offset += 50) {
      const batch = await Promise.all(pagedSummaries.slice(offset, offset + 50).map((row) => signStudentFiles(admin, row)));
      paged.push(...batch);
    }
  }
  const today = new Date().toISOString().slice(0,10);
  const summary = {
    total_verified: total,
    male: rows.filter((row) => safeText(row.gender).toUpperCase() === 'M').length,
    female: rows.filter((row) => safeText(row.gender).toUpperCase() === 'F').length,
    day_students: rows.filter((row) => safeText(row.residential_status).toLowerCase() === 'day').length,
    boarding_students: rows.filter((row) => safeText(row.residential_status).toLowerCase() === 'boarding').length,
    verified_today: rows.filter((row) => safeText(row.verified_at).slice(0,10) === today).length,
  };
  const result = { ok: true, page, page_size: pageSize, total, total_pages: Math.max(Math.ceil(total / pageSize), 1), rows: paged, all_rows: pageSize >= 5_000 ? rows : [], truncated: data?.length === 5_000, summary };
  verifiedListCache.set(cacheKey, { expiresAt: Date.now() + 10_000, value: result });
  if (verifiedListCache.size > 250) {
    const oldest = verifiedListCache.keys().next().value;
    if (oldest) verifiedListCache.delete(oldest);
  }
  return result;
}

async function runRpc(admin: ReturnType<typeof createClient>, fn: string, args: JsonRecord) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message || 'Verification request failed.');
  return data;
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { maxBodyBytes: 65_536 });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: 'not_configured', message: 'Supabase service credentials are missing.' }, 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: JsonRecord = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = safeText(body.action).toLowerCase();
  if (!action) return json({ ok: false, error: 'validation', message: 'Action is required.' }, 400);

  const { profile } = await resolveProfile(admin, req);
  if (!profile) return json({ ok: false, error: 'unauthorized', message: 'You must be signed in.' }, 401);

  const schoolId = safeText(body.school_id || profile.school_id);
  if (!schoolId || !hasSchoolAccess(profile, schoolId)) {
    return json({ ok: false, error: 'forbidden', message: 'You cannot access verification records for this school.' }, 403);
  }
  const actionLimit = ['verify', 'documents_incomplete'].includes(action) ? 60 : 120;
  if (!await rateAllowed(admin, `student-verification:${safeText(profile.id)}:${schoolId}:${action}`, actionLimit, 60)) {
    return json({ ok: false, error: 'rate_limited', message: 'Too many verification requests. Please wait a minute and try again.' }, 429);
  }

  try {
    if (action === 'search') {
      if (!hasPerm(profile, 'verify_students')) return json({ ok: false, error: 'forbidden', message: 'You do not have permission to verify students.' }, 403);
      return json(await searchCandidates(admin, schoolId, safeText(body.query)));
    }

    if (action === 'list_verified') {
      if (!hasPerm(profile, 'view_verified_students')) return json({ ok: false, error: 'forbidden', message: 'You do not have permission to view verified students.' }, 403);
      return json(await listVerified(admin, schoolId, body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters) ? body.filters as JsonRecord : body));
    }

    if (action === 'verify') {
      if (!hasPerm(profile, 'verify_students')) return json({ ok: false, error: 'forbidden', message: 'You do not have permission to verify students.' }, 403);
      const studentId = safeText(body.student_id);
      if (!studentId) return json({ ok: false, error: 'validation', message: 'student_id is required.' }, 400);
      const data = await runRpc(admin, 'verify_campus_student_backend', {
        p_student_id: studentId,
        p_actor_id: profile.id,
        p_notes: safeText(body.notes),
        p_user_agent: req.headers.get('user-agent') ?? '',
        p_ip_address: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? '',
      });
      return json(data);
    }

    if (action === 'documents_incomplete') {
      if (!hasPerm(profile, 'verify_students')) return json({ ok: false, error: 'forbidden', message: 'You do not have permission to update verification status.' }, 403);
      const studentId = safeText(body.student_id);
      if (!studentId) return json({ ok: false, error: 'validation', message: 'student_id is required.' }, 400);
      const data = await runRpc(admin, 'mark_student_documents_incomplete_backend', {
        p_student_id: studentId,
        p_actor_id: profile.id,
        p_notes: safeText(body.notes),
        p_user_agent: req.headers.get('user-agent') ?? '',
        p_ip_address: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? '',
      });
      return json(data);
    }

    if (action === 'update_notes') {
      if (!hasPerm(profile, 'edit_verification_notes')) return json({ ok: false, error: 'forbidden', message: 'You do not have permission to edit verification notes.' }, 403);
      const studentId = safeText(body.student_id);
      if (!studentId) return json({ ok: false, error: 'validation', message: 'student_id is required.' }, 400);
      const data = await runRpc(admin, 'update_student_verification_notes_backend', {
        p_student_id: studentId,
        p_actor_id: profile.id,
        p_notes: safeText(body.notes),
        p_user_agent: req.headers.get('user-agent') ?? '',
        p_ip_address: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? '',
      });
      return json(data);
    }

    if (action === 'reverse') {
      if (!canReverse(profile)) return json({ ok: false, error: 'forbidden', message: 'You do not have permission to reverse verification.' }, 403);
      const studentId = safeText(body.student_id);
      if (!studentId) return json({ ok: false, error: 'validation', message: 'student_id is required.' }, 400);
      const reason = safeText(body.reason);
      if (!reason) return json({ ok: false, error: 'validation', message: 'A reversal reason is required.' }, 400);
      const data = await runRpc(admin, 'reverse_student_verification_backend', {
        p_student_id: studentId,
        p_actor_id: profile.id,
        p_reason: reason,
        p_notes: safeText(body.notes),
        p_user_agent: req.headers.get('user-agent') ?? '',
        p_ip_address: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? '',
      });
      return json(data);
    }

    return json({ ok: false, error: 'validation', message: 'Unknown action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected verification service error.';
    return json({ ok: false, error: 'server', message }, 500);
  }
});
