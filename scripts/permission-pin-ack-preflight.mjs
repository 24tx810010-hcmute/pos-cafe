import pg from 'pg';
import { pinAckEnvironment, assertPinAckTarget } from '../tests/supabase/permissionPinAckEnvironment.ts';

try {
  const env = pinAckEnvironment();
  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
  await db.connect();
  try { await assertPinAckTarget(db, env); }
  finally { await db.end(); }
  console.log(JSON.stringify({ status: 'PASS', project: env.project, apiPort: 59521, dbPort: 59522, strict: true }));
} catch (error) {
  const code = error instanceof Error && /^PIN_ACK_[A-Z_]+$/.test(error.message) ? error.message : 'PIN_ACK_PREFLIGHT_FAILED';
  console.error(code); process.exitCode = 1;
}
