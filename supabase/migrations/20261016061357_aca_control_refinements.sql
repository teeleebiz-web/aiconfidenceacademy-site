create or replace function public.aca_control_snapshot(p_offset integer default 0,p_search text default '',p_phase integer default 0,p_scope text default 'operational') returns jsonb
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
 'lessons',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'course_id',l.course_id,'journey_id',l.journey_id,'page_id',l.page_id,'title',l.title,'status',l.status,'position',l.course_position,'unlock_offset_days',l.unlock_offset_days,'updated_at',l.updated_at,'source_version',l.source_version,'has_video',coalesce(l.content->>'video_path',l.content#>>'{phase_two_production,instructor_introduction,path}') is not null,'has_audio',l.content->>'audio_path' is not null,'production',jsonb_build_object('approval_status',l.content#>>'{phase_two_production,approval_status}','production_version',l.content#>>'{phase_two_production,production_version}')) order by c.phase_number,l.course_position),'[]') from public.lessons l join public.courses c on c.id=l.course_id where c.phase_number in (1,2)),
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

-- Keep owner-only feedback notes out of learner column grants.
revoke select on public.aca_learner_feedback from authenticated;
grant select(id,request_id,enrollment_id,learner_id,lesson_id,category,message,status,created_at,updated_at) on public.aca_learner_feedback to authenticated;
alter table public.aca_refunds add column event_created_at bigint not null default 0;
create function public.aca_record_refund(p_refund jsonb,p_created bigint) returns void
language sql security invoker set search_path='' as $$
 insert into public.aca_refunds(provider_refund_id,charge_id,customer_email,amount,currency,livemode,status,event_created_at)
 values(p_refund->>'provider_refund_id',p_refund->>'charge_id',p_refund->>'customer_email',(p_refund->>'amount')::int,p_refund->>'currency',(p_refund->>'livemode')::boolean,p_refund->>'status',p_created)
 on conflict(provider_refund_id) do update set charge_id=excluded.charge_id,customer_email=coalesce(excluded.customer_email,public.aca_refunds.customer_email),amount=excluded.amount,currency=excluded.currency,livemode=excluded.livemode,status=excluded.status,event_created_at=excluded.event_created_at,updated_at=now()
 where public.aca_refunds.event_created_at<=excluded.event_created_at;
$$;
revoke all on function public.aca_record_refund(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.aca_record_refund(jsonb,bigint) to service_role;
create function public.aca_phase_two_release_candidates(p_window_start timestamptz,p_now timestamptz) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('eventKey','lesson-release:'||e.id||':'||l.id,'enrollmentId',e.id,'learnerId',e.learner_id,'courseId',e.course_id,'lessonId',l.id,'pageId',l.page_id,'lessonTitle',l.title,'releaseAt',r.at,'phaseNumber',2,'weekend',l.journey_position=6) order by r.at),'[]')
 from public.enrollments e join public.courses c on c.id=e.course_id and c.phase_number=2 and c.status='published'
 join public.aca_phase_two_memberships m on m.enrollment_id=e.id and m.learner_id=e.learner_id and m.course_id=e.course_id
 join public.aca_phase_two_cohorts co on co.id=m.cohort_id and co.status='active'
 join public.course_journeys j on j.course_id=e.course_id and j.status='published'
 join public.lessons l on l.journey_id=j.id and l.course_id=e.course_id and l.status='published'
 cross join lateral(select ((co.starts_monday+((j.journey_number-1)*7+l.journey_position-1))::timestamp+co.release_local_time) at time zone co.iana_timezone as at) r
 where e.status='active' and coalesce(e.starts_at,e.enrolled_at)<=p_now and (e.access_expires_at is null or e.access_expires_at>p_now)
 and j.journey_number between 1 and 6 and l.journey_position between 1 and 6 and l.page_id=j.journey_number::text||'.'||l.journey_position::text
 and r.at>=p_window_start and r.at<p_now
 and not exists(select 1 from public.aca_email_events em where em.event_key='lesson-release:'||e.id||':'||l.id and em.status in('sent','delivered'));
$$;
revoke all on function public.aca_phase_two_release_candidates(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.aca_phase_two_release_candidates(timestamptz,timestamptz) to service_role;
