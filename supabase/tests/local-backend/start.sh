#!/usr/bin/env bash
# Builds a scratch database (stub + ALL migrations + seed), starts REAL PostgREST and the test backend. Stop with stop.sh.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../../.."
POSTGREST_BIN="${POSTGREST_BIN:-/tmp/pgrst/postgrest}"
export PGRST_JWT_SECRET="${PGRST_JWT_SECRET:-test-only-secret-at-least-32-characters-long!!}"
DB=ibadat_it; PIDS="/tmp/ibadat-backend.pids"
[ -x "$POSTGREST_BIN" ] || { echo "PostgREST binary not found at $POSTGREST_BIN (download a linux-static release from github.com/PostgREST/postgrest)"; exit 1; }
su postgres -c "dropdb --if-exists $DB && createdb $DB"
psqlf() { su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $1"; }
psqlf "$ROOT/supabase/tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do psqlf "$f" >/dev/null; done
psqlf "$HERE/seed.sql"
su postgres -c "psql -q -d $DB -c \"do \\\$\\\$ begin if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit password 'authpw'; end if; end \\\$\\\$; grant anon, authenticated, service_role to authenticator;\""
: > "$PIDS"
PGRST_DB_URI="postgres://authenticator:authpw@127.0.0.1:5432/$DB" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_SERVER_PORT=3001 \
  setsid nohup "$POSTGREST_BIN" >/tmp/postgrest.log 2>&1 < /dev/null & echo $! >> "$PIDS"
BACKEND_PORT=3112 setsid nohup node "$HERE/backend.mjs" >/tmp/backend.log 2>&1 < /dev/null & echo $! >> "$PIDS"
for i in $(seq 1 40); do curl -sf http://127.0.0.1:3112/__health >/dev/null && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/ | grep -q 200 && { echo "backend ready (PostgREST :3001, test backend :3112)"; exit 0; }; sleep 0.5; done
echo "backend failed to start"; tail -5 /tmp/postgrest.log /tmp/backend.log; exit 1
