create table if not exists public.aca_payment_events (
  stripe_event_id text primary key,
  stripe_session_id text not null,
  customer_email text not null,
  amount_total integer,
  currency text,
  status text not null check (status in ('processing', 'completed', 'failed')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aca_payment_events enable row level security;
revoke all on public.aca_payment_events from public, anon, authenticated;
grant select, insert, update on public.aca_payment_events to service_role;
