# Environment variables
See `.env.example`. Browser (public, `VITE_*`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MEMBER_AUTH_EMAIL_DOMAIN`.
Server only (Edge Function secrets, never in the repo or any `VITE_*`): `SUPABASE_SERVICE_ROLE_KEY`, database password, third-party secrets.
`.env*` files are git-ignored except `.env.example`.
