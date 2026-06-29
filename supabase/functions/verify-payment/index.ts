// verify-payment — verifies a Paystack transaction; surfaces Paystack's exact
// status/message on failure for diagnosis. Secret: PAYSTACK_SECRET_KEY.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";
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
function safeString(value: unknown): string {
  return String(value ?? "").trim();
}
function metadataValue(metadata: unknown, variableName: string): string {
  if (!metadata || typeof metadata !== "object") return "";
  const record = metadata as Record<string, unknown>;
  const direct = safeString(record[variableName]);
  if (direct) return direct;
  const fields = Array.isArray(record.custom_fields) ? record.custom_fields : [];
  const match = fields.find((field) => {
    if (!field || typeof field !== "object") return false;
    return safeString((field as Record<string, unknown>).variable_name) === variableName;
  }) as Record<string, unknown> | undefined;
  return safeString(match?.value);
}
function paystackMode(key: string): "live" | "test" | "unknown" {
  if (!key) return "unknown";
  if (key.startsWith("sk_live_") || key.startsWith("pk_live_")) return "live";
  if (key.startsWith("sk_test_") || key.startsWith("pk_test_")) return "test";
  return "unknown";
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { maxBodyBytes: 12_288 });
  if (blocked) return blocked;
  const json = (o: unknown, s = 200) => jsonResponse(req, o, s);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: { reference?: string; index?: string; name?: string; phone?: string; email?: string; school?: string; ping?: boolean };
  try { body = await req.json(); } catch { body = {}; }
  const secret = getSecret();
  const publicKey = getPublicKey();
  if (body.ping) {
    const publicMode = paystackMode(publicKey);
    const secretMode = paystackMode(secret);
    return json({
      ok: true,
      secret_present: secret.length > 0,
      public_key_present: publicKey.length > 0,
      public_mode: publicMode,
      mode_mismatch: publicMode !== "unknown" && secretMode !== "unknown" && publicMode !== secretMode,
      public_key: publicKey || null,
    });
  }
  if (!secret) return json({ ok: false, error: "not_configured", message: "PAYSTACK_SECRET_KEY is not set." }, 503);

  const reference = (body.reference || "").trim();
  const index = (body.index || "").trim();
  const school = (body.school || "").trim();
  if (!reference || !index) return json({ ok: false, error: "missing" }, 400);

  const admin = createClient(url, service);
  const { data: existingPay, error: existingPayError } = await admin
    .from("payments")
    .select("id, student_id, school_id")
    .eq("reference", reference)
    .maybeSingle();
  if (existingPayError) {
    return json({ ok: false, error: "reference_lookup_failed", message: existingPayError.message }, 500);
  }
  if (existingPay?.student_id) {
    const { data: st } = await admin
      .from("students")
      .select("admission_token, bece_index, school_id")
      .eq("id", existingPay.student_id)
      .maybeSingle();
    const sameIndex = safeString(st?.bece_index) === index;
    const sameSchool = !school || safeString(st?.school_id) === school;
    if (!sameIndex || !sameSchool) {
      return json({
        ok: false,
        error: "reference_mismatch",
        message: "This payment reference belongs to a different student record.",
      }, 409);
    }
    if (st?.admission_token) return json({ ok: true, token: st.admission_token, reused: true, reference });
  }
  if (existingPay) {
    return json({
      ok: false,
      error: "reference_incomplete",
      message: "This payment reference already exists but is not linked to a student. Contact support.",
    }, 409);
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
  const gatewayReference = safeString(pdata?.data?.reference);
  if (gatewayReference && gatewayReference !== reference) {
    return json({
      ok: false,
      error: "reference_mismatch",
      message: "Paystack returned a different transaction reference.",
    }, 409);
  }
  const currency = safeString(pdata?.data?.currency).toUpperCase();
  if (currency && currency !== "GHS") {
    return json({
      ok: false,
      error: "currency_mismatch",
      message: "Payment currency does not match the Ghana cedi service charge.",
      gateway_currency: currency,
    }, 402);
  }

  const metadataIndex = metadataValue(pdata?.data?.metadata, "index");
  const metadataSchoolId = metadataValue(pdata?.data?.metadata, "school_id");
  if (metadataIndex && metadataIndex !== index) {
    return json({
      ok: false,
      error: "metadata_mismatch",
      message: "The payment reference belongs to a different index number.",
    }, 409);
  }
  if (metadataSchoolId && school && metadataSchoolId !== school) {
    return json({
      ok: false,
      error: "metadata_mismatch",
      message: "The payment reference belongs to a different school.",
    }, 409);
  }

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
  if (metadataSchoolId && metadataSchoolId !== sid) {
    return json({
      ok: false,
      error: "metadata_mismatch",
      message: "The payment reference belongs to a different school.",
    }, 409);
  }

  const { data: cfg, error: cfgError } = await admin
    .from("school_config")
    .select("service_charge")
    .eq("school_id", sid)
    .maybeSingle();
  if (cfgError) {
    return json({ ok: false, error: "config_lookup_failed", message: cfgError.message }, 500);
  }
  const expectedCharge = Number(cfg?.service_charge);
  if (!Number.isFinite(expectedCharge) || expectedCharge < 0) {
    return json({
      ok: false,
      error: "pricing_not_configured",
      message: "The school's service charge is not configured.",
    }, 500);
  }
  const expectedAmountPesewas = Math.round(expectedCharge * 100);
  if (amount !== expectedAmountPesewas) {
    return json({
      ok: false,
      error: "amount_mismatch",
      message: "Paid amount does not match the configured service charge.",
      expected_amount: expectedCharge,
      expected_amount_pesewas: expectedAmountPesewas,
      gateway_amount: amount,
    }, 402);
  }

  const { data: prior } = await admin.from("students")
    .select("id, admission_token").eq("school_id", sid).eq("bece_index", index).maybeSingle();
  let studentId: string; let token: string;
  if (prior?.id) {
    studentId = prior.id; token = prior.admission_token || genToken();
    const { error: updateError } = await admin.from("students").update({ admission_token: token, payment_status: "paid",
      parent_phone: body.phone || null, parent_email: body.email || null }).eq("id", studentId);
    if (updateError) return json({ ok: false, error: "student_update_failed", message: updateError.message }, 500);
  } else {
    token = genToken();
    const { data: stu, error: se } = await admin.from("students").insert({
      school_id: sid, bece_index: index, admission_token: token,
      full_name: body.name || null, parent_phone: body.phone || null, parent_email: body.email || null,
      payment_status: "paid" }).select("id").single();
    if (se || !stu) return json({ ok: false, error: "save_failed", message: se?.message }, 400);
    studentId = stu.id;
  }
  const { error: paymentError } = await admin.from("payments").insert({
    school_id: sid,
    student_id: studentId,
    reference,
    channel: "paystack",
    amount_pesewas: amount,
    payer_name: body.name,
    phone: body.phone,
    email: body.email,
    status: "completed",
    paid_at: new Date().toISOString(),
  });
  if (paymentError) {
    if (paymentError.code === "23505") {
      const { data: racedPayment } = await admin
        .from("payments")
        .select("student_id")
        .eq("reference", reference)
        .maybeSingle();
      if (safeString(racedPayment?.student_id) === studentId) {
        return json({ ok: true, token, reused: true, reference });
      }
      return json({ ok: false, error: "reference_mismatch", message: "This payment reference is already in use." }, 409);
    }
    return json({ ok: false, error: "payment_save_failed", message: paymentError.message }, 500);
  }

  const { error: tokenError } = await admin.from("tokens").insert({ school_id: sid, student_id: studentId, token });
  if (tokenError && tokenError.code !== "23505") {
    console.error("Token mirror insert failed", tokenError.message);
  }
  return json({ ok: true, token, reference });
});
