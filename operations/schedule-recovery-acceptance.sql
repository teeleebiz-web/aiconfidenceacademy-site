-- Disposable database only; every acceptance case rolls back.
begin;
do $$
declare a jsonb; b jsonb; r uuid; alert_id uuid; slot timestamptz; role_name text;
begin
 foreach role_name in array array['anon','authenticated'] loop
  assert not has_function_privilege(role_name,'public.aca_claim_daily_backup(text,text)','execute');
  assert not has_function_privilege(role_name,'public.aca_reconcile_installment_alerts()','execute');
  assert not has_table_privilege(role_name,'public.aca_automation_runs','insert');
 end loop;
 assert has_function_privilege('service_role','public.aca_claim_daily_backup(text,text)','execute');
 begin
  perform public.aca_claim_daily_backup(null,'1'); raise exception 'Invalid identity accepted';
 exception when raise_exception then assert sqlerrm='Invalid backup workflow identity'; end;
 update public.aca_backup_automation set enabled=false;
 begin
  perform public.aca_claim_daily_backup('1','1'); raise exception 'Disabled claim accepted';
 exception when raise_exception then assert sqlerrm='Automatic backup is not activated'; end;
 update public.aca_backup_automation set enabled=true;
 a:=public.aca_claim_daily_backup('1','1'); b:=public.aca_claim_daily_backup('2','1');
 assert (a->>'claimed')::boolean and not (b->>'claimed')::boolean and a->>'id'=b->>'id';
 slot:=(a->>'scheduledSlot')::timestamptz;
 assert slot<=now() and slot+interval '1 day'>now();
 assert to_char(slot at time zone 'UTC','HH24:MI')='18:17';
 assert (select count(*)=1 from public.aca_automation_runs);
 update public.aca_automation_runs set status='failed';
 assert not (public.aca_claim_daily_backup('3','1')->>'claimed')::boolean,'Failure cannot grant another full daily attempt';
 -- A pre-migration run has no scheduledSlot but still consumes the daily slot.
 update public.aca_automation_runs set result=result-'scheduledSlot';
 assert not (public.aca_claim_daily_backup('4','1')->>'claimed')::boolean;
 -- Prior slot history does not block the next day.
 update public.aca_automation_runs set started_at=slot-interval '1 hour';
 assert (public.aca_claim_daily_backup('5','1')->>'claimed')::boolean;

 insert into public.aca_operational_alerts(job,reason,status,occurred_at)
 values('installment-maintenance','run_missing','sent',now()-interval '2 days') returning id into alert_id;
 insert into public.aca_automation_runs(job,started_at,finished_at,status,result)
 values('installment-maintenance',now()-interval '3 days',now()-interval '3 days','completed','{"failed":0,"pauseFailures":0,"reminderFailures":0}') returning id into r;
 assert (public.aca_reconcile_installment_alerts()->>'resolved')::int=0,'Old success is not recovery';
 update public.aca_automation_runs set started_at=now()-interval '1 day',finished_at=now()-interval '23 hours',status='warning' where id=r;
 assert (public.aca_reconcile_installment_alerts()->>'resolved')::int=0;
 update public.aca_automation_runs set status='completed',result='{"failed":0,"pauseFailures":1,"reminderFailures":0}' where id=r;
 assert (public.aca_reconcile_installment_alerts()->>'resolved')::int=0,'Failures cannot resolve missing run';
 update public.aca_automation_runs set result='{"failed":"0","pauseFailures":0,"reminderFailures":0}' where id=r;
 assert (public.aca_reconcile_installment_alerts()->>'resolved')::int=0,'String zero is not proof';
 update public.aca_automation_runs set result='{"failed":0,"pauseFailures":0,"reminderFailures":0}' where id=r;
 insert into public.aca_operational_alerts(job,reason,status,occurred_at) values
 ('storage-backups','run_missing','sent',now()-interval '2 days'),
 ('installment-maintenance','job_failed','sent',now()-interval '2 days'),
 ('installment-maintenance','run_missing','queued',now()-interval '2 days'),
 ('installment-maintenance','run_missing','sent',now()-interval '1 hour');
 assert (public.aca_reconcile_installment_alerts()->>'resolved')::int=1;
 assert (select status='sent' and recovery_run_id=r and resolved_at=now()-interval '23 hours' from public.aca_operational_alerts where id=alert_id);
 assert (select count(*)=4 from public.aca_operational_alerts where resolved_at is null),'Unrelated alerts untouched';
 assert (public.aca_reconcile_installment_alerts()->>'resolved')::int=0,'Repeated reconciliation is idempotent';
 assert (select count(*)=5 from public.aca_operational_alerts),'No new notification queued';
end $$;
rollback;
