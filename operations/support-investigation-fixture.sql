-- Disposable local/CI database only. Never apply to an Academy project.
do $$ begin
 if current_database()<>'aca_support_investigation_fixture' and version() not like '%(PGlite %' then raise exception 'Disposable support fixture required'; end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema private;
create table public.aca_support_cases(id uuid primary key,category text not null,status text not null default 'open');
create table public.aca_support_messages(id uuid primary key,case_id uuid not null references public.aca_support_cases(id),author text not null,body text not null,created_at timestamptz not null default clock_timestamp());
grant select on public.aca_support_cases to service_role;
