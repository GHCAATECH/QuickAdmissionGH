import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type JsonRecord = Record<string, unknown>;

function safeText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function toNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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

async function ensureProgrammeBelongsToSchool(admin: ReturnType<typeof createClient>, schoolId: string, programmeId: string | null) {
  if (!programmeId) return null;
  const { data } = await admin.from("programmes").select("id").eq("id", programmeId).eq("school_id", schoolId).maybeSingle();
  return data ? programmeId : null;
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { maxBodyBytes: 32_768 });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "not_configured", message: "Supabase service credentials are missing." }, 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: JsonRecord = {};
  try { body = await req.json(); } catch { body = {}; }

  const action = safeText(body.action).toLowerCase();
  const schoolId = safeText(body.school_id ?? body.p_school);
  const id = safeText(body.id ?? body.record_id ?? body.item_id);
  const patch = body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
    ? body.patch as JsonRecord
    : {};

  if (!action) return json({ ok: false, error: "validation", message: "action is required." }, 400);
  if (!schoolId) return json({ ok: false, error: "validation", message: "school_id is required." }, 400);

  const { profile } = await resolveProfile(admin, req);
  if (!hasSchoolAccess(profile, schoolId)) {
    return json({ ok: false, error: "forbidden", message: "You cannot manage structures for this school." }, 403);
  }
  if (!await rateAllowed(admin, `manage-school-structure:${safeText(profile?.id)}:${schoolId}`, 120, 60)) {
    return json({ ok: false, error: "rate_limited", message: "Too many structure updates. Please wait a minute and try again." }, 429);
  }

  try {
    if (action === "programme_save") {
      const record: JsonRecord = {
        code: safeText(patch.code).toUpperCase(),
        name: safeText(patch.name),
        subjects: safeText(patch.subjects),
        capacity: toNumber(patch.capacity, 100),
      };
      if (!record.code || !record.name) return json({ ok: false, error: "validation", message: "Programme code and name are required." }, 400);
      if (id) {
        const { data, error } = await admin.from("programmes").update(record).eq("id", id).eq("school_id", schoolId).select("*").single();
        if (error || !data) throw new Error(error?.message || "Could not update programme.");
        return json({ ok: true, item: data });
      }
      const { data, error } = await admin.from("programmes").insert(Object.assign({ school_id: schoolId }, record)).select("*").single();
      if (error || !data) throw new Error(error?.message || "Could not create programme.");
      return json({ ok: true, item: data });
    }

    if (action === "house_save") {
      const record: JsonRecord = {
        name: safeText(patch.name),
        color: safeText(patch.color),
        motto: safeText(patch.motto),
        capacity: toNumber(patch.capacity, 100),
        priority: patch.priority == null || patch.priority === "" ? null : Math.max(1, toNumber(patch.priority, 1)),
        gender: safeText(patch.gender),
        residential_type: safeText(patch.residential_type),
      };
      if (!record.name) return json({ ok: false, error: "validation", message: "House name is required." }, 400);
      if (id) {
        const { data, error } = await admin.from("houses").update(record).eq("id", id).eq("school_id", schoolId).select("*").single();
        if (error || !data) throw new Error(error?.message || "Could not update house.");
        return json({ ok: true, item: data });
      }
      const { data, error } = await admin.from("houses").insert(Object.assign({ school_id: schoolId }, record)).select("*").single();
      if (error || !data) throw new Error(error?.message || "Could not create house.");
      return json({ ok: true, item: data });
    }

    if (action === "class_save") {
      const programmeId = await ensureProgrammeBelongsToSchool(admin, schoolId, safeText(patch.programme_id) || null);
      if (!programmeId) return json({ ok: false, error: "validation", message: "A valid programme is required." }, 400);
      const record: JsonRecord = {
        name: safeText(patch.name),
        code: safeText(patch.code),
        capacity: toNumber(patch.capacity, 50),
        programme_id: programmeId,
        subjects: safeText(patch.subjects) || null,
      };
      if (!record.name) return json({ ok: false, error: "validation", message: "Class name is required." }, 400);
      if (id) {
        const { data, error } = await admin.from("classrooms").update(record).eq("id", id).eq("school_id", schoolId).select("*").single();
        if (error || !data) throw new Error(error?.message || "Could not update class.");
        return json({ ok: true, item: data });
      }
      const { data, error } = await admin.from("classrooms").insert(Object.assign({ school_id: schoolId }, record)).select("*").single();
      if (error || !data) throw new Error(error?.message || "Could not create class.");
      return json({ ok: true, item: data });
    }

    if (action === "delete") {
      const type = safeText(body.type);
      if (!id || !type) return json({ ok: false, error: "validation", message: "type and id are required." }, 400);
      const map: Record<string, string> = { prog: "programmes", house: "houses", class: "classrooms" };
      const table = map[type];
      if (!table) return json({ ok: false, error: "validation", message: "Invalid delete type." }, 400);
      const { data, error } = await admin.from(table).delete().eq("id", id).eq("school_id", schoolId).select("id");
      if (error) throw new Error(error.message);
      return json({ ok: true, deleted: Array.isArray(data) ? data.length : 0 });
    }

    return json({ ok: false, error: "validation", message: "Unknown action." }, 400);
  } catch (error) {
    return json({ ok: false, error: "server", message: error instanceof Error ? error.message : "Unexpected error." }, 500);
  }
});
