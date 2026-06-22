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

  if (!index) return json({ ok: false, error: "index" });
  if (!token) return json({ ok: false, error: "token" });

  let studentQuery = admin.from("students").select("*").eq("bece_index", index);
  if (schoolId) studentQuery = studentQuery.eq("school_id", schoolId);
  const { data: studentRows, error: studentError } = await studentQuery;

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

  const [
    schoolRes,
    configRes,
    placementRes,
    programmeRes,
    classRes,
    houseRes,
    programmesRes,
    classesRes,
    classStudentsRes,
  ] = await Promise.all([
    admin.from("schools").select("*").eq("id", sid).maybeSingle(),
    admin.from("school_config").select("*").eq("school_id", sid).maybeSingle(),
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
    admin.from("programmes").select("id,code,name,subjects").eq("school_id", sid).order("code"),
    admin.from("classrooms").select("id,name,programme_id,subjects,capacity").eq("school_id", sid).order("name"),
    admin.from("students").select("class_id").eq("school_id", sid),
  ]);

  const school = (schoolRes.data ?? {}) as Record<string, unknown>;
  const config = (configRes.data ?? {}) as Record<string, unknown>;
  const placement = (placementRes.data ?? {}) as Record<string, unknown>;
  const programme = (programmeRes.data ?? {}) as Record<string, unknown>;
  const classroom = (classRes.data ?? {}) as Record<string, unknown>;
  const house = (houseRes.data ?? {}) as Record<string, unknown>;

  if (placementRes.data) {
    await admin
      .from("placement_list")
      .update({ logged_in: true })
      .eq("school_id", sid)
      .eq("index_number", index);
  }

  const classCounts = new Map<string, number>();
  for (const row of classStudentsRes.data ?? []) {
    const classId = safeText((row as Record<string, unknown>).class_id);
    if (!classId) continue;
    classCounts.set(classId, (classCounts.get(classId) ?? 0) + 1);
  }

  const finalProgramme = firstText(programme.name, placement.programme);
  const finalGender = normalizeGender(student.gender, placement.gender);
  const displayName = firstText(
    placement.student_name,
    student.full_name,
    student.surname,
  );
  const records =
    student.records && typeof student.records === "object" ? student.records : {};
  const contact = firstText(student.parent_phone, placement.sms_contact);

  const programmes = (programmesRes.data ?? []).map((row) => ({
    id: (row as Record<string, unknown>).id,
    code: safeText((row as Record<string, unknown>).code),
    name: safeText((row as Record<string, unknown>).name),
    subjects: safeText((row as Record<string, unknown>).subjects),
  }));

  const classes = (classesRes.data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    const classId = safeText(rec.id);
    const capacity = Number(rec.capacity ?? 0);
    const taken = classCounts.get(classId) ?? 0;
    return {
      id: rec.id,
      name: safeText(rec.name),
      programme_id: rec.programme_id ?? null,
      subjects: safeText(rec.subjects),
      seats: Math.max(capacity - taken, 0),
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
      programme_id: student.programme_id ?? null,
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
      email: firstText(school.email),
    },
    config,
    programmes,
    classes,
  });
});
