import pg from 'pg';
import { pinExpiryEnvironment, assertPinExpiryTarget } from '../tests/supabase/permissionPinExpiryEnvironment.ts';
import { installPinExpiryClock } from '../tests/supabase/permissionPinExpiryClock.ts';

const fail = code => { throw new Error(code); };
let db;
let clock;
try {
  if (process.argv.length !== 3 || process.argv[2] !== '/var/tmp/pos-cafe-perm-g2c-20261009/private/pin-expiry.env')
    fail('PIN_EXPIRY_CLOCK_SMOKE_ARGUMENT_REFUSED');
  process.env.PIN_EXPIRY_ENV_FILE = process.argv[2];
  const env = pinExpiryEnvironment();
  db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
  await db.connect();
  await assertPinExpiryTarget(db, env);
  clock = await installPinExpiryClock(db);
  const during = await clock.proof();
  if (!during.installed || during.restored || !during.liveMatches || await clock.read() !== clock.t0Iso
    || Math.abs(Date.now() - Date.parse(clock.t0Iso)) > 30_000)
    fail('PIN_EXPIRY_CLOCK_SMOKE_INSTALL_REFUSED');
  await clock.restore();
  const restored = await clock.proof();
  if (!restored.installed || !restored.restored || !restored.liveMatches)
    fail('PIN_EXPIRY_CLOCK_SMOKE_RESTORE_REFUSED');
  await assertPinExpiryTarget(db, env);
  console.log(JSON.stringify({ status: 'PASS', installation: true, fixtureCatalogExact: during.liveMatches,
    restorationCatalogExact: restored.liveMatches, postRestorePreflight: true }));
} catch (error) {
  const code = error instanceof Error && /^PIN_EXPIRY_[A-Z_]+$/.test(error.message)
    ? error.message : 'PIN_EXPIRY_CLOCK_SMOKE_FAILED';
  console.error(code);
  process.exitCode = 1;
} finally {
  if (clock) {
    try { await clock.restore(); }
    catch { console.error('PIN_EXPIRY_CLOCK_SMOKE_FINAL_RESTORE_FAILED'); process.exitCode = 1; }
  }
  if (db) {
    try { await db.end(); }
    catch { console.error('PIN_EXPIRY_CLOCK_SMOKE_DISCONNECT_FAILED'); process.exitCode = 1; }
  }
}
