-- Disposable local/CI database only.
do $$ begin
 if current_database()<>'aca_support_code_fixture' and version() not like '%(PGlite %' then raise exception 'Disposable code fixture required'; end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema private;
create table public.aca_support_cases(id uuid primary key,category text not null,status text not null default 'open',subject text not null default 'Sign-in error');
create table public.aca_support_messages(id uuid primary key,case_id uuid not null references public.aca_support_cases(id),author text not null,body text not null,created_at timestamptz not null default clock_timestamp());
create table public.aca_assistant_budget(month date primary key,reserved_cents integer not null);
grant select on public.aca_support_cases,public.aca_support_messages to service_role;
grant select,insert,update on public.aca_assistant_budget to service_role;
-- Exact existing Q&A reservation semantics, for the shared-cap assertion.
create function public.aca_assistant_reserve() returns boolean language plpgsql as $$
declare accepted integer;begin
 insert into public.aca_assistant_budget values(date_trunc('month',now() at time zone 'UTC')::date,1)
 on conflict(month) do update set reserved_cents=public.aca_assistant_budget.reserved_cents+1
 where public.aca_assistant_budget.reserved_cents<2000 returning reserved_cents into accepted;
 return accepted is not null;end $$;
