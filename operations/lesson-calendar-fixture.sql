alter table public.courses add column phase_number integer;
alter table public.course_journeys add column title text default 'Synthetic journey';
create table public.aca_email_events(event_key text,status text);
create function public.is_aca_curriculum_owner() returns boolean language sql as $$select false$$;
create table public.aca_phase_two_workbook_definitions(journey_number integer,content jsonb);
create table public.aca_phase_two_workbook_responses(enrollment_id uuid,learner_id uuid,journey_number integer,
 answers jsonb,last_page integer,revision integer,updated_at timestamptz);
-- Functions for unchanged operational branches are installed but are not invoked
-- in this focused fixture. A full Supabase acceptance remains a separate gate.
set check_function_bodies=false;
