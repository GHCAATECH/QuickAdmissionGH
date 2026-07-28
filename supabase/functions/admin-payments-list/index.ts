import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
type JsonRecord = Record<string, unknown>;
const text = (value: unknown) => String(value ?? "").trim();
function pageValue(value: unknown, fallback: number, max: number) { const n = Number(value); return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), max) : fallback; }
async function resolveProfile(admin: ReturnType<typeof createClient>, req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: profile } = await admin.from("profiles").select("id,role,school_id,permissions").eq("id", authData.user.id).maybeSingle();
  return profile as JsonRecord | null;
}
function canRead(profile: JsonRecord | null, schoolId: string) {
  if (!profile) return false;
  if (text(profile.role) === "super_admin") return true;
  return text(profile.role) === "school_admin" && text(profile.school_id) === schoolId;
}
async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", { p_bucket_key: key, p_limit: limit, p_window_seconds: seconds });
  return !!error || data?.allowed !== false;
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { methods: ["POST", "OPTIONS"], maxBodyBytes: 16_384 });
  if (blocked) return blocked;
  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ ok: false, error: "not_configured", message: "Supabase service credentials are missing." }, 500);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const profile = await resolveProfile(admin, req);
  if (!profile) return json({ ok: false, error: "unauthorized", message: "You must be signed in." }, 401);
  let body: JsonRecord = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "validation", message: "A JSON request body is required." }, 400); }
  const schoolId = text(body.school_id || profile.school_id);
  if (!schoolId || !canRead(profile, schoolId)) return json({ ok: false, error: "forbidden", message: "You cannot access payments for this school." }, 403);
  if (!await rateAllowed(admin, `admin-payments-list:${text(profile.id)}:${schoolId}`, 60, 60)) return json({ ok: false, error: "rate_limited", message: "Too many payment-list requests. Please wait a minute and try again." }, 429);
  const page = pageValue(body.page, 1, 1_000_000);
  const pageSize = pageValue(body.page_size, 50, 500);
  const search = text(body.search).replace(/[%,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  let query = admin.from("payments")
    .select("student_id,paid_at,created_at,payer_name,amount_pesewas,channel,status,reference, students(bece_index, full_name)", { count: "exact" })
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (search) {
    const escaped = search.replace(/[%_]/g, (value) => `\\${value}`);
    query = query.or(`reference.ilike.%${escaped}%,payer_name.ilike.%${escaped}%`);
  }
  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error) return json({ ok: false, error: "query_failed", message: error.message }, 500);
  const total = count ?? 0;
  return json({ ok: true, school_id: schoolId, page, page_size: pageSize, total, total_pages: Math.max(Math.ceil(total / pageSize), 1), rows: data ?? [] });
});
