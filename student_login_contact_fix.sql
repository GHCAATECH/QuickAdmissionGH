-- Fix for public.student_login returning the wrong phone number in student.contact
--
-- Problem seen in live data:
-- - public.student_login('010113408225', 'ASC4ZLZL', '394a5bf5-9b7f-4541-81ed-0a37f1b5b44a')
--   returns student.contact = school.phone
-- - The student dashboard should show the school-managed student SMS contact instead.
--
-- Expected contact precedence:
-- 1. students.records ->> 'sms_contact'
-- 2. students.parent_phone
-- 3. placement_list.sms_contact
-- 4. NULL
--
-- Do NOT fall back to:
-- - schools.phone
-- - schools.helpdesk
-- - payment metadata phone
-- - payer phone from payment verification

-- 1) Inspect the live source fields for the affected student
select
  s.school_id,
  s.bece_index,
  s.full_name,
  s.parent_phone,
  s.records ->> 'sms_contact' as records_sms_contact,
  pl.sms_contact as placement_sms_contact,
  sch.phone as school_phone,
  sch.helpdesk as school_helpdesk
from public.students s
left join public.placement_list pl
  on pl.school_id = s.school_id
 and pl.index_number = s.bece_index
left join public.schools sch
  on sch.id = s.school_id
where s.school_id = '394a5bf5-9b7f-4541-81ed-0a37f1b5b44a'::uuid
  and s.bece_index = '010113408225';

-- 2) Open the existing function body:
-- select pg_get_functiondef('public.student_login(text, text, uuid)'::regprocedure);
--
-- In the jsonb_build_object(...) for the returned "student" object,
-- replace the current "contact" value with this exact expression:
--
--   'contact',
--   coalesce(
--     nullif(btrim(stu.records ->> 'sms_contact'), ''),
--     nullif(btrim(stu.parent_phone), ''),
--     nullif(btrim(pl.sms_contact), ''),
--     null
--   ),
--
-- Keep the rest of the function unchanged.
--
-- If your function uses different aliases, map them like this:
-- - stu = public.students row
-- - pl  = public.placement_list row

-- 3) Example fragment for the student JSON object
--    Use only the contact line if you already have the function body open.
--
-- jsonb_build_object(
--   'class', cls.name,
--   'house', hs.name,
--   'index', stu.bece_index,
--   'gender', coalesce(stu.gender, pl.gender),
--   'contact', coalesce(
--     nullif(btrim(stu.records ->> 'sms_contact'), ''),
--     nullif(btrim(stu.parent_phone), ''),
--     nullif(btrim(pl.sms_contact), ''),
--     null
--   ),
--   'records', stu.records,
--   'surname', coalesce(stu.full_name, pl.student_name),
--   'class_id', stu.class_id,
--   'aggregate', pl.aggregate,
--   'full_name', coalesce(stu.full_name, pl.student_name),
--   'programme', coalesce(pg.name, pl.programme),
--   'school_no', stu.admission_no,
--   'submitted', stu.submitted_at is not null,
--   'other_names', pl.other_names,
--   'residential', pl.residential_status,
--   'programme_id', stu.programme_id,
--   'personal_done', coalesce(stu.personal_done, false),
--   'documents_done', coalesce(stu.documents_done, false),
--   'programme_done', coalesce(stu.programme_done, false),
--   'undertaking_done', coalesce(stu.undertaking_done, false)
-- )

-- 4) Verify after saving the function
select public.student_login(
  '010113408225',
  'ASC4ZLZL',
  '394a5bf5-9b7f-4541-81ed-0a37f1b5b44a'::uuid
);
