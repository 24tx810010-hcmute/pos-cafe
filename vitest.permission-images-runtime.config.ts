import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["tests/contracts/permissionImagesRuntime.contract.test.ts"], fileParallelism: false, maxWorkers: 1, retry: 0, testTimeout: 30000, hookTimeout: 120000 } });
