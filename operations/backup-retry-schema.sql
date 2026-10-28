-- Integration candidate only: NOT applied to production; no activation statement.
alter table public.aca_backup_automation add column retry_enabled boolean not null default false;
create table public.aca_backup_retry_attempts (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null unique references public.aca_automation_runs(id),
 workflow_run_id text not null unique check(workflow_run_id ~ '^\d+$'),
 quota_day date not null unique,
 reserved_at timestamptz not null default clock_timestamp(),
 not_before timestamptz not null,
 deadline_at timestamptz not null,
 started_at timestamptz,
 finished_at timestamptz,
 outcome text not null default 'reserved' check(outcome in('reserved','running','completed','failed')),
 check(deadline_at > not_before),
 check((outcome in('reserved','running') and finished_at is null) or (outcome in('completed','failed') and finished_at is not null))
);
alter table public.aca_backup_retry_attempts enable row level security;
revoke all on public.aca_backup_retry_attempts from public,anon,authenticated;
grant select,insert,update on public.aca_backup_retry_attempts to service_role;

create function public.aca_backup_retry_state(p_run_id uuid,p_start_at timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'policy_enabled',p.enabled,'retry_enabled',p.retry_enabled,'credential_expires_at',p.credential_expires_at,
 'history_healthy',true,
 'run_valid',exists(select 1 from public.aca_automation_runs r where r.id=p_run_id and r.job='storage-backups' and r.status='running'
   and r.result->>'format'='aca-automatic-backup-v1' and r.result->>'workflowAttempt'='1'),
 'active_count',(select count(*) from public.aca_automation_runs where job='storage-backups' and status='running'),
 'quota_day',(p_start_at at time zone 'Asia/Bangkok')::date,
 'run_attempts',(select count(*) from public.aca_backup_retry_attempts where run_id=p_run_id),
 'day_attempts',(select count(*) from public.aca_backup_retry_attempts where quota_day=(p_start_at at time zone 'Asia/Bangkok')::date),
 'unresolved_claims',(select count(*) from public.aca_backup_retry_attempts where outcome in('reserved','running')))
 from public.aca_backup_automation p where p.id;
$$;

create function public.aca_reserve_backup_retry(p_run_id uuid,p_workflow_run_id text,p_day date,p_not_before timestamptz,p_deadline timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare policy public.aca_backup_automation; original public.aca_automation_runs; claim uuid; t timestamptz;
begin
 -- Policy row lock serializes reservations and activation edits. Unique constraints
 -- protect both the original workflow and the Bangkok day even after resolution.
 select * into policy from public.aca_backup_automation where id for update;
 t:=clock_timestamp();
 if policy.enabled is not true or policy.retry_enabled is not true or policy.activated_at is null
   or p_day is null or p_day<>(t at time zone 'Asia/Bangkok')::date
   or p_not_before is null or p_not_before>t or p_deadline is null or p_deadline<=t
   or p_deadline>t+interval '10 minutes' or policy.credential_expires_at is null
   or policy.credential_expires_at<=p_deadline+interval '1 hour' then return jsonb_build_object('reserved',false); end if;
 select * into original from public.aca_automation_runs where id=p_run_id for update;
 if original.job is distinct from 'storage-backups' or original.status is distinct from 'running'
   or original.result->>'format' is distinct from 'aca-automatic-backup-v1'
   or original.result->>'workflowAttempt' is distinct from '1'
   or original.result->>'workflowRunId' is distinct from p_workflow_run_id
   or p_workflow_run_id is null or p_workflow_run_id !~ '^\d+$'
   or (select count(*) from public.aca_automation_runs where job='storage-backups' and status='running')<>1
   or exists(select 1 from public.aca_backup_retry_attempts where outcome in('reserved','running'))
   then return jsonb_build_object('reserved',false); end if;
 insert into public.aca_backup_retry_attempts(run_id,workflow_run_id,quota_day,not_before,deadline_at)
 values(p_run_id,p_workflow_run_id,p_day,p_not_before,p_deadline)
 on conflict do nothing returning id into claim;
 return jsonb_build_object('reserved',claim is not null,'id',claim,'quota_day',p_day);
end;
$$;

create function public.aca_begin_backup_retry(p_claim_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare policy public.aca_backup_automation; claim public.aca_backup_retry_attempts; t timestamptz;
begin
 select * into policy from public.aca_backup_automation where id for update;
 select * into claim from public.aca_backup_retry_attempts where id=p_claim_id for update;
 t:=clock_timestamp();
 if claim.id is null or claim.outcome<>'reserved' or policy.enabled is not true or policy.retry_enabled is not true
   or policy.credential_expires_at is null or policy.credential_expires_at<=claim.deadline_at+interval '1 hour'
   or claim.quota_day<>(t at time zone 'Asia/Bangkok')::date or t<claim.not_before or t>=claim.deadline_at
   or (select count(*) from public.aca_automation_runs where job='storage-backups' and status='running')<>1
   or not exists(select 1 from public.aca_automation_runs r where r.id=claim.run_id and r.status='running')
   then return jsonb_build_object('started',false); end if;
 update public.aca_backup_retry_attempts set outcome='running',started_at=t where id=claim.id;
 return jsonb_build_object('started',true,'deadline_at',claim.deadline_at);
end;
$$;

create function public.aca_finish_backup_retry(p_claim_id uuid,p_outcome text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare updated uuid;
begin
 if p_outcome is null or p_outcome not in('completed','failed') then raise exception 'Invalid retry outcome'; end if;
 update public.aca_backup_retry_attempts set outcome=p_outcome,finished_at=clock_timestamp()
 where id=p_claim_id and outcome in('reserved','running')
   and (p_outcome='failed' or (outcome='running' and clock_timestamp()<deadline_at)) returning id into updated;
 if updated is null then raise exception 'Retry outcome not recorded'; end if;
 return jsonb_build_object('recorded',true);
end;
$$;
revoke all on function public.aca_backup_retry_state(uuid,timestamptz),public.aca_reserve_backup_retry(uuid,text,date,timestamptz,timestamptz),public.aca_begin_backup_retry(uuid),public.aca_finish_backup_retry(uuid,text) from public,anon,authenticated;
grant execute on function public.aca_backup_retry_state(uuid,timestamptz),public.aca_reserve_backup_retry(uuid,text,date,timestamptz,timestamptz),public.aca_begin_backup_retry(uuid),public.aca_finish_backup_retry(uuid,text) to service_role;
