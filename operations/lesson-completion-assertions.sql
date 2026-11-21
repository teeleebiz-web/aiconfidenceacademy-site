-- Disposable calendar fixture only: never run against Academy learner data.
begin;
do $$
declare learner uuid:=gen_random_uuid(); course uuid:=gen_random_uuid(); journey uuid:=gen_random_uuid();
 enrollment uuid:=gen_random_uuid(); first_lesson uuid:=gen_random_uuid(); second_lesson uuid:=gen_random_uuid();
 third_lesson uuid:=gen_random_uuid(); r record;
begin
 insert into public.courses(id,code,status,phase_number) values(course,'completion-fixture','published',1);
 insert into public.enrollments(id,learner_id,course_id,status,starts_at) values(enrollment,learner,course,'active',now()-interval '60 days');
 insert into public.course_journeys(id,course_id,journey_number,status) values(journey,course,1,'published');
 insert into public.lessons(id,course_id,journey_id,course_position,journey_position,unlock_offset_days,status,page_id,title,purpose,content)
 values(first_lesson,course,journey,1,1,0,'published','1.1','Synthetic','Synthetic','{}'),
 (second_lesson,course,journey,2,2,1,'published','1.2','Synthetic','Synthetic','{}'),
 (third_lesson,course,journey,3,3,2,'published','1.3','Synthetic','Synthetic','{}');
 select * into r from private.lesson_access_state(enrollment,learner,now());
 if r.completed_lessons<>0 or r.total_lessons<>3 or r.access_status<>'access_ended'
 or cardinality(r.released_lesson_ids)<>3 or r.current_lesson_id is not null then
   raise exception 'Missed lessons falsely earned completion or lost released workbook access: %',row_to_json(r); end if;
 insert into public.lesson_access_windows(enrollment_id,learner_id,course_id,lesson_id,status,started_at,closed_at)
 values(enrollment,learner,course,first_lesson,'completed',now()-interval '60 days',now()-interval '59 days'),
 (enrollment,learner,course,second_lesson,'expired',now()-interval '59 days',now()-interval '58 days');
 select * into r from private.lesson_access_state(enrollment,learner,now());
 if r.completed_lessons<>1 or r.access_status<>'access_ended' or cardinality(r.released_lesson_ids)<>3 then
   raise exception 'Expired or missed lessons counted as completed: %',row_to_json(r); end if;
 insert into public.lesson_access_windows(enrollment_id,learner_id,course_id,lesson_id,status,started_at,closed_at)
 values(enrollment,learner,course,third_lesson,'completed',now()-interval '58 days',now()-interval '57 days');
 select * into r from private.lesson_access_state(enrollment,learner,now());
 if r.completed_lessons<>2 or r.access_status<>'access_ended' then raise exception 'Partial completion misreported'; end if;
 update public.lesson_access_windows set status='completed' where enrollment_id=enrollment and lesson_id=second_lesson;
 select * into r from private.lesson_access_state(enrollment,learner,now());
 if r.completed_lessons<>3 or r.access_status<>'course_completed' then raise exception 'Actual completion not recognized'; end if;
 if exists(select 1 from private.lesson_access_state(enrollment,gen_random_uuid(),now())) then raise exception 'Ownership boundary changed'; end if;
 raise notice 'Completion: missed, expired, mixed and fully completed lessons report accurately; released workbooks and ownership preserved.';
end; $$;
rollback;
