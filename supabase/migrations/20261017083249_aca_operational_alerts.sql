-- Service-only operational notifications. No enrollment or curriculum mutation.
create table public.aca_operational_monitor (
 id boolean primary key default true check(id),
 activated_at timestamptz not null default now()
);
insert into public.aca_operational_monitor(id) values(true);
create table public.aca_operational_alerts (
 id uuid primary key default gen_random_uuid(), event_key text not null unique,
 job text not null check(job in('installment-maintenance','lesson-releases','newsletter-maintenance')),
 reason text not null check(reason in('job_failed','job_warning','run_missing','run_stalled','history_failed')),
 run_id uuid references public.aca_automation_runs(id) on delete set null,
 occurred_at timestamptz not null, recipient text not null,
 status text not null default 'queued' check(status in('queued','sending','sent','review')),
 attempts integer not null default 0 check(attempts>=0),
 first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(),
 claim_token uuid, claim_expires_at timestamptz, sent_at timestamptz,
 last_error text, created_at timestamptz not null default now()
);
create index aca_operational_alerts_pending_idx on public.aca_operational_alerts(next_attempt_at,created_at) where status in('queued','sending');
create index aca_operational_alerts_run_idx on public.aca_operational_alerts(run_id);
alter table public.aca_operational_monitor enable row level security;
alter table public.aca_operational_alerts enable row level security;
revoke all on public.aca_operational_monitor,public.aca_operational_alerts from public,anon,authenticated;
grant all on public.aca_operational_monitor,public.aca_operational_alerts to service_role;

-- A short lease prevents concurrent senders. A crashed function leaves a durable
-- attempt time, so the sender can respect the provider's 24-hour dedupe limit.
create function public.aca_claim_operational_alerts() returns setof public.aca_operational_alerts
language sql security invoker set search_path='' as $$
 update public.aca_operational_alerts a set status='sending',
  attempts=a.attempts+1, first_attempt_at=coalesce(a.first_attempt_at,now()),
  claim_token=gen_random_uuid(),claim_expires_at=now()+interval '5 minutes'
 from (
  select id from public.aca_operational_alerts
  where (status='queued' and next_attempt_at<=now())
     or (status='sending' and claim_expires_at<now())
  order by created_at limit 5 for update skip locked
 ) available where a.id=available.id returning a.*;
$$;
revoke all on function public.aca_claim_operational_alerts() from public,anon,authenticated;
grant execute on function public.aca_claim_operational_alerts() to service_role;
