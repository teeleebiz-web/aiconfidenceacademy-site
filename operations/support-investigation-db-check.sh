#!/usr/bin/env bash
set -euo pipefail
createdb aca_support_investigation_fixture
export PGDATABASE=aca_support_investigation_fixture
psql -X -v ON_ERROR_STOP=1 -f operations/support-investigation-fixture.sql
psql -X -v ON_ERROR_STOP=1 -f operations/support-investigation-schema.sql
psql -X -v ON_ERROR_STOP=1 -f operations/support-investigation-acceptance.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
update public.aca_support_investigation_settings set enabled=true,activated_at=clock_timestamp() where id;
insert into public.aca_support_cases values('00000000-0000-4000-8000-000000000001','technical','open');
insert into public.aca_support_messages values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','requester','concurrency fixture',clock_timestamp());
SQL
psql -X -v ON_ERROR_STOP=1 -c 'begin; select * from public.aca_claim_support_investigations(); select pg_sleep(1); commit;' >/dev/null &
first=$!
psql -X -v ON_ERROR_STOP=1 -c 'select * from public.aca_claim_support_investigations();' >/dev/null &
second=$!
wait "$first"
wait "$second"
psql -X -v ON_ERROR_STOP=1 -c "do \$\$ begin if (select attempts from public.aca_support_investigations)<>1 then raise exception 'Concurrent claims overlapped'; end if; end \$\$;"
