-- Destructive reset for Supabase project:
-- https://rmbghqklbxobtmbcttto.supabase.co
--
-- Run this in the Supabase SQL Editor for that project only.
-- This clears public tables, views, functions, triggers, RLS policies,
-- and custom storage policies.
--
-- Supabase blocks direct SQL deletion from storage.objects/storage.buckets.
-- Delete storage files and buckets from the Supabase Dashboard:
-- Storage > each bucket > empty/delete bucket.
--
-- This does not delete Supabase Auth users. If you also want auth users
-- cleared, do that from Authentication > Users or with a privileged admin
-- script using the service role key.

begin;

-- Drop custom storage policies so new bucket policies can start clean.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename in ('objects', 'buckets')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

-- Drop every app object in public, including tables, views, functions,
-- triggers, RLS policies, and dependent objects.
drop schema if exists public cascade;
create schema public;

-- Restore standard Supabase/public permissions.
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to postgres, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to postgres, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;

-- Common extensions used by new Supabase apps.
create extension if not exists pgcrypto with schema extensions;

commit;
