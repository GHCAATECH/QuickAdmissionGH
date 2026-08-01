-- Keep the public admission directory and admin configuration reads compatible
-- with the school's helpdesk contact.
alter table public.school_config
  add column if not exists helpdesk_line text;

update public.school_config as config
set helpdesk_line = nullif(btrim(coalesce(school.helpdesk, school.phone, '')), '')
from public.schools as school
where school.id = config.school_id
  and nullif(btrim(coalesce(config.helpdesk_line, '')), '') is null
  and nullif(btrim(coalesce(school.helpdesk, school.phone, '')), '') is not null;
