import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

const backendOnly = JSON.parse(readFileSync(new URL('./ci/backend-only-tests.json', import.meta.url), 'utf8')) as { fullName: string }[];
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Keep discovery of the complete tooling inventory. Exactly these real-backend
// cases belong to the owner's manual lane; every other pending case is a failure.
const lightCases = new RegExp(`^(?!(?:${backendOnly.map(item => escape(item.fullName)).join('|')})$)[\\s\\S]*$`);

export default defineConfig({
  envDir: false,
  test: {
    allowOnly: false, environment: 'node',
    include: ['tests/**/*.tool.test.ts', 'tests/**/*.tool.test.mjs'],
    testNamePattern: lightCases,
    fileParallelism: false, maxWorkers: 1, retry: 0,
    passWithNoTests: false, testTimeout: 180_000,
  },
});
