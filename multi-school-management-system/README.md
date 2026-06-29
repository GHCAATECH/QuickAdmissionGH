# Multi-School Management System

Fresh HTML/CSS/JavaScript + Supabase build for a multi-school platform.

## Stack

- HTML5, CSS3, JavaScript modules
- Bootstrap 5, AdminLTE, DataTables, SweetAlert2, Font Awesome
- Supabase Auth, PostgreSQL, Storage, Row Level Security

## Supabase Project

- URL: `https://rmbghqklbxobtmbcttto.supabase.co`
- Browser publishable key: configured in `assets/js/config/supabase.js`
- Never put the service role key in frontend files.

## Fresh Database Setup

Run these in Supabase SQL Editor in this order:

1. `database/reset-public-schema.sql` only if you want to wipe the current app schema.
2. `database/schema.sql`
3. `database/rls-policies.sql`
4. `database/workflow-enhancements.sql`
5. `database/create-storage-buckets.sql`
6. Create your first Super Admin in Supabase Authentication.
7. Run `database/repair-first-super-admin-profile.sql` after updating the email/user ID if needed.

## Edge Function Setup

The Super Admin Users module creates school admins and staff through the
`create-user` Edge Function. Deploy from the repo root:

```powershell
cd C:\Users\cleme\Downloads\QuickAdmissionGH-repo
npx supabase@latest functions deploy create-user --project-ref rmbghqklbxobtmbcttto
```

Set the service role key as a Supabase secret. The name must be `SERVICE_ROLE_KEY`.

```powershell
npx supabase@latest secrets set SERVICE_ROLE_KEY=your-real-service-role-key --project-ref rmbghqklbxobtmbcttto
```

## Local Preview

Run the local server from:

```powershell
cd C:\Users\cleme\Downloads\QuickAdmissionGH-repo\multi-school-management-system
python -m http.server 8080
```

Open:

```text
http://127.0.0.1:8080/public/login.html
```

## Portals

- Super Admin: `/public/super-admin/index.html`
- School Admin: `/public/school-admin/index.html`
- Management Staff: `/public/management/index.html`
- House Staff: `/public/house/index.html`
- Teaching Staff: `/public/staff/index.html`
- Non-Teaching Staff: `/public/non-teaching/index.html`
- Student: `/public/student/index.html`
