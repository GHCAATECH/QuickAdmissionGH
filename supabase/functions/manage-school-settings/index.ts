import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type JsonRecord = Record<string, unknown>;

function safeText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function optionalText(value: unknown): string | null {
  const text = safeText(value);
  return text || null;
}

function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function optionalBoolean(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (value == null || value === "") return null;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

async function resolveProfile(admin: ReturnType<typeof createClient>, req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { user: null, profile: null };

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return { user: null, profile: null };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, school_id, permissions, full_name, email")
    .eq("id", userData.user.id)
    .maybeSingle();

  return { user: userData.user, profile: profile as JsonRecord | null };
}

function hasSchoolAccess(profile: JsonRecord | null, schoolId: string) {
  if (!profile) return false;
  const role = safeText(profile.role).toLowerCase().replace(/\s+/g, "_");
  if (role === "super_admin") return true;
  if (role !== "school_admin") return false;
  return safeText(profile.school_id) === schoolId;
}

async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_bucket_key: key,
    p_limit: limit,
    p_window_seconds: seconds,
  });
  return !!error || data?.allowed !== false;
}

async function upsertSchoolConfig(admin: ReturnType<typeof createClient>, schoolId: string, patch: JsonRecord) {
  const payload = Object.assign({ school_id: schoolId }, patch);
  const { data, error } = await admin
    .from("school_config")
    .upsert(payload, { onConflict: "school_id" })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not save school configuration.");
  return data as JsonRecord;
}

async function updateSchoolProfile(admin: ReturnType<typeof createClient>, schoolId: string, patch: JsonRecord) {
  const { data, error } = await admin
    .from("schools")
    .update(patch)
    .eq("id", schoolId)
    .select("id,name,address,phone,email,headmaster_name,helpdesk,theme_color,school_code,code,crest_url")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not save school profile.");
  return data as JsonRecord;
}

async function upsertSmsSettings(admin: ReturnType<typeof createClient>, schoolId: string, patch: JsonRecord) {
  const payload = Object.assign({ school_id: schoolId }, patch);
  const { data, error } = await admin
    .from("school_sms_templates")
    .upsert(payload, { onConflict: "school_id" })
    .select("school_id,submission_message,sms_enabled")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not save SMS settings.");
  return data as JsonRecord;
}

function pickPatch(source: JsonRecord, keys: string[]) {
  const patch: JsonRecord = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) patch[key] = source[key];
  }
  return patch;
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

  const action = safeText(body.action).toLowerCase();
  const schoolId = safeText(body.school_id ?? body.p_school);
  const patchInput = body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
    ? body.patch as JsonRecord
    : {};

  if (!action) return json({ ok: false, error: "validation", message: "action is required." }, 400);
  if (!schoolId) return json({ ok: false, error: "validation", message: "school_id is required." }, 400);

  const { profile } = await resolveProfile(admin, req);
  if (!hasSchoolAccess(profile, schoolId)) {
    return json({ ok: false, error: "forbidden", message: "You cannot manage settings for this school." }, 403);
  }
  if (!await rateAllowed(admin, `manage-school-settings:${safeText(profile?.id)}:${schoolId}`, 120, 60)) {
    return json({ ok: false, error: "rate_limited", message: "Too many settings updates. Please wait a minute and try again." }, 429);
  }

  try {
    if (action === "profile") {
      const patch: JsonRecord = {
        name: safeText(patchInput.name),
        address: safeText(patchInput.address),
        phone: safeText(patchInput.phone),
        email: safeText(patchInput.email),
        headmaster_name: safeText(patchInput.headmaster_name),
        helpdesk: safeText(patchInput.helpdesk),
        theme_color: safeText(patchInput.theme_color),
      };
      if (!safeText(patch.name)) return json({ ok: false, error: "validation", message: "School name is required." }, 400);
      return json({ ok: true, school: await updateSchoolProfile(admin, schoolId, patch) });
    }

    if (action === "portal_setup") {
      const patch = pickPatch(patchInput, ["req_doc_line1", "req_doc_line2", "req_doc_line3", "req_doc_line4", "req_doc_line5"]);
      return json({ ok: true, config: await upsertSchoolConfig(admin, schoolId, patch) });
    }

    if (action === "sms_settings") {
      const template = safeText(patchInput.submission_message);
      const smsEnabled = optionalBoolean(patchInput.sms_enabled);
      if (!template) return json({ ok: false, error: "validation", message: "Submission SMS template is required." }, 400);
      if (smsEnabled == null) return json({ ok: false, error: "validation", message: "sms_enabled is required." }, 400);
      return json({ ok: true, settings: await upsertSmsSettings(admin, schoolId, { submission_message: template, sms_enabled: smsEnabled }) });
    }

    if (action === "student_features") {
      const patch: JsonRecord = {
        allow_passport_photo: optionalBoolean(patchInput.allow_passport_photo) ?? false,
        allow_house_selection: optionalBoolean(patchInput.allow_house_selection) ?? false,
        allow_class_selection: optionalBoolean(patchInput.allow_class_selection) ?? true,
        force_enrolment_upload: optionalBoolean(patchInput.force_enrolment_upload) ?? true,
      };
      const saved = await upsertSchoolConfig(admin, schoolId, patch);
      return json({ ok: true, config: pickPatch(saved, ["school_id", "allow_passport_photo", "allow_house_selection", "allow_class_selection", "force_enrolment_upload"]) });
    }

    if (action === "admission_status") {
      const admissionStatus = safeText(patchInput.admission_status).toUpperCase();
      if (!["OPENED", "CLOSED"].includes(admissionStatus)) {
        return json({ ok: false, error: "validation", message: "admission_status must be OPENED or CLOSED." }, 400);
      }
      const saved = await upsertSchoolConfig(admin, schoolId, { admission_status: admissionStatus });
      return json({ ok: true, config: pickPatch(saved, ["school_id", "admission_status"]) });
    }

    if (action === "academic_config") {
      const academicYear = optionalText(patchInput.academic_year);
      if (!academicYear) return json({ ok: false, error: "validation", message: "academic_year is required." }, 400);
      const patch: JsonRecord = {
        academic_year: academicYear,
        admission_year: optionalNumber(patchInput.admission_year),
        reopening_date: optionalText(patchInput.reopening_date),
        reopening_time: optionalText(patchInput.reopening_time),
        service_charge: optionalNumber(patchInput.service_charge),
      };
      const saved = await upsertSchoolConfig(admin, schoolId, patch);
      return json({ ok: true, config: pickPatch(saved, ["school_id", "academic_year", "admission_year", "reopening_date", "reopening_time", "service_charge"]) });
    }

    if (action === "templates") {
      const patch: JsonRecord = {
        letter_template: safeText(patchInput.letter_template),
        records_template: safeText(patchInput.records_template),
      };
      const saved = await upsertSchoolConfig(admin, schoolId, patch);
      return json({ ok: true, config: pickPatch(saved, ["school_id", "letter_template", "records_template"]) });
    }

    if (action === "doc_url") {
      const kind = safeText(patchInput.kind).toLowerCase();
      const url = safeText(patchInput.url);
      const columnMap: Record<string, string> = {
        prospectus: "prospectus_url",
        undertaking: "undertaking_url",
        subjects: "subjects_url",
      };
      const column = columnMap[kind];
      if (!column || !url) return json({ ok: false, error: "validation", message: "Document kind and URL are required." }, 400);
      const patch: JsonRecord = { [column]: url };
      const saved = await upsertSchoolConfig(admin, schoolId, patch);
      return json({ ok: true, config: pickPatch(saved, ["school_id", column]) });
    }

    return json({ ok: false, error: "validation", message: "Unknown action." }, 400);
  } catch (error) {
    return json({
      ok: false,
      error: "server",
      message: error instanceof Error ? error.message : "Unexpected error.",
    }, 500);
  }
});
