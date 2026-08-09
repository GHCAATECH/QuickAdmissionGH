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

function programmeKey(value: unknown) {
  return text(value).toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function decodedPath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function storageObjectPath(value: unknown) {
  const source = text(value);
  if (!source) return "";
  const direct = source.match(/^enrolment-forms\/(.+)$/i);
  if (direct) return decodedPath(direct[1].split("?")[0]);
  const storageUrl = source.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/enrolment-forms\/(.+?)(?:\?|$)/i);
  if (storageUrl) return decodedPath(storageUrl[1]);
  if (/^(?:passport-photos\/)?[^?#]+\.(?:jpe?g|png)$/i.test(source)) return decodedPath(source.split("?")[0]);
  return "";
}

function firstStoragePath(...values: unknown[]) {
  for (const value of values) {
    const path = storageObjectPath(value);
    if (path) return path;
  }
  return "";
}

async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", { p_bucket_key: key, p_limit: limit, p_window_seconds: seconds });
  return !error && data?.allowed !== false;
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

function canManageStudents(profile: JsonRecord | null, schoolId: string) {
  if (!profile) return false;
  const role = text(profile.role);
  if (role === "super_admin") return true;
  if (role !== "school_admin" || text(profile.school_id) !== schoolId) return false;
  const permissions = profile.permissions;
  if (permissions == null) return true;
  if (typeof permissions !== "object" || Array.isArray(permissions)) return false;
  const values = permissions as JsonRecord;
  return values.co_admin === true || values.co_admin === "true";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  const action = text(body.action).toLowerCase();
  if (action === "signed_file_url") {
    const studentId = text(body.student_id);
    const fileType = text(body.file_type).toLowerCase();
    if (!studentId || !["enrolment", "passport"].includes(fileType)) {
      return json({ ok: false, error: "validation", message: "A valid student and file type are required." }, 400);
    }
    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id,school_id,enrolment_form_url,records")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (studentError) return json({ ok: false, error: "query_failed", message: studentError.message }, 500);
    if (!student) return json({ ok: false, error: "not_found", message: "Student record was not found." }, 404);
    const records = student.records && typeof student.records === "object" && !Array.isArray(student.records)
      ? student.records as JsonRecord
      : {};
    const path = fileType === "passport"
      ? firstStoragePath(records.passport_photo_path, records.passport_photo_url, records.photo_url)
      : firstStoragePath(records.enrolment_form_path, student.enrolment_form_url, records.enrolment_form_url);
    if (!path) return json({ ok: false, error: "not_found", message: "The uploaded file is not available." }, 404);
    const { data: signed, error: signError } = await admin.storage.from("enrolment-forms").createSignedUrl(path, 60 * 10);
    if (signError || !signed?.signedUrl) {
      return json({ ok: false, error: "sign_failed", message: signError?.message || "Could not create a secure file link." }, 500);
    }
    return json({ ok: true, url: signed.signedUrl, expires_in: 600, file_type: fileType });
  }

  if (action === "batch_update") {
    if (!canManageStudents(profile, schoolId)) {
      return json({ ok: false, error: "forbidden", message: "Only the school owner or a co-admin can allocate students." }, 403);
    }
    const rawIds = body.student_ids;
    const requestedPatch = body.patch;
    if (!Array.isArray(rawIds) || rawIds.length < 1 || rawIds.length > 5_000
      || rawIds.some((value) => !isUuid(text(value)))
      || !requestedPatch || typeof requestedPatch !== "object" || Array.isArray(requestedPatch)) {
      return json({ ok: false, error: "validation", message: "Supply between 1 and 5,000 valid student IDs and a valid allocation update." }, 400);
    }
    const studentIds = [...new Set(rawIds.map((value) => text(value)))];
    const patch = requestedPatch as JsonRecord;
    const update: JsonRecord = {};
    for (const key of ["class_id", "house_id"]) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      const value = text(patch[key]);
      if (value && !isUuid(value)) {
        return json({ ok: false, error: "validation", message: `Invalid ${key.replace("_id", "")}.` }, 400);
      }
      update[key] = value || null;
    }
    if (!Object.keys(update).length) {
      return json({ ok: false, error: "validation", message: "Only class and house allocations can be changed in bulk." }, 400);
    }

    const classId = text(update.class_id);
    const houseId = text(update.house_id);
    const [studentsResult, classResult, houseResult] = await Promise.all([
      admin.from("students").select("id,programme_id").eq("school_id", schoolId).in("id", studentIds),
      classId ? admin.from("classrooms").select("id,programme_id").eq("id", classId).eq("school_id", schoolId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      houseId ? admin.from("houses").select("id").eq("id", houseId).eq("school_id", schoolId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    const lookupError = studentsResult.error || classResult.error || houseResult.error;
    if (lookupError) return json({ ok: false, error: "query_failed", message: lookupError.message }, 500);
    if ((studentsResult.data ?? []).length !== studentIds.length) {
      return json({ ok: false, error: "not_found", message: "One or more students do not belong to this school." }, 404);
    }
    if (classId && !classResult.data) {
      return json({ ok: false, error: "validation", message: "The selected class does not belong to this school." }, 400);
    }
    if (houseId && !houseResult.data) {
      return json({ ok: false, error: "validation", message: "The selected house does not belong to this school." }, 400);
    }
    const classProgrammeId = text(classResult.data?.programme_id);
    if (classProgrammeId && (studentsResult.data ?? []).some((student) => text(student.programme_id) !== classProgrammeId)) {
      return json({ ok: false, error: "validation", message: "Every selected student must belong to the class programme." }, 400);
    }

    const { data: saved, error: saveError } = await admin
      .from("students")
      .update(update)
      .eq("school_id", schoolId)
      .in("id", studentIds)
      .select("id,class_id,house_id");
    if (saveError) return json({ ok: false, error: "save_failed", message: saveError.message }, 500);
    if ((saved ?? []).length !== studentIds.length) {
      return json({ ok: false, error: "save_incomplete", message: "Not every student allocation was updated." }, 409);
    }
    listCache.clear();
    return json({ ok: true, students: saved, updated: saved?.length ?? 0 });
  }

  if (action === "update") {
    if (!canManageStudents(profile, schoolId)) {
      return json({ ok: false, error: "forbidden", message: "Only the school owner or a co-admin can edit student records." }, 403);
    }
    const studentId = text(body.student_id);
    const requestedPatch = body.patch;
    if (!studentId || !isUuid(studentId) || !requestedPatch || typeof requestedPatch !== "object" || Array.isArray(requestedPatch)) {
      return json({ ok: false, error: "validation", message: "A valid student and update are required." }, 400);
    }
    const patch = requestedPatch as JsonRecord;
    const { data: current, error: currentError } = await admin
      .from("students")
      .select("id,school_id,full_name,gender,admission_no,permanent_admission_number,parent_phone,programme_id,class_id,house_id,records")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (currentError) return json({ ok: false, error: "query_failed", message: currentError.message }, 500);
    if (!current) return json({ ok: false, error: "not_found", message: "Student record was not found." }, 404);

    const update: JsonRecord = {};
    if (Object.prototype.hasOwnProperty.call(patch, "full_name")) {
      const fullName = text(patch.full_name).replace(/\s+/g, " ").slice(0, 160);
      if (!fullName) return json({ ok: false, error: "validation", message: "Student name is required." }, 400);
      update.full_name = fullName;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "gender")) {
      const gender = text(patch.gender).toUpperCase();
      if (!["M", "F"].includes(gender)) return json({ ok: false, error: "validation", message: "Select a valid gender." }, 400);
      update.gender = gender;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "parent_phone")) {
      const phone = text(patch.parent_phone).slice(0, 30);
      update.parent_phone = phone || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "admission_no")) {
      if (text(current.permanent_admission_number)) {
        return json({ ok: false, error: "locked", message: "The permanent admission number cannot be edited here." }, 409);
      }
      const admissionNo = text(patch.admission_no).slice(0, 80);
      update.admission_no = admissionNo || null;
    }

    for (const key of ["programme_id", "class_id", "house_id"]) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      const value = text(patch[key]);
      if (value && !isUuid(value)) return json({ ok: false, error: "validation", message: `Invalid ${key.replace("_id", "")}.` }, 400);
      update[key] = value || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "records")) {
      if (!patch.records || typeof patch.records !== "object" || Array.isArray(patch.records)) {
        return json({ ok: false, error: "validation", message: "Student records must be a valid object." }, 400);
      }
      const existingRecords = current.records && typeof current.records === "object" && !Array.isArray(current.records)
        ? current.records as JsonRecord
        : {};
      update.records = { ...existingRecords, ...(patch.records as JsonRecord) };
    }
    if (!Object.keys(update).length) return json({ ok: false, error: "validation", message: "No supported changes were supplied." }, 400);

    const programmeId = Object.prototype.hasOwnProperty.call(update, "programme_id") ? text(update.programme_id) : text(current.programme_id);
    const classId = Object.prototype.hasOwnProperty.call(update, "class_id") ? text(update.class_id) : text(current.class_id);
    const houseId = Object.prototype.hasOwnProperty.call(update, "house_id") ? text(update.house_id) : text(current.house_id);
    const [programmeResult, classResult, houseResult] = await Promise.all([
      programmeId ? admin.from("programmes").select("id").eq("id", programmeId).eq("school_id", schoolId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      classId ? admin.from("classrooms").select("id,programme_id").eq("id", classId).eq("school_id", schoolId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      houseId ? admin.from("houses").select("id").eq("id", houseId).eq("school_id", schoolId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    const relationError = programmeResult.error || classResult.error || houseResult.error;
    if (relationError) return json({ ok: false, error: "query_failed", message: relationError.message }, 500);
    if (programmeId && !programmeResult.data) return json({ ok: false, error: "validation", message: "The selected programme does not belong to this school." }, 400);
    if (classId && !classResult.data) return json({ ok: false, error: "validation", message: "The selected class does not belong to this school." }, 400);
    if (houseId && !houseResult.data) return json({ ok: false, error: "validation", message: "The selected house does not belong to this school." }, 400);
    if (classResult.data && programmeId && text(classResult.data.programme_id) !== programmeId) {
      return json({ ok: false, error: "validation", message: "The selected class is not linked to the selected programme." }, 400);
    }

    const { data: saved, error: saveError } = await admin
      .from("students")
      .update(update)
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .select("id,full_name,gender,admission_no,permanent_admission_number,parent_phone,programme_id,class_id,house_id,records")
      .maybeSingle();
    if (saveError) return json({ ok: false, error: "save_failed", message: saveError.message }, 500);
    if (!saved) return json({ ok: false, error: "not_found", message: "Student record was not found." }, 404);
    listCache.clear();
    return json({ ok: true, student: saved });
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
    .select("id,school_id,full_name,bece_index,admission_no,permanent_admission_number,gender,programme_id,class_id,house_id,status,verification_status,verified_at,verified_by,verification_notes,enrolment_form_url,parent_name,payment_status,submitted_at,created_at,personal_done,programme_done,undertaking_done,records", { count: "exact" })
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
  const classIds = [...new Set(rows.map((row) => text(row.class_id)).filter(Boolean))];
  const houseIds = [...new Set(rows.map((row) => text(row.house_id)).filter(Boolean))];
  const placementIndexes = [...new Set(rows.map((row) => text(row.bece_index)).filter(Boolean))];
  const [programmes, classes, houses, placements] = await Promise.all([
    rows.length ? admin.from("programmes").select("id,name,code").eq("school_id", schoolId).limit(5_000) : Promise.resolve({ data: [] }),
    classIds.length ? admin.from("classrooms").select("id,name,code").eq("school_id", schoolId).in("id", classIds) : Promise.resolve({ data: [] }),
    houseIds.length ? admin.from("houses").select("id,name").eq("school_id", schoolId).in("id", houseIds) : Promise.resolve({ data: [] }),
    placementIndexes.length ? admin.from("placement_list").select("index_number,gender,residential_status,programme").eq("school_id", schoolId).in("index_number", placementIndexes) : Promise.resolve({ data: [] }),
  ]);
  const programmeMap = mapById(programmes.data, ["name", "code"]);
  const classMap = mapById(classes.data, ["name", "code"]);
  const houseMap = mapById(houses.data, ["name"]);
  const programmesByKey = new Map<string, { id: string; name: string }>();
  for (const programme of programmes.data ?? []) {
    const record = programme as JsonRecord;
    const value = { id: text(record.id), name: text(record.name || record.code) };
    const nameKey = programmeKey(record.name);
    const codeKey = programmeKey(record.code);
    if (nameKey) programmesByKey.set(nameKey, value);
    if (codeKey) programmesByKey.set(codeKey, value);
  }
  const placementMap = new Map<string, { gender: string; residentialStatus: string; programme: string }>();
  for (const placement of placements.data ?? []) {
    const record = placement as JsonRecord;
    const indexNumber = text(record.index_number);
    if (indexNumber) placementMap.set(indexNumber, {
      gender: text(record.gender),
      residentialStatus: text(record.residential_status),
      programme: text(record.programme),
    });
  }

  const result = rows.map((row) => {
    const records = row.records && typeof row.records === "object" && !Array.isArray(row.records)
      ? row.records as JsonRecord
      : {};
    const placement = placementMap.get(text(row.bece_index));
    const resolvedProgramme = text(row.programme_id)
      ? { id: text(row.programme_id), name: programmeMap.get(text(row.programme_id)) ?? "" }
      : programmesByKey.get(programmeKey(placement?.programme));
    return {
      ...row,
      programme_id: resolvedProgramme?.id || null,
      gender: text(row.gender) || placement?.gender || "",
      residential_status: placement?.residentialStatus || text(records.residential_status || records.residential),
      placement_programme: placement?.programme || "",
      programme_name: resolvedProgramme?.name || placement?.programme || "",
      class_name: classMap.get(text(row.class_id)) ?? "",
      house_name: houseMap.get(text(row.house_id)) ?? "",
    };
  });
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
