-- Private diagnostic evidence only; no repair or messaging authority.
create table public.aca_incident_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 activated_at timestamptz, monitors jsonb not null default '{}'::jsonb, contact_group text,
 check(not enabled or coalesce(activated_at is not null and monitors->>'website' ~ '^[0-9]+$' and monitors->>'backend' ~ '^[0-9]+$' and monitors->>'website'<>monitors->>'backend' and contact_group ~ '^[0-9]+$',false))
);
insert into public.aca_incident_settings(id) values(true);
create table public.aca_incident_coordinator (
 id boolean primary key default true check(id), checked_at timestamptz not null,
 status text not null check(status in('completed','sync_pending')),
 workflow_run_id text not null check(workflow_run_id ~ '^[0-9]+$')
);
create table public.aca_incident_reports (
 id text primary key check(id ~ '^[a-f0-9]{64}$'), observed_at timestamptz not null,
 payload jsonb not null check(octet_length(payload::text)<=20000)
);
create index aca_incident_reports_observed on public.aca_incident_reports(observed_at desc);
alter table public.aca_incident_settings enable row level security;
alter table public.aca_incident_coordinator enable row level security;
alter table public.aca_incident_reports enable row level security;
revoke all on public.aca_incident_settings,public.aca_incident_coordinator,public.aca_incident_reports from public,anon,authenticated,service_role;
grant select,insert,update on public.aca_incident_settings,public.aca_incident_coordinator,public.aca_incident_reports to service_role;

create function public.aca_ingest_incident_report(p_report jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare role_name text; sample jsonb; changed int; stamp timestamptz; source_stamp timestamptz;
begin
 if p_report is null or jsonb_typeof(p_report)<>'object' or octet_length(p_report::text)>20000
  or p_report-array['id','role','source_at','observed_at','resolved_at','status','diagnosis','provider_status','source_code','samples','repair_performed']<>'{}'::jsonb
  or not coalesce(p_report->>'id' ~ '^[a-f0-9]{64}$',false)
  or not coalesce(p_report->>'role' in('website','backend'),false)
  or not coalesce(p_report->>'status' in('open','recovered'),false)
  or not coalesce(p_report->>'diagnosis' in('website_unavailable','backend_readiness_failed','backend_unavailable','both_unavailable','monitor_disagreement','recovered'),false)
  or not coalesce(p_report->>'provider_status' in('up','down'),false)
  or (p_report->>'source_code' is not null and (jsonb_typeof(p_report->'source_code')<>'number' or not(p_report->>'source_code' ~ '^[0-9]{1,3}$') or (p_report->>'source_code')::int not between 0 and 599))
  or p_report->'repair_performed' is distinct from 'false'::jsonb then raise exception 'Invalid incident evidence';end if;
 stamp:=(p_report->>'observed_at')::timestamptz;source_stamp:=(p_report->>'source_at')::timestamptz;
 if stamp is null or source_stamp is null or source_stamp>stamp or stamp>now()+interval '5 minutes'
  or ((p_report->>'status'='recovered') is distinct from (p_report->>'diagnosis'='recovered'))
  or (p_report->>'status'='open' and p_report->>'resolved_at' is not null)
  or (p_report->>'status'='recovered' and (p_report->>'provider_status'<>'up' or (p_report->>'resolved_at')::timestamptz is distinct from stamp)) then raise exception 'Invalid incident times or recovery';end if;
 if jsonb_typeof(p_report->'samples') is distinct from 'object' or p_report->'samples'-array['website','backend']<>'{}'::jsonb then raise exception 'Invalid incident samples';end if;
 foreach role_name in array array['website','backend'] loop
  if jsonb_typeof(p_report->'samples'->role_name) is distinct from 'array' or jsonb_array_length(p_report->'samples'->role_name)<>2 then raise exception 'Two independent samples required';end if;
  for sample in select value from jsonb_array_elements(p_report->'samples'->role_name) loop
   if jsonb_typeof(sample)<>'object' or sample-array['code','ready','readiness','error']<>'{}'::jsonb
    or jsonb_typeof(sample->'ready') is distinct from 'boolean'
    or (sample->>'code' is not null and (not(sample->>'code' ~ '^[0-9]{3}$') or (sample->>'code')::int not between 100 and 599))
    or (sample->>'readiness' is not null and sample->>'readiness' not in('ok','unavailable'))
    or (sample->>'error' is not null and sample->>'error'<>'request_failed')
    or ((sample->>'ready')::boolean and (sample->>'code' is distinct from '200' or (role_name='backend' and sample->>'readiness' is distinct from 'ok')))
    or (p_report->>'status'='recovered' and p_report->>'role'=role_name and sample->'ready'<>'true'::jsonb) then raise exception 'Invalid incident sample';end if;
  end loop;
 end loop;
 insert into public.aca_incident_reports(id,observed_at,payload) values(p_report->>'id',stamp,p_report)
 on conflict(id) do update set observed_at=excluded.observed_at,payload=excluded.payload
 where excluded.observed_at>=aca_incident_reports.observed_at
 and not(aca_incident_reports.payload->>'status'='recovered' and excluded.payload->>'status'<>'recovered');
 get diagnostics changed=row_count;return changed=1;
end;$$;
revoke all on function public.aca_ingest_incident_report(jsonb) from public,anon,authenticated;
grant execute on function public.aca_ingest_incident_report(jsonb) to service_role;

create function public.aca_incident_snapshot() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('available',true,
 'policy',(select jsonb_build_object('enabled',enabled,'activated_at',activated_at) from public.aca_incident_settings where id),
 'coordinator',(select jsonb_build_object('checked_at',checked_at,'status',status,'workflow_run_id',workflow_run_id) from public.aca_incident_coordinator where id),
 'reports',coalesce((select jsonb_agg(r.payload order by r.observed_at desc) from(select payload,observed_at from public.aca_incident_reports order by observed_at desc limit 20)r),'[]'::jsonb));
$$;
revoke all on function public.aca_incident_snapshot() from public,anon,authenticated;
grant execute on function public.aca_incident_snapshot() to service_role;
