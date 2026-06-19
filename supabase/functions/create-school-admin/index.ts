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

function normalizeEmail(value: unknown) {
  return safeString(value).toLowerCase();
}

function fallbackName(email: string) {
  return safeString(email.split("@")[0] ?? "") || "School Admin";
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

async function persistProfileForUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  email: string,
  fullName: string,
  schoolId: string,
  permissions: Record<string, unknown> | null,
) {
  return await admin
    .from("profiles")
    .upsert({
      id: userId,
      email,
      full_name: fullName,
      school_id: schoolId,
      role: "school_admin",
      permissions,
    }, { onConflict: "id" });
}

async function findAuthUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  let page = 1;
  const perPage = 1000;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return { user: null, error };
    const users = data?.users ?? [];
    const match = users.find((candidate) => normalizeEmail(candidate.email) === email);
    if (match) return { user: match, error: null };
    if (users.length < perPage) break;
    page += 1;
  }

  return { user: null, error: null };
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

  const email = normalizeEmail(body.email);
  const password = safeString(body.password);
  const requestedSchoolId = safeString(body.school_id ?? body.school);
  const requestedName = safeString(body.full_name);

  if (!email || !password) {
    return json({ ok: false, error: "validation", message: "Email and password are required." }, 400);
  }
  if (password.length < 8) {
    return json({ ok: false, error: "validation", message: "Password must be at least 8 characters." }, 400);
  }

  const { profile } = await resolveActor(admin, req);
  if (!profile) {
    return json({ ok: false, error: "unauthorized", message: "You must be signed in to create users." }, 401);
  }

  const actorRole = safeString(profile.role);
  let schoolId = "";
  let permissions: Record<string, unknown> | null = null;

  if (actorRole === "super_admin") {
    schoolId = requestedSchoolId;
    if (!schoolId) {
      return json({ ok: false, error: "validation", message: "school_id is required for this action." }, 400);
    }
    permissions = Object.prototype.hasOwnProperty.call(body, "permissions")
      ? sanitizePermissions(body.permissions)
      : null;
  } else if (actorRole === "school_admin") {
    if (profile.permissions != null) {
      return json({ ok: false, error: "owner_only", message: "Only the school owner can create users." }, 403);
    }
    schoolId = safeString(profile.school_id);
    if (!schoolId) {
      return json({ ok: false, error: "validation", message: "Your school could not be resolved." }, 400);
    }
    permissions = sanitizePermissions(body.permissions);
  } else {
    return json({ ok: false, error: "forbidden", message: "You do not have permission to create users." }, 403);
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id, name")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError) {
    return json({ ok: false, error: "school_lookup_failed", message: schoolError.message }, 500);
  }
  if (!school) {
    return json({ ok: false, error: "school_not_found", message: "School record was not found." }, 404);
  }

  const fullName = requestedName || fallbackName(email);

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "school_admin",
      school_id: schoolId,
    },
  });

  let authUser = createdUser?.user ?? null;

  if (createError || !authUser) {
    const message = createError?.message || "Could not create the login.";
    const duplicate = /already|exists|registered|duplicate/i.test(message);
    if (duplicate) {
      const existing = await findAuthUserByEmail(admin, email);
      if (existing.error) {
        return json({ ok: false, error: "lookup_failed", message: existing.error.message }, 500);
      }
      if (existing.user) {
        authUser = existing.user;
      }
    }
    if (!authUser) {
      return json(
        {
          ok: false,
          error: duplicate ? "duplicate_email" : "create_failed",
          message: duplicate ? "That email already has a login." : message,
        },
        duplicate ? 409 : 500,
      );
    }
  }

  const { error: profileError } = await persistProfileForUser(
    admin,
    authUser.id,
    email,
    fullName,
    schoolId,
    permissions,
  );

  if (profileError) {
    if (createdUser?.user?.id && createdUser.user.id === authUser.id) {
      try {
        await admin.auth.admin.deleteUser(authUser.id);
      } catch {
        // Cleanup is best-effort.
      }
    }
    return json(
      { ok: false, error: "profile_create_failed", message: profileError.message },
      500,
    );
  }

  await logActivity(
    admin,
    schoolId,
    actorLabel(profile as Record<string, unknown> | null),
    `Created school admin login for ${email}`,
  );

  return json({
    ok: true,
    user_id: authUser.id,
    school_id: schoolId,
    email,
    full_name: fullName,
    permissions,
    school_name: safeString(school.name),
  });
});
