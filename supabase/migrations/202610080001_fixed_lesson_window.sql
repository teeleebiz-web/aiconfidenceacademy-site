-- Preserve released workbook access while enforcing a fixed lesson deadline.
create or replace function private.effective_lesson_status(p_status text, p_started timestamptz, p_at timestamptz)
returns text language sql immutable set search_path='' as $$
select case when p_status='active' and p_started + interval '2 hours' <= p_at then 'expired' else p_status end;
$$;
revoke all on function private.effective_lesson_status(text,timestamptz,timestamptz) from public,anon,authenticated;
create or replace function private.lesson_access_state(
  p_enrollment_id uuid,
  p_learner_id uuid,
  p_at timestamptz
)
returns table (
  current_lesson_id uuid,
  current_journey_id uuid,
  access_status text,
  available_at timestamptz,
  active_seconds integer,
  remaining_seconds integer,
  completed_lessons integer,
  total_lessons integer,
  released_lesson_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enrollment public.enrollments%rowtype;
  v_course_status text;
  v_current record;
  v_previous_closed_at timestamptz;
  v_available_at timestamptz;
  v_access_status text;
  v_completed integer := 0;
  v_total integer := 0;
  v_released uuid[] := '{}'::uuid[];
begin
  select e.*
  into v_enrollment
  from public.enrollments e
  where e.id = p_enrollment_id
    and e.learner_id = p_learner_id
    and e.status in ('active', 'completed');

  if not found then
    return;
  end if;

  select c.status
  into v_course_status
  from public.courses c
  where c.id = v_enrollment.course_id;

  if v_course_status is distinct from 'published'
     or coalesce(v_enrollment.starts_at, v_enrollment.enrolled_at) > p_at then
    return;
  end if;

  select count(*)::integer
  into v_total
  from public.lessons l
  join public.course_journeys j
    on j.id = l.journey_id
   and j.course_id = l.course_id
  where l.course_id = v_enrollment.course_id
    and l.status = 'published'
    and j.status = 'published';

  select count(*)::integer
  into v_completed
  from public.lessons l
  join public.course_journeys j
    on j.id = l.journey_id
   and j.course_id = l.course_id
  join public.lesson_access_windows w
    on w.enrollment_id = v_enrollment.id
   and w.lesson_id = l.id
  where l.course_id = v_enrollment.course_id
    and l.status = 'published'
    and j.status = 'published'
    and private.effective_lesson_status(w.status, w.started_at, p_at) in ('completed', 'expired');

  select
    l.id,
    l.journey_id,
    l.course_position,
    l.unlock_offset_days,
    w.status as window_status,
    case when w.started_at is null then 0 else least(7200, greatest(0, floor(extract(epoch from (p_at - w.started_at)))::integer)) end as used_seconds
  into v_current
  from public.lessons l
  join public.course_journeys j
    on j.id = l.journey_id
   and j.course_id = l.course_id
  left join public.lesson_access_windows w
    on w.enrollment_id = v_enrollment.id
   and w.lesson_id = l.id
  where l.course_id = v_enrollment.course_id
    and l.status = 'published'
    and j.status = 'published'
    and private.effective_lesson_status(coalesce(w.status, 'not_started'), w.started_at, p_at) not in ('completed', 'expired')
  order by l.course_position
  limit 1;

  if not found then
    select coalesce(array_agg(l.id order by l.course_position), '{}'::uuid[])
    into v_released
    from public.lessons l
    join public.course_journeys j
      on j.id = l.journey_id
     and j.course_id = l.course_id
    join public.lesson_access_windows w
      on w.enrollment_id = v_enrollment.id
     and w.lesson_id = l.id
     and private.effective_lesson_status(w.status, w.started_at, p_at) in ('completed', 'expired')
    where l.course_id = v_enrollment.course_id
      and l.status = 'published'
      and j.status = 'published';

    return query select
      null::uuid,
      null::uuid,
      'course_completed'::text,
      null::timestamptz,
      0,
      0,
      v_total,
      v_total,
      v_released;
    return;
  end if;

  select case when w.status = 'active' then w.started_at + interval '2 hours' else coalesce(w.closed_at, w.completed_at, w.updated_at) end
  into v_previous_closed_at
  from public.lessons l
  join public.lesson_access_windows w
    on w.enrollment_id = v_enrollment.id
   and w.lesson_id = l.id
   and private.effective_lesson_status(w.status, w.started_at, p_at) in ('completed', 'expired')
  where l.course_id = v_enrollment.course_id
    and l.course_position < v_current.course_position
  order by l.course_position desc
  limit 1;

  v_available_at := coalesce(v_enrollment.starts_at, v_enrollment.enrolled_at)
    + make_interval(days => greatest(0, v_current.unlock_offset_days));

  if v_previous_closed_at is not null then
    v_available_at := greatest(v_available_at, v_previous_closed_at + interval '1 day');
  end if;

  if v_enrollment.access_expires_at is not null
     and v_enrollment.access_expires_at <= p_at then
    v_access_status := 'access_ended';
  elsif v_current.window_status = 'active' then
    v_access_status := 'active';
  elsif p_at >= v_available_at then
    v_access_status := 'available';
  else
    v_access_status := 'scheduled';
  end if;

  select coalesce(array_agg(released.id order by released.course_position), '{}'::uuid[])
  into v_released
  from (
    select l.id, l.course_position
    from public.lessons l
    join public.course_journeys j
      on j.id = l.journey_id
     and j.course_id = l.course_id
    left join public.lesson_access_windows w
      on w.enrollment_id = v_enrollment.id
     and w.lesson_id = l.id
    where l.course_id = v_enrollment.course_id
      and l.status = 'published'
      and j.status = 'published'
      and (
        private.effective_lesson_status(w.status, w.started_at, p_at) in ('completed', 'expired')
        or (
          l.id = v_current.id
          and (v_current.window_status = 'active' or p_at >= v_available_at)
        )
      )
  ) released;

  return query select
    v_current.id::uuid,
    v_current.journey_id::uuid,
    v_access_status,
    v_available_at,
    v_current.used_seconds::integer,
    greatest(0, 7200 - v_current.used_seconds)::integer,
    v_completed,
    v_total,
    v_released;
end;
$$;

revoke all on function private.lesson_access_state(uuid, uuid, timestamptz)
  from public, anon, authenticated;

create or replace function public.touch_lesson_access(
  p_enrollment_id uuid,
  p_lesson_id uuid
)
returns table (
  access_status text,
  active_seconds integer,
  remaining_seconds integer,
  hard_expires_at timestamptz,
  recovery_used boolean,
  recovery_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_now timestamptz := now();
  v_state record;
  v_window public.lesson_access_windows%rowtype;
  v_course_id uuid;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select state.*
  into v_state
  from private.lesson_access_state(p_enrollment_id, v_user, v_now) state;

  if not found
     or v_state.current_lesson_id is distinct from p_lesson_id
     or v_state.access_status not in ('available', 'active') then
    raise exception 'This lesson is not available for this enrollment';
  end if;

  select e.course_id
  into v_course_id
  from public.enrollments e
  where e.id = p_enrollment_id
    and e.learner_id = v_user;

  insert into public.lesson_access_windows (
    enrollment_id,
    learner_id,
    course_id,
    lesson_id,
    started_at,
    last_seen_at
  ) values (
    p_enrollment_id,
    v_user,
    v_course_id,
    p_lesson_id,
    v_now,
    v_now
  )
  on conflict (enrollment_id, lesson_id) do nothing;

  update public.lesson_access_windows
  set last_seen_at = v_now,
      updated_at = v_now
  where enrollment_id = p_enrollment_id
    and lesson_id = p_lesson_id
    and learner_id = v_user
    and status = 'active'
  returning * into v_window;

  if not found then
    raise exception 'This lesson session is closed';
  end if;

  return query select
    v_window.status,
    v_window.active_seconds,
    greatest(0, floor(extract(epoch from (v_window.started_at + interval '2 hours' - v_now)))::integer),
    v_window.started_at + interval '2 hours',
    false,
    null::timestamptz;
end;
$$;


create or replace function public.heartbeat_lesson_access(p_enrollment_id uuid,p_lesson_id uuid)
returns table(access_status text,active_seconds integer,remaining_seconds integer)
language plpgsql security definer set search_path='' as $$
declare w public.lesson_access_windows%rowtype; used integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into w from public.lesson_access_windows a where a.enrollment_id=p_enrollment_id and a.lesson_id=p_lesson_id and a.learner_id=auth.uid() for update;
 if not found then raise exception 'This lesson session is closed'; end if;
 if not exists(select 1 from public.enrollments e where e.id=p_enrollment_id and e.learner_id=auth.uid() and e.status in ('active','completed') and (e.access_expires_at is null or e.access_expires_at>now())) then
   raise exception 'This lesson session is closed';
 end if;
 used:=least(7200,greatest(0,floor(extract(epoch from (now()-w.started_at)))::integer));
 if w.status='active' then
   update public.lesson_access_windows a set active_seconds=used,last_seen_at=now(),updated_at=now(),
     status=case when used>=7200 then 'expired' else 'active' end,
     closed_at=case when used>=7200 then w.started_at+interval '2 hours' else a.closed_at end
   where a.id=w.id returning * into w;
 end if;
 return query select w.status,used,case when w.status='active' then 7200-used else 0 end;
end; $$;
revoke all on function public.heartbeat_lesson_access(uuid,uuid) from public,anon;
grant execute on function public.heartbeat_lesson_access(uuid,uuid) to authenticated;

-- Metadata only: this entrance never returns lesson teaching or media paths.
create or replace function public.get_learner_workbooks(p_enrollment_id uuid)
returns table(page_id text,title text) language sql stable security definer set search_path='' as $$
 select l.page_id,l.title from private.lesson_access_state(p_enrollment_id,auth.uid(),now()) s
 join public.lessons l on l.id=any(s.released_lesson_ids) order by l.course_position;
$$;
revoke all on function public.get_learner_workbooks(uuid) from public,anon;
grant execute on function public.get_learner_workbooks(uuid) to authenticated;
