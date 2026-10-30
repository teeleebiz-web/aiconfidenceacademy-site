-- Enforce the already approved payment deadline on reads, independently of the
-- daily maintenance record update. No source data, schedule, price or window is reset.
-- Private invoker helper: only existing trusted definer functions call it.
create or replace function private.aca_installment_access_deadline(p_enrollment_id uuid)
returns timestamptz language sql stable set search_path = '' as $$
 select coalesce(min(case
   when p.status = 'grace' then coalesce(p.grace_until, '-infinity'::timestamptz)
   when p.status = 'paused' then '-infinity'::timestamptz
   else null::timestamptz end), 'infinity'::timestamptz)
 from public.aca_installment_plans p where p.enrollment_id = p_enrollment_id;
$$;
revoke all on function private.aca_installment_access_deadline(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.lesson_access_state(p_enrollment_id uuid, p_learner_id uuid, p_at timestamp with time zone)
 RETURNS TABLE(current_lesson_id uuid, current_journey_id uuid, access_status text, available_at timestamp with time zone, active_seconds integer, remaining_seconds integer, completed_lessons integer, total_lessons integer, released_lesson_ids uuid[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and e.status in ('active', 'completed')
    and p_at < private.aca_installment_access_deadline(e.id);

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
    greatest(0, least(7200 - v_current.used_seconds,
      floor(extract(epoch from (least(p_at + interval '2 hours',
        private.aca_installment_access_deadline(p_enrollment_id)) - p_at)))::integer))::integer,
    v_completed,
    v_total,
    v_released;
end;
$function$;

CREATE OR REPLACE FUNCTION public.touch_lesson_access(p_enrollment_id uuid, p_lesson_id uuid)
 RETURNS TABLE(access_status text, active_seconds integer, remaining_seconds integer, hard_expires_at timestamp with time zone, recovery_used boolean, recovery_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    greatest(0, floor(extract(epoch from (least(v_window.started_at + interval '2 hours',
      private.aca_installment_access_deadline(p_enrollment_id)) - v_now)))::integer),
    least(v_window.started_at + interval '2 hours', private.aca_installment_access_deadline(p_enrollment_id)),
    false,
    null::timestamptz;
end;
$function$;

CREATE OR REPLACE FUNCTION public.heartbeat_lesson_access(p_enrollment_id uuid, p_lesson_id uuid)
 RETURNS TABLE(access_status text, active_seconds integer, remaining_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare w public.lesson_access_windows%rowtype; used integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into w from public.lesson_access_windows a where a.enrollment_id=p_enrollment_id and a.lesson_id=p_lesson_id and a.learner_id=auth.uid() for update;
 if not found then raise exception 'This lesson session is closed'; end if;
 if not exists(select 1 from public.enrollments e where e.id=p_enrollment_id and e.learner_id=auth.uid() and e.status in ('active','completed') and now() < private.aca_installment_access_deadline(e.id) and (e.access_expires_at is null or e.access_expires_at>now())) then
   raise exception 'This lesson session is closed';
 end if;
 used:=least(7200,greatest(0,floor(extract(epoch from (now()-w.started_at)))::integer));
 if w.status='active' then
   update public.lesson_access_windows a set active_seconds=used,last_seen_at=now(),updated_at=now(),
     status=case when used>=7200 then 'expired' else 'active' end,
     closed_at=case when used>=7200 then w.started_at+interval '2 hours' else a.closed_at end
   where a.id=w.id returning * into w;
 end if;
 return query select w.status,used,case when w.status='active' then greatest(0,least(7200-used,
   floor(extract(epoch from (least(now()+interval '2 hours',private.aca_installment_access_deadline(p_enrollment_id))-now())))::integer)) else 0 end;
end; $function$;

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
$function$;

CREATE OR REPLACE FUNCTION public.aca_phase_two_access_status(p_enrollment_id uuid, p_lesson_id uuid)
 RETURNS TABLE(access_status text, released_at timestamp with time zone, deadline_at timestamp with time zone, remaining_seconds integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if deadline_at is not null then
    deadline_at := least(deadline_at, private.aca_installment_access_deadline(p_enrollment_id));
  end if;
  remaining_seconds := case when access_status='active'
    then greatest(0,ceil(extract(epoch from deadline_at-v_now))::integer)
    else 0 end;
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.open_aca_phase_two_lesson(p_enrollment_id uuid, p_lesson_id uuid)
 RETURNS TABLE(page_id text, lesson_title text, lesson_purpose text, lesson_content jsonb, closes_at timestamp with time zone, remaining_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_deadline is not null then
    v_deadline := least(v_deadline, private.aca_installment_access_deadline(p_enrollment_id));
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
$function$;

CREATE OR REPLACE FUNCTION public.get_aca_phase_two_workbook(p_enrollment_id uuid, p_journey integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_owner boolean := coalesce((select public.is_aca_curriculum_owner()),false);
  v_def jsonb;
  v_allowed integer[] := '{}'::integer[];
  v_visible jsonb;
  v_saved public.aca_phase_two_workbook_responses%rowtype;
  v_fields text[] := '{}'::text[];
  v_answers jsonb;
  v_scope text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_journey not between 1 and 6 then raise exception 'Invalid journey'; end if;
  select d.content into v_def from public.aca_phase_two_workbook_definitions d where d.journey_number=p_journey;
  if not found then raise exception 'This workbook is being prepared'; end if;

  if p_enrollment_id is null and v_owner then
    select coalesce(array_agg((page->>'number')::int order by (page->>'number')::int),'{}'::int[])
      into v_allowed from jsonb_array_elements(v_def->'pages') page;
    v_scope := 'owner-review';
  else
    if p_enrollment_id is null then raise exception 'Enrollment required'; end if;
    if not exists (
      select 1 from public.aca_phase_two_memberships m
      join public.enrollments e on e.id=m.enrollment_id and e.learner_id=m.learner_id and e.course_id=m.course_id
      join public.courses c on c.id=e.course_id
      join public.aca_phase_two_cohorts coh on coh.id=m.cohort_id and coh.course_id=c.id
      where m.enrollment_id=p_enrollment_id and m.learner_id=v_uid
        and e.status in ('active','completed')
        and now() < private.aca_installment_access_deadline(e.id)
        and c.status='published' and c.code='phase-two-ai-professional-builder'
        and coh.status in ('active','closed')
        and coalesce(e.starts_at,e.enrolled_at)<=now()
        and coh.starts_monday is not null and coh.iana_timezone is not null
        and coh.release_local_time is not null
    ) then raise exception 'Workbook access requires your authorized Phase Two enrollment'; end if;
    select coalesce(array_agg((page->>'number')::integer order by (page->>'number')::integer),'{}'::integer[])
      into v_allowed
    from jsonb_array_elements(v_def->'pages') page
    join public.lessons l on l.page_id = p_journey::text || '.' || (page->>'number')
    join public.course_journeys j on j.id=l.journey_id and j.journey_number=p_journey and j.status='published'
    join public.aca_phase_two_memberships m on m.enrollment_id=p_enrollment_id and m.course_id=l.course_id
    join public.aca_phase_two_cohorts coh on coh.id=m.cohort_id
    where l.status='published'
      and ((coh.starts_monday + ((p_journey-1)*7 + (page->>'number')::int-1))::timestamp
          + coh.release_local_time) at time zone coh.iana_timezone <= now();
    v_scope := v_uid::text;
    select * into v_saved from public.aca_phase_two_workbook_responses
      where enrollment_id=p_enrollment_id and learner_id=v_uid and journey_number=p_journey;
  end if;
  if cardinality(v_allowed)=0 then raise exception 'This workbook has no released lessons yet'; end if;
  select coalesce(jsonb_agg(page order by (page->>'number')::integer),'[]'::jsonb)
    into v_visible from jsonb_array_elements(v_def->'pages') page
    where (page->>'number')::integer=any(v_allowed);
  select coalesce(array_agg(block->>'id'),'{}'::text[]) into v_fields
    from jsonb_array_elements(v_visible) page,
         lateral jsonb_array_elements(page->'blocks') block
    where block->>'type'='field';
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_answers
    from jsonb_each(coalesce(v_saved.answers,'{}'::jsonb)) where key=any(v_fields);
  return jsonb_build_object(
    'answers',v_answers,'last_page',case when v_saved.last_page=any(v_allowed) then v_saved.last_page else v_allowed[1] end,
    'revision',coalesce(v_saved.revision,0),
    'updated_at',v_saved.updated_at,
    'allowedPages',to_jsonb(v_allowed),'scope',v_scope,
    'workbook',jsonb_set(v_def,'{pages}',v_visible)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_aca_phase_two_project(p_enrollment_id uuid, p_project_path text, p_project_title text, p_patch jsonb, p_decision_note text DEFAULT NULL::text)
 RETURNS TABLE(saved_version integer, saved_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_learner uuid := (select auth.uid());
  v_record public.aca_phase_two_project_records%rowtype;
begin
  if v_learner is null then
    raise exception 'Authentication required';
  end if;
  if p_project_path not in ('A','B') or p_project_path is null then
    raise exception 'Choose Path A or Path B';
  end if;
  if p_project_title is null or btrim(p_project_title) = '' then
    raise exception 'The project must have a title';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'The project update must be an object';
  end if;

  if not exists (
    select 1
    from public.aca_phase_two_memberships m
    join public.enrollments e on e.id = m.enrollment_id
    join public.courses c on c.id = m.course_id
    where m.enrollment_id = p_enrollment_id
      and m.learner_id = v_learner
      and e.learner_id = v_learner
      and e.course_id = m.course_id
      and e.status = 'active'
      and now() < private.aca_installment_access_deadline(e.id)
      and c.code = 'phase-two-ai-professional-builder'
      and c.status = 'published'
      and coalesce(e.starts_at, e.enrolled_at) <= now()
      and (e.access_expires_at is null or e.access_expires_at > now())
  ) then
    raise exception 'No active Phase Two enrollment for this project';
  end if;

  insert into public.aca_phase_two_project_records
    (enrollment_id, learner_id, project_path, project_title)
    values (p_enrollment_id, v_learner, p_project_path, btrim(p_project_title))
    on conflict (enrollment_id) do nothing;

  select * into v_record
  from public.aca_phase_two_project_records
  where enrollment_id = p_enrollment_id and learner_id = v_learner
  for update;

  if not found or v_record.project_path <> p_project_path then
    raise exception 'An existing project path cannot be replaced without review';
  end if;

  update public.aca_phase_two_project_records p
  set project_title = btrim(p_project_title),
      sections = private.aca_phase_two_merge_sections(p.sections, p_patch),
      version_number = p.version_number + 1,
      updated_at = now()
  where p.enrollment_id = p_enrollment_id
  returning * into v_record;

  insert into public.aca_phase_two_project_revisions
    (enrollment_id, learner_id, version_number, patch, saved_snapshot, decision_note)
  values (
    p_enrollment_id, v_learner, v_record.version_number,
    p_patch, v_record.sections, nullif(btrim(p_decision_note), '')
  );

  return query select v_record.version_number, v_record.updated_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.aca_phase_two_release_candidates(p_window_start timestamp with time zone, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('eventKey','lesson-release:'||e.id||':'||l.id,'enrollmentId',e.id,'learnerId',e.learner_id,'courseId',e.course_id,'lessonId',l.id,'pageId',l.page_id,'lessonTitle',l.title,'releaseAt',r.at,'phaseNumber',2,'weekend',l.journey_position=6) order by r.at),'[]')
 from public.enrollments e join public.courses c on c.id=e.course_id and c.phase_number=2 and c.status='published'
 join public.aca_phase_two_memberships m on m.enrollment_id=e.id and m.learner_id=e.learner_id and m.course_id=e.course_id
 join public.aca_phase_two_cohorts co on co.id=m.cohort_id and co.status='active'
 join public.course_journeys j on j.course_id=e.course_id and j.status='published'
 join public.lessons l on l.journey_id=j.id and l.course_id=e.course_id and l.status='published'
 cross join lateral(select ((co.starts_monday+((j.journey_number-1)*7+l.journey_position-1))::timestamp+co.release_local_time) at time zone co.iana_timezone as at) r
 where e.status='active' and p_now < private.aca_installment_access_deadline(e.id) and coalesce(e.starts_at,e.enrolled_at)<=p_now and (e.access_expires_at is null or e.access_expires_at>p_now)
 and j.journey_number between 1 and 6 and l.journey_position between 1 and 6 and l.page_id=j.journey_number::text||'.'||l.journey_position::text
 and r.at>=p_window_start and r.at<p_now
 and not exists(select 1 from public.aca_email_events em where em.event_key='lesson-release:'||e.id||':'||l.id and em.status in('sent','delivered'));
$function$;

CREATE OR REPLACE FUNCTION public.can_read_aca_welcome_media(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists (
  select 1 from public.enrollments e
  where e.learner_id=auth.uid() and e.status in ('active','completed')
   and now() < private.aca_installment_access_deadline(e.id)
   and (e.starts_at is null or e.starts_at<=now())
   and (e.access_expires_at is null or e.access_expires_at>now())
   and (
    p_path='academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.mp4'
    or exists (
     select 1 from private.lesson_access_state(e.id,auth.uid(),now()) s
     join public.journey_introductions i on i.journey_id=s.current_journey_id
     where s.access_status in ('available','active') and i.status='published'
       and p_path in(i.media_path,i.caption_path,i.companion_audio_path,i.companion_caption_path)
    )
   )
 ) and not exists (select 1 from public.lessons l where p_path in(l.content->>'video_path',l.content->>'audio_path'));
$function$;

CREATE OR REPLACE FUNCTION public.complete_aca_onboarding(p_enrollment_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_completed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue.' using errcode = '42501';
  end if;

  update public.enrollments e
  set onboarding_completed_at = coalesce(e.onboarding_completed_at, now())
  from public.courses c
  where e.id = p_enrollment_id
    and e.learner_id = auth.uid()
    and e.course_id = c.id
    and c.code = 'phase-one-chatgpt-foundations'
    and c.status = 'published'
    and e.status in ('active', 'completed')
    and now() < private.aca_installment_access_deadline(e.id)
    and (e.starts_at is null or e.starts_at <= now())
    and (e.access_expires_at is null or e.access_expires_at > now())
  returning e.onboarding_completed_at into v_completed_at;

  if v_completed_at is null then
    raise exception 'Your enrollment could not be verified.' using errcode = '42501';
  end if;
  return v_completed_at;
end;
$function$;

