#!/usr/bin/env bash
set -euo pipefail
createdb aca_calendar_fixture
export PGDATABASE=aca_calendar_fixture
psql -X -v ON_ERROR_STOP=1 -f operations/lesson-study-fixture.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261031072230_restore_active_lesson_study_time.sql
psql -X -v ON_ERROR_STOP=1 -f operations/lesson-calendar-fixture.sql
# The owner view retains its original joins; only its expiry expression changes.
# This minimal database has no private owner/customer history tables.
sed '/^-- Owner access labels use the same derived phase boundary/,$d' supabase/migrations/20261031100011_independent_release_calendar.sql | psql -X -v ON_ERROR_STOP=1
psql -X -v ON_ERROR_STOP=1 -f operations/lesson-calendar-assertions.sql
