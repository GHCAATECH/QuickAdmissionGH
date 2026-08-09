-- All browser writes to core school data must pass through validated RPCs or
-- Edge Functions. Service-role backend calls keep their existing access.
revoke insert, update, delete on table public.students from anon, authenticated;
revoke insert, update, delete on table public.placement_list from anon, authenticated;
revoke insert, update, delete on table public.school_config from anon, authenticated;
revoke insert, update, delete on table public.programmes from anon, authenticated;
revoke insert, update, delete on table public.classrooms from anon, authenticated;
revoke insert, update, delete on table public.houses from anon, authenticated;
