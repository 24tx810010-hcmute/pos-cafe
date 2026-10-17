import assert from 'node:assert/strict';
import test from 'node:test';
import { ci1PublicationPath } from './permission-ci1-source.mjs';

test('publication paths admit application/tests/tools/example config and exclude generated stores', () => {
  for (const path of ['src/app/App.tsx', 'tests/contracts/permissionSignals.contract.test.ts',
    'scripts/permission-ci1-worker.mjs', '.env.example', 'pnpm-lock.yaml']) assert.equal(ci1PublicationPath(path), true);
  for (const path of ['artifacts/private/raw.json', 'node_modules/pg/index.js', 'test-results/trace.zip',
    'dist/index.html', 'coverage/summary.json', '.git/config', 'app.tsbuildinfo']) assert.equal(ci1PublicationPath(path), false);
});

test('publication guard blocks local credentials, backups, traversal and platform-specific path escapes', () => {
  for (const path of ['.env', '.env.local', 'x/.env.production', '.npmrc', 'private/key.pem', 'backup.sql.dump',
    'source.tar', '../secret', '/root/file', 'D:/secret', 'folder\\secret', 'a/./b', 'a//b', 'a\nsecret']) {
    assert.throws(() => ci1PublicationPath(path), { message: 'CI1_SOURCE_REFUSED' });
  }
});
