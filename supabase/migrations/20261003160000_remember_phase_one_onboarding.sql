-- Remember the existing welcome -> ChatGPT -> Lesson 1.1 sequence per enrollment.
-- This does not grant curriculum access or change release times.
alter table public.enrollments
  add column if not exists onboarding_completed_at timestamptz;

create or replace function public.complete_aca_onboarding(p_enrollment_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue.' using errcode = '42501';
  end if;

  update public.enrollments e
  set onboarding_completed_at = coalesce(e.onboarding_completed_at, now())
  from public.courses c
  where e.id = p_enrollment_id
    and e.learner_id = auth.uid()
    and e.course_id = c.id
    and c.code = 'phase-one-chatgpt-foundations'
    and c.status = 'published'
    and e.status in ('active', 'completed')
    and (e.starts_at is null or e.starts_at <= now())
    and (e.access_expires_at is null or e.access_expires_at > now())
  returning e.onboarding_completed_at into v_completed_at;

  if v_completed_at is null then
    raise exception 'Your enrollment could not be verified.' using errcode = '42501';
  end if;
  return v_completed_at;
end;
$$;

revoke all on function public.complete_aca_onboarding(uuid) from public, anon;
grant execute on function public.complete_aca_onboarding(uuid) to authenticated;
