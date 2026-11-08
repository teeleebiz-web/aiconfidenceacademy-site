-- Candidate only. Apply via the established migration path after acceptance.
-- Default off; no old cases/messages are backfilled and no schedules are added.
create table public.aca_support_investigation_settings (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 activated_at timestamptz,
 check(not enabled or activated_at is not null)
);
insert into public.aca_support_investigation_settings(id) values(true);

create table public.aca_support_investigations (
 case_id uuid primary key references public.aca_support_cases(id),
 generation integer not null default 1 check(generation>0),
 status text not null default 'queued' check(status in ('queued','running','investigated','needs_review')),
 requested_at timestamptz not null default clock_timestamp(),
 attempts integer not null default 0 check(attempts between 0 and 3),
 claim_token uuid, claim_generation integer, lease_until timestamptz,
 completed_at timestamptz,
 check((status='running')=(claim_token is not null and claim_generation is not null and lease_until is not null))
);
create table public.aca_support_investigation_reports (
 case_id uuid not null references public.aca_support_cases(id),
 generation integer not null,
 report jsonb not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(case_id,generation)
);
create index aca_support_investigations_work_idx on public.aca_support_investigations(status,requested_at);
alter table public.aca_support_investigation_settings enable row level security;
alter table public.aca_support_investigations enable row level security;
alter table public.aca_support_investigation_reports enable row level security;
revoke all on public.aca_support_investigation_settings,public.aca_support_investigations,public.aca_support_investigation_reports from public,anon,authenticated;
grant select,update on public.aca_support_investigation_settings to service_role;
grant select,insert,update on public.aca_support_investigations to service_role;
grant select,insert on public.aca_support_investigation_reports to service_role;

create function private.aca_queue_support_investigation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.author<>'requester' or not exists(
  select 1 from public.aca_support_investigation_settings s
  where s.id and s.enabled and s.activated_at<=clock_timestamp() and new.created_at>=s.activated_at
 ) or not exists(select 1 from public.aca_support_cases c where c.id=new.case_id and c.category in ('technical','sign-in')) then return new; end if;
 insert into public.aca_support_investigations(case_id) values(new.case_id)
 on conflict(case_id) do update set generation=public.aca_support_investigations.generation+1,
  requested_at=clock_timestamp(),attempts=0,
  status=case when public.aca_support_investigations.status='running' then 'running' else 'queued' end;
 return new;
end $$;
revoke all on function private.aca_queue_support_investigation() from public,anon,authenticated;
create trigger aca_support_investigation_intake after insert on public.aca_support_messages
 for each row execute function private.aca_queue_support_investigation();

create function public.aca_claim_support_investigations()
returns table(case_id uuid,claim_token uuid,generation integer,category text)
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.aca_support_investigation_settings s where s.id and s.enabled and s.activated_at<=clock_timestamp()) then return; end if;
 -- Read-only attempts can recover an abandoned lease. Exhaustion remains visible.
 update public.aca_support_investigations j set status='needs_review',claim_token=null,claim_generation=null,lease_until=null
 where j.status='running' and j.lease_until<=clock_timestamp() and j.attempts>=3;
 return query
 with candidates as (
  select j.case_id from public.aca_support_investigations j join public.aca_support_cases c on c.id=j.case_id
  where c.status<>'resolved' and c.category in ('technical','sign-in') and j.attempts<3
   and (j.status='queued' or j.status='running' and j.lease_until<=clock_timestamp())
  order by j.requested_at,j.case_id limit 5 for update of j skip locked
 ), claimed as (
  update public.aca_support_investigations j set status='running',attempts=j.attempts+1,
   claim_token=gen_random_uuid(),claim_generation=j.generation,lease_until=clock_timestamp()+interval '5 minutes'
  from candidates q where j.case_id=q.case_id returning j.case_id,j.claim_token,j.claim_generation
 ) select q.case_id,q.claim_token,q.claim_generation,c.category from claimed q join public.aca_support_cases c on c.id=q.case_id;
end $$;
revoke all on function public.aca_claim_support_investigations() from public,anon,authenticated;
grant execute on function public.aca_claim_support_investigations() to service_role;

create function public.aca_complete_support_investigation(p_case_id uuid,p_claim_token uuid,p_generation integer,p_report jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.aca_support_investigations%rowtype; v_role text; v_sample jsonb; v_start timestamptz; v_end timestamptz;
begin
 if not exists(select 1 from public.aca_support_investigation_settings s where s.id and s.enabled and s.activated_at<=clock_timestamp()) then return false; end if;
 select * into j from public.aca_support_investigations q where q.case_id=p_case_id for update;
 if not found or j.status<>'running' or j.claim_token is distinct from p_claim_token or
  j.claim_generation is distinct from p_generation or j.lease_until<=clock_timestamp() then return false; end if;
 -- Fixed schema rejects raw logs, credentials, report text and invented repair claims.
 if p_report is null or jsonb_typeof(p_report)<>'object' or octet_length(p_report::text)>4096 or
  (select count(*) from jsonb_object_keys(p_report))<>7 or
  p_report->'version' is distinct from '1'::jsonb or
  p_report->'repair_performed' is distinct from 'false'::jsonb or
  p_report->'user_flow_verified' is distinct from 'false'::jsonb or
  coalesce(p_report->>'diagnosis','') not in ('no_shared_outage','both_unavailable','intermittent','website_unavailable','backend_readiness_failed','backend_unavailable') or
  jsonb_typeof(p_report->'samples') is distinct from 'object' or
  (select count(*) from jsonb_object_keys(p_report->'samples'))<>2 then raise exception 'Invalid support investigation report'; end if;
 v_start:=(p_report->>'started_at')::timestamptz; v_end:=(p_report->>'observed_at')::timestamptz;
 if v_start is null or v_end is null or v_end<v_start+interval '16 seconds' or
  v_start<j.lease_until-interval '5 minutes'-interval '5 seconds' or v_end>clock_timestamp()+interval '5 seconds' then raise exception 'Invalid investigation evidence time'; end if;
 foreach v_role in array array['website','backend'] loop
  if jsonb_typeof(p_report->'samples'->v_role) is distinct from 'array' or jsonb_array_length(p_report->'samples'->v_role)<>2 then raise exception 'Invalid investigation samples'; end if;
  for v_sample in select value from jsonb_array_elements(p_report->'samples'->v_role) loop
   if jsonb_typeof(v_sample)<>'object' or (select count(*) from jsonb_object_keys(v_sample))<>4 or
    jsonb_typeof(v_sample->'ready') is distinct from 'boolean' or not (v_sample ?& array['code','ready','readiness','error']) or
    (v_sample->'code'<>'null'::jsonb and (jsonb_typeof(v_sample->'code')<>'number' or (v_sample->>'code')!~'^[1-5][0-9]{2}$')) or
    v_sample->'readiness' not in ('null'::jsonb,'"ok"'::jsonb,'"unavailable"'::jsonb) or
    v_sample->'error' not in ('null'::jsonb,'"request_failed"'::jsonb) or
    ((v_sample->>'ready')::boolean and (v_sample->'code'<>'200'::jsonb or v_sample->'error'<>'null'::jsonb or
      (v_role='backend' and v_sample->'readiness'<>'"ok"'::jsonb))) then raise exception 'Invalid investigation sample'; end if;
  end loop;
 end loop;
 insert into public.aca_support_investigation_reports(case_id,generation,report) values(p_case_id,p_generation,p_report);
 update public.aca_support_investigations set status=case when generation=p_generation then 'investigated' else 'queued' end,
  completed_at=clock_timestamp(),claim_token=null,claim_generation=null,lease_until=null where case_id=p_case_id;
 -- Deliberately never changes case status, user access or a learner record.
 return true;
end $$;
revoke all on function public.aca_complete_support_investigation(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.aca_complete_support_investigation(uuid,uuid,integer,jsonb) to service_role;

-- One latest report per case; a busy case cannot crowd out evidence for others.
-- Claim capabilities and report bodies never enter the owner snapshot.
create function public.aca_support_investigation_snapshot(p_case_ids uuid[])
returns table(case_id uuid,status text,generation integer,completed_at timestamptz,attempts integer,report jsonb)
language plpgsql stable security invoker set search_path='' as $$
begin
 if p_case_ids is null or cardinality(p_case_ids)>100 then raise exception 'Invalid investigation snapshot request'; end if;
 return query select j.case_id,j.status,j.generation,j.completed_at,j.attempts,
  case when r.report is null then null else jsonb_build_object('diagnosis',r.report->>'diagnosis',
   'observed_at',r.report->>'observed_at','repair_performed',false,'user_flow_verified',false) end
 from public.aca_support_investigations j left join lateral (
  select h.report from public.aca_support_investigation_reports h where h.case_id=j.case_id order by h.generation desc limit 1
 ) r on true where j.case_id=any(p_case_ids);
end $$;
revoke all on function public.aca_support_investigation_snapshot(uuid[]) from public,anon,authenticated;
grant execute on function public.aca_support_investigation_snapshot(uuid[]) to service_role;
