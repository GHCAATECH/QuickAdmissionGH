import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function safeString(value: unknown) {
  return String(value ?? "").trim();
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

  return { user: userData.user, profile };
}

function canDeleteSchoolData(profile: Record<string, unknown> | null, schoolId: string) {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role !== "school_admin") return false;
  if (safeString(profile.school_id) !== safeString(schoolId)) return false;
  return profile.permissions == null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

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

  const schoolId = safeString(body.school_id ?? body.p_school);
  if (!schoolId) {
    return json({ ok: false, error: "validation", message: "school_id is required." }, 400);
  }

  const { profile } = await resolveProfile(admin, req);
  if (!canDeleteSchoolData(profile as Record<string, unknown> | null, schoolId)) {
    return json({ ok: false, error: "owner_only", message: "Only the school owner can do this." }, 403);
  }

  const { data: students, error: studentsError } = await admin
    .from("students")
    .select("id, bece_index, enrolment_form_url")
    .eq("school_id", schoolId);

  if (studentsError) {
    return json({ ok: false, error: "lookup_failed", message: studentsError.message }, 500);
  }

  const formUrls = (students ?? [])
    .map((row) => safeString((row as Record<string, unknown>).enrolment_form_url))
    .filter(Boolean);

  const countDeleted = async (table: string, column: string, value: string) => {
    const { data, error } = await admin
      .from(table)
      .delete()
      .eq(column, value)
      .select(column);
    if (error) throw new Error(`${table}: ${error.message}`);
    return Array.isArray(data) ? data.length : 0;
  };

  try {
    const paymentsDeleted = await countDeleted("payments", "school_id", schoolId);
    const tokensDeleted = await countDeleted("tokens", "school_id", schoolId);
    const smsLogsDeleted = await countDeleted("sms_logs", "school_id", schoolId);

    let legacySmsDeleted = 0;
    try {
      legacySmsDeleted = await countDeleted("sms_log", "school_id", schoolId);
    } catch {
      legacySmsDeleted = 0;
    }

    const studentsDeleted = await countDeleted("students", "school_id", schoolId);
    const placementsDeleted = await countDeleted("placement_list", "school_id", schoolId);

    return json({
      ok: true,
      school_id: schoolId,
      students: studentsDeleted,
      placements: placementsDeleted,
      payments: paymentsDeleted,
      tokens: tokensDeleted,
      sms_logs: smsLogsDeleted,
      legacy_sms_logs: legacySmsDeleted,
      form_urls: formUrls,
    });
  } catch (error) {
    return json({
      ok: false,
      error: "delete_failed",
      message: error instanceof Error ? error.message : "Could not delete school records.",
    }, 500);
  }
});
