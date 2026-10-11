# IBADAT platform

Bilingual (Bengali default / English) website and management platform for IBADAT (Infusion Bliss And Direct Aid Team).
Phase 1: design system, i18n, Supabase schema/RLS/storage migrations, shared components.
Phase 2: the public website (Home, About, Our Work, Gallery, Members, Join, Contact), see `docs/phase2-public-site.md`.
Not built yet: member dashboard, admin panel, CMS screens, member login page.

```bash
npm install
cp .env.example .env.local     # fill in the public Supabase values
npm run dev                    # http://localhost:5173  (/design-system shows the components)
npm test                       # 100 tests: i18n parity, validation, forms, pages (axe accessibility), colour contrast
npm run build                  # typecheck + production build
supabase/tests/run.sh          # needs local PostgreSQL: applies all migrations to a scratch DB and runs 100+ RLS/ledger assertions
```
Docs: `docs/architecture.md`, `docs/storage.md`, `docs/environment.md`. Migrations: `supabase/migrations/` (apply in filename order).
Regenerate DB types after every migration into `src/types/database.ts`.
The official logo was not supplied; `src/components/layout/Logo.tsx` is a placeholder.

## Database status
The migrations in `supabase/migrations/` (six Phase 1 files plus `20261010000100_public_site.sql`) have **not** been applied to any live project yet.
`supabase/proposed/` holds a seventh, proposed hardening migration (revokes API access to internal trigger functions); it is verified locally but not yet part of the set.
`supabase/rollback/rollback_phase1.sql` removes everything the migrations create (destructive; storage buckets must be deleted separately).
`supabase/tests/verify_proposed.sh` applies migrations + proposed file, runs all tests, then proves the rollback leaves nothing behind.
