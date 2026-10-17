import pg from 'pg';
import { pinOnboardEnvironment, assertPinOnboardTarget } from '../tests/supabase/permissionPinOnboardEnvironment.ts';

try {
  const env = pinOnboardEnvironment();
  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
  await db.connect();
  try {
    await assertPinOnboardTarget(db, env);
    const counts = (await db.query(`select
      (select count(*)::int from public.stores) stores,
      (select count(*)::int from auth.users) auth_users,
      (select count(*)::int from private.store_no_reservations) reservations,
      (select count(*)::int from private.bootstrap_requests) bootstraps,
      (select count(*)::int from private.initial_seed_workflows) workflows,
      (select count(*)::int from private.initial_seed_stages) stages,
      (select count(*)::int from public.store_change_signals) signals,
      (select count(*)::int from storage.objects) storage_objects`)).rows[0];
    if (Object.values(counts).some(value => value !== 0)) throw new Error('PIN_ONBOARD_FIXTURE_NOT_RESTORED');
    console.log(JSON.stringify({ status: 'PASS', project: env.project, fixtureCountsZero: true, apiBinding: true }));
  } finally { await db.end(); }
} catch (error) {
  const code = error instanceof Error && /^PIN_ONBOARD_[A-Z_]+$/.test(error.message) ? error.message : 'PIN_ONBOARD_POSTFLIGHT_FAILED';
  console.error(code); process.exitCode = 1;
}
