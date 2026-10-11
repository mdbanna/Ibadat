#!/usr/bin/env bash
# 1) migrations + proposed hardening + full test suite  2) rollback script leaves nothing behind in public.
set -euo pipefail
DB=ibadat_verify; cd "$(dirname "$0")/.."
su postgres -c "dropdb --if-exists $DB && createdb $DB"
run() { su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $1"; }
q()   { su postgres -c "psql -At -d $DB -c \"$1\""; }
run "$PWD/tests/00_supabase_stub.sql"
for f in migrations/*.sql proposed/*.sql; do run "$PWD/$f"; done
echo "internal functions executable by anon/authenticated (expect 0):"
q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('audit_row_change','post_contribution_ledger','guard_contributions','guard_fund_transactions','set_updated_at','guard_profile_changes','stamp_application_review','block_truncate','guard_monthly_reports','block_audit_mutation') and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))"
for t in tests/1*.sql; do run "$PWD/$t"; done
run "$PWD/rollback/rollback_phase1.sql"
echo "objects left in public after rollback (expect 0 0 0 0 0):"
q "select (select count(*) from pg_tables where schemaname='public'), (select count(*) from pg_views where schemaname='public'), (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'), (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'), (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='S')"
echo "storage policies left (expect 0):"; q "select count(*) from pg_policies where schemaname='storage'"
echo "VERIFIED"
