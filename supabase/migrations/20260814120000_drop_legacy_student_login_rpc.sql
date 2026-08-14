-- Student authentication is handled by the rate-limited student-login Edge
-- Function. The old database RPC is unused and must not remain as a second
-- authentication surface.
drop function if exists public.student_login(text, text, uuid);
