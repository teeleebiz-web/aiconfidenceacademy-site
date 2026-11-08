-- Additive; disabled until source, isolation, shared spending and live checks pass.
create table public.aca_support_code_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 activated_at timestamptz, check(not enabled or activated_at is not null)
);
insert into public.aca_support_code_settings(id) values(true);
create table public.aca_support_code_jobs (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.aca_support_cases(id), generation integer not null,
 status text not null default 'running' check(status in ('running','no_change','test_failed','failed','draft_ready','branch_ready')),
 claim_token uuid not null default gen_random_uuid(), lease_until timestamptz not null default clock_timestamp()+interval '20 minutes',
 base_sha text not null check(base_sha~'^[a-f0-9]{40}$'), workflow_run_id text not null check(workflow_run_id~'^[0-9]{1,20}$'),
 requested_at timestamptz not null default clock_timestamp(), completed_at timestamptz,
 reserved_cents integer not null default 0 check(reserved_cents in (0,25)), payload_hash text,
 regression_failed_before boolean not null default false, checks_passed_after boolean not null default false,
 branch_name text, pull_request_number integer, unique(case_id,generation)
);
alter table public.aca_support_code_settings enable row level security;
alter table public.aca_support_code_jobs enable row level security;
revoke all on public.aca_support_code_settings,public.aca_support_code_jobs from public,anon,authenticated;
grant select,update on public.aca_support_code_settings to service_role;
grant select,insert,update on public.aca_support_code_jobs to service_role;

create function public.aca_claim_support_code_job(p_run_id text,p_base_sha text)
returns table(job_id uuid,claim_token uuid,base_sha text)
language plpgsql security invoker set search_path='' as $$
declare candidate record;
begin
 if p_run_id!~'^[0-9]{1,20}$' or p_base_sha!~'^[a-f0-9]{40}$' then raise exception 'Invalid worker provenance'; end if;
 if not exists(select 1 from public.aca_support_code_settings where id and enabled and activated_at<=clock_timestamp()) then return; end if;
 if not pg_try_advisory_xact_lock(731140115) then return; end if;
 update public.aca_support_code_jobs set status='failed',completed_at=clock_timestamp()
 where status='running' and lease_until<=clock_timestamp();
 if exists(select 1 from public.aca_support_code_jobs where status='running') then return; end if;
 select j.case_id,j.generation into candidate from public.aca_support_investigations j
 join public.aca_support_cases c on c.id=j.case_id
 join public.aca_support_investigation_reports r on r.case_id=j.case_id and r.generation=j.generation
 cross join public.aca_support_code_settings s
 where s.id and j.requested_at>=s.activated_at and j.status='investigated' and c.status<>'resolved'
 and c.category in ('technical','sign-in')
 and not exists(select 1 from public.aca_support_code_jobs x where x.case_id=j.case_id and x.generation=j.generation)
 order by j.requested_at,j.case_id limit 1 for update of j skip locked;
 if not found then return; end if;
 return query insert into public.aca_support_code_jobs(case_id,generation,base_sha,workflow_run_id)
 values(candidate.case_id,candidate.generation,p_base_sha,p_run_id)
 returning id,aca_support_code_jobs.claim_token,aca_support_code_jobs.base_sha;
end $$;

create function public.aca_code_job_context(p_job_id uuid,p_token uuid,p_base_sha text)
returns table(category text,technical_text text,diagnosis text)
language sql stable security invoker set search_path='' as $$
 select c.category,left(c.subject||' '||coalesce((select string_agg(m.body,' ' order by m.created_at desc)
 from (select body,created_at from public.aca_support_messages where case_id=c.id and author='requester' order by created_at desc limit 3)m),''),16000),r.report->>'diagnosis'
 from public.aca_support_code_jobs j join public.aca_support_cases c on c.id=j.case_id
 join public.aca_support_investigations i on i.case_id=j.case_id and i.generation=j.generation
 join public.aca_support_investigation_reports r on r.case_id=j.case_id and r.generation=j.generation
 where j.id=p_job_id and j.claim_token=p_token and j.base_sha=p_base_sha and j.status='running' and j.reserved_cents=0
 and c.status<>'resolved' and j.lease_until>clock_timestamp()
 and exists(select 1 from public.aca_support_code_settings where id and enabled);
$$;

create function public.aca_code_reserve(p_job_id uuid,p_token uuid,p_base_sha text,p_payload_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.aca_support_code_jobs%rowtype; accepted integer;
begin
 if p_payload_hash is null or p_payload_hash!~'^[a-f0-9]{64}$' then return false; end if;
 if not exists(select 1 from public.aca_support_code_settings where id and enabled) then return false; end if;
 select * into j from public.aca_support_code_jobs where id=p_job_id for update;
 if not found or j.claim_token is distinct from p_token or j.base_sha is distinct from p_base_sha or j.status<>'running'
 or j.lease_until<=clock_timestamp() or j.reserved_cents<>0
 or not exists(select 1 from public.aca_support_investigations i join public.aca_support_cases c on c.id=i.case_id
 where i.case_id=j.case_id and i.generation=j.generation and c.status<>'resolved') then return false; end if;
 -- Same row and cap as aca_assistant_reserve(), so Q&A and coding cannot each
 -- spend a separate $20 allowance. Failed/ambiguous requests retain reservation.
 insert into public.aca_assistant_budget(month,reserved_cents)
 values(date_trunc('month',now() at time zone 'UTC')::date,25)
 on conflict(month) do update set reserved_cents=public.aca_assistant_budget.reserved_cents+25
 where public.aca_assistant_budget.reserved_cents<=1975 returning reserved_cents into accepted;
 if accepted is null then return false; end if;
 update public.aca_support_code_jobs set reserved_cents=25,payload_hash=p_payload_hash where id=p_job_id;
 return true;
end $$;

create function public.aca_code_publication_allowed(p_job_id uuid,p_token uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.aca_support_code_jobs j
 join public.aca_support_investigations i on i.case_id=j.case_id and i.generation=j.generation
 join public.aca_support_cases c on c.id=j.case_id
 where j.id=p_job_id and j.claim_token=p_token and j.status='running' and j.reserved_cents=25
 and j.lease_until>clock_timestamp() and c.status<>'resolved'
 and exists(select 1 from public.aca_support_code_settings where id and enabled));
$$;

create function public.aca_finish_support_code_job(p_job_id uuid,p_token uuid,p_status text,p_before boolean,p_after boolean,p_branch text default null,p_pr integer default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.aca_support_code_jobs%rowtype;
begin
 select * into j from public.aca_support_code_jobs where id=p_job_id for update;
 if not found or j.claim_token is distinct from p_token or j.status<>'running' or j.lease_until<=clock_timestamp() then return false; end if;
 if p_status not in ('no_change','test_failed','failed','draft_ready','branch_ready') or p_before is null or p_after is null then raise exception 'Invalid coding result'; end if;
 if p_status in ('draft_ready','branch_ready') and (not p_before or not p_after or j.reserved_cents<>25 or p_branch is distinct from 'aca-agent/'||j.id::text or (p_status='draft_ready' and coalesce(p_pr,0)<1)) then raise exception 'Unverified draft'; end if;
 if p_status not in ('draft_ready','branch_ready') and (p_branch is not null or p_pr is not null) then raise exception 'Invalid draft metadata'; end if;
 update public.aca_support_code_jobs set status=p_status,completed_at=clock_timestamp(),regression_failed_before=p_before,
 checks_passed_after=p_after,branch_name=p_branch,pull_request_number=p_pr where id=p_job_id;
 return true;
end $$;

revoke all on function public.aca_claim_support_code_job(text,text),public.aca_code_job_context(uuid,uuid,text),public.aca_code_reserve(uuid,uuid,text,text),public.aca_finish_support_code_job(uuid,uuid,text,boolean,boolean,text,integer) from public,anon,authenticated;
grant execute on function public.aca_claim_support_code_job(text,text),public.aca_code_job_context(uuid,uuid,text),public.aca_code_reserve(uuid,uuid,text,text),public.aca_finish_support_code_job(uuid,uuid,text,boolean,boolean,text,integer) to service_role;
revoke all on function public.aca_code_publication_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.aca_code_publication_allowed(uuid,uuid) to service_role;

-- Owner API exposes fixed status and draft number, never capabilities or text.
create function public.aca_support_code_snapshot(p_case_ids uuid[])
returns table(case_id uuid,generation integer,status text,pull_request_number integer,completed_at timestamptz)
language plpgsql stable security invoker set search_path='' as $$
begin
 if p_case_ids is null or cardinality(p_case_ids)>100 then raise exception 'Invalid coding snapshot';end if;
 return query select distinct on (j.case_id) j.case_id,j.generation,j.status,j.pull_request_number,j.completed_at
 from public.aca_support_code_jobs j where j.case_id=any(p_case_ids) order by j.case_id,j.generation desc;
end $$;
revoke all on function public.aca_support_code_snapshot(uuid[]) from public,anon,authenticated;
grant execute on function public.aca_support_code_snapshot(uuid[]) to service_role;
