create schema if not exists private;

create or replace function private.refresh_aca_course_completion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_required_count integer;
  v_completed_count integer;
begin
  if new.status <> 'completed' then
    return new;
  end if;

  select count(*)
  into v_required_count
  from public.lessons l
  where l.course_id = new.course_id
    and l.status = 'published'
    and l.is_required = true;

  select count(distinct lp.lesson_id)
  into v_completed_count
  from public.lesson_progress lp
  join public.lessons l
    on l.id = lp.lesson_id
   and l.course_id = lp.course_id
  where lp.enrollment_id = new.enrollment_id
    and lp.learner_id = new.learner_id
    and lp.course_id = new.course_id
    and lp.status = 'completed'
    and l.status = 'published'
    and l.is_required = true;

  if v_required_count > 0 and v_completed_count = v_required_count then
    update public.enrollments e
    set status = 'completed',
        completed_at = coalesce(e.completed_at, now()),
        updated_at = now()
    where e.id = new.enrollment_id
      and e.learner_id = new.learner_id
      and e.course_id = new.course_id
      and e.status = 'active';
  end if;

  return new;
end;
$$;

revoke all on function private.refresh_aca_course_completion() from public, anon, authenticated;

drop trigger if exists refresh_aca_course_completion_after_progress on public.lesson_progress;
create trigger refresh_aca_course_completion_after_progress
after insert or update of status on public.lesson_progress
for each row
execute function private.refresh_aca_course_completion();
