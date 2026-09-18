create table if not exists public.lesson_access_windows (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active_seconds integer not null default 0 check (active_seconds between 0 and 5400),
  hard_expires_at timestamptz not null default (now() + interval '24 hours'),
  recovery_used boolean not null default false,
  recovery_expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'expired')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, lesson_id)
);

create index if not exists lesson_access_windows_learner_idx
  on public.lesson_access_windows (learner_id, status);
create index if not exists lesson_access_windows_course_idx
  on public.lesson_access_windows (course_id);
create index if not exists lesson_access_windows_lesson_idx
  on public.lesson_access_windows (lesson_id);

alter table public.lesson_access_windows enable row level security;
revoke all on public.lesson_access_windows from public, anon;
grant select, insert, update on public.lesson_access_windows to authenticated;

create policy "Learners read their lesson clocks"
on public.lesson_access_windows for select to authenticated
using ((select auth.uid()) = learner_id);

create policy "Learners start their lesson clocks"
on public.lesson_access_windows for insert to authenticated
with check (
  (select auth.uid()) = learner_id
  and exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id
      and e.learner_id = (select auth.uid())
      and e.status in ('active', 'completed')
      and (e.starts_at is null or e.starts_at <= now())
      and (e.access_expires_at is null or e.access_expires_at > now())
  )
);

create policy "Learners update their lesson clocks"
on public.lesson_access_windows for update to authenticated
using ((select auth.uid()) = learner_id)
with check ((select auth.uid()) = learner_id);

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
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_now timestamptz := now();
  v_window public.lesson_access_windows%rowtype;
  v_course_id uuid;
  v_delta integer;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select e.course_id into v_course_id
  from public.enrollments e
  join public.lessons l on l.course_id = e.course_id and l.id = p_lesson_id
  where e.id = p_enrollment_id
    and e.learner_id = v_user
    and e.status in ('active', 'completed')
    and l.status = 'published'
    and (e.starts_at is null or e.starts_at <= v_now)
    and (e.access_expires_at is null or e.access_expires_at > v_now);

  if v_course_id is null then
    raise exception 'This lesson is not available for this enrollment';
  end if;

  select * into v_window
  from public.lesson_access_windows w
  where w.enrollment_id = p_enrollment_id and w.lesson_id = p_lesson_id
  for update;

  if not found then
    insert into public.lesson_access_windows (
      enrollment_id, learner_id, course_id, lesson_id
    ) values (
      p_enrollment_id, v_user, v_course_id, p_lesson_id
    ) returning * into v_window;
  elsif v_window.status = 'active' then
    if v_now > coalesce(v_window.recovery_expires_at, v_window.hard_expires_at) then
      if not v_window.recovery_used then
        update public.lesson_access_windows
        set recovery_used = true,
            recovery_expires_at = v_now + interval '2 hours',
            last_seen_at = v_now,
            updated_at = v_now
        where id = v_window.id
        returning * into v_window;
      else
        update public.lesson_access_windows
        set status = 'expired', updated_at = v_now
        where id = v_window.id
        returning * into v_window;
      end if;
    else
      v_delta := least(45, greatest(0, extract(epoch from (v_now - v_window.last_seen_at))::integer));
      update public.lesson_access_windows
      set active_seconds = least(5400, active_seconds + v_delta),
          last_seen_at = v_now,
          status = case when active_seconds + v_delta >= 5400 then 'expired' else status end,
          updated_at = v_now
      where id = v_window.id
      returning * into v_window;
    end if;
  end if;

  return query select
    v_window.status,
    v_window.active_seconds,
    greatest(0, 5400 - v_window.active_seconds),
    v_window.hard_expires_at,
    v_window.recovery_used,
    v_window.recovery_expires_at;
end;
$$;

create or replace function public.complete_lesson_access(
  p_enrollment_id uuid,
  p_lesson_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.lesson_access_windows
  set status = 'completed', completed_at = now(), updated_at = now()
  where enrollment_id = p_enrollment_id
    and lesson_id = p_lesson_id
    and learner_id = (select auth.uid());
$$;

revoke all on function public.touch_lesson_access(uuid, uuid) from public, anon;
revoke all on function public.complete_lesson_access(uuid, uuid) from public, anon;
grant execute on function public.touch_lesson_access(uuid, uuid) to authenticated;
grant execute on function public.complete_lesson_access(uuid, uuid) to authenticated;
