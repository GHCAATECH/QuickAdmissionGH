# QuickAdmissionGH backend move checklist

This checklist is for reducing what the browser can see and control in QuickAdmissionGH.

Important rule:

- Anything shipped to the browser is public.
- Frontend code can be viewed with DevTools, View Source, or the Network tab.
- Real protection comes from moving sensitive logic and write decisions to the backend.

## Priority 1: keep only public config in frontend

- [ ] Keep only the Supabase publishable/anon key in frontend files.
- [ ] Never place any service role key in `index.html`, `admin/school-admin.html`, or `admin/super-admin.html`.
- [ ] Never place SMS provider secrets or Paystack secret keys in frontend code.
- [ ] Review browser storage usage and make sure no secret is stored in localStorage/sessionStorage.

Relevant files:

- [index.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/index.html)
- [admin/school-admin.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/admin/school-admin.html)
- [admin/super-admin.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/admin/super-admin.html)

## Priority 2: student login should be backend-owned

- [ ] Replace multi-step browser-side login checks with one backend-controlled login flow.
- [ ] Keep index lookup, token validation, school matching, and admission-open checks on the backend.
- [ ] Return only the minimum student/session data needed by the frontend.
- [ ] Rate-limit or harden student login endpoints against enumeration.

Current exposed frontend calls to review:

- `student-login`
- `student_login`
- `find_school_by_index`
- `index_has_token`
- `retrieve_token`

Relevant files:

- [index.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/index.html)
- [supabase/functions/student-login/index.ts](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/functions/student-login/index.ts)

## Priority 3: payment verification must stay backend-only

- [ ] Keep Paystack public key in frontend only for checkout initialization.
- [ ] Keep transaction verification, amount checks, duplicate protection, and final database updates in backend code only.
- [ ] Do not trust the browser to tell you a payment succeeded.
- [ ] Make the backend decide whether a token should be issued or unlocked.

Relevant files:

- [index.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/index.html)
- [supabase/functions/verify-payment/index.ts](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/functions/verify-payment/index.ts)

## Priority 4: submission rules must be backend-owned

- [ ] Keep admission number generation in backend SQL/functions only.
- [ ] Keep submission status transitions in backend logic only.
- [ ] Keep class assignment and house assignment validation on the backend.
- [ ] Reject invalid or tampered payloads server-side even if frontend validation passed.

Relevant files:

- [index.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/index.html)
- [20260629153000_update_submit_application_admission_name_programme_format.sql](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/migrations/20260629153000_update_submit_application_admission_name_programme_format.sql)
- [20260629161000_backfill_existing_admission_numbers.sql](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/migrations/20260629161000_backfill_existing_admission_numbers.sql)
- [supabase/functions/assign-house/index.ts](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/functions/assign-house/index.ts)

## Priority 5: SMS sending should be backend-only

- [ ] Let the frontend draft messages only.
- [ ] Keep sender validation, credit checks, deduplication, delivery, and logging on the backend.
- [ ] Never expose SMS provider secrets in browser code.
- [ ] Keep school-level SMS enable/disable enforcement on the backend.

Relevant files:

- [admin/school-admin.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/admin/school-admin.html)
- [admin/super-admin.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/admin/super-admin.html)
- [supabase/functions/send-sms/index.ts](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/functions/send-sms/index.ts)

## Priority 6: destructive admin actions should stay behind backend functions

- [ ] Keep delete-student and delete-school-records logic in backend functions only.
- [ ] Keep import placement writes behind RPC/function validation.
- [ ] Check that browser users cannot directly bypass UI restrictions to call dangerous writes.
- [ ] Re-check that school-scoped operations always verify the caller's school on the backend.

Relevant files:

- [admin/school-admin.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/admin/school-admin.html)
- [supabase/functions/delete-student/index.ts](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/functions/delete-student/index.ts)
- [supabase/functions/delete-school-records/index.ts](C:/Users/cleme/Documents/QuickAdmissionGH-repo/supabase/functions/delete-school-records/index.ts)

## Priority 7: reduce information leakage from browser-readable RPC names

- [ ] Review every `sb.rpc(...)` call in frontend files.
- [ ] Ask whether browser users should be able to know that RPC exists.
- [ ] Where possible, collapse multiple browser-visible RPC calls into one backend endpoint with stronger access control.
- [ ] Return only the minimum fields needed by the UI.

Start review with:

- [index.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/index.html)
- [admin/school-admin.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/admin/school-admin.html)
- [admin/super-admin.html](C:/Users/cleme/Documents/QuickAdmissionGH-repo/admin/super-admin.html)

## Priority 8: production hardening

- [ ] Disable production source maps if they are not needed.
- [ ] Minify production JS/CSS.
- [ ] Keep CSP tight and avoid adding unnecessary script origins.
- [ ] Review Supabase RLS policies for all student/admin/payment tables.
- [ ] Review every edge function to ensure it uses trusted server-side auth context before writing.

## Quick “safe in frontend” list

These are generally okay to remain public:

- UI layout
- styling
- animations
- printable templates
- field labels
- non-sensitive validation hints
- Supabase project URL
- Supabase publishable/anon key
- Paystack public key

## Best next implementation order

1. Unify student login into one backend-controlled endpoint.
2. Keep all payment verification and token release decisions backend-only.
3. Keep admission submission and numbering fully backend-owned.
4. Keep SMS sending and credit enforcement backend-only.
5. Review frontend RPC calls one by one and reduce what the browser can call directly.
