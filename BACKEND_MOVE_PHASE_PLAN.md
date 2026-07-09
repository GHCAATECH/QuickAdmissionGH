# QuickAdmissionGH backend move phase plan

This is the stricter execution plan for moving sensitive logic out of the frontend in QuickAdmissionGH.

Use this together with:

- [BACKEND_MOVE_CHECKLIST.md](C:/Users/cleme/Documents/QuickAdmissionGH-repo/BACKEND_MOVE_CHECKLIST.md)

## Goal

Reduce what browser users can inspect, trigger, or tamper with by moving important rules and write decisions to the backend.

## Phase 1 - close the biggest exposure first

Focus:

- student login flow
- payment verification
- submission write decisions

Expected outcome:

- the browser becomes mostly a UI client
- backend becomes the single source of truth for login, payment success, and admission submission

Tasks:

- [ ] Replace split frontend login checks with one backend-controlled login endpoint.
- [ ] Move school lookup + token validation + admission-open checks into one backend flow.
- [ ] Keep Paystack verification and final payment approval entirely backend-only.
- [ ] Make backend decide when a student can continue after payment.
- [ ] Make backend reject tampered submission payloads even if frontend UI allowed them.
- [ ] Confirm `submit_application` remains the only source of admission number generation.

Primary files to review:

- [index.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/index.html)
- [supabase/functions/student-login/index.ts](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/functions/student-login/index.ts)
- [supabase/functions/verify-payment/index.ts](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/functions/verify-payment/index.ts)
- [20260629153000_update_submit_application_admission_name_programme_format.sql](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/migrations/20260629153000_update_submit_application_admission_name_programme_format.sql)

Success checks:

- login still works from the portal
- payment success cannot be forged from browser-only requests
- submission still returns the right admission number

## Phase 2 - move school/admin operational rules behind backend enforcement

Focus:

- SMS sending
- placement import/write actions
- delete/update actions
- school-scoped enforcement

Expected outcome:

- admin pages can still manage data
- dangerous or costly actions are decided server-side

Tasks:

- [ ] Keep SMS delivery, sender checks, duplicate prevention, and logs fully backend-only.
- [ ] Review placement import so browser only uploads data while backend validates final writes.
- [ ] Confirm delete-student and delete-school-records remain backend-enforced.
- [ ] Re-check that school admin actions cannot cross into another school’s records.
- [ ] Reduce direct browser-visible RPC usage where a backend function can wrap it more safely.

Primary files to review:

- [admin/school-admin.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/admin/school-admin.html)
- [admin/super-admin.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/admin/super-admin.html)
- [supabase/functions/send-sms/index.ts](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/functions/send-sms/index.ts)
- [supabase/functions/delete-student/index.ts](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/functions/delete-student/index.ts)
- [supabase/functions/delete-school-records/index.ts](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/functions/delete-school-records/index.ts)

Success checks:

- admin actions still work normally
- browser users cannot safely trigger destructive school actions outside allowed scope
- SMS sending cannot bypass sender/credit/backend checks

## Phase 3 - hardening and cleanup

Focus:

- reduce readable structure in production
- tighten permissions
- clean up leftover exposure

Expected outcome:

- lower information leakage
- stronger backend guardrails
- cleaner production deployment

Tasks:

- [ ] Review every frontend `sb.rpc(...)` call and decide whether it should remain browser-callable.
- [ ] Disable production source maps if not needed.
- [ ] Keep JS/CSS minified in production builds.
- [ ] Review Supabase RLS policies for students, placement, payments, and SMS-related tables.
- [ ] Review all edge functions for auth, school-scope checks, and least-privilege behavior.
- [ ] Remove unused frontend logic that only duplicated backend decisions.

Primary files to review:

- [index.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/index.html)
- [admin/school-admin.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/admin/school-admin.html)
- [admin/super-admin.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/admin/super-admin.html)
- [supabase](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase)

Success checks:

- no secret is exposed in frontend code
- production code is harder to inspect casually
- important writes always depend on backend enforcement, not browser trust

## Recommended working order

1. Finish Phase 1 completely.
2. Test login, payment, and submission end-to-end.
3. Move to Phase 2 and re-test admin workflows.
4. Finish with Phase 3 hardening and cleanup.

## Good rule for every future feature

Before adding any new feature, ask:

- Can the browser see this?
- Can the browser fake this?
- Can the backend decide this instead?

If the answer to either of the first two is yes, the important part belongs on the backend.
