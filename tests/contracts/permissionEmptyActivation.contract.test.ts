import { afterAll, beforeAll, expect, test } from 'vitest';
import pg from 'pg';
import { activateDatabase } from '../../scripts/permission-activate.mjs';
import {
  EMPTY_TARGET_RELATIONS,
  activationBundleManifest,
  inspectAllTenantRows,
} from '../../scripts/permission-activation-bundle.mjs';
import { prepareCompatibilityHook } from '../../scripts/permission-compatibility-prepare.mjs';
import { parseBridgeEnvironment, assertBridgeFixture, STORE_IDS } from '../../scripts/permission-identity-runtime.mjs';
import { permissionFingerprint } from '../../scripts/permission-preflight-core.mjs';

const env = parseBridgeEnvironment();
const fixture = new pg.Client({ connectionString: env.dsn, application_name: 'perm-empty-fixture' });
const observer = new pg.Client({ connectionString: env.dsn, application_name: 'perm-empty-observer' });
const writer = new pg.Client({ connectionString: env.dsn, application_name: 'perm-empty-writer' });
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const quotedRelations = EMPTY_TARGET_RELATIONS.map((relation) => relation.split('.').map(quote).join('.')).join(',');

async function waitForLock(applicationName: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const row = (await observer.query(`select state,wait_event_type,wait_event from pg_stat_activity
      where application_name=$1 and pid<>pg_backend_pid() order by pid desc limit 1`, [applicationName])).rows[0];
    if (row?.wait_event_type === 'Lock') return row;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`LOCK_WAIT_NOT_OBSERVED:${applicationName}`);
}

beforeAll(async () => {
  await fixture.connect();
  await observer.connect();
  await writer.connect();
  await assertBridgeFixture(fixture, env, 'legacy');
  await prepareCompatibilityHook(fixture);
  // This destructive preparation is restricted by parseBridgeEnvironment to
  // the dedicated loopback fixture. Activation itself performs no cleanup.
  await fixture.query(`truncate table ${quotedRelations} restart identity cascade`);
  await fixture.query('update private.idempotency_test_environment set store_ids=$1::uuid[] where singleton', [[]]);
  const empty = await inspectAllTenantRows(fixture);
  expect(empty.empty).toBe(true);
}, 120_000);

afterAll(async () => {
  await Promise.allSettled([fixture.end(), observer.end(), writer.end()]);
});

test('empty activation sees writer-before-lock and blocks writer-after-lock', async () => {
  const config = {
    schemaVersion: 1,
    mode: 'synthetic-activation',
    connectionString: env.dsn,
    database: 'postgres',
    marker: env.marker,
    storeIds: [],
    sourceFingerprint: permissionFingerprint(),
    bundleHash: activationBundleManifest().sha256,
    mappingFiles: [],
    expectedEmptyStoreSet: true,
  };

  // Writer wins: its uncommitted row owns ROW EXCLUSIVE first. Activation must
  // wait, then observe the committed UUID in a fresh post-lock snapshot.
  await writer.query('begin');
  await writer.query("insert into public.stores(id,store_no,name) values($1,901,'Writer before lock')", [STORE_IDS[0]]);
  const blockedActivation = activateDatabase(config);
  await waitForLock('pos-cafe-permission-activate');
  await writer.query('commit');
  await expect(blockedActivation).rejects.toMatchObject({ code: 'ACTIVATION_STORE_SET_MISMATCH' });
  expect((await fixture.query('select array_agg(id::text order by id) ids from public.stores')).rows[0].ids).toEqual([STORE_IDS[0]]);
  await fixture.query('delete from public.stores where id=$1', [STORE_IDS[0]]);
  expect((await inspectAllTenantRows(fixture)).empty).toBe(true);

  // Activation wins: start the legacy INSERT only after every tenant table is
  // locked. It must wait until DDL commits, then fail the candidate owner
  // invariant rather than creating a store through the stale legacy path.
  let writerOutcome: Promise<{ ok: true } | { ok: false; error: unknown }> | undefined;
  const result = await activateDatabase(config, {
    afterEmptyTargetLocked: async () => {
      writerOutcome = writer.query("insert into public.stores(id,store_no,name) values($1,902,'Writer after lock')", [STORE_IDS[0]])
        .then(() => ({ ok: true as const }), (error) => ({ ok: false as const, error }));
      await waitForLock('perm-empty-writer');
    },
  });
  expect(result).toMatchObject({ status: 'ACTIVATED', expectedEmptyStoreSet: true, stores: [] });
  expect(writerOutcome).toBeDefined();
  const outcome = await writerOutcome!;
  expect(outcome.ok).toBe(false);
  if ('error' in outcome) expect(outcome.error).toMatchObject({ code: '23514' });
  const postflight = await inspectAllTenantRows(observer);
  expect(postflight).toMatchObject({ empty: true, storeIds: [], employeeIds: [] });
  expect(postflight.actualRelations).toEqual(expect.arrayContaining([
    'private.bootstrap_requests',
    'private.employee_admin_requests',
    'private.initial_seed_workflows',
    'private.initial_seed_stages',
    'private.initial_receipt_print_grants',
    'private.menu_image_assets',
    'private.menu_image_uploads',
    'public.employee_admin_audit',
    'public.store_change_signals',
  ]));
}, 120_000);
