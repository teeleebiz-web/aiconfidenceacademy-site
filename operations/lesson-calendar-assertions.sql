do $$
declare learner uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); c1 uuid:=gen_random_uuid();c2 uuid:=gen_random_uuid();
 e1 uuid:=gen_random_uuid();e2 uuid:=gen_random_uuid();j1 uuid:=gen_random_uuid();j2 uuid:=gen_random_uuid();
 l1 uuid; l2 uuid; final1 uuid; final2 uuid; r record;s record;cal record;blocked boolean;opening timestamptz;workbook jsonb;
begin
 if private.aca_release_at('2026-10-28 21:00 America/Los_Angeles',2,1,0)<>'2026-10-28 21:00 America/Los_Angeles'::timestamptz
 or private.aca_release_at('2026-10-28 21:00 America/Los_Angeles',2,2,1)<>'2026-10-29 06:00 America/Los_Angeles'::timestamptz
 or private.aca_release_at('2026-10-28 21:00 America/Los_Angeles',2,5,4)<>'2026-11-02 06:00 America/Los_Angeles'::timestamptz then raise exception 'Independent Pacific release or Sunday skip failed';end if;
 if private.aca_release_at('2026-11-01 15:00 America/Los_Angeles',2,1,0)<>'2026-11-01 15:00 America/Los_Angeles'::timestamptz
 or private.aca_release_at('2026-11-01 15:00 America/Los_Angeles',2,2,1)<>'2026-11-02 06:00 America/Los_Angeles'::timestamptz
 or private.aca_release_at('2026-03-06 22:00 America/Los_Angeles',2,3,2)<>'2026-03-09 06:00 America/Los_Angeles'::timestamptz then raise exception 'Sunday first entry or DST release failed';end if;
 if private.aca_release_at('2026-10-28 21:00 America/Los_Angeles',1,7,7)<>'2026-11-04 06:00 America/Los_Angeles'::timestamptz then raise exception 'Phase One configured offset changed';end if;

 insert into public.courses(id,code,status,phase_number)values(c1,'phase-one-chatgpt-foundations','published',1),(c2,'phase-two-ai-professional-builder','published',2);
 insert into public.enrollments(id,learner_id,course_id,status,starts_at)values(e1,learner,c1,'active',now()),(e2,learner,c2,'active',now());
 for k in 1..6 loop
 insert into public.course_journeys(id,course_id,journey_number,status)values(gen_random_uuid(),c1,k,'published'),(gen_random_uuid(),c2,k,'published');
 end loop;
 for i in 1..36 loop
   insert into public.lessons(id,course_id,journey_id,course_position,journey_position,unlock_offset_days,status,page_id,title,purpose,content)
   values(gen_random_uuid(),c1,(select id from public.course_journeys where course_id=c1 and journey_number=(i-1)/6+1),i,((i-1)%6)+1,((i-1)/6)*7+(i-1)%6,'published',((i-1)/6+1)||'.'||((i-1)%6+1),'Synthetic','Synthetic','{}')returning id into l1;
   insert into public.lessons(id,course_id,journey_id,course_position,journey_position,unlock_offset_days,status,page_id,title,purpose,content)
   values(gen_random_uuid(),c2,(select id from public.course_journeys where course_id=c2 and journey_number=(i-1)/6+1),i,((i-1)%6)+1,((i-1)/6)*7+(i-1)%6,'published',((i-1)/6+1)||'.'||((i-1)%6+1),'Synthetic','Synthetic','{}')returning id into l2;
   if i=36 then final1:=l1;final2:=l2;end if;
 end loop;
 select id into l1 from public.lessons where course_id=c1 and course_position=1;
 select id into l2 from public.lessons where course_id=c2 and course_position=1;
 insert into public.aca_phase_two_memberships values(e2,learner,c2,null);
 perform set_config('fixture.user',learner::text,true);
 select * into r from public.manage_lesson_study_session(e1,l1,'start');
 if r.remaining_seconds<>7200 then raise exception 'Immediate Phase One first entry failed';end if;
 select * into cal from private.aca_lesson_calendar(e1,l1);
 if cal.first_open_until-cal.released_at<>interval '24 hours' then raise exception 'First opening is not exactly 24 hours';end if;
 -- A paused, already-open lesson retains its budget after the opening deadline.
 update public.lesson_access_windows set study_used_ms=1800000,study_state='paused' where enrollment_id=e1 and lesson_id=l1;
 update public.enrollments set starts_at=now()-interval '3 days' where id=e1;
 select * into r from public.manage_lesson_study_session(e1,l1,'start');
 if r.remaining_seconds<>5400 then raise exception 'Opening cutoff consumed already-started study time';end if;
 -- Completion does not impose a new 24-hour delay on an already released next lesson.
 update public.lesson_access_windows set status='completed',closed_at=now() where enrollment_id=e1 and lesson_id=l1;
 select * into r from private.lesson_access_state(e1,learner,now());
 if r.access_status not in ('available','scheduled') or r.current_lesson_id=l1 then raise exception 'Calendar cannot advance past closed or missed lessons';end if;
 if r.available_at>now() and r.access_status<>'scheduled' then raise exception 'Future lesson opened early';end if;
 -- Exact first-opening cutoff is denied; one microsecond before is still available.
 select * into cal from private.aca_lesson_calendar(e1,r.current_lesson_id);
 select * into s from private.lesson_access_state(e1,learner,cal.first_open_until-interval '1 microsecond');
 if s.current_lesson_id is distinct from r.current_lesson_id then raise exception 'Opening window closed early';end if;
 select * into s from private.lesson_access_state(e1,learner,cal.first_open_until);
 if s.current_lesson_id=r.current_lesson_id then raise exception 'Unopened lesson survived its cutoff';end if;

 select * into r from public.aca_phase_two_access_status(e2,l2);
 if r.access_status not in ('available','active') then raise exception 'Cohort-free immediate Phase Two entry failed';end if;
 perform public.open_aca_phase_two_lesson(e2,l2);
 update public.aca_phase_two_lesson_windows set study_used_ms=1800000,study_state='paused' where enrollment_id=e2 and lesson_id=l2;
 update public.enrollments set starts_at=now()-interval '3 days' where id=e2;
 -- Choose a non-Saturday starting date for the ordinary budget test.
 update public.enrollments set starts_at=starts_at-interval '1 day' where id=e2 and extract(isodow from starts_at at time zone 'America/Los_Angeles')=6;
 select * into r from public.aca_phase_two_access_status(e2,l2);
 if r.access_status<>'active' or r.remaining_seconds<>5400 then raise exception 'Phase Two lost saved time after its first-opening deadline';end if;
 delete from public.aca_phase_two_lesson_windows where enrollment_id=e2 and lesson_id=l2;
 select * into r from public.aca_phase_two_access_status(e2,l2);
 if r.access_status<>'closed' then raise exception 'Missed Phase Two opening remained available';end if;
 blocked:=false;begin perform public.open_aca_phase_two_lesson(e2,l2);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Direct RPC bypassed first-opening cutoff';end if;
 -- Saturday extension is tied to the actual release date, not lesson .6.
 update public.enrollments set starts_at='2026-10-28 21:00 America/Los_Angeles' where id=e2;
 select * into cal from private.aca_lesson_calendar(e2,(select id from public.lessons where course_id=c2 and course_position=4));
 if cal.weekend_ends_at<>'2026-11-02 00:00 America/Los_Angeles'::timestamptz then raise exception 'Actual Saturday extension/DST boundary failed';end if;
 -- Final phase boundaries derive from the final lesson and retain paused time.
 select * into cal from private.aca_lesson_calendar(e2,final2);
 if private.aca_phase_ends_at(e2)<>cal.first_open_until then raise exception 'Unopened phase end is unrelated to final lesson';end if;
 insert into public.aca_phase_two_lesson_windows(enrollment_id,learner_id,lesson_id,first_opened_at,deadline_at,study_used_ms,study_state,last_seen_at)
 values(e2,learner,final2,now(),now()+interval '2 hours',1800000,'paused',now());
 if cal.weekend_ends_at is null and private.aca_phase_ends_at(e2)<>'infinity'::timestamptz then raise exception 'Final paused study time was cut short';end if;
 update public.enrollments set access_expires_at=now()+interval '1 day' where id=e2;
 if private.aca_phase_ends_at(e2)>now()+interval '1 day' then raise exception 'Explicit owner/trial limit was bypassed';end if;
 update public.enrollments set access_expires_at=null where id=e2;
 -- Released workbook access uses the same independent calendar without a cohort.
 insert into public.aca_phase_two_workbook_definitions values(1,'{"pages":[{"number":1,"blocks":[{"type":"field","id":"answer"}]}]}'::jsonb);
 insert into public.aca_phase_two_workbook_responses values(e2,learner,1,'{"answer":"Synthetic saved answer"}',1,7,now());
 workbook:=public.get_aca_phase_two_workbook(e2,1);
 if workbook#>>'{answers,answer}'<>'Synthetic saved answer' then raise exception 'Calendar change lost saved workbook work';end if;
 perform set_config('fixture.user',stranger::text,true);blocked:=false;
 begin perform public.open_aca_phase_two_lesson(e2,l2);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Calendar weakened learner ownership';end if;
 perform set_config('fixture.user',learner::text,true);
 -- Phase-end enforcement must not intercept the heartbeat that durably saves exhaustion.
 update public.enrollments set starts_at=now()-interval '60 days' where id=e1;
 insert into public.lesson_access_windows(enrollment_id,learner_id,course_id,lesson_id,status,started_at,study_used_ms,study_state,last_seen_at,study_token)
 values(e1,learner,c1,final1,'active',now()-interval '2 hours',7190000,'running',clock_timestamp()-interval '10 seconds',gen_random_uuid());
 select * into r from public.manage_lesson_study_session(e1,final1,'heartbeat',(select study_token from public.lesson_access_windows where enrollment_id=e1 and lesson_id=final1));
 if (select status from public.lesson_access_windows where enrollment_id=e1 and lesson_id=final1)<>'expired' then raise exception 'Derived phase end intercepted durable exhaustion';end if;
 update public.lesson_access_windows set last_seen_at=now()-interval '1 hour' where enrollment_id=e1 and lesson_id=final1;
 if private.aca_phase_ends_at(e1)>now() then raise exception 'Final phase reopened after a stale heartbeat lease';end if;
 if has_function_privilege('authenticated','private.aca_lesson_calendar(uuid,uuid)','EXECUTE') then raise exception 'Private calendar exposed as learner API';end if;
 raise notice 'Calendar: immediate entry, Pacific/DST, Sundays, first-opening cutoffs, resumed budgets, final boundary, saved workbook and ownership passed';
end; $$;
