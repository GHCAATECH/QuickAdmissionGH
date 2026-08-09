import { readFile } from "node:fs/promises";

const reportPath = "assets/js/pages/admin-school-admin-1.js";
const paymentPath = "supabase/functions/verify-payment/index.ts";
const migrationPath = "supabase/migrations/20260809190000_restrict_sensitive_admin_actions.sql";

const [reportSource, paymentSource, migrationSource] = await Promise.all([
  readFile(reportPath, "utf8"),
  readFile(paymentPath, "utf8"),
  readFile(migrationPath, "utf8"),
]);

const failures = [];
const requireCheck = (condition, message) => {
  if (!condition) failures.push(message);
};

requireCheck(
  !reportSource.includes("r.map(c=>'<td>'+(c==null?'':c)+'</td>')"),
  "Report cells must be HTML-escaped before document.write().",
);
requireCheck(
  reportSource.includes("safeHtml(c==null?'':String(c))"),
  "Report rendering must retain escaped cell output.",
);

const gatewayVerification = paymentSource.indexOf("api.paystack.co/transaction/verify");
const reusedResponses = [...paymentSource.matchAll(/reused:\s*true/g)].map((match) => match.index ?? -1);
requireCheck(gatewayVerification >= 0, "Paystack verification call is missing.");
requireCheck(
  reusedResponses.every((position) => position > gatewayVerification),
  "A reused payment token must never be returned before Paystack verification.",
);
requireCheck(
  !paymentSource.includes("if (st?.admission_token) return json"),
  "The unverified existing-payment token shortcut has returned.",
);

requireCheck(
  migrationSource.includes("owner_or_co_admin_required"),
  "Academic-year switching must enforce owner/co-admin access.",
);
requireCheck(
  migrationSource.includes("revoke insert, update, delete on table public.school_sms_templates"),
  "Direct SMS-template writes must remain revoked from browser roles.",
);
requireCheck(
  migrationSource.includes("permissions ->> 'sms'"),
  "SMS read policies must enforce the assigned SMS privilege.",
);

if (failures.length) {
  for (const failure of failures) console.error(`SECURITY CHECK FAILED: ${failure}`);
  process.exit(1);
}

console.log("Security regression checks passed: report XSS, payment reuse, academic-year authorization, and SMS permissions.");
