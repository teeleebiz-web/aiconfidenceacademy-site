-- Only explicitly staged learners can read their own published course listing.
-- Lesson, media, workbook and timer access remain governed by active enrollment.
create policy "Staged learners can view their assigned course"
on public.courses for select to authenticated
using (
 status='published' and exists (
  select 1 from public.enrollments e
  where e.course_id=courses.id and e.learner_id=(select auth.uid())
   and e.status='pending' and e.learner_start_pending
   and (e.access_expires_at is null or e.access_expires_at>now())
 )
);
