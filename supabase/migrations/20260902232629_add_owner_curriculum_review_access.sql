-- Allow a designated ACA owner to review unpublished curriculum without
-- weakening the existing learner policies. Authorization is stored in
-- raw_app_meta_data, which signed-in users cannot edit themselves.

drop policy if exists "ACA owners can review all courses" on public.courses;
create policy "ACA owners can review all courses"
on public.courses
for select
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'academy_role'), '') = 'owner'
);

drop policy if exists "ACA owners can review all journeys" on public.course_journeys;
create policy "ACA owners can review all journeys"
on public.course_journeys
for select
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'academy_role'), '') = 'owner'
);

drop policy if exists "ACA owners can review all lessons" on public.lessons;
create policy "ACA owners can review all lessons"
on public.lessons
for select
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'academy_role'), '') = 'owner'
);

drop policy if exists "ACA owners can review all journey introductions"
on public.journey_introductions;
create policy "ACA owners can review all journey introductions"
on public.journey_introductions
for select
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'academy_role'), '') = 'owner'
);
