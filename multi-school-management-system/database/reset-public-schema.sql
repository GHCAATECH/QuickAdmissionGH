-- Fresh reset for this new Multi-School Management System project.
-- Run this only when you want to remove the current app schema and start over.
-- It drops all public tables, functions, triggers, RLS policies, and dependencies.
--
-- This does not delete Supabase Auth users or Storage files/buckets.

begin;

drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to postgres, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to postgres, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;

create extension if not exists pgcrypto with schema extensions;

commit;
