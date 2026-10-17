import { defineConfig } from '@playwright/test';
import { isAbsolute, join, resolve } from 'node:path';
import candidate from './playwright.permission-candidate.config';

const privateArtifacts = process.env.PERM_REALTIME_PRIVATE_ARTIFACT_DIR;
if (!privateArtifacts || !isAbsolute(privateArtifacts) || !resolve(privateArtifacts).split(/[\\/]/).includes('private'))
  throw new Error('REALTIME_PRIVATE_ARTIFACT_DIRECTORY_REQUIRED');

export default defineConfig(candidate, {
  // TC55 observes an already activated fixture; activation/reset is a separate
  // authorized stage. The test binds phase/strict contract before its writes.
  globalSetup: undefined,
  testMatch: /permissionRealtime\.spec\.ts/,
  retries: 0, repeatEach: 1, workers: 1, fullyParallel: false, forbidOnly: true,
  outputDir: join(privateArtifacts, 'test-results'),
  use: { trace: 'off', screenshot: 'off', video: 'off' },
  reporter: [
    ['json', { outputFile: join(privateArtifacts, 'permission-realtime-e2e.json') }],
    ['./scripts/permission-playwright-options-reporter.mjs'],
  ],
});
