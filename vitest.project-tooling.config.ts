import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: {
    allowOnly: false, environment: 'node',
    include: ['tests/**/*.tool.test.ts', 'tests/**/*.tool.test.mjs'],
    fileParallelism: false, maxWorkers: 1, retry: 0,
    passWithNoTests: false, testTimeout: 180_000,
  },
});
