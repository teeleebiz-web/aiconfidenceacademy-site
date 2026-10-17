-- Focused invitation regression. All fixtures and changes are rolled back.
-- No email, payment provider, curriculum, media, or schedule is changed.
begin;
do $$
declare
 learner uuid:=gen_random_uuid();owner_id uuid;course uuid;first_grant uuid;
 second_grant uuid;enrollment uuid;original jsonb;result jsonb;refused boolean;
 email text:='aca-repeat-'||gen_random_uuid()||'@example.test';
 first_hash text:=repeat(md5(gen_random_uuid()::text),2);
 second_hash text:=repeat(md5(gen_random_uuid()::text),2);state text;
begin
 select user_id into owner_id from private.aca_curriculum_reviewers limit 1;
 select id into course from public.courses where phase_number=1 and status='published';
 insert into auth.users(id,email,raw_user_meta_data) values(learner,email,'{}');
 insert into public.profiles(id,account_status) values(learner,'active') on conflict(id) do nothing;
 insert into public.aca_trial_grants(code_hash,allowed_email,course_id,starts_at,expires_at,created_by)
 values(first_hash,email,course,now()-interval '1 hour',now()+interval '56 days',owner_id) returning id into first_grant;
 result:=public.aca_redeem_trial(first_hash,email,learner);
 enrollment:=(result->>'enrollment_id')::uuid;
 select to_jsonb(e) into original from public.enrollments e where id=enrollment;
 insert into public.aca_trial_grants(code_hash,allowed_email,course_id,starts_at,expires_at,created_by)
 values(second_hash,email,course,now()-interval '1 minute',now()+interval '60 days',owner_id) returning id into second_grant;
 for i in 1..2 loop
  result:=public.aca_redeem_trial(second_hash,email,learner);
  assert (result->>'enrollment_id')::uuid=enrollment and (result->>'existing_trial')::boolean,'A new invitation must resume the existing trial';
  assert (select count(*)=1 from public.enrollments where learner_id=learner and course_id=course),'No second enrollment';
  assert (select to_jsonb(e)=original from public.enrollments e where id=enrollment),'Dates, status, welcome, and progress markers stay unchanged';
 end loop;
 assert (select status='ready' and enrollment_id is null from public.aca_trial_grants where id=second_grant),'A resume link does not become another access authority';
 update public.enrollments set onboarding_completed_at=now() where id=enrollment;
 perform public.aca_redeem_trial(second_hash,email,learner);
 assert (select onboarding_completed_at is not null from public.enrollments where id=enrollment),'Returning learners do not repeat onboarding';
 foreach state in array array['paused','refunded','cancelled','expired','pending'] loop
  update public.enrollments set status=state where id=enrollment;
  refused:=false;begin perform public.aca_redeem_trial(second_hash,email,learner);exception when raise_exception then refused:=true;end;
  assert refused,'Restricted enrollment cannot be restored by another invitation';
 end loop;
 update public.enrollments set status='active',access_expires_at=now()-interval '1 second' where id=enrollment;
 refused:=false;begin perform public.aca_redeem_trial(second_hash,email,learner);exception when raise_exception then refused:=true;end;
 assert refused,'Expired dates cannot be extended by another invitation';
 update public.enrollments set access_expires_at=(original->>'access_expires_at')::timestamptz where id=enrollment;
 update public.profiles set account_status='suspended' where id=learner;
 refused:=false;begin perform public.aca_redeem_trial(second_hash,email,learner);exception when raise_exception then refused:=true;end;
 assert refused,'Suspended account remains restricted';
 update public.profiles set account_status='active' where id=learner;
 update public.aca_trial_grants set status='revoked' where id=first_grant;
 refused:=false;begin perform public.aca_redeem_trial(second_hash,email,learner);exception when raise_exception then refused:=true;end;
 assert refused,'Revoked original access cannot be restored';
 update public.aca_trial_grants set status='redeemed' where id=first_grant;
 insert into public.aca_installment_plans(learner_id,enrollment_id,course_id,customer_email,stripe_subscription_id,stripe_schedule_id,status,second_due_at,third_due_at)
 values(learner,enrollment,course,email,'sub_repeat_'||learner,'sched_repeat_'||learner,'paused',now()+interval '7 days',now()+interval '14 days');
 refused:=false;begin perform public.aca_redeem_trial(second_hash,email,learner);exception when raise_exception then refused:=true;end;
 assert refused,'An invitation cannot bypass a payment plan';
 delete from public.aca_installment_plans where enrollment_id=enrollment;
 insert into public.aca_payment_events(stripe_event_id,stripe_session_id,customer_email,amount_total,currency,status,outcome,course_id)
 values('evt_repeat_'||learner,'cs_repeat_'||learner,email,12900,'usd','completed','paid',course);
 refused:=false;begin perform public.aca_redeem_trial(second_hash,email,learner);exception when raise_exception then refused:=true;end;
 assert refused,'Paid enrollment is not replaced by a trial';
 assert not has_function_privilege('anon','public.aca_redeem_trial(text,text,uuid)','execute'),'Anonymous cannot call redemption';
 assert not has_function_privilege('authenticated','public.aca_redeem_trial(text,text,uuid)','execute'),'Learners cannot choose another identity';
end $$;
rollback;
select 'Repeated invitation, one enrollment, preserved dates and onboarding, restricted account, revocation, expiry, paid and installment guards passed; fixtures rolled back.' as result;
