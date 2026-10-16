-- Additive only: retain every existing subscription, test and original edition.
alter table public.aca_update_subscriptions
 add column interests text[] check(interests <@ array['Videos','Phase One','Books & Resources','ACA updates']::text[]),
 add column routing_synced boolean not null default false,
 add column activated_interests text[] not null default '{}';
create table public.aca_newsletter_interest_editions (
 week text primary key,
 parent_week text not null references public.aca_newsletter_editions(week),
 category text not null check(category in ('Videos','Phase One','Books & Resources','ACA updates')),
 status text not null default 'draft' check(status in ('draft','approved','sent')),
 items jsonb not null,
 dispatch_state text not null default 'pending' check(dispatch_state in ('pending','creating','ready','sending','submitted','needs_review')),
 broadcast_id uuid,
 last_error text,
 submitted_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(parent_week,category)
);
alter table public.aca_newsletter_interest_editions enable row level security;
revoke all on public.aca_newsletter_interest_editions from public,anon,authenticated;
grant all on public.aca_newsletter_interest_editions to service_role;
