import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import pg from 'pg';
import { migrationChecksums } from '../tests/contracts/observerPreflight.ts';
import { deterministicUuid } from '../src/adapters/supabase/deterministicId.ts';
import { collectInventory } from './permission-inventory.mjs';
import { captureSnapshot } from './permission-preflight-core.mjs';

// Setup-only SQL runs before the observer baseline. These are existing phase-27
// tables, with no calls to login/write RPCs and no plaintext session credentials.
export async function seedLegacyFixture(db, storeIds, employeeIds) {
  for (const [index, storeId] of storeIds.entries()) {
    const employeeId = employeeIds[index === 0 ? 0 : 3];
    const names = ['category', 'menu', 'area', 'table', 'paid-order', 'open-order', 'payment', 'paid-item', 'open-item', 'operation', 'event'];
    const ids = Object.fromEntries(await Promise.all(names.map(async name => [name, await deterministicUuid(storeId, `permission-fixture.${name}`)])));
    await db.query('insert into public.categories(id,store_id,name) values($1,$2,$3)', [ids.category, storeId, 'Fixture drinks']);
    await db.query('insert into public.menu_items(id,store_id,category_id,name,price) values($1,$2,$3,$4,30000)',
      [ids.menu, storeId, ids.category, 'Fixture coffee']);
    await db.query('insert into public.floor_areas(id,store_id,name) values($1,$2,$3)', [ids.area, storeId, 'Fixture floor']);
    await db.query(`insert into public.tables(id,store_id,area_id,name,pos_x,pos_y,width,height,shape,status)
      values($1,$2,$3,'Fixture table',0,0,80,80,'square','occupied')`, [ids.table, storeId, ids.area]);
    await db.query(`insert into public.orders(id,store_id,table_id,order_type,order_no,business_date,status,
      subtotal,total,employee_id,created_by_employee_id,last_modified_by_employee_id,lock_version,paid_at)
      values($1,$3,null,'takeaway',1,'2026-09-01','paid',30000,30000,$5,$5,$5,1,'2026-09-01T02:00:00Z'),
      ($2,$3,$4,'dine_in',2,'2026-09-01','open',30000,30000,$5,$5,$5,0,null)`,
    [ids['paid-order'], ids['open-order'], storeId, ids.table, employeeId]);
    await db.query(`insert into public.payments(id,store_id,order_id,employee_id,method,amount,received_amount,change_amount,paid_at)
      values($1,$2,$3,$4,'cash',30000,50000,20000,'2026-09-01T02:00:00Z')`,
    [ids.payment, storeId, ids['paid-order'], employeeId]);
    await db.query(`insert into public.order_items(id,store_id,order_id,menu_item_id,item_name,quantity,unit_price,status)
      values($1,$3,$4,$6,'Fixture coffee',1,30000,'done'),($2,$3,$5,$6,'Fixture coffee',1,30000,'waiting')`,
    [ids['paid-item'], ids['open-item'], storeId, ids['paid-order'], ids['open-order'], ids.menu]);
    await db.query('update public.payments set receipt_snapshot=private.receipt_snapshot($1,$2) where store_id=$1 and id=$2', [storeId, ids.payment]);
    await db.query(`insert into public.write_operations(store_id,operation_id,schema_version,kind,required_permission,payload,
      registered_at,expires_at,initiated_by_employee_id,status,result,executed_by_employee_id,decided_at)
      values($1,$2,1,'pay_order','payment.take',jsonb_build_object('schemaVersion',1,'kind','pay_order','orderId',$3::uuid::text,
        'expectedVersion',0,'paymentId',$4::uuid::text,'method','cash','receivedAmount',50000),
      '2026-09-01T01:59:00Z','2026-09-02T01:59:00Z',$5,'applied',
      jsonb_build_object('kind','pay_order','order',private.order_snapshot($1,$3),'payment',private.payment_snapshot($1,$4),
        'receipt',private.receipt_snapshot($1,$4)),$5,'2026-09-01T02:00:00Z')`,
    [storeId, ids.operation, ids['paid-order'], ids.payment, employeeId]);
    await db.query(`insert into public.order_events(id,store_id,operation_id,action,source_order_id,result_order_id,payment_id,
      initiated_by,executed_by,occurred_at,before_version,after_version,summary)
      values($1,$2,$3,'pay_order',$4,$4,$5,$6,$6,'2026-09-01T02:00:00Z',0,1,
        jsonb_build_object('amount',30000,'fixture',true))`,
    [ids.event, storeId, ids.operation, ids['paid-order'], ids.payment, employeeId]);
  }
  await db.query(`insert into private.employee_sessions(token_hash,store_id,employee_id,issued_at,expires_at)
    select extensions.digest(extensions.gen_random_bytes(32),'sha256'),store_id,id,
      '2026-09-01T00:00:00Z'::timestamptz,'2026-09-01T12:00:00Z'::timestamptz from public.employees`);
}

// Fixture setup is deliberately separate from the read-only tool and never accepts a live target.
export async function bootstrapFixture({ adminDsn, expectedDataDirectory, runtimeDirectory }) {
  let url;
  try { url = new URL(adminDsn); } catch { throw new Error('INVALID_FIXTURE_ADMIN_DSN'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.pathname !== '/postgres' || url.search || url.hash
    || !/^\/var\/tmp\/pos-cafe-perm-t01-[a-z0-9-]+$/.test(expectedDataDirectory?.replace(/\/data$/, '') ?? '')) throw new Error('ISOLATED_FIXTURE_REQUIRED');
  const admin = new pg.Client({ connectionString: adminDsn, connectionTimeoutMillis: 5000 });
  const database = `pos_cafe_idem_test_perm_${randomBytes(6).toString('hex')}`;
  const marker = `pos-cafe-perm-${randomBytes(20).toString('hex')}`;
  await admin.connect();
  try {
    const actual = (await admin.query('show data_directory')).rows[0].data_directory;
    if (actual !== expectedDataDirectory) throw new Error('FIXTURE_CLUSTER_MISMATCH');
    await admin.query(`create database ${database}`);
  } finally { await admin.end(); }
  url.pathname = '/' + database;
  const setupDsn = url.href;
  const db = new pg.Client({ connectionString: setupDsn });
  await db.connect();
  try {
    // Same minimal Auth/Storage catalog prerequisites as phase-27 native bootstrap.
    // These tables do not claim that Auth/REST/Storage services are running.
    await db.query(`do $$ begin
      if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
      if not exists(select from pg_roles where rolname='perm_observer') then create role perm_observer login noinherit; end if;
    end $$;
    alter role perm_observer bypassrls;
    alter role perm_observer set default_transaction_read_only=on;
    create schema auth;
    create table auth.users(id uuid primary key,email text,aud text default 'authenticated',role text default 'authenticated');
    create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to authenticated,service_role;
    alter default privileges in schema public grant all on sequences to authenticated,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,bucket_id text references storage.buckets(id),name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    grant usage on schema storage to anon,authenticated;
    grant all on storage.objects to authenticated;
    create schema private;
    revoke all on schema private from public,anon,authenticated;`);
    const checksums = migrationChecksums(process.cwd(), 16);
    for (const name of Object.keys(checksums)) await db.query(readFileSync(resolve('supabase/migrations', name), 'utf8'));
    const storeIds = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'];
    await db.query(`create table private.idempotency_test_environment(singleton boolean primary key default true check(singleton),
      marker text not null,engine text not null,migration_checksums jsonb not null,store_ids uuid[] not null);
      revoke all on private.idempotency_test_environment from public,anon,authenticated`);
    await db.query('insert into private.idempotency_test_environment values(true,$1,$2,$3,$4)', [marker, 'postgres-observer', checksums, storeIds]);
    for (const [index, id] of storeIds.entries()) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [id, `synthetic-${index}@invalid.local`]);
      await db.query('insert into public.stores(id,store_no,name) values($1,$2,$3)', [id, index + 1, 'Synthetic fixture']);
      await db.query('insert into public.store_settings(store_id,display_name) values($1,$2)', [id, 'Synthetic fixture']);
    }
    const primary = await deterministicUuid(storeIds[0], 'admin.primary');
    const employeeIds = [primary, '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005'];
    for (const [i, id] of employeeIds.entries()) {
      await db.query(`insert into public.employees(id,store_id,name,role,is_active,created_at,passcode_hash,permission_overrides)
        values($1,$2,$3,$4,$5,$6,extensions.crypt(encode(extensions.gen_random_bytes(32),'hex'),extensions.gen_salt('bf')),$7)`,
      [id, storeIds[i < 3 ? 0 : 1], 'Fixture employee', i === 2 ? 'cashier' : 'admin', true,
        i === 4 ? '2026-08-02T00:00:00Z' : '2026-08-01T00:00:00Z', null]);
    }
    await seedLegacyFixture(db, storeIds, employeeIds);
    await db.query(`grant connect on database ${database} to perm_observer;
      grant usage on schema public,private,auth,storage to perm_observer;
      grant select on all tables in schema public,private,auth,storage to perm_observer;`);
    const catalogHash = (await collectInventory(db)).catalogHash;
    const snapshotHash = (await captureSnapshot(db)).hash;
    const directory = resolve(runtimeDirectory);
    mkdirSync(directory, { recursive: true });
    url.username = 'perm_observer'; url.password = '';
    writeFileSync(join(directory, 'observer.env'), [
      'PERM_TEST_PROFILE=legacy-observer-v1', `IDEM_OBSERVER_DSN=${url.href}`, `IDEM_TEST_MARKER=${marker}`,
      `IDEM_FIXTURE_STORE_IDS=${storeIds.join(',')}`, 'IDEM_TEST_ENGINE=postgres-observer',
      `PERM_EXPECTED_CATALOG_HASH=${catalogHash}`, `PERM_BACKEND_REF=synthetic:${database}`,
    ].join('\n') + '\n', { mode: 0o600 });
    writeFileSync(join(directory, 'primary-mapping.json'), JSON.stringify({ schemaVersion: 1, storeId: storeIds[0], ownerId: primary,
      verifiedByRef: 'synthetic:fixture-bootstrap', evidenceRefs: ['synthetic:primary-provenance'], sourceSnapshotHash: snapshotHash }, null, 2) + '\n');
    // Administrative connection is fixture-only input for the test runner, never part of report artifacts.
    writeFileSync(join(directory, 'fixture-control.json'), JSON.stringify({ setupDsn, expectedDataDirectory, storeIds, employeeIds }, null, 2), { mode: 0o600 });
    return { database, engine: 'postgres-observer', fixtureIds: storeIds, catalogHash, envFile: join(directory, 'observer.env') };
  } finally { await db.end(); }
}
