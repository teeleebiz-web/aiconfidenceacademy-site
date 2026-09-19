create schema if not exists private;

alter table public.lesson_access_windows
  add column if not exists closed_at timestamptz;

insert into public.lesson_access_windows (
  enrollment_id,
  learner_id,
  course_id,
  lesson_id,
  started_at,
  last_seen_at,
  active_seconds,
  status,
  completed_at,
  closed_at,
  created_at,
  updated_at
)
select
  lp.enrollment_id,
  lp.learner_id,
  lp.course_id,
  lp.lesson_id,
  coalesce(lp.started_at, lp.created_at),
  coalesce(lp.completed_at, lp.updated_at),
  0,
  'completed',
  coalesce(lp.completed_at, lp.updated_at),
  coalesce(lp.completed_at, lp.updated_at),
  lp.created_at,
  lp.updated_at
from public.lesson_progress lp
where lp.status = 'completed'
on conflict (enrollment_id, lesson_id) do update
set status = 'completed',
    completed_at = coalesce(public.lesson_access_windows.completed_at, excluded.completed_at),
    closed_at = coalesce(public.lesson_access_windows.closed_at, excluded.closed_at),
    updated_at = greatest(public.lesson_access_windows.updated_at, excluded.updated_at);

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
    and w.status in ('completed', 'expired');

  select
    l.id,
    l.journey_id,
    l.course_position,
    l.unlock_offset_days,
    w.status as window_status,
    coalesce(w.active_seconds, 0) as used_seconds
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
    and coalesce(w.status, 'not_started') not in ('completed', 'expired')
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
     and w.status in ('completed', 'expired')
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

  select coalesce(w.closed_at, w.completed_at, w.updated_at)
  into v_previous_closed_at
  from public.lessons l
  join public.lesson_access_windows w
    on w.enrollment_id = v_enrollment.id
   and w.lesson_id = l.id
   and w.status in ('completed', 'expired')
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
        w.status in ('completed', 'expired')
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

create or replace function public.get_learner_lesson_access(
  p_enrollment_id uuid
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
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  return query
  select state.*
  from private.lesson_access_state(
    p_enrollment_id,
    (select auth.uid()),
    now()
  ) state;
end;
$$;

revoke all on function public.get_learner_lesson_access(uuid) from public, anon;
grant execute on function public.get_learner_lesson_access(uuid) to authenticated;

create or replace function public.get_enrollment_lesson_access(
  p_enrollment_id uuid,
  p_at timestamptz default now()
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
  v_learner_id uuid;
begin
  select e.learner_id
  into v_learner_id
  from public.enrollments e
  where e.id = p_enrollment_id;

  if v_learner_id is null then
    return;
  end if;

  return query
  select state.*
  from private.lesson_access_state(p_enrollment_id, v_learner_id, p_at) state;
end;
$$;

revoke all on function public.get_enrollment_lesson_access(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_enrollment_lesson_access(uuid, timestamptz)
  to service_role;

create or replace function private.learner_can_view_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    cross join lateral private.lesson_access_state(
      e.id,
      (select auth.uid()),
      now()
    ) state
    where e.learner_id = (select auth.uid())
      and state.current_lesson_id = p_lesson_id
      and state.access_status in ('available', 'active')
  );
$$;

create or replace function private.learner_can_view_journey(p_journey_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    cross join lateral private.lesson_access_state(
      e.id,
      (select auth.uid()),
      now()
    ) state
    where e.learner_id = (select auth.uid())
      and state.current_journey_id = p_journey_id
      and state.access_status in ('available', 'active')
  );
$$;

revoke all on function private.learner_can_view_lesson(uuid)
  from public, anon;
revoke all on function private.learner_can_view_journey(uuid)
  from public, anon;
grant execute on function private.learner_can_view_lesson(uuid) to authenticated;
grant execute on function private.learner_can_view_journey(uuid) to authenticated;

drop policy if exists "Learners can view unlocked lessons" on public.lessons;
create policy "Learners can view only their current lesson"
on public.lessons for select to authenticated
using (
  status = 'published'
  and (select private.learner_can_view_lesson(id))
);

drop policy if exists "Learners can view accessible journeys" on public.course_journeys;
create policy "Learners can view only their current journey"
on public.course_journeys for select to authenticated
using (
  status = 'published'
  and (select private.learner_can_view_journey(id))
);

drop policy if exists "Learners can view introductions for enrolled journeys"
  on public.journey_introductions;
create policy "Learners can view only their current journey introduction"
on public.journey_introductions for select to authenticated
using (
  status = 'published'
  and (select private.learner_can_view_journey(journey_id))
);

drop policy if exists "Learners can create progress for unlocked lessons"
  on public.lesson_progress;
create policy "Learners create progress only for their current lesson"
on public.lesson_progress for insert to authenticated
with check (
  learner_id = (select auth.uid())
  and (select private.learner_can_view_lesson(lesson_id))
  and exists (
    select 1
    from public.enrollments e
    where e.id = enrollment_id
      and e.learner_id = (select auth.uid())
      and e.course_id = course_id
      and e.status in ('active', 'completed')
  )
);

drop policy if exists "Learners can update progress for unlocked lessons"
  on public.lesson_progress;
create policy "Learners update progress only for their current lesson"
on public.lesson_progress for update to authenticated
using (learner_id = (select auth.uid()))
with check (
  learner_id = (select auth.uid())
  and (select private.learner_can_view_lesson(lesson_id))
  and exists (
    select 1
    from public.enrollments e
    where e.id = enrollment_id
      and e.learner_id = (select auth.uid())
      and e.course_id = course_id
      and e.status in ('active', 'completed')
  )
);

revoke insert, update, delete on public.lesson_access_windows from authenticated;
drop policy if exists "Learners start their lesson clocks" on public.lesson_access_windows;
drop policy if exists "Learners update their lesson clocks" on public.lesson_access_windows;

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
    greatest(0, 7200 - v_window.active_seconds),
    null::timestamptz,
    false,
    null::timestamptz;
end;
$$;

create or replace function public.heartbeat_lesson_access(
  p_enrollment_id uuid,
  p_lesson_id uuid
)
returns table (
  access_status text,
  active_seconds integer,
  remaining_seconds integer
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
  v_delta integer;
  v_next_seconds integer;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select state.*
  into v_state
  from private.lesson_access_state(p_enrollment_id, v_user, v_now) state;

  if not found
     or v_state.current_lesson_id is distinct from p_lesson_id
     or v_state.access_status <> 'active' then
    raise exception 'This lesson session is not active';
  end if;

  select *
  into v_window
  from public.lesson_access_windows w
  where w.enrollment_id = p_enrollment_id
    and w.lesson_id = p_lesson_id
    and w.learner_id = v_user
  for update;

  if not found or v_window.status <> 'active' then
    raise exception 'This lesson session is closed';
  end if;

  v_delta := least(
    45,
    greatest(0, extract(epoch from (v_now - v_window.last_seen_at))::integer)
  );
  v_next_seconds := least(7200, v_window.active_seconds + v_delta);

  update public.lesson_access_windows
  set active_seconds = v_next_seconds,
      last_seen_at = v_now,
      status = case when v_next_seconds >= 7200 then 'expired' else 'active' end,
      closed_at = case when v_next_seconds >= 7200 then v_now else closed_at end,
      updated_at = v_now
  where id = v_window.id
  returning * into v_window;

  return query select
    v_window.status,
    v_window.active_seconds,
    greatest(0, 7200 - v_window.active_seconds);
end;
$$;

create or replace function public.complete_lesson_access(
  p_enrollment_id uuid,
  p_lesson_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_now timestamptz := now();
  v_state record;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select state.*
  into v_state
  from private.lesson_access_state(p_enrollment_id, v_user, v_now) state;

  if not found
     or v_state.current_lesson_id is distinct from p_lesson_id
     or v_state.access_status <> 'active' then
    raise exception 'This lesson session is not active';
  end if;

  if not exists (
    select 1
    from public.lesson_progress lp
    where lp.enrollment_id = p_enrollment_id
      and lp.lesson_id = p_lesson_id
      and lp.learner_id = v_user
      and lp.status = 'completed'
      and lp.artifact_saved = true
      and lp.required_revision_completed = true
  ) then
    raise exception 'Complete and save the lesson evidence before closing the lesson';
  end if;

  update public.lesson_access_windows
  set status = 'completed',
      completed_at = v_now,
      closed_at = v_now,
      updated_at = v_now
  where enrollment_id = p_enrollment_id
    and lesson_id = p_lesson_id
    and learner_id = v_user
    and status = 'active';

  if not found then
    raise exception 'This lesson session is closed';
  end if;
end;
$$;

revoke all on function public.touch_lesson_access(uuid, uuid) from public, anon;
revoke all on function public.heartbeat_lesson_access(uuid, uuid) from public, anon;
revoke all on function public.complete_lesson_access(uuid, uuid) from public, anon;
grant execute on function public.touch_lesson_access(uuid, uuid) to authenticated;
grant execute on function public.heartbeat_lesson_access(uuid, uuid) to authenticated;
grant execute on function public.complete_lesson_access(uuid, uuid) to authenticated;
