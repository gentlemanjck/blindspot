import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so dist/ works on any static host (see SPEC §10).
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
