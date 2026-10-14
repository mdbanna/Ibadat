/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'], setupFiles: ['src/test/setup.ts'], testTimeout: 20000 },
})
