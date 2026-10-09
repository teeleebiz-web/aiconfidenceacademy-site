create table public.aca_update_subscriptions (
 email text primary key check(email=lower(btrim(email))),
 first_name text not null,
 last_name text not null,
 status text not null default 'active' check(status in ('active','unsubscribed')),
 consent_at timestamptz not null default now(),
 source text not null default 'aca_website_explicit_opt_in',
 interest_area text not null default 'ACA updates',
 unsubscribe_token uuid not null unique default gen_random_uuid(),
 synced_at timestamptz,
 sync_error text,
 created_at timestamptz not null default now()
);
alter table public.aca_update_subscriptions enable row level security;
revoke all on public.aca_update_subscriptions from public,anon,authenticated;
grant all on public.aca_update_subscriptions to service_role;
alter table public.aca_newsletter_editions
 add column dispatch_state text not null default 'pending' check(dispatch_state in ('pending','creating','ready','sending','submitted','needs_review')),
 add column broadcast_id uuid,
 add column last_error text,
 add column submitted_at timestamptz;
