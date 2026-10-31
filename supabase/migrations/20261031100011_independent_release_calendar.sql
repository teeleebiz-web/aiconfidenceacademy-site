-- Founder-authorized independent calendar. Does not publish any curriculum.

alter table public.aca_phase_two_memberships alter column cohort_id drop not null;

-- Calendar rules are shared by lesson access, workbooks, notices and owner diagnostics.
-- Lesson 1 opens with enrollment. Later releases use Pacific local calendar dates.
create or replace function private.aca_release_at(p_start timestamptz,p_phase integer,p_position integer,p_offset integer)
returns timestamptz language plpgsql stable set search_path='' as $$
declare d date:=(p_start at time zone 'America/Los_Angeles')::date; n integer:=1;
begin
 if p_start is null or p_position<1 or p_position>36 then return null; end if;
 if p_position=1 then return p_start; end if;
 if p_phase=2 then
   while n<p_position loop
     d:=d+1;
     if extract(isodow from d)<>7 then n:=n+1; end if;
   end loop;
 else
   d:=d+greatest(0,p_offset);
 end if;
 return (d+time '06:00') at time zone 'America/Los_Angeles';
end; $$;

create or replace function private.aca_lesson_calendar(p_enrollment_id uuid,p_lesson_id uuid)
returns table(released_at timestamptz,first_open_until timestamptz,weekend_ends_at timestamptz)
language sql stable set search_path='' as $$
 select r.at,coalesce(w.ends_at,r.at+interval '24 hours'),w.ends_at
 from public.enrollments e join public.courses c on c.id=e.course_id
 join public.lessons l on l.course_id=c.id and l.id=p_lesson_id
 cross join lateral(select private.aca_release_at(coalesce(e.starts_at,e.enrolled_at),c.phase_number,l.course_position,l.unlock_offset_days) at)r
 cross join lateral(select case when c.phase_number=2 and extract(isodow from r.at at time zone 'America/Los_Angeles')=6
   then (((r.at at time zone 'America/Los_Angeles')::date+2)::timestamp at time zone 'America/Los_Angeles') end ends_at)w
 where e.id=p_enrollment_id;
$$;

-- An unopened final lesson ends with its opening window. An opened ordinary
-- final lesson retains its saved budget until completion/exhaustion. Explicit
-- trial/owner end dates remain hard limits; no arbitrary 42/90-day default is added.
create or replace function private.aca_phase_ends_at(p_enrollment_id uuid,p_at timestamptz default now())
returns timestamptz language plpgsql stable set search_path='' as $$
declare e public.enrollments%rowtype; final uuid; phase integer; cal record;
 w public.lesson_access_windows%rowtype; pw public.aca_phase_two_lesson_windows%rowtype;
 v_end timestamptz; ext timestamptz;
begin
 select * into e from public.enrollments where id=p_enrollment_id;
 if not found then return '-infinity'::timestamptz; end if;
 select c.phase_number,l.id into phase,final from public.courses c join public.lessons l on l.course_id=c.id
 where c.id=e.course_id order by l.course_position desc limit 1;
 if final is null then return coalesce(e.access_expires_at,'infinity'::timestamptz); end if;
 select * into cal from private.aca_lesson_calendar(e.id,final);
 v_end:=cal.first_open_until;
 if phase=2 then
   select max(a.ends_at) into ext from public.aca_phase_two_access_extensions a
   where a.enrollment_id=e.id and a.lesson_id=final and a.learner_id=e.learner_id;
   if cal.weekend_ends_at is not null then v_end:=cal.weekend_ends_at;
   else
     select * into pw from public.aca_phase_two_lesson_windows where enrollment_id=e.id and lesson_id=final;
     if found then v_end:=case when pw.study_used_ms>=7200000
       then coalesce(pw.last_seen_at,p_at) else 'infinity'::timestamptz end; end if;
   end if;
   if ext is not null then v_end:=greatest(v_end,ext); end if;
 else
   select * into w from public.lesson_access_windows where enrollment_id=e.id and lesson_id=final;
   if found then v_end:=case when w.status in ('completed','expired') then coalesce(w.closed_at,w.completed_at,w.last_seen_at)
     when w.study_used_ms>=7200000 then coalesce(w.closed_at,w.last_seen_at,p_at)
     else 'infinity'::timestamptz end; end if;
 end if;
 return least(coalesce(v_end,'infinity'::timestamptz),coalesce(e.access_expires_at,'infinity'::timestamptz));
end; $$;

create or replace function private.aca_learning_deadline(p_enrollment_id uuid,p_at timestamptz default now())
returns timestamptz language sql stable set search_path='' as $$
 select least(private.aca_phase_ends_at(p_enrollment_id,p_at),private.aca_installment_access_deadline(p_enrollment_id));
$$;

create or replace function private.lesson_access_state(p_enrollment_id uuid,p_learner_id uuid,p_at timestamptz)
returns table(current_lesson_id uuid,current_journey_id uuid,access_status text,available_at timestamptz,
 active_seconds integer,remaining_seconds integer,completed_lessons integer,total_lessons integer,released_lesson_ids uuid[])
language plpgsql stable security definer set search_path='' as $$
declare e public.enrollments%rowtype; r record; current_row record; v_total integer:=0; v_closed integer:=0;
 ids uuid[]:='{}'; limit_at timestamptz; has_current boolean:=false; used integer;
begin
 select a.* into e from public.enrollments a join public.courses c on c.id=a.course_id and c.status='published'
 where a.id=p_enrollment_id and a.learner_id=p_learner_id and a.status in ('active','completed')
 and coalesce(a.starts_at,a.enrolled_at)<=p_at and p_at<private.aca_installment_access_deadline(a.id);
 if not found then return; end if;
 limit_at:=private.aca_learning_deadline(e.id,p_at);
 for r in
   select l.id,l.journey_id,cal.*,w.status,w.started_at,
     private.aca_study_status(w,p_at) as effective_status,
     floor(private.aca_study_used_ms(w.study_used_ms,w.study_state,w.last_seen_at,p_at)/1000.0)::integer as used
   from public.lessons l join public.course_journeys j on j.id=l.journey_id and j.course_id=l.course_id and j.status='published'
   cross join lateral private.aca_lesson_calendar(e.id,l.id)cal
   left join public.lesson_access_windows w on w.enrollment_id=e.id and w.lesson_id=l.id
   where l.course_id=e.course_id and l.status='published' order by l.course_position
 loop
   v_total:=v_total+1;
   if r.effective_status in ('completed','expired') or (r.started_at is null and p_at>=r.first_open_until) then
     v_closed:=v_closed+1; ids:=array_append(ids,r.id);
   elsif not has_current then current_row:=r; has_current:=true;
     if p_at>=r.released_at then ids:=array_append(ids,r.id); end if;
   end if;
 end loop;
 if not has_current then
   return query select null::uuid,null::uuid,'course_completed'::text,null::timestamptz,0,0,v_closed,v_total,ids;return;
 end if;
 used:=current_row.used;
 return query select current_row.id::uuid,current_row.journey_id::uuid,
 case when p_at>=limit_at then 'access_ended' when current_row.status='active' then 'active'
   when p_at>=current_row.released_at then 'available' else 'scheduled' end,
 current_row.released_at::timestamptz,used,
 greatest(0,least(7200-used,floor(extract(epoch from least(p_at+interval '2 hours',limit_at)-p_at))::integer)),
 v_closed,v_total,ids;
end; $$;

create or replace function private.aca_phase_two_lesson_context(p_enrollment_id uuid,p_lesson_id uuid)
returns table(released_at timestamptz,weekend_ends_at timestamptz,learner_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return query select cal.released_at,cal.weekend_ends_at,e.learner_id
 from public.aca_phase_two_memberships m
 join public.enrollments e on e.id=m.enrollment_id and e.course_id=m.course_id and e.learner_id=m.learner_id
 join public.courses c on c.id=e.course_id and c.code='phase-two-ai-professional-builder' and c.status='published'
 join public.lessons l on l.id=p_lesson_id and l.course_id=c.id and l.status='published'
 join public.course_journeys j on j.id=l.journey_id and j.course_id=c.id and j.status='published'
 cross join lateral private.aca_lesson_calendar(e.id,l.id)cal
 where m.enrollment_id=p_enrollment_id and m.learner_id=auth.uid() and e.status='active'
 and coalesce(e.starts_at,e.enrolled_at)<=now() and now()<private.aca_learning_deadline(e.id)
 and j.journey_number between 1 and 6 and l.journey_position between 1 and 6
 and l.page_id=j.journey_number::text||'.'||l.journey_position::text;
 if not found then raise exception 'This lesson is unavailable for the current enrollment'; end if;
end; $$;

revoke all on function private.aca_release_at(timestamptz,integer,integer,integer),
 private.aca_lesson_calendar(uuid,uuid),private.aca_phase_ends_at(uuid,timestamptz),
 private.aca_learning_deadline(uuid,timestamptz) from public,anon,authenticated;

create or replace function public.touch_lesson_access(p_enrollment_id uuid,p_lesson_id uuid)
returns table(access_status text,active_seconds integer,remaining_seconds integer,hard_expires_at timestamptz,recovery_used boolean,recovery_expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_state record; w public.lesson_access_windows%rowtype; v_limit timestamptz;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into v_state from private.lesson_access_state(p_enrollment_id,v_user,now());
 if not found or v_state.current_lesson_id is distinct from p_lesson_id or v_state.access_status not in ('available','active')
   then raise exception 'This lesson is not available for this enrollment'; end if;
 insert into public.lesson_access_windows(enrollment_id,learner_id,course_id,lesson_id,started_at,last_seen_at)
 select e.id,v_user,e.course_id,p_lesson_id,now(),now() from public.enrollments e where e.id=p_enrollment_id and e.learner_id=v_user
 on conflict(enrollment_id,lesson_id) do nothing;
 select * into w from public.lesson_access_windows a where a.enrollment_id=p_enrollment_id and a.lesson_id=p_lesson_id and a.learner_id=v_user;
 select private.aca_learning_deadline(e.id) into v_limit
 from public.enrollments e where e.id=p_enrollment_id;
 return query select private.aca_study_status(w,now()),
 floor(private.aca_study_used_ms(w.study_used_ms,w.study_state,w.last_seen_at,now())/1000.0)::integer,
 greatest(0,least(ceil((7200000-private.aca_study_used_ms(w.study_used_ms,w.study_state,w.last_seen_at,now()))/1000.0)::integer,
 floor(extract(epoch from least(now()+interval '2 hours',v_limit)-now()))::integer)),
 least(now()+make_interval(secs=>(7200000-private.aca_study_used_ms(w.study_used_ms,w.study_state,w.last_seen_at,now()))/1000.0),v_limit),
 false,null::timestamptz;
end; $$;

create or replace function public.aca_phase_two_access_status(p_enrollment_id uuid,p_lesson_id uuid)
returns table(access_status text,released_at timestamptz,deadline_at timestamptz,remaining_seconds integer)
language plpgsql stable security definer set search_path='' as $$
declare v_release timestamptz; v_weekend timestamptz; v_extension timestamptz;
 w public.aca_phase_two_lesson_windows%rowtype; v_used bigint; v_limit timestamptz;
begin
 select c.released_at,c.weekend_ends_at into v_release,v_weekend from private.aca_phase_two_lesson_context(p_enrollment_id,p_lesson_id)c;
 if not found then raise exception 'Lesson unavailable'; end if;
 released_at:=v_release;
 if now()<v_release then access_status:='scheduled'; deadline_at:=null; remaining_seconds:=0; return next; return; end if;
 select max(a.ends_at) into v_extension from public.aca_phase_two_access_extensions a where a.enrollment_id=p_enrollment_id and a.lesson_id=p_lesson_id and a.learner_id=auth.uid() and now()>=a.begins_at and now()<a.ends_at;
 select private.aca_learning_deadline(e.id) into v_limit from public.enrollments e where e.id=p_enrollment_id;
 if v_extension is not null or v_weekend is not null then
   deadline_at:=least(coalesce(v_extension,v_weekend),v_limit);
   access_status:=case when now()<deadline_at then 'active' else 'closed' end;
   remaining_seconds:=greatest(0,ceil(extract(epoch from deadline_at-now()))::integer);
 else
   select * into w from public.aca_phase_two_lesson_windows a where a.enrollment_id=p_enrollment_id and a.lesson_id=p_lesson_id;
   if not found then
     select cal.first_open_until into deadline_at from private.aca_lesson_calendar(p_enrollment_id,p_lesson_id)cal;
     access_status:=case when now()<deadline_at then 'available' else 'closed' end; remaining_seconds:=0;
   else
     v_used:=private.aca_study_used_ms(w.study_used_ms,w.study_state,w.last_seen_at,now());
     remaining_seconds:=greatest(0,least(ceil((7200000-v_used)/1000.0)::integer,floor(extract(epoch from least(now()+interval '2 hours',v_limit)-now()))::integer));
     access_status:=case when remaining_seconds>0 then 'active' else 'closed' end;
     -- A compatibility projection for legacy readers, never an entitlement.
     deadline_at:=least(now()+make_interval(secs=>remaining_seconds),v_limit);
   end if;
 end if;
 return next;
end; $$;

create or replace function public.open_aca_phase_two_lesson(p_enrollment_id uuid,p_lesson_id uuid)
returns table(page_id text,lesson_title text,lesson_purpose text,lesson_content jsonb,closes_at timestamptz,remaining_seconds integer)
language plpgsql security definer set search_path='' as $$
declare v_context record; v_access record;
begin
 select * into v_context from private.aca_phase_two_lesson_context(p_enrollment_id,p_lesson_id);
 select * into v_access from public.aca_phase_two_access_status(p_enrollment_id,p_lesson_id);
 if v_access.access_status not in ('active','available') then raise exception 'This lesson is unavailable; saved project work remains available'; end if;
 insert into public.aca_phase_two_lesson_windows(enrollment_id,learner_id,lesson_id,first_opened_at,deadline_at,last_seen_at)
 values(p_enrollment_id,v_context.learner_id,p_lesson_id,now(),coalesce(v_context.weekend_ends_at,now()+interval '2 hours'),now())
 on conflict(enrollment_id,lesson_id) do nothing;
 select * into v_access from public.aca_phase_two_access_status(p_enrollment_id,p_lesson_id);
 return query select l.page_id,l.title,l.purpose,l.content,v_access.deadline_at,v_access.remaining_seconds from public.lessons l
 where l.id=p_lesson_id and l.course_id=(select e.course_id from public.enrollments e where e.id=p_enrollment_id and e.learner_id=auth.uid());
end; $$;

create or replace function public.manage_lesson_study_session(p_enrollment_id uuid,p_lesson_id uuid,p_action text,p_token uuid default null)
returns table(access_status text,study_state text,active_seconds integer,remaining_seconds integer,study_token uuid,limit_at timestamptz,study_mode text)
language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_course text; v_limit timestamptz; v_valid boolean;
 v_used bigint; v_seen timestamptz; v_state text; v_token uuid; v_status text;
 v_now timestamptz:=clock_timestamp(); v_access record; v_context record; v_extension timestamptz;
 v_mode text:='budget'; v_remaining integer; v_stale boolean;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_action not in ('start','heartbeat','pause') or p_action is null then raise exception 'Invalid study action'; end if;
 select c.code,e.status in ('active','completed') and coalesce(e.starts_at,e.enrolled_at)<=v_now,
 private.aca_learning_deadline(e.id)
 into v_course,v_valid,v_limit from public.enrollments e join public.courses c on c.id=e.course_id
 where e.id=p_enrollment_id and e.learner_id=v_user and c.status='published';
 if not found then raise exception 'Enrollment unavailable'; end if;
 if not v_valid or v_limit<=v_now then
   return query select 'expired'::text,'ended'::text,0,0,null::uuid,v_limit,v_mode; return;
 end if;
 if v_course='phase-two-ai-professional-builder' then
   if p_action='start' then perform public.open_aca_phase_two_lesson(p_enrollment_id,p_lesson_id); end if;
   select * into v_context from private.aca_phase_two_lesson_context(p_enrollment_id,p_lesson_id);
   if not found or v_now<v_context.released_at then raise exception 'Lesson unavailable'; end if;
   select max(a.ends_at) into v_extension from public.aca_phase_two_access_extensions a
   where a.enrollment_id=p_enrollment_id and a.lesson_id=p_lesson_id and a.learner_id=v_user and v_now>=a.begins_at and v_now<a.ends_at;
   if v_extension is not null then v_mode:='extension'; v_limit:=least(v_limit,v_extension);
   elsif v_context.weekend_ends_at is not null then v_mode:='weekend'; v_limit:=least(v_limit,v_context.weekend_ends_at); end if;
   select w.study_used_ms,w.study_state,w.study_token,w.last_seen_at,'active'::text
   into v_used,v_state,v_token,v_seen,v_status from public.aca_phase_two_lesson_windows w
   where w.enrollment_id=p_enrollment_id and w.lesson_id=p_lesson_id and w.learner_id=v_user for update;
 else
   if p_action='start' then perform public.touch_lesson_access(p_enrollment_id,p_lesson_id); end if;
   select * into v_access from private.lesson_access_state(p_enrollment_id,v_user,v_now);
   if not found or v_access.current_lesson_id is distinct from p_lesson_id or v_access.access_status<>'active' then
     -- The read projection may already classify the just-exhausted lesson as
     -- closed and select its successor. Confirm that final study interval in
     -- the owned ledger before returning; otherwise a stale lease could later
     -- expose the previous checkpoint as unused time again.
     update public.lesson_access_windows w set study_used_ms=7200000,active_seconds=7200,
       study_state='paused',status='expired',last_seen_at=clock_timestamp(),updated_at=clock_timestamp(),
       closed_at=coalesce(w.closed_at,clock_timestamp())
     where w.enrollment_id=p_enrollment_id and w.lesson_id=p_lesson_id and w.learner_id=v_user
       and w.status='active'
       and private.aca_study_used_ms(w.study_used_ms,w.study_state,w.last_seen_at,clock_timestamp())>=7200000;
     return query select 'expired'::text,'ended'::text,7200,0,null::uuid,v_limit,v_mode; return;
   end if;
   select w.study_used_ms,w.study_state,w.study_token,w.last_seen_at,w.status
   into v_used,v_state,v_token,v_seen,v_status from public.lesson_access_windows w
   where w.enrollment_id=p_enrollment_id and w.lesson_id=p_lesson_id and w.learner_id=v_user for update;
 end if;
 if not found then raise exception 'Lesson session unavailable'; end if;
 -- Read the clock after acquiring the row lock; queued requests must not use
 -- an earlier timestamp to move a checkpoint backwards or miss a hard cutoff.
 v_now:=clock_timestamp();
 -- A stale request never receives the current token.
 if p_action<>'start' and (p_token is null or p_token is distinct from v_token) then
   return query select 'superseded'::text,'paused'::text,floor(v_used/1000.0)::integer,
   greatest(0,ceil((7200000-v_used)/1000.0)::integer),null::uuid,v_limit,v_mode; return;
 end if;
 v_stale:=v_state='running' and (v_seen is null or v_now-v_seen>interval '45 seconds' or v_now<v_seen);
 if v_mode='budget' then v_used:=private.aca_study_used_ms(v_used,v_state,v_seen,v_now); end if;
 if p_action='start' then v_token:=gen_random_uuid(); v_state:='running';
 elsif p_action='pause' or v_stale then v_state:='paused'; end if;
 v_remaining:=case when v_mode='budget' then greatest(0,least(ceil((7200000-v_used)/1000.0)::integer,
 floor(extract(epoch from least(v_now+interval '2 hours',v_limit)-v_now))::integer))
 else greatest(0,ceil(extract(epoch from v_limit-v_now))::integer) end;
 if v_remaining=0 or v_status<>'active' then v_status:='expired'; v_state:='paused'; end if;
 if v_course='phase-two-ai-professional-builder' then
   update public.aca_phase_two_lesson_windows w set study_used_ms=v_used,study_state=v_state,study_token=v_token,last_seen_at=v_now
   where w.enrollment_id=p_enrollment_id and w.lesson_id=p_lesson_id and w.learner_id=v_user;
 else
   update public.lesson_access_windows w set study_used_ms=v_used,study_state=v_state,study_token=v_token,last_seen_at=v_now,
   active_seconds=floor(v_used/1000.0)::integer,updated_at=v_now,
   -- An external access cutoff restricts the session, not the unused budget.
   -- Preserve eligibility when payment is brought current, including the
   -- fractional final second rounded down in remaining_seconds.
   status=case when v_used>=7200000 then 'expired' else w.status end,
   closed_at=case when v_used>=7200000 then coalesce(w.closed_at,v_now) else w.closed_at end
   where w.enrollment_id=p_enrollment_id and w.lesson_id=p_lesson_id and w.learner_id=v_user;
 end if;
 return query select v_status,case when v_status='expired' then 'ended' else v_state end,
 floor(v_used/1000.0)::integer,v_remaining,v_token,
 case when v_limit='infinity'::timestamptz then null::timestamptz else v_limit end,v_mode;
end; $$;

CREATE OR REPLACE FUNCTION public.aca_phase_two_my_outline(p_enrollment_id uuid)
 RETURNS TABLE(lesson_id uuid, journey_number integer, lesson_number integer, page_id text, journey_title text, lesson_title text, planned_media text, released_at timestamp with time zone, access_status text, deadline_at timestamp with time zone, remaining_seconds integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    where m.enrollment_id=p_enrollment_id and m.learner_id=v_learner
      and e.status='active' and c.code='phase-two-ai-professional-builder'
      and c.status='published'
      and coalesce(e.starts_at,e.enrolled_at)<=now()
      and now()<private.aca_learning_deadline(e.id)
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
      where m.enrollment_id=p_enrollment_id and m.learner_id=v_uid
        and e.status in ('active','completed')
        and now() < private.aca_installment_access_deadline(e.id)
        and c.status='published' and c.code='phase-two-ai-professional-builder'
        and coalesce(e.starts_at,e.enrolled_at)<=now()
    ) then raise exception 'Workbook access requires your authorized Phase Two enrollment'; end if;
    select coalesce(array_agg((page->>'number')::integer order by (page->>'number')::integer),'{}'::integer[])
      into v_allowed
    from jsonb_array_elements(v_def->'pages') page
    join public.lessons l on l.page_id = p_journey::text || '.' || (page->>'number')
    join public.course_journeys j on j.id=l.journey_id and j.journey_number=p_journey and j.status='published'
    join public.aca_phase_two_memberships m on m.enrollment_id=p_enrollment_id and m.course_id=l.course_id
    where l.status='published'
      and (select cal.released_at from private.aca_lesson_calendar(p_enrollment_id,l.id)cal)<=now();
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
      and now()<private.aca_phase_ends_at(e.id)
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
 select coalesce(jsonb_agg(jsonb_build_object('eventKey','lesson-release:'||e.id||':'||l.id,'enrollmentId',e.id,'learnerId',e.learner_id,'courseId',e.course_id,'lessonId',l.id,'pageId',l.page_id,'lessonTitle',l.title,'releaseAt',r.at,'phaseNumber',2,'weekend',r.weekend_ends_at is not null) order by r.at),'[]')
 from public.enrollments e join public.courses c on c.id=e.course_id and c.phase_number=2 and c.status='published'
 join public.aca_phase_two_memberships m on m.enrollment_id=e.id and m.learner_id=e.learner_id and m.course_id=e.course_id
 join public.course_journeys j on j.course_id=e.course_id and j.status='published'
 join public.lessons l on l.journey_id=j.id and l.course_id=e.course_id and l.status='published'
 cross join lateral(select cal.released_at as at,cal.weekend_ends_at from private.aca_lesson_calendar(e.id,l.id)cal) r
 where e.status='active' and p_now < private.aca_installment_access_deadline(e.id) and coalesce(e.starts_at,e.enrolled_at)<=p_now and p_now<private.aca_phase_ends_at(e.id,p_now)
 and j.journey_number between 1 and 6 and l.journey_position between 1 and 6 and l.page_id=j.journey_number::text||'.'||l.journey_position::text
 and r.at>=p_window_start and r.at<p_now
 and p_now<(select cal.first_open_until from private.aca_lesson_calendar(e.id,l.id)cal)
 and not exists(select 1 from public.aca_email_events em where em.event_key='lesson-release:'||e.id||':'||l.id and em.status in('sent','delivered'));
$function$;

CREATE OR REPLACE FUNCTION public.aca_redeem_trial(p_hash text, p_email text, p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g public.aca_trial_grants;c public.courses;e uuid;existing public.enrollments;begin
 select * into g from public.aca_trial_grants where code_hash=p_hash for update;
 if not found or g.allowed_email<>lower(trim(p_email)) or g.status not in ('ready','redeemed') or g.expires_at<=now() then raise exception 'Invitation is unavailable';end if;
 if not exists(select 1 from auth.users where id=p_user and lower(email)=g.allowed_email) then raise exception 'Invitation identity does not match';end if;
 if exists(select 1 from public.profiles where id=p_user and account_status<>'active') then raise exception 'This account requires owner review';end if;
 if g.status='redeemed' then
  if not exists(select 1 from public.enrollments where id=g.enrollment_id and learner_id=p_user) then raise exception 'Invitation identity does not match';end if;
  return jsonb_build_object('enrollment_id',g.enrollment_id,'grant_id',g.id,'duplicate',true);
 end if;
 select * into c from public.courses where id=g.course_id and status='published';if not found then raise exception 'Phase is not available';end if;
 -- Another invitation for the same recipient must resume their valid trial.
 -- Do not attach it to, extend, restore, or replace the existing enrollment:
 -- its original grant remains the authority for dates and revocation.
 select * into existing from public.enrollments
 where learner_id=p_user and course_id=g.course_id for update;
 if found then
  if existing.status in ('active','completed') and existing.access_expires_at>now()
   and exists(select 1 from public.aca_trial_grants original
    where original.enrollment_id=existing.id and original.allowed_email=g.allowed_email
     and original.course_id=g.course_id and original.status='redeemed' and original.expires_at>now())
   and not exists(select 1 from public.aca_trial_grants original
    where original.enrollment_id=existing.id and original.status in ('revoked','converted'))
   and not exists(select 1 from public.aca_installment_plans where enrollment_id=existing.id)
   and not exists(select 1 from public.aca_payment_events
    where lower(customer_email)=g.allowed_email and course_id=g.course_id
     and status='completed' and outcome='paid')
   and (c.phase_number<>2 or exists(select 1 from public.aca_phase_two_memberships
    where enrollment_id=existing.id and cohort_id is not distinct from g.cohort_id)) then
   return jsonb_build_object('enrollment_id',existing.id,'grant_id',g.id,'duplicate',true,'existing_trial',true);
  end if;
  raise exception 'An existing enrollment requires owner review';
 end if;
 if c.phase_number=2 and g.cohort_id is not null and not exists(select 1 from public.aca_phase_two_cohorts where id=g.cohort_id and course_id=g.course_id and status='active') then raise exception 'Cohort is unavailable';end if;
 insert into public.profiles(id,account_status) values(p_user,'active') on conflict(id) do nothing;
 insert into public.enrollments(learner_id,course_id,status,starts_at,access_expires_at) values(p_user,g.course_id,'active',g.starts_at,g.expires_at) returning id into e;
 if c.phase_number=2 then insert into public.aca_phase_two_memberships(enrollment_id,learner_id,course_id,cohort_id) values(e,p_user,g.course_id,g.cohort_id);end if;
 update public.aca_trial_grants set status='redeemed',enrollment_id=e,updated_at=now() where id=g.id;
 return jsonb_build_object('enrollment_id',e,'grant_id',g.id,'duplicate',false);
end $function$;

CREATE OR REPLACE FUNCTION private.aca_trial_paid_conversion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g record;begin
 if new.status='completed' and new.outcome='paid' and new.event_type='checkout.session.completed' then
  for g in select t.id,t.enrollment_id,c.default_access_days from public.aca_trial_grants t join public.enrollments e on e.id=t.enrollment_id join auth.users u on u.id=e.learner_id join public.courses c on c.id=e.course_id
   where t.status in ('redeemed','revoked') and lower(u.email)=lower(new.customer_email) and e.course_id=new.course_id loop
   update public.enrollments set status='active',access_expires_at=null,updated_at=now() where id=g.enrollment_id;
   update public.aca_trial_grants set status='converted',updated_at=now() where id=g.id;
  end loop;
 end if;return new;
end $function$;

CREATE OR REPLACE FUNCTION public.aca_control_action(p_actor uuid, p_request uuid, p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;v_result jsonb;v_id uuid;v_course public.courses;v_grant public.aca_trial_grants;v_en public.enrollments;v_expected timestamptz;begin
 if not exists(select 1 from private.aca_curriculum_reviewers where user_id=p_actor) then raise exception 'Owner authorization required';end if;
 perform set_config('aca.actor_id',p_actor::text,true);
 insert into public.aca_owner_requests(request_id,actor_id,action,payload_hash) values(p_request,p_actor,p_action,md5(p_payload::text)) on conflict do nothing;
 select * into r from public.aca_owner_requests where request_id=p_request for update;
 if r.actor_id<>p_actor or r.action<>p_action or r.payload_hash<>md5(p_payload::text) then raise exception 'Request identifier conflict';end if;
 if r.result is not null then return r.result;end if;
 v_id:=nullif(p_payload->>'id','')::uuid;v_expected:=nullif(p_payload->>'updated_at','')::timestamptz;
 if p_action='trial_create' then
  select * into v_course from public.courses where id=(p_payload->>'course_id')::uuid and phase_number in (1,2);
  if not found or v_course.status<>'published' then raise exception 'Publish the phase before granting learner access';end if;
  if length(p_payload->>'email')>254 or not (p_payload->>'email' ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Valid recipient email required';end if;
  if length(p_payload->>'code_hash')<>64 then raise exception 'Invalid invitation code';end if;
  if (p_payload->>'expires_at')::timestamptz<=now() then raise exception 'Trial end must be in the future';end if;
  if v_course.phase_number=2 and nullif(p_payload->>'cohort_id','') is not null and not exists(select 1 from public.aca_phase_two_cohorts where id=(p_payload->>'cohort_id')::uuid and course_id=v_course.id and status='active') then raise exception 'Select an active Phase Two cohort';end if;
  insert into public.aca_trial_grants(code_hash,allowed_email,course_id,cohort_id,starts_at,expires_at,created_by)
  values(p_payload->>'code_hash',lower(trim(p_payload->>'email')),v_course.id,nullif(p_payload->>'cohort_id','')::uuid,(p_payload->>'starts_at')::timestamptz,(p_payload->>'expires_at')::timestamptz,p_actor) returning id into v_id;
 elsif p_action='trial_revoke' then
  select * into v_grant from public.aca_trial_grants where id=v_id for update;
  if not found then raise exception 'Trial not found';end if;
  if v_grant.status='converted' then raise exception 'Paid access cannot be revoked as a trial';end if;
  if v_grant.enrollment_id is not null then
   if exists(select 1 from public.aca_installment_plans where enrollment_id=v_grant.enrollment_id) then raise exception 'Payment-plan access requires billing review';end if;
   update public.enrollments set status='expired',updated_at=now() where id=v_grant.enrollment_id;
  end if;
  update public.aca_trial_grants set status='revoked',updated_at=now() where id=v_id;
 elsif p_action='lesson_schedule' then
  if (p_payload->>'offset_days')::int not between 0 and 730 then raise exception 'Release offset must be between 0 and 730 days';end if;
  if not exists(select 1 from public.lessons l join public.courses c on c.id=l.course_id where l.id=v_id and c.phase_number=1) then raise exception 'Phase Two releases use cohort schedules';end if;
  if exists(select 1 from public.lesson_access_windows where lesson_id=v_id and started_at is not null) then raise exception 'This lesson has already opened; preserve its schedule';end if;
  update public.lessons set unlock_offset_days=(p_payload->>'offset_days')::int,updated_at=now() where id=v_id and updated_at=v_expected;
  if not found then raise exception 'Record changed; refresh before saving';end if;
 elsif p_action='course_status' then
  if p_payload->>'status' not in ('published','draft') then raise exception 'Invalid phase status';end if;
  select * into v_course from public.courses where id=v_id and phase_number in (1,2) for update;
  if not found or v_course.updated_at is distinct from v_expected then raise exception 'Record changed; refresh before saving';end if;
  if p_payload->>'status'='draft' and exists(select 1 from public.enrollments where course_id=v_id and status='active') then raise exception 'Active enrollments prevent returning this phase to draft';end if;
  if p_payload->>'status'='published' then
   if (select count(*) from public.lessons where course_id=v_id and status<>'archived')<>36 or (select count(*) from public.course_journeys where course_id=v_id and status<>'archived')<>6 then raise exception 'A complete six-journey phase is required';end if;
   update public.course_journeys set status='published',updated_at=now() where course_id=v_id and status<>'archived';
   update public.lessons set status='published',updated_at=now() where course_id=v_id and status<>'archived';
  end if;
  update public.courses set status=p_payload->>'status',updated_at=now() where id=v_id;
 elsif p_action='enrollment_access' then
  select * into v_en from public.enrollments where id=v_id for update;
  if not found or v_en.updated_at is distinct from v_expected then raise exception 'Record changed; refresh before saving';end if;
  if p_payload->>'status' not in ('paused','active') then raise exception 'Invalid enrollment status';end if;
  if p_payload->>'status'='active' and exists(select 1 from public.aca_installment_plans where enrollment_id=v_id and status in ('grace','paused','canceled')) then raise exception 'Resolve the installment restriction before restoring access';end if;
  if v_en.status not in ('active','paused') then raise exception 'This enrollment needs a separate access review';end if;
  if p_payload->>'status'='active' and (v_en.access_expires_at<=now() or exists(select 1 from public.aca_trial_grants where enrollment_id=v_id and status='revoked')) then raise exception 'Expired or revoked access cannot be restored here';end if;
  update public.enrollments set status=p_payload->>'status',updated_at=now() where id=v_id;
 elsif p_action='label_record' then
  if p_payload->>'label' not in ('standard','founder','fixture') then raise exception 'Invalid record label';end if;
  insert into public.aca_enrollment_labels(enrollment_id,label) values(v_id,p_payload->>'label') on conflict(enrollment_id) do update set label=excluded.label,updated_at=now();
 elsif p_action='cohort_save' then
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_payload->>'timezone') then raise exception 'Choose a valid IANA timezone';end if;
  if extract(isodow from (p_payload->>'starts_monday')::date)<>1 then raise exception 'The cohort must start on a Monday';end if;
  if p_payload->>'status' not in ('draft','scheduled','active','closed') then raise exception 'Invalid cohort status';end if;
  if v_id is not null and exists(select 1 from public.aca_phase_two_memberships where cohort_id=v_id) then raise exception 'An enrolled cohort schedule is locked; use individual access extensions';end if;
  select * into v_course from public.courses where id=(p_payload->>'course_id')::uuid and phase_number=2;
  if not found then raise exception 'Select Phase Two';end if;
  if v_id is null then
   insert into public.aca_phase_two_cohorts(course_id,cohort_code,starts_monday,iana_timezone,release_local_time,status) values(v_course.id,left(p_payload->>'code',80),(p_payload->>'starts_monday')::date,p_payload->>'timezone',(p_payload->>'release_time')::time,p_payload->>'status') returning id into v_id;
  else
   update public.aca_phase_two_cohorts set starts_monday=(p_payload->>'starts_monday')::date,iana_timezone=p_payload->>'timezone',release_local_time=(p_payload->>'release_time')::time,status=p_payload->>'status',updated_at=now() where id=v_id and updated_at=v_expected;
   if not found then raise exception 'Record changed; refresh before saving';end if;
  end if;
 elsif p_action='access_extension' then
  if length(trim(p_payload->>'reason'))<10 then raise exception 'Record a clear reason for this extension';end if;
  if (p_payload->>'ends_at')::timestamptz<=(p_payload->>'begins_at')::timestamptz or (p_payload->>'ends_at')::timestamptz>(p_payload->>'begins_at')::timestamptz+interval '7 days' then raise exception 'Extensions must be positive and no longer than seven days';end if;
  select e.* into v_en from public.enrollments e join public.courses c on c.id=e.course_id and c.phase_number=2 where e.id=(p_payload->>'enrollment_id')::uuid and e.status='active';
  if not found or not exists(select 1 from public.lessons where id=(p_payload->>'lesson_id')::uuid and course_id=v_en.course_id) then raise exception 'Choose a lesson in an active Phase Two enrollment';end if;
  insert into public.aca_phase_two_access_extensions(enrollment_id,learner_id,lesson_id,begins_at,ends_at,approved_by,justification)
  values(v_en.id,v_en.learner_id,(p_payload->>'lesson_id')::uuid,(p_payload->>'begins_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,p_actor,left(p_payload->>'reason',1000)) returning id into v_id;
 elsif p_action='feedback_update' then
  if p_payload->>'status' not in ('open','reviewing','resolved') then raise exception 'Invalid feedback status';end if;
  update public.aca_learner_feedback set status=p_payload->>'status',owner_note=left(p_payload->>'note',2000),updated_at=now() where id=v_id and updated_at=v_expected;
  if not found then raise exception 'Record changed; refresh before saving';end if;
 else raise exception 'Unknown owner action';end if;
 v_result:=jsonb_build_object('ok',true,'id',v_id);
 update public.aca_owner_requests set result=v_result where request_id=p_request;
 return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.aca_control_learner(p_enrollment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e record;v_state jsonb;begin
 select * into e from private.aca_control_enrollment_rows where id=p_enrollment_id;if not found then raise exception 'Enrollment not found';end if;
 if e.phase_number=1 then select to_jsonb(s) into v_state from public.get_enrollment_lesson_access(e.id) s;end if;
 return jsonb_build_object('enrollment',to_jsonb(e),'access_state',v_state,
 'lessons',(select coalesce(jsonb_agg(to_jsonb(x) order by x.course_position),'[]') from(select l.id,l.page_id,l.title,l.course_position,l.unlock_offset_days,l.status,j.journey_number,j.status journey_status,
 lp.status progress_status,lp.last_step,lp.artifact_saved,lp.required_revision_completed,lp.started_at,lp.completed_at,
 w.status window_status,w.started_at window_started_at,null::timestamptz phase_one_deadline,
 pw.first_opened_at,null::timestamptz phase_two_deadline,
 coalesce(w.study_state,pw.study_state) study_state,
 (select cal.first_open_until from private.aca_lesson_calendar(e.id,l.id)cal) first_open_until,
 case when w.id is not null then ceil((7200000-private.aca_study_used_ms(w.study_used_ms,w.study_state,w.last_seen_at,now()))/1000.0)::integer
 when pw.enrollment_id is not null then ceil((7200000-private.aca_study_used_ms(pw.study_used_ms,pw.study_state,pw.last_seen_at,now()))/1000.0)::integer end study_remaining_seconds,
 (select cal.released_at from private.aca_lesson_calendar(e.id,l.id)cal) scheduled_release,
 (select cal.weekend_ends_at from private.aca_lesson_calendar(e.id,l.id)cal) weekend_ends_at,
 (select max(ex.ends_at) from public.aca_phase_two_access_extensions ex where ex.enrollment_id=e.id and ex.lesson_id=l.id and now() between ex.begins_at and ex.ends_at) extension_ends_at,
 co.status cohort_status from public.lessons l join public.course_journeys j on j.id=l.journey_id
 left join public.lesson_progress lp on lp.enrollment_id=e.id and lp.lesson_id=l.id
 left join public.lesson_access_windows w on w.enrollment_id=e.id and w.lesson_id=l.id
 left join public.aca_phase_two_lesson_windows pw on pw.enrollment_id=e.id and pw.lesson_id=l.id
 left join public.aca_phase_two_memberships m on m.enrollment_id=e.id
 left join public.aca_phase_two_cohorts co on co.id=m.cohort_id where l.course_id=e.course_id) x),
 'workbooks',(select coalesce(jsonb_agg(jsonb_build_object('workbook',workbook_key,'revision',revision,'updated_at',updated_at)),'[]') from public.aca_workbook_responses where learner_id=e.learner_id and course_id=e.course_id),
 'phase_two_workbooks',(select coalesce(jsonb_agg(jsonb_build_object('journey',journey_number,'revision',revision,'updated_at',updated_at)),'[]') from public.aca_phase_two_workbook_responses where enrollment_id=e.id),
 'project',(select jsonb_build_object('title',project_title,'version',version_number,'updated_at',updated_at) from public.aca_phase_two_project_records where enrollment_id=e.id),
 'emails',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select id,subject,template_key,status,sent_at,delivered_at,created_at,last_error,provider_message_id from public.aca_email_events where enrollment_id=e.id order by created_at desc limit 100)x),
 'activity',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from public.aca_owner_activity where enrollment_id=e.id order by occurred_at desc limit 100)x));
end $function$
;

-- Owner access labels use the same derived phase boundary.
SET LOCAL search_path=public,private,auth;
CREATE OR REPLACE VIEW private.aca_control_enrollment_rows AS
 SELECT e.id,
    e.learner_id,
    e.course_id,
    e.status,
    e.enrolled_at,
    e.starts_at,
    e.access_expires_at,
    e.completed_at,
    e.created_at,
    e.updated_at,
    e.onboarding_completed_at,
    u.email,
    u.invited_at,
    u.last_sign_in_at,
    p.display_name,
    p.first_name,
    p.account_status,
    c.title AS course_title,
    c.phase_number,
    c.status AS course_status,
    COALESCE(lbl.label,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM private.aca_curriculum_reviewers r
              WHERE r.user_id = e.learner_id)) THEN 'founder'::text
            ELSE NULL::text
        END) AS record_label,
        CASE
            WHEN pay.stripe_session_id ~~ 'cs_test_%'::text THEN 'sandbox'::text
            WHEN pay.stripe_session_id ~~ 'cs_live_%'::text THEN 'live'::text
            ELSE 'unrecorded'::text
        END AS payment_mode,
        CASE
            WHEN tg.id IS NOT NULL THEN 'trial'::text
            WHEN pl.id IS NOT NULL THEN 'installments'::text
            WHEN pay.stripe_session_id IS NOT NULL THEN 'one_time'::text
            ELSE 'direct'::text
        END AS enrollment_type,
        CASE
            WHEN e.status <> ALL (ARRAY['active'::text, 'completed'::text]) THEN e.status
            WHEN p.account_status <> 'active'::text THEN 'account restricted'::text
            WHEN private.aca_phase_ends_at(e.id) <= now() THEN 'expired'::text
            WHEN COALESCE(e.starts_at, e.enrolled_at) > now() THEN 'scheduled'::text
            ELSE 'active'::text
        END AS effective_access,
    jsonb_build_object('kind',
        CASE
            WHEN pl.id IS NOT NULL THEN 'installments'::text
            WHEN pay.stripe_session_id IS NOT NULL THEN 'one_time'::text
            ELSE 'direct'::text
        END, 'status', COALESCE(pl.status,
        CASE
            WHEN pay.stripe_session_id IS NOT NULL THEN 'paid'::text
            ELSE 'no payment record'::text
        END), 'paid', COALESCE(pl.paid_amount, pay.amount_total, 0), 'total', COALESCE(pl.total_amount, pay.amount_total, 0), 'currency', COALESCE(pay.currency, 'usd'::text), 'completed', pl.payments_completed, 'next_due_at', pl.next_due_at, 'next_amount', pl.next_amount, 'grace_until', pl.grace_until, 'reminder_sent_for_due_at', pl.reminder_sent_for_due_at) AS payment,
    ( SELECT count(*)::integer AS count
           FROM lesson_progress lp
          WHERE lp.enrollment_id = e.id AND lp.status = 'completed'::text) AS lessons_completed,
    ( SELECT count(*)::integer AS count
           FROM lessons l
          WHERE l.course_id = e.course_id AND l.status <> 'archived'::text) AS total_lessons,
    ( SELECT l.page_id
           FROM lesson_progress lp
             JOIN lessons l ON l.id = lp.lesson_id
          WHERE lp.enrollment_id = e.id
          ORDER BY lp.updated_at DESC
         LIMIT 1) AS last_lesson,
    ( SELECT max(lp.updated_at) AS max
           FROM lesson_progress lp
          WHERE lp.enrollment_id = e.id) AS last_learning_activity
   FROM enrollments e
     JOIN auth.users u ON u.id = e.learner_id
     JOIN profiles p ON p.id = e.learner_id
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN aca_enrollment_labels lbl ON lbl.enrollment_id = e.id
     LEFT JOIN LATERAL ( SELECT x.id,
            x.learner_id,
            x.enrollment_id,
            x.course_id,
            x.customer_email,
            x.stripe_customer_id,
            x.stripe_subscription_id,
            x.stripe_schedule_id,
            x.stripe_first_invoice_id,
            x.status,
            x.total_amount,
            x.paid_amount,
            x.payments_completed,
            x.second_due_at,
            x.third_due_at,
            x.next_due_at,
            x.next_amount,
            x.grace_until,
            x.reminder_sent_for_due_at,
            x.created_at,
            x.updated_at
           FROM aca_installment_plans x
          WHERE x.enrollment_id = e.id
          ORDER BY x.created_at DESC
         LIMIT 1) pl ON true
     LEFT JOIN LATERAL ( SELECT x.stripe_event_id,
            x.stripe_session_id,
            x.customer_email,
            x.amount_total,
            x.currency,
            x.status,
            x.error_message,
            x.processed_at,
            x.created_at,
            x.updated_at,
            x.event_type,
            x.livemode,
            x.outcome,
            x.course_id
           FROM aca_payment_events x
          WHERE lower(x.customer_email) = lower(u.email::text) AND x.status = 'completed'::text AND x.stripe_session_id ~~ 'cs_%'::text AND (x.course_id = e.course_id OR x.course_id IS NULL AND c.phase_number = 1)
          ORDER BY x.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT x.id
           FROM aca_trial_grants x
          WHERE x.enrollment_id = e.id AND x.status = 'redeemed'::text
         LIMIT 1) tg ON true;
