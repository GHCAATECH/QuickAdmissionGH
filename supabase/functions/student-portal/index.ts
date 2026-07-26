import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type JsonRecord = Record<string, unknown>;

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

function pickRecord(source: JsonRecord, keys: string[]) {
  const output: JsonRecord = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) output[key] = source[key];
  }
  return output;
}

async function resolveSchool(admin: ReturnType<typeof createClient>, index: string, schoolId: string) {
  if (schoolId) {
    const [placementRes, studentRes] = await Promise.all([
      admin.from("placement_list").select("school_id").eq("school_id", schoolId).eq("index_number", index).maybeSingle(),
      admin.from("students").select("id").eq("school_id", schoolId).eq("bece_index", index).maybeSingle(),
    ]);
    if (placementRes.data || studentRes.data) return schoolId;
    return "";
  }
  const { data } = await admin.rpc("school_of_index", { p_index: index });
  return safeText(data);
}

async function lookupSchool(admin: ReturnType<typeof createClient>, index: string, schoolId: string) {
  const sid = await resolveSchool(admin, index, schoolId);
  if (!sid) return { ok: false, error: "not_found", message: "Index not on any participating school's placement list." };

  const [schoolRes, configRes, placementRes, studentRes] = await Promise.all([
    admin.from("schools").select("id,name,school_code").eq("id", sid).maybeSingle(),
    admin.from("school_config").select("service_charge").eq("school_id", sid).maybeSingle(),
    admin.from("placement_list").select("student_name,sms_contact,index_number").eq("school_id", sid).eq("index_number", index).maybeSingle(),
    admin.from("students").select("full_name,parent_phone,bece_index").eq("school_id", sid).eq("bece_index", index).maybeSingle(),
  ]);

  const school = (schoolRes.data ?? {}) as JsonRecord;
  const config = (configRes.data ?? {}) as JsonRecord;
  const placement = (placementRes.data ?? {}) as JsonRecord;
  const student = (studentRes.data ?? {}) as JsonRecord;

  return {
    ok: true,
    school_id: sid,
    id: sid,
    name: firstText(school.name),
    school_code: firstText(school.school_code),
    charge: Number(config.service_charge ?? 0),
    student_name: firstText(placement.student_name, student.full_name),
    placement_name: firstText(placement.student_name, student.full_name),
    sms_contact: firstText(placement.sms_contact, student.parent_phone),
  };
}

async function hasToken(admin: ReturnType<typeof createClient>, index: string, schoolId: string) {
  const sid = await resolveSchool(admin, index, schoolId);
  if (!sid) return { ok: true, paid: false, token: null, school_id: null };

  const { data } = await admin
    .from("students")
    .select("admission_token,payment_status")
    .eq("school_id", sid)
    .eq("bece_index", index)
    .maybeSingle();

  const token = safeText((data as JsonRecord | null)?.admission_token);
  const status = upperText((data as JsonRecord | null)?.payment_status);
  return {
    ok: true,
    paid: !!token || status === "PAID" || status === "COMPLETED" || status === "SUCCESS",
    token: token || null,
    school_id: sid,
  };
}

async function retrieveToken(admin: ReturnType<typeof createClient>, by: string, value: string, schoolId: string) {
  if (by === "receipt") {
    const { data: payment } = await admin
      .from("payments")
      .select("reference,student_id,school_id,status")
      .eq("school_id", schoolId)
      .eq("reference", value)
      .maybeSingle();

    const paymentRec = (payment ?? {}) as JsonRecord;
    const studentId = safeText(paymentRec.student_id);
    if (!studentId) return { ok: false, error: "No token found" };

    const { data: student } = await admin
      .from("students")
      .select("bece_index,admission_token")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    const studentRec = (student ?? {}) as JsonRecord;
    const token = safeText(studentRec.admission_token);
    const index = safeText(studentRec.bece_index);
    if (!token || !index) return { ok: false, error: "No token found" };
    return { ok: true, token, index, school_id: schoolId };
  }

  const { data: student } = await admin
    .from("students")
    .select("bece_index,admission_token")
    .eq("school_id", schoolId)
    .eq("bece_index", value)
    .maybeSingle();

  const studentRec = (student ?? {}) as JsonRecord;
  const token = safeText(studentRec.admission_token);
  const index = safeText(studentRec.bece_index);
  if (!token || !index) return { ok: false, error: "No token found" };
  return { ok: true, token, index, school_id: schoolId };
}

async function submitApplication(
  admin: ReturnType<typeof createClient>,
  index: string,
  token: string,
  schoolId: string,
  payload: JsonRecord,
) {
  const { data, error } = await admin.rpc("submit_application", {
    p_index: index,
    p_token: token,
    p_school: schoolId || null,
    payload,
  });

  if (error) throw new Error(error.message || "Could not submit application.");
  if (data && typeof data === "object") return data;
  return { ok: false, error: "server", message: "Unexpected submission response." };
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

async function studentFileUrl(
  admin: ReturnType<typeof createClient>,
  index: string,
  token: string,
  schoolId: string,
  pathInput: string,
) {
  const path = storageObjectPath(pathInput);
  if (!path) return { ok: false, error: "path", message: "File path is required." };
  let query = admin
    .from("students")
    .select("id, school_id, bece_index, admission_token, enrolment_form_url, records")
    .eq("bece_index", index);
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message || "Could not verify file access.");
  const matches = (rows ?? []).filter((row) => upperText((row as JsonRecord).admission_token) === upperText(token));
  if (!matches.length) return { ok: false, error: "token", message: "Admission token is invalid." };
  if (matches.length > 1 && !schoolId) return { ok: false, error: "ambiguous", message: "Select your school first." };
  const student = (matches[0] ?? {}) as JsonRecord;
  const records = student.records && typeof student.records === "object" ? student.records as JsonRecord : {};
  const allowed = new Set([
    storageObjectPath(student.enrolment_form_url),
    storageObjectPath(records.enrolment_form_url),
    storageObjectPath(records.enrolment_form_path),
    storageObjectPath(records.passport_photo_url),
    storageObjectPath(records.passport_photo_path),
  ].filter(Boolean));
  if (!allowed.has(path)) return { ok: false, error: "forbidden", message: "You cannot open this file." };
  const { data, error: signError } = await admin.storage.from("enrolment-forms").createSignedUrl(path, 60 * 10);
  if (signError || !data?.signedUrl) {
    return { ok: false, error: "sign_failed", message: signError?.message || "Could not create file link." };
  }
  return { ok: true, url: data.signedUrl, expires_in: 600 };
}

async function listDirectory(admin: ReturnType<typeof createClient>) {
  const schoolsRes = await admin
    .from("schools")
    .select("id,name,school_code,code")
    .order("name", { ascending: true });

  if (schoolsRes.error) throw new Error(schoolsRes.error.message || "Could not load schools.");

  const configsRes = await admin
    .from("school_config")
    .select("school_id,admission_status,academic_year,service_charge,helpdesk_line,allow_passport_photo,allow_house_selection,allow_class_selection,force_enrolment_upload");

  const configs = configsRes.error ? [] : (configsRes.data ?? []);

  const configBySchool = new Map<string, JsonRecord>();
  for (const row of configs) {
    const record = row as JsonRecord;
    const schoolId = safeText(record.school_id);
    if (!schoolId) continue;
    configBySchool.set(schoolId, pickRecord(record, [
      "school_id",
      "admission_status",
      "academic_year",
      "service_charge",
      "helpdesk_line",
      "allow_passport_photo",
      "allow_house_selection",
      "allow_class_selection",
      "force_enrolment_upload",
    ]));
  }

  const schools = (schoolsRes.data ?? []).map((row) => {
    const school = row as JsonRecord;
    const schoolId = safeText(school.id);
    const config = configBySchool.get(schoolId) ?? {};
    return {
      id: schoolId,
      school_id: schoolId,
      name: firstText(school.name),
      school_name: firstText(school.name),
      school_code: firstText(school.school_code, school.code),
      code: firstText(school.code, school.school_code),
      phone: firstText(school.phone),
      email: firstText(school.email),
      helpdesk: firstText(school.helpdesk, config.helpdesk_line),
      helpdesk_line: firstText(config.helpdesk_line, school.helpdesk),
      crest_url: firstText(school.crest_url),
      admission_status: firstText(config.admission_status),
      academic_year: firstText(config.academic_year),
      service_charge: Number(config.service_charge ?? 0),
      allow_passport_photo: Boolean(config.allow_passport_photo ?? false),
      allow_house_selection: Boolean(config.allow_house_selection ?? false),
      allow_class_selection: Boolean(config.allow_class_selection ?? true),
      force_enrolment_upload: Boolean(config.force_enrolment_upload ?? true),
    };
  });

  return { ok: true, schools };
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { maxBodyBytes: 65_536 });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "not_configured", message: "Supabase service credentials are missing." }, 500);
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

  const action = safeText(body.action || body.mode).toLowerCase();
  const index = safeText(body.p_index ?? body.index);
  const schoolId = safeText(body.p_school ?? body.school);

  if (!action) return json({ ok: false, error: "action", message: "Action is required." }, 400);

  try {
    if (action === "lookup") {
      if (!index) return json({ ok: false, error: "index", message: "Index number is required." }, 400);
      return json(await lookupSchool(admin, index, schoolId));
    }

    if (action === "has_token") {
      if (!index) return json({ ok: false, error: "index", message: "Index number is required." }, 400);
      return json(await hasToken(admin, index, schoolId));
    }

    if (action === "retrieve") {
      const by = safeText(body.p_by ?? body.by).toLowerCase();
      const value = safeText(body.p_value ?? body.value);
      if (!schoolId) return json({ ok: false, error: "school", message: "School is required." }, 400);
      if (by !== "index" && by !== "receipt") return json({ ok: false, error: "by", message: "Search type is invalid." }, 400);
      if (!value) return json({ ok: false, error: "value", message: "Search value is required." }, 400);
      return json(await retrieveToken(admin, by, value, schoolId));
    }

    if (action === "directory") {
      return json(await listDirectory(admin));
    }

    if (action === "submit") {
      const token = safeText(body.p_token ?? body.token);
      const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? body.payload as JsonRecord
        : {};
      if (!index) return json({ ok: false, error: "index", message: "Index number is required." }, 400);
      if (!token) return json({ ok: false, error: "token", message: "Admission token is required." }, 400);
      return json(await submitApplication(admin, index, token, schoolId, payload));
    }

    if (action === "file_url") {
      const token = safeText(body.p_token ?? body.token);
      const path = safeText(body.path ?? body.file_path ?? body.url);
      if (!index) return json({ ok: false, error: "index", message: "Index number is required." }, 400);
      if (!token) return json({ ok: false, error: "token", message: "Admission token is required." }, 400);
      return json(await studentFileUrl(admin, index, token, schoolId, path));
    }

    return json({ ok: false, error: "action", message: "Unknown action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected portal service error.";
    return json({ ok: false, error: "server", message }, 500);
  }
});
