#!/usr/bin/env bash
set -euo pipefail
# Uses the existing disposable CI Postgres service, never a production database.
createdb aca_study_fixture
export PGDATABASE=aca_study_fixture
psql -X -v ON_ERROR_STOP=1 -f operations/lesson-study-fixture.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261031072230_restore_active_lesson_study_time.sql
psql -X -v ON_ERROR_STOP=1 -f operations/lesson-study-assertions.sql
