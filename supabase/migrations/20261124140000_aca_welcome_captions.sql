-- Match welcome captions to the existing welcome-video access window.
-- Lesson captions remain available only through the timed lesson-media endpoint.
CREATE OR REPLACE FUNCTION public.can_read_aca_welcome_media(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists (
  select 1 from public.enrollments e
  where e.learner_id=auth.uid() and e.status in ('active','completed')
   and now() < private.aca_installment_access_deadline(e.id)
   and (e.starts_at is null or e.starts_at<=now())
   and (e.access_expires_at is null or e.access_expires_at>now())
   and (
    p_path in ('academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.mp4',
               'academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.en.vtt')
    or exists (
     select 1 from private.lesson_access_state(e.id,auth.uid(),now()) s
     join public.journey_introductions i on i.journey_id=s.current_journey_id
     where s.access_status in ('available','active') and i.status='published'
       and p_path in(i.media_path,i.caption_path,i.companion_audio_path,i.companion_caption_path)
    )
   )
 ) and not exists (select 1 from public.lessons l where p_path in(l.content->>'video_path',l.content->>'audio_path',l.content->>'video_caption_path'));
$function$;
