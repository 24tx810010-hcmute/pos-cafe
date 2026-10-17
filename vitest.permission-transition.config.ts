import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: {
    allowOnly: false,
    environment: 'node',
    include: ['tests/contracts/permissionTransition.contract.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    passWithNoTests: false,
    retry: 0,
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
