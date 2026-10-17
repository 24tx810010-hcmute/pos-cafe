import { afterAll, beforeAll, expect, test } from 'vitest';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { parseBridgeEnvironment, runtimeProof, STORE_IDS } from '../../scripts/permission-identity-runtime.mjs';

const env = parseBridgeEnvironment();
const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 15000 });

beforeAll(async () => {
  runtimeProof();
  await db.connect();
  const marker = (await db.query('select marker,store_ids from private.idempotency_test_environment where singleton')).rows[0];
  const gate = (await db.query('select strict,contract_version from private.permission_contract_gate where singleton')).rows[0];
  const identities = (await db.query('select id from public.stores order by id')).rows.map(row => row.id);
  if (marker?.marker !== env.marker || JSON.stringify(marker.store_ids) !== JSON.stringify(STORE_IDS) ||
    JSON.stringify(identities) !== JSON.stringify(STORE_IDS) || !gate?.strict || gate.contract_version !== 2) {
    throw new Error('CANDIDATE_SIGNAL_FIXTURE_REFUSED');
  }
});
afterAll(async () => { await db.end(); });

async function subscribe(storeId: string, received: unknown[]) {
  const client = createClient(env.api, env.anonKey, {
    accessToken: async () => env.storeJwt,
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  await client.realtime.setAuth(env.storeJwt);
  const channel = client.channel(`candidate-signal-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'store_change_signals', filter: `store_id=eq.${storeId}` }, payload => received.push(payload.new));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SIGNAL_SUBSCRIBE_TIMEOUT')), 10_000);
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error('SIGNAL_SUBSCRIBE_FAILED')); }
    });
  });
  return async () => { await client.removeChannel(channel); };
}

async function waitFor(check: () => boolean, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  throw new Error('SIGNAL_EVENT_TIMEOUT');
}

test('candidate signal publication, tenant RLS, and real two-client delivery', async () => {
  const publication = (await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by tablename")).rows.map(row => row.tablename);
  expect(publication).toEqual(['permission_catalog_signals', 'store_change_signals']);
  const grants = (await db.query("select table_name,privilege_type from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and table_name in ('store_change_signals','permission_catalog_signals') order by table_name,privilege_type")).rows;
  expect(grants).toEqual([
    { table_name: 'permission_catalog_signals', privilege_type: 'SELECT' },
    { table_name: 'store_change_signals', privilege_type: 'SELECT' },
  ]);
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: STORE_IDS[1], role: 'authenticated' })]);
    expect(Number((await db.query('select count(*) n from public.store_change_signals where store_id=$1', [STORE_IDS[0]])).rows[0].n)).toBe(0);
  } finally { await db.query('rollback'); }

  const category = (await db.query('select id,name from public.categories where store_id=$1 order by id limit 1', [STORE_IDS[0]])).rows[0];
  expect(category).toBeTruthy();
  const received: unknown[] = [], peer: unknown[] = [], crossTenant: unknown[] = [];
  const stops = [await subscribe(STORE_IDS[0], received), await subscribe(STORE_IDS[0], peer), await subscribe(STORE_IDS[1], crossTenant)];
  try {
    await db.query('update public.categories set name=$2 where id=$1', [category.id, `${category.name} candidate-signal`]);
    await waitFor(() => received.length > 0 && peer.length > 0);
    expect(Object.keys(received[0] as object).sort()).toEqual(['event_id', 'revision', 'store_id', 'target_id', 'topic']);
    expect(received[0]).toMatchObject({ store_id: STORE_IDS[0], topic: 'menu', target_id: null });
    expect(peer[0]).toEqual(received[0]);
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(crossTenant).toEqual([]);
  } finally {
    await db.query('update public.categories set name=$2 where id=$1', [category.id, category.name]);
    await Promise.all(stops.map(stop => stop()));
  }
});

test('candidate rolled-back update emits no committed signal', async () => {
  const before = Number((await db.query("select revision from public.store_change_signals where store_id=$1 and topic='menu'", [STORE_IDS[0]])).rows[0].revision);
  await db.query('begin');
  try {
    await db.query("update public.categories set name=name||' rolled-back' where store_id=$1", [STORE_IDS[0]]);
  } finally { await db.query('rollback'); }
  const after = Number((await db.query("select revision from public.store_change_signals where store_id=$1 and topic='menu'", [STORE_IDS[0]])).rows[0].revision);
  expect(after).toBe(before);
});

test('candidate catalog signal advances without employee revision change', async () => {
  const before = (await db.query('select id,permission_revision from public.employees order by id')).rows;
  const oldRevision = Number((await db.query('select revision from public.permission_catalog_state where singleton')).rows[0].revision);
  const existing = (await db.query("select exists(select from public.role_permission_defaults where role_code='cashier' and permission_code='order.create') present")).rows[0].present;
  expect(existing).toBe(true);
  await db.query('begin');
  try {
    await db.query("delete from public.role_permission_defaults where role_code='cashier' and permission_code='order.create'");
    await db.query("insert into public.role_permission_defaults(role_code,permission_code) values('cashier','order.create')");
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
  const signal = (await db.query('select revision,event_id from public.permission_catalog_signals where singleton')).rows[0];
  expect(Number(signal.revision)).toBeGreaterThan(oldRevision);
  expect(signal.event_id).toMatch(/^[0-9a-f-]{36}$/);
  expect((await db.query('select id,permission_revision from public.employees order by id')).rows).toEqual(before);
});
