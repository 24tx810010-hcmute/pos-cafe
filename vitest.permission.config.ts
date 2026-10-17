import { defineConfig } from 'vitest/config';

export default defineConfig({ envDir: false, test: {
  allowOnly: false, environment: 'node', include: ['tests/contracts/permissionMigration.contract.test.ts'],
  fileParallelism: false, maxWorkers: 1, passWithNoTests: false, testTimeout: 120000, hookTimeout: 120000,
} });
