import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { guardRequest, jsonResponse, requestAssuranceLevel } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY") ?? "";
const ARKESEL_SMS_URL = Deno.env.get("ARKESEL_SMS_URL") ?? "https://sms.arkesel.com/api/v2/sms/send";
const DEFAULT_SUBMISSION_TEMPLATE =
  "Congratulations {student_name}. Your admission application has been successfully submitted to {school_name}.";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type JsonRecord = Record<string, unknown>;

function normalizeSchoolCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 11);
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  if (digits.startsWith("+" ) && digits.length === 13) return digits.slice(1);
  return digits;
}

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStudentIndex(value: unknown) {
  return safeString(value).toUpperCase();
}

async function rateAllowed(key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", { p_bucket_key: key, p_limit: limit, p_window_seconds: seconds });
  return !error && data?.allowed !== false;
}

function smsJson(req: Request, body: JsonRecord, status = 200) {
  return jsonResponse(req, body, status);
}

function hasSchoolWriteAccess(profile: Record<string, unknown> | null, schoolId: string) {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role !== "school_admin" || safeString(profile.school_id) !== safeString(schoolId)) return false;
  const permissions = profile.permissions && typeof profile.permissions === "object" && !Array.isArray(profile.permissions)
    ? profile.permissions as Record<string, unknown>
    : null;
  if (permissions == null) return true;
  return permissions.co_admin === true || permissions.co_admin === "true" || permissions.co_admin === 1 || permissions.co_admin === "1";
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{([a-z_]+)\}/gi, (_, rawKey) => vars[rawKey.toLowerCase()] ?? "");
}

type BulkCandidate = {
  recipient: string;
  message: string;
  studentId: string | null;
  externalId: string;
};

function bulkCandidateKey(candidate: BulkCandidate) {
  return normalizeStudentIndex(candidate.externalId);
}

type ReservedBulkCandidate = BulkCandidate & { logId: number };

function extractBalance(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const direct = record.balance ?? record.sms_balance ?? record.remaining_balance;
  if (direct != null && direct !== "" && !Number.isNaN(Number(direct))) return Number(direct);
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    const nestedBalance = nested.balance ?? nested.sms_balance ?? nested.remaining_balance;
    if (nestedBalance != null && nestedBalance !== "" && !Number.isNaN(Number(nestedBalance))) {
      return Number(nestedBalance);
    }
  }
  return null;
}

async function resolveProfile(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { token: "", user: null, profile: null };

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return { token, user: null, profile: null };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, school_id, permissions, full_name, email")
    .eq("id", userData.user.id)
    .maybeSingle();

  return { token, user: userData.user, profile };
}

async function sendArkeselSms(payload: {
  sender: string;
  message: string;
  recipients: string[];
  sandbox?: boolean;
}) {
  const response = await fetch(ARKESEL_SMS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": ARKESEL_API_KEY,
    },
    body: JSON.stringify({
      sender: payload.sender,
      message: payload.message,
      recipients: payload.recipients,
      ...(payload.sandbox ? { sandbox: true } : {}),
    }),
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = { raw: rawText };
  }

  return {
    ok: response.ok,
    status: response.status,
    payload: parsed,
    rawText,
  };
}

function responseStatus(result: { ok: boolean; payload: unknown; status: number }) {
  if (!result.ok) return "failed";
  const payload = result.payload as Record<string, unknown> | null;
  if (payload && typeof payload.status === "string") {
    const normalized = String(payload.status).toLowerCase();
    if (["failed", "error"].includes(normalized)) return "failed";
  }
  if (payload && typeof payload.code === "string" && String(payload.code).toLowerCase() !== "ok") {
    return "failed";
  }
  return "sent";
}

async function logSms(log: Record<string, unknown>) {
  await admin.from("sms_logs").insert(log);
  const legacyPayload = {
    school_id: log.school_id,
    recipient_group: log.recipient_group,
    recipients: log.recipients,
    message: log.message,
    sent_by: log.sent_by,
    status: log.status,
    sent_at: new Date().toISOString(),
  };
  try {
    await admin.from("sms_log").insert(legacyPayload);
  } catch {
    // Legacy mirror is best-effort only. New logging lives in public.sms_logs.
  }
}

async function getPlacementSmsContact(schoolId: string, indexNumber: string) {
  const { data } = await admin
    .from("placement_list")
    .select("sms_contact")
    .eq("school_id", schoolId)
    .eq("index_number", indexNumber)
    .maybeSingle();
  return safeString(data?.sms_contact);
}

async function syncSchoolBalance(schoolId: string, balance: number | null) {
  if (!schoolId || balance == null || Number.isNaN(Number(balance))) return;
  try {
    await admin
      .from("school_config")
      .update({ sms_balance: Number(balance) })
      .eq("school_id", schoolId);
  } catch {
    // Balance sync is best-effort only.
  }
}

async function reserveBulkCandidates(
  schoolId: string,
  senderId: string,
  sentBy: string,
  templateName: string | null,
  candidates: BulkCandidate[],
) {
  const { data, error } = await admin.rpc("reserve_bulk_sms_recipients", {
    p_school_id: schoolId,
    p_sender_id: senderId,
    p_sent_by: sentBy,
    p_template_name: templateName,
    p_candidates: candidates.map((candidate) => ({
      student_id: candidate.studentId,
      external_id: candidate.externalId,
      phone: candidate.recipient,
      message: candidate.message,
    })),
  });
  if (error) throw new Error(`Could not reserve SMS recipients: ${error.message}`);

  const reservations = new Map<string, number>();
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>;
    const key = normalizeStudentIndex(record.external_id);
    const logId = Number(record.log_id);
    if (key && Number.isFinite(logId)) reservations.set(key, logId);
  }

  return candidates.reduce<ReservedBulkCandidate[]>((reserved, candidate) => {
    const logId = reservations.get(bulkCandidateKey(candidate));
    if (logId != null) reserved.push({ ...candidate, logId });
    return reserved;
  }, []);
}

async function handleSubmissionConfirmation(req: Request, body: Record<string, unknown>) {
  const index = safeString(body.index);
  const token = safeString(body.token);
  const schoolId = safeString(body.school || body.school_id);
  if (!index || !token) {
    return smsJson(req, { ok: false, error: "validation", message: "Index number and token are required." }, 400);
  }

  let studentQuery = admin
    .from("students")
    .select(
      "id, school_id, bece_index, full_name, admission_no, admission_token, submitted_at, parent_phone, records, submission_sms_sent, submission_sms_status",
    )
    .eq("bece_index", index);

  if (schoolId) studentQuery = studentQuery.eq("school_id", schoolId);
  const { data: studentRows, error: studentError } = await studentQuery.limit(100);
  if (studentError) {
    return smsJson(req, { ok: false, error: "student_lookup_failed", message: studentError.message }, 500);
  }
  if (!studentRows || studentRows.length === 0) {
    return smsJson(req, { ok: false, error: "index", message: "Student record not found." }, 404);
  }
  if (studentRows.length > 1) {
    return smsJson(req, { ok: false, error: "ambiguous", message: "Index number matches more than one school." }, 409);
  }

  const student = studentRows[0];
  if (safeString(student.admission_token).toUpperCase() !== token.toUpperCase()) {
    return smsJson(req, { ok: false, error: "token", message: "Admission token is not valid." }, 403);
  }
  if (!student.submitted_at) {
    return smsJson(req, { ok: false, error: "not_submitted", message: "Submission has not been completed yet." }, 409);
  }
  if (student.submission_sms_sent) {
    return smsJson(req, { ok: true, status: "duplicate", message: "Confirmation SMS was already sent for this submission." });
  }
  if (safeString(student.submission_sms_status).toLowerCase() === "processing") {
    return smsJson(req, { ok: true, status: "duplicate", message: "Confirmation SMS is already being processed." });
  }

  const { data: claimRows } = await admin
    .from("students")
    .update({
      submission_sms_status: "processing",
      submission_sms_last_error: null,
    })
    .eq("id", student.id)
    .eq("submission_sms_sent", false)
    .or("submission_sms_status.is.null,submission_sms_status.eq.failed,submission_sms_status.eq.skipped")
    .select("id");

  if (!claimRows || !claimRows.length) {
    return smsJson(req, { ok: true, status: "duplicate", message: "Confirmation SMS has already been handled." });
  }

  const { data: school } = await admin
    .from("schools")
    .select("id, name, school_code, code")
    .eq("id", student.school_id)
    .maybeSingle();

  const { data: settings } = await admin
    .from("school_sms_templates")
    .select("submission_message, sms_enabled")
    .eq("school_id", student.school_id)
    .maybeSingle();

  const senderId = normalizeSchoolCode(school?.school_code ?? school?.code);
  const placementPhone = await getPlacementSmsContact(student.school_id, student.bece_index);
  const recordsSms = safeString(
    student.records && typeof student.records === "object"
      ? (student.records as Record<string, unknown>).sms_contact
      : "",
  );
  const phone = normalizePhone(recordsSms || safeString(student.parent_phone) || placementPhone);
  const template = safeString(settings?.submission_message) || DEFAULT_SUBMISSION_TEMPLATE;
  const smsEnabled = settings?.sms_enabled !== false;
  const applicationNo = safeString(body.application_no || student.admission_no);
  const studentName = safeString(student.full_name) || "Applicant";
  const schoolName = safeString(school?.name) || "your school";
  const message = renderTemplate(template, {
    student_name: studentName,
    school_name: schoolName,
    application_no: applicationNo,
  }).trim();

  if (!smsEnabled) {
    await admin
      .from("students")
      .update({ submission_sms_status: "skipped", submission_sms_last_error: "SMS is disabled for this school." })
      .eq("id", student.id);
    await logSms({
      school_id: student.school_id,
      student_id: student.id,
      recipient_group: "submission",
      recipients: 1,
      phone: phone || null,
      sender_id: senderId || null,
      message,
      status: "pending",
      sent_by: "System",
      template_name: "submission",
      api_response: { skipped: true, reason: "sms_disabled" },
    });
    return smsJson(req, { ok: true, status: "skipped", message: "SMS is disabled for this school." });
  }

  if (!senderId) {
    await admin
      .from("students")
      .update({ submission_sms_status: "skipped", submission_sms_last_error: "School sender ID is missing." })
      .eq("id", student.id);
    await logSms({
      school_id: student.school_id,
      student_id: student.id,
      recipient_group: "submission",
      recipients: 1,
      phone: phone || null,
      sender_id: null,
      message,
      status: "failed",
      sent_by: "System",
      template_name: "submission",
      api_response: { skipped: true, reason: "missing_school_code" },
    });
    return smsJson(req, { ok: true, status: "skipped", message: "School sender ID is missing." });
  }

  if (!phone) {
    await admin
      .from("students")
      .update({ submission_sms_status: "skipped", submission_sms_last_error: "Student phone number is missing." })
      .eq("id", student.id);
    await logSms({
      school_id: student.school_id,
      student_id: student.id,
      recipient_group: "submission",
      recipients: 1,
      phone: null,
      sender_id: senderId,
      message,
      status: "failed",
      sent_by: "System",
      template_name: "submission",
      api_response: { skipped: true, reason: "missing_phone" },
    });
    return smsJson(req, { ok: true, status: "skipped", message: "Student phone number is missing." });
  }

  const result = await sendArkeselSms({
    sender: senderId,
    message,
    recipients: [phone],
  });

  const status = responseStatus(result);
  await logSms({
    school_id: student.school_id,
    student_id: student.id,
    recipient_group: "submission",
    recipients: 1,
    phone,
    sender_id: senderId,
    message,
    status,
    sent_by: "System",
    template_name: "submission",
    api_response: result.payload ?? { raw: result.rawText, http_status: result.status },
  });

  if (status === "sent") {
    const balance = extractBalance(result.payload);
    await syncSchoolBalance(student.school_id, balance);
    await admin
      .from("students")
      .update({
        submission_sms_sent: true,
        submission_sms_status: "sent",
        submission_sms_sent_at: new Date().toISOString(),
        submission_sms_last_error: null,
      })
      .eq("id", student.id);
    return smsJson(req, {
      ok: true,
      status: "sent",
      message: "Confirmation SMS sent successfully.",
      balance,
    });
  }

  await admin
    .from("students")
    .update({
      submission_sms_status: "failed",
      submission_sms_last_error: result.rawText || "Arkesel send failed.",
    })
    .eq("id", student.id);

  return smsJson(req,
    {
      ok: false,
      status: "failed",
      error: "send_failed",
      message: "Arkesel could not send the confirmation SMS.",
      provider: result.payload ?? { raw: result.rawText, http_status: result.status },
    },
    502,
  );
}

async function assertSchoolAccess(profile: Record<string, unknown> | null, schoolId: string) {
  if (!profile) return { ok: false, status: 401, message: "Authentication is required." };
  if (hasSchoolWriteAccess(profile, schoolId)) {
    return { ok: true, status: 200 };
  }
  return { ok: false, status: 403, message: "You cannot send SMS for this school." };
}

async function getSchoolSmsMeta(schoolId: string) {
  const { data: school } = await admin
    .from("schools")
    .select("id, name, school_code, code")
    .eq("id", schoolId)
    .maybeSingle();
  const { data: settings } = await admin
    .from("school_sms_templates")
    .select("submission_message, sms_enabled")
    .eq("school_id", schoolId)
    .maybeSingle();
  return { school, settings };
}

async function handleBulkSms(req: Request, body: Record<string, unknown>) {
  const { profile } = await resolveProfile(req);
  const schoolId = safeString(body.school_id);
  if (!schoolId) return smsJson(req, { ok: false, error: "validation", message: "school_id is required." }, 400);

  const access = await assertSchoolAccess(profile, schoolId);
  if (!access.ok) return smsJson(req, { ok: false, error: "forbidden", message: access.message }, access.status);

  if (!await rateAllowed(`bulk-sms:${safeString(profile?.id) || "unknown"}:${schoolId}`, 3, 60)) {
    return smsJson(req, { ok: false, error: "rate_limited", message: "Too many bulk SMS requests. Please wait a minute and try again." }, 429);
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return smsJson(req, { ok: false, error: "validation", message: "No messages supplied." }, 400);
  if (messages.length > 1_000) return smsJson(req, { ok: false, error: "batch_too_large", message: "Bulk SMS is limited to 1,000 recipients per request." }, 413);

  const { school, settings } = await getSchoolSmsMeta(schoolId);
  const senderId = normalizeSchoolCode(school?.school_code ?? school?.code);
  if (!senderId) return smsJson(req, { ok: false, error: "missing_school_code", message: "This school has no sender ID configured." }, 422);
  if (settings?.sms_enabled === false) return smsJson(req, { ok: false, error: "sms_disabled", message: "SMS is disabled for this school." }, 422);

  const candidates: BulkCandidate[] = [];
  const requestKeys = new Set<string>();
  for (const row of messages) {
    if (!row || typeof row !== "object") continue;
    const recipient = normalizePhone((row as Record<string, unknown>).to);
    const message = safeString((row as Record<string, unknown>).body);
    const studentId = safeString(
      (row as Record<string, unknown>).student_id ?? (row as Record<string, unknown>).studentId,
    ) || null;
    const externalId = normalizeStudentIndex(
      (row as Record<string, unknown>).student_index ??
      (row as Record<string, unknown>).index ??
      (row as Record<string, unknown>).external_id ??
      (row as Record<string, unknown>).externalId,
    );
    if (!recipient || !message || !externalId) continue;
    const candidate: BulkCandidate = { recipient, message, studentId, externalId };
    const candidateKey = bulkCandidateKey(candidate);
    if (requestKeys.has(candidateKey)) continue;
    if (candidateKey) requestKeys.add(candidateKey);
    candidates.push(candidate);
  }

  if (!candidates.length) {
    return smsJson(req, { ok: false, error: "validation", message: "No valid recipients were supplied." }, 400);
  }

  const sentBy = safeString(profile?.full_name) || "Admin";
  const templateName = safeString(body.template_name) || null;
  const sendableCandidates = await reserveBulkCandidates(
    schoolId,
    senderId,
    sentBy,
    templateName,
    candidates,
  );
  const reservedKeys = new Set(sendableCandidates.map(bulkCandidateKey));
  const skippedIndexes = candidates
    .filter((candidate) => !reservedKeys.has(bulkCandidateKey(candidate)))
    .map((candidate) => candidate.externalId);
  const skipped = skippedIndexes.length;

  if (!sendableCandidates.length) {
    return smsJson(req, {
      ok: true,
      status: "duplicate",
      sent: 0,
      failed: 0,
      skipped,
      balance: null,
      sender_id: senderId,
      sent_indices: [],
      failed_indices: [],
      skipped_indices: skippedIndexes,
      message: "All matching students already received this SMS.",
    });
  }

  const grouped = new Map<string, ReservedBulkCandidate[]>();
  for (const candidate of sendableCandidates) {
    const list = grouped.get(candidate.message) ?? [];
    list.push(candidate);
    grouped.set(candidate.message, list);
  }

  let sent = 0;
  let failed = 0;
  let balance: number | null = null;
  const providerResponses: unknown[] = [];
  const sentIndexes: string[] = [];
  const failedIndexes: string[] = [];

  for (const [message, batchCandidates] of grouped.entries()) {
    const recipients = batchCandidates.map((candidate) => candidate.recipient);
    let result: Awaited<ReturnType<typeof sendArkeselSms>>;
    try {
      result = await sendArkeselSms({ sender: senderId, message, recipients });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "SMS provider request failed.";
      result = {
        ok: false,
        status: 0,
        payload: { error: "provider_unreachable", message: errorMessage },
        rawText: errorMessage,
      };
    }
    providerResponses.push({
      message,
      recipients,
      response: result.payload ?? { raw: result.rawText, http_status: result.status },
    });
    const batchBalance = extractBalance(result.payload);
    if (batchBalance != null) balance = batchBalance;
    const batchStatus = responseStatus(result);
    if (batchStatus === "sent") sent += recipients.length;
    else failed += recipients.length;
    const batchIndexes = batchCandidates.map((candidate) => candidate.externalId);
    if (batchStatus === "sent") sentIndexes.push(...batchIndexes);
    else failedIndexes.push(...batchIndexes);
    const { error: logUpdateError } = await admin
      .from("sms_logs")
      .update({
        status: batchStatus,
        api_response: result.payload ?? { raw: result.rawText, http_status: result.status },
      })
      .in("id", batchCandidates.map((candidate) => candidate.logId));
    if (logUpdateError) throw new Error(`Could not update SMS delivery logs: ${logUpdateError.message}`);
  }

  const status = failed === 0 ? "sent" : sent > 0 ? "pending" : "failed";
  const templateMessage = safeString(body.template) || safeString(messages[0] && typeof messages[0] === "object" ? (messages[0] as Record<string, unknown>).body : "");

  await logSms({
    school_id: schoolId,
    recipient_group: safeString(body.group) || "bulk",
    recipients: sent + failed,
    sender_id: senderId,
    message: templateMessage,
    status,
    sent_by: sentBy,
    template_name: templateName,
    api_response: { batches: providerResponses, skipped },
  });

  await syncSchoolBalance(schoolId, balance);

  return smsJson(req, {
    ok: failed === 0,
    status,
    sent,
    failed,
    skipped,
    balance,
    sender_id: senderId,
    sent_indices: sentIndexes,
    failed_indices: failedIndexes,
    skipped_indices: skippedIndexes,
    message:
      failed > 0
        ? (sent > 0
          ? `SMS finished: ${sent} sent, ${failed} failed${skipped ? `, ${skipped} skipped` : ""}.`
          : `SMS failed for ${failed} recipient(s)${skipped ? `, ${skipped} skipped` : ""}.`)
        : (skipped
          ? `SMS sent to ${sent} recipient(s); ${skipped} already-sent student(s) skipped.`
          : `SMS sent to ${sent} recipient(s).`),
  }, failed === 0 ? 200 : 207);
}

async function handleTestSms(req: Request, body: Record<string, unknown>) {
  const { profile } = await resolveProfile(req);
  const schoolId = safeString(body.school_id);
  const phone = normalizePhone(body.phone);
  if (!schoolId || !phone) {
    return smsJson(req, { ok: false, error: "validation", message: "school_id and phone are required." }, 400);
  }

  const access = await assertSchoolAccess(profile, schoolId);
  if (!access.ok) return smsJson(req, { ok: false, error: "forbidden", message: access.message }, access.status);

  const { school, settings } = await getSchoolSmsMeta(schoolId);
  const senderId = normalizeSchoolCode(school?.school_code ?? school?.code);
  if (!senderId) return smsJson(req, { ok: false, error: "missing_school_code", message: "This school has no sender ID configured." }, 422);
  if (settings?.sms_enabled === false) return smsJson(req, { ok: false, error: "sms_disabled", message: "SMS is disabled for this school." }, 422);

  const schoolName = safeString(school?.name) || "your school";
  const message = `This is a test SMS from ${schoolName}.`;
  const result = await sendArkeselSms({ sender: senderId, message, recipients: [phone] });
  const status = responseStatus(result);
  const balance = extractBalance(result.payload);

  await logSms({
    school_id: schoolId,
    recipient_group: "test",
    recipients: 1,
    phone,
    sender_id: senderId,
    message,
    status,
    sent_by: safeString(profile?.full_name) || "Admin",
    template_name: "test",
    api_response: result.payload ?? { raw: result.rawText, http_status: result.status },
  });

  await syncSchoolBalance(schoolId, balance);

  return smsJson(req, {
    ok: status === "sent",
    status,
    sender_id: senderId,
    balance,
    message: status === "sent" ? "Test SMS sent successfully." : "Test SMS failed.",
  }, status === "sent" ? 200 : 502);
}

Deno.serve(async (req) => {
  const blocked = guardRequest(req, { maxBodyBytes: 131_072 });
  if (blocked) return blocked;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ARKESEL_API_KEY) {
    return smsJson(req, { ok: false, error: "not_configured", message: "SMS provider is not configured." }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = safeString(body.mode || body.action || "bulk").toLowerCase();

    if (mode === "submission-confirmation") {
      return await handleSubmissionConfirmation(req, body);
    }
    if (requestAssuranceLevel(req) !== "aal2") {
      return smsJson(req, {
        ok: false,
        error: "mfa_required",
        message: "Multi-factor authentication is required.",
      }, 403);
    }
    if (mode === "test") {
      return await handleTestSms(req, body);
    }
    return await handleBulkSms(req, body);
  } catch (error) {
    return smsJson(req, {
      ok: false,
      error: "internal_error",
      message: error instanceof Error ? error.message : "Unexpected error.",
    }, 500);
  }
});
