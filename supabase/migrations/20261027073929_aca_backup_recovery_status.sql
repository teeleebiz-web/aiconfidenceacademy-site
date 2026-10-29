-- Backup incident state is independent of notification submission/delivery.
-- All functions remain service-only; the existing verified owner route is the UI gate.
alter table public.aca_operational_alerts
  add column resolved_at timestamptz,
  add column recovery_run_id uuid references public.aca_automation_runs(id);
create unique index aca_backup_recovered_notice_idx on public.aca_operational_alerts(run_id,recipient) where reason='backup_recovered';
create index aca_backup_alert_recovery_idx on public.aca_operational_alerts(recovery_run_id);
alter table public.aca_operational_alerts drop constraint aca_operational_alerts_reason_check;
alter table public.aca_operational_alerts add constraint aca_operational_alerts_reason_check
  check(reason in('job_failed','job_warning','run_missing','run_stalled','history_failed','credential_expiring','verification_test','backup_recovered'));
alter table public.aca_operational_alerts drop constraint aca_operational_alerts_status_check;
alter table public.aca_operational_alerts add constraint aca_operational_alerts_status_check
  check(status in('queued','sending','sent','review','cancelled'));
alter table public.aca_operational_alerts add constraint aca_backup_recovery_job_check
  check(reason<>'backup_recovered' or (job='storage-backups' and run_id is not null));
alter table public.aca_operational_alerts add constraint aca_backup_resolution_check
  check((resolved_at is null and recovery_run_id is null) or
    (resolved_at is not null and recovery_run_id is not null and resolved_at>=occurred_at
     and job='storage-backups' and reason in('job_failed','job_warning','run_missing','run_stalled','history_failed')));
alter table public.aca_operational_alerts add constraint aca_backup_cancelled_check
  check(status<>'cancelled' or (resolved_at is not null and first_attempt_at is null));

create function public.aca_backup_proof(p_result jsonb) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce(
   p_result @> '{"format":"aca-automatic-backup-v1","liveAcaBackup":true,"uploadedAndReadbackVerified":true,"savedCopyDecryptionVerified":true,"restoredWithOriginalHashesVerified":true}'::jsonb
   and p_result->>'reference' ~ '^aca-backups/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   and case when jsonb_typeof(p_result->'fileCount')='number' and jsonb_typeof(p_result->'totalBytes')='number' and jsonb_typeof(p_result->'encryptedBytes')='number'
     then (p_result->>'fileCount')::numeric>0 and mod((p_result->>'fileCount')::numeric,1)=0
       and (p_result->>'totalBytes')::numeric>0 and (p_result->>'encryptedBytes')::numeric>0 else false end,
   false);
$$;
revoke all on function public.aca_backup_proof(jsonb) from public,anon,authenticated;
grant execute on function public.aca_backup_proof(jsonb) to service_role;

create function public.aca_reconcile_backup_alerts() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare incident record; recovered record; resolved_count int:=0; queued_count int:=0;
begin
 -- Serialize reconciliation, including runner/monitor overlap. Email claims retain their leases.
 perform pg_advisory_xact_lock(hashtextextended('aca-backup-incident-resolution',0));
 for incident in
   select a.*, failed.finished_at as failed_finished_at from public.aca_operational_alerts a
   left join public.aca_automation_runs failed on failed.id=a.run_id
   where a.job='storage-backups' and a.resolved_at is null
     and a.reason in('job_failed','job_warning','run_missing','run_stalled','history_failed')
   order by a.occurred_at for update of a
 loop
   select r.id,r.finished_at into recovered from public.aca_automation_runs r
   where r.job='storage-backups' and r.status='completed' and r.finished_at<=now()
     and r.finished_at>=greatest(incident.occurred_at,incident.failed_finished_at)
     and r.started_at>=incident.occurred_at and r.finished_at>=r.started_at
     and public.aca_backup_proof(r.result) and not coalesce(r.result @> '{"failed":true}',false)
     and (r.result->'retention' @> '{"manualBaselinePreserved":true}'::jsonb
          or r.result->'retention' @> '{"held":"deletion-not-activated"}'::jsonb)
   order by r.finished_at,r.id limit 1;
   if found then
     update public.aca_operational_alerts a set resolved_at=recovered.finished_at,recovery_run_id=recovered.id,
       status=case when a.status='queued' and a.first_attempt_at is null
         and not exists(select 1 from public.aca_email_events e where e.event_key='operations-alert:'||a.id)
         then 'cancelled' else a.status end
     where a.id=incident.id;
     resolved_count:=resolved_count+1;
   end if;
 end loop;
 -- One recovery per successful run and recipient, even if it resolves several warnings.
 -- Only follow up a warning actually submitted; never invent a prior notification.
 insert into public.aca_operational_alerts(event_key,job,reason,run_id,occurred_at,recipient)
 select distinct 'storage-backups:recovered:'||a.recovery_run_id||':'||md5(lower(a.recipient)),
   'storage-backups','backup_recovered',a.recovery_run_id,a.resolved_at,a.recipient
 from public.aca_operational_alerts a
 join public.aca_email_events e on e.event_key='operations-alert:'||a.id and e.status in('sent','delivered')
 join public.aca_support_alert_recipients() owners on lower(owners.email)=lower(a.recipient)
 where a.job='storage-backups' and a.resolved_at is not null
 on conflict(event_key) do nothing;
 get diagnostics queued_count=row_count;
 return jsonb_build_object('resolved',resolved_count,'queued',queued_count);
end;
$$;
revoke all on function public.aca_reconcile_backup_alerts() from public,anon,authenticated;
grant execute on function public.aca_reconcile_backup_alerts() to service_role;

create function public.aca_backup_status() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
   'policy',(select jsonb_build_object('enabled',p.enabled,'keep_daily',p.keep_daily,'prune_enabled',p.prune_enabled,'credential_expires_at',p.credential_expires_at) from public.aca_backup_automation p where p.id),
   'latest_run',(select to_jsonb(r) from (select id,job,started_at,finished_at,status,result from public.aca_automation_runs where job='storage-backups' order by started_at desc limit 1) r),
   'last_verified',(select to_jsonb(r) from (select id,job,started_at,finished_at,status,result from public.aca_automation_runs where job='storage-backups' and status in('completed','warning') and public.aca_backup_proof(result) and finished_at is not null order by finished_at desc limit 1) r),
   'open_count',(select count(*) from public.aca_operational_alerts where job='storage-backups' and reason not in('verification_test','backup_recovered') and resolved_at is null),
   'incidents',coalesce((select jsonb_agg(to_jsonb(i) order by i.occurred_at desc) from (
     select a.id,a.reason,a.occurred_at,a.resolved_at,a.recovery_run_id,
       coalesce(e.status,a.status) as warning_delivery,
       coalesce(re.status,ra.status) as recovery_delivery
     from public.aca_operational_alerts a
     left join public.aca_email_events e on e.event_key='operations-alert:'||a.id
     left join public.aca_operational_alerts ra on ra.reason='backup_recovered' and ra.run_id=a.recovery_run_id and ra.recipient=a.recipient
     left join public.aca_email_events re on re.event_key='operations-alert:'||ra.id
     where a.job='storage-backups' and a.reason not in('verification_test','backup_recovered')
     order by a.occurred_at desc limit 50
   ) i),'[]'::jsonb)
 );
$$;
revoke all on function public.aca_backup_status() from public,anon,authenticated;
grant execute on function public.aca_backup_status() to service_role;
