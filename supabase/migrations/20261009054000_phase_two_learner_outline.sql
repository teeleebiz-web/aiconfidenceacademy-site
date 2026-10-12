-- Phase Two protected learner outline.
-- Supplies ONLY journey/lesson metadata and authorized access status.
-- Never returns teaching, AI prompts, project notes, media paths, or signed URLs.
-- Remains inactive until an explicitly configured and activated cohort exists.

create or replace function public.aca_phase_two_my_outline(p_enrollment_id uuid)
returns table (
  lesson_id uuid,
  journey_number integer,
  lesson_number integer,
  page_id text,
  journey_title text,
  lesson_title text,
  planned_media text,
  released_at timestamptz,
  access_status text,
  deadline_at timestamptz,
  remaining_seconds integer
)
language plpgsql stable security definer set search_path=''
as $$
declare
  v_learner uuid := (select auth.uid());
begin
  if v_learner is null then raise exception 'Authentication required'; end if;

  if not exists (
    select 1
    from public.aca_phase_two_memberships m
    join public.enrollments e on e.id=m.enrollment_id
      and e.learner_id=m.learner_id and e.course_id=m.course_id
    join public.courses c on c.id=e.course_id
    join public.aca_phase_two_cohorts coh on coh.id=m.cohort_id and coh.course_id=c.id
    where m.enrollment_id=p_enrollment_id and m.learner_id=v_learner
      and e.status='active' and c.code='phase-two-ai-professional-builder'
      and c.status='published' and coh.status='active'
      and coalesce(e.starts_at,e.enrolled_at)<=now()
      and (e.access_expires_at is null or e.access_expires_at>now())
      and coh.iana_timezone is not null and coh.starts_monday is not null
      and coh.release_local_time is not null
  ) then
    raise exception 'This Phase Two learning home is unavailable';
  end if;

  return query
  select l.id, j.journey_number::integer, l.journey_position::integer,
    l.page_id,j.title,l.title,l.content->>'planned_media',
    s.released_at,s.access_status,s.deadline_at,s.remaining_seconds
  from public.aca_phase_two_memberships m
  join public.course_journeys j on j.course_id=m.course_id and j.status='published'
  join public.lessons l on l.journey_id=j.id
    and l.course_id=j.course_id and l.status='published'
  cross join lateral public.aca_phase_two_access_status(p_enrollment_id,l.id) s
  where m.enrollment_id=p_enrollment_id and m.learner_id=v_learner
    and j.journey_number between 1 and 6
    and l.journey_position between 1 and 6
  order by j.journey_number,l.journey_position;
end;
$$;
revoke all on function public.aca_phase_two_my_outline(uuid) from public,anon,authenticated;
grant execute on function public.aca_phase_two_my_outline(uuid) to authenticated;
