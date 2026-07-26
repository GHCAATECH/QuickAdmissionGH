# QuickAdmissionGH Production Launch Checklist

Use this before opening the system to live schools and students.

## Supabase Auth

- Set Site URL to `https://www.quickadmissiongh.com`.
- Add allowed redirects:
  - `https://www.quickadmissiongh.com`
  - `https://quickadmissiongh.com`
- Disable public user signup. Admin accounts should be created by Super Admin / authorized Edge Functions only.
- Use strong passwords:
  - minimum length: 10 or more
  - lowercase, uppercase, number, and symbol required
- Enable secure password change / recent-login requirement.

## Supabase Database

- Apply all migrations in `supabase/migrations`.
- Confirm core tables have Row Level Security enabled before live traffic:
  - `students`
  - `placement_list`
  - `payments`
  - `tokens`
  - `profiles`
  - `schools`
  - `school_config`
  - `programmes`
  - `houses`
  - `classrooms`
  - `finance_claims`
- Restrict direct database network access to trusted IP ranges in the Supabase dashboard where possible.
- Keep service-role credentials only in Supabase Edge Function secrets.

## Supabase Storage

- Do not keep student enrolment forms or passport photos in a public bucket for live production.
- Move `enrolment-forms` to private storage and serve files through signed URLs or authenticated Edge Functions.
- Confirm upload limits and MIME-type restrictions for JPG/PNG documents.

## Edge Functions

- Deploy all functions under `supabase/functions`.
- Confirm these secrets are set in Supabase:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `PAYSTACK_SECRET_KEY`
  - `PAYSTACK_PUBLIC_KEY`
  - `ARKESEL_API_KEY`
  - `ALLOWED_ORIGINS=https://www.quickadmissiongh.com,https://quickadmissiongh.com`

## Website Hosting

- Confirm `.htaccess` or equivalent rewrite/security rules are active on the production host.
- Confirm these paths are blocked:
  - `/supabase`
  - `/.git`
  - `/.codex`
  - `/.agents`
  - `/full`
  - `/full.html`
  - `*.sql`
  - `*.ps1`
  - `*.md`
  - `*.toml`
- Confirm HTTPS is forced.
- Confirm HTML is not cached aggressively after deploy.

## Final Smoke Test

- Student can select school.
- Student can buy/retrieve token.
- Student can log in and submit personal records.
- Student cannot download admission documents before completing personal records.
- School Admin can see submitted admission count.
- School Admin can export PDF/Excel reports.
- Super Admin can see correct finance counts and mark valid claims paid.
- Campus verification can search, verify, print, and reverse with permissions.
