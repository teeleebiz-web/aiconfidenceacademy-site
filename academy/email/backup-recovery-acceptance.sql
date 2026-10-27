-- Transaction-only acceptance: no transport, source-file work or retained fixtures.
begin;
do $$
declare
 good uuid:=gen_random_uuid(); bad uuid:=gen_random_uuid(); failed uuid:=gen_random_uuid(); late uuid:=gen_random_uuid();
 missing uuid:=gen_random_uuid(); stalled uuid:=gen_random_uuid(); failure uuid:=gen_random_uuid(); unsent uuid:=gen_random_uuid(); expiry uuid:=gen_random_uuid(); newer uuid:=gen_random_uuid(); other uuid:=gen_random_uuid();
 owner_email text; a uuid; proof jsonb; first_result jsonb; second_result jsonb; role_name text; f text;
begin
 select email into owner_email from public.aca_support_alert_recipients() limit 1;
 assert owner_email is not null;
 foreach role_name in array array['anon','authenticated'] loop
  foreach f in array array['aca_backup_proof(jsonb)','aca_reconcile_backup_alerts()','aca_backup_status()'] loop
   assert not has_function_privilege(role_name,'public.'||f,'EXECUTE'),'Backup RPCs must remain service-only';
  end loop;
  assert not has_table_privilege(role_name,'public.aca_operational_alerts','SELECT');
 end loop;
 proof:=jsonb_build_object('format','aca-automatic-backup-v1','reference','aca-backups/'||gen_random_uuid(),'liveAcaBackup',true,'uploadedAndReadbackVerified',true,'savedCopyDecryptionVerified',true,'restoredWithOriginalHashesVerified',true,'fileCount',68,'totalBytes',1650971985,'encryptedBytes',1651002110,'retention',jsonb_build_object('kept',2,'pruned',0,'manualBaselinePreserved',true));
 assert public.aca_backup_proof(proof);
 assert not public.aca_backup_proof(proof||'{"fileCount":"68"}'::jsonb);
 assert not public.aca_backup_proof(proof||'{"fileCount":0}'::jsonb);
 assert not public.aca_backup_proof(proof||'{"savedCopyDecryptionVerified":false}'::jsonb);
 assert not public.aca_backup_proof(proof||'{"reference":"../other"}'::jsonb);
 insert into public.aca_automation_runs(id,job,started_at,finished_at,status,result) values
 (failed,'storage-backups',now()-interval '19 minutes',now()-interval '16 minutes','failed','{}'),
 (good,'storage-backups',now()-interval '12 minutes',now()-interval '10 minutes','completed',proof),
 (late,'storage-backups',now()-interval '2 minutes',now()-interval '1 minute','warning',proof),
 (bad,'storage-backups',now()-interval '50 seconds',now()-interval '30 seconds','completed',proof||'{"savedCopyDecryptionVerified":false}'::jsonb);
 insert into public.aca_operational_alerts(id,event_key,job,reason,run_id,occurred_at,recipient,status,first_attempt_at) values
 (missing,'rollback:'||missing,'storage-backups','run_missing',null,now()-interval '17 minutes',owner_email,'sent',now()-interval '16 minutes'),
 (stalled,'rollback:'||stalled,'storage-backups','run_stalled',good,now()-interval '12 minutes',owner_email,'sent',now()-interval '11 minutes'),
 (failure,'rollback:'||failure,'storage-backups','job_failed',failed,now()-interval '19 minutes',owner_email,'sent',now()-interval '16 minutes'),
 (unsent,'rollback:'||unsent,'storage-backups','run_missing',null,now()-interval '14 minutes',owner_email,'queued',null),
 (expiry,'rollback:'||expiry,'storage-backups','credential_expiring',null,now()-interval '20 minutes',owner_email,'queued',null),
 (newer,'rollback:'||newer,'storage-backups','job_warning',late,now()-interval '2 minutes',owner_email,'queued',null),
 (other,'rollback:'||other,'lesson-releases','run_missing',null,now()-interval '17 minutes',owner_email,'queued',null);
 foreach a in array array[missing,stalled,failure] loop
  insert into public.aca_email_events(event_key,template_key,recipient,subject,status)
  values('operations-alert:'||a,'automation_owner_alert',owner_email,'Rollback-only acceptance','delivered');
 end loop;
 first_result:=public.aca_reconcile_backup_alerts();
 assert (select count(*)=3 from public.aca_operational_alerts where id=any(array[missing,stalled,failure]) and resolved_at=now()-interval '10 minutes' and recovery_run_id=good),'Only later verified completion resolves reported incidents';
 assert (select status='cancelled' and resolved_at is not null from public.aca_operational_alerts where id=unsent),'Never send a stale warning which had no earlier attempt';
 assert (select count(*)=1 from public.aca_operational_alerts where reason='backup_recovered' and run_id=good and recipient=owner_email),'Several resolved warnings produce one recovery';
 assert (select count(*)=3 from public.aca_operational_alerts where id=any(array[expiry,newer,other]) and resolved_at is null),'Newer failures, expiry and unrelated jobs remain open';
 second_result:=public.aca_reconcile_backup_alerts();
 assert (second_result->>'queued')::int=0 and (second_result->>'resolved')::int=0,'Reconciliation retries are idempotent';
 assert not (public.aca_backup_status()::text like '%'||owner_email||'%'),'Owner response excludes private recipients';
 begin
  insert into public.aca_operational_alerts(event_key,job,reason,run_id,occurred_at,recipient)
  values('rollback:invalid:'||gen_random_uuid(),'lesson-releases','backup_recovered',good,now(),owner_email);
  raise exception 'Non-backup recovery event accepted';
 exception when check_violation then null; end;
end $$;
rollback;
select 'Backup proof gates, later-run ordering, incident state, grouped recovery dedupe, stale-warning cancellation, unrelated-job isolation and service permissions passed; fixtures rolled back, no email sent.' as result;
