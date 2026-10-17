import pg from 'pg';
import { assertPinOnboardTarget, pinOnboardEnvironment } from '../tests/supabase/permissionPinOnboardEnvironment.ts';

const apply = process.argv.length === 3 && process.argv[2] === '--apply';
if (process.argv.length > 2 && !apply) throw new Error('PIN_ONBOARD_RECOVERY_OPTION_REFUSED');
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
      throw new Error('PIN_ONBOARD_RECOVERY_MARKER_REFUSED');
    const graph = (await db.query(`select s.id,s.store_no,s.name,ss.address,u.email,w.requested,w.status,
      (select count(*)::int from public.employees e where e.store_id=s.id and e.role='owner') owners,
      (select count(*)::int from private.initial_seed_stages st where st.workflow_id=w.workflow_id) stages,
      (select count(*)::int from private.bootstrap_requests b where b.store_id=s.id) bootstraps,
      (select count(*)::int from private.store_no_reservations r where r.store_no=s.store_no) reservations
      from public.stores s join public.store_settings ss on ss.store_id=s.id
      join auth.users u on u.id=s.id join private.initial_seed_workflows w on w.store_id=s.id`)).rows;
    if (graph.length !== 1 || graph[0].store_no !== 1 || graph[0].name !== 'A' || graph[0].address !== ''
      || graph[0].email !== 'store1@store.pos.local' || graph[0].requested !== false
      || graph[0].status !== 'skipped' || graph[0].owners !== 1 || graph[0].stages !== 0
      || graph[0].bootstraps !== 1 || graph[0].reservations !== 1)
      throw new Error('PIN_ONBOARD_RECOVERY_GRAPH_REFUSED');
    const state = (await db.query(`select
      (select count(*)::int from auth.users) users,
      (select count(*)::int from public.stores) stores,
      (select count(*)::int from public.employees where store_id=$1) employees,
      (select count(*)::int from public.categories where store_id=$1) categories,
      (select count(*)::int from public.menu_items where store_id=$1) menu_items,
      (select count(*)::int from public.floor_areas where store_id=$1) areas,
      (select count(*)::int from public.tables where store_id=$1) tables,
      (select count(*)::int from private.employee_sessions where store_id=$1) sessions,
      (select count(*)::int from private.employee_admin_requests where store_id=$1) admin_requests,
      (select count(*)::int from public.employee_admin_audit where store_id=$1) admin_audit`, [graph[0].id])).rows[0];
    if (JSON.stringify(state) !== JSON.stringify({ users: 1, stores: 1, employees: 1,
      categories: 0, menu_items: 0, areas: 0, tables: 0, sessions: 0, admin_requests: 0, admin_audit: 0 }))
      throw new Error('PIN_ONBOARD_RECOVERY_SCOPE_REFUSED');
    const sequence = (await db.query(`select last_value::text,is_called from public.store_no_seq`)).rows[0];
    const start = (await db.query(`select start_value::text from pg_sequences
      where schemaname='public' and sequencename='store_no_seq'`)).rows;
    if (start.length !== 1 || start[0].start_value !== '1' || sequence.last_value !== '1' || !sequence.is_called)
      throw new Error('PIN_ONBOARD_RECOVERY_SEQUENCE_REFUSED');
    if (!apply) {
      await db.query('rollback');
      console.log(JSON.stringify({ status: 'SAFE_TO_CLEAN', project: env.project, stores: 1,
        authUsers: 1, demoEntities: 0, sequenceAtFirstAllocation: true }));
    } else {
      const id = graph[0].id;
      await db.query('delete from private.initial_receipt_print_grants where store_id=$1', [id]);
      await db.query('delete from private.menu_image_assets where store_id=$1', [id]);
      await db.query('delete from private.menu_image_uploads where store_id=$1', [id]);
      await db.query('delete from private.employee_sessions where store_id=$1', [id]);
      await db.query('delete from private.employee_admin_requests where store_id=$1', [id]);
      await db.query('delete from private.bootstrap_requests where store_id=$1', [id]);
      await db.query('delete from public.employee_admin_audit where store_id=$1', [id]);
      const removed = await db.query('delete from auth.users where id=$1 returning id', [id]);
      if (removed.rowCount !== 1) throw new Error('PIN_ONBOARD_RECOVERY_AUTH_DELETE_REFUSED');
      await db.query('delete from public.store_change_signals where store_id=$1', [id]);
      const reservation = await db.query('delete from private.store_no_reservations where store_no=1 returning store_no');
      if (reservation.rowCount !== 1) throw new Error('PIN_ONBOARD_RECOVERY_RESERVATION_DELETE_REFUSED');
      await db.query("select setval('public.store_no_seq',1,false)");
      const residual = (await db.query(`select
        (select count(*)::int from public.stores) stores,
        (select count(*)::int from auth.users) users,
        (select count(*)::int from private.store_no_reservations) reservations,
        (select count(*)::int from private.bootstrap_requests) bootstraps,
        (select count(*)::int from private.initial_seed_workflows) workflows,
        (select count(*)::int from private.initial_seed_stages) stages,
        (select count(*)::int from public.store_change_signals) signals`)).rows[0];
      if (Object.values(residual).some(value => value !== 0)) throw new Error('PIN_ONBOARD_RECOVERY_RESIDUAL_REFUSED');
      await db.query('commit');
      await assertPinOnboardTarget(db, env);
      console.log(JSON.stringify({ status: 'RECOVERED', project: env.project, fixtureCountsZero: true }));
    }
  } catch (error) {
    await db.query('rollback').catch(() => undefined);
    throw error;
  }
} finally { await db.end(); }
