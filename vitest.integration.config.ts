import { defineConfig } from 'vitest/config'

// Integration tests run against a REAL PostgREST + PostgreSQL (see supabase/tests/local-backend/run_integration.sh).
// They are excluded from `npm test` because they need that backend.
export default defineConfig({
  test: { environment: 'node', include: ['src/integration/**/*.spec.ts'], testTimeout: 30000, hookTimeout: 30000, fileParallelism: false },
})
