#!/usr/bin/env bash
set -euo pipefail
# A new local CI database only; no Academy URL or credentials are accepted here.
createdb aca_schedule_recovery_fixture
export PGDATABASE=aca_schedule_recovery_fixture
psql -X -v ON_ERROR_STOP=1 -f operations/schedule-recovery-fixture.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261108103946_aca_operations_schedule_recovery.sql
psql -X -v ON_ERROR_STOP=1 -f operations/schedule-recovery-acceptance.sql
psql -X -v ON_ERROR_STOP=1 -c "begin; select public.aca_claim_daily_backup('101','1'); select pg_sleep(1); commit;" >/dev/null &
first=$!
psql -X -v ON_ERROR_STOP=1 -c "select public.aca_claim_daily_backup('102','1');" >/dev/null &
second=$!
wait "$first"
wait "$second"
psql -X -v ON_ERROR_STOP=1 -c "do \$\$ begin assert (select count(*)=1 from public.aca_automation_runs),'Concurrent timers created duplicate backups'; end \$\$;"
