-- Disposable CI/local database only; NEVER run against ACA production.
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.aca_backup_automation(id boolean primary key,enabled boolean,activated_at timestamptz,credential_expires_at timestamptz);
create table public.aca_automation_runs(id uuid primary key,job text,status text,result jsonb);
grant select,update on public.aca_backup_automation,public.aca_automation_runs to service_role;
insert into public.aca_backup_automation values(true,true,now(),now()+interval '3 days');
insert into public.aca_automation_runs values('00000000-0000-4000-8000-000000000001','storage-backups','running','{"format":"aca-automatic-backup-v1","workflowRunId":"123","workflowAttempt":"1"}');
