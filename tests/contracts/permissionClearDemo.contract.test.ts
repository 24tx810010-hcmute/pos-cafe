import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import { observeCandidateStage } from "./permissionStageObservation";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  actor,
  cleanupIdentityFixture,
  db,
  EMPLOYEE_IDS as E,
  rpc,
  setupIdentityFixture,
  STORE_IDS as S,
} from "./permissionIdentityFixture";

const PIN = "384729";
let ownerToken = "";
const demoEmployeeId = randomUUID();
const demoCategoryId = randomUUID();
const demoAreaId = randomUUID();
let demoToken = "";

beforeAll(async () => {
  await setupIdentityFixture(true);
  await db.query(`insert into public.employees(id,store_id,name,role,passcode_hash,is_active,seed_key,permission_revision,permission_overrides)
    values($1,$2,'Nhân viên demo TC12','cashier',extensions.crypt($3,extensions.gen_salt('bf')),true,'demo.tc12.employee',0,null)`,
    [demoEmployeeId, S[0], PIN]);
  ownerToken = (await rpc("permission_start_session", { p_employee_id: E[0], p_pin: PIN })).token;
  demoToken = (await rpc("permission_start_session", { p_employee_id: demoEmployeeId, p_pin: PIN })).token;
  if (!ownerToken || !demoToken) throw new Error("CLEAR_DEMO_SESSION_FIXTURE_INCOMPLETE");
  await db.query("begin");
  await db.query(readFileSync("supabase/candidate/permission-financial.sql", "utf8"));
  await db.query(readFileSync("supabase/candidate/permission-changes.sql", "utf8"));
  await db.query("insert into public.categories(id,store_id,name,sort_order,seed_key) values($1,$2,'Danh mục demo TC12',1,'demo.tc12.category')", [demoCategoryId, S[0]]);
  await db.query("insert into public.floor_areas(id,store_id,name,sort_order,seed_key) values($1,$2,'Khu demo TC12',1,'demo.tc12.area')", [demoAreaId, S[0]]);
  await observeCandidateStage(db);
});
beforeEach(async () => { await db.query("savepoint clear_demo_case"); });
afterEach(async () => { await db.query("rollback to savepoint clear_demo_case"); });
afterAll(async () => {
  try { await db.query("rollback"); }
  finally { await cleanupIdentityFixture(); }
});

async function clear(token: string, requestId: string, confirmation = true) {
  await actor(db, token, S[0]);
  return (await db.query("select public.clear_demo_data($1::uuid,$2::boolean) result", [requestId, confirmation])).rows[0].result;
}

async function startSqlSession(employeeId: string) {
  await actor(db, undefined, S[0]);
  const result = (await db.query("select public.permission_start_session($1,$2) result", [employeeId, PIN])).rows[0].result;
  expect(result.ok).toBe(true);
  return result.token as string;
}

async function closeOpenOrders() {
  const orders = (await db.query(
    "select id,lock_version::int version,total::int total from public.orders where store_id=$1 and status='open' order by id",
    [S[0]],
  )).rows;
  for (const order of orders) {
    const operationId = randomUUID();
    const payload = {
      schemaVersion: 1,
      kind: "pay_order",
      orderId: order.id,
      paymentId: randomUUID(),
      expectedVersion: order.version,
      method: "cash",
      receivedAmount: order.total,
    };
    await actor(db, ownerToken, S[0]);
    const registered = (await db.query(
      "select public.register_write_operation($1::uuid,$2::jsonb) result",
      [operationId, payload],
    )).rows[0].result;
    expect(registered.operation.status).toBe("pending");
    const executed = (await db.query(
      "select public.execute_write_operation($1::uuid,$2::jsonb) result",
      [operationId, payload],
    )).rows[0].result;
    expect(executed.operation.status).toBe("applied");
  }
  expect(Number((await db.query(
    "select count(*) n from public.orders where store_id=$1 and status='open'",
    [S[0]],
  )).rows[0].n)).toBe(0);
}

async function state() {
  const relations = [
    "categories", "menu_items", "option_groups", "option_values", "menu_item_option_groups",
    "floor_areas", "tables", "floor_decor_items", "employees", "orders", "order_items", "order_item_options", "payments",
    "write_operations", "order_events", "store_settings", "employee_admin_audit", "store_change_signals",
  ];
  const hashes: Record<string, string> = {};
  for (const relation of relations) {
    hashes[relation] = (await db.query(
      `select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from public.${relation} t`,
    )).rows[0].hash;
  }
  hashes.registry = (await db.query(
    "select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from private.employee_admin_requests t",
  )).rows[0].hash;
  hashes.sessions = (await db.query(
    "select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from private.employee_sessions t",
  )).rows[0].hash;
  return hashes;
}

// Hash complete JSON rows, including timestamps and nested R1, rather than
// comparing only visible names/counts. Failure reports must not print PIN/session
// hashes or registry MACs. The old audit prefix must survive append.
async function retainedRows(clearRequestId: string) {
  const rows: Record<string, unknown> = {};
  const rowDigest = "encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex')";
  for (const relation of ["categories", "menu_items", "option_groups", "option_values", "menu_item_option_groups",
    "floor_areas", "tables", "floor_decor_items", "employees"]) {
    rows[relation] = (await db.query(`select coalesce(jsonb_agg(${rowDigest} order by id),'[]') rows
      from public.${relation} t where store_id<>$1 or seed_key is null${relation === "employees" ? " or role='owner'" : ""}`,
    [S[0]])).rows[0].rows;
  }
  for (const relation of ["orders", "order_items", "order_item_options", "payments", "write_operations", "order_events", "store_settings"]) {
    rows[relation] = (await db.query(`select coalesce(jsonb_agg(${rowDigest} order by ${rowDigest}),'[]') rows from public.${relation} t`)).rows[0].rows;
  }
  for (const relation of ["public.employee_admin_audit", "private.employee_admin_requests"]) {
    rows[relation] = (await db.query(`select coalesce(jsonb_agg(${rowDigest} order by ${rowDigest}),'[]') rows
      from ${relation} t where request_id<>$1`, [clearRequestId])).rows[0].rows;
  }
  rows.sessions = (await db.query(`select coalesce(jsonb_agg(${rowDigest} order by ${rowDigest}),'[]') rows
    from private.employee_sessions t where employee_id<>$1`, [demoEmployeeId])).rows[0].rows;
  return rows;
}

async function createRetainedFixture() {
  const ids = Array.from({ length: 8 }, () => randomUUID());
  const [category, menu, group, option, link, area, table, decor] = ids;
  await db.query("insert into public.categories(id,store_id,name) values($1,$2,'Custom TC12')", [category, S[0]]);
  await db.query("insert into public.menu_items(id,store_id,category_id,name,price) values($1,$2,$3,'Custom coffee',30000)", [menu, S[0], category]);
  await db.query("insert into public.option_groups(id,store_id,name,select_type) values($1,$2,'Custom topping','multi')", [group, S[0]]);
  await db.query("insert into public.option_values(id,store_id,option_group_id,name,price_delta) values($1,$2,$3,'Custom milk',5000)", [option, S[0], group]);
  await db.query("insert into public.menu_item_option_groups(id,store_id,menu_item_id,option_group_id) values($1,$2,$3,$4)", [link, S[0], menu, group]);
  await db.query("insert into public.floor_areas(id,store_id,name) values($1,$2,'Custom area')", [area, S[0]]);
  await db.query("insert into public.tables(id,store_id,area_id,name,pos_x,pos_y,width,height,shape) values($1,$2,$3,'Custom table',0,0,100,100,'round')", [table, S[0], area]);
  await db.query("insert into public.floor_decor_items(id,store_id,area_id,kind,label,asset_key,pos_x,pos_y,width,height) values($1,$2,$3,'plant','Custom plant','decor-plant',0,0,50,50)", [decor, S[0], area]);
  // Even a seed-tagged owner is excluded from clear's identity effects.
  await db.query("update public.employees set seed_key='demo.tc12.owner' where id=$1", [E[0]]);
  await actor(db, ownerToken, S[0]);
  const payload = {
    schemaVersion: 1, kind: "submit_order_changes", action: "create", orderId: randomUUID(), expectedVersion: null,
    orderType: "dine_in", tableId: table,
    newLines: [{ id: randomUUID(), menuItemId: menu, quantity: 1, quotedBasePrice: 30000,
      options: [{ id: randomUUID(), optionValueId: option, quantity: 2, quotedPriceDelta: 5000 }] }],
  };
  const operationId = randomUUID();
  expect((await db.query("select public.register_write_operation($1,$2) result", [operationId, payload])).rows[0].result.operation.status).toBe("pending");
  expect((await db.query("select public.execute_write_operation($1,$2) result", [operationId, payload])).rows[0].result.operation.status).toBe("applied");
  // Seed genuine prior identity audit/registry rows through the admin protocol.
  const revision = (await db.query("select permission_revision::int n from public.employees where id=$1", [E[2]])).rows[0].n;
  const catalog = (await db.query("select revision::int n from public.permission_catalog_state where singleton")).rows[0].n;
  expect((await db.query("select public.permission_admin_update($1) result", [{ requestId: randomUUID(), targetId: E[2],
    expectedRevision: revision, expectedCatalogRevision: catalog, patch: { name: "Custom cashier TC12" } }])).rows[0].result.ok).toBe(true);
}

test("TC-PERM-12 open orders produce one durable denied outcome and no clear effect", async () => {
  const requestId = randomUUID();
  const before = await state();
  const first = await clear(ownerToken, requestId);
  expect(first.error.code).toBe("OPEN_ORDERS_BLOCK_CLEAR_DEMO");
  const afterFirst = await state();
  for (const relation of ["categories", "menu_items", "option_groups", "option_values", "menu_item_option_groups",
    "floor_areas", "tables", "floor_decor_items", "employees", "orders", "order_items", "order_item_options", "payments", "write_operations", "order_events", "store_settings", "sessions"])
    expect(afterFirst[relation]).toBe(before[relation]);
  const auditCount = Number((await db.query("select count(*) n from public.employee_admin_audit where request_id=$1", [requestId])).rows[0].n);
  expect(auditCount).toBeGreaterThan(0);
  expect((await db.query("select bool_and(outcome='denied' and reason='OPEN_ORDERS_BLOCK_CLEAR_DEMO') ok from public.employee_admin_audit where request_id=$1", [requestId])).rows[0].ok).toBe(true);
  expect((await db.query("select count(*)::int n from private.employee_admin_requests where request_id=$1", [requestId])).rows[0].n).toBe(1);
  expect(await clear(ownerToken, requestId)).toEqual(first);
  expect(Number((await db.query("select count(*) n from public.employee_admin_audit where request_id=$1", [requestId])).rows[0].n)).toBe(auditCount);
});

test("TC-PERM-12 successful clear is seed-only, audited, signalled, and exactly replayable", async () => {
  await createRetainedFixture();
  await closeOpenOrders();
  const requestId = randomUUID();
  const retained = await retainedRows(requestId);
  for (const relation of ["order_item_options", "public.employee_admin_audit", "private.employee_admin_requests", "floor_decor_items", "option_values"])
    expect(retained[relation]).not.toEqual([]);
  const first = await clear(ownerToken, requestId);
  expect(first).toMatchObject({ ok: true, outcome: "applied", data: null });
  expect(await retainedRows(requestId)).toEqual(retained);
  expect((await db.query("select deleted_at is not null deleted from public.categories where id=$1", [demoCategoryId])).rows[0].deleted).toBe(true);
  expect((await db.query("select deleted_at is not null deleted from public.floor_areas where id=$1", [demoAreaId])).rows[0].deleted).toBe(true);
  const employee = (await db.query("select is_active,permission_revision::int revision from public.employees where id=$1", [demoEmployeeId])).rows[0];
  expect(employee).toMatchObject({ is_active: false, revision: 1 });
  expect((await db.query("select bool_and(revoked_at is not null) ok from private.employee_sessions where employee_id=$1", [demoEmployeeId])).rows[0].ok).toBe(true);
  await actor(db, demoToken, S[0]);
  expect((await db.query("select public.permission_get_authority() result")).rows[0].result.error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  expect((await db.query("select count(*)::int n from public.employee_admin_audit where request_id=$1 and target_id=$2 and kind='clear_demo_data' and outcome='applied'", [requestId, demoEmployeeId])).rows[0].n).toBe(1);
  expect((await db.query("select array_agg(topic order by topic) topics from public.store_change_signals where store_id=$1 and event_id=$2", [S[0], requestId])).rows[0].topics).toEqual(["floor", "menu", "permission"]);
  await db.query("update public.categories set deleted_at=null,deleted_by_employee_id=null where id=$1", [demoCategoryId]);
  await db.query("update public.floor_areas set deleted_at=null,deleted_by_employee_id=null where id=$1", [demoAreaId]);
  await db.query("update public.employees set is_active=true,permission_revision=permission_revision+1 where id=$1", [demoEmployeeId]);
  const reseeded = await state();
  expect(await clear(ownerToken, requestId)).toEqual(first);
  expect(await state()).toEqual(reseeded);
  expect((await db.query("select deleted_at is null alive from public.categories where id=$1", [demoCategoryId])).rows[0].alive).toBe(true);
  expect((await db.query("select deleted_at is null alive from public.floor_areas where id=$1", [demoAreaId])).rows[0].alive).toBe(true);
  expect((await db.query("select is_active from public.employees where id=$1", [demoEmployeeId])).rows[0].is_active).toBe(true);
  expect((await clear(ownerToken, requestId, false)).error.code).toBe("ADMIN_REQUEST_REUSED");
  expect(await state()).toEqual(reseeded);
});

test("TC-PERM-12 revoked owner token cannot clear or append audit after orders are closed", async () => {
  await closeOpenOrders();
  const revokedToken = await startSqlSession(E[0]);
  await actor(db, revokedToken, S[0]);
  expect((await db.query("select public.permission_revoke_session() result")).rows[0].result.ok).toBe(true);
  const before = await state();
  expect((await clear(revokedToken, randomUUID())).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  expect(await state()).toEqual(before);
});

test("TC-PERM-12 confirmation=false is terminal and a changed body collides before revalidation", async () => {
  await closeOpenOrders();
  const requestId = randomUUID();
  const denied = await clear(ownerToken, requestId, false);
  expect(denied.error.code).toBe("INVALID_WRITE_REQUEST");
  expect(await clear(ownerToken, requestId, false)).toEqual(denied);
  expect((await clear(ownerToken, requestId, true)).error.code).toBe("ADMIN_REQUEST_REUSED");
  expect((await db.query("select terminal_outcome from private.employee_admin_requests where request_id=$1", [requestId])).rows[0].terminal_outcome).toEqual(denied);
});

test("TC-PERM-12 owner-only grants are rejected and a normal manager clear is denied", async () => {
  await closeOpenOrders();
  const revision = Number((await db.query("select permission_revision from public.employees where id=$1", [E[1]])).rows[0].permission_revision);
  const catalogRevision = Number((await db.query("select revision from public.permission_catalog_state where singleton")).rows[0].revision);
  await actor(db, ownerToken, S[0]);
  const impossibleGrant = (await db.query("select public.permission_admin_update($1::jsonb) result", [{
    requestId: randomUUID(), targetId: E[1], expectedRevision: revision, expectedCatalogRevision: catalogRevision,
    patch: { overrides: { grants: ["data.clearDemo"], denies: [] } },
  }])).rows[0].result;
  expect(impossibleGrant.error.code).toBe("OWNER_ONLY_PERMISSION");
  const managerToken = await startSqlSession(E[1]);
  const requestId = randomUUID();
  expect((await clear(managerToken, requestId)).error.code).toBe("FORBIDDEN");
  expect((await db.query("select bool_and(outcome='denied' and reason='FORBIDDEN') ok from public.employee_admin_audit where request_id=$1", [requestId])).rows[0].ok).toBe(true);
  const auditCount = Number((await db.query("select count(*) n from public.employee_admin_audit where request_id=$1", [requestId])).rows[0].n);
  await actor(db, managerToken, S[0]);
  expect((await db.query("select public.permission_revoke_session() result")).rows[0].result.ok).toBe(true);
  expect((await clear(managerToken, requestId)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  expect(Number((await db.query("select count(*) n from public.employee_admin_audit where request_id=$1", [requestId])).rows[0].n)).toBe(auditCount);
});

test("TC-PERM-12 corrupt injected owner-only grant fails closed without any clear effect", async () => {
  await closeOpenOrders();
  const managerToken = await startSqlSession(E[1]);
  // Corrupt-state negative control: bypass normalization exactly once. The
  // malformed authority need not produce a verified denial audit; it must fail
  // closed and leave every protected relation unchanged.
  await db.query("set local session_replication_role='replica'");
  await db.query("update public.employees set permission_overrides=$2 where id=$1", [E[1], { grants: ["data.clearDemo"], denies: [] }]);
  await db.query("set local session_replication_role='origin'");
  const before = await state();
  expect((await clear(managerToken, randomUUID())).error.code).toBe("PERMISSION_UPDATE_UNAVAILABLE");
  expect(await state()).toEqual(before);
});

test("TC-PERM-12 request ids collide across administration kinds for the same actor", async () => {
  await closeOpenOrders();
  const requestId = randomUUID();
  const target = (await db.query("select name,permission_revision::int revision from public.employees where id=$1", [E[2]])).rows[0];
  const catalogRevision = Number((await db.query("select revision from public.permission_catalog_state where singleton")).rows[0].revision);
  await actor(db, ownerToken, S[0]);
  const adminResult = (await db.query("select public.permission_admin_update($1::jsonb) result", [{
    requestId, targetId: E[2], expectedRevision: target.revision, expectedCatalogRevision: catalogRevision,
    patch: { name: target.name },
  }])).rows[0].result;
  expect(adminResult.ok).toBe(true);
  expect((await clear(ownerToken, requestId)).error.code).toBe("ADMIN_REQUEST_REUSED");
  expect((await db.query("select kind,terminal_outcome from private.employee_admin_requests where request_id=$1", [requestId])).rows[0]).toMatchObject({
    kind: "update_employee", terminal_outcome: adminResult,
  });
});

test("TC-PERM-12 an audit fault rolls back tombstones, identity, sessions, registry, and signals", async () => {
  await closeOpenOrders();
  const requestId = randomUUID();
  const before = await state();
  await db.query(`create function private.clear_demo_test_fault() returns trigger language plpgsql set search_path=pg_catalog as
    $$begin if new.kind='clear_demo_data' then raise exception 'synthetic audit fault'; end if; return new; end$$`);
  await db.query("create trigger clear_demo_test_fault before insert on public.employee_admin_audit for each row execute function private.clear_demo_test_fault()");
  expect((await clear(ownerToken, requestId)).error.code).toBe("PERMISSION_UPDATE_UNAVAILABLE");
  expect(await state()).toEqual(before);
});

test("TC-PERM-12 every legacy clear overload remains revoked", async () => {
  const overloads = (await db.query(`select p.oid::regprocedure::text signature,
    has_function_privilege('authenticated',p.oid,'EXECUTE') executable
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='clear_demo_data' order by 1`)).rows;
  const legacy = overloads.filter(row => row.signature !== "clear_demo_data(uuid,boolean)");
  expect(legacy.length).toBeGreaterThan(0);
  expect(legacy.every(row => row.executable === false)).toBe(true);
  expect((await db.query("select has_function_privilege('authenticated','public.clear_demo_data(uuid,boolean)','EXECUTE') ok")).rows[0].ok).toBe(true);
});
