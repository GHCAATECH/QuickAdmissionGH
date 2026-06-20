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

function canAccessSchool(profile: Record<string, unknown> | null, schoolId: string) {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role !== "school_admin" || safeString(profile.school_id) !== safeString(schoolId)) return false;
  const permissions = profile.permissions && typeof profile.permissions === "object" && !Array.isArray(profile.permissions)
    ? profile.permissions as Record<string, unknown>
    : null;
  if (permissions == null) return true;
  return permissions.co_admin === true || permissions.co_admin === "true" || permissions.co_admin === 1 || permissions.co_admin === "1";
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
  const studentId = safeString(body.student_id ?? body.p_student);
  if (!schoolId || !studentId) {
    return json({ ok: false, error: "validation", message: "school_id and student_id are required." }, 400);
  }

  const { profile } = await resolveProfile(admin, req);
  if (!canAccessSchool(profile as Record<string, unknown> | null, schoolId)) {
    return json({ ok: false, error: "forbidden", message: "You cannot delete students for this school." }, 403);
  }

  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id, school_id, bece_index, full_name, enrolment_form_url")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (studentError) {
    return json({ ok: false, error: "lookup_failed", message: studentError.message }, 500);
  }
  if (!student) {
    return json({ ok: false, error: "not_found", message: "Student record was not found." }, 404);
  }

  const studentIndex = safeString(student.bece_index);

  const deleteByStudent = async (table: string) => {
    const { data, error } = await admin.from(table).delete().eq("school_id", schoolId).eq("student_id", studentId).select("id");
    if (error) throw new Error(`${table}: ${error.message}`);
    return Array.isArray(data) ? data.length : 0;
  };

  try {
    const [paymentsDeleted, tokensDeleted, smsLogsDeleted] = await Promise.all([
      deleteByStudent("payments"),
      deleteByStudent("tokens"),
      deleteByStudent("sms_logs"),
    ]);

    let placementsDeleted = 0;
    if (studentIndex) {
      const { data: placementRows, error: placementError } = await admin
        .from("placement_list")
        .delete()
        .eq("school_id", schoolId)
        .eq("index_number", studentIndex)
        .select("index_number");
      if (placementError) throw new Error(`placement_list: ${placementError.message}`);
      placementsDeleted = Array.isArray(placementRows) ? placementRows.length : 0;
    }

    const { error: studentDeleteError } = await admin
      .from("students")
      .delete()
      .eq("id", studentId)
      .eq("school_id", schoolId);
    if (studentDeleteError) throw new Error(`students: ${studentDeleteError.message}`);

    return json({
      ok: true,
      student_id: studentId,
      student_index: studentIndex,
      student_name: safeString(student.full_name),
      form_url: safeString(student.enrolment_form_url) || null,
      payments: paymentsDeleted,
      tokens: tokensDeleted,
      sms_logs: smsLogsDeleted,
      placements: placementsDeleted,
    });
  } catch (error) {
    return json({
      ok: false,
      error: "delete_failed",
      message: error instanceof Error ? error.message : "Could not delete student records.",
    }, 500);
  }
});
