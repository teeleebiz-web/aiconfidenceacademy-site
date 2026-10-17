-- Rollback-only service queue acceptance. No transport, accounts or access changes.
begin;
do $$
declare a uuid:=gen_random_uuid(); first_claim uuid; second_claim uuid; changed int; role_name text; action_name text;
begin
 foreach role_name in array array['anon','authenticated'] loop
  foreach action_name in array array['SELECT','INSERT','UPDATE','DELETE'] loop
   assert not has_table_privilege(role_name,'public.aca_operational_alerts',action_name),'Alert records must stay service-only';
   assert not has_table_privilege(role_name,'public.aca_operational_monitor',action_name),'Activation state must stay service-only';
  end loop;
  assert not has_function_privilege(role_name,'public.aca_claim_operational_alerts()','EXECUTE'),'Clients cannot claim alerts';
 end loop;
 assert has_function_privilege('service_role','public.aca_claim_operational_alerts()','EXECUTE');
 assert (select relrowsecurity from pg_class where oid='public.aca_operational_alerts'::regclass);
 assert (select relrowsecurity from pg_class where oid='public.aca_operational_monitor'::regclass);
 insert into public.aca_operational_alerts(id,event_key,job,reason,occurred_at,recipient,created_at)
 values(a,'rollback-alert:'||a,'installment-maintenance','job_failed',now(),'disposable@example.test','1900-01-01');
 insert into public.aca_operational_alerts(event_key,job,reason,occurred_at,recipient)
 values('rollback-alert:'||a,'installment-maintenance','job_failed',now(),'disposable@example.test') on conflict(event_key) do nothing;
 assert (select count(*)=1 from public.aca_operational_alerts where event_key='rollback-alert:'||a),'Logical alert must deduplicate';
 select claim_token into first_claim from public.aca_claim_operational_alerts() where id=a;
 assert first_claim is not null,'Eligible alert must be claimed';
 assert (select attempts=1 and first_attempt_at is not null and status='sending' from public.aca_operational_alerts where id=a);
 assert not exists(select 1 from public.aca_claim_operational_alerts() where id=a),'Active claim must exclude competing senders';
 update public.aca_operational_alerts set claim_expires_at=now()-interval '1 second' where id=a;
 select claim_token into second_claim from public.aca_claim_operational_alerts() where id=a;
 assert second_claim is not null and second_claim<>first_claim,'Expired lease must get a new token';
 update public.aca_operational_alerts set status='sent' where id=a and claim_token=first_claim;
 get diagnostics changed=row_count;assert changed=0,'Stale sender cannot settle a new claim';
 update public.aca_operational_alerts set status='sent',claim_token=null,claim_expires_at=null where id=a and claim_token=second_claim;
 get diagnostics changed=row_count;assert changed=1;
 assert not exists(select 1 from public.aca_claim_operational_alerts() where id=a),'Submitted alert cannot be reclaimed';
 assert (select attempts=2 from public.aca_operational_alerts where id=a);
end $$;
rollback;
select 'Service permissions, RLS, logical dedupe, exclusive claims, crash recovery and stale-token guards passed; fixtures rolled back, no email sent.' as result;
