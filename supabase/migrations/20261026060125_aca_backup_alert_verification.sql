-- An explicitly labeled owner-only delivery test for the existing backup alert path.
alter table public.aca_operational_alerts drop constraint aca_operational_alerts_reason_check;
alter table public.aca_operational_alerts add constraint aca_operational_alerts_reason_check
check(reason in('job_failed','job_warning','run_missing','run_stalled','history_failed','credential_expiring','verification_test'));
alter table public.aca_operational_alerts add constraint aca_backup_alert_verification_job_check
check(reason<>'verification_test' or job='storage-backups');
