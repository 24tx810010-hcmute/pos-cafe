import pg from 'pg';
import { pinExpiryEnvironment, assertPinExpiryTarget } from '../tests/supabase/permissionPinExpiryEnvironment.ts';

try {
  if (process.argv.length !== 3 || process.argv[2] !== '/var/tmp/pos-cafe-perm-g2c-20261009/private/pin-expiry.env')
    throw new Error('PIN_EXPIRY_PREFLIGHT_ARGUMENT_REFUSED');
  process.env.PIN_EXPIRY_ENV_FILE = process.argv[2];
  const env = pinExpiryEnvironment();
  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
  await db.connect();
  try { await assertPinExpiryTarget(db, env); }
  finally { await db.end(); }
  console.log(JSON.stringify({ status: 'PASS', project: env.project, apiPort: 59721, dbPort: 59722, strict: true }));
} catch (error) {
  const code = error instanceof Error && /^PIN_EXPIRY_[A-Z_]+$/.test(error.message) ? error.message : 'PIN_EXPIRY_PREFLIGHT_FAILED';
  console.error(code); process.exitCode = 1;
}
