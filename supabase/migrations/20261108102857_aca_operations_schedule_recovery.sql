-- One automatic backup start per 18:17 UTC slot, across native and timer dispatch.
-- A failed/uncertain start consumes the slot; only the existing bounded retry may
-- retry source work. No new credential, storage, retention or payment permission.
create unique index aca_daily_backup_slot_idx
 on public.aca_automation_runs ((result->>'scheduledSlot'))
 where job='storage-backups' and result->>'format'='aca-automatic-backup-v1'
 and result->>'scheduledSlot' is not null;

create function public.aca_claim_daily_backup(p_workflow_run_id text,p_workflow_attempt text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare slot timestamptz; existing uuid; new_id uuid;
begin
 if p_workflow_run_id is null or p_workflow_run_id !~ '^[0-9]{1,20}$'
 or p_workflow_attempt is null or p_workflow_attempt !~ '^[0-9]{1,20}$' then
  raise exception 'Invalid backup workflow identity';
 end if;
 perform pg_advisory_xact_lock(hashtext('aca-daily-backup-slot'));
 if not exists(select 1 from public.aca_backup_automation where id=true and enabled=true) then
  raise exception 'Automatic backup is not activated';
 end if;
 slot := (date_trunc('day',now() at time zone 'UTC') + interval '18 hours 17 minutes') at time zone 'UTC';
 if slot>now() then slot:=slot-interval '1 day'; end if;
 -- Recognize work started before this migration as well as new claimed runs.
 select id into existing from public.aca_automation_runs
 where job='storage-backups' and result->>'format'='aca-automatic-backup-v1'
 and started_at>=slot and started_at<slot+interval '1 day'
 order by started_at limit 1;
 if existing is not null then
  return jsonb_build_object('claimed',false,'id',existing,'scheduledSlot',slot);
 end if;
 insert into public.aca_automation_runs(job,started_at,status,result)
 values('storage-backups',now(),'running',jsonb_build_object('format','aca-automatic-backup-v1',
  'workflowRunId',p_workflow_run_id,'workflowAttempt',p_workflow_attempt,'scheduledSlot',slot)) returning id into new_id;
 return jsonb_build_object('claimed',true,'id',new_id,'scheduledSlot',slot);
end $$;
revoke all on function public.aca_claim_daily_backup(text,text) from public,anon,authenticated;
grant execute on function public.aca_claim_daily_backup(text,text) to service_role;

-- Preserve the backup proof rules. Extend incident state only for delivered
-- installment run_missing warnings after a later completely successful run.
alter table public.aca_operational_alerts drop constraint aca_backup_resolution_check;
alter table public.aca_operational_alerts add constraint aca_backup_resolution_check check (
 (resolved_at is null and recovery_run_id is null) or
 (resolved_at is not null and recovery_run_id is not null and resolved_at>=occurred_at and (
  (job='storage-backups' and reason in('job_failed','job_warning','run_missing','run_stalled','history_failed')) or
  (job='installment-maintenance' and reason='run_missing')
 )));
create function public.aca_reconcile_installment_alerts()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare alert record; recovery record; count_resolved integer:=0;
begin
 perform pg_advisory_xact_lock(hashtext('aca-installment-alert-recovery'));
 for alert in select id,occurred_at from public.aca_operational_alerts
 where job='installment-maintenance' and reason='run_missing' and status='sent'
 and resolved_at is null for update loop
  select id,finished_at into recovery from public.aca_automation_runs
  where job='installment-maintenance' and status='completed'
  and started_at>=alert.occurred_at and finished_at>=started_at and finished_at<=now()
  and result->'failed'='0'::jsonb and result->'pauseFailures'='0'::jsonb
  and result->'reminderFailures'='0'::jsonb
  order by finished_at limit 1;
  if recovery.id is not null then
   update public.aca_operational_alerts set resolved_at=recovery.finished_at,recovery_run_id=recovery.id where id=alert.id;
   count_resolved:=count_resolved+1;
  end if;
 end loop;
 -- No notification or queue changes: original warning and delivery remain audit history.
 return jsonb_build_object('resolved',count_resolved);
end $$;
revoke all on function public.aca_reconcile_installment_alerts() from public,anon,authenticated;
grant execute on function public.aca_reconcile_installment_alerts() to service_role;
