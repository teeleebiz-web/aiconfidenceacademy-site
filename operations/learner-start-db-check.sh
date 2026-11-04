#!/usr/bin/env bash
set -euo pipefail
createdb aca_learner_start_fixture
export PGDATABASE=aca_learner_start_fixture
psql -X -v ON_ERROR_STOP=1 -f operations/learner-start-fixture.sql
if [ "$#" -gt 0 ]; then
  migration_path="$1"
else
  migrations=(supabase/migrations/*_stage_learner_start.sql)
  [ "${#migrations[@]}" -eq 1 ]
  migration_path="${migrations[0]}"
fi
psql -X -v ON_ERROR_STOP=1 -f "$migration_path"
psql -X -v ON_ERROR_STOP=1 -f operations/learner-start-assertions.sql
