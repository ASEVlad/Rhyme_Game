import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    environmentMatchGlobs: [
      ['**/*.test.tsx', 'jsdom'],
    ],
    // Prevent tests inside a sibling git worktree from being double-collected
    // when running vitest in the main checkout.
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
  },
});
