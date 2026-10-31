do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end$$;
create schema auth;
create schema private;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fixture.user',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.courses(id uuid primary key,code text,status text);
create table public.enrollments(id uuid primary key,learner_id uuid,course_id uuid,status text,starts_at timestamptz,enrolled_at timestamptz default now(),access_expires_at timestamptz);
create table public.course_journeys(id uuid primary key,course_id uuid,journey_number integer,status text);
create table public.lessons(id uuid primary key,course_id uuid,journey_id uuid,course_position integer,journey_position integer,unlock_offset_days integer,status text,page_id text,title text,purpose text,content jsonb);
create table public.lesson_access_windows(id uuid primary key default gen_random_uuid(),enrollment_id uuid,learner_id uuid,course_id uuid,lesson_id uuid,started_at timestamptz default now(),last_seen_at timestamptz default now(),active_seconds integer not null default 0,hard_expires_at timestamptz,recovery_used boolean default false,recovery_expires_at timestamptz,status text not null default 'active',completed_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),closed_at timestamptz,unique(enrollment_id,lesson_id));
create table public.aca_phase_two_lesson_windows(enrollment_id uuid,learner_id uuid,lesson_id uuid,first_opened_at timestamptz,deadline_at timestamptz,primary key(enrollment_id,lesson_id));
create table public.aca_phase_two_access_extensions(enrollment_id uuid,learner_id uuid,lesson_id uuid,begins_at timestamptz,ends_at timestamptz);
create table public.aca_installment_plans(enrollment_id uuid,status text,grace_until timestamptz);
create table public.aca_phase_two_cohorts(id uuid,course_id uuid,iana_timezone text,starts_monday date,release_local_time time,status text);
create table public.aca_phase_two_memberships(enrollment_id uuid,learner_id uuid,course_id uuid,cohort_id uuid);
alter table public.lesson_access_windows enable row level security;
alter table public.aca_phase_two_lesson_windows enable row level security;
create policy own on public.lesson_access_windows for select to authenticated using(learner_id=(select auth.uid()));
create policy own on public.aca_phase_two_lesson_windows for select to authenticated using(learner_id=(select auth.uid()));
grant select,truncate,references,trigger on public.lesson_access_windows,public.aca_phase_two_lesson_windows to authenticated;

-- Historical rows must remain closed after the migration changes timer rules.
insert into public.lesson_access_windows(enrollment_id,lesson_id,started_at,status,active_seconds)
values('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001',now()-interval '3 hours','active',30),
('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002',now()-interval '4 hours','completed',1400),
('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000003',now()-interval '4 hours','expired',7200);
CREATE OR REPLACE FUNCTION private.aca_phase_two_lesson_context(p_enrollment_id uuid, p_lesson_id uuid)
 RETURNS TABLE(released_at timestamp with time zone, weekend_ends_at timestamp with time zone, learner_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and now() < private.aca_installment_access_deadline(e.id)
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
$function$
;
CREATE OR REPLACE FUNCTION private.aca_installment_access_deadline(p_enrollment_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select coalesce(min(case
   when p.status = 'grace' then coalesce(p.grace_until, '-infinity'::timestamptz)
   when p.status = 'paused' then '-infinity'::timestamptz
   else null::timestamptz end), 'infinity'::timestamptz)
 from public.aca_installment_plans p where p.enrollment_id = p_enrollment_id;
$function$
;
