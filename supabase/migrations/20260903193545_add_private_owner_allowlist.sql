-- Replace user-visible JWT owner claims with a server-controlled private
-- allowlist. No owner email or generated user identifier is stored in Git.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.aca_curriculum_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table private.aca_curriculum_reviewers enable row level security;
revoke all on table private.aca_curriculum_reviewers from public, anon, authenticated;

create or replace function public.is_aca_curriculum_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.aca_curriculum_reviewers reviewer
    where reviewer.user_id = (select auth.uid())
  );
$$;

drop policy if exists "ACA owners can review all courses" on public.courses;
create policy "ACA owners can review all courses"
on public.courses for select to authenticated
using ((select public.is_aca_curriculum_owner()));

drop policy if exists "ACA owners can review all journeys" on public.course_journeys;
create policy "ACA owners can review all journeys"
on public.course_journeys for select to authenticated
using ((select public.is_aca_curriculum_owner()));

drop policy if exists "ACA owners can review all lessons" on public.lessons;
create policy "ACA owners can review all lessons"
on public.lessons for select to authenticated
using ((select public.is_aca_curriculum_owner()));

drop policy if exists "ACA owners can review all journey introductions"
on public.journey_introductions;
create policy "ACA owners can review all journey introductions"
on public.journey_introductions for select to authenticated
using ((select public.is_aca_curriculum_owner()));
