#!/usr/bin/env bash
set -euo pipefail
createdb aca_support_code_fixture
export PGDATABASE=aca_support_code_fixture
psql -X -v ON_ERROR_STOP=1 -f operations/support-code-fixture.sql
psql -X -v ON_ERROR_STOP=1 -f operations/support-investigation-schema.sql
psql -X -v ON_ERROR_STOP=1 -f operations/support-code-schema.sql
psql -X -v ON_ERROR_STOP=1 -f operations/support-code-acceptance.sql
# Two independently connected workers must claim only one paid job.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
update public.aca_support_code_settings set enabled=true,activated_at=clock_timestamp();
insert into public.aca_support_cases(id,category) values('00000000-0000-4000-8000-000000000001','technical');
insert into public.aca_support_investigations(case_id,status) values('00000000-0000-4000-8000-000000000001','investigated');
insert into public.aca_support_investigation_reports values('00000000-0000-4000-8000-000000000001',1,'{"diagnosis":"no_shared_outage"}',clock_timestamp());
SQL
psql -X -v ON_ERROR_STOP=1 -c "begin; select * from public.aca_claim_support_code_job('1',repeat('a',40)); select pg_sleep(1); commit;" >/dev/null &
first=$!
psql -X -v ON_ERROR_STOP=1 -c "select * from public.aca_claim_support_code_job('2',repeat('a',40));" >/dev/null &
second=$!
wait "$first"
wait "$second"
psql -X -v ON_ERROR_STOP=1 -c "do \$\$ begin if (select count(*) from public.aca_support_code_jobs)<>1 then raise exception 'Concurrent coding claims';end if;end \$\$;"
