import pg from 'pg';
import { parseBridgeEnvironment, assertBridgeFixture, PROJECT } from './permission-pin-identity-runtime.mjs';

try {
  if (process.argv.length !== 2 || process.env.PIN_IDENTITY_RUNTIME !== 'close1')
    throw new Error('IDENTITY_PREFLIGHT_PROFILE_REQUIRED');
  const env = parseBridgeEnvironment();
  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
  await db.connect();
  try { await assertBridgeFixture(db, env); }
  finally { await db.end(); }
  console.log(JSON.stringify({ status: 'PASS', project: PROJECT, apiPort: 63021, dbPort: 63022,
    marker: true, migrations: 16, apiObserverBinding: true }));
} catch (error) {
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)
    ? error.message : 'IDENTITY_PREFLIGHT_FAILED';
  console.error(code); process.exitCode = 1;
}
