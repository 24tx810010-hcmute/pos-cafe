import pg from 'pg';
import { assertPinOnboardTarget, pinOnboardEnvironment } from '../tests/supabase/permissionPinOnboardEnvironment.ts';

const apply = process.argv.length === 3 && process.argv[2] === '--apply';
if (process.argv.length > 2 && !apply) throw new Error('PIN_TC06_RECOVERY_OPTION_REFUSED');
const env = pinOnboardEnvironment();
const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
await db.connect();
try {
  await assertPinOnboardTarget(db, env);
  await db.query('begin');
  try {
    const marker = (await db.query(`select marker,project from private.pin_onboard_test_environment
      where singleton for update`)).rows;
    if (marker.length !== 1 || marker[0].marker !== env.marker || marker[0].project !== env.project)
      throw new Error('PIN_TC06_RECOVERY_MARKER_REFUSED');
    const graph = (await db.query(`select s.id,s.store_no,s.name,ss.address,u.email,w.requested,w.status,
      (select count(*)::int from public.employees where store_id=s.id) employees,
      (select count(*)::int from private.initial_seed_stages where workflow_id=w.workflow_id) stages,
      (select count(*)::int from private.bootstrap_requests where store_id=s.id) bootstraps,
      (select count(*)::int from private.store_no_reservations where store_no=s.store_no) reservations,
      (select count(*)::int from private.employee_sessions where store_id=s.id) sessions,
      (select count(*)::int from public.employee_admin_audit where store_id=s.id) audits,
      (select count(*)::int from private.employee_admin_requests where store_id=s.id) registry,
      (select count(*)::int from public.write_operations where store_id=s.id and status='pending' and result is null and decided_at is null) pending,
      (select count(*)::int from public.order_events where store_id=s.id) events,
      (select count(*)::int from public.payments where store_id=s.id) payments,
      (select count(*)::int from public.categories where store_id=s.id) categories,
      (select count(*)::int from public.floor_areas where store_id=s.id) areas
      from public.stores s join public.store_settings ss on ss.store_id=s.id
      join auth.users u on u.id=s.id join private.initial_seed_workflows w on w.store_id=s.id`)).rows;
    const g = graph[0];
    if (graph.length !== 1 || g.store_no !== 1 || g.name !== 'Cà phê Owner PIN E2E' || g.address !== '12 Nguyễn Huệ'
      || g.email !== 'store1@store.pos.local' || g.requested !== false || g.status !== 'skipped'
      || g.employees !== 1 || g.stages !== 0 || g.bootstraps !== 1 || g.reservations !== 1
      || g.sessions < 2 || g.sessions > 5 || g.audits !== 1 || g.registry !== 1 || g.pending !== 1
      || g.events !== 0 || g.payments !== 0 || g.categories !== 0 || g.areas !== 0)
      throw new Error('PIN_TC06_RECOVERY_GRAPH_REFUSED');
    const total = (await db.query(`select
      (select count(*)::int from public.stores) stores,
      (select count(*)::int from auth.users) users,
      (select count(*)::int from public.write_operations) operations,
      (select count(*)::int from public.order_events) events,
      (select count(*)::int from public.payments) payments`)).rows[0];
    if (JSON.stringify(total) !== JSON.stringify({ stores: 1, users: 1, operations: 1, events: 0, payments: 0 }))
      throw new Error('PIN_TC06_RECOVERY_SCOPE_REFUSED');
    const sequence = (await db.query('select last_value::text,is_called from public.store_no_seq')).rows[0];
    if (sequence.last_value !== '1' || !sequence.is_called) throw new Error('PIN_TC06_RECOVERY_SEQUENCE_REFUSED');
    const trigger = (await db.query(`select tgenabled from pg_trigger where tgrelid='public.write_operations'::regclass
      and tgname='write_operations_immutable' and not tgisinternal`)).rows;
    if (trigger.length !== 1 || trigger[0].tgenabled !== 'O') throw new Error('PIN_TC06_TRIGGER_REFUSED');
    if (!apply) {
      await db.query('rollback');
      console.log(JSON.stringify({ status: 'SAFE_TO_CLEAN', project: env.project, stores: 1,
        pending: 1, sessions: g.sessions, audit: 1, registry: 1 }));
    } else {
      const id = g.id;
      await db.query('alter table public.write_operations disable trigger write_operations_immutable');
      const operation = await db.query(`delete from public.write_operations where store_id=$1
        and status='pending' and result is null and decided_at is null returning operation_id`, [id]);
      if (operation.rowCount !== 1) throw new Error('PIN_TC06_OPERATION_DELETE_REFUSED');
      await db.query('alter table public.write_operations enable trigger write_operations_immutable');
      await db.query('delete from private.employee_sessions where store_id=$1', [id]);
      await db.query('delete from private.employee_admin_requests where store_id=$1', [id]);
      await db.query('delete from private.bootstrap_requests where store_id=$1', [id]);
      await db.query('delete from public.employee_admin_audit where store_id=$1', [id]);
      const removed = await db.query('delete from auth.users where id=$1 returning id', [id]);
      if (removed.rowCount !== 1) throw new Error('PIN_TC06_AUTH_DELETE_REFUSED');
      await db.query('delete from public.store_change_signals where store_id=$1', [id]);
      const reservation = await db.query('delete from private.store_no_reservations where store_no=1 returning store_no');
      if (reservation.rowCount !== 1) throw new Error('PIN_TC06_RESERVATION_DELETE_REFUSED');
      await db.query("select setval('public.store_no_seq',1,false)");
      await db.query('commit');
      await assertPinOnboardTarget(db, env);
      console.log(JSON.stringify({ status: 'RECOVERED', project: env.project, fixtureCountsZero: true }));
    }
  } catch (error) { await db.query('rollback').catch(() => undefined); throw error; }
} finally { await db.end(); }
