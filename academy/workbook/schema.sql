-- Independent workbook responses. Curriculum and lesson progress are untouched.
create table public.aca_workbook_responses (
  course_id uuid not null references public.courses(id),
  workbook_key text not null check (workbook_key in ('journey-one', 'journey-three')),
  scope_key text not null,
  learner_id uuid references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 2000000),
  last_page integer not null default 5 check (last_page between 1 and 32),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (course_id, workbook_key, scope_key),
  constraint workbook_account_scope check (
    (learner_id is null and scope_key = 'owner-review') or
    (learner_id is not null and scope_key = learner_id::text)
  )
);
create index aca_workbook_responses_learner_idx on public.aca_workbook_responses(learner_id);
alter table public.aca_workbook_responses enable row level security;
revoke all on public.aca_workbook_responses from public, anon, authenticated, service_role;
grant select on public.aca_workbook_responses to authenticated;
grant select, insert, update on public.aca_workbook_responses to service_role;
create policy "Learners read only their own workbook answers"
  on public.aca_workbook_responses for select to authenticated
  using ((select auth.uid()) = learner_id);
-- Writes use the authenticated Academy endpoint, which validates ownership,
-- course access, field IDs and revisions. Owner review has no learner identity.


-- Workbook text is stored privately, outside the public source repository.
create table public.aca_workbook_definitions (
  course_id uuid not null references public.courses(id),
  workbook_key text not null check (workbook_key in ('journey-one', 'journey-three')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  primary key (course_id, workbook_key)
);
alter table public.aca_workbook_definitions enable row level security;
revoke all on public.aca_workbook_definitions from public, anon, authenticated, service_role;
grant select on public.aca_workbook_definitions to service_role;
create policy "Workbook content is served by the private Academy endpoint"
  on public.aca_workbook_definitions for select to service_role using (true);
