import pg from 'pg';
import { assertPinOnboardTarget, pinOnboardEnvironment } from '../tests/supabase/permissionPinOnboardEnvironment.ts';
const apply = process.argv.length === 3 && process.argv[2] === '--apply';
if (process.argv.length > 2 && !apply) throw new Error('PIN_TC02_RECOVERY_OPTION_REFUSED');
const env = pinOnboardEnvironment();
const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
await db.connect();
try {
  await assertPinOnboardTarget(db, env);
  await db.query('begin');
  try {
    const marker = (await db.query(`select marker,project from private.pin_onboard_test_environment where singleton for update`)).rows;
    if (marker.length !== 1 || marker[0].marker !== env.marker || marker[0].project !== env.project)
      throw new Error('PIN_TC02_RECOVERY_MARKER_REFUSED');
    const graph = (await db.query(`select s.id,s.store_no,s.name,ss.address,u.email,w.requested,w.status,
      (select count(*)::int from public.employees where store_id=s.id) employees,
      (select count(*)::int from private.initial_seed_stages where workflow_id=w.workflow_id) stages,
      (select count(*)::int from private.bootstrap_requests where store_id=s.id) bootstraps,
      (select count(*)::int from private.store_no_reservations where store_no=s.store_no) reservations,
      (select count(*)::int from private.employee_sessions where store_id=s.id) sessions,
      (select count(*)::int from public.employee_admin_audit where store_id=s.id) audits,
      (select count(*)::int from private.employee_admin_requests where store_id=s.id) registry,
      (select count(*)::int from public.write_operations where store_id=s.id) operations,
      (select count(*)::int from public.categories where store_id=s.id) categories,
      (select count(*)::int from public.floor_areas where store_id=s.id) areas
      from public.stores s join public.store_settings ss on ss.store_id=s.id
      join auth.users u on u.id=s.id join private.initial_seed_workflows w on w.store_id=s.id`)).rows;
    const g = graph[0];
    if (graph.length !== 1 || g.store_no !== 1 || g.name !== 'Cà phê Owner PIN E2E' || g.address !== '12 Nguyễn Huệ'
      || g.email !== 'store1@store.pos.local' || g.requested !== false || g.status !== 'skipped'
      || g.employees !== 1 || g.stages !== 0 || g.bootstraps !== 1 || g.reservations !== 1
      || g.sessions !== 1 || g.audits !== 0 || g.registry !== 0 || g.operations !== 0
      || g.categories !== 0 || g.areas !== 0)
      throw new Error('PIN_TC02_RECOVERY_GRAPH_REFUSED');
    const total = (await db.query(`select
      (select count(*)::int from public.stores) stores,
      (select count(*)::int from auth.users) users,
      (select count(*)::int from storage.objects) objects,
      (select count(*)::int from public.write_operations) operations`)).rows[0];
    if (JSON.stringify(total) !== JSON.stringify({ stores: 1, users: 1, objects: 0, operations: 0 }))
      throw new Error('PIN_TC02_RECOVERY_SCOPE_REFUSED');
    const sequence = (await db.query('select last_value::text,is_called from public.store_no_seq')).rows[0];
    if (sequence.last_value !== '1' || !sequence.is_called) throw new Error('PIN_TC02_RECOVERY_SEQUENCE_REFUSED');
    if (!apply) {
      await db.query('rollback');
      console.log(JSON.stringify({ status: 'SAFE_TO_CLEAN', project: env.project, stores: 1, sessions: 1 }));
    } else {
      await db.query('delete from private.employee_sessions where store_id=$1', [g.id]);
      await db.query('delete from private.bootstrap_requests where store_id=$1', [g.id]);
      const auth = await db.query('delete from auth.users where id=$1 returning id', [g.id]);
      if (auth.rowCount !== 1) throw new Error('PIN_TC02_AUTH_DELETE_REFUSED');
      await db.query('delete from public.store_change_signals where store_id=$1', [g.id]);
      const reservation = await db.query('delete from private.store_no_reservations where store_no=1 returning store_no');
      if (reservation.rowCount !== 1) throw new Error('PIN_TC02_RESERVATION_DELETE_REFUSED');
      await db.query("select setval('public.store_no_seq',1,false)");
      await db.query('commit');
      await assertPinOnboardTarget(db, env);
      console.log(JSON.stringify({ status: 'RECOVERED', project: env.project, fixtureCountsZero: true }));
    }
  } catch (error) { await db.query('rollback').catch(() => undefined); throw error; }
} finally { await db.end(); }
