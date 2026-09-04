-- Prepare each protected Journey welcome for two distinct media assets:
-- the founder/avatar video and the Knowledge companion audio guide.

alter table public.journey_introductions
  add column if not exists companion_audio_path text,
  add column if not exists companion_caption_path text;

comment on column public.journey_introductions.media_path is
  'Protected storage path for the Journey founder/avatar welcome video.';
comment on column public.journey_introductions.caption_path is
  'Protected storage path for the founder/avatar welcome WebVTT captions.';
comment on column public.journey_introductions.companion_audio_path is
  'Protected storage path for the Journey companion audio guide.';
comment on column public.journey_introductions.companion_caption_path is
  'Protected storage path for the companion audio transcript or WebVTT captions.';
