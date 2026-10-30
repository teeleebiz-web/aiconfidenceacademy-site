-- Run after the migration, or concatenate both inside one rollback-only transaction.
-- Temporary fixtures only. No provider call, charge, email, or retained row.
begin;
do $$
declare
 u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); c1 uuid; c2 uuid;
 e1 uuid:=gen_random_uuid(); e2 uuid:=gen_random_uuid(); l1 uuid; l2 uuid; j2 uuid; co uuid:=gen_random_uuid();
 deadline timestamptz:=now()+interval '1 hour'; started timestamptz; stored_deadline timestamptz;
 result record; denied boolean; owner_workbook jsonb;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
   (u,'aca-deadline-'||u||'@example.com','{}'),
   (other_user,'aca-deadline-'||other_user||'@example.com','{}');
 insert into public.profiles(id,account_status) values(u,'active'),(other_user,'active') on conflict(id) do nothing;
 select id into strict c1 from public.courses where code='phase-one-chatgpt-foundations';
 select id into strict c2 from public.courses where code='phase-two-ai-professional-builder';
 select l.id into strict l1 from public.lessons l join public.course_journeys j on j.id=l.journey_id
   where l.course_id=c1 and l.page_id='1.1' and l.status='published' and j.status='published';
 select l.id,l.journey_id into strict l2,j2 from public.lessons l where l.course_id=c2 and l.page_id='1.1';
 -- These uncommitted status changes are invisible outside this transaction and roll back.
 update public.courses set status='published' where id=c2;
 update public.course_journeys set status='published' where id=j2;
 update public.lessons set status='published' where id=l2;
 insert into public.enrollments(id,learner_id,course_id,status,enrolled_at,starts_at,access_expires_at)
 values(e1,u,c1,'active',now()-interval '1 minute',now()-interval '1 minute',now()+interval '90 days'),
       (e2,u,c2,'active',now()-interval '1 minute',now()-interval '1 minute',now()+interval '42 days');
 insert into public.aca_phase_two_cohorts(id,course_id,cohort_code,starts_monday,iana_timezone,release_local_time,status)
 values(co,c2,'deadline-acceptance-'||co,date_trunc('week',now() at time zone 'UTC')::date,'UTC','00:00','active');
 insert into public.aca_phase_two_memberships(enrollment_id,learner_id,course_id,cohort_id) values(e2,u,c2,co);
 insert into public.aca_installment_plans(learner_id,enrollment_id,course_id,customer_email,stripe_subscription_id,stripe_schedule_id,status,total_amount,paid_amount,payments_completed,second_due_at,third_due_at,next_due_at,next_amount,grace_until)
 values(u,e1,c1,'aca-deadline-'||u||'@example.com','sub_deadline_'||e1,'sched_deadline_'||e1,'grace',14900,5000,1,now()-interval '1 day',now()+interval '6 days',now()-interval '1 day',5000,deadline),
       (u,e2,c2,'aca-deadline-'||u||'@example.com','sub_deadline_'||e2,'sched_deadline_'||e2,'grace',19900,6700,1,now()-interval '1 day',now()+interval '6 days',now()-interval '1 day',6600,deadline);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 assert private.aca_installment_access_deadline(gen_random_uuid())='infinity'::timestamptz,'No installment must preserve ordinary access';
 assert not has_function_privilege('anon','private.aca_installment_access_deadline(uuid)','execute'),'No anonymous billing helper';
 assert not has_function_privilege('authenticated','private.aca_installment_access_deadline(uuid)','execute'),'No learner billing helper';
 select * into strict result from public.touch_lesson_access(e1,l1);
 assert result.hard_expires_at=deadline and result.remaining_seconds between 3599 and 3600,'Phase One returned access and media duration must stop at payment deadline';
 select started_at into strict started from public.lesson_access_windows where enrollment_id=e1 and lesson_id=l1;
 assert exists(select 1 from private.lesson_access_state(e1,u,deadline-interval '1 second')),'Access remains available before the exact deadline';
 assert not exists(select 1 from private.lesson_access_state(e1,u,deadline)),'Access denied at deadline before daily maintenance';
 assert not exists(select 1 from private.lesson_access_state(e1,u,deadline+interval '1 second')),'Access denied after deadline';
 select * into strict result from public.heartbeat_lesson_access(e1,l1);
 assert result.remaining_seconds between 3599 and 3600,'Heartbeat remaining time respects payment cutoff';
 select closes_at into stored_deadline from public.open_aca_phase_two_lesson(e2,l2);
 assert stored_deadline=deadline,'Phase Two response and signed-media deadline must be capped';
 select deadline_at into strict stored_deadline from public.aca_phase_two_lesson_windows where enrollment_id=e2 and lesson_id=l2;
 assert stored_deadline=now()+interval '2 hours','Original two-hour lesson window stays stored unchanged';
 select * into strict result from public.aca_phase_two_access_status(e2,l2);
 assert result.deadline_at=deadline,'Phase Two status response must use the same payment cutoff';
 update public.aca_installment_plans set grace_until=now() where enrollment_id in(e1,e2);
 assert (select status='active' from public.enrollments where id=e1),'Fixture proves enforcement does not wait for stored paused status';
 assert not exists(select 1 from public.get_learner_lesson_access(e1)),'Learner RPC denies overdue access';
 assert not exists(select 1 from public.get_enrollment_lesson_access(e1)),'Service media/workbook RPC denies overdue access';
 denied:=false;begin perform public.touch_lesson_access(e1,l1);exception when raise_exception then denied:=true;end;assert denied,'Cannot reopen overdue lesson';
 denied:=false;begin perform public.heartbeat_lesson_access(e1,l1);exception when raise_exception then denied:=true;end;assert denied,'Cannot refresh overdue lesson';
 denied:=false;begin perform public.complete_lesson_access(e1,l1);exception when raise_exception then denied:=true;end;assert denied,'Cannot complete overdue lesson';
 assert not public.can_read_aca_welcome_media('academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.mp4'),'New welcome media authorization is denied';
 denied:=false;begin perform public.complete_aca_onboarding(e1);exception when insufficient_privilege then denied:=true;end;assert denied,'Onboarding does not bypass payment cutoff';
 denied:=false;begin perform public.open_aca_phase_two_lesson(e2,l2);exception when raise_exception then denied:=true;end;assert denied,'Phase Two opening denied';
 denied:=false;begin perform public.aca_phase_two_access_status(e2,l2);exception when raise_exception then denied:=true;end;assert denied,'Phase Two status denied';
 denied:=false;begin perform public.aca_phase_two_my_outline(e2);exception when raise_exception then denied:=true;end;assert denied,'Phase Two outline denied';
 denied:=false;begin perform public.get_aca_phase_two_workbook(e2,1);exception when raise_exception then denied:=true;end;assert denied,'Phase Two workbook denied';
 denied:=false;begin perform public.save_aca_phase_two_project(e2,'A','Acceptance fixture','{}',null);exception when raise_exception then denied:=true;end;assert denied,'Phase Two project writes denied';
 assert not exists(select 1 from jsonb_array_elements(public.aca_phase_two_release_candidates(now()-interval '7 days',now())) item where item->>'enrollmentId'=e2::text),'Release candidate scan excludes the overdue fixture';
 execute 'set local role authenticated';
 assert not exists(select 1 from public.lessons where id=l1),'Actual learner RLS denies overdue Phase One lesson';
 execute 'reset role';
 update public.aca_installment_plans set status='grace',grace_until=null where enrollment_id=e1;
 assert not exists(select 1 from public.get_learner_lesson_access(e1)),'Missing correction deadline fails closed';
 update public.aca_installment_plans set status='paused',grace_until=deadline where enrollment_id=e1;
 assert not exists(select 1 from public.get_learner_lesson_access(e1)),'Paused plan cannot regain access from a future deadline';
 -- Mirrors the existing successful-payment reconciliation; no callback or provider is called.
 update public.aca_installment_plans set status='active',grace_until=null where enrollment_id in(e1,e2);
 select * into strict result from public.touch_lesson_access(e1,l1);
 assert result.hard_expires_at=started+interval '2 hours','Recovery resumes the original window without resetting it';
 assert (select started_at=started from public.lesson_access_windows where enrollment_id=e1 and lesson_id=l1),'Saved lesson start is preserved';
 select closes_at into strict stored_deadline from public.open_aca_phase_two_lesson(e2,l2);
 assert stored_deadline=now()+interval '2 hours','Phase Two recovery keeps the original first-open deadline';
 assert (select next_due_at=now()-interval '1 day' and third_due_at=now()+interval '6 days' from public.aca_installment_plans where enrollment_id=e1),'Access enforcement never changes installment dates';
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 assert not exists(select 1 from public.get_learner_lesson_access(e1)),'Another learner cannot read the enrollment';
 denied:=false;begin perform public.open_aca_phase_two_lesson(e2,l2);exception when raise_exception then denied:=true;end;assert denied,'Phase Two enrollment identity remains enforced';
 insert into private.aca_curriculum_reviewers(user_id) values(other_user);
 owner_workbook:=public.get_aca_phase_two_workbook(null,1);
 assert owner_workbook->>'scope'='owner-review','Existing owner workbook review is unchanged';
end $$;
rollback;
select 'Payment-deadline acceptance passed for both phases, exact boundary, authorization, capped media duration, unchanged lesson windows, recovery and private helper permissions; all fixture and publication changes rolled back.' as result;
