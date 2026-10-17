import { defineConfig } from "vitest/config";
export default defineConfig({
  envDir: false,
  test: { environment: "node", include: ["tests/contracts/ownerPinSurface.contract.test.ts", "tests/contracts/ownerPinSurfaceOracle.tool.test.ts", "tests/contracts/permissionReporter.tool.test.ts"],
    fileParallelism: false, maxWorkers: 1, allowOnly: false, passWithNoTests: false,
    retry: 0, testTimeout: 30_000, hookTimeout: 120_000 },
});
