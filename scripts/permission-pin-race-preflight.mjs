import pg from 'pg';
import { pinRaceEnvironment, assertPinRaceTarget } from '../tests/supabase/permissionPinRaceEnvironment.ts';

try {
  const env = pinRaceEnvironment();
  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
  await db.connect();
  try { await assertPinRaceTarget(db, env); }
  finally { await db.end(); }
  console.log(JSON.stringify({ status: 'PASS', project: env.project, apiPort: 59621, dbPort: 59622, strict: true }));
} catch (error) {
  const code = error instanceof Error && /^PIN_RACE_[A-Z_]+$/.test(error.message) ? error.message : 'PIN_RACE_PREFLIGHT_FAILED';
  console.error(code); process.exitCode = 1;
}
