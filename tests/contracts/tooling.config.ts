import { defineConfig } from 'vitest/config';
export default defineConfig({ envDir:false, test: { allowOnly:false, environment: 'node', include: ['tests/contracts/**/*.tool.test.ts'], passWithNoTests: false, fileParallelism:false,maxWorkers:1,testTimeout:120000,hookTimeout:30000 } });
