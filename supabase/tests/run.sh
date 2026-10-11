#!/usr/bin/env bash
# Rebuilds a scratch database, applies the stub + all migrations, then runs RLS tests.
set -euo pipefail
DB=${1:-ibadat_test}
cd "$(dirname "$0")/.."
su postgres -c "dropdb --if-exists $DB && createdb $DB"
P="su postgres -c"
run() { su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $1"; }
run "$PWD/tests/00_supabase_stub.sql"
for f in migrations/*.sql; do echo "applying $f"; run "$PWD/$f"; done
for t in tests/1*.sql; do echo "running $t"; run "$PWD/$t"; done
echo "ALL OK"
