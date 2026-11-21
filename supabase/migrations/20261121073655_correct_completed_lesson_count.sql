-- Closed or missed lessons advance the calendar but do not earn completion.
-- This replaces only the derived read function; no learner rows are changed.
create or replace function private.lesson_access_state(p_enrollment_id uuid,p_learner_id uuid,p_at timestamptz)
returns table(current_lesson_id uuid,current_journey_id uuid,access_status text,available_at timestamptz,
 active_seconds integer,remaining_seconds integer,completed_lessons integer,total_lessons integer,released_lesson_ids uuid[])
language plpgsql stable security definer set search_path='' as $$
declare e public.enrollments%rowtype; r record; current_row record; v_total integer:=0; v_completed integer:=0;
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
     if r.effective_status='completed' then v_completed:=v_completed+1; end if;
     ids:=array_append(ids,r.id);
   elsif not has_current then current_row:=r; has_current:=true;
     if p_at>=r.released_at then ids:=array_append(ids,r.id); end if;
   end if;
 end loop;
 if not has_current then
   return query select null::uuid,null::uuid,case when v_total>0 and v_completed=v_total then 'course_completed'::text else 'access_ended'::text end,null::timestamptz,0,0,v_completed,v_total,ids;return;
 end if;
 used:=current_row.used;
 return query select current_row.id::uuid,current_row.journey_id::uuid,
 case when p_at>=limit_at then 'access_ended' when current_row.status='active' then 'active'
   when p_at>=current_row.released_at then 'available' else 'scheduled' end,
 current_row.released_at::timestamptz,used,
 greatest(0,least(7200-used,floor(extract(epoch from least(p_at+interval '2 hours',limit_at)-p_at))::integer)),
 v_completed,v_total,ids;
end; $$;

