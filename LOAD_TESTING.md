# QuickAdmissionGH staging load testing

Load testing must run against a working staging deployment, never the live site. The test target is:

```text
https://staging.quickadmissiongh.com/
```

The bundled k6 script is intentionally read-only: it requests the homepage only. It does not log in, create Auth users, submit admissions, upload files, send SMS or email, initialize payments, or call payment webhooks.

## Progressive profiles

Run the profiles in order and stop when the error or latency thresholds are exceeded:

| Profile | Purpose | Peak virtual users |
| --- | --- | ---: |
| `smoke` | Verify the script and endpoint | 10 |
| `load` | Expected sustained traffic | 500 |
| `stress` | Find the safe capacity ceiling | 5,000 |
| `spike` | Simulate an admission-deadline surge | 10,000 |
| `soak` | Check stability over several hours | 1,000 |

Acceptance thresholds are less than 1% HTTP failures, p90 below 1 second, p95 below 2 seconds, p99 below 5 seconds, and more than 99% successful checks.

## Commands

```powershell
k6 run -e BASE_URL=https://staging.quickadmissiongh.com -e LOAD_PROFILE=smoke load-tests/staging-homepage.js
k6 run -e BASE_URL=https://staging.quickadmissiongh.com -e LOAD_PROFILE=load load-tests/staging-homepage.js
k6 run -e BASE_URL=https://staging.quickadmissiongh.com -e LOAD_PROFILE=stress load-tests/staging-homepage.js
k6 run -e BASE_URL=https://staging.quickadmissiongh.com -e LOAD_PROFILE=spike load-tests/staging-homepage.js
k6 run -e BASE_URL=https://staging.quickadmissiongh.com -e LOAD_PROFILE=soak load-tests/staging-homepage.js
```

Do not run a profile while staging DNS, HTTPS, or the origin server is unhealthy. Monitor Hostinger CPU, RAM, workers, network, and HTTP errors, plus Supabase database CPU, connections, API latency, Auth limits, storage, and Edge Function errors.

## Ten-million-user planning

Ten million registered users, ten million monthly visitors, ten million daily visitors, and ten million concurrent users are different capacity targets. A single Windows laptop cannot generate ten million realistic concurrent sessions. Million-user concurrency requires a distributed k6 service, Kubernetes or multiple load generators, provider allowlisting, an approved test window, and staging-only credentials.

The `million` profile is locked and will refuse to run unless both `CONFIRM_MILLION=YES` and `DISTRIBUTED_TEST=YES` are set. Do not use it until Hostinger and Supabase have approved the test and all SMS, email, payment, and identity-verification side effects are disabled or mocked.
