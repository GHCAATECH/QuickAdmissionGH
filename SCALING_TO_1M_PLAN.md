# QuickAdmissionGH 1 Million Concurrent Users Plan

This project can serve public static pages at very high traffic only when a CDN is in front of it. The authenticated student/admin workflows need deeper backend and database changes before they can safely handle one million simultaneous users.

## What "1 million users at a time" means

There are two different targets:

- 1 million visitors opening static pages: mostly CDN, caching, image optimization, and origin protection.
- 1 million active users logging in, submitting records, paying, uploading files, sending SMS, or using admin dashboards: backend APIs, queues, database replicas, connection pooling, rate limits, observability, and load testing.

The second target is the hard one.

## Current bottlenecks

- The admin portal still loads large school datasets directly into the browser, including students, payments, placement list, logs, programmes, classes, and houses.
- Several frontend files call Supabase tables directly. That is okay for small traffic, but it makes the database the first bottleneck under heavy load.
- Some queries use `select('*')`, which pulls more data than the screen needs.
- The public site has large image assets that should be converted to responsive WebP/AVIF versions.
- HTML is intentionally uncached so users see updates quickly. That is good for correctness, but static assets need aggressive CDN caching.
- Writes such as admission submission, payment confirmation, verification, SMS, and imports need idempotency, queues, and rate limits.

## Phase 1: CDN and static asset scaling

- Put the site behind Cloudflare, Cloud CDN, or another production CDN.
- Cache images, fonts, JavaScript, CSS, and SVG at the edge.
- Keep HTML short-cache or no-cache so updates appear quickly.
- Enable Brotli or gzip compression.
- Convert large PNG/JPG assets to WebP/AVIF and serve responsive sizes.
- Add origin shielding and rate limiting for login and API paths.
- Block direct access to `supabase/`, `.git/`, `.codex/`, `.agents/`, SQL, PowerShell, Markdown, and config files.

Status in repo:

- `.htaccess` now blocks source/control files.
- `.htaccess` now adds compression and static asset cache headers.
- `supabase/functions/admin-students-list` provides an authenticated, school-scoped, paginated student-list API with server-side filtering.

## Phase 2: Backend API layer

- Stop loading all admin data on first page load.
- Replace browser-side table reads with paginated Edge Function endpoints.
- Use list endpoints such as:
  - `admin-dashboard-summary`
  - `admin-students-list`
  - `admin-payments-list`
  - `admin-placement-list`
  - `verified-students-list`
- Return only the fields needed by each screen.
- Add server-side filtering, sorting, and pagination everywhere.
- Keep writes behind Edge Functions with auth, school scope checks, and idempotency keys.

Highest impact file:

- `admin/school-admin.html`

Main current hotspot:

- `loadSchoolData()` fetches many full tables at once.

Migration note:

- The legacy admin page still has direct table reads for compatibility. The next UI migration should call `admin-students-list` when opening the Admission List and Manage Students views, then fetch detail records only when a row is opened.

## Phase 3: Database scaling

- Add or confirm indexes for every high-volume lookup:
  - `students(school_id, bece_index)`
  - `students(school_id, submitted_at)`
  - `students(school_id, verification_status, verified_at)`
  - `placement_list(school_id, index_number)`
  - `payments(school_id, created_at)`
  - `payments(reference)`
  - `activity_log(school_id, created_at)`
- Use read replicas for heavy read traffic.
- Route read-only APIs to replicas where possible.
- Use transaction pooling for serverless/Edge Function traffic.
- Keep write paths short and indexed.
- Precompute dashboard counts instead of counting huge tables on every page load.
- Consider partitioning very large tables by school or academic year once data volume justifies it.

## Phase 4: Queues and async work

- Put SMS sending behind a queue.
- Put bulk imports behind a background job.
- Use payment webhooks plus idempotent verification instead of trusting browser callbacks.
- Use object storage direct uploads with signed upload policies.
- Add retry handling for external services like SMS and Paystack.

## Phase 5: Protection and observability

- Add WAF rules and bot protection.
- Rate-limit:
  - student login
  - token lookup
  - payment verification
  - admission submission
  - admin exports
  - verification actions
- Add structured logs for every Edge Function.
- Track p95/p99 latency, error rate, database CPU, connection count, slow queries, and queue depth.
- Run load tests with k6 or a similar tool before announcing production readiness.

## Minimum production architecture for the 1M target

- CDN in front of the site.
- Static assets cached at the edge.
- Supabase project on a paid production tier with enough compute.
- Read replicas for high read traffic.
- Connection pooling for all backend traffic.
- Edge Functions for all important reads and writes.
- Queue system for SMS, imports, reports, and bulk work.
- Object storage for uploads.
- WAF/rate limiting in front of public paths.
- Monitoring and alerting before launch.

## Next implementation priority

The next code change should be to split `loadSchoolData()` into paginated backend endpoints. That is the biggest current blocker for real scale because it prevents the admin portal from pulling entire school datasets into every browser session.
