-- Public help cases are isolated from enrollment, billing, and curriculum records.
create table public.aca_support_cases (
 id uuid primary key, request_id uuid not null unique, access_hash text not null check(access_hash ~ '^[a-f0-9]{64}$'),
 email text not null check(length(email)<=254), name text not null default '' check(length(name)<=120),
 category text not null check(category in ('enrollment','sign-in','technical','payment','privacy','accessibility','general')),
 subject text not null check(length(subject) between 5 and 160),
 last_actor_id uuid references auth.users(id),
 status text not null default 'open' check(status in ('open','reviewing','resolved')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index aca_support_cases_actor_idx on public.aca_support_cases(last_actor_id);
create index aca_support_cases_status_created_idx on public.aca_support_cases(status,created_at desc);
create table public.aca_support_messages (
 id uuid primary key, case_id uuid not null references public.aca_support_cases(id),
 author text not null check(author in ('requester','academy')), actor_id uuid references auth.users(id),
 body text not null check(length(body) between 5 and 4000), created_at timestamptz not null default now()
);
create index aca_support_messages_case_created_idx on public.aca_support_messages(case_id,created_at);
create index aca_support_messages_actor_idx on public.aca_support_messages(actor_id);
alter table public.aca_support_cases enable row level security;
alter table public.aca_support_messages enable row level security;
revoke all on public.aca_support_cases,public.aca_support_messages from public,anon,authenticated;
grant all on public.aca_support_cases,public.aca_support_messages to service_role;
create function private.aca_record_support_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb; prior jsonb; actor uuid;begin
 j:=jsonb_build_object('id',new.id,'status',to_jsonb(new)->>'status','category',to_jsonb(new)->>'category');
 if TG_OP='UPDATE' then prior:=jsonb_build_object('id',old.id,'status',to_jsonb(old)->>'status','category',to_jsonb(old)->>'category');if j=prior then return new;end if;end if;
 actor:=nullif(coalesce(to_jsonb(new)->>'actor_id',to_jsonb(new)->>'last_actor_id'),'')::uuid;
 insert into public.aca_owner_activity(actor_id,entity,entity_id,action,before_state,after_state) values(actor,TG_TABLE_NAME,new.id::text,lower(TG_OP),prior,j);
 return new;
end $$;
revoke all on function private.aca_record_support_activity() from public,anon,authenticated;
create trigger aca_support_cases_activity after insert or update on public.aca_support_cases for each row execute function private.aca_record_support_activity();
create trigger aca_support_messages_activity after insert or update on public.aca_support_messages for each row execute function private.aca_record_support_activity();
-- Recipients come only from the trusted Academy owner allowlist, never request data.
create function public.aca_support_alert_recipients() returns table(email text) language sql stable security definer set search_path='' as $$
 select u.email::text from private.aca_curriculum_reviewers r join auth.users u on u.id=r.user_id where u.email is not null;
$$;
revoke all on function public.aca_support_alert_recipients() from public,anon,authenticated;
grant execute on function public.aca_support_alert_recipients() to service_role;
