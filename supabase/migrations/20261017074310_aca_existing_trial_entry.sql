create or replace function public.aca_redeem_trial(p_hash text,p_email text,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.aca_trial_grants;c public.courses;e uuid;existing public.enrollments;begin
 select * into g from public.aca_trial_grants where code_hash=p_hash for update;
 if not found or g.allowed_email<>lower(trim(p_email)) or g.status not in ('ready','redeemed') or g.expires_at<=now() then raise exception 'Invitation is unavailable';end if;
 if not exists(select 1 from auth.users where id=p_user and lower(email)=g.allowed_email) then raise exception 'Invitation identity does not match';end if;
 if exists(select 1 from public.profiles where id=p_user and account_status<>'active') then raise exception 'This account requires owner review';end if;
 if g.status='redeemed' then
  if not exists(select 1 from public.enrollments where id=g.enrollment_id and learner_id=p_user) then raise exception 'Invitation identity does not match';end if;
  return jsonb_build_object('enrollment_id',g.enrollment_id,'grant_id',g.id,'duplicate',true);
 end if;
 select * into c from public.courses where id=g.course_id and status='published';if not found then raise exception 'Phase is not available';end if;
 -- Another invitation for the same recipient must resume their valid trial.
 -- Do not attach it to, extend, restore, or replace the existing enrollment:
 -- its original grant remains the authority for dates and revocation.
 select * into existing from public.enrollments
 where learner_id=p_user and course_id=g.course_id for update;
 if found then
  if existing.status in ('active','completed') and existing.access_expires_at>now()
   and exists(select 1 from public.aca_trial_grants original
    where original.enrollment_id=existing.id and original.allowed_email=g.allowed_email
     and original.course_id=g.course_id and original.status='redeemed' and original.expires_at>now())
   and not exists(select 1 from public.aca_trial_grants original
    where original.enrollment_id=existing.id and original.status in ('revoked','converted'))
   and not exists(select 1 from public.aca_installment_plans where enrollment_id=existing.id)
   and not exists(select 1 from public.aca_payment_events
    where lower(customer_email)=g.allowed_email and course_id=g.course_id
     and status='completed' and outcome='paid')
   and (c.phase_number<>2 or exists(select 1 from public.aca_phase_two_memberships
    where enrollment_id=existing.id and cohort_id=g.cohort_id)) then
   return jsonb_build_object('enrollment_id',existing.id,'grant_id',g.id,'duplicate',true,'existing_trial',true);
  end if;
  raise exception 'An existing enrollment requires owner review';
 end if;
 if c.phase_number=2 and not exists(select 1 from public.aca_phase_two_cohorts where id=g.cohort_id and course_id=g.course_id and status='active') then raise exception 'Cohort is unavailable';end if;
 insert into public.profiles(id,account_status) values(p_user,'active') on conflict(id) do nothing;
 insert into public.enrollments(learner_id,course_id,status,starts_at,access_expires_at) values(p_user,g.course_id,'active',g.starts_at,g.expires_at) returning id into e;
 if c.phase_number=2 then insert into public.aca_phase_two_memberships(enrollment_id,learner_id,course_id,cohort_id) values(e,p_user,g.course_id,g.cohort_id);end if;
 update public.aca_trial_grants set status='redeemed',enrollment_id=e,updated_at=now() where id=g.id;
 return jsonb_build_object('enrollment_id',e,'grant_id',g.id,'duplicate',false);
end $$;
revoke all on function public.aca_redeem_trial(text,text,uuid) from public,anon,authenticated;
grant execute on function public.aca_redeem_trial(text,text,uuid) to service_role;
