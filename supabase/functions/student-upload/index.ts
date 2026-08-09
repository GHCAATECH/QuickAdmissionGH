import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ENROLMENT_MAX_BYTES = 5 * 1024 * 1024;
const PASSPORT_MAX_BYTES = 2 * 1024 * 1024;
const text = (value: unknown) => String(value ?? "").trim();

function detectedImageMime(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  return "";
}

async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_bucket_key: key,
    p_limit: limit,
    p_window_seconds: seconds,
  });
  return !error && data?.allowed !== false;
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, {
    methods: ["POST", "OPTIONS"],
    allowedContentTypes: ["multipart/form-data"],
    maxBodyBytes: ENROLMENT_MAX_BYTES + 64 * 1024,
  });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "not_configured", message: "Student upload service is not configured." }, 500);
  }

  let form: FormData;
  try { form = await req.formData(); } catch {
    return json({ ok: false, error: "validation", message: "A multipart upload is required." }, 400);
  }
  const schoolId = text(form.get("school_id"));
  const index = text(form.get("index"));
  const token = text(form.get("token"));
  const kind = text(form.get("kind")).toLowerCase();
  const file = form.get("file");
  if (!schoolId || !index || !token || !["enrolment", "passport"].includes(kind) || !(file instanceof File)) {
    return json({ ok: false, error: "validation", message: "School, index, token, upload type, and file are required." }, 400);
  }

  const isEnrolment = kind === "enrolment";
  const maxBytes = isEnrolment ? ENROLMENT_MAX_BYTES : PASSPORT_MAX_BYTES;
  const claimedMime = text(file.type).toLowerCase();
  const allowedMime = isEnrolment ? ["image/jpeg"] : ["image/jpeg", "image/png"];
  if (!allowedMime.includes(claimedMime)) {
    return json({ ok: false, error: "file_type", message: isEnrolment ? "The enrolment form must be a JPG image." : "The passport photo must be a JPG or PNG image." }, 415);
  }
  if (file.size < 1 || file.size > maxBytes) {
    return json({ ok: false, error: "file_size", message: `The file must be ${isEnrolment ? "5 MB" : "2 MB"} or smaller.` }, 413);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const forwarded = text(req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip"));
  const ip = (forwarded.split(",")[0] || "unknown").trim().slice(0, 80);
  if (!await rateAllowed(admin, `student-upload:${schoolId}:${index}:${ip}`, 6, 3600)) {
    return json({ ok: false, error: "rate_limited", message: "Too many uploads. Please wait before trying again." }, 429);
  }
  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id,school_id,bece_index,admission_token")
    .eq("school_id", schoolId)
    .eq("bece_index", index)
    .maybeSingle();
  if (studentError) return json({ ok: false, error: "lookup_failed", message: "Could not verify the student." }, 500);
  if (!student || text(student.admission_token).toUpperCase() !== token.toUpperCase()) {
    return json({ ok: false, error: "unauthorized", message: "Student credentials are invalid." }, 401);
  }

  if (!isEnrolment) {
    const { data: config, error: configError } = await admin
      .from("school_config")
      .select("allow_passport_photo")
      .eq("school_id", schoolId)
      .maybeSingle();
    if (configError) return json({ ok: false, error: "config_failed", message: "Could not verify the school's upload settings." }, 500);
    if (config?.allow_passport_photo !== true) {
      return json({ ok: false, error: "feature_disabled", message: "Passport photo uploads are disabled for this school." }, 403);
    }
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectedImageMime(bytes);
  if (!allowedMime.includes(mime)) {
    return json({ ok: false, error: "file_signature", message: "The file contents do not match an allowed image type." }, 415);
  }
  const extension = mime === "image/png" ? "png" : "jpg";
  const folder = `${schoolId}/${student.id}`;
  const path = isEnrolment ? `${folder}/enrolment-form.jpg` : `${folder}/passport-photo.${extension}`;
  const { error: uploadError } = await admin.storage.from("enrolment-forms").upload(path, bytes, {
    contentType: mime,
    cacheControl: "3600",
    upsert: true,
  });
  if (uploadError) return json({ ok: false, error: "upload_failed", message: uploadError.message }, 500);
  return json({ ok: true, path, storage_ref: `enrolment-forms/${path}`, kind, size: file.size, content_type: mime });
});
