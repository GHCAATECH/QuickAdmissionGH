alter table public.school_config
  add column if not exists allow_passport_photo boolean not null default false,
  add column if not exists allow_house_selection boolean not null default false,
  add column if not exists allow_class_selection boolean not null default true,
  add column if not exists force_enrolment_upload boolean not null default true;

