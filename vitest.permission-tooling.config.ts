import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  test: {
    allowOnly: false,
    environment: "node",
    include: ["tests/contracts/permission*.tool.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    retry: 0,
    passWithNoTests: false,
    testTimeout: 30_000,
  },
});
