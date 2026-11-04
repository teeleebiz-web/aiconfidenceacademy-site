do $$begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema auth;
create schema private;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fixture.user',true),'')::uuid$$;
create table auth.users(id uuid primary key,email text);
create table public.profiles(id uuid primary key,account_status text);
create table public.courses(id uuid primary key,code text,phase_number integer,status text);
create table public.enrollments(id uuid primary key default gen_random_uuid(),learner_id uuid,course_id uuid,status text,
 enrolled_at timestamptz default now(),starts_at timestamptz,access_expires_at timestamptz,onboarding_completed_at timestamptz,
 unique(learner_id,course_id));
create table public.aca_trial_grants(id uuid primary key,code_hash text,allowed_email text,course_id uuid,cohort_id uuid,
 starts_at timestamptz,expires_at timestamptz,status text,enrollment_id uuid,updated_at timestamptz);
create table public.aca_phase_two_cohorts(id uuid,course_id uuid,status text);
create table public.aca_phase_two_memberships(enrollment_id uuid,learner_id uuid,course_id uuid,cohort_id uuid);
create table public.aca_installment_plans(enrollment_id uuid,status text,grace_until timestamptz);
create table public.aca_payment_events(customer_email text,course_id uuid,status text,outcome text);
create function private.aca_installment_access_deadline(p_id uuid) returns timestamptz language sql stable as $$
 select coalesce((select grace_until from public.aca_installment_plans where enrollment_id=p_id and status='past_due'),'infinity'::timestamptz)
$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
grant select on public.enrollments to authenticated;
alter table public.enrollments enable row level security;
create policy own_enrollment on public.enrollments for select to authenticated using(learner_id=(select auth.uid()));
alter table public.courses enable row level security;
grant select on public.courses to authenticated;
create policy active_course on public.courses for select to authenticated using(
 status='published' and exists(select 1 from public.enrollments e where e.course_id=courses.id
 and e.learner_id=(select auth.uid()) and e.status in ('active','completed')
 and (e.starts_at is null or e.starts_at<=now()) and (e.access_expires_at is null or e.access_expires_at>now())));
