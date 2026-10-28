-- Disposable fixture only; no source bytes, external services or real policy.
begin;
do $$
declare s jsonb; c jsonb; d date:=(clock_timestamp() at time zone 'Asia/Bangkok')::date;
begin
 if has_table_privilege('anon','public.aca_backup_retry_attempts','select') or has_table_privilege('authenticated','public.aca_backup_retry_attempts','insert')
    or has_function_privilege('anon','public.aca_reserve_backup_retry(uuid,text,date,timestamptz,timestamptz)','execute')
    or has_function_privilege('authenticated','public.aca_begin_backup_retry(uuid)','execute') then raise exception 'Public retry access'; end if;
 if not (select relrowsecurity from pg_class where oid='public.aca_backup_retry_attempts'::regclass) then raise exception 'RLS missing'; end if;
 if (select retry_enabled from public.aca_backup_automation where id) then raise exception 'Unsafe activation default'; end if;
 c:=public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','123',d,now(),now()+interval '9 minutes');
 if (c->>'reserved')::boolean then raise exception 'Disabled reservation'; end if;
 update public.aca_backup_automation set retry_enabled=true where id;
 c:=public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','123',d-1,now(),now()+interval '9 minutes');
 if (c->>'reserved')::boolean then raise exception 'Wrong day accepted'; end if;
 c:=public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','123',d,now()+interval '1 minute',now()+interval '9 minutes');
 if (c->>'reserved')::boolean then raise exception 'Backoff bypass'; end if;
 c:=public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','123',d,now(),now()+interval '11 minutes');
 if (c->>'reserved')::boolean then raise exception 'Budget bypass'; end if;
 s:=public.aca_backup_retry_state('00000000-0000-4000-8000-000000000001','2026-10-28T17:01:00Z');
 if s->>'quota_day'<>'2026-10-29' then raise exception 'Bangkok day mismatch'; end if;
 c:=public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','999',d,now(),now()+interval '9 minutes');
 if (c->>'reserved')::boolean then raise exception 'Wrong workflow accepted'; end if;
 update public.aca_backup_automation set credential_expires_at=clock_timestamp()+interval '30 minutes' where id;
 c:=public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','123',d,now(),now()+interval '9 minutes');
 if (c->>'reserved')::boolean then raise exception 'Expiry bypass'; end if;
 update public.aca_backup_automation set credential_expires_at=clock_timestamp()+interval '3 days' where id;
 insert into public.aca_automation_runs values('00000000-0000-4000-8000-000000000002','storage-backups','running','{}');
 c:=public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','123',d,now(),now()+interval '9 minutes');
 if (c->>'reserved')::boolean then raise exception 'Overlap bypass'; end if;
 update public.aca_automation_runs set status='failed' where id='00000000-0000-4000-8000-000000000002';
 insert into public.aca_backup_retry_attempts(run_id,workflow_run_id,quota_day,not_before,deadline_at)
 values('00000000-0000-4000-8000-000000000002','122',d-1,now()-interval '1 day',now()-interval '1 day'+interval '9 minutes');
 c:=public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','123',d,now(),now()+interval '9 minutes');
 if (c->>'reserved')::boolean then raise exception 'Unresolved previous-day bypass'; end if;
 update public.aca_backup_retry_attempts set outcome='failed',finished_at=clock_timestamp() where workflow_run_id='122';
 c:=public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','123',d,now(),now()+interval '9 minutes');
 if not (c->>'reserved')::boolean then raise exception 'Valid reservation rejected'; end if;
 if (public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','123',d,now(),now()+interval '9 minutes')->>'reserved')::boolean then raise exception 'Duplicate accepted'; end if;
 update public.aca_backup_automation set retry_enabled=false where id;
 if (public.aca_begin_backup_retry((c->>'id')::uuid)->>'started')::boolean then raise exception 'Revoked policy started'; end if;
 update public.aca_backup_automation set retry_enabled=true where id;
 if not (public.aca_begin_backup_retry((c->>'id')::uuid)->>'started')::boolean then raise exception 'Valid start rejected'; end if;
 if (public.aca_begin_backup_retry((c->>'id')::uuid)->>'started')::boolean then raise exception 'Repeated start'; end if;
 perform public.aca_finish_backup_retry((c->>'id')::uuid,'failed');
 if (public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','123',d,now(),now()+interval '9 minutes')->>'reserved')::boolean then raise exception 'Spent allowance released'; end if;
end $$;
-- Execute the same API under its intended database role.
set local role service_role;
select public.aca_backup_retry_state('00000000-0000-4000-8000-000000000001',now());
rollback;
