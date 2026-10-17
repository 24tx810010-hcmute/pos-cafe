import { defineConfig } from 'vitest/config';

export default defineConfig({ envDir: false, test: {
  environment: 'node', include: ['tests/contracts/ownerRecoveryOperator.tool.test.mjs'],
  retry: 0, fileParallelism: false, maxWorkers: 1, passWithNoTests: false,
} });
