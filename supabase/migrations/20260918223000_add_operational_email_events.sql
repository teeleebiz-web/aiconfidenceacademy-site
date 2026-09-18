create table if not exists public.aca_email_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  template_key text not null,
  template_version integer not null default 1 check (template_version > 0),
  recipient text not null,
  subject text not null,
  status text not null check (status in ('queued', 'sending', 'sent', 'delivered', 'bounced', 'complained', 'suppressed', 'failed')),
  provider_message_id text unique,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  learner_id uuid references auth.users(id) on delete set null,
  attempts integer not null default 0 check (attempts >= 0),
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aca_email_events_status_schedule_idx
  on public.aca_email_events (status, scheduled_for);
create index if not exists aca_email_events_enrollment_idx
  on public.aca_email_events (enrollment_id, created_at desc);
create index if not exists aca_email_events_recipient_idx
  on public.aca_email_events (recipient, created_at desc);

alter table public.aca_email_events enable row level security;
revoke all on public.aca_email_events from public, anon, authenticated;
grant select, insert, update on public.aca_email_events to service_role;

create or replace function public.set_aca_email_event_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aca_email_events_updated_at on public.aca_email_events;
create trigger aca_email_events_updated_at
before update on public.aca_email_events
for each row execute function public.set_aca_email_event_updated_at();

revoke execute on function public.set_aca_email_event_updated_at() from public, anon, authenticated;
