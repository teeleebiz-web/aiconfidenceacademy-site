alter table public.aca_interest_list
 add column if not exists newsletter_excluded boolean not null default false,
 add column if not exists newsletter_synced_at timestamptz,
 add column if not exists newsletter_error text,
 add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists aca_interest_unsubscribe_token on public.aca_interest_list(unsubscribe_token);
update public.aca_interest_list set newsletter_excluded=true
 where email in ('integration-test@aiconfidenceacademy.org','delivered+aca-launch-20260827@resend.dev');
create table public.aca_newsletter_state (
 id text primary key,
 value jsonb not null,
 updated_at timestamptz not null default now()
);
create table public.aca_newsletter_editions (
 week text primary key,
 status text not null default 'draft' check (status in ('draft','approved','sent')),
 items jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.aca_newsletter_state enable row level security;
alter table public.aca_newsletter_editions enable row level security;
revoke all on public.aca_newsletter_state, public.aca_newsletter_editions from public, anon, authenticated;
grant all on public.aca_newsletter_state, public.aca_newsletter_editions to service_role;
insert into public.aca_newsletter_state(id,value) values
 ('settings','{"segment_id":"033a0032-dddd-41f2-823d-227123b2b3f4","mode":"prepare_only"}');
