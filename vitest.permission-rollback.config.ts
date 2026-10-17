import { defineConfig } from 'vitest/config';

// Each invocation requires a freshly bootstrapped legacy fixture. Deliberately
// refuse a default all-three run that would share one mutable activation state.
const variant = process.env.PERM_ROLLBACK_VARIANT;
if (!variant || !['Additive', 'Preflight', 'Recovery'].includes(variant)) throw new Error('EXPLICIT_ROLLBACK_VARIANT_REQUIRED');
export default defineConfig({ test: {
  environment: 'node', include: [`tests/contracts/permissionRollback${variant}.contract.test.ts`],
  fileParallelism: false, maxWorkers: 1, retry: 0, testTimeout: 120_000, hookTimeout: 60_000,
} });
