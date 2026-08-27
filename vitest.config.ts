import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Separate from next.config.ts on purpose — Next's own build pipeline
// (webpack/turbopack) never runs during `npm test`, so nothing here needs to
// match it beyond the "@/*" path alias, which the test files rely on the
// same way the app code does.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Explicit include instead of vitest's default so a stray *.test.ts
    // dropped outside src/ (or one belonging to a different tool) doesn't
    // get silently picked up.
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
