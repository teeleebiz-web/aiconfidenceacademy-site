-- Founder authorization, November 20: complete supported technical repairs through publication.
alter table public.aca_support_code_settings add column auto_release_enabled boolean not null default false;
create table public.aca_support_releases (
  job_id uuid primary key references public.aca_support_code_jobs(id),
  source_sha text not null,
  release_sha text,
  status text not null check(status in ('preparing','published','verified','rolled_back','needs_attention')),
  verification jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.aca_support_releases enable row level security;
revoke all on public.aca_support_releases from public,anon,authenticated;
grant select,insert,update on public.aca_support_releases to service_role;

create or replace function public.aca_support_code_snapshot(p_case_ids uuid[])
returns table(case_id uuid,generation integer,status text,pull_request_number integer,completed_at timestamptz)
language plpgsql stable security invoker set search_path='' as $$
begin
 if p_case_ids is null or cardinality(p_case_ids)>100 then raise exception 'Invalid coding snapshot';end if;
 return query select distinct on (j.case_id) j.case_id,j.generation,coalesce(r.status,j.status),j.pull_request_number,coalesce(r.updated_at,j.completed_at)
 from public.aca_support_code_jobs j left join public.aca_support_releases r on r.job_id=j.id
 where j.case_id=any(p_case_ids) order by j.case_id,j.generation desc;
end $$;
revoke all on function public.aca_support_code_snapshot(uuid[]) from public,anon,authenticated;
grant execute on function public.aca_support_code_snapshot(uuid[]) to service_role;
