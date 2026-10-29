#!/usr/bin/env bash
set -euo pipefail
# PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE must identify a disposable CI fixture.
psql -X -v ON_ERROR_STOP=1 -f operations/backup-retry-db-fixture.sql
psql -X -v ON_ERROR_STOP=1 -f operations/backup-retry-schema.sql
psql -X -v ON_ERROR_STOP=1 -f operations/backup-retry-acceptance.sql
psql -X -v ON_ERROR_STOP=1 -c 'update public.aca_backup_automation set retry_enabled=true where id;'
request="select public.aca_reserve_backup_retry('00000000-0000-4000-8000-000000000001','123',(clock_timestamp() at time zone 'Asia/Bangkok')::date,clock_timestamp()-interval '1 second',clock_timestamp()+interval '9 minutes');"
# The first session holds the policy lock; the second must wait then deny.
psql -X -v ON_ERROR_STOP=1 -c "begin; $request select pg_sleep(1); commit;" >/dev/null &
first=$!
psql -X -v ON_ERROR_STOP=1 -c "$request" >/dev/null &
second=$!
wait "$first"
wait "$second"
psql -X -v ON_ERROR_STOP=1 -c "do \$\$ begin if (select count(*) from public.aca_backup_retry_attempts)<>1 then raise exception 'Concurrent quota failure'; end if; end \$\$;"
