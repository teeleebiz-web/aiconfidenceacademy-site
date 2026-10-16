-- Database acceptance runs in one rollback-only transaction. No email provider is called.
begin;
do $$
declare owner_id uuid:=gen_random_uuid();learner uuid:=gen_random_uuid();c1 uuid;c2 uuid;grant_id uuid;trial_enrollment uuid;cohort uuid;phase2_enrollment uuid;request_id uuid:=gen_random_uuid();payload jsonb;result jsonb;refused boolean;email text:='aca-acceptance-'||gen_random_uuid()||'@example.com';begin
 insert into auth.users(id,email,raw_user_meta_data) values(owner_id,'aca-owner-'||owner_id||'@example.com','{}'),(learner,email,'{}');
 insert into public.profiles(id,account_status) values(owner_id,'active'),(learner,'active') on conflict(id) do nothing;
 insert into private.aca_curriculum_reviewers(user_id) values(owner_id);
 select id into c1 from public.courses where phase_number=1 and status='published';
 select id into c2 from public.courses where phase_number=2;
 payload:=jsonb_build_object('email',email,'course_id',c1,'starts_at',now()-interval '1 minute','expires_at',now()+interval '56 days','code_hash',repeat(md5(request_id::text),2));
 result:=public.aca_control_action(owner_id,request_id,'trial_create',payload);grant_id:=(result->>'id')::uuid;
 assert (public.aca_control_action(owner_id,request_id,'trial_create',payload)->>'id')::uuid=grant_id,'Repeated owner action must return the same grant';
 assert (select count(*)=1 from public.aca_trial_grants where id=grant_id),'No duplicated invitation';
 refused:=false;begin perform public.aca_control_action(learner,gen_random_uuid(),'trial_create',payload);exception when raise_exception then refused:=true;end;assert refused,'A learner cannot use owner controls';
 result:=public.aca_redeem_trial(payload->>'code_hash',email,learner);trial_enrollment:=(result->>'enrollment_id')::uuid;
 assert (public.aca_redeem_trial(payload->>'code_hash',email,learner)->>'enrollment_id')::uuid=trial_enrollment,'Redemption must be idempotent';
 assert (select status='active' from public.enrollments where id=trial_enrollment),'Trial activates actual enrollment';
 perform public.aca_control_action(owner_id,gen_random_uuid(),'trial_revoke',jsonb_build_object('id',grant_id));
 assert (select status='expired' from public.enrollments where id=trial_enrollment),'Revocation closes only its trial enrollment';
 insert into public.aca_payment_events(stripe_event_id,stripe_session_id,customer_email,amount_total,currency,status,event_type,livemode,outcome,course_id)
 values('evt_acceptance_'||request_id,'cs_test_acceptance_'||request_id,email,12900,'usd','completed','checkout.session.completed',false,'paid',c1);
 assert (select status='converted' from public.aca_trial_grants where id=grant_id),'A confirmed later purchase converts revoked trial access';
 assert (select status='active' from public.enrollments where id=trial_enrollment),'Paid upgrade restores actual access';
 refused:=false;begin perform public.aca_control_action(owner_id,gen_random_uuid(),'trial_revoke',jsonb_build_object('id',grant_id));exception when raise_exception then refused:=true;end;assert refused,'Paid access must not be revoked as a trial';
 refused:=false;begin perform public.aca_control_action(owner_id,gen_random_uuid(),'course_status',jsonb_build_object('id',c2,'status','published','updated_at',null));exception when raise_exception then refused:=true;end;assert refused,'A missing version cannot bypass optimistic concurrency';
 perform public.aca_control_action(owner_id,gen_random_uuid(),'course_status',(select jsonb_build_object('id',id,'status','published','updated_at',updated_at) from public.courses where id=c2));
 result:=public.aca_control_action(owner_id,gen_random_uuid(),'cohort_save',jsonb_build_object('course_id',c2,'code','Acceptance cohort','starts_monday',current_date-(extract(isodow from current_date)::int-1),'timezone','Asia/Manila','release_time','09:00','status','active'));
 cohort:=(result->>'id')::uuid;
 payload:=jsonb_build_object('email',email,'course_id',c2,'cohort_id',cohort,'starts_at',now()-interval '1 minute','expires_at',now()+interval '56 days','code_hash',repeat(md5(cohort::text),2));
 perform public.aca_control_action(owner_id,gen_random_uuid(),'trial_create',payload);
 result:=public.aca_redeem_trial(payload->>'code_hash',email,learner);phase2_enrollment:=(result->>'enrollment_id')::uuid;
 assert (select count(*)=1 from public.aca_phase_two_memberships where enrollment_id=phase2_enrollment and cohort_id=cohort),'Phase Two trial receives the actual cohort membership';
 perform set_config('request.jwt.claim.sub',learner::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',learner,'role','authenticated')::text,true);
 assert (select count(*)=36 from public.aca_phase_two_my_outline(phase2_enrollment)),'Trial sees the complete six-journey learner outline';
 assert jsonb_array_length(public.aca_control_learner(phase2_enrollment)->'lessons')=36,'Owner can diagnose every Phase Two lesson';
 perform public.aca_record_refund(jsonb_build_object('provider_refund_id','re_acceptance_'||request_id,'charge_id','ch_acceptance','amount',100,'currency','usd','livemode',false,'status','pending','customer_email',email),100);
 perform public.aca_record_refund(jsonb_build_object('provider_refund_id','re_acceptance_'||request_id,'charge_id','ch_acceptance','amount',100,'currency','usd','livemode',false,'status','succeeded'),200);
 perform public.aca_record_refund(jsonb_build_object('provider_refund_id','re_acceptance_'||request_id,'charge_id','ch_acceptance','amount',100,'currency','usd','livemode',false,'status','pending'),50);
 assert (select status='succeeded' and customer_email=email from public.aca_refunds where provider_refund_id='re_acceptance_'||request_id),'Out-of-order refund events do not regress status or lose recipient';
 assert not has_function_privilege('authenticated','public.aca_control_snapshot(integer,text,integer,text)','execute'),'Learner cannot read the owner snapshot directly';
 assert not has_function_privilege('anon','public.aca_control_action(uuid,uuid,text,jsonb)','execute'),'Anonymous cannot invoke owner mutation';
 assert not has_column_privilege('authenticated','public.aca_learner_feedback','owner_note','select'),'Internal notes stay private';
end $$;
rollback;
select 'Owner authorization, trial redemption, paid upgrades, Phase Two membership and outline, refund ordering, and permissions passed; all acceptance data rolled back.' as result;
