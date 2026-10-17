import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: { allowOnly: false, environment: 'node', include: ['tests/contracts/permissionCanaryEmptyRuntime.contract.test.ts'],
    fileParallelism: false, maxWorkers: 1, retry: 0, passWithNoTests: false, testTimeout: 240_000, hookTimeout: 240_000 },
});
