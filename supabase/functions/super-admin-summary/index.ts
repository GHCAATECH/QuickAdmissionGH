import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const summaryCache = new Map<string, { expiresAt: number; value: unknown }>();

function text(value: unknown) {
  return String(value ?? "").trim();
}

async function resolveProfile(admin: ReturnType<typeof createClient>, req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: profile } = await admin.from("profiles").select("id,role").eq("id", authData.user.id).maybeSingle();
  return profile as Record<string, unknown> | null;
}

async function rateAllowed(admin: ReturnType<typeof createClient>, key: string) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_bucket_key: key,
    p_limit: 60,
    p_window_seconds: 60,
  });
  return !error && data?.allowed !== false;
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { methods: ["POST", "OPTIONS"], maxBodyBytes: 4_096, requireAal2: true });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ ok: false, error: "not_configured", message: "Supabase service credentials are missing." }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const profile = await resolveProfile(admin, req);
  if (!profile) return json({ ok: false, error: "unauthorized", message: "You must be signed in." }, 401);
  if (text(profile.role) !== "super_admin") return json({ ok: false, error: "forbidden", message: "Super-admin access is required." }, 403);
  if (!await rateAllowed(admin, `super-summary:${text(profile.id)}`)) {
    return json({ ok: false, error: "rate_limited", message: "Too many summary requests. Please wait a minute and try again." }, 429);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }
  const cached = summaryCache.get("platform");
  if (body.refresh !== true && cached && cached.expiresAt > Date.now()) {
    return json({ ok: true, summary: cached.value ?? {} });
  }

  const { data, error } = await admin.rpc("super_admin_dashboard_summary");
  if (error) return json({ ok: false, error: "summary_failed", message: error.message }, 500);
  summaryCache.set("platform", { expiresAt: Date.now() + 15_000, value: data ?? {} });
  return json({ ok: true, summary: data ?? {} });
});
