import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED_PERMISSION_KEYS = new Set([
  "dashboard",
  "students",
  "placement",
  "structure",
  "finance",
  "sms",
  "reports",
  "templates",
  "setup",
  "portal",
  "utilities",
  "users",
  "students_house_view",
  "student_house_view",
]);

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function sanitizePermissions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const source = value as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const key of ALLOWED_PERMISSION_KEYS) {
    const raw = source[key];
    if (raw === true || raw === "true" || raw === 1 || raw === "1") {
      clean[key] = true;
    }
  }
  const house = safeString(source.house);
  if (house) clean.house = house;
  return clean;
}

async function resolveActor(admin: ReturnType<typeof createClient>, req: Request) {
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

function actorLabel(profile: Record<string, unknown> | null) {
  return safeString(profile?.full_name) || safeString(profile?.email) || "System";
}

async function logActivity(admin: ReturnType<typeof createClient>, schoolId: string, actor: string, action: string) {
  if (!schoolId) return;
  try {
    await admin.from("activity_log").insert({ school_id: schoolId, actor, action });
  } catch {
    // Activity logging is best-effort only.
  }
}

async function loadTargetProfile(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email, school_id, role, permissions")
    .eq("id", userId)
    .maybeSingle();
  return { data, error };
}

function canManageActor(
  actor: Record<string, unknown> | null,
  target: Record<string, unknown> | null,
  action: string,
) {
  if (!actor || !target) {
    return { ok: false, error: "not_found", message: "User record was not found.", status: 404 };
  }

  const actorRole = safeString(actor.role);
  const targetRole = safeString(target.role);
  const actorId = safeString(actor.id);
  const targetId = safeString(target.id);

  if (!actorRole) {
    return { ok: false, error: "forbidden", message: "You do not have permission to manage users.", status: 403 };
  }

  if (actorId && targetId && actorId === targetId) {
    return {
      ok: false,
      error: "self_manage_blocked",
      message: action === "delete"
        ? "You cannot delete your own account."
        : "Use your own account settings for this action.",
      status: 403,
    };
  }

  if (actorRole === "super_admin") {
    return { ok: true, status: 200 };
  }

  if (actorRole !== "school_admin") {
    return { ok: false, error: "forbidden", message: "You do not have permission to manage users.", status: 403 };
  }

  if (actor.permissions != null) {
    return { ok: false, error: "owner_only", message: "Only the school owner can manage users.", status: 403 };
  }

  if (targetRole !== "school_admin") {
    return { ok: false, error: "forbidden", message: "This account cannot be managed here.", status: 403 };
  }

  if (safeString(actor.school_id) !== safeString(target.school_id)) {
    return { ok: false, error: "forbidden", message: "You cannot manage users from another school.", status: 403 };
  }

  if (action === "permissions" && targetRole !== "school_admin") {
    return { ok: false, error: "forbidden", message: "Only school-admin staff accounts have editable privileges.", status: 403 };
  }

  if (action === "permissions" && target.permissions == null) {
    return { ok: false, error: "owner_only", message: "The owner account always has full access.", status: 403 };
  }

  return { ok: true, status: 200 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

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

  const action = safeString(body.action).toLowerCase();
  const userId = safeString(body.user_id ?? body.id);
  if (!action || !userId) {
    return json({ ok: false, error: "validation", message: "action and user_id are required." }, 400);
  }

  const { profile } = await resolveActor(admin, req);
  if (!profile) {
    return json({ ok: false, error: "unauthorized", message: "You must be signed in to manage users." }, 401);
  }

  const { data: target, error: targetError } = await loadTargetProfile(admin, userId);
  if (targetError) {
    return json({ ok: false, error: "lookup_failed", message: targetError.message }, 500);
  }

  const access = canManageActor(
    profile as Record<string, unknown> | null,
    target as Record<string, unknown> | null,
    action,
  );
  if (!access.ok) {
    return json({ ok: false, error: access.error, message: access.message }, access.status);
  }

  const schoolId = safeString((target as Record<string, unknown>).school_id);
  const targetEmail = safeString((target as Record<string, unknown>).email);
  const targetName = safeString((target as Record<string, unknown>).full_name) || targetEmail || "User";
  const actor = actorLabel(profile as Record<string, unknown> | null);

  if (action === "permissions") {
    const permissions = sanitizePermissions(body.permissions);
    const { error } = await admin
      .from("profiles")
      .update({ permissions })
      .eq("id", userId);
    if (error) {
      return json({ ok: false, error: "update_failed", message: error.message }, 500);
    }
    await logActivity(admin, schoolId, actor, `Updated user privileges for ${targetEmail || targetName}`);
    return json({ ok: true, user_id: userId, permissions });
  }

  if (action === "password") {
    const password = safeString(body.password);
    if (!password) {
      return json({ ok: false, error: "validation", message: "password is required." }, 400);
    }
    if (password.length < 8) {
      return json({ ok: false, error: "validation", message: "Password must be at least 8 characters." }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) {
      return json({ ok: false, error: "password_reset_failed", message: error.message }, 500);
    }
    await logActivity(admin, schoolId, actor, `Reset password for ${targetEmail || targetName}`);
    return json({ ok: true, user_id: userId });
  }

  if (action === "delete") {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return json({ ok: false, error: "delete_failed", message: error.message }, 500);
    }
    try {
      await admin.from("profiles").delete().eq("id", userId);
    } catch {
      // Auth delete normally cascades. This cleanup is best-effort.
    }
    await logActivity(admin, schoolId, actor, `Deleted user ${targetEmail || targetName}`);
    return json({ ok: true, user_id: userId });
  }

  return json({ ok: false, error: "validation", message: "Unsupported action." }, 400);
});
