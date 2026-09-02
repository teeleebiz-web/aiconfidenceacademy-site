create table if not exists public.journey_introductions (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null unique references public.course_journeys(id) on delete cascade,
  media_kind text not null default 'video' check (media_kind in ('video', 'audio')),
  media_path text,
  caption_path text,
  duration_seconds integer not null check (duration_seconds between 30 and 900),
  content jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  source_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journey_introductions_content_shape check (
    jsonb_typeof(content) = 'object'
    and jsonb_typeof(content -> 'title') = 'string'
    and jsonb_typeof(content -> 'lead') = 'string'
    and jsonb_typeof(content -> 'outcomes') = 'array'
    and jsonb_typeof(content -> 'roadmap') = 'array'
    and jsonb_typeof(content -> 'transcript') = 'array'
  )
);

drop trigger if exists set_journey_introductions_updated_at on public.journey_introductions;
create trigger set_journey_introductions_updated_at
before update on public.journey_introductions
for each row execute function public.set_updated_at();

alter table public.journey_introductions enable row level security;

revoke all on public.journey_introductions from anon, authenticated;
grant select on public.journey_introductions to authenticated;

drop policy if exists "Learners can view introductions for enrolled journeys"
on public.journey_introductions;

create policy "Learners can view introductions for enrolled journeys"
on public.journey_introductions
for select
to authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.course_journeys j
    join public.enrollments e on e.course_id = j.course_id
    join public.courses c on c.id = j.course_id
    where j.id = journey_introductions.journey_id
      and j.status = 'published'
      and c.status = 'published'
      and e.learner_id = (select auth.uid())
      and e.status in ('active', 'completed')
      and (e.starts_at is null or e.starts_at <= now())
      and (e.access_expires_at is null or e.access_expires_at > now())
  )
);
