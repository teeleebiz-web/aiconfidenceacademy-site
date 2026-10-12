-- Phase Two only: additive, isolated, unpublished project/evidence foundation.
-- Approved source: ACA Phase Two Six Week Curriculum Master v2.0 (2026-10-04).
-- No existing table, course, content, permissions, or learner record is altered.
-- Cohort timezone, release clock, enrollment policy and credential weights are
-- not preselected here. No cohort or learner is activated by this migration.

create table if not exists public.aca_phase_two_cohorts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  cohort_code text not null,
  starts_monday date,
  iana_timezone text,
  release_local_time time without time zone,
  status text not null default 'draft' check (status in ('draft','scheduled','active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aca_phase_two_cohort_monday check (starts_monday is null or extract(isodow from starts_monday) = 1),
  constraint aca_phase_two_cohort_code_unique unique (course_id, cohort_code),
  constraint aca_phase_two_cohort_course_pair unique (id, course_id)
);
comment on table public.aca_phase_two_cohorts is
  'Phase Two only. Timezone, Monday start, and release clock await founder-approved cohort settings.';

create table if not exists public.aca_phase_two_memberships (
  enrollment_id uuid primary key,
  learner_id uuid not null,
  course_id uuid not null,
  cohort_id uuid not null,
  joined_at timestamptz not null default now(),
  constraint aca_phase_two_membership_enrollment_fk
    foreign key (enrollment_id, learner_id, course_id)
    references public.enrollments(id, learner_id, course_id),
  constraint aca_phase_two_membership_cohort_fk
    foreign key (cohort_id, course_id)
    references public.aca_phase_two_cohorts(id, course_id),
  constraint aca_phase_two_membership_owner_pair unique (enrollment_id, learner_id)
);
comment on table public.aca_phase_two_memberships is
  'Course-scoped membership mapping; no enrollment is created by this schema.';

create table if not exists public.aca_phase_two_project_records (
  enrollment_id uuid primary key,
  learner_id uuid not null,
  project_path text not null check (project_path in ('A', 'B')),
  project_title text not null check (length(btrim(project_title)) > 0),
  sections jsonb not null default '{}'::jsonb check (jsonb_typeof(sections) = 'object'),
  version_number integer not null default 0 check (version_number >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aca_phase_two_project_membership_fk
    foreign key (enrollment_id, learner_id)
    references public.aca_phase_two_memberships(enrollment_id, learner_id)
);
comment on table public.aca_phase_two_project_records is
  'Single continuing project (Path A or B), updated across six journeys; no duplicate workbook per lesson.';

create table if not exists public.aca_phase_two_project_revisions (
  enrollment_id uuid not null,
  learner_id uuid not null,
  version_number integer not null check (version_number > 0),
  patch jsonb not null check (jsonb_typeof(patch) = 'object'),
  saved_snapshot jsonb not null check (jsonb_typeof(saved_snapshot) = 'object'),
  decision_note text,
  created_at timestamptz not null default now(),
  primary key (enrollment_id, version_number),
  constraint aca_phase_two_revision_membership_fk
    foreign key (enrollment_id, learner_id)
    references public.aca_phase_two_memberships(enrollment_id, learner_id)
);
comment on table public.aca_phase_two_project_revisions is
  'Immutable, versioned project snapshots with optional brief evidence-based decision notes.';

create index if not exists aca_phase_two_memberships_by_learner on public.aca_phase_two_memberships(learner_id, cohort_id);
create index if not exists aca_phase_two_project_revisions_by_learner on public.aca_phase_two_project_revisions(learner_id, created_at desc);

alter table public.aca_phase_two_cohorts enable row level security;
alter table public.aca_phase_two_memberships enable row level security;
alter table public.aca_phase_two_project_records enable row level security;
alter table public.aca_phase_two_project_revisions enable row level security;

-- Only the ACA curriculum owner and a learner's own records can be read.
create policy aca_phase_two_owner_read_cohorts on public.aca_phase_two_cohorts
for select to authenticated using (
  (select public.is_aca_curriculum_owner())
  or exists(
    select 1 from public.aca_phase_two_memberships m
    where m.cohort_id = id and m.learner_id = (select auth.uid())
  )
);
create policy aca_phase_two_owner_read_memberships on public.aca_phase_two_memberships
for select to authenticated using (
  learner_id = (select auth.uid()) or (select public.is_aca_curriculum_owner())
);
create policy aca_phase_two_owner_read_project on public.aca_phase_two_project_records
for select to authenticated using (
  learner_id = (select auth.uid()) or (select public.is_aca_curriculum_owner())
);
create policy aca_phase_two_owner_read_revisions on public.aca_phase_two_project_revisions
for select to authenticated using (
  learner_id = (select auth.uid()) or (select public.is_aca_curriculum_owner())
);

revoke all on public.aca_phase_two_cohorts,
  public.aca_phase_two_memberships,
  public.aca_phase_two_project_records,
  public.aca_phase_two_project_revisions from public, anon, authenticated;
grant select on public.aca_phase_two_cohorts,
  public.aca_phase_two_memberships,
  public.aca_phase_two_project_records,
  public.aca_phase_two_project_revisions to authenticated;

-- Merge nested section changes without silently removing existing section keys.
-- JSON null is rejected; ordinary edits remain versioned and reversible by staff.
create or replace function private.aca_phase_two_merge_sections(p_existing jsonb, p_patch jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
  v_result jsonb := coalesce(p_existing, '{}'::jsonb);
begin
  if jsonb_typeof(v_result) <> 'object' or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Project section updates must use JSON objects';
  end if;
  for v_key, v_value in select key, value from jsonb_each(p_patch) loop
    if v_value = 'null'::jsonb then
      raise exception 'Project section deletion requires a separate approved process';
    end if;
    if jsonb_typeof(v_value) = 'object' and jsonb_typeof(v_result->v_key) = 'object' then
      v_result := jsonb_set(v_result, array[v_key],
        private.aca_phase_two_merge_sections(v_result->v_key, v_value), true);
    else
      v_result := jsonb_set(v_result, array[v_key], v_value, true);
    end if;
  end loop;
  return v_result;
end;
$$;
revoke all on function private.aca_phase_two_merge_sections(jsonb, jsonb) from public, anon, authenticated;

-- Authorized learner autosave, available during active enrollment.
-- No credential credit, automatic approval, or lesson unlock occurs on save.
create or replace function public.save_aca_phase_two_project(
  p_enrollment_id uuid,
  p_project_path text,
  p_project_title text,
  p_patch jsonb,
  p_decision_note text default null
)
returns table(saved_version integer, saved_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_learner uuid := (select auth.uid());
  v_record public.aca_phase_two_project_records%rowtype;
begin
  if v_learner is null then
    raise exception 'Authentication required';
  end if;
  if p_project_path not in ('A','B') or p_project_path is null then
    raise exception 'Choose Path A or Path B';
  end if;
  if p_project_title is null or btrim(p_project_title) = '' then
    raise exception 'The project must have a title';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'The project update must be an object';
  end if;

  if not exists (
    select 1
    from public.aca_phase_two_memberships m
    join public.enrollments e on e.id = m.enrollment_id
    join public.courses c on c.id = m.course_id
    where m.enrollment_id = p_enrollment_id
      and m.learner_id = v_learner
      and e.learner_id = v_learner
      and e.course_id = m.course_id
      and e.status = 'active'
      and c.code = 'phase-two-ai-professional-builder'
      and c.status = 'published'
      and coalesce(e.starts_at, e.enrolled_at) <= now()
      and (e.access_expires_at is null or e.access_expires_at > now())
  ) then
    raise exception 'No active Phase Two enrollment for this project';
  end if;

  insert into public.aca_phase_two_project_records
    (enrollment_id, learner_id, project_path, project_title)
    values (p_enrollment_id, v_learner, p_project_path, btrim(p_project_title))
    on conflict (enrollment_id) do nothing;

  select * into v_record
  from public.aca_phase_two_project_records
  where enrollment_id = p_enrollment_id and learner_id = v_learner
  for update;

  if not found or v_record.project_path <> p_project_path then
    raise exception 'An existing project path cannot be replaced without review';
  end if;

  update public.aca_phase_two_project_records p
  set project_title = btrim(p_project_title),
      sections = private.aca_phase_two_merge_sections(p.sections, p_patch),
      version_number = p.version_number + 1,
      updated_at = now()
  where p.enrollment_id = p_enrollment_id
  returning * into v_record;

  insert into public.aca_phase_two_project_revisions
    (enrollment_id, learner_id, version_number, patch, saved_snapshot, decision_note)
  values (
    p_enrollment_id, v_learner, v_record.version_number,
    p_patch, v_record.sections, nullif(btrim(p_decision_note), '')
  );

  return query select v_record.version_number, v_record.updated_at;
end;
$$;
revoke all on function public.save_aca_phase_two_project(uuid, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.save_aca_phase_two_project(uuid, text, text, jsonb, text)
  to authenticated;
