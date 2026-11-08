begin;
do $$ declare c uuid:=gen_random_uuid();j record;sha text:=repeat('a',40);h text:=repeat('b',64);begin
 if exists(select 1 from public.aca_support_code_settings where enabled) then raise exception 'Enabled by default';end if;
 if has_table_privilege('anon','public.aca_support_code_jobs','select') or has_table_privilege('authenticated','public.aca_support_code_settings','update')
 or has_function_privilege('anon','public.aca_claim_support_code_job(text,text)','execute')
 or has_function_privilege('authenticated','public.aca_code_reserve(uuid,uuid,text,text)','execute') then raise exception 'Public coding access';end if;
 insert into public.aca_support_cases(id,category) values(c,'sign-in');
 insert into public.aca_support_investigations(case_id,status,requested_at) values(c,'investigated',clock_timestamp()-interval '1 day');
 insert into public.aca_support_investigation_reports values(c,1,'{"diagnosis":"no_shared_outage"}',clock_timestamp());
 if exists(select 1 from public.aca_claim_support_code_job('1',sha)) then raise exception 'Disabled claim';end if;
 update public.aca_support_code_settings set enabled=true,activated_at=clock_timestamp();
 if exists(select 1 from public.aca_claim_support_code_job('1',sha)) then raise exception 'Old work backfill';end if;
 update public.aca_support_investigations set requested_at=clock_timestamp();
 select * into j from public.aca_claim_support_code_job('1',sha);
 if j.job_id is null then raise exception 'Missing eligible claim';end if;
 if exists(select 1 from public.aca_claim_support_code_job('2',sha)) then raise exception 'Overlapping claim';end if;
 if public.aca_code_reserve(j.job_id,gen_random_uuid(),sha,h) then raise exception 'Wrong token';end if;
 if public.aca_code_publication_allowed(j.job_id,j.claim_token) then raise exception 'Unreserved publication';end if;
 insert into public.aca_assistant_budget values(date_trunc('month',now() at time zone 'UTC')::date,1976);
 if public.aca_code_reserve(j.job_id,j.claim_token,sha,h) then raise exception 'Shared cap exceeded';end if;
 update public.aca_assistant_budget set reserved_cents=1974;
 if not public.aca_assistant_reserve() or not public.aca_code_reserve(j.job_id,j.claim_token,sha,h) then raise exception 'Boundary reservation rejected';end if;
 if public.aca_assistant_reserve() or public.aca_code_reserve(j.job_id,j.claim_token,sha,h) then raise exception 'Duplicate or overspend';end if;
 if (select reserved_cents from public.aca_assistant_budget)<>2000 then raise exception 'Incorrect combined cap';end if;
 if not public.aca_code_publication_allowed(j.job_id,j.claim_token) then raise exception 'Valid publication rejected';end if;
 update public.aca_support_code_settings set enabled=false;
 if public.aca_code_publication_allowed(j.job_id,j.claim_token) then raise exception 'Disabled publication';end if;
 update public.aca_support_code_settings set enabled=true;
 update public.aca_support_investigations set generation=2;
 if public.aca_code_publication_allowed(j.job_id,j.claim_token) then raise exception 'Stale generation publication';end if;
 update public.aca_support_investigations set generation=1;
 begin perform public.aca_finish_support_code_job(j.job_id,j.claim_token,'draft_ready',false,true,'aca-agent/'||j.job_id,1);raise exception 'False test accepted';exception when raise_exception then if sqlerrm='False test accepted' then raise;end if;end;
 if not public.aca_finish_support_code_job(j.job_id,j.claim_token,'draft_ready',true,true,'aca-agent/'||j.job_id,123) then raise exception 'Valid draft rejected';end if;
 if exists(select 1 from public.aca_claim_support_code_job('3',sha)) then raise exception 'Paid job retried';end if;
 if (select status from public.aca_support_cases where id=c)<>'open' then raise exception 'False resolution';end if;
 if (select reserved_cents from public.aca_assistant_budget)<>2000 then raise exception 'Reservation refunded';end if;
end $$;
rollback;
-- Check actual invoker privileges and private context retrieval.
begin;
update public.aca_support_code_settings set enabled=true,activated_at=clock_timestamp();
insert into public.aca_support_cases(id,category) values('00000000-0000-4000-8000-000000000001','sign-in');
insert into public.aca_support_messages values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','requester','Sign-in error',clock_timestamp());
insert into public.aca_support_investigations(case_id,status) values('00000000-0000-4000-8000-000000000001','investigated');
insert into public.aca_support_investigation_reports values('00000000-0000-4000-8000-000000000001',1,'{"diagnosis":"no_shared_outage"}',clock_timestamp());
set local role service_role;
do $$ declare j record;begin
 select * into j from public.aca_claim_support_code_job('4',repeat('a',40));
 if j.job_id is null or (select count(*) from public.aca_code_job_context(j.job_id,j.claim_token,j.base_sha))<>1 then raise exception 'Service context failed';end if;
 if not public.aca_code_reserve(j.job_id,j.claim_token,j.base_sha,repeat('b',64)) then raise exception 'Service reservation failed';end if;
 if not public.aca_finish_support_code_job(j.job_id,j.claim_token,'failed',false,false) then raise exception 'Service completion failed';end if;
end $$;
reset role;
rollback;
