-- ACA learner-portal Data API grants.
--
-- Curriculum text, answer keys, implementation notes, and protected assets are
-- intentionally excluded from this public repository. They are installed from
-- the authoritative private curriculum source directly into the protected ACA
-- Supabase project.

grant usage on schema public to authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, first_name, last_name, timezone, avatar_url)
  on table public.profiles to authenticated;

grant select on table public.courses to authenticated;
grant select on table public.enrollments to authenticated;
grant select on table public.course_journeys to authenticated;
grant select on table public.lessons to authenticated;

grant select, insert, update on table public.lesson_progress to authenticated;
grant select, insert, update on table public.learner_artifacts to authenticated;
grant select, insert on table public.assessment_attempts to authenticated;

revoke all on table aca_private.lesson_answer_keys from anon, authenticated;
revoke all on table aca_private.lesson_implementation from anon, authenticated;
