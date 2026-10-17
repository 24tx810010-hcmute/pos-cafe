import pg from 'pg';
import { pinAckEnvironment, assertPinAckTarget } from '../tests/supabase/permissionPinAckEnvironment.ts';

try {
  const env = pinAckEnvironment();
  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  await db.connect();
  try {
    await assertPinAckTarget(db, env);
    const rows = (await db.query(`select s.name,
      (select count(*)::int from private.employee_sessions x where x.store_id=s.id) sessions,
      (select count(*)::int from private.employee_sessions x where x.store_id=s.id and x.revoked_at is null) active_sessions,
      (select count(*)::int from private.employee_admin_requests x where x.store_id=s.id and x.kind='complete_required_pin_change') completions,
      (select count(*)::int from public.employee_admin_audit x where x.store_id=s.id and x.kind='complete_required_pin_change') audits
      from public.stores s order by s.name`)).rows;
    console.log(JSON.stringify({ status: 'PASS', stores: rows }));
  } finally { await db.end(); }
} catch (error) {
  const code = error instanceof Error && /^PIN_ACK_[A-Z_]+$/.test(error.message) ? error.message : 'PIN_ACK_STATE_FAILED';
  console.error(code); process.exitCode = 1;
}
