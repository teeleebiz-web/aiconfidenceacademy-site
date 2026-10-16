-- Owner operations use the existing private allowlist. No client receives privileged credentials.
create table public.aca_owner_activity (
 id uuid primary key default gen_random_uuid(), occurred_at timestamptz not null default now(),
 actor_id uuid, entity text not null, entity_id text, enrollment_id uuid,
 action text not null, before_state jsonb, after_state jsonb
);
create index aca_owner_activity_time_idx on public.aca_owner_activity(occurred_at desc);
create index aca_owner_activity_enrollment_idx on public.aca_owner_activity(enrollment_id,occurred_at desc);
create table public.aca_trial_grants (
 id uuid primary key default gen_random_uuid(), code_hash text not null unique,
 allowed_email text not null, course_id uuid not null references public.courses(id),
 cohort_id uuid references public.aca_phase_two_cohorts(id),
 starts_at timestamptz not null, expires_at timestamptz not null,
 status text not null default 'ready' check(status in ('ready','redeemed','revoked','converted')),
 enrollment_id uuid references public.enrollments(id), created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(expires_at>starts_at),check(expires_at<=starts_at+interval '180 days')
);
create index aca_trial_grants_enrollment_idx on public.aca_trial_grants(enrollment_id);
create index aca_trial_grants_course_idx on public.aca_trial_grants(course_id);
create index aca_trial_grants_cohort_idx on public.aca_trial_grants(cohort_id);
create index aca_trial_grants_creator_idx on public.aca_trial_grants(created_by);
create table public.aca_enrollment_labels (
 enrollment_id uuid primary key references public.enrollments(id),
 label text not null check(label in ('standard','founder','fixture')), updated_at timestamptz not null default now()
);
create table public.aca_learner_feedback (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 enrollment_id uuid not null references public.enrollments(id), learner_id uuid not null references auth.users(id),
 lesson_id uuid references public.lessons(id), category text not null check(category in ('access','video','audio','workbook','payment','email','feedback','other')),
 message text not null check(length(message) between 5 and 4000),
 status text not null default 'open' check(status in ('open','reviewing','resolved')),
 owner_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index aca_feedback_enrollment_idx on public.aca_learner_feedback(enrollment_id,created_at desc);
create index aca_feedback_learner_idx on public.aca_learner_feedback(learner_id);
create index aca_feedback_lesson_idx on public.aca_learner_feedback(lesson_id);
create table public.aca_automation_runs (
 id uuid primary key default gen_random_uuid(), job text not null, started_at timestamptz not null default now(),
 finished_at timestamptz, status text not null default 'running', result jsonb
);
create index aca_automation_runs_job_idx on public.aca_automation_runs(job,started_at desc);
create table public.aca_owner_requests (
 request_id uuid primary key, actor_id uuid not null, action text not null,payload_hash text not null,result jsonb,
 created_at timestamptz not null default now()
);
create table public.aca_trial_request_limits (
 key text primary key, attempts integer not null default 1, expires_at timestamptz not null
);
create table public.aca_refunds (
 provider_refund_id text primary key, charge_id text, customer_email text, amount integer not null,
 currency text not null,livemode boolean not null,status text not null,updated_at timestamptz not null default now()
);
alter table public.aca_payment_events add column if not exists event_type text;
alter table public.aca_payment_events add column if not exists livemode boolean;
alter table public.aca_payment_events add column if not exists outcome text;
alter table public.aca_payment_events add column if not exists course_id uuid references public.courses(id);
create index aca_payment_events_course_idx on public.aca_payment_events(course_id);
do $$ declare t text; begin
 foreach t in array array['aca_owner_activity','aca_trial_grants','aca_enrollment_labels','aca_learner_feedback','aca_automation_runs','aca_owner_requests','aca_trial_request_limits','aca_refunds'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end $$;
grant select on public.aca_learner_feedback to authenticated;
create policy aca_feedback_own_read on public.aca_learner_feedback for select to authenticated using(learner_id=(select auth.uid()));

create or replace function private.aca_record_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare oldj jsonb;newj jsonb;eid uuid;actor uuid;begin
 if TG_OP<>'INSERT' then oldj:=to_jsonb(old);end if;
 if TG_OP<>'DELETE' then newj:=to_jsonb(new);end if;
 select coalesce(jsonb_object_agg(k,v),'{}') into oldj from jsonb_each(coalesce(oldj,'{}')) e(k,v)
 where k=any(array['id','status','course_id','lesson_id','page_id','unlock_offset_days','release_offset_days','starts_at','access_expires_at','onboarding_completed_at','paid_amount','payments_completed','next_due_at','next_amount','grace_until','last_step','artifact_saved','completed_at','started_at','closed_at','deadline_at','begins_at','ends_at','expires_at','cohort_code','starts_monday','iana_timezone','release_local_time','label','provider_message_id','sent_at','delivered_at','category']);
 select coalesce(jsonb_object_agg(k,v),'{}') into newj from jsonb_each(coalesce(newj,'{}')) e(k,v)
 where k=any(array['id','status','course_id','lesson_id','page_id','unlock_offset_days','release_offset_days','starts_at','access_expires_at','onboarding_completed_at','paid_amount','payments_completed','next_due_at','next_amount','grace_until','last_step','artifact_saved','completed_at','started_at','closed_at','deadline_at','begins_at','ends_at','expires_at','cohort_code','starts_monday','iana_timezone','release_local_time','label','provider_message_id','sent_at','delivered_at','category']);
 if TG_OP='UPDATE' and oldj=newj then return new;end if;
 begin actor:=nullif(current_setting('aca.actor_id',true),'')::uuid;exception when others then actor:=null;end;
 actor:=coalesce(actor,auth.uid());
 eid:=nullif(coalesce(to_jsonb(new)->>'enrollment_id',case when TG_TABLE_NAME='enrollments' then to_jsonb(new)->>'id' end),'')::uuid;
 insert into public.aca_owner_activity(actor_id,entity,entity_id,enrollment_id,action,before_state,after_state)
 values(actor,TG_TABLE_NAME,coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'stripe_event_id',to_jsonb(new)->>'enrollment_id'),eid,lower(TG_OP),oldj,newj);
 return new;
end $$;
revoke all on function private.aca_record_activity() from public,anon,authenticated;
do $$ declare t text;begin
 foreach t in array array['enrollments','lessons','courses','course_journeys','lesson_progress','lesson_access_windows','aca_phase_two_lesson_windows','aca_phase_two_access_extensions','aca_installment_plans','aca_email_events','aca_payment_events','aca_trial_grants','aca_enrollment_labels','aca_learner_feedback','aca_phase_two_cohorts'] loop
 execute format('create trigger aca_control_activity after insert or update on public.%I for each row execute function private.aca_record_activity()',t);
 end loop;
end $$;

create view private.aca_control_enrollment_rows as
select e.*,u.email,u.invited_at,u.last_sign_in_at,p.display_name,p.first_name,p.account_status,
 c.title as course_title,c.phase_number,c.status as course_status,
 coalesce(lbl.label,case when exists(select 1 from private.aca_curriculum_reviewers r where r.user_id=e.learner_id) then 'founder' end) as record_label,
 case when pay.stripe_session_id like 'cs_test_%' then 'sandbox' when pay.stripe_session_id like 'cs_live_%' then 'live' else 'unrecorded' end as payment_mode,
 case when tg.id is not null then 'trial' when pl.id is not null then 'installments' when pay.stripe_session_id is not null then 'one_time' else 'direct' end as enrollment_type,
 case when e.status not in ('active','completed') then e.status when p.account_status<>'active' then 'account restricted'
 when e.access_expires_at<=now() then 'expired' when coalesce(e.starts_at,e.enrolled_at)>now() then 'scheduled' else 'active' end as effective_access,
 jsonb_build_object('kind',case when pl.id is not null then 'installments' when pay.stripe_session_id is not null then 'one_time' else 'direct' end,
 'status',coalesce(pl.status,case when pay.stripe_session_id is not null then 'paid' else 'no payment record' end),
 'paid',coalesce(pl.paid_amount,pay.amount_total,0),'total',coalesce(pl.total_amount,pay.amount_total,0),
 'currency',coalesce(pay.currency,'usd'),'completed',pl.payments_completed,'next_due_at',pl.next_due_at,'next_amount',pl.next_amount,
 'grace_until',pl.grace_until,'reminder_sent_for_due_at',pl.reminder_sent_for_due_at) as payment,
 (select count(*)::int from public.lesson_progress lp where lp.enrollment_id=e.id and lp.status='completed') as lessons_completed,
 (select count(*)::int from public.lessons l where l.course_id=e.course_id and l.status<>'archived') as total_lessons,
 (select l.page_id from public.lesson_progress lp join public.lessons l on l.id=lp.lesson_id where lp.enrollment_id=e.id order by lp.updated_at desc limit 1) as last_lesson,
 (select max(lp.updated_at) from public.lesson_progress lp where lp.enrollment_id=e.id) as last_learning_activity
from public.enrollments e join auth.users u on u.id=e.learner_id join public.profiles p on p.id=e.learner_id join public.courses c on c.id=e.course_id
left join public.aca_enrollment_labels lbl on lbl.enrollment_id=e.id
left join lateral(select * from public.aca_installment_plans x where x.enrollment_id=e.id order by x.created_at desc limit 1) pl on true
left join lateral(select * from public.aca_payment_events x where lower(x.customer_email)=lower(u.email) and x.status='completed' and x.stripe_session_id like 'cs_%' and (x.course_id=e.course_id or (x.course_id is null and c.phase_number=1)) order by x.created_at desc limit 1) pay on true
left join lateral(select id from public.aca_trial_grants x where x.enrollment_id=e.id and x.status='redeemed' limit 1) tg on true;
revoke all on private.aca_control_enrollment_rows from public,anon,authenticated;

create function public.aca_control_snapshot(p_offset integer default 0,p_search text default '',p_phase integer default 0,p_scope text default 'operational') returns jsonb
language sql stable security definer set search_path='' as $$
with filtered as (select * from private.aca_control_enrollment_rows r where
 (p_phase=0 or r.phase_number=p_phase) and
 (p_scope='all' or (p_scope='sandbox' and r.payment_mode='sandbox') or (p_scope='operational' and r.payment_mode<>'sandbox' and coalesce(r.record_label,'')<>'fixture')) and
 (p_search='' or concat_ws(' ',r.display_name,r.email,r.id::text,r.last_lesson) ilike '%'||left(p_search,100)||'%'))
select jsonb_build_object(
 'updated_at',now(),'enrollments',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from filtered order by enrolled_at desc limit 25 offset greatest(0,p_offset)) r),'[]'),
 'summary',(select jsonb_build_object('enrollments',count(*),'active',count(*) filter(where effective_access='active'),'trials',count(*) filter(where enrollment_type='trial'),'paused',count(*) filter(where effective_access='paused'),
 'live_collected_usd',coalesce(sum((payment->>'paid')::int) filter(where payment_mode='live' and payment->>'currency'='usd'),0),
 'upcoming',count(*) filter(where (payment->>'next_due_at')::timestamptz>now()),'overdue',count(*) filter(where payment->>'status' in ('grace','paused')),
 'unclassified',count(*) filter(where enrollment_type='direct' and record_label is null)) from filtered),
 'courses',(select coalesce(jsonb_agg(to_jsonb(c) order by c.phase_number),'[]') from public.courses c where phase_number in (1,2)),
 'journeys',(select coalesce(jsonb_agg(to_jsonb(j) order by j.course_id,j.journey_number),'[]') from public.course_journeys j join public.courses c on c.id=j.course_id where c.phase_number in (1,2)),
 'lessons',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'course_id',l.course_id,'journey_id',l.journey_id,'page_id',l.page_id,'title',l.title,'status',l.status,'position',l.course_position,'unlock_offset_days',l.unlock_offset_days,'updated_at',l.updated_at,'source_version',l.source_version,'has_video',coalesce(l.content->>'video_path',l.content#>>'{phase_two_production,instructor_introduction,path}') is not null,'has_audio',l.content->>'audio_path' is not null,'production',l.content->'phase_two_production') order by c.phase_number,l.course_position),'[]') from public.lessons l join public.courses c on c.id=l.course_id where c.phase_number in (1,2)),
 'emails',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select em.id,em.enrollment_id,em.recipient,em.subject,em.template_key,em.status,em.attempts,em.scheduled_for,em.sent_at,em.delivered_at,em.created_at,em.updated_at,em.provider_message_id,left(em.last_error,300) as last_error from public.aca_email_events em where (p_scope='all' or em.enrollment_id in(select id from filtered)) order by em.created_at desc limit 250) x),
 'payments',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select ev.stripe_event_id,ev.stripe_session_id,ev.customer_email,ev.amount_total,ev.currency,ev.status,ev.event_type,ev.livemode,ev.outcome,ev.created_at,ev.processed_at,left(ev.error_message,300) error_message from public.aca_payment_events ev where (p_scope='all' or ev.customer_email in(select email from filtered)) order by ev.created_at desc limit 250) x),
 'refunds',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from public.aca_refunds where p_scope='all' or (p_scope='operational' and livemode) or(p_scope='sandbox' and not livemode) order by updated_at desc limit 250)x),
 'trials',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select id,allowed_email,course_id,cohort_id,starts_at,expires_at,status,enrollment_id,created_at,updated_at from public.aca_trial_grants order by created_at desc limit 250)x),
 'cohorts',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.aca_phase_two_cohorts x),
 'feedback',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from public.aca_learner_feedback where p_scope='all' or enrollment_id in(select id from filtered) order by created_at desc limit 250)x),
 'activity',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from public.aca_owner_activity where p_scope='all' or enrollment_id is null or enrollment_id in(select id from filtered) order by occurred_at desc limit 250)x),
 'automations',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select distinct on(job) * from public.aca_automation_runs order by job,started_at desc)x),
 'newsletter',jsonb_build_object('subscribers',(select count(*) from public.aca_update_subscriptions where status='active'),'sync_issues',(select count(*) from public.aca_update_subscriptions where sync_error is not null),'editions',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select week,status,dispatch_state,last_error,submitted_at from public.aca_newsletter_editions order by week desc limit 12)x))
);
$$;
revoke all on function public.aca_control_snapshot(integer,text,integer,text) from public,anon,authenticated;
grant execute on function public.aca_control_snapshot(integer,text,integer,text) to service_role;

create function public.aca_control_learner(p_enrollment_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e record;v_state jsonb;begin
 select * into e from private.aca_control_enrollment_rows where id=p_enrollment_id;if not found then raise exception 'Enrollment not found';end if;
 if e.phase_number=1 then select to_jsonb(s) into v_state from public.get_enrollment_lesson_access(e.id) s;end if;
 return jsonb_build_object('enrollment',to_jsonb(e),'access_state',v_state,
 'lessons',(select coalesce(jsonb_agg(to_jsonb(x) order by x.course_position),'[]') from(select l.id,l.page_id,l.title,l.course_position,l.unlock_offset_days,l.status,j.journey_number,j.status journey_status,
 lp.status progress_status,lp.last_step,lp.artifact_saved,lp.required_revision_completed,lp.started_at,lp.completed_at,
 w.status window_status,w.started_at window_started_at,w.started_at+interval '2 hours' phase_one_deadline,
 pw.first_opened_at,pw.deadline_at phase_two_deadline,
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
end $$;
revoke all on function public.aca_control_learner(uuid) from public,anon,authenticated;
grant execute on function public.aca_control_learner(uuid) to service_role;

create function public.aca_control_action(p_actor uuid,p_request uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
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
  if v_course.phase_number=2 and not exists(select 1 from public.aca_phase_two_cohorts where id=(p_payload->>'cohort_id')::uuid and course_id=v_course.id and status='active') then raise exception 'Select an active Phase Two cohort';end if;
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
end $$;
revoke all on function public.aca_control_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.aca_control_action(uuid,uuid,text,jsonb) to service_role;

create function public.aca_trial_rate_limit(p_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;begin
 delete from public.aca_trial_request_limits where expires_at<now();
 insert into public.aca_trial_request_limits(key) values(p_key) on conflict(key) do update set attempts=public.aca_trial_request_limits.attempts+1 returning attempts into n;
 update public.aca_trial_request_limits set expires_at=now()+interval '15 minutes' where key=p_key and expires_at is null;
 return n<=10;
end $$;
-- Explicit window is passed in the key; old windows are pruned.
alter table public.aca_trial_request_limits alter column expires_at set default now()+interval '15 minutes';
revoke all on function public.aca_trial_rate_limit(text) from public,anon,authenticated;
grant execute on function public.aca_trial_rate_limit(text) to service_role;

create function public.aca_redeem_trial(p_hash text,p_email text,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.aca_trial_grants;c public.courses;e uuid;begin
 select * into g from public.aca_trial_grants where code_hash=p_hash for update;
 if not found or g.allowed_email<>lower(trim(p_email)) or g.status not in ('ready','redeemed') or g.expires_at<=now() then raise exception 'Invitation is unavailable';end if;
 if not exists(select 1 from auth.users where id=p_user and lower(email)=g.allowed_email) then raise exception 'Invitation identity does not match';end if;
 if exists(select 1 from public.profiles where id=p_user and account_status<>'active') then raise exception 'This account requires owner review';end if;
 if g.status='redeemed' then
  if not exists(select 1 from public.enrollments where id=g.enrollment_id and learner_id=p_user) then raise exception 'Invitation identity does not match';end if;
  return jsonb_build_object('enrollment_id',g.enrollment_id,'grant_id',g.id,'duplicate',true);
 end if;
 select * into c from public.courses where id=g.course_id and status='published';if not found then raise exception 'Phase is not available';end if;
 if exists(select 1 from public.enrollments where learner_id=p_user and course_id=g.course_id) then raise exception 'An existing enrollment requires owner review';end if;
 if c.phase_number=2 and not exists(select 1 from public.aca_phase_two_cohorts where id=g.cohort_id and course_id=g.course_id and status='active') then raise exception 'Cohort is unavailable';end if;
 insert into public.profiles(id,account_status) values(p_user,'active') on conflict(id) do nothing;
 insert into public.enrollments(learner_id,course_id,status,starts_at,access_expires_at) values(p_user,g.course_id,'active',g.starts_at,g.expires_at) returning id into e;
 if c.phase_number=2 then insert into public.aca_phase_two_memberships(enrollment_id,learner_id,course_id,cohort_id) values(e,p_user,g.course_id,g.cohort_id);end if;
 update public.aca_trial_grants set status='redeemed',enrollment_id=e,updated_at=now() where id=g.id;
 return jsonb_build_object('enrollment_id',e,'grant_id',g.id,'duplicate',false);
end $$;
revoke all on function public.aca_redeem_trial(text,text,uuid) from public,anon,authenticated;
grant execute on function public.aca_redeem_trial(text,text,uuid) to service_role;

create function private.aca_trial_paid_conversion() returns trigger language plpgsql security definer set search_path='' as $$
declare g record;begin
 if new.status='completed' and new.outcome='paid' and new.event_type='checkout.session.completed' then
  for g in select t.id,t.enrollment_id,c.default_access_days from public.aca_trial_grants t join public.enrollments e on e.id=t.enrollment_id join auth.users u on u.id=e.learner_id join public.courses c on c.id=e.course_id
   where t.status in ('redeemed','revoked') and lower(u.email)=lower(new.customer_email) and e.course_id=new.course_id loop
   update public.enrollments set status='active',access_expires_at=case when g.default_access_days is null then null else now()+make_interval(days=>g.default_access_days) end,updated_at=now() where id=g.enrollment_id;
   update public.aca_trial_grants set status='converted',updated_at=now() where id=g.id;
  end loop;
 end if;return new;
end $$;
revoke all on function private.aca_trial_paid_conversion() from public,anon,authenticated;
create trigger aca_trial_paid_conversion after insert or update on public.aca_payment_events for each row execute function private.aca_trial_paid_conversion();
