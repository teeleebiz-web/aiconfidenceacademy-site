-- Learners receive lesson recordings only through the deadline-checked server.
-- Preserve the existing owner review and enrolled-learner welcome recordings.
create or replace function public.can_read_aca_welcome_media(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from public.enrollments e
  where e.learner_id=auth.uid() and e.status in ('active','completed')
   and (e.starts_at is null or e.starts_at<=now())
   and (e.access_expires_at is null or e.access_expires_at>now())
   and (
    p_path='academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.mp4'
    or exists (
     select 1 from private.lesson_access_state(e.id,auth.uid(),now()) s
     join public.journey_introductions i on i.journey_id=s.current_journey_id
     where s.access_status in ('available','active') and i.status='published'
       and p_path in(i.media_path,i.caption_path,i.companion_audio_path,i.companion_caption_path)
    )
   )
 ) and not exists (select 1 from public.lessons l where p_path in(l.content->>'video_path',l.content->>'audio_path'));
$$;
revoke all on function public.can_read_aca_welcome_media(text) from public,anon;
grant execute on function public.can_read_aca_welcome_media(text) to authenticated;
alter policy "ACA members can view protected learning media" on storage.objects
 using (bucket_id='aca-learning-media' and ((select public.is_aca_curriculum_owner()) or public.can_read_aca_welcome_media(name)));
