import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  envDir: false,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    allowOnly:false,
    environment: 'node',
    include: ['tests/contracts/**/*.contract.test.ts'],
    exclude: ['tests/contracts/permissionMigration.contract.test.ts', 'tests/contracts/permissionBridge.contract.test.ts', 'tests/contracts/permissionFoundation.contract.test.ts', 'tests/contracts/permissionIdentity.contract.test.ts', 'tests/contracts/permissionAdministration.contract.test.ts', 'tests/contracts/permissionFinancial.contract.test.ts', 'tests/contracts/permissionFinancialRegression.contract.test.ts', 'tests/contracts/permissionRead.contract.test.ts'],
    globalSetup: ['tests/contracts/globalSetup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxWorkers: 1,
    passWithNoTests: false,
  },
});
