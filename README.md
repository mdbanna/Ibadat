# IBADAT platform: Phase 1 foundation

Bilingual (Bengali default / English) website and management platform for IBADAT (Infusion Bliss And Direct Aid Team).
This phase contains the design system, i18n, Supabase schema/RLS/storage migrations and shared components. It does **not** contain the public pages, member dashboard or admin panel.

```bash
npm install
cp .env.example .env.local     # fill in the public Supabase values
npm run dev                    # http://localhost:5173  (/design-system shows the components)
npm test                       # unit tests (i18n parity, member-ID helpers)
npm run build                  # typecheck + production build
supabase/tests/run.sh          # needs local PostgreSQL: applies all migrations to a scratch DB and runs 100+ RLS/ledger assertions
```
Docs: `docs/architecture.md`, `docs/storage.md`, `docs/environment.md`. Migrations: `supabase/migrations/` (apply in filename order).
Regenerate DB types after every migration into `src/types/database.ts`.
The official logo was not supplied; `src/components/layout/Logo.tsx` is a placeholder.

## Database status
The migrations in `supabase/migrations/` (six files) have **not** been applied to any live project yet.
`supabase/proposed/` holds a seventh, proposed hardening migration (revokes API access to internal trigger functions); it is verified locally but not yet part of the set.
`supabase/rollback/rollback_phase1.sql` removes everything the migrations create (destructive; storage buckets must be deleted separately).
`supabase/tests/verify_proposed.sh` applies migrations + proposed file, runs all tests, then proves the rollback leaves nothing behind.
