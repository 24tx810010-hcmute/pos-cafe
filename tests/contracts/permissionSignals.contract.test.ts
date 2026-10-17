import { afterAll, beforeAll, expect, test } from "vitest";
import { observeCandidateStage } from "./permissionStageObservation";
import {
  cleanupPermissionSignalsFixture, db, env, realtimeClient, setupPermissionSignalsFixture, STORE_IDS, waitFor, waitForSubscribed, waitForSignalDelivery,
} from "./permissionSignalsFixture";

beforeAll(async () => { await setupPermissionSignalsFixture(); await observeCandidateStage(db); }, 120_000);
afterAll(cleanupPermissionSignalsFixture, 120_000);

test("TC-PERM-29 publication exposes only minimal signal tables with same-store RLS", async () => {
  const publication = (await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by tablename")).rows.map(row => row.tablename);
  expect(publication).toEqual(["permission_catalog_signals", "store_change_signals"]);
  const grants = (await db.query("select table_name,privilege_type from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and table_name in ('store_change_signals','permission_catalog_signals') order by table_name,privilege_type")).rows;
  expect(grants).toEqual([
    { table_name: "permission_catalog_signals", privilege_type: "SELECT" },
    { table_name: "store_change_signals", privilege_type: "SELECT" },
  ]);

  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: STORE_IDS[1], role: "authenticated" })]);
    expect(Number((await db.query("select count(*) n from public.store_change_signals where store_id=$1", [STORE_IDS[0]])).rows[0].n)).toBe(0);
  } finally { await db.query("rollback"); }

  const received: unknown[] = [], peerReceived: unknown[] = [], crossTenantReceived: unknown[] = [];
  const client = realtimeClient(env.storeJwt), peer = realtimeClient(env.storeJwt), crossTenant = realtimeClient(env.storeJwt);
  const stop = await waitForSubscribed(client, STORE_IDS[0], received);
  const stopPeer = await waitForSubscribed(peer, STORE_IDS[0], peerReceived);
  const stopCrossTenant = await waitForSubscribed(crossTenant, STORE_IDS[1], crossTenantReceived);
  try {
    await waitForSignalDelivery(received, peerReceived);
    expect(crossTenantReceived).toEqual([]);
    await db.query("update public.categories set name=name||' t10' where store_id=$1", [STORE_IDS[0]]);
    const eventId = (await db.query("select event_id from public.store_change_signals where store_id=$1 and topic='menu'", [STORE_IDS[0]])).rows[0].event_id;
    const businessEvent = (rows: unknown[]) => rows.find(row => (row as { event_id?: string }).event_id === eventId);
    await waitFor(() => Boolean(businessEvent(received) && businessEvent(peerReceived)));
    const delivered = businessEvent(received);
    expect(Object.keys(delivered as object).sort()).toEqual(["event_id", "revision", "store_id", "target_id", "topic"]);
    expect(delivered).toMatchObject({ event_id: eventId, store_id: STORE_IDS[0], topic: "menu", target_id: null });
    expect(businessEvent(peerReceived)).toEqual(delivered);
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(crossTenantReceived).toEqual([]);
  } finally { await Promise.all([stop(), stopPeer(), stopCrossTenant()]); }
});

test("TC-PERM-21 rollback emits no committed signal", async () => {
  const before = Number((await db.query("select revision from public.store_change_signals where store_id=$1 and topic='menu'", [STORE_IDS[0]])).rows[0].revision);
  await db.query("begin");
  await db.query("update public.categories set name=name||' rolled-back' where store_id=$1", [STORE_IDS[0]]);
  await db.query("rollback");
  const after = Number((await db.query("select revision from public.store_change_signals where store_id=$1 and topic='menu'", [STORE_IDS[0]])).rows[0].revision);
  expect(after).toBe(before);
});

test("TC-PERM-30 catalog signal advances without employee revision change", async () => {
  const employeeBefore = (await db.query("select id,permission_revision from public.employees order by id")).rows;
  const oldRevision = Number((await db.query("select revision from public.permission_catalog_state where singleton")).rows[0].revision);
  await db.query("begin");
  await db.query("delete from public.role_permission_defaults where role_code='cashier' and permission_code='order.create'");
  await db.query("insert into public.role_permission_defaults(role_code,permission_code) values('cashier','order.create')");
  await db.query("commit");
  const signal = (await db.query("select revision,event_id from public.permission_catalog_signals where singleton")).rows[0];
  expect(Number(signal.revision)).toBeGreaterThan(oldRevision);
  expect(signal.event_id).toMatch(/^[0-9a-f-]{36}$/);
  expect((await db.query("select id,permission_revision from public.employees order by id")).rows).toEqual(employeeBefore);
});
