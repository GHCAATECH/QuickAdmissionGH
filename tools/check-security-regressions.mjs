import { readFile } from "node:fs/promises";

const reportPath = "assets/js/pages/admin-school-admin-1.js";
const paymentPath = "supabase/functions/verify-payment/index.ts";
const migrationPath = "supabase/migrations/20260809190000_restrict_sensitive_admin_actions.sql";
const hardeningMigrationPath = "supabase/migrations/20260814110000_admin_mfa_security_hardening.sql";
const legacyRpcRemovalPath = "supabase/migrations/20260814120000_drop_legacy_student_login_rpc.sql";
const portalPath = "supabase/functions/student-portal/index.ts";
const securityPath = "supabase/functions/_shared/security.ts";
const configPath = "supabase/config.toml";
const indexPath = "index.html";
const schoolAdminPath = "admin/school-admin.html";
const superAdminPath = "admin/super-admin.html";

const [
  reportSource,
  paymentSource,
  migrationSource,
  hardeningMigrationSource,
  legacyRpcRemovalSource,
  portalSource,
  securitySource,
  configSource,
  indexSource,
  schoolAdminSource,
  superAdminSource,
] = await Promise.all([
  readFile(reportPath, "utf8"),
  readFile(paymentPath, "utf8"),
  readFile(migrationPath, "utf8"),
  readFile(hardeningMigrationPath, "utf8"),
  readFile(legacyRpcRemovalPath, "utf8"),
  readFile(portalPath, "utf8"),
  readFile(securityPath, "utf8"),
  readFile(configPath, "utf8"),
  readFile(indexPath, "utf8"),
  readFile(schoolAdminPath, "utf8"),
  readFile(superAdminPath, "utf8"),
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
requireCheck(
  hardeningMigrationSource.includes("revoke all on function public.student_login(text, text, uuid)"),
  "The legacy public student_login RPC must remain revoked.",
);
requireCheck(
  legacyRpcRemovalSource.includes("drop function if exists public.student_login(text, text, uuid)"),
  "The obsolete student_login database RPC must remain removed.",
);
requireCheck(
  hardeningMigrationSource.includes("require_admin_mfa_20260814")
    && hardeningMigrationSource.includes("auth.jwt() ->> ''aal''"),
  "Protected browser tables must retain the restrictive AAL2 policy.",
);
requireCheck(
  !portalSource.includes("student_found:")
    && !portalSource.includes('select("student_name,index_number")')
    && !portalSource.includes('select("full_name,bece_index")'),
  "Public school lookup must not disclose student identity or existence details.",
);
requireCheck(
  portalSource.includes("submittedPhone === storedPhone"),
  "Paid-token status must remain bound to the stored Parent Contact.",
);
requireCheck(
  securitySource.includes('options.allowNullOrigin === true ? "null" : ""'),
  "Null-origin requests must remain denied unless a function opts in explicitly.",
);
requireCheck(
  configSource.includes("[auth.mfa.totp]")
    && configSource.includes("enroll_enabled = true")
    && configSource.includes("verify_enabled = true"),
  "TOTP enrollment and verification must remain enabled.",
);
for (const [label, source] of [
  ["student index", indexSource],
  ["school admin", schoolAdminSource],
  ["super admin", superAdminSource],
]) {
  requireCheck(
    !source.includes("cdn.jsdelivr.net") && !source.includes("cdnjs.cloudflare.com"),
    `${label} must use the locally pinned vendor libraries.`,
  );
  requireCheck(
    !source.includes("https://*.supabase.co"),
    `${label} CSP must not allow every Supabase project.`,
  );
}

if (failures.length) {
  for (const failure of failures) console.error(`SECURITY CHECK FAILED: ${failure}`);
  process.exit(1);
}

console.log("Security regression checks passed: XSS, payment reuse, admin MFA, RPC closure, lookup privacy, CORS, CSP, and SMS permissions.");
