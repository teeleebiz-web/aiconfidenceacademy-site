alter table public.courses add column phase_number integer;
alter table public.course_journeys add column title text default 'Synthetic journey';
create table public.aca_email_events(event_key text,status text);
create function public.is_aca_curriculum_owner() returns boolean language sql as $$select false$$;
create table public.aca_phase_two_workbook_definitions(journey_number integer,content jsonb);
create table public.aca_phase_two_workbook_responses(enrollment_id uuid,learner_id uuid,journey_number integer,
 answers jsonb,last_page integer,revision integer,updated_at timestamptz);
create table public.aca_phase_two_project_records(enrollment_id uuid primary key,learner_id uuid,project_path text,
 project_title text,sections jsonb,version_number integer,updated_at timestamptz);
create table public.aca_trial_grants(id uuid,code_hash text,allowed_email text,course_id uuid,cohort_id uuid,
 enrollment_id uuid,status text,starts_at timestamptz,expires_at timestamptz,created_by uuid,updated_at timestamptz);
-- The full owner/trial application schema is deliberately not reconstructed here.
-- Its isolated Supabase acceptance remains a separate release gate.
