import pg from 'pg';
import { pinOnboardEnvironment, assertPinOnboardTarget } from '../tests/supabase/permissionPinOnboardEnvironment.ts';

try {
  const env = pinOnboardEnvironment();
  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
  await db.connect();
  try { await assertPinOnboardTarget(db, env); }
  finally { await db.end(); }
  console.log(JSON.stringify({ status: 'PASS', project: env.project, apiPort: 62921, dbPort: 62922, strict: true }));
} catch (error) {
  const code = error instanceof Error && /^PIN_ONBOARD_[A-Z_]+$/.test(error.message) ? error.message : 'PIN_ONBOARD_PREFLIGHT_FAILED';
  console.error(code); process.exitCode = 1;
}
