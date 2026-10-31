-- Restore the founder's 120-minute active-study budget in the existing ledgers.
-- Calendar release policy is deliberately unchanged by this timer correction.
alter table public.lesson_access_windows
  add column study_used_ms bigint not null default 0 check (study_used_ms between 0 and 7200000),
  add column study_state text not null default 'paused' check (study_state in ('running','paused')),
  add column study_token uuid;
alter table public.aca_phase_two_lesson_windows
  add column study_used_ms bigint not null default 0 check (study_used_ms between 0 and 7200000),
  add column study_state text not null default 'paused' check (study_state in ('running','paused')),
  add column study_token uuid,
  add column last_seen_at timestamptz;

-- Materialize the old effective closed state before the cutover. Never reopen
-- completed/expired history or grant another allowance to an old closed row.
update public.lesson_access_windows set
  study_used_ms=case when status='active' then least(7200000,greatest(0,floor(extract(epoch from now()-started_at)*1000)::bigint))
    else least(7200000,greatest(0,active_seconds::bigint*1000)) end,
  status=case when status='active' and started_at+interval '2 hours'<=now() then 'expired' else status end,
  closed_at=case when status='active' and started_at+interval '2 hours'<=now() then started_at+interval '2 hours' else closed_at end;
update public.aca_phase_two_lesson_windows set
  study_used_ms=least(7200000,greatest(0,floor(extract(epoch from least(now(),deadline_at)-first_opened_at)*1000)::bigint)),
  last_seen_at=now();

-- Only a recent, confirmed study interval can consume time. An unconfirmed
-- offline/sleep/power-loss gap is never charged. No client-supplied duration.
create or replace function private.aca_study_used_ms(p_used bigint,p_state text,p_seen timestamptz,p_at timestamptz)
returns bigint language sql immutable set search_path='' as $$
 select least(7200000,coalesce(p_used,0)+case when p_state='running'
   and p_at>=p_seen and p_at-p_seen<=interval '45 seconds'
   then floor(extract(epoch from p_at-p_seen)*1000)::bigint else 0 end);
$$;
create or replace function private.aca_study_status(w public.lesson_access_windows,p_at timestamptz)
returns text language sql stable set search_path='' as $$
 select case when w.status='active' and private.aca_study_used_ms(w.study_used_ms,w.study_state,w.last_seen_at,p_at)>=7200000
   then 'expired' else coalesce(w.status,'not_started') end;
$$;
revoke all on function private.aca_study_used_ms(bigint,text,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function private.aca_study_status(public.lesson_access_windows,timestamptz) from public,anon,authenticated;

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
    and private.aca_study_status(w, p_at) in ('completed', 'expired');

  select
    l.id,
    l.journey_id,
    l.course_position,
    l.unlock_offset_days,
    w.status as window_status,
    floor(private.aca_study_used_ms(w.study_used_ms,w.study_state,w.last_seen_at,p_at)/1000.0)::integer as used_seconds
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
    and private.aca_study_status(w, p_at) not in ('completed', 'expired')
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
     and private.aca_study_status(w, p_at) in ('completed', 'expired')
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

  select coalesce(w.closed_at,w.completed_at,w.last_seen_at,w.updated_at)
  into v_previous_closed_at
  from public.lessons l
  join public.lesson_access_windows w
    on w.enrollment_id = v_enrollment.id
   and w.lesson_id = l.id
   and private.aca_study_status(w, p_at) in ('completed', 'expired')
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
        private.aca_study_status(w, p_at) in ('completed', 'expired')
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
$function$
;
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
 select least(private.aca_installment_access_deadline(e.id),coalesce(e.access_expires_at,'infinity'::timestamptz)) into v_limit
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
 select least(private.aca_installment_access_deadline(e.id),coalesce(e.access_expires_at,'infinity'::timestamptz)) into v_limit from public.enrollments e where e.id=p_enrollment_id;
 if v_extension is not null or v_weekend is not null then
   deadline_at:=least(coalesce(v_extension,v_weekend),v_limit);
   access_status:=case when now()<deadline_at then 'active' else 'closed' end;
   remaining_seconds:=greatest(0,ceil(extract(epoch from deadline_at-now()))::integer);
 else
   select * into w from public.aca_phase_two_lesson_windows a where a.enrollment_id=p_enrollment_id and a.lesson_id=p_lesson_id;
   if not found then
     access_status:='available'; deadline_at:=null; remaining_seconds:=0;
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

-- One validated session contract for both existing phase ledgers. Tokens and row
-- locks serialize tabs; a late pause/heartbeat cannot alter a resumed session.
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
 least(private.aca_installment_access_deadline(e.id),coalesce(e.access_expires_at,'infinity'::timestamptz))
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

-- Preserve the legacy return signature without retaining a second clock.
create or replace function public.heartbeat_lesson_access(p_enrollment_id uuid,p_lesson_id uuid)
returns table(access_status text,active_seconds integer,remaining_seconds integer)
language plpgsql security definer set search_path='' as $$
declare v_token uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select w.study_token into v_token from public.lesson_access_windows w
 where w.enrollment_id=p_enrollment_id and w.lesson_id=p_lesson_id and w.learner_id=auth.uid();
 if not found then raise exception 'This lesson session is closed'; end if;
 -- A cached legacy reader has already deliberately opened the lesson through
 -- touch_lesson_access, but cannot supply the new token. Start its existing
 -- saved budget once; do not mistake its first heartbeat for a stale tab.
 if v_token is null then
   return query select s.access_status,s.active_seconds,s.remaining_seconds from public.manage_lesson_study_session(p_enrollment_id,p_lesson_id,'start',null)s;
   return;
 end if;
 return query select s.access_status,s.active_seconds,s.remaining_seconds from public.manage_lesson_study_session(p_enrollment_id,p_lesson_id,'heartbeat',v_token)s;
end; $$;

revoke all on function public.manage_lesson_study_session(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.manage_lesson_study_session(uuid,uuid,text,uuid) to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.lesson_access_windows,public.aca_phase_two_lesson_windows from anon,authenticated;

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
 case when w.id is not null then ceil((7200000-private.aca_study_used_ms(w.study_used_ms,w.study_state,w.last_seen_at,now()))/1000.0)::integer
 when pw.enrollment_id is not null then ceil((7200000-private.aca_study_used_ms(pw.study_used_ms,pw.study_state,pw.last_seen_at,now()))/1000.0)::integer end study_remaining_seconds,
 case when co.id is not null then ((co.starts_monday+((j.journey_number-1)*7+l.journey_position-1))::timestamp+co.release_local_time) at time zone co.iana_timezone else coalesce(e.starts_at,e.enrolled_at)+make_interval(days=>l.unlock_offset_days) end scheduled_release,
 case when co.id is not null and l.journey_position=6 then (co.starts_monday+j.journey_number*7)::timestamp at time zone co.iana_timezone end weekend_ends_at,
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
