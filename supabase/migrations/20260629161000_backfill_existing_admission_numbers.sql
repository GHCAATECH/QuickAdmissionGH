with student_base as (
  select
    s.id,
    s.school_id,
    coalesce(s.submitted_at, s.created_at, now()) as sort_at,
    coalesce(
      nullif(regexp_replace(coalesce(sc.admission_year::text, ''), '[^0-9]', '', 'g'), ''),
      substring(coalesce(sc.academic_year, '') from '([0-9]{4})'),
      to_char(coalesce(s.submitted_at, s.created_at, now()), 'YYYY')
    ) as admission_year_raw,
    coalesce(
      nullif(btrim(s.full_name), ''),
      nullif(btrim(s.records ->> 'full_name'), ''),
      nullif(btrim(s.records ->> 'student_name'), ''),
      nullif(btrim(s.records ->> 'surname'), ''),
      'Student'
    ) as full_name_source,
    p.code as programme_code_raw,
    p.name as programme_name,
    pl.programme as placement_programme
  from public.students s
  left join public.school_config sc
    on sc.school_id = s.school_id
  left join public.programmes p
    on p.id = s.programme_id
  left join public.placement_list pl
    on pl.school_id = s.school_id
   and pl.index_number = s.bece_index
  where s.submitted_at is not null
     or nullif(btrim(coalesce(s.admission_no, '')), '') is not null
),
normalized as (
  select
    sb.id,
    sb.school_id,
    left(coalesce(nullif(sb.admission_year_raw, ''), to_char(sb.sort_at, 'YYYY')), 4) as admission_year_text,
    sb.sort_at,
    left(
      coalesce(
        nullif(
          regexp_replace(
            (
              select coalesce(string_agg(left(part, 1), '' order by ord), '')
              from regexp_split_to_table(upper(sb.full_name_source), '[^A-Z0-9]+') with ordinality as parts(part, ord)
              where btrim(part) <> ''
            ),
            '[^A-Z0-9]+',
            '',
            'g'
          ),
          ''
        ),
        nullif(upper(left(regexp_replace(sb.full_name_source, '[^A-Za-z0-9]+', '', 'g'), 4)), ''),
        'STU'
      ),
      6
    ) as name_initials,
    left(
      coalesce(
        nullif(upper(regexp_replace(coalesce(sb.programme_code_raw, ''), '[^A-Z0-9]+', '', 'g')), ''),
        nullif(
          upper(
            regexp_replace(
              (
                select coalesce(string_agg(left(part, 1), ''), '')
                from regexp_split_to_table(
                  upper(coalesce(nullif(btrim(sb.programme_name), ''), nullif(btrim(sb.placement_programme), ''), 'GENERAL')),
                  '\s+'
                ) as part
                where btrim(part) <> ''
              ),
              '[^A-Z0-9]+',
              '',
              'g'
            )
          ),
          ''
        ),
        nullif(
          upper(
            left(
              regexp_replace(coalesce(nullif(btrim(sb.programme_name), ''), nullif(btrim(sb.placement_programme), ''), 'GENERAL'), '[^A-Za-z0-9]+', '', 'g'),
              6
            )
          ),
          ''
        ),
        'GEN'
      ),
      11
    ) as programme_code
  from student_base sb
),
ranked as (
  select
    n.id,
    n.name_initials || '/' || n.programme_code || '/' || n.admission_year_text || '/' ||
      lpad(row_number() over (
        partition by n.school_id, n.admission_year_text
        order by n.sort_at, n.id
      )::text, 4, '0') as new_admission_no
  from normalized n
)
update public.students s
set admission_no = r.new_admission_no
from ranked r
where s.id = r.id;
