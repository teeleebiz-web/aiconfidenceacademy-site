do $$
declare
 learner uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
 c1 uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid(); j1 uuid:=gen_random_uuid(); j2 uuid:=gen_random_uuid();
 e1 uuid:=gen_random_uuid(); e2 uuid:=gen_random_uuid(); l1 uuid:=gen_random_uuid(); l2 uuid:=gen_random_uuid(); ls uuid:=gen_random_uuid(); cohort uuid:=gen_random_uuid();
 r record; s record; old_token uuid; new_token uuid; seconds_before integer; blocked boolean;
begin
 if (select status from public.lesson_access_windows where lesson_id='90000000-0000-0000-0000-000000000001')<>'expired'
 or (select study_used_ms from public.lesson_access_windows where lesson_id='90000000-0000-0000-0000-000000000001')<>7200000
 or (select status from public.lesson_access_windows where lesson_id='90000000-0000-0000-0000-000000000002')<>'completed'
 then raise exception 'Cutover reopened or reset historical work'; end if;
 insert into public.courses values(c1,'phase-one-ai-confidence','published'),(c2,'phase-two-ai-professional-builder','published');
 insert into public.enrollments(id,learner_id,course_id,status,enrolled_at) values(e1,learner,c1,'active',now()-interval '7 days'),(e2,learner,c2,'active',now()-interval '7 days');
 insert into public.course_journeys values(j1,c1,1,'published'),(j2,c2,1,'published');
 insert into public.lessons values(l1,c1,j1,1,1,0,'published','1.1','Fixture one','Synthetic test','{}'),(l2,c2,j2,1,1,0,'published','1.1','Fixture two','Synthetic test','{}'),(ls,c2,j2,6,6,5,'published','1.6','Saturday fixture','Synthetic test','{}');
 insert into public.aca_phase_two_cohorts values(cohort,c2,'America/Los_Angeles',(now() at time zone 'America/Los_Angeles')::date-5,'00:00','active');
 insert into public.aca_phase_two_memberships values(e2,learner,c2,cohort);
 perform set_config('fixture.user',learner::text,true);
 -- Existing cached readers keep their original contract during the rollout.
 perform public.touch_lesson_access(e1,l1);
 select * into r from public.heartbeat_lesson_access(e1,l1);
 if r.access_status<>'active' or r.remaining_seconds<>7200 then raise exception 'Legacy heartbeat closed an eligible pre-token session'; end if;

 -- Both phases: server counts 30 minutes of confirmed study, then preserves
 -- the remaining 90 minutes across a long interruption and repeated resumes.
 for i in 1..2 loop
   select * into r from public.manage_lesson_study_session(case when i=1 then e1 else e2 end,case when i=1 then l1 else l2 end,'start');
   if r.remaining_seconds<>7200 or r.study_state<>'running' then raise exception 'Fresh study budget %',row_to_json(r); end if;
   old_token:=r.study_token;
   for tick in 1..60 loop
     if i=1 then update public.lesson_access_windows set last_seen_at=clock_timestamp()-interval '30 seconds' where enrollment_id=e1 and lesson_id=l1;
     else update public.aca_phase_two_lesson_windows set last_seen_at=clock_timestamp()-interval '30 seconds' where enrollment_id=e2 and lesson_id=l2; end if;
     select * into r from public.manage_lesson_study_session(case when i=1 then e1 else e2 end,case when i=1 then l1 else l2 end,'heartbeat',old_token);
   end loop;
   if r.remaining_seconds not between 5397 and 5400 then raise exception 'Confirmed study was not accumulated: %',row_to_json(r); end if;
   select * into r from public.manage_lesson_study_session(case when i=1 then e1 else e2 end,case when i=1 then l1 else l2 end,'pause',old_token);
   seconds_before:=r.remaining_seconds;
   if i=1 then update public.lesson_access_windows set started_at=now()-interval '5 hours',last_seen_at=now()-interval '1 hour' where enrollment_id=e1;
   else update public.aca_phase_two_lesson_windows set first_opened_at=now()-interval '5 hours',deadline_at=now()-interval '3 hours',last_seen_at=now()-interval '1 hour' where enrollment_id=e2; end if;
   select * into r from public.manage_lesson_study_session(case when i=1 then e1 else e2 end,case when i=1 then l1 else l2 end,'start');
   if r.remaining_seconds<>seconds_before then raise exception 'Time away deducted or allowance reset: %',row_to_json(r); end if;
   new_token:=r.study_token;
   select * into s from public.manage_lesson_study_session(case when i=1 then e1 else e2 end,case when i=1 then l1 else l2 end,'pause',old_token);
   if s.access_status<>'superseded' or s.study_token is not null then raise exception 'Stale tab changed current session or exposed its token'; end if;
   if i=1 then update public.lesson_access_windows set last_seen_at=clock_timestamp()-interval '1 hour' where enrollment_id=e1;
   else update public.aca_phase_two_lesson_windows set last_seen_at=clock_timestamp()-interval '1 hour' where enrollment_id=e2 and lesson_id=l2; end if;
   select * into r from public.manage_lesson_study_session(case when i=1 then e1 else e2 end,case when i=1 then l1 else l2 end,'heartbeat',new_token);
   if r.study_state<>'paused' or r.remaining_seconds<>seconds_before then raise exception 'Power-loss gap consumed time: %',row_to_json(r); end if;
   -- Payment grace is still a hard boundary, even with unused study time.
   insert into public.aca_installment_plans values(case when i=1 then e1 else e2 end,'grace',now()+interval '10 minutes');
   select * into r from public.manage_lesson_study_session(case when i=1 then e1 else e2 end,case when i=1 then l1 else l2 end,'start');
   if r.remaining_seconds not between 598 and 600 then raise exception 'Study time escaped payment grace boundary'; end if;
   update public.aca_installment_plans set status='paused';
   select * into r from public.manage_lesson_study_session(case when i=1 then e1 else e2 end,case when i=1 then l1 else l2 end,'heartbeat',r.study_token);
   if r.access_status<>'expired' or r.remaining_seconds<>0 then raise exception 'Paused payment did not restrict teaching'; end if;
   update public.aca_installment_plans set status='grace',grace_until=clock_timestamp()+interval '0.5 seconds';
   select * into r from public.manage_lesson_study_session(case when i=1 then e1 else e2 end,case when i=1 then l1 else l2 end,'start');
   if i=1 and (select status from public.lesson_access_windows where enrollment_id=e1 and lesson_id=l1)<>'active' then
     raise exception 'Fractional payment cutoff permanently consumed unused study eligibility'; end if;
   update public.aca_installment_plans set status='active';
   select * into r from public.manage_lesson_study_session(case when i=1 then e1 else e2 end,case when i=1 then l1 else l2 end,'start');
   if r.access_status<>'active' or r.remaining_seconds<5395 then raise exception 'Current payment did not restore unused study time'; end if;
   delete from public.aca_installment_plans;
   -- Ownership is checked before opening, changing or exposing a session.
   perform set_config('fixture.user',stranger::text,true); blocked:=false;
   begin perform public.manage_lesson_study_session(case when i=1 then e1 else e2 end,case when i=1 then l1 else l2 end,'start');
   exception when others then blocked:=true; end;
   if not blocked then raise exception 'Another learner modified study time'; end if;
   perform set_config('fixture.user',learner::text,true);
 end loop;

 -- Saturday retains its calendar extension, regardless of the ordinary budget.
 select * into r from public.manage_lesson_study_session(e2,ls,'start');
 if r.study_mode<>'weekend' or r.remaining_seconds<=7200 then raise exception 'Saturday extension was replaced with the ordinary timer'; end if;
 update public.aca_phase_two_lesson_windows set study_used_ms=7200000 where enrollment_id=e2 and lesson_id=ls;
 select * into r from public.manage_lesson_study_session(e2,ls,'start');
 if r.access_status<>'active' or r.study_mode<>'weekend' then raise exception 'Saturday was denied by ordinary budget'; end if;

 -- Exhaustion closes the ordinary lesson, but repeating start cannot reset it.
 update public.aca_phase_two_lesson_windows set study_used_ms=7200000,study_state='paused' where enrollment_id=e2 and lesson_id=l2;
 select * into r from public.aca_phase_two_access_status(e2,l2);
 if r.access_status<>'closed' or r.remaining_seconds<>0 then raise exception 'Exhausted lesson stayed open'; end if;
 blocked:=false; begin perform public.manage_lesson_study_session(e2,l2,'start'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Exhausted allowance was reopened'; end if;
 update public.lesson_access_windows set study_used_ms=7200000,study_state='paused' where enrollment_id=e1 and lesson_id=l1;
 select * into r from private.lesson_access_state(e1,learner,now());
 if r.access_status<>'course_completed' then raise exception 'Phase One exhaustion no longer advances existing progress'; end if;

 if has_function_privilege('anon','public.manage_lesson_study_session(uuid,uuid,text,uuid)','EXECUTE')
 or not has_function_privilege('authenticated','public.manage_lesson_study_session(uuid,uuid,text,uuid)','EXECUTE') then raise exception 'Session RPC role boundary failed'; end if;
 if has_table_privilege('authenticated','public.lesson_access_windows','UPDATE')
 or has_table_privilege('authenticated','public.lesson_access_windows','TRUNCATE')
 or has_table_privilege('authenticated','public.aca_phase_two_lesson_windows','INSERT') then raise exception 'Learner can overwrite the server ledger'; end if;
 perform set_config('fixture.owned_user',learner::text,false);
 perform set_config('fixture.owned_enrollment',e2::text,false);
 perform set_config('fixture.owned_lesson',ls::text,false);
 raise notice 'Both phases: study accounting, pause/resume, stale/offline requests, ownership, exhaustion, Saturday and payment boundaries passed.';
end; $$;

set role authenticated;
do $$declare r record; begin
 if exists(select 1 from public.lesson_access_windows) then raise exception 'RLS exposed another learner ledger'; end if;
 begin perform public.manage_lesson_study_session(gen_random_uuid(),gen_random_uuid(),'start'); raise exception 'Unexpected session access';
 exception when others then if sqlerrm='Unexpected session access' then raise; end if; end;
 perform set_config('fixture.user',current_setting('fixture.owned_user'),true);
 select * into r from public.manage_lesson_study_session(current_setting('fixture.owned_enrollment')::uuid,current_setting('fixture.owned_lesson')::uuid,'start');
 if r.access_status<>'active' or r.study_mode<>'weekend' then raise exception 'Real authenticated role cannot resume its own eligible session'; end if;
 if not exists(select 1 from public.aca_phase_two_lesson_windows) then raise exception 'Learner cannot read its own checkpoint'; end if;
 begin update public.aca_phase_two_lesson_windows set study_used_ms=0; raise exception 'Learner overwrote server accounting';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
