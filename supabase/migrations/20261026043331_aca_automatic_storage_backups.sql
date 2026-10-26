-- Backup-only controls. Disabled defaults are proposals, not founder activation.
create table public.aca_backup_automation (
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  activated_at timestamptz,
  prune_enabled boolean not null default false,
  keep_daily integer not null default 7 check(keep_daily between 7 and 30),
  credential_expires_at timestamptz,
  check(not enabled or activated_at is not null),
  check(not prune_enabled or enabled)
);
-- The exact expiry hour is unknown: midnight UTC is the conservative boundary.
insert into public.aca_backup_automation(id,credential_expires_at)
values(true,'2026-11-01T00:00:00Z');
alter table public.aca_backup_automation enable row level security;
revoke all on public.aca_backup_automation from public,anon,authenticated;
grant select,insert,update,delete on public.aca_backup_automation to service_role;

create unique index aca_automatic_backup_attempt_idx
on public.aca_automation_runs((result->>'workflowRunId'),(result->>'workflowAttempt'))
where job='storage-backups' and result->>'format'='aca-automatic-backup-v1';

alter table public.aca_operational_alerts drop constraint aca_operational_alerts_job_check;
alter table public.aca_operational_alerts add constraint aca_operational_alerts_job_check
check(job in('installment-maintenance','lesson-releases','newsletter-maintenance','storage-backups'));
alter table public.aca_operational_alerts drop constraint aca_operational_alerts_reason_check;
alter table public.aca_operational_alerts add constraint aca_operational_alerts_reason_check
check(reason in('job_failed','job_warning','run_missing','run_stalled','history_failed','credential_expiring'));
