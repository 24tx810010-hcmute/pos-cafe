import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: {
    allowOnly:false,
    environment: 'node',
    include: ['tests/contracts/**/*.contract.test.ts'],
    globalSetup: ['tests/contracts/globalSetup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxWorkers: 1,
    passWithNoTests: false,
  },
});
