import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function safeText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function upperText(value: unknown): string {
  return safeText(value).toUpperCase();
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = safeText(value);
    if (text) return text;
  }
  return "";
}

function programmeKey(value: unknown): string {
  return safeText(value).toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

type SchoolStructure = {
  programmes: unknown[];
  houses: unknown[];
  classes: unknown[];
  classCounts: Record<string, unknown>;
  houseCounts: Record<string, unknown>;
};

const structureCache = new Map<string, { expiresAt: number; value: SchoolStructure }>();

async function loadSchoolStructure(admin: ReturnType<typeof createClient>, schoolId: string): Promise<SchoolStructure> {
  const cached = structureCache.get(schoolId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const [programmesRes, housesRes, classesRes, classCountsRes, houseCountsRes] = await Promise.all([
    admin.from("programmes").select("id,code,name,subjects").eq("school_id", schoolId).order("code").limit(5_000),
    admin.from("houses").select("id,name,capacity,gender,residential_type,priority").eq("school_id", schoolId).order("priority", { ascending: true }).order("name").limit(5_000),
    admin.from("classrooms").select("id,name,programme_id,subjects,capacity").eq("school_id", schoolId).order("name").limit(5_000),
    admin.rpc("student_class_counts", { p_school: schoolId }),
    admin.rpc("house_occupancy_counts", { p_school_id: schoolId }),
  ]);
  const structureError = programmesRes.error || housesRes.error || classesRes.error;
  if (structureError) {
    throw new Error(`Could not load school programmes, classes, and houses: ${structureError.message}`);
  }
  const houseCounts: Record<string, unknown> = {};
  for (const row of houseCountsRes.data ?? []) {
    const record = row as Record<string, unknown>;
    const houseId = safeText(record.house_id);
    if (houseId) houseCounts[houseId] = Number(record.occupied ?? 0);
  }
  const value: SchoolStructure = {
    programmes: programmesRes.data ?? [],
    houses: housesRes.data ?? [],
    classes: classesRes.data ?? [],
    classCounts: (classCountsRes.data ?? {}) as Record<string, unknown>,
    houseCounts,
  };
  structureCache.set(schoolId, { expiresAt: Date.now() + 30_000, value });
  if (structureCache.size > 100) {
    const oldest = structureCache.keys().next().value;
    if (oldest) structureCache.delete(oldest);
  }
  return value;
}

async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", { p_bucket_key: key, p_limit: limit, p_window_seconds: seconds });
  return !!error || data?.allowed !== false;
}

function normalizeGender(studentGender: unknown, placementGender: unknown): string {
  const student = upperText(studentGender);
  const placement = upperText(placementGender);
  if (student === "M") return "MALE";
  if (student === "F") return "FEMALE";
  if (student) return student;
  if (placement === "M" || placement === "MALE") return "MALE";
  if (placement === "F" || placement === "FEMALE") return "FEMALE";
  return placement;
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { maxBodyBytes: 4_096 });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "not_configured", message: "Supabase service credentials are missing." }, 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const index = safeText(body.p_index ?? body.index);
  const token = upperText(body.p_token ?? body.token);
  const schoolId = safeText(body.p_school ?? body.school) || null;

  const forwarded = safeText(req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip"));
  const ip = (forwarded.split(",")[0] || "unknown").trim().slice(0, 80);
  const ipAllowed = await rateAllowed(admin, `student-login:ip:${ip}`, 120, 60);
  const attemptAllowed = await rateAllowed(admin, `student-login:attempt:${ip}:${schoolId || "all"}:${index.slice(0, 80)}`, 12, 60);
  if (!ipAllowed || !attemptAllowed) return json({ ok: false, error: "rate_limited", message: "Too many login attempts. Please wait a minute and try again." }, 429);

  if (!index) return json({ ok: false, error: "index" });
  if (!token) return json({ ok: false, error: "token" });

  let studentQuery = admin.from("students").select("id,school_id,bece_index,admission_token,full_name,gender,programme_id,class_id,house_id,records,parent_phone,submitted_at,admission_no,permanent_admission_number,payment_status,personal_done,programme_done,undertaking_done,enrolment_form_url").eq("bece_index", index);
  if (schoolId) studentQuery = studentQuery.eq("school_id", schoolId);
  const { data: studentRows, error: studentError } = await studentQuery.limit(100);

  if (studentError) {
    return json({ ok: false, error: "server", message: studentError.message }, 500);
  }

  const students = Array.isArray(studentRows) ? studentRows : [];
  if (!students.length) return json({ ok: false, error: "index" });
  if (students.length > 1) return json({ ok: false, error: "ambiguous" });

  const student = students[0] as Record<string, unknown>;
  if (upperText(student.admission_token) !== token) return json({ ok: false, error: "token" });

  const sid = safeText(student.school_id);
  if (!sid) return json({ ok: false, error: "index" });

  let loaded;
  try {
    loaded = await Promise.all([
      admin.from("schools").select("id,school_code,code,name,address,phone,helpdesk,crest_url,theme_color,headmaster_name,headmaster_title,email,status").eq("id", sid).maybeSingle(),
      admin.from("school_config").select("academic_year,admission_year,letter_template,records_template,admission_status,reopening_date,reopening_time,service_charge,accept_online_payment,announcement,helpdesk_line,prospectus_url,undertaking_url,subjects_url,req_doc_line1,req_doc_line2,req_doc_line3,req_doc_line4,req_doc_line5,show_personal_records,personal_records_caption,show_undertaking,undertaking_caption,show_programme_selection,programme_selection_caption,allow_passport_photo,allow_house_selection,allow_class_selection,force_enrolment_upload").eq("school_id", sid).maybeSingle(),
      admin
        .from("placement_list")
        .select("student_name,other_names,residential_status,sms_contact,aggregate,programme,gender,logged_in")
        .eq("school_id", sid)
        .eq("index_number", index)
        .maybeSingle(),
      student.programme_id
        ? admin.from("programmes").select("id,name").eq("id", String(student.programme_id)).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      student.class_id
        ? admin.from("classrooms").select("id,name").eq("id", String(student.class_id)).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      student.house_id
        ? admin.from("houses").select("id,name").eq("id", String(student.house_id)).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      loadSchoolStructure(admin, sid),
    ]);
  } catch (error) {
    return json({
      ok: false,
      error: "structure_unavailable",
      message: error instanceof Error ? error.message : "Could not load the school programme, class, and house setup.",
    }, 500);
  }

  const [
    schoolRes,
    configRes,
    placementRes,
    programmeRes,
    classRes,
    houseRes,
    structure,
  ] = loaded;

  const school = (schoolRes.data ?? {}) as Record<string, unknown>;
  const config = (configRes.data ?? {}) as Record<string, unknown>;
  const placement = (placementRes.data ?? {}) as Record<string, unknown>;
  const programme = (programmeRes.data ?? {}) as Record<string, unknown>;
  const classroom = (classRes.data ?? {}) as Record<string, unknown>;
  const house = (houseRes.data ?? {}) as Record<string, unknown>;

  if (safeText(school.status).toLowerCase() !== "active") {
    return json({ ok: false, error: "school_inactive", message: "This school portal is currently unavailable." }, 403);
  }

  const admissionStatus = upperText(config.admission_status);
  if (["CLOSED", "CLOSE", "INACTIVE", "FALSE", "NO", "0"].includes(admissionStatus) && !student.submitted_at) {
    return json({ ok: false, error: "closed", message: "Admission is closed for this school." }, 403);
  }

  if (placementRes.data) {
    await admin
      .from("placement_list")
      .update({ logged_in: true })
      .eq("school_id", sid)
      .eq("index_number", index);
  }

  const classCounts = structure.classCounts;
  const placementProgrammeKey = programmeKey(placement.programme);
  const resolvedProgramme = (structure.programmes as Array<Record<string, unknown>>).find((row) => {
    if (student.programme_id && safeText(row.id) === safeText(student.programme_id)) return true;
    if (!placementProgrammeKey) return false;
    return programmeKey(row.name) === placementProgrammeKey || programmeKey(row.code) === placementProgrammeKey;
  });
  const resolvedProgrammeId = safeText(resolvedProgramme?.id || student.programme_id) || null;
  const finalProgramme = firstText(resolvedProgramme?.name, programme.name, placement.programme);
  const finalGender = normalizeGender(student.gender, placement.gender);
  const displayName = firstText(
    placement.student_name,
    student.full_name,
  );
  const records =
    student.records && typeof student.records === "object" ? student.records : {};
  const contact = firstText(student.parent_phone, placement.sms_contact);

  const programmes = structure.programmes.map((row) => ({
    id: (row as Record<string, unknown>).id,
    code: safeText((row as Record<string, unknown>).code),
    name: safeText((row as Record<string, unknown>).name),
    subjects: safeText((row as Record<string, unknown>).subjects),
  }));

  const classes = structure.classes.map((row) => {
    const rec = row as Record<string, unknown>;
    const classId = safeText(rec.id);
    const capacity = Number(rec.capacity ?? 0);
    const taken = Number(classCounts[classId] ?? 0) || 0;
    return {
      id: rec.id,
      name: safeText(rec.name),
      programme_id: rec.programme_id ?? null,
      subjects: safeText(rec.subjects),
      seats: Math.max(capacity - taken, 0),
    };
  });
  const houses = structure.houses.map((row) => {
    const rec = row as Record<string, unknown>;
    const houseId = safeText(rec.id);
    const capacity = Number(rec.capacity ?? 0);
    const occupied = Number(structure.houseCounts[houseId] ?? 0) || 0;
    return {
      id: rec.id,
      name: safeText(rec.name),
      capacity: rec.capacity ?? null,
      seats: Math.max(capacity - occupied, 0),
      gender: safeText(rec.gender),
      residential_type: safeText(rec.residential_type),
      priority: rec.priority ?? null,
    };
  });

  return json({
    ok: true,
    student: {
      index,
      full_name: displayName,
      surname: displayName,
      other_names: firstText(placement.other_names, (records as Record<string, unknown>).other_names),
      student_name: firstText(placement.student_name, displayName),
      placement_name: firstText(placement.student_name, displayName),
      school_no: firstText(student.admission_no),
      admission_no: firstText(student.admission_no),
      aggregate: placement.aggregate ?? null,
      programme: finalProgramme,
      programme_id: resolvedProgrammeId,
      class: firstText(classroom.name),
      class_id: student.class_id ?? null,
      house: firstText(house.name),
      house_id: student.house_id ?? null,
      gender: finalGender,
      residential: firstText(placement.residential_status),
      contact,
      sms_contact: firstText(placement.sms_contact, student.parent_phone),
      placement_sms_contact: firstText(placement.sms_contact),
      personal_done: !!student.personal_done,
      programme_done: !!student.programme_done,
      undertaking_done: !!student.undertaking_done,
      documents_done: !!student.documents_done,
      submitted: !!student.submitted_at,
      records,
    },
    school: {
      id: sid,
      code: firstText(school.school_code, school.code),
      school_code: firstText(school.school_code, school.code),
      name: firstText(school.name),
      address: firstText(school.address),
      phone: firstText(school.phone),
      helpdesk: firstText(school.helpdesk, school.phone),
      crest_url: firstText(school.crest_url),
      theme_color: firstText(school.theme_color),
      headmaster_name: firstText(school.headmaster_name),
      headmaster_title: firstText(school.headmaster_title, "Head of School"),
      email: firstText(school.email),
    },
    config,
    programmes,
    houses,
    classes,
  });
});
