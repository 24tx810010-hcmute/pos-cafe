import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['tests/contracts/permissionMigrationActivation.tool.test.ts','tests/contracts/permissionResetFixture.tool.test.ts'],fileParallelism:false,maxWorkers:1,retry:0}});
