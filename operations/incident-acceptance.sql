-- Rollback-only service boundary and report contract proof. No real outage,
-- email, backup, payment, learner row or retained production incident is made.
begin;
do $$
declare role_name text; table_name text; report jsonb; good jsonb; rejected boolean;
begin
 foreach role_name in array array['anon','authenticated'] loop
  foreach table_name in array array['aca_incident_settings','aca_incident_coordinator','aca_incident_reports'] loop
   if has_table_privilege(role_name,'public.'||table_name,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Client table access';end if;
   if not(select relrowsecurity from pg_class where oid=('public.'||table_name)::regclass) then raise exception 'Missing RLS';end if;
  end loop;
  if has_function_privilege(role_name,'public.aca_ingest_incident_report(jsonb)','EXECUTE') or has_function_privilege(role_name,'public.aca_incident_snapshot()','EXECUTE') then raise exception 'Client function access';end if;
 end loop;
 if not has_function_privilege('service_role','public.aca_incident_snapshot()','EXECUTE') then raise exception 'Missing service access';end if;
 report:=jsonb_build_object('id',repeat('a',64),'role','backend','source_at',now()-interval '10 minutes','observed_at',now()-interval '5 minutes','resolved_at',null,'status','open','diagnosis','backend_readiness_failed','provider_status','down','source_code',503,'repair_performed',false,
 'samples','{"website":[{"code":200,"ready":true,"readiness":null,"error":null},{"code":200,"ready":true,"readiness":null,"error":null}],"backend":[{"code":503,"ready":false,"readiness":"unavailable","error":null},{"code":503,"ready":false,"readiness":"unavailable","error":null}]}'::jsonb);
 if not public.aca_ingest_incident_report(report) then raise exception 'Valid open evidence rejected';end if;
 foreach good in array array[report||'{"repair_performed":true}'::jsonb,report||'{"destination":"https://invalid.example"}'::jsonb,report||'{"source_code":"secret"}'::jsonb,report||'{"status":"recovered","diagnosis":"recovered","provider_status":"up"}'::jsonb,report||'{"samples":{"website":[],"backend":[]}}'::jsonb] loop
  rejected:=false;
  begin perform public.aca_ingest_incident_report(good);exception when others then rejected:=true;end;
  if not rejected then raise exception 'Malformed evidence accepted';end if;
 end loop;
 good:=report||jsonb_build_object('observed_at',now(),'resolved_at',now(),'status','recovered','diagnosis','recovered','provider_status','up','samples','{"website":[{"code":200,"ready":true,"readiness":null,"error":null},{"code":200,"ready":true,"readiness":null,"error":null}],"backend":[{"code":200,"ready":true,"readiness":"ok","error":null},{"code":200,"ready":true,"readiness":"ok","error":null}]}'::jsonb);
 if not public.aca_ingest_incident_report(good) then raise exception 'Valid confirmed recovery rejected';end if;
 if public.aca_ingest_incident_report(report) then raise exception 'Older evidence reopened recovery';end if;
 if public.aca_ingest_incident_report(report||jsonb_build_object('observed_at',now()+interval '1 second')) then raise exception 'Later open evidence reopened recovery';end if;
 if public.aca_incident_snapshot()->>'available'<>'true' then raise exception 'Private snapshot missing';end if;
end;$$;
rollback;
