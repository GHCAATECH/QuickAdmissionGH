-- QuickAdmissionGH production RLS audit
-- Run this in the Supabase SQL Editor before launch.
-- It is read-only and does not change data.

with sensitive_tables(table_name) as (
  values
    ('students'),
    ('placement_list'),
    ('payments'),
    ('tokens'),
    ('profiles'),
    ('schools'),
    ('school_config'),
    ('programmes'),
    ('houses'),
    ('classrooms'),
    ('finance_claims'),
    ('school_sms_templates'),
    ('sms_logs'),
    ('student_verification_sequences'),
    ('student_verification_audit')
),
table_status as (
  select
    st.table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    count(pol.polname) as policy_count
  from sensitive_tables st
  left join pg_class c
    on c.relname = st.table_name
   and c.relnamespace = 'public'::regnamespace
  left join pg_policy pol
    on pol.polrelid = c.oid
  group by st.table_name, c.relrowsecurity, c.relforcerowsecurity
)
select
  'RLS_TABLE_STATUS' as audit_section,
  table_name,
  case
    when rls_enabled is null then 'MISSING_TABLE'
    when rls_enabled is false then 'FAIL_RLS_DISABLED'
    when policy_count = 0 then 'WARN_NO_POLICIES'
    else 'OK'
  end as status,
  coalesce(rls_enabled, false) as rls_enabled,
  coalesce(rls_forced, false) as rls_forced,
  policy_count
from table_status
order by
  case
    when rls_enabled is null then 1
    when rls_enabled is false then 2
    when policy_count = 0 then 3
    else 4
  end,
  table_name;

-- Risky direct table privileges.
-- In production, anon should normally not have direct access to sensitive tables.
select
  'RISKY_TABLE_GRANTS' as audit_section,
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'students',
    'placement_list',
    'payments',
    'tokens',
    'profiles',
    'schools',
    'school_config',
    'programmes',
    'houses',
    'classrooms',
    'finance_claims',
    'school_sms_templates',
    'sms_logs',
    'student_verification_sequences',
    'student_verification_audit'
  )
  and grantee in ('anon', 'authenticated')
  and (
    grantee = 'anon'
    or privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  )
order by table_name, grantee, privilege_type;

-- Security-definer functions exposed to browser roles.
-- Review every row. These must validate the caller internally.
select
  'SECURITY_DEFINER_FUNCTION_GRANTS' as audit_section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  r.rolname as granted_to
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on has_function_privilege(r.oid, p.oid, 'EXECUTE')
where n.nspname = 'public'
  and p.prosecdef = true
  and r.rolname in ('anon', 'authenticated')
order by p.proname, r.rolname;

-- Public storage bucket check.
-- Student document buckets should not be public for live production.
select
  'STORAGE_BUCKET_PUBLIC_STATUS' as audit_section,
  id as bucket_id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in ('enrolment-forms', 'school-docs')
order by id;
