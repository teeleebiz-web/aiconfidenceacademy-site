begin;
insert into public.aca_assistant_budget(month,reserved_cents)
values(date_trunc('month',now() at time zone 'UTC')::date,1999)
on conflict(month) do update set reserved_cents=1999;
set local role service_role;
do $$ begin
 if public.aca_assistant_reserve() is distinct from true then raise exception 'Last allowed request rejected'; end if;
 if public.aca_assistant_reserve() is distinct from false then raise exception 'Over-budget request accepted'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.aca_assistant_reserve()','EXECUTE') then raise exception 'Anonymous budget access'; end if;
 if has_function_privilege('authenticated','public.aca_assistant_reserve()','EXECUTE') then raise exception 'Learner budget access'; end if;
 if has_table_privilege('anon','public.aca_assistant_budget','SELECT,INSERT,UPDATE') then raise exception 'Public budget table access'; end if;
end $$;
rollback;
select 'Budget boundary and role isolation passed; fixture rolled back' as result;
