-- Run only after support-investigation-fixture.sql in a disposable database.
begin;
do $$ declare c uuid:='00000000-0000-4000-8000-000000000001'; token uuid; gen integer; r jsonb; n integer;
begin
 if exists(select 1 from public.aca_support_investigation_settings where enabled) then raise exception 'Must default disabled'; end if;
 if has_table_privilege('anon','public.aca_support_investigations','select') or
    has_table_privilege('authenticated','public.aca_support_investigation_reports','select') or
    has_function_privilege('anon','public.aca_claim_support_investigations()','execute') or
    has_function_privilege('authenticated','public.aca_complete_support_investigation(uuid,uuid,integer,jsonb)','execute') then raise exception 'Public access leak'; end if;
 insert into public.aca_support_cases values(c,'technical','open');
 insert into public.aca_support_messages values(gen_random_uuid(),c,'requester','old report',clock_timestamp());
 if exists(select 1 from public.aca_support_investigations) then raise exception 'Disabled intake'; end if;
 update public.aca_support_investigation_settings set enabled=true,activated_at=clock_timestamp() where id;
 if exists(select 1 from public.aca_claim_support_investigations()) then raise exception 'Old case backfill'; end if;
 insert into public.aca_support_messages values(gen_random_uuid(),c,'academy','owner reply',clock_timestamp());
 if exists(select 1 from public.aca_support_investigations) then raise exception 'Owner reply created work'; end if;
 insert into public.aca_support_messages values(gen_random_uuid(),c,'requester','new report',clock_timestamp());
 insert into public.aca_support_messages values(gen_random_uuid(),c,'requester','follow-up',clock_timestamp());
 if (select count(*) from public.aca_support_investigations)<>1 or (select generation from public.aca_support_investigations)<>2 then raise exception 'Case deduplication'; end if;
 select claim_token,generation into token,gen from public.aca_claim_support_investigations();
 if token is null or gen<>2 then raise exception 'Missing claim'; end if;
 if exists(select 1 from public.aca_claim_support_investigations()) then raise exception 'Overlapping claim'; end if;
 insert into public.aca_support_messages values(gen_random_uuid(),c,'requester','arrived while running',clock_timestamp());
 -- Synthetic time fixture; no sleep, network, email, enrollment or paid API.
 update public.aca_support_investigations set lease_until=clock_timestamp()+interval '4 minutes 30 seconds' where case_id=c;
 r:=jsonb_build_object('version',1,'started_at',clock_timestamp()-interval '20 seconds','observed_at',clock_timestamp(),
  'diagnosis','no_shared_outage','repair_performed',false,'user_flow_verified',false,
  'samples',jsonb_build_object('website',jsonb_build_array(jsonb_build_object('code',200,'ready',true,'readiness',null,'error',null),jsonb_build_object('code',200,'ready',true,'readiness',null,'error',null)),
   'backend',jsonb_build_array(jsonb_build_object('code',200,'ready',true,'readiness','ok','error',null),jsonb_build_object('code',200,'ready',true,'readiness','ok','error',null))));
 if public.aca_complete_support_investigation(c,gen_random_uuid(),gen,r) then raise exception 'Wrong token accepted'; end if;
 begin perform public.aca_complete_support_investigation(c,token,gen,r||'{"repair_performed":true}');raise exception 'Repair claim accepted';exception when raise_exception then if sqlerrm='Repair claim accepted' then raise;end if;end;
 begin perform public.aca_complete_support_investigation(c,token,gen,r||'{"secret":"arbitrary private payload"}');raise exception 'Unbounded payload accepted';exception when raise_exception then if sqlerrm='Unbounded payload accepted' then raise;end if;end;
 if not public.aca_complete_support_investigation(c,token,gen,r) then raise exception 'Valid completion rejected'; end if;
 if (select status from public.aca_support_investigations where case_id=c)<>'queued' then raise exception 'Follow-up lost'; end if;
 if (select status from public.aca_support_cases where id=c)<>'open' then raise exception 'False case resolution'; end if;
 if public.aca_complete_support_investigation(c,token,gen,r) then raise exception 'Duplicate completion'; end if;
 select claim_token,generation into token,gen from public.aca_claim_support_investigations();
 if gen<>3 then raise exception 'Follow-up generation lost'; end if;
 update public.aca_support_investigations set lease_until=clock_timestamp()-interval '1 second' where case_id=c;
 if public.aca_complete_support_investigation(c,token,gen,r) then raise exception 'Expired lease accepted'; end if;
 perform * from public.aca_claim_support_investigations();
 update public.aca_support_investigations set lease_until=clock_timestamp()-interval '1 second' where case_id=c;
 perform * from public.aca_claim_support_investigations();
 update public.aca_support_investigations set lease_until=clock_timestamp()-interval '1 second' where case_id=c;
 if exists(select 1 from public.aca_claim_support_investigations()) then raise exception 'Attempt limit'; end if;
 if (select status from public.aca_support_investigations where case_id=c)<>'needs_review' then raise exception 'Abandoned work hidden'; end if;
 update public.aca_support_investigation_settings set enabled=false where id;
 if exists(select 1 from public.aca_claim_support_investigations()) then raise exception 'Disabled claim'; end if;
 if (select count(*) from public.aca_support_investigation_reports)<>1 then raise exception 'Evidence history changed'; end if;
end $$;
rollback;

-- Execute the actual invoker functions as service_role, not only as database owner.
begin;
update public.aca_support_investigation_settings set enabled=true,activated_at=clock_timestamp() where id;
insert into public.aca_support_cases values('00000000-0000-4000-8000-000000000001','sign-in','open');
insert into public.aca_support_messages values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','requester','sign-in failure',clock_timestamp());
set local role service_role;
do $$ begin if (select count(*) from public.aca_claim_support_investigations())<>1 then raise exception 'Service claim failed';end if;end $$;
reset role;
update public.aca_support_investigations set lease_until=clock_timestamp()+interval '4 minutes 30 seconds';
set local role service_role;
do $$ declare j record;r jsonb;begin
 select * into j from public.aca_support_investigations;
 r:=jsonb_build_object('version',1,'started_at',clock_timestamp()-interval '20 seconds','observed_at',clock_timestamp(),'diagnosis','both_unavailable','repair_performed',false,'user_flow_verified',false,
 'samples',jsonb_build_object('website','[{"code":null,"ready":false,"readiness":null,"error":"request_failed"},{"code":null,"ready":false,"readiness":null,"error":"request_failed"}]'::jsonb,
 'backend','[{"code":null,"ready":false,"readiness":null,"error":"request_failed"},{"code":null,"ready":false,"readiness":null,"error":"request_failed"}]'::jsonb));
 if not public.aca_complete_support_investigation(j.case_id,j.claim_token,j.claim_generation,r) then raise exception 'Service completion failed';end if;
end $$;
reset role;
rollback;

begin;
update public.aca_support_investigation_settings set enabled=true,activated_at=clock_timestamp() where id;
insert into public.aca_support_cases select gen_random_uuid(),category,'open' from unnest(array['technical','sign-in','payment','privacy','general','accessibility','enrollment']) category;
insert into public.aca_support_messages select gen_random_uuid(),id,'requester','new report',clock_timestamp() from public.aca_support_cases;
do $$ begin if (select count(*) from public.aca_support_investigations)<>2 then raise exception 'Unapproved category intake';end if;end $$;
update public.aca_support_cases set status='resolved';
do $$ begin if exists(select 1 from public.aca_claim_support_investigations()) then raise exception 'Closed case processed';end if;end $$;
rollback;
