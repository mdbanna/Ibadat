# IBADAT platform

Bilingual (Bengali default / English) website and management platform for IBADAT (Infusion Bliss And Direct Aid Team).
Phase 1: design system, i18n, Supabase schema/RLS/storage migrations, shared components.
Phase 2: the public website (Home, About, Our Work, Gallery, Members, Join, Contact), see `docs/phase2-public-site.md`.
Phase 3: member login (`/login`) and the 12-section member dashboard (`/dashboard`), see `docs/phase3-member-dashboard.md`.
Not built yet: admin panel, CMS screens, account-creation Edge Function.

```bash
npm install
cp .env.example .env.local     # fill in the public Supabase values
npm run dev                    # http://localhost:5173  (/design-system shows the components)
npm test                       # 198 unit/UI tests (mocked Supabase): i18n parity, validation, forms, pages (axe), auth states, guards, contrast
npm run build                  # typecheck + production build
npm run test:db                # needs local PostgreSQL: applies all migrations to a scratch DB, 167 RLS/ledger/binding assertions
npm run test:integration       # real PostgREST + PostgreSQL (see docs/phase3-member-dashboard.md)
npm run test:e2e               # headless Chromium at 360/768/1280px against the local backend
```
Docs: `docs/architecture.md`, `docs/storage.md`, `docs/environment.md`. Migrations: `supabase/migrations/` (apply in filename order).
Regenerate DB types after every migration into `src/types/database.ts`.
The official logo was not supplied; `src/components/layout/Logo.tsx` is a placeholder.

## Database status
The migrations in `supabase/migrations/` (six Phase 1 files plus `20261010000100_public_site.sql`) have **not** been applied to any live project yet.
`supabase/proposed/` holds a seventh, proposed hardening migration (revokes API access to internal trigger functions); it is verified locally but not yet part of the set.
`supabase/rollback/rollback_phase1.sql` removes everything the migrations create (destructive; storage buckets must be deleted separately).
`supabase/tests/verify_proposed.sh` applies migrations + proposed file, runs all tests, then proves the rollback leaves nothing behind.
