import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type JsonRecord = Record<string, unknown>;

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function email(value: unknown) {
  return text(value).toLowerCase();
}

const RESERVED_SUBDOMAINS = new Set([
  "www", "admin", "api", "mail", "ftp", "support", "staging", "app", "dashboard",
  "cdn", "static", "assets", "auth", "login", "portal", "superadmin", "super-admin", "school-admin",
]);

function portalSubdomain(value: unknown) {
  return text(value).toLowerCase();
}

function validPortalSubdomain(value: string) {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(value) && !RESERVED_SUBDOMAINS.has(value);
}

async function actorProfile(admin: ReturnType<typeof createClient>, req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData.user) return null;
  const { data } = await admin
    .from("profiles")
    .select("id,role,full_name,email")
    .eq("id", userData.user.id)
    .maybeSingle();
  return data as JsonRecord | null;
}

async function rateAllowed(admin: ReturnType<typeof createClient>, key: string) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_bucket_key: key,
    p_limit: 30,
    p_window_seconds: 60,
  });
  return !error && data?.allowed !== false;
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
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const actor = await actorProfile(admin, req);
  if (!actor) return json({ ok: false, error: "unauthorized", message: "You must be signed in." }, 401);
  if (text(actor.role) !== "super_admin") {
    return json({ ok: false, error: "forbidden", message: "Only a super admin can manage school tenants." }, 403);
  }
  if (!await rateAllowed(admin, `manage-school:${text(actor.id)}`)) {
    return json({ ok: false, error: "rate_limited", message: "Too many school updates. Please wait a minute." }, 429);
  }

  const action = text(body.action).toLowerCase();
  if (!["create", "update", "status", "delete"].includes(action)) {
    return json({ ok: false, error: "validation", message: "Unknown school management action." }, 400);
  }

  const schoolId = text(body.school_id) || null;
  const source = body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
    ? body.patch as JsonRecord
    : {};

  if (action === "status" || action === "delete") {
    if (!schoolId) return json({ ok: false, error: "validation", message: "school_id is required." }, 400);
    const status = text(source.status).toLowerCase();
    if (action === "status" && !["active", "suspended"].includes(status)) {
      return json({ ok: false, error: "validation", message: "School status must be active or suspended." }, 400);
    }
    const { data: saved, error: saveError } = await admin.rpc("manage_school_record_backend", {
      p_action: action,
      p_school_id: schoolId,
      p_payload: {
        status,
        actor: text(actor.full_name) || text(actor.email) || "Super Admin",
      },
    });
    if (saveError || !saved?.ok) {
      return json({ ok: false, error: "save_failed", message: saveError?.message || saved?.message || "Could not update the school." }, 500);
    }
    if (action === "delete") {
      const profileIds = Array.isArray(saved.profile_ids) ? saved.profile_ids : [];
      const authCleanupErrors: string[] = [];
      for (const profileId of profileIds) {
        const userId = text(profileId);
        if (!userId) continue;
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) authCleanupErrors.push(userId);
      }
      return json({ ...saved, auth_cleanup_pending: authCleanupErrors });
    }
    return json(saved);
  }

  const schoolCode = text(source.school_code).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const schoolName = text(source.name);
  const subdomain = portalSubdomain(source.subdomain);
  const admissionStatus = text(source.admission_status).toUpperCase();
  if (!schoolName) return json({ ok: false, error: "validation", message: "School name is required." }, 400);
  if (!schoolCode || schoolCode.length > 11) {
    return json({ ok: false, error: "validation", message: "School code must contain 1 to 11 letters or numbers." }, 400);
  }
  if (!validPortalSubdomain(subdomain)) {
    return json({
      ok: false,
      error: "validation",
      message: "Enter a valid school portal subdomain using letters, numbers, or hyphens.",
    }, 400);
  }
  if (admissionStatus !== "OPENED" && admissionStatus !== "CLOSED") {
    return json({ ok: false, error: "validation", message: "Admission status must be OPENED or CLOSED." }, 400);
  }

  const patch: JsonRecord = {
    school_code: schoolCode,
    name: schoolName,
    subdomain,
    phone: text(source.phone),
    email: email(source.email),
    subscription_plan: text(source.subscription_plan) || "standard",
    subscription_expiry: text(source.subscription_expiry) || null,
    status: text(source.status) || "active",
    service_charge: Math.max(Number(source.service_charge) || 0, 0),
    admission_status: admissionStatus,
    accept_online_payment: source.accept_online_payment !== false,
    actor: text(actor.full_name) || text(actor.email) || "Super Admin",
  };

  const { data: saved, error: saveError } = await admin.rpc("manage_school_record_backend", {
    p_action: action,
    p_school_id: schoolId,
    p_payload: patch,
  });
  if (saveError || !saved?.ok) {
    const message = saveError?.message || saved?.message || "Could not save the school.";
    const duplicateSubdomain = /subdomain/i.test(message) && /duplicate|unique|already/i.test(message);
    const duplicateCode = !duplicateSubdomain && /duplicate|unique|school_code/i.test(message);
    const duplicate = duplicateSubdomain || duplicateCode;
    const duplicateMessage = duplicateSubdomain
      ? "That school portal subdomain is already in use."
      : "That school code is already in use.";
    return json({ ok: false, error: duplicateSubdomain ? "duplicate_subdomain" : duplicateCode ? "duplicate_code" : "save_failed", message: duplicate ? duplicateMessage : message }, duplicate ? 409 : 500);
  }

  if (action === "update") return json(saved);

  const createdSchoolId = text(saved.school?.id);
  const adminEmail = email(source.admin_email);
  const adminPassword = text(source.admin_password);
  const adminName = text(source.admin_name) || "School Admin";
  if (!adminEmail || adminPassword.length < 8) {
    if (createdSchoolId) await admin.from("schools").delete().eq("id", createdSchoolId);
    return json({ ok: false, error: "validation", message: "Admin email and a password of at least 8 characters are required." }, 400);
  }

  // A new tenant must begin with an empty academic structure. This also
  // clears records created by a legacy database trigger or template clone, so
  // programmes, classrooms, and houses are added only by that school's admin.
  const structureResets = await Promise.all([
    admin.from("programmes").delete().eq("school_id", createdSchoolId),
    admin.from("classrooms").delete().eq("school_id", createdSchoolId),
    admin.from("houses").delete().eq("school_id", createdSchoolId),
  ]);
  const structureResetError = structureResets.find((result) => result.error)?.error;
  if (structureResetError) {
    if (createdSchoolId) await admin.from("schools").delete().eq("id", createdSchoolId);
    return json({
      ok: false,
      error: "structure_reset_failed",
      message: `Could not initialise the new school: ${structureResetError.message}`,
    }, 500);
  }

  const { data: createdUser, error: userError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: adminName, role: "school_admin", school_id: createdSchoolId },
  });
  if (userError || !createdUser.user) {
    if (createdSchoolId) await admin.from("schools").delete().eq("id", createdSchoolId);
    const duplicate = /already|exists|registered|duplicate/i.test(userError?.message || "");
    return json({
      ok: false,
      error: duplicate ? "duplicate_email" : "admin_create_failed",
      message: duplicate ? "That admin email already has a login." : userError?.message || "Could not create the primary admin login.",
    }, duplicate ? 409 : 500);
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: createdUser.user.id,
    email: adminEmail,
    full_name: adminName,
    school_id: createdSchoolId,
    role: "school_admin",
    permissions: null,
  }, { onConflict: "id" });

  if (profileError) {
    await admin.auth.admin.deleteUser(createdUser.user.id);
    if (createdSchoolId) await admin.from("schools").delete().eq("id", createdSchoolId);
    return json({ ok: false, error: "profile_create_failed", message: profileError.message }, 500);
  }

  return json({ ...saved, admin: { id: createdUser.user.id, email: adminEmail, full_name: adminName } });
});
