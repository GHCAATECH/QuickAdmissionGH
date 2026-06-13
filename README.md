# QuickAdmissionGH

A web-based senior high school admission system for Ghana, covering the full admission flow
for students, school administrators, and the platform owner.

## Contents

| File | Description |
|------|-------------|
| `QuickAdmissionGH.html` | **Combined single-file app** — all three portals in one page (Student Portal + School Admin tabs, with a discreet Super Admin link). Open this to run everything. |
| `student-portal_20.html` | Student-facing portal: school selection, login, token purchase (Paystack), multi-step personal records form, document downloads. |
| `school-admin_36.html` | School admin panel: placement import, student management, house/class allocation, finance, SMS, reports, templates, academic-year switching. |
| `super-admin_12.html` | Platform owner panel: schools, admins, finance overview. |
| `index_11.html` | Standalone login landing page. |
| `banner.png` | Landing-page hero banner. |

## Tech

- Plain HTML/CSS/JavaScript (no build step).
- [Supabase](https://supabase.com) for database, auth, RPCs, storage, and edge functions.
- [Paystack](https://paystack.com) for online token payments.

## Running

Open `QuickAdmissionGH.html` in a browser (keep `banner.png` in the same folder).
Use the tabs at the top to switch between the Student Portal and School Admin; the
Super Admin link sits in the bottom-left corner.

## Configuration

The client uses the Supabase **publishable (anon) key** and the **Paystack public key**,
both of which are intended to be exposed in client-side code. No secret keys are stored
in this repository. Server-side access is protected by Supabase row-level security and
`SECURITY DEFINER` RPCs.

---

Copyright © 2026 VELOXIS TECH HUB. All rights reserved. · Version 1.0
