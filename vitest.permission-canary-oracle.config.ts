import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: { allowOnly: false, environment: 'node', include: [
    'tests/contracts/permissionCanaryOracle.tool.test.ts',
    'tests/contracts/permissionCanaryArtifacts.tool.test.ts',
    'tests/contracts/permissionCanaryScenarioMatrix.tool.test.ts',
    'tests/contracts/permissionPinCanaryReporter.tool.test.ts',
  ],
    fileParallelism: false, maxWorkers: 1, retry: 0, passWithNoTests: false },
});
