-- Disposable database only. Never execute this fixture against an Academy project.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create table public.aca_backup_automation(id boolean primary key, enabled boolean not null);
insert into public.aca_backup_automation values(true,true);
create table public.aca_automation_runs(
 id uuid primary key default gen_random_uuid(),job text not null,started_at timestamptz not null default now(),
 finished_at timestamptz,status text not null default 'running',result jsonb
);
create unique index aca_automatic_backup_attempt_idx on public.aca_automation_runs
 ((result->>'workflowRunId'),(result->>'workflowAttempt'))
 where job='storage-backups' and result->>'format'='aca-automatic-backup-v1';
create table public.aca_operational_alerts(
 id uuid primary key default gen_random_uuid(),job text,reason text,status text,occurred_at timestamptz,
 resolved_at timestamptz,recovery_run_id uuid references public.aca_automation_runs(id),
 constraint aca_backup_resolution_check check(
  (resolved_at is null and recovery_run_id is null) or
  (resolved_at is not null and recovery_run_id is not null and resolved_at>=occurred_at
   and job='storage-backups' and reason in('job_failed','job_warning','run_missing','run_stalled','history_failed')))
);
alter table public.aca_automation_runs enable row level security;
alter table public.aca_operational_alerts enable row level security;
revoke all on public.aca_automation_runs,public.aca_operational_alerts,public.aca_backup_automation from public,anon,authenticated;
grant select,insert,update on public.aca_automation_runs,public.aca_operational_alerts,public.aca_backup_automation to service_role;
