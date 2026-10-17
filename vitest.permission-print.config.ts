import { fileURLToPath } from "node:url";import { defineConfig } from "vitest/config";
export default defineConfig({envDir:false,resolve:{alias:{"@":fileURLToPath(new URL("./src",import.meta.url))}},test:{allowOnly:false,environment:"node",include:["tests/contracts/permissionPrint.contract.test.ts"],fileParallelism:false,maxWorkers:1,passWithNoTests:false,retry:0,testTimeout:30000,hookTimeout:120000}});

