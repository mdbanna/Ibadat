#!/usr/bin/env bash
# Builds the app against the local backend, serves it, drives it with headless Chromium, and stops everything.
# Requires: local PostgreSQL, PostgREST binary (POSTGREST_BIN), and Chromium tooling (BROWSER_TOOLS: npm i puppeteer-core @sparticuz/chromium).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../../.."
export PGRST_JWT_SECRET="${PGRST_JWT_SECRET:-test-only-secret-at-least-32-characters-long!!}"
service postgresql start >/dev/null 2>&1; for i in $(seq 1 20); do su postgres -c "psql -qAt -c 'select 1'" >/dev/null 2>&1 && break; sleep 0.5; done
bash "$HERE/start.sh" || exit 1
ANON=$(node -e "const c=require('node:crypto');const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const h=b({alg:'HS256',typ:'JWT'}),p=b({role:'anon',iss:'supabase',iat:1,exp:4102444800});console.log(h+'.'+p+'.'+c.createHmac('sha256',process.env.PGRST_JWT_SECRET).update(h+'.'+p).digest('base64url'))")
cd "$ROOT"
VITE_SUPABASE_URL=http://127.0.0.1:3112 VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" VITE_MEMBER_AUTH_EMAIL_DOMAIN=members.test \
  npx vite build --outDir /tmp/dist-e2e --emptyOutDir >/tmp/e2e-build.log 2>&1 || { tail -5 /tmp/e2e-build.log; bash "$HERE/stop.sh"; exit 1; }
setsid nohup npx vite preview --outDir /tmp/dist-e2e --port 4173 --strictPort >/tmp/preview.log 2>&1 < /dev/null & echo $! >> /tmp/ibadat-backend.pids
for i in $(seq 1 40); do curl -sf http://127.0.0.1:4173/ >/dev/null && break; sleep 0.5; done
node "$HERE/e2e.mjs"; rc=$?
bash "$HERE/stop.sh"; exit $rc
