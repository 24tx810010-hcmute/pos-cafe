import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  envDir: false,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    allowOnly: false, environment: 'node', include: ['tests/contracts/permissionCandidateSignals.contract.test.ts'],
    fileParallelism: false, maxWorkers: 1, passWithNoTests: false, retry: 0, testTimeout: 30_000, hookTimeout: 30_000,
  },
});
