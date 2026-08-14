import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY") ?? "";
const ARKESEL_SMS_URL = Deno.env.get("ARKESEL_SMS_URL") ?? "https://sms.arkesel.com/api/v2/sms/send";
const TOKEN_RETRIEVAL_OTP_SECRET = Deno.env.get("TOKEN_RETRIEVAL_OTP_SECRET") || SUPABASE_SERVICE_ROLE_KEY;
const TOKEN_RETRIEVAL_OTP_TTL_SECONDS = 5 * 60;

type JsonRecord = Record<string, unknown>;

let directoryCache: { expiresAt: number; value: unknown } | null = null;
const lookupCache = new Map<string, { expiresAt: number; value: unknown }>();
const schoolResolutionCache = new Map<string, { expiresAt: number; value: string }>();

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

function normalizePhone(value: unknown): string {
  const digits = safeText(value).replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return "";
}

function normalizeSenderId(value: unknown): string {
  return upperText(value)
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 11);
}

function createOtp(): string {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(100000 + (random[0] % 900000));
}

async function hashOtp(challengeId: string, schoolId: string, index: string, otp: string): Promise<string> {
  const value = `${TOKEN_RETRIEVAL_OTP_SECRET}|${challengeId}|${schoolId}|${upperText(index)}|${otp}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sendOtpSms(sender: string, phone: string, message: string) {
  const response = await fetch(ARKESEL_SMS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": ARKESEL_API_KEY },
    body: JSON.stringify({ sender, message, recipients: [phone] }),
  });
  const rawText = await response.text();
  let payload: unknown = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = { raw: rawText.slice(0, 1_000) };
  }
  return { ok: response.ok, status: response.status, payload };
}

function otpSmsAccepted(delivery: { ok: boolean; payload: unknown }): boolean {
  if (!delivery.ok) return false;
  if (!delivery.payload || typeof delivery.payload !== "object") return true;
  const status = safeText((delivery.payload as JsonRecord).status).toLowerCase();
  return !["failed", "failure", "error"].includes(status);
}

function pickRecord(source: JsonRecord, keys: string[]) {
  const output: JsonRecord = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) output[key] = source[key];
  }
  return output;
}
async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", { p_bucket_key: key, p_limit: limit, p_window_seconds: seconds });
  return !error && data?.allowed !== false;
}

async function resolveSchool(admin: ReturnType<typeof createClient>, index: string, schoolId: string) {
  const cacheKey = `${schoolId || "all"}:${index}`;
  const cached = schoolResolutionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (schoolId) {
    const [placementRes, studentRes] = await Promise.all([
      admin.from("placement_list").select("school_id").eq("school_id", schoolId).eq("index_number", index).maybeSingle(),
      admin.from("students").select("id").eq("school_id", schoolId).eq("bece_index", index).maybeSingle(),
    ]);
    const result = placementRes.data || studentRes.data ? schoolId : "";
    schoolResolutionCache.set(cacheKey, { expiresAt: Date.now() + 15_000, value: result });
    return result;
  }
  const { data } = await admin.rpc("school_of_index", { p_index: index });
  const result = safeText(data);
  schoolResolutionCache.set(cacheKey, { expiresAt: Date.now() + 15_000, value: result });
  if (schoolResolutionCache.size > 2_000) {
    const oldest = schoolResolutionCache.keys().next().value;
    if (oldest) schoolResolutionCache.delete(oldest);
  }
  return result;
}

async function lookupSchool(admin: ReturnType<typeof createClient>, index: string, schoolId: string) {
  const cacheKey = `${schoolId || "all"}:${index}`;
  const cached = lookupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const sid = await resolveSchool(admin, index, schoolId);
  if (!sid) {
    const result = { ok: false, error: "not_found", message: "Index not on any participating school's placement list." };
    lookupCache.set(cacheKey, { expiresAt: Date.now() + 15_000, value: result });
    return result;
  }

  const [schoolRes, configRes] = await Promise.all([
    admin.from("schools").select("id,name,school_code,status").eq("id", sid).maybeSingle(),
    admin.from("school_config").select("service_charge,accept_online_payment,admission_status").eq("school_id", sid).maybeSingle(),
  ]);

  const school = (schoolRes.data ?? {}) as JsonRecord;
  const config = (configRes.data ?? {}) as JsonRecord;

  if (safeText(school.status).toLowerCase() !== "active") {
    const result = { ok: false, error: "school_inactive", message: "This school portal is currently unavailable." };
    lookupCache.set(cacheKey, { expiresAt: Date.now() + 15_000, value: result });
    return result;
  }

  const result = {
    ok: true,
    school_id: sid,
    id: sid,
    name: firstText(school.name),
    school_code: firstText(school.school_code),
    charge: Number(config.service_charge ?? 0),
    accept_online_payment: config.accept_online_payment !== false,
    admission_status: firstText(config.admission_status),
  };
  lookupCache.set(cacheKey, { expiresAt: Date.now() + 30_000, value: result });
  if (lookupCache.size > 1_000) {
    const oldest = lookupCache.keys().next().value;
    if (oldest) lookupCache.delete(oldest);
  }
  return result;
}

async function hasToken(admin: ReturnType<typeof createClient>, index: string, schoolId: string, parentContact: string) {
  const sid = await resolveSchool(admin, index, schoolId);
  if (!sid) return { ok: true, paid: false, school_id: null };

  const [studentResult, placementResult] = await Promise.all([
    admin
      .from("students")
      .select("admission_token,payment_status,parent_phone")
      .eq("school_id", sid)
      .eq("bece_index", index)
      .maybeSingle(),
    admin
      .from("placement_list")
      .select("sms_contact")
      .eq("school_id", sid)
      .eq("index_number", index)
      .maybeSingle(),
  ]);

  const student = (studentResult.data ?? {}) as JsonRecord;
  const token = safeText(student.admission_token);
  const status = upperText(student.payment_status);
  const paid = !!token || status === "PAID" || status === "COMPLETED" || status === "SUCCESS";
  const submittedPhone = normalizePhone(parentContact);
  const storedPhone = normalizePhone(firstText(student.parent_phone, placementResult.data?.sms_contact));
  return {
    ok: true,
    paid: paid && !!submittedPhone && !!storedPhone && submittedPhone === storedPhone,
    school_id: sid,
  };
}

async function schoolStatus(admin: ReturnType<typeof createClient>, schoolId: string) {
  if (!schoolId) return { ok: false, error: "school", message: "School is required." };
  const [schoolResult, configResult] = await Promise.all([
    admin.from("schools").select("status").eq("id", schoolId).maybeSingle(),
    admin.from("school_config").select("admission_status,service_charge,accept_online_payment,announcement").eq("school_id", schoolId).maybeSingle(),
  ]);
  if (schoolResult.error || configResult.error) {
    throw new Error(schoolResult.error?.message || configResult.error?.message || "Could not load school status.");
  }
  const school = (schoolResult.data ?? {}) as JsonRecord;
  const config = (configResult.data ?? {}) as JsonRecord;
  const active = safeText(school.status).toLowerCase() === "active";
  return {
    ok: true,
    school_id: schoolId,
    school_status: firstText(school.status),
    admission_status: active ? firstText(config.admission_status) : "CLOSED",
    service_charge: Number(config.service_charge ?? 0),
    accept_online_payment: config.accept_online_payment !== false,
    announcement: firstText(config.announcement),
  };
}

async function resolveTokenRetrieval(admin: ReturnType<typeof createClient>, by: string, value: string, schoolId: string) {
  let paymentPhone = "";
  let studentId = "";

  if (by === "receipt") {
    const { data: payment } = await admin
      .from("payments")
      .select("reference,student_id,school_id,status,phone")
      .eq("school_id", schoolId)
      .eq("reference", value)
      .maybeSingle();

    const paymentRec = (payment ?? {}) as JsonRecord;
    studentId = safeText(paymentRec.student_id);
    paymentPhone = safeText(paymentRec.phone);
    if (!studentId) return null;
  }

  let studentQuery = admin
    .from("students")
    .select("id,bece_index,admission_token,parent_phone,full_name")
    .eq("school_id", schoolId);
  studentQuery = by === "receipt" ? studentQuery.eq("id", studentId) : studentQuery.eq("bece_index", value);
  const { data: student } = await studentQuery.maybeSingle();

  const studentRec = (student ?? {}) as JsonRecord;
  const token = safeText(studentRec.admission_token);
  const index = safeText(studentRec.bece_index);
  studentId = safeText(studentRec.id);
  if (!studentId || !token || !index) return null;

  const { data: placement } = await admin
    .from("placement_list")
    .select("sms_contact")
    .eq("school_id", schoolId)
    .eq("index_number", index)
    .maybeSingle();

  const phone = [studentRec.parent_phone, paymentPhone, placement?.sms_contact]
    .map(normalizePhone)
    .find(Boolean) ?? "";
  return {
    studentId,
    index,
    token,
    phone,
    studentName: firstText(studentRec.full_name),
  };
}

async function requestTokenRetrievalOtp(
  admin: ReturnType<typeof createClient>,
  by: string,
  value: string,
  schoolId: string,
) {
  if (!ARKESEL_API_KEY) {
    return { status: 503, body: { ok: false, error: "sms_not_configured", message: "SMS verification is temporarily unavailable. Contact the school helpdesk." } };
  }

  const target = await resolveTokenRetrieval(admin, by, value, schoolId);
  if (!target) {
    return { status: 404, body: { ok: false, error: "not_found", message: "No paid admission token was found for those details." } };
  }
  if (!target.phone) {
    return { status: 409, body: { ok: false, error: "parent_contact_missing", message: "No valid Parent Contact is saved for this student. Contact the school helpdesk." } };
  }

  const { data: school } = await admin
    .from("schools")
    .select("name,school_code,code")
    .eq("id", schoolId)
    .maybeSingle();
  const schoolRec = (school ?? {}) as JsonRecord;
  const sender = normalizeSenderId(firstText(schoolRec.school_code, schoolRec.code, "QADMISSION"));
  if (!sender) {
    return { status: 409, body: { ok: false, error: "sender_missing", message: "This school's SMS Sender ID is not configured." } };
  }

  const now = new Date();
  const challengeId = crypto.randomUUID();
  const otp = createOtp();
  const codeHash = await hashOtp(challengeId, schoolId, target.index, otp);
  const expiresAt = new Date(now.getTime() + TOKEN_RETRIEVAL_OTP_TTL_SECONDS * 1_000).toISOString();

  await admin
    .from("token_retrieval_otps")
    .update({ consumed_at: now.toISOString() })
    .eq("school_id", schoolId)
    .eq("index_number", target.index)
    .is("consumed_at", null);

  const { error: insertError } = await admin.from("token_retrieval_otps").insert({
    id: challengeId,
    school_id: schoolId,
    student_id: target.studentId,
    index_number: target.index,
    code_hash: codeHash,
    phone_last_two: target.phone.slice(-2),
    expires_at: expiresAt,
  });
  if (insertError) throw new Error(`Could not create verification code: ${insertError.message}`);

  const schoolName = firstText(schoolRec.name, "your school");
  const smsMessage = `${otp} is your ${schoolName} token retrieval verification code. It expires in 5 minutes. Do not share it.`;
  let delivery: { ok: boolean; status: number; payload: unknown };
  try {
    delivery = await sendOtpSms(sender, target.phone, smsMessage);
  } catch (error) {
    delivery = { ok: false, status: 0, payload: { error: error instanceof Error ? error.message : "SMS request failed" } };
  }
  const delivered = otpSmsAccepted(delivery);

  const log = {
    school_id: schoolId,
    student_id: target.studentId,
    recipient_group: "token-retrieval-otp",
    recipients: 1,
    phone: target.phone,
    sender_id: sender,
    message: "One-time token retrieval verification code",
    status: delivered ? "sent" : "failed",
    sent_by: "student-portal",
    template_name: "token-retrieval-otp",
    api_response: { http_status: delivery.status, accepted: delivered },
    external_id: upperText(target.index),
  };
  await admin.from("sms_logs").insert(log);

  if (!delivered) {
    await admin.from("token_retrieval_otps").update({ consumed_at: new Date().toISOString() }).eq("id", challengeId);
    return { status: 502, body: { ok: false, error: "sms_failed", message: "The verification SMS could not be sent. Please try again shortly." } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      challenge_id: challengeId,
      index: target.index,
      school_id: schoolId,
      phone_last_two: target.phone.slice(-2),
      expires_in: TOKEN_RETRIEVAL_OTP_TTL_SECONDS,
    },
  };
}

async function verifyTokenRetrievalOtp(
  admin: ReturnType<typeof createClient>,
  challengeId: string,
  otp: string,
  index: string,
  schoolId: string,
) {
  const { data: challenge } = await admin
    .from("token_retrieval_otps")
    .select("id,student_id,index_number,code_hash,attempts,expires_at,consumed_at")
    .eq("id", challengeId)
    .eq("school_id", schoolId)
    .eq("index_number", index)
    .maybeSingle();
  const record = (challenge ?? {}) as JsonRecord;
  if (!record.id) return { status: 400, body: { ok: false, error: "invalid_challenge", message: "This verification request is invalid. Request a new code." } };
  if (record.consumed_at) return { status: 409, body: { ok: false, error: "otp_used", message: "This verification code has already been used. Request a new code." } };
  if (new Date(safeText(record.expires_at)).getTime() <= Date.now()) {
    return { status: 410, body: { ok: false, error: "otp_expired", message: "This verification code has expired. Request a new code." } };
  }

  const attempts = Number(record.attempts ?? 0);
  if (attempts >= 5) return { status: 429, body: { ok: false, error: "otp_locked", message: "Too many incorrect attempts. Request a new code." } };
  const submittedHash = await hashOtp(challengeId, schoolId, index, otp);
  if (submittedHash !== safeText(record.code_hash)) {
    const nextAttempts = Math.min(attempts + 1, 5);
    await admin.from("token_retrieval_otps").update({ attempts: nextAttempts }).eq("id", challengeId).eq("attempts", attempts);
    return {
      status: 400,
      body: {
        ok: false,
        error: "otp_invalid",
        message: nextAttempts >= 5 ? "Too many incorrect attempts. Request a new code." : `The verification code is incorrect. ${5 - nextAttempts} attempt(s) remaining.`,
      },
    };
  }

  const now = new Date().toISOString();
  const { data: claimed } = await admin
    .from("token_retrieval_otps")
    .update({ consumed_at: now })
    .eq("id", challengeId)
    .eq("school_id", schoolId)
    .eq("index_number", index)
    .eq("code_hash", submittedHash)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .lt("attempts", 5)
    .select("student_id,index_number")
    .maybeSingle();
  if (!claimed) return { status: 409, body: { ok: false, error: "otp_used", message: "This verification code is no longer valid. Request a new code." } };

  const { data: student } = await admin
    .from("students")
    .select("bece_index,admission_token")
    .eq("id", claimed.student_id)
    .eq("school_id", schoolId)
    .eq("bece_index", index)
    .maybeSingle();
  const token = safeText(student?.admission_token);
  if (!token) return { status: 404, body: { ok: false, error: "not_found", message: "The admission token is no longer available." } };
  return { status: 200, body: { ok: true, token, index, school_id: schoolId } };
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
  const { data: rows, error } = await query.limit(100);
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
  if (directoryCache && directoryCache.expiresAt > Date.now()) return directoryCache.value;
  const schoolsRes = await admin
    .from("schools")
    .select("id,name,school_code,code,subdomain,phone,email,helpdesk,crest_url")
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(10_000);

  if (schoolsRes.error) throw new Error(schoolsRes.error.message || "Could not load schools.");

  const configsRes = await admin
    .from("school_config")
    .select("school_id,admission_status,academic_year,service_charge,accept_online_payment,announcement,helpdesk_line,allow_passport_photo,allow_house_selection,allow_class_selection,force_enrolment_upload")
    .limit(10_000);

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
      "accept_online_payment",
      "announcement",
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
      subdomain: firstText(school.subdomain),
      phone: firstText(school.phone),
      email: firstText(school.email),
      helpdesk: firstText(school.helpdesk, config.helpdesk_line),
      helpdesk_line: firstText(config.helpdesk_line, school.helpdesk),
      crest_url: firstText(school.crest_url),
      admission_status: firstText(config.admission_status),
      academic_year: firstText(config.academic_year),
      service_charge: Number(config.service_charge ?? 0),
      accept_online_payment: config.accept_online_payment !== false,
      announcement: firstText(config.announcement),
      allow_passport_photo: Boolean(config.allow_passport_photo ?? false),
      allow_house_selection: Boolean(config.allow_house_selection ?? false),
      allow_class_selection: Boolean(config.allow_class_selection ?? true),
      force_enrolment_upload: Boolean(config.force_enrolment_upload ?? true),
    };
  });

  const result = { ok: true, schools };
  directoryCache = { expiresAt: Date.now() + 30_000, value: result };
  return result;
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

  if (["lookup", "has_token", "retrieve", "retrieve_verify", "file_url", "school_status"].includes(action)) {
    const forwarded = safeText(req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip"));
    const ip = (forwarded.split(",")[0] || "unknown").trim().slice(0, 80);
    const value = safeText(body.p_value ?? body.value ?? body.path ?? body.file_path ?? index);
    const ipAllowed = await rateAllowed(admin, `portal-read:ip:${ip}`, 180, 60);
    const valueAllowed = await rateAllowed(admin, `portal-read:value:${schoolId || "all"}:${value.slice(0, 100)}`, 30, 60);
    if (!ipAllowed || !valueAllowed) return json({ ok: false, error: "rate_limited", message: "Too many requests. Please wait a minute and try again." }, 429);
  }
  if (action === "directory") {
    const forwarded = safeText(req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip"));
    const ip = (forwarded.split(",")[0] || "unknown").trim().slice(0, 80);
    if (!await rateAllowed(admin, `portal-directory:ip:${ip}`, 30, 60)) {
      return json({ ok: false, error: "rate_limited", message: "Too many directory requests. Please wait a minute and try again." }, 429);
    }
  }

  try {
    if (action === "lookup") {
      if (!index) return json({ ok: false, error: "index", message: "Index number is required." }, 400);
      return json(await lookupSchool(admin, index, schoolId));
    }

    if (action === "has_token") {
      if (!index) return json({ ok: false, error: "index", message: "Index number is required." }, 400);
      const parentContact = safeText(body.parent_contact ?? body.phone);
      return json(await hasToken(admin, index, schoolId, parentContact));
    }

    if (action === "school_status") {
      return json(await schoolStatus(admin, schoolId));
    }

    if (action === "retrieve") {
      const by = safeText(body.p_by ?? body.by).toLowerCase();
      const value = safeText(body.p_value ?? body.value);
      if (!schoolId) return json({ ok: false, error: "school", message: "School is required." }, 400);
      if (by !== "index" && by !== "receipt") return json({ ok: false, error: "by", message: "Search type is invalid." }, 400);
      if (!value) return json({ ok: false, error: "value", message: "Search value is required." }, 400);
      const forwarded = safeText(req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip"));
      const ip = (forwarded.split(",")[0] || "unknown").trim().slice(0, 80);
      const otpIpAllowed = await rateAllowed(admin, `token-otp-request:ip:${ip}`, 10, 600);
      const otpStudentAllowed = await rateAllowed(admin, `token-otp-request:value:${schoolId}:${by}:${upperText(value).slice(0, 100)}`, 3, 600);
      if (!otpIpAllowed || !otpStudentAllowed) {
        return json({ ok: false, error: "rate_limited", message: "Too many verification-code requests. Please wait before trying again." }, 429);
      }
      const result = await requestTokenRetrievalOtp(admin, by, value, schoolId);
      return json(result.body, result.status);
    }

    if (action === "retrieve_verify") {
      const challengeId = safeText(body.challenge_id);
      const otp = safeText(body.otp);
      if (!schoolId) return json({ ok: false, error: "school", message: "School is required." }, 400);
      if (!index) return json({ ok: false, error: "index", message: "Index number is required." }, 400);
      if (!/^[0-9a-f-]{36}$/i.test(challengeId)) return json({ ok: false, error: "challenge", message: "Request a new verification code." }, 400);
      if (!/^\d{6}$/.test(otp)) return json({ ok: false, error: "otp", message: "Enter the 6-digit verification code." }, 400);
      const forwarded = safeText(req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip"));
      const ip = (forwarded.split(",")[0] || "unknown").trim().slice(0, 80);
      const verifyIpAllowed = await rateAllowed(admin, `token-otp-verify:ip:${ip}`, 30, 300);
      const verifyChallengeAllowed = await rateAllowed(admin, `token-otp-verify:challenge:${challengeId}`, 8, 300);
      if (!verifyIpAllowed || !verifyChallengeAllowed) {
        return json({ ok: false, error: "rate_limited", message: "Too many verification attempts. Request a new code." }, 429);
      }
      const result = await verifyTokenRetrievalOtp(admin, challengeId, otp, index, schoolId);
      return json(result.body, result.status);
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
      const forwarded = safeText(req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip"));
      const ip = (forwarded.split(",")[0] || "unknown").trim().slice(0, 80);
      if (!await rateAllowed(admin, `admission-submit:ip:${ip}`, 30, 60) || !await rateAllowed(admin, `admission-submit:student:${schoolId || "all"}:${index}`, 8, 60)) {
        return json({ ok: false, error: "rate_limited", message: "Too many submission attempts. Please wait a minute and try again." }, 429);
      }
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
