import { afterAll, afterEach, expect, test } from 'vitest';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ContractHarness, businessOnly } from './harness.ts';
import { ids, createPayload, payPayload, splitPayload, updatePayload, voidPayload } from './fixtures.ts';

const h = new ContractHarness();
const cleanups = new Set<() => Promise<unknown>>();
function registerCleanup(cleanup: () => Promise<unknown>) {
  const run = async () => { await cleanup(); cleanups.delete(run); };
  cleanups.add(run);
  return run;
}
afterEach(async () => { for (const cleanup of [...cleanups].reverse()) await cleanup(); });
afterAll(() => h.clock(null));
const gateKey = 932680117;

async function gate() {
  const db = new pg.Client({ connectionString: h.env.observerDsn, application_name: 'idem-fault-barrier' });
  await db.connect();
  await db.query('begin');
  await db.query('select pg_advisory_xact_lock($1::bigint)', [gateKey]);
  const pid = (await db.query('select pg_backend_pid() pid')).rows[0].pid as number;
  const release = registerCleanup(async () => { await db.query('commit'); await db.end(); });
  return { pid, release };
}

async function trigger(table: string, event: string, when: string, body: string) {
  if (!['orders', 'order_items', 'order_item_options', 'payments', 'tables', 'write_operations'].includes(table)) throw new Error('UNSAFE_TEST_HOOK_TABLE');
  await h.observer(async db => {
    await h.assertIsolation(db);
    await db.query(`create or replace function private.idem_fault_hook() returns trigger language plpgsql set search_path=pg_catalog as $$begin ${body}; return new; end$$;
      revoke all on function private.idem_fault_hook() from public,anon,authenticated;
      create trigger idem_fault_hook after ${event} on public.${table} for each row ${when ? `when (${when})` : ''} execute function private.idem_fault_hook()`);
  });
  return registerCleanup(async () => h.observer(async db => {
    await db.query(`drop trigger if exists idem_fault_hook on public.${table}; drop function if exists private.idem_fault_hook()`);
  }));
}

async function validationGate() {
  const original = await h.observer(async db => {
    await h.assertIsolation(db);
    return (await db.query("select pg_get_functiondef('private.prepare_write(jsonb)'::regprocedure) body")).rows[0].body as string;
  });
  const anchor = " return jsonb_build_object('newLines',prepared";
  expect(original).toContain(anchor);
  await h.observer(db => db.query(original.replace(anchor, ` perform pg_advisory_xact_lock(${gateKey}::bigint);\n${anchor}`)));
  return registerCleanup(async () => h.observer(db => db.query(original)));
}

for (const variant of ['validation_k_expiry', 'validation_session_expiry']) {
  test(`TC-IDEM-062/db/${variant} checks the clock after proven validation wait`, async () => {
    await h.reset('F1');
    let token = await h.login();
    const payload = payPayload();
    await h.register(payload, token);
    if (variant === 'validation_k_expiry') {
      await h.clock('2026-09-08T20:00:00.000Z');
      token = await h.login();
    }
    await h.clock(variant === 'validation_k_expiry' ? '2026-09-08T23:59:59.999Z' : '2026-09-08T11:59:59.999Z');
    const before = await h.snapshot();
    const restore = await validationGate();
    const blocker = await gate();
    const pending = h.execute(payload, token).then(value => ({ value }), error => ({ error }));
    try {
      const worker = await h.waitForDatabaseWait(blocker.pid);
      expect(worker.pid).not.toBe(blocker.pid);
      await h.clock(variant === 'validation_k_expiry' ? '2026-09-09T00:00:00.001Z' : '2026-09-08T12:00:00.001Z');
    } finally { await blocker.release(); }
    try {
      const result = await pending;
      if (variant === 'validation_k_expiry') expect(result).toMatchObject({ value: { status: 'expired' } });
      else expect(result).toMatchObject({ error: { code: 'EMPLOYEE_SESSION_REQUIRED' } });
      const after = await h.snapshot(`TC-IDEM-062-${variant}`);
      expect(businessOnly(after)).toEqual(businessOnly(before));
      expect(after.write_operations[0].status).toBe(variant === 'validation_k_expiry' ? 'expired' : 'pending');
    } finally { await restore(); }
  });
}

test('TC-IDEM-064/db real DB clock passes expiry while transaction timestamp stays before it', async () => {
  await h.reset('F1'); await h.clock(null);
  const token = await h.login(); const payload = payPayload(); await h.register(payload, token);
  await h.observer(async db => {
    await db.query('begin');
    try {
      await db.query('alter table public.write_operations disable trigger write_operations_immutable');
      await db.query("with cutoff as(select clock_timestamp()+interval '1200 milliseconds' as expires) update public.write_operations set registered_at=cutoff.expires-interval '24 hours',expires_at=cutoff.expires from cutoff where operation_id=$1", [ids.K1]);
      await db.query('alter table public.write_operations enable trigger write_operations_immutable'); await db.query('commit');
    } catch (error) { await db.query('rollback'); throw error; }
  });
  const blocker = new pg.Client({ connectionString: h.env.observerDsn }); await blocker.connect(); await blocker.query('begin');
  const release = registerCleanup(async () => { await blocker.query('commit'); await blocker.end(); });
  await blocker.query('select 1 from public.orders where id=$1 for update', [ids.O1]);
  const blockerPid = (await blocker.query('select pg_backend_pid() pid')).rows[0].pid;
  const before = await h.snapshot(); const pending = h.execute(payload, token);
  try {
    const worker = await h.waitForDatabaseWait(blockerPid);
    const startedBefore = await h.observer(async db => (await db.query('select a.xact_start<w.expires_at before_expiry from pg_stat_activity a cross join public.write_operations w where a.pid=$1 and w.operation_id=$2', [worker.pid, ids.K1])).rows[0].before_expiry);
    expect(startedBefore).toBe(true);
    const deadline = Date.now() + 5000;
    while (true) {
      if (await h.observer(async db => (await db.query('select clock_timestamp()>expires_at crossed from public.write_operations where operation_id=$1', [ids.K1])).rows[0].crossed)) break;
      if (Date.now() > deadline) throw new Error('REAL_CLOCK_DID_NOT_CROSS_EXPIRY');
      await new Promise(done => setTimeout(done, 20));
    }
  } finally { await release(); }
  expect((await pending).status).toBe('expired');
  expect(businessOnly(await h.snapshot('TC-IDEM-064-after'))).toEqual(businessOnly(before));
});

test('TC-IDEM-065/db first effect before expiry commits after expiry and waiting cancel returns applied', async () => {
  await h.reset('F1'); let token = await h.login(); const payload = payPayload(); await h.register(payload, token);
  await h.clock('2026-09-08T20:00:00Z'); token = await h.login(); await h.clock('2026-09-08T23:59:59.999Z');
  const remove = await trigger('payments', 'insert', '', `perform pg_advisory_xact_lock(${gateKey}::bigint)`);
  const blocker = await gate(); const pending = h.execute(payload, token); let cancel: Promise<any> | undefined;
  try {
    const worker = await h.waitForDatabaseWait(blocker.pid);
    const beforeCommit = await h.snapshot(); expect(beforeCommit.payments).toHaveLength(0); expect(beforeCommit.write_operations[0].status).toBe('pending');
    await h.clock('2026-09-09T00:00:00.001Z'); cancel = h.cancel(token);
    expect((await h.waitForDatabaseWait(worker.pid)).pid).not.toBe(worker.pid);
  } finally { await blocker.release(); }
  try {
    const [result, cancelled] = await Promise.all([pending, cancel!]); expect(result.status).toBe('applied'); expect(cancelled.status).toBe('applied');
    expect(result.result.payment.amount).toBe(150000); expect(result.decidedAt).toBe('2026-09-08T23:59:59.999+00:00');
    expect((await h.snapshot('TC-IDEM-065-after')).payments).toHaveLength(1);
  } finally { await remove(); }
});

type FaultCase = { fixture: 'F0' | 'F1' | 'F2' | 'F4' | 'F5' | 'F7'; payload: () => any; table: string; event: string; when: string; amount?: number };
const faults: Record<string, FaultCase> = {
  submit_removed: { fixture: 'F2', payload: () => ({ ...updatePayload(), retainedLines: [{ sourceItemId: ids.L30, quantity: 0 }, { sourceItemId: ids.L35, quantity: 1 }] }), table: 'order_items', event: 'update', when: "new.status='removed' and old.status<>'removed'" },
  submit_option: { fixture: 'F0', payload: () => { const p: any = createPayload(); p.newLines[0].options = [{ id: ids.OPTION1, optionValueId: ids.Q, quantity: 2, quotedPriceDelta: 5000 }]; return p; }, table: 'order_item_options', event: 'insert', when: '' },
  split_number: { fixture: 'F1', payload: splitPayload, table: 'orders', event: 'update', when: 'new.order_no<>old.order_no', amount: 30000 },
  split_move: { fixture: 'F2', payload: () => ({ ...splitPayload(), lines: [{ orderItemId: ids.L30, quantity: 1, splitItemId: ids.L2 }] }), table: 'order_items', event: 'update', when: 'new.order_id<>old.order_id', amount: 30000 },
  split_copy_option: { fixture: 'F7', payload: splitPayload, table: 'order_item_options', event: 'insert', when: '', amount: 40000 },
  split_payment: { fixture: 'F1', payload: splitPayload, table: 'payments', event: 'insert', when: '', amount: 30000 },
  pay_payment: { fixture: 'F1', payload: payPayload, table: 'payments', event: 'insert', when: '', amount: 150000 },
  pay_order: { fixture: 'F1', payload: payPayload, table: 'orders', event: 'update', when: "new.status='paid' and old.status='open'", amount: 150000 },
  pay_table: { fixture: 'F1', payload: payPayload, table: 'tables', event: 'update', when: "new.status='empty' and old.status='occupied'", amount: 150000 },
  void_order: { fixture: 'F4', payload: voidPayload, table: 'orders', event: 'update', when: "new.status='void' and old.status='paid'" },
};

for (const [point, fixture] of Object.entries(faults)) {
  test(`TC-IDEM-069/db/point=${point} rolls every financial row back and permits exactly one manual retry`, async () => {
    await h.reset(fixture.fixture); const token = await h.login(); const payload = fixture.payload(); await h.register(payload, token);
    const before = await h.snapshot(); const remove = await trigger(fixture.table, fixture.event, fixture.when, "raise exception 'ISOLATED_INFRA_FAULT' using errcode='XX000'");
    try { await expect(h.execute(payload, token)).rejects.toMatchObject({ code: 'ISOLATED_INFRA_FAULT' }); }
    finally { await remove(); }
    const failed = await h.snapshot(`TC-IDEM-069-${point}-rollback`); expect(failed).toEqual(before); expect((await h.get(token)).status).toBe('pending');
    const applied = await h.execute(payload, token); expect(applied.status).toBe('applied');
    const after = await h.snapshot(`TC-IDEM-069-${point}-retry`); expect(after.order_events).toHaveLength(1);
    expect(after.payments).toHaveLength(fixture.fixture === 'F4' || fixture.amount ? 1 : 0);
    if (fixture.amount) expect(applied.result.payment.amount).toBe(fixture.amount);
    else expect(applied.result.order.total).toBe(point === 'submit_removed' ? 35000 : point === 'submit_option' ? 80000 : 150000);
  });
}

for (const kind of ['pay', 'split']) {
  test(`TC-IDEM-070/db/kind=${kind} cannot commit an applied result when the request rolls back`, async () => {
    await h.reset('F1'); const token = await h.login(); const payload = kind === 'pay' ? payPayload() : splitPayload(); await h.register(payload, token);
    const before = await h.snapshot(); const remove = await trigger('write_operations', 'update', "new.status='applied' and old.status='pending'", "raise exception 'ISOLATED_RESULT_FAULT' using errcode='XX000'");
    try { await expect(h.execute(payload, token)).rejects.toMatchObject({ code: 'ISOLATED_RESULT_FAULT' }); } finally { await remove(); }
    expect(await h.snapshot(`TC-IDEM-070-${kind}-rollback`)).toEqual(before);
    expect((await h.execute(payload, token)).status).toBe('applied'); const after = await h.snapshot(); expect(after.payments).toHaveLength(1); expect(after.payments[0].amount).toBe(kind === 'pay' ? 150000 : 30000); expect(after.order_events).toHaveLength(1);
  });
}

test('TC-IDEM-071/db late known failure rolls back changed items but commits immutable rejection outside the subtransaction', async () => {
  await h.reset('F5'); const token = await h.login();
  const payload = { ...updatePayload(), retainedLines: [{ sourceItemId: ids.L1, quantity: 1, note: 'ít đá' }] };
  await h.register(payload, token); const before = await h.snapshot();
  const remove = await trigger('order_items', 'update', 'new.quantity<>old.quantity', "perform private.reject_write('OPTION_VALUE_UNAVAILABLE')");
  let first: any;
  try { first = await h.execute(payload, token); expect(first).toMatchObject({ status: 'rejected', error: { code: 'OPTION_VALUE_UNAVAILABLE' } }); }
  finally { await remove(); }
  expect(businessOnly(await h.snapshot('TC-IDEM-071-rejected'))).toEqual(businessOnly(before));
  expect((await h.execute(payload, token)).error).toEqual(first.error); expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
  await h.register(payload, token, ids.Knew); expect((await h.execute(payload, token, ids.Knew)).result.order.total).toBe(30000);
});

test('TC-IDEM-072/db deadlock serialization and terminated backend leave pending K recoverable', async () => {
  for (const disposition of ['40P01', '40001', 'connection_abort']) {
    await h.reset('F1'); const token = await h.login(); const payload = payPayload(); await h.register(payload, token); const before = await h.snapshot();
    if (disposition === 'connection_abort') {
      const remove = await trigger('payments', 'insert', '', `perform pg_advisory_xact_lock(${gateKey}::bigint)`); const blocker = await gate();
      const pending = h.execute(payload, token).then(() => false, () => true);
      try { const worker = await h.waitForDatabaseWait(blocker.pid); expect(await h.observer(async db => (await db.query('select pg_terminate_backend($1) terminated', [worker.pid])).rows[0].terminated)).toBe(true); }
      finally { await blocker.release(); }
      try { expect(await pending).toBe(true); } finally { await remove(); }
    } else {
      const remove = await trigger('payments', 'insert', '', `raise exception 'ISOLATED_DISPOSITION' using errcode='${disposition}'`);
      try { await expect(h.execute(payload, token)).rejects.toMatchObject({ code: 'ISOLATED_DISPOSITION' }); } finally { await remove(); }
    }
    expect(await h.snapshot(`TC-IDEM-072-${disposition}`)).toEqual(before); expect((await h.get(token)).status).toBe('pending');
    expect((await h.execute(payload, token)).status).toBe('applied'); expect((await h.snapshot()).payments).toHaveLength(1);
  }
});

test('TC-IDEM-073/db two terminal replays increment exactly twice while all read denied mismatch rollback requests keep R1 unchanged', async () => {
  for (const terminal of ['applied', 'rejected', 'cancelled', 'expired']) {
    await h.reset('F1'); let token = await h.login(); let deniedToken = await h.login('C');
    const payload = terminal === 'rejected' ? { ...payPayload(), receivedAmount: 1 } : payPayload(); await h.register(payload, token);
    let first: any;
    if (terminal === 'cancelled') first = await h.cancel(token);
    else if (terminal === 'expired') { await h.clock('2026-09-09T00:00:00Z'); token = await h.login(); deniedToken = await h.login('C'); first = await h.get(token); }
    else first = await h.execute(payload, token);
    expect(first.status).toBe(terminal); expect(first.replayCount).toBe('0'); const before = await h.snapshot();
    const blocker = await gate();
    const remove = await trigger('write_operations', 'update', 'new.replay_count<>old.replay_count', `perform pg_advisory_xact_lock(${gateKey}::bigint)`);
    const left = h.execute(payload, token); let right: Promise<any> | undefined;
    try { const firstWorker = await h.waitForDatabaseWait(blocker.pid); right = h.execute(payload, token); const secondWorker = await h.waitForDatabaseWait(firstWorker.pid); expect(secondWorker.pid).not.toBe(firstWorker.pid); }
    finally { await blocker.release(); }
    try { const results = await Promise.all([left, right!]); expect(results.map(result => result.replayCount).sort()).toEqual(['1', '2']); for (const result of results) expect({ ...result, replayCount: '0' }).toEqual(first); }
    finally { await remove(); }
    await h.register(payload, token); await h.get(token); await h.cancel(token); await h.rpc('list_write_operations', {}, token);
    await expect(h.execute({ ...payload, receivedAmount: payload.receivedAmount + 1 }, token)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await expect(h.execute(payload, deniedToken)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const failReplay = await trigger('write_operations', 'update', 'new.replay_count<>old.replay_count', "raise exception 'ISOLATED_REPLAY_FAULT' using errcode='XX000'");
    try { await expect(h.execute(payload, token)).rejects.toMatchObject({ code: 'ISOLATED_REPLAY_FAULT' }); } finally { await failReplay(); }
    const after = await h.snapshot(`TC-IDEM-073-${terminal}`); expect(businessOnly(after)).toEqual(businessOnly(before));
    expect(after.write_operations).toEqual(before.write_operations.map(row => ({ ...row, replay_count: 2 })));
  }
});

test('TC-IDEM-085/db migrates literal legacy snapshots without repricing and rejects schema shadowing', async () => {
  await h.reset('F1'); const token = await h.login();
  const inventory = await h.observer(async db => {
    await h.assertIsolation(db);
    const functions = (await db.query("select p.proname,p.oid::regprocedure::text signature,p.prosecdef,p.proconfig,has_function_privilege('authenticated',p.oid,'execute') callable,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private') order by signature")).rows;
    const paths = functions.filter(f => f.prosecdef && f.callable && f.proname !== 'get_next_store_no');
    expect(paths.length).toBeGreaterThanOrEqual(14); for (const f of paths) expect(f.proconfig, f.signature).toContain('search_path=pg_catalog');
    const old = functions.filter(f => ['submit_order_changes','pay_order','pay_order_items','void_order','verify_employee_pin','hash_employee_pin'].includes(f.proname)); expect(old).toHaveLength(7); expect(old.every(f => !f.callable)).toBe(true);
    expect(functions.filter(f => f.nspname === 'private' && f.callable).map(f => f.proname)).toEqual(['is_verified_admin']);
    return functions;
  });
  expect(inventory.some(f => f.proname === 'execute_write_operation')).toBe(true);
  // Authenticated SQL caller controls its own search_path but cannot replace the
  // schema-qualified permission check or invoke a private financial helper.
  const denied = await h.login('C');
  await h.observer(async db => {
    await db.query('create schema if not exists idem_shadow authorization authenticated');
    await db.query('begin');
    try {
      await db.query('set local role authenticated'); await db.query("set local search_path=idem_shadow,public");
      await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.headers',$2,true)", [JSON.stringify({ sub: ids.S1 }), JSON.stringify({ 'x-pos-employee-token': denied })]);
      await db.query('create or replace function idem_shadow.has_employee_permission(public.employee_role,jsonb,text) returns boolean language sql as $$select true$$');
      const result = (await db.query('select public.register_write_operation($1,$2) result', [ids.K1,payPayload()])).rows[0].result; expect(result.error.code).toBe('FORBIDDEN');
    } finally { await db.query('rollback'); await db.query('drop schema idem_shadow cascade'); }
  });
  await h.register(payPayload(),token); expect((await h.execute(payPayload(),token)).status).toBe('applied');
  // Fresh isolated database applies the actual 001..013 baseline BEFORE inserting
  // legacy prices, then applies candidate 014..016 and compares every old column.
  const url = new URL(h.env.observerDsn); const database = `pos_cafe_idem_test_migration_${randomBytes(6).toString('hex')}`; url.pathname = '/postgres';
  const master = new pg.Client({connectionString:url.toString()}); await master.connect(); await master.query(`create database ${database}`); url.pathname=`/${database}`;
  const db = new pg.Client({connectionString:url.toString()}); await db.connect();
  try {
    await db.query(`create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
      grant usage on schema auth,public to anon,authenticated;alter default privileges in schema public grant all on tables to authenticated;alter default privileges in schema public grant all on sequences to authenticated`);
    const migrations = readdirSync(resolve('supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
    for (const name of migrations.filter(name => Number(name.slice(0,3)) <= 13)) await db.query(readFileSync(resolve('supabase/migrations',name),'utf8'));
    await db.query("insert into auth.users values($1,'legacy@invalid.local')",[ids.S1]);
    await db.query('insert into stores(id,store_no) values($1,1)',[ids.S1]);
    await db.query('insert into store_settings(store_id) values($1)',[ids.S1]);
    await db.query("insert into employees(id,store_id,name,role,passcode_hash) values($1,$2,'A','admin',extensions.crypt('123456',extensions.gen_salt('bf')))",[ids.A,ids.S1]);
    await db.query("insert into categories(id,store_id,name) values($1,$2,'Legacy')",[ids.CATEGORY,ids.S1]);
    await db.query("insert into menu_items(id,store_id,category_id,name,price) values($1,$2,$3,'Current catalog',40000)",[ids.M_A,ids.S1,ids.CATEGORY]);
    await db.query("insert into orders(id,store_id,order_type,order_no,business_date,status,subtotal,total,employee_id) values($1,$2,'takeaway',12,'2026-09-08','open',60000,60000,$3)",[ids.O1,ids.S1,ids.A]);
    await db.query("insert into order_items(id,store_id,order_id,menu_item_id,item_name,quantity,unit_price) values($1,$2,$3,$4,'Legacy name',2,30000)",[ids.L1,ids.S1,ids.O1,ids.M_A]);
    const before = (await db.query('select to_jsonb(o) o,to_jsonb(i) i from orders o join order_items i on i.order_id=o.id')).rows[0];
    for (const name of migrations.filter(name => Number(name.slice(0,3)) >= 14)) await db.query(readFileSync(resolve('supabase/migrations',name),'utf8'));
    const after = (await db.query("select to_jsonb(o)-array['created_by_employee_id','last_modified_by_employee_id'] o,to_jsonb(i) i,o.created_by_employee_id creator,o.last_modified_by_employee_id editor from orders o join order_items i on i.order_id=o.id")).rows[0];
    expect({o:after.o,i:after.i}).toEqual(before); expect(after.creator).toBeNull(); expect(after.editor).toBeNull(); expect(after.i.unit_price).toBe(30000); expect(after.o.total).toBe(60000);
  } finally { await db.end(); await master.query(`drop database ${database}`); await master.end(); }
});
