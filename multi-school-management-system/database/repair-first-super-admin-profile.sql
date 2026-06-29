-- Repair the first Super Admin profile when the Auth user was created before
-- the public.profiles trigger existed, or when profile RLS policies are
-- blocking the browser from reading the row.
--
-- Run this in the Supabase SQL Editor for project rmbghqklbxobtmbcttto.

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;

alter table public.profiles enable row level security;

drop policy if exists "users view own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "super and school admin manage profiles" on public.profiles;
drop policy if exists "authenticated can create own profile" on public.profiles;

create policy "users view own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "users update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "authenticated can create own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

insert into public.profiles (id, email, full_name, role, status)
values (
  'a6107712-8e5f-4314-a542-ab3bf75154f1',
  'livingclement13@gmail.com',
  'livingclement13@gmail.com',
  'Super Admin',
  'Active'
)
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = 'Super Admin',
  status = 'Active',
  updated_at = now();

select id, email, role, status
from public.profiles
where id = 'a6107712-8e5f-4314-a542-ab3bf75154f1';
