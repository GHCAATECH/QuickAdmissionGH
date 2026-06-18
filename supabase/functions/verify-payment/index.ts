// verify-payment — verifies a Paystack transaction; surfaces Paystack's exact
// status/message on failure for diagnosis. Secret: PAYSTACK_SECRET_KEY.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function genToken(): string {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let t = "AS";
  for (let i = 0; i < 6; i++) t += c[Math.floor(Math.random() * c.length)];
  return t;
}
function getSecret(): string {
  return (Deno.env.get("PAYSTACK_SECRET_KEY") || Deno.env.get("PAYSTACK_SECRET") || Deno.env.get("PAYSTACK_SK") || "").trim();
}
function getPublicKey(): string {
  return (Deno.env.get("PAYSTACK_PUBLIC_KEY") || Deno.env.get("PAYSTACK_PUBLIC") || Deno.env.get("PAYSTACK_PK") || "").trim();
}
function paystackMode(key: string): "live" | "test" | "unknown" {
  if (!key) return "unknown";
  if (key.startsWith("sk_live_") || key.startsWith("pk_live_")) return "live";
  if (key.startsWith("sk_test_") || key.startsWith("pk_test_")) return "test";
  return "unknown";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: { reference?: string; index?: string; name?: string; phone?: string; email?: string; school?: string; ping?: boolean };
  try { body = await req.json(); } catch { body = {}; }
  const secret = getSecret();
  const publicKey = getPublicKey();
  if (body.ping) {
    return json({
      ok: true,
      secret_present: secret.length > 0,
      secret_prefix: secret ? secret.slice(0, 8) : null,
      secret_mode: paystackMode(secret),
      public_key_present: publicKey.length > 0,
      public_mode: paystackMode(publicKey),
      public_key: publicKey || null,
    });
  }
  if (!secret) return json({ ok: false, error: "not_configured", message: "PAYSTACK_SECRET_KEY is not set." }, 503);

  const reference = (body.reference || "").trim();
  const index = (body.index || "").trim();
  const school = (body.school || "").trim();
  if (!reference || !index) return json({ ok: false, error: "missing" }, 400);

  const admin = createClient(url, service);
  const { data: existingPay } = await admin.from("payments").select("id, student_id").eq("reference", reference).maybeSingle();
  if (existingPay?.student_id) {
    const { data: st } = await admin.from("students").select("admission_token").eq("id", existingPay.student_id).single();
    if (st?.admission_token) return json({ ok: true, token: st.admission_token, reused: true });
  }

  let pres: Response;
  try {
    pres = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
  } catch (_e) { return json({ ok: false, error: "gateway_unreachable" }, 502); }
  const pdata = await pres.json().catch(() => ({}));
  const txStatus = pdata?.data?.status ?? null;
  if (!pres.ok || !pdata?.status || txStatus !== "success") {
    return json({
      ok: false, error: "verification_failed",
      http: pres.status, gateway_ok: !!pdata?.status,
      gateway_status: txStatus,
      gateway_message: pdata?.message ?? null,
      gateway_amount: pdata?.data?.amount ?? null,
    }, 402);
  }
  const amount = Number(pdata.data.amount || 0);

  // Resolve the target school. Prefer the school the student selected in the portal;
  // fall back to school_of_index only when no school was supplied.
  let sid: string | null = null;
  if (school) {
    const { data: pl } = await admin.from("placement_list").select("school_id").eq("school_id", school).eq("index_number", index).maybeSingle();
    const { data: ex } = await admin.from("students").select("id").eq("school_id", school).eq("bece_index", index).maybeSingle();
    if (pl || ex) sid = school;
    else return json({ ok: false, error: "not_placed", message: "Index not on the selected school's placement list." }, 400);
  } else {
    const { data: s2 } = await admin.rpc("school_of_index", { p_index: index });
    sid = (s2 as string) || null;
  }
  if (!sid) return json({ ok: false, error: "not_placed", message: "Index not on any placement list." }, 400);

  const { data: prior } = await admin.from("students")
    .select("id, admission_token").eq("school_id", sid).eq("bece_index", index).maybeSingle();
  let studentId: string; let token: string;
  if (prior?.id) {
    studentId = prior.id; token = prior.admission_token || genToken();
    await admin.from("students").update({ admission_token: token, payment_status: "paid",
      parent_phone: body.phone || null, parent_email: body.email || null }).eq("id", studentId);
  } else {
    token = genToken();
    const { data: stu, error: se } = await admin.from("students").insert({
      school_id: sid, bece_index: index, admission_token: token,
      full_name: body.name || null, parent_phone: body.phone || null, parent_email: body.email || null,
      payment_status: "paid" }).select("id").single();
    if (se || !stu) return json({ ok: false, error: "save_failed", message: se?.message }, 400);
    studentId = stu.id;
  }
  await admin.from("payments").insert({ school_id: sid, student_id: studentId, reference, channel: "paystack",
    amount_pesewas: amount, payer_name: body.name, phone: body.phone, email: body.email,
    status: "completed", paid_at: new Date().toISOString() });
  await admin.from("tokens").insert({ school_id: sid, student_id: studentId, token });
  return json({ ok: true, token, reference });
});
