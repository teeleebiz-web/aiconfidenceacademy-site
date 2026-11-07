-- Shared by public Ask ACA and signed-in guidance. No question or identity is stored.
-- At most 2,000 attempts/month, reserving $0.01 each against a $20 allowance.
-- The server pins GPT-6 Luna, a 20,000-byte payload and 256 output tokens.
-- This is a conservative allowance, not an invoice or measured provider spend.
create table public.aca_assistant_budget (
 month date primary key,
 reserved_cents integer not null check (reserved_cents between 0 and 2000)
);
alter table public.aca_assistant_budget enable row level security;
revoke all on public.aca_assistant_budget from public, anon, authenticated;
grant select, insert, update on public.aca_assistant_budget to service_role;

create function public.aca_assistant_reserve() returns boolean
language plpgsql security invoker set search_path='' as $$
declare accepted integer;
begin
 insert into public.aca_assistant_budget(month,reserved_cents)
 values(date_trunc('month',now() at time zone 'UTC')::date,1)
 on conflict(month) do update
 set reserved_cents=public.aca_assistant_budget.reserved_cents+1
 where public.aca_assistant_budget.reserved_cents<2000
 returning reserved_cents into accepted;
 return accepted is not null;
end $$;
revoke all on function public.aca_assistant_reserve() from public, anon, authenticated;
grant execute on function public.aca_assistant_reserve() to service_role;
