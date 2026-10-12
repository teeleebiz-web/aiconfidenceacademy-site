-- Phase Two: independent secure lesson release and media/evidence access gate.
-- Draft-only implementation. No course, cohort, lessons, or membership is activated.
-- The cohort timezone and local release time MUST be explicitly configured.
-- Source: ACA Phase Two Six Week Curriculum Master v2.0, Oct. 4, 2026.

create table if not exists public.aca_phase_two_lesson_windows (
  enrollment_id uuid not null,
  learner_id uuid not null,
  lesson_id uuid not null references public.lessons(id),
  first_opened_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  primary key (enrollment_id, lesson_id),
  constraint aca_phase_two_windows_owner_fk
    foreign key (enrollment_id, learner_id)
    references public.aca_phase_two_memberships(enrollment_id, learner_id),
  constraint aca_phase_two_windows_positive check (deadline_at > first_opened_at)
);
comment on table public.aca_phase_two_lesson_windows is
  'Immutable first weekday opening and two-hour elapsed deadline. A refresh never resets it.';

create table if not exists public.aca_phase_two_access_extensions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  learner_id uuid not null,
  lesson_id uuid not null references public.lessons(id),
  begins_at timestamptz not null,
  ends_at timestamptz not null,
  approved_by uuid not null references auth.users(id),
  justification text not null check (length(btrim(justification)) > 0),
  created_at timestamptz not null default now(),
  constraint aca_phase_two_extensions_positive check (ends_at > begins_at),
  constraint aca_phase_two_extensions_owner_fk
    foreign key (enrollment_id, learner_id)
    references public.aca_phase_two_memberships(enrollment_id, learner_id)
);
comment on table public.aca_phase_two_access_extensions is
  'Administrative extensions only; no learner self-approval, no new seventh lesson.';

create index if not exists aca_phase_two_extensions_lookup
  on public.aca_phase_two_access_extensions(enrollment_id, lesson_id, begins_at, ends_at);

alter table public.aca_phase_two_lesson_windows enable row level security;
alter table public.aca_phase_two_access_extensions enable row level security;

create policy aca_phase_two_read_own_windows on public.aca_phase_two_lesson_windows
for select to authenticated using (
  learner_id = (select auth.uid()) or (select public.is_aca_curriculum_owner())
);
create policy aca_phase_two_read_own_extensions on public.aca_phase_two_access_extensions
for select to authenticated using (
  learner_id = (select auth.uid()) or (select public.is_aca_curriculum_owner())
);

revoke all on public.aca_phase_two_lesson_windows,
  public.aca_phase_two_access_extensions from public, anon, authenticated;
grant select on public.aca_phase_two_lesson_windows,
  public.aca_phase_two_access_extensions to authenticated;

create or replace function private.aca_phase_two_lesson_context(
  p_enrollment_id uuid,
  p_lesson_id uuid
)
returns table(released_at timestamptz, weekend_ends_at timestamptz, learner_id uuid)
language plpgsql stable security definer set search_path=''
as $$
declare
  v_time_zone text;
  v_start date;
  v_release_time time;
  v_journey int;
  v_position int;
  v_learner uuid;
  v_release_date date;
begin
  v_learner := (select auth.uid());
  if v_learner is null then
    raise exception 'Authentication required';
  end if;

  select coh.iana_timezone, coh.starts_monday, coh.release_local_time,
    j.journey_number::int, l.journey_position::int
    into v_time_zone,v_start,v_release_time,v_journey,v_position
  from public.aca_phase_two_memberships m
  join public.aca_phase_two_cohorts coh on coh.id=m.cohort_id and coh.course_id=m.course_id
  join public.enrollments e on e.id=m.enrollment_id and e.course_id=m.course_id and e.learner_id=m.learner_id
  join public.courses c on c.id=e.course_id
  join public.lessons l on l.id=p_lesson_id and l.course_id=c.id
  join public.course_journeys j on j.id=l.journey_id and j.course_id=c.id
  where m.enrollment_id=p_enrollment_id
    and m.learner_id=v_learner
    and e.status='active'
    and c.code='phase-two-ai-professional-builder'
    and c.status='published'
    and coh.status='active'
    and j.status='published'
    and l.status='published'
    and l.page_id=j.journey_number::text || '.' || l.journey_position::text
    and j.journey_number between 1 and 6
    and l.journey_position between 1 and 6
    and coalesce(e.starts_at, e.enrolled_at) <= now()
    and (e.access_expires_at is null or e.access_expires_at > now());

  if not found then
    raise exception 'This lesson is unavailable for the current enrollment';
  end if;
  if v_start is null or v_time_zone is null or btrim(v_time_zone)=''
    or v_release_time is null then
    raise exception 'Phase Two cohort release configuration is incomplete';
  end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_time_zone) then
    raise exception 'Phase Two cohort timezone is invalid';
  end if;

  v_release_date := v_start + ((v_journey-1)*7 + v_position-1);
  released_at := (v_release_date::timestamp + v_release_time) at time zone v_time_zone;
  weekend_ends_at := case when v_position=6
    then ((v_start + v_journey*7)::timestamp at time zone v_time_zone)
    else null::timestamptz end;
  learner_id := v_learner;
  return next;
end;
$$;
revoke all on function private.aca_phase_two_lesson_context(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.aca_phase_two_access_status(
  p_enrollment_id uuid,
  p_lesson_id uuid
)
returns table(access_status text, released_at timestamptz,
  deadline_at timestamptz, remaining_seconds integer)
language plpgsql stable security definer set search_path=''
as $$
declare
  v_release timestamptz;
  v_weekend timestamptz;
  v_deadline timestamptz;
  v_extension timestamptz;
  v_now timestamptz := now();
begin
  select c.released_at,c.weekend_ends_at
  into v_release,v_weekend
  from private.aca_phase_two_lesson_context(p_enrollment_id,p_lesson_id) c;
  if not found then
    raise exception 'Lesson unavailable';
  end if;

  released_at := v_release;
  if v_now < v_release then
    access_status := 'scheduled'; deadline_at := null; remaining_seconds := 0;
    return next; return;
  end if;

  select max(a.ends_at) into v_extension
  from public.aca_phase_two_access_extensions a
  where a.enrollment_id=p_enrollment_id and a.lesson_id=p_lesson_id
    and v_now >= a.begins_at and v_now < a.ends_at;

  if v_extension is not null then
    access_status := 'active'; deadline_at := v_extension;
  elsif v_weekend is not null then
    deadline_at := v_weekend;
    access_status := case when v_now < v_weekend then 'active' else 'closed' end;
  else
    select w.deadline_at into v_deadline
    from public.aca_phase_two_lesson_windows w
    where w.enrollment_id=p_enrollment_id and w.lesson_id=p_lesson_id;
    deadline_at := v_deadline;
    access_status := case
      when v_deadline is null then 'available'
      when v_now < v_deadline then 'active'
      else 'closed' end;
  end if;

  remaining_seconds := case when access_status='active'
    then greatest(0,ceil(extract(epoch from deadline_at-v_now))::integer)
    else 0 end;
  return next;
end;
$$;
revoke all on function public.aca_phase_two_access_status(uuid,uuid) from public,anon,authenticated;
grant execute on function public.aca_phase_two_access_status(uuid,uuid) to authenticated;

-- A lesson is returned only after authenticated, course-scoped schedule checks.
-- The first weekday opening is inserted ONCE and its timestamp is never updated.
-- Separate media signing must check this same access status; a public storage URL
-- must never be generated merely because the release date has arrived.
create or replace function public.open_aca_phase_two_lesson(
  p_enrollment_id uuid,
  p_lesson_id uuid
)
returns table(
  page_id text, lesson_title text, lesson_purpose text,
  lesson_content jsonb, closes_at timestamptz,
  remaining_seconds integer
)
language plpgsql security definer set search_path=''
as $$
declare
  v_release timestamptz;
  v_weekend timestamptz;
  v_learner uuid;
  v_deadline timestamptz;
  v_extension timestamptz;
  v_now timestamptz := now();
begin
  select c.released_at,c.weekend_ends_at,c.learner_id
  into v_release,v_weekend,v_learner
  from private.aca_phase_two_lesson_context(p_enrollment_id,p_lesson_id) c;
  if not found or v_now < v_release then
    raise exception 'This lesson is not yet released';
  end if;

  select max(a.ends_at) into v_extension
  from public.aca_phase_two_access_extensions a
  where a.enrollment_id=p_enrollment_id
    and a.lesson_id=p_lesson_id
    and a.learner_id=v_learner
    and v_now >= a.begins_at and v_now < a.ends_at;

  if v_weekend is not null then
    v_deadline := v_weekend;
  else
    insert into public.aca_phase_two_lesson_windows
      (enrollment_id,learner_id,lesson_id,first_opened_at,deadline_at)
    values (p_enrollment_id,v_learner,p_lesson_id,v_now,v_now+interval '2 hours')
    on conflict (enrollment_id,lesson_id) do nothing;
    select w.deadline_at into v_deadline
    from public.aca_phase_two_lesson_windows w
    where w.enrollment_id=p_enrollment_id and w.lesson_id=p_lesson_id;
  end if;

  if v_extension is not null then
    v_deadline := v_extension;
  end if;
  if v_deadline is null or v_now >= v_deadline then
    raise exception 'This lesson session has closed; saved project work remains available';
  end if;

  return query
  select l.page_id,l.title,l.purpose,l.content,v_deadline,
    greatest(0,ceil(extract(epoch from v_deadline-v_now))::integer)
  from public.lessons l
  where l.id=p_lesson_id
    and l.course_id=(
      select m.course_id from public.aca_phase_two_memberships m
      where m.enrollment_id=p_enrollment_id and m.learner_id=v_learner
    );
end;
$$;
revoke all on function public.open_aca_phase_two_lesson(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.open_aca_phase_two_lesson(uuid,uuid) to authenticated;

-- Note: no LMS route calls these RPCs until approval and complete QA.
