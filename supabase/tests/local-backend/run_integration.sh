#!/usr/bin/env bash
# Starts PostgreSQL + REAL PostgREST (+ test backend), runs the integration tests, stops everything.
# Requires: local PostgreSQL (apt), a PostgREST static binary (POSTGREST_BIN, default /tmp/pgrst/postgrest).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../../.."
service postgresql start >/dev/null 2>&1; for i in $(seq 1 20); do su postgres -c "psql -qAt -c 'select 1'" >/dev/null 2>&1 && break; sleep 0.5; done
bash "$HERE/start.sh" || exit 1
cd "$ROOT" && npx vitest run --config vitest.integration.config.ts "$@"; rc=$?
bash "$HERE/stop.sh"; exit $rc
