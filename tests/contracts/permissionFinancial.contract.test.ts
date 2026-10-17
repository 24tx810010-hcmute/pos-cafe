import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { observeCandidateStage } from "./permissionStageObservation";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { permissionFingerprint } from "../../scripts/permission-preflight-core.mjs";
import {
  actor,
  cleanupFinancialFixture,
  connection,
  db,
  EMPLOYEE_IDS as E,
  fixtureEvidence,
  resetFinancialFixture,
  rpc,
  setupFinancialFixture,
  STORE_IDS as S,
  waitBlocked,
} from "./permissionFinancialFixture";

const PIN = "384729";
const source = permissionFingerprint();
const controls: Record<string, unknown> = {};
const actions = ["order.create", "order.update", "order.voidOpen", "payment.take", "order.voidPaid"] as const;
type Action = typeof actions[number];
const ttlCases = ([
  ["minus", "2026-09-16T23:59:59.999Z"], ["equal", "2026-09-17T00:00:00.000Z"], ["plus", "2026-09-17T00:00:00.001Z"],
] as const).flatMap(([boundary, moment]) => (["get", "execute", "cancel", "list"] as const).map(mode => [boundary, moment, mode] as const));

beforeAll(async () => { await setupFinancialFixture(); await observeCandidateStage(db); });
afterEach(resetFinancialFixture);
afterAll(async () => {
  try { await cleanupFinancialFixture(); }
  finally {
    if (process.env.PERM_FINANCIAL_EVIDENCE_FILE) writeFileSync(process.env.PERM_FINANCIAL_EVIDENCE_FILE, JSON.stringify({
      sourceFingerprint: source,
      sourceAfter: permissionFingerprint(),
      fixtureEvidence,
      controls,
    }, null, 2));
  }
});

const start = (id = E[0], pin = PIN) => rpc("permission_start_session", { p_employee_id: id, p_pin: pin });
const register = (token: string, key: string, payload: object) => rpc("register_write_operation", { p_operation_id: key, p_payload: payload }, token);
const execute = (token: string, key: string, payload: object) => rpc("execute_write_operation", { p_operation_id: key, p_payload: payload }, token);
const getOperation = (token: string, key: string) => rpc("get_write_operation", { p_operation_id: key }, token);
const cancel = (token: string, key: string) => rpc("cancel_write_operation", { p_operation_id: key }, token);
const listOperations = (token: string, args: object = {}) => rpc("list_write_operations", args, token);

type Seed = {
  openOrderId: string; openVersion: number; openItemId: string; openQuantity: number;
  menuItemId: string; menuPrice: number; paidOrderId: string; paidVersion: number;
};

async function seed(): Promise<Seed> {
  const open = (await db.query(`select o.id open_order_id,o.lock_version::int open_version,i.id open_item_id,i.quantity::int open_quantity,
    i.menu_item_id,m.price::int menu_price from public.orders o join public.order_items i on i.order_id=o.id
    join public.menu_items m on m.id=i.menu_item_id where o.store_id=$1 and o.status='open' order by o.id,i.id limit 1`, [S[0]])).rows[0];
  const paid = (await db.query("select id paid_order_id,lock_version::int paid_version from public.orders where store_id=$1 and status='paid' order by id limit 1", [S[0]])).rows[0];
  if (!open || !paid) throw new Error("FINANCIAL_SEED_INCOMPLETE");
  return {
    openOrderId: open.open_order_id, openVersion: open.open_version,
    openItemId: open.open_item_id, openQuantity: open.open_quantity,
    menuItemId: open.menu_item_id, menuPrice: open.menu_price,
    paidOrderId: paid.paid_order_id, paidVersion: paid.paid_version,
  };
}

function payloads(f: Seed) {
  return {
    "order.create": {
      schemaVersion: 1, kind: "submit_order_changes", action: "create", orderId: randomUUID(), expectedVersion: null,
      orderType: "takeaway", tableId: null,
      newLines: [{ id: randomUUID(), menuItemId: f.menuItemId, quantity: 1, quotedBasePrice: f.menuPrice, options: [] }],
    },
    "order.update": {
      schemaVersion: 1, kind: "submit_order_changes", action: "update", orderId: f.openOrderId, expectedVersion: f.openVersion,
      retainedLines: [{ sourceItemId: f.openItemId, quantity: f.openQuantity, note: "giữ nguyên" }], newLines: [],
    },
    "order.voidOpen": {
      schemaVersion: 1, kind: "submit_order_changes", action: "void_open", orderId: f.openOrderId, expectedVersion: f.openVersion,
    },
    "payment.take": {
      schemaVersion: 1, kind: "pay_order", orderId: f.openOrderId, paymentId: randomUUID(), expectedVersion: f.openVersion,
      method: "cash", receivedAmount: 50_000,
    },
    "order.voidPaid": {
      schemaVersion: 1, kind: "void_order", orderId: f.paidOrderId, expectedVersion: f.paidVersion, reason: "duplicate",
    },
  } satisfies Record<Action, object>;
}

function splitPayload(f: Seed) {
  return {
    schemaVersion: 1, kind: "pay_order_items", orderId: f.openOrderId, newOrderId: randomUUID(), paymentId: randomUUID(),
    expectedVersion: f.openVersion, method: "cash", receivedAmount: 50_000,
    lines: [{ orderItemId: f.openItemId, quantity: f.openQuantity - 1, splitItemId: randomUUID() }],
  };
}

async function partialSplitSeed(f: Seed) {
  if (f.openQuantity >= 2) return f;
  await db.query("update public.order_items set quantity=2 where store_id=$1 and id=$2", [S[0], f.openItemId]);
  await db.query("update public.orders set subtotal=$3,total=$3 where store_id=$1 and id=$2", [S[0], f.openOrderId, f.menuPrice * 2]);
  return { ...f, openQuantity: 2 };
}

async function setRights(id: string, allowed: readonly Action[]) {
  await db.query("update public.employees set permission_overrides=$2 where id=$1", [id, {
    grants: [...allowed], denies: actions.filter(action => !allowed.includes(action)),
  }]);
}

async function catalogRevision() {
  return Number((await db.query("select revision from public.permission_catalog_state where singleton")).rows[0].revision);
}

async function revokeAction(ownerToken: string, targetId: string, permission: Action) {
  const revision = Number((await db.query("select permission_revision from public.employees where id=$1", [targetId])).rows[0].permission_revision);
  return rpc("permission_admin_update", { p_request: {
    requestId: randomUUID(), targetId, expectedRevision: revision, expectedCatalogRevision: await catalogRevision(),
    patch: { overrides: { grants: [], denies: [permission] } },
  } }, ownerToken);
}

async function operationRow(key: string) {
  return (await db.query("select to_jsonb(w) row from public.write_operations w where store_id=$1 and operation_id=$2", [S[0], key])).rows[0]?.row;
}

async function businessState() {
  const result: Record<string, unknown> = {};
  for (const table of ["orders", "order_items", "order_item_options", "payments", "order_events"])
    result[table] = (await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows from public.${table} t where store_id=$1`, [S[0]])).rows[0].rows;
  return result;
}

async function sqlRejected(statement: string, token?: string) {
  const client = await connection();
  try {
    await client.query("begin"); await client.query("set local role authenticated"); await actor(client, token);
    let state = "";
    try { await client.query(statement); } catch (error) { state = (error as { code?: string }).code ?? ""; }
    expect(state).toBe("42501");
  } finally { await client.query("rollback"); await client.end(); }
}

async function blocker(sql: string, values: unknown[] = []) {
  const client = await connection();
  await client.query("begin");
  const pid = Number((await client.query("select pg_backend_pid() p")).rows[0].p);
  await client.query(sql, values);
  return { client, pid, release: async () => { await client.query("commit"); await client.end(); } };
}

async function waitContender(blockerPid: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const row = (await db.query(`select pid from pg_stat_activity where datname=current_database()
      and $1=any(pg_blocking_pids(pid)) and wait_event_type='Lock' order by pid limit 1`, [blockerPid])).rows[0];
    if (row) return Number(row.pid);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error("FINANCIAL_CONTENDER_NOT_BLOCKED");
}

async function blockingPids(pid: number) {
  return (await db.query("select pg_blocking_pids($1)::int[] pids", [pid])).rows[0].pids as number[];
}

async function installClock(moment: string) {
  const original = (await db.query("select pg_get_functiondef('private.write_clock()'::regprocedure) d")).rows[0].d as string;
  await db.query("create table private.permission_financial_clock(moment timestamptz not null)");
  await db.query("insert into private.permission_financial_clock values($1)", [moment]);
  await db.query("create or replace function private.write_clock() returns timestamptz language sql volatile set search_path=pg_catalog as $$select moment from private.permission_financial_clock$$");
  return {
    set: (next: string) => db.query("update private.permission_financial_clock set moment=$1", [next]),
    restore: async () => { await db.query(original); await db.query("drop table if exists private.permission_financial_clock"); },
  };
}

async function mutateWriteRequest(needle: string, replacement: string) {
  const original = (await db.query("select pg_get_functiondef('private.write_operation_request(text,uuid,jsonb,uuid)'::regprocedure) d")).rows[0].d as string;
  expect(original.includes(needle)).toBe(true);
  const mutated = original.replace(needle, replacement);
  expect(mutated).not.toBe(original);
  await db.query(mutated);
  return () => db.query(original);
}

test.each(actions)("TC-PERM-25 T06 action matrix grants only %s across write protocol endpoints", async selected => {
  const f = await seed(), all = payloads(f);
  await setRights(E[2], [selected]);
  const session = await start(E[2]);
  expect(session.ok).toBe(true);
  const capabilities = await rpc("get_write_capabilities", {}, session.token);
  expect(capabilities).toMatchObject({ writeProtocolVersion: 1, permissionContractVersion: 2, pendingTtlSeconds: 86_400 });
  const selectedKeys: string[] = [], deniedKeys: string[] = [];
  for (const action of actions) {
    const key = randomUUID();
    const response = await register(session.token, key, all[action]);
    if (action === selected) {
      expect(response.operation.status).toBe("pending"); selectedKeys.push(key);
    } else { expect(response.error.code).toBe("FORBIDDEN"); deniedKeys.push(key); }
  }
  if (selected === "payment.take") {
    const key = randomUUID();
    expect((await register(session.token, key, splitPayload(await partialSplitSeed(f)))).operation.status).toBe("pending");
    selectedKeys.push(key);
  }
  const listed = await listOperations(session.token, { p_limit: 100 });
  const listedKeys = new Set(listed.page.items.map((item: { operationId: string }) => item.operationId));
  expect(selectedKeys.every(key => listedKeys.has(key))).toBe(true);
  expect(deniedKeys.some(key => listedKeys.has(key))).toBe(false);
  expect((await getOperation(session.token, selectedKeys[0])).operation.status).toBe("pending");
  expect((await cancel(session.token, selectedKeys[0])).operation.status).toBe("cancelled");
});

test("TC-PERM-27 T06 legacy financial overloads and direct DML remain closed with protocol positive controls", async () => {
  const callableSql = `format('select %I.%I(%s)',n.nspname,p.proname,coalesce((select string_agg('null::'||format_type(t.oid,null),',' order by t.ordinality)
    from unnest(p.proargtypes::oid[]) with ordinality t(oid,ordinality)),'')) statement`;
  const legacy = (await db.query(`select p.oid::regprocedure::text signature,${callableSql} from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('create_order_with_items','submit_order_changes','pay_order','pay_order_items','void_order')`)).rows;
  expect(legacy.length).toBeGreaterThan(0);
  for (const row of legacy) {
    for (const role of ["anon", "authenticated", "service_role"])
      expect((await db.query("select has_function_privilege($1,$2,'EXECUTE') ok", [role, row.signature])).rows[0].ok).toBe(false);
    await sqlRejected(row.statement);
  }
  const privateHelpers = (await db.query(`select ${callableSql} from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname in ('permission_financial_checkpoint','permission_financial_allowed','write_operation_request','lock_write_input','prepare_write','apply_write')`)).rows;
  expect(privateHelpers.length).toBe(6);
  for (const helper of privateHelpers) await sqlRejected(helper.statement);
  for (const table of ["orders", "order_items", "order_item_options", "payments", "write_operations", "order_events"]) {
    for (const role of ["anon", "authenticated", "service_role"])
      expect((await db.query("select has_table_privilege($1,$2,'INSERT,UPDATE,DELETE') ok", [role, `public.${table}`])).rows[0].ok).toBe(false);
    await sqlRejected(`insert into public.${table} default values`);
    await sqlRejected(`delete from public.${table}`);
  }
  for (const role of ["anon", "authenticated", "service_role"])
    expect((await db.query("select has_column_privilege($1,'public.write_operations','payload','SELECT') or has_column_privilege($1,'public.write_operations','payload','UPDATE') ok", [role])).rows[0].ok).toBe(false);
  const owner = await start();
  await sqlRejected("update public.orders set total=total", owner.token);
  await sqlRejected("update public.write_operations set status=status", owner.token);
  expect((await rpc("get_write_capabilities")).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  const f = await seed(), key = randomUUID(), payload = payloads(f)["payment.take"];
  expect((await register("", key, payload)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  expect((await execute("", key, payload)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  expect(await operationRow(key)).toBeUndefined();
  expect((await register(owner.token, key, payload)).operation.status).toBe("pending");
  controls.legacyAndDmlClosed = true;
});

test("TC-PERM-28 T06 a role disabled after session issuance returns the exact authority error", async () => {
  const cashier = await start(E[2]);
  try {
    await db.query("alter table public.employees disable trigger employees_revoke_sessions");
    await db.query("update public.employees set role='kitchen' where id=$1", [E[2]]);
    await db.query("alter table public.employees enable trigger employees_revoke_sessions");
    const result = await rpc("get_write_capabilities", {}, cashier.token);
    expect(result.error).toMatchObject({ code: "EMPLOYEE_ROLE_UNAVAILABLE", message: "Vai trò này chưa được hỗ trợ trên ứng dụng." });
    controls.disabledRoleAfterIssuance = true;
  } finally {
    await db.query("alter table public.employees enable trigger employees_revoke_sessions");
    await db.query("update public.employees set role='cashier' where id=$1", [E[2]]);
  }
});

test.each([
  ["create", "order.create"], ["update", "order.update"], ["void-open", "order.voidOpen"],
  ["pay", "payment.take"], ["split", "payment.take"], ["void-paid", "order.voidPaid"],
] as const)("TC-PERM-39 T06 revoke after register preserves %s K until an authorized takeover", async (flow, permission) => {
  const f = await seed(), payload = flow === "split" ? splitPayload(await partialSplitSeed(f)) : payloads(f)[permission], key = randomUUID();
  await setRights(E[2], [permission]);
  const cashier = await start(E[2]);
  expect((await register(cashier.token, key, payload)).operation.status).toBe("pending");
  const before = await operationRow(key), businessBefore = await businessState();
  const owner = await start();
  expect((await revokeAction(owner.token, E[2], permission)).outcome).toBe("applied");
  expect((await execute(cashier.token, key, payload)).error.code).toBe("FORBIDDEN");
  expect((await getOperation(cashier.token, key)).error.code).toBe("FORBIDDEN");
  expect((await cancel(cashier.token, key)).error.code).toBe("FORBIDDEN");
  expect((await listOperations(cashier.token, { p_limit: 100 })).page.items.some((item: { operationId: string }) => item.operationId === key)).toBe(false);
  const denied = await operationRow(key);
  expect({ status: denied.status, payload: denied.payload, expires_at: denied.expires_at, result: denied.result }).toEqual({
    status: before.status, payload: before.payload, expires_at: before.expires_at, result: before.result,
  });
  expect(await businessState()).toEqual(businessBefore);
  await db.query("update public.employees set permission_overrides=$2 where id=$1", [E[2], { grants: ["orderHistory.view", "receipt.reprint"], denies: [permission] }]);
  expect((await getOperation(cashier.token, key)).error.code).toBe("FORBIDDEN");
  const manager = await start(E[1]);
  const taken = await execute(manager.token, key, payload);
  expect(taken.operation).toMatchObject({ status: "applied", initiatedByEmployeeId: E[2], executedByEmployeeId: E[1] });
  const event = (await db.query("select initiated_by,executed_by from public.order_events where store_id=$1 and operation_id=$2", [S[0], key])).rows[0];
  expect(event).toEqual({ initiated_by: E[2], executed_by: E[1] });
  if ("paymentId" in payload)
    expect((await db.query("select employee_id from public.payments where store_id=$1 and id=$2", [S[0], payload.paymentId])).rows[0].employee_id).toBe(E[1]);
  controls.pendingSurvivesRevocation = true;
});

test("TC-PERM-40 T06 owner revoke commits while execute waits on the order and is observed at the final checkpoint", async () => {
  const f = await seed(), payload = payloads(f)["payment.take"], key = randomUUID();
  await setRights(E[2], ["payment.take"]);
  const cashier = await start(E[2]), owner = await start();
  await register(cashier.token, key, payload);
  const hold = await blocker("select 1 from public.orders where store_id=$1 and id=$2 for update", [S[0], f.openOrderId]);
  const pending = execute(cashier.token, key, payload);
  try {
    await waitContender(hold.pid);
    const revoked = await revokeAction(owner.token, E[2], "payment.take");
    expect(revoked.outcome).toBe("applied");
    controls.revokeCommittedBeforeOrderRelease = true;
  } finally { await hold.release(); }
  const denied = await pending;
  expect(denied.error.code).toBe("FORBIDDEN");
  const row = await operationRow(key);
  expect(row.status).toBe("pending"); expect(row.result).toBeNull();
  expect((await db.query("select count(*)::int n from public.payments where store_id=$1 and order_id=$2", [S[0], f.openOrderId])).rows[0].n).toBe(0);
});

test("TC-PERM-40 T06 negative control detects removal of the post-business authority checkpoint", async () => {
  const needle = ` e:=private.permission_financial_checkpoint(case when p_mode='execute' then array[w.initiated_by_employee_id] else array[]::uuid[] end);\n if not private.permission_financial_allowed(e,w.required_permission) then return private.write_failure('FORBIDDEN'); end if;`;
  const restore = await mutateWriteRequest(needle, " -- mutation control deliberately reuses preliminary authority\n");
  try {
    const f = await seed(), payload = payloads(f)["payment.take"], key = randomUUID();
    await setRights(E[2], ["payment.take"]);
    const cashier = await start(E[2]), owner = await start(); await register(cashier.token, key, payload);
    const hold = await blocker("select 1 from public.orders where store_id=$1 and id=$2 for update", [S[0], f.openOrderId]);
    const pending = execute(cashier.token, key, payload);
    try {
      await waitContender(hold.pid);
      expect((await revokeAction(owner.token, E[2], "payment.take")).outcome).toBe("applied");
    } finally { await hold.release(); }
    const broken = await pending;
    const faultObserved = broken.operation?.status === "applied"
      && (await db.query("select count(*)::int n from public.payments where store_id=$1 and order_id=$2", [S[0], f.openOrderId])).rows[0].n === 1;
    expect(faultObserved).toBe(true);
    controls.postLockAuthMutationCaught = faultObserved;
  } finally { await restore(); }
});

test("TC-PERM-41 T06 execute reads a catalog action removal committed while waiting for catalog SHARE", async () => {
  const f = await seed(), payload = payloads(f)["payment.take"], key = randomUUID();
  await db.query("update public.employees set permission_overrides=null where id=$1", [E[2]]);
  const cashier = await start(E[2]); await register(cashier.token, key, payload);
  const writer = await connection(), executor = await connection();
  try {
    await writer.query("begin");
    await writer.query("delete from public.role_permission_defaults where role_code='cashier' and permission_code='payment.take'");
    await executor.query("begin"); await actor(executor, cashier.token);
    const pid = Number((await executor.query("select pg_backend_pid() p")).rows[0].p);
    const pending = executor.query("select public.execute_write_operation($1,$2) r", [key, payload]);
    await waitBlocked(pid);
    await writer.query("commit");
    const result = (await pending).rows[0].r;
    await executor.query("commit");
    expect(result.error.code).toBe("FORBIDDEN");
    expect((await operationRow(key)).status).toBe("pending");
    controls.catalogFreshAfterWait = true;
  } finally {
    await writer.query("rollback"); await executor.query("rollback");
    await writer.end(); await executor.end();
    await db.query("insert into public.role_permission_defaults values('cashier','payment.take') on conflict do nothing");
  }
});

test("TC-PERM-28/41 T06 a session expiring while execute waits for catalog cannot create an effect or R1", async () => {
  const clock = await installClock("2026-09-16T00:00:00Z");
  const writer = await connection(), executor = await connection();
  try {
    const f = await seed(), payload = payloads(f)["payment.take"], key = randomUUID();
    await setRights(E[2], ["payment.take"]);
    const cashier = await start(E[2]); await register(cashier.token, key, payload);
    await writer.query("begin"); await writer.query("select pg_advisory_xact_lock(hashtextextended('permission-catalog',0))");
    await executor.query("begin"); await actor(executor, cashier.token);
    const pid = Number((await executor.query("select pg_backend_pid() p")).rows[0].p);
    const pending = executor.query("select public.execute_write_operation($1,$2) r", [key, payload]);
    await waitBlocked(pid);
    await clock.set("2026-09-16T12:00:00.001Z");
    await writer.query("commit");
    const result = (await pending).rows[0].r; await executor.query("commit");
    expect(result.error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
    const row = await operationRow(key); expect(row.status).toBe("pending"); expect(row.result).toBeNull();
    expect((await db.query("select count(*)::int n from public.payments where store_id=$1 and order_id=$2", [S[0], f.openOrderId])).rows[0].n).toBe(0);
    controls.sessionFreshAfterCatalogWait = true;
  } finally {
    await writer.query("rollback"); await executor.query("rollback");
    await writer.end(); await executor.end(); await clock.restore();
  }
});

test("TC-PERM-41/44 T06 takeover prelocks its inactive initiator before catalog and writes executor separately", async () => {
  const f = await seed(), payload = payloads(f)["payment.take"], key = randomUUID();
  await setRights(E[2], ["payment.take"]);
  const initiator = await start(E[2]); await register(initiator.token, key, payload);
  await db.query("update public.employees set is_active=false where id=$1", [E[2]]);
  const manager = await start(E[1]), owner = await start();
  const writer = await connection(), executor = await connection(), administrator = await connection();
  try {
    await writer.query("begin"); await writer.query("select pg_advisory_xact_lock(hashtextextended('permission-catalog',0))");
    await executor.query("begin"); await actor(executor, manager.token);
    const executorPid = Number((await executor.query("select pg_backend_pid() p")).rows[0].p);
    const executing = executor.query("select public.execute_write_operation($1,$2) r", [key, payload]);
    await waitBlocked(executorPid);
    await administrator.query("begin"); await actor(administrator, owner.token);
    const adminPid = Number((await administrator.query("select pg_backend_pid() p")).rows[0].p);
    const request = { requestId: randomUUID(), targetId: E[2], expectedRevision: 0, patch: { name: "Initiator locked" } };
    const updating = administrator.query("select public.permission_admin_update($1) r", [request]);
    await waitBlocked(adminPid);
    expect(await blockingPids(adminPid)).toContain(executorPid);
    await writer.query("commit");
    const result = (await executing).rows[0].r;
    expect(result.operation).toMatchObject({ status: "applied", initiatedByEmployeeId: E[2], executedByEmployeeId: E[1] });
    await executor.query("commit");
    expect((await updating).rows[0].r.outcome).toBe("applied");
    await administrator.query("commit");
    const event = (await db.query("select initiated_by,executed_by from public.order_events where store_id=$1 and operation_id=$2", [S[0], key])).rows[0];
    expect(event).toEqual({ initiated_by: E[2], executed_by: E[1] });
    controls.initiatorPrelockedBeforeCatalog = true;
  } finally {
    await writer.query("rollback"); await executor.query("rollback"); await administrator.query("rollback");
    await writer.end(); await executor.end(); await administrator.end();
  }
});

test("TC-PERM-41 T06 negative control detects an initiator FK wait introduced after the catalog checkpoint", async () => {
  const needle = `e:=private.permission_financial_checkpoint(case when p_mode='execute' then array[w.initiated_by_employee_id] else array[]::uuid[] end);`;
  const restore = await mutateWriteRequest(needle, "e:=private.permission_financial_checkpoint();");
  const writer = await connection(), executor = await connection(), administrator = await connection();
  try {
    const f = await seed(), payload = payloads(f)["payment.take"], key = randomUUID();
    await setRights(E[2], ["payment.take"]);
    const initiator = await start(E[2]); await register(initiator.token, key, payload);
    const manager = await start(E[1]), owner = await start();
    await writer.query("begin");
    const writerPid = Number((await writer.query("select pg_backend_pid() p")).rows[0].p);
    await writer.query("select pg_advisory_xact_lock(hashtextextended('permission-catalog',0))");
    await executor.query("begin"); await actor(executor, manager.token);
    const executorPid = Number((await executor.query("select pg_backend_pid() p")).rows[0].p);
    const executing = executor.query("select public.execute_write_operation($1,$2) r", [key, payload]);
    await waitBlocked(executorPid);
    await administrator.query("begin"); await actor(administrator, owner.token);
    const adminPid = Number((await administrator.query("select pg_backend_pid() p")).rows[0].p);
    const updating = administrator.query("select public.permission_admin_update($1) r", [{
      requestId: randomUUID(), targetId: E[2], expectedRevision: 0, patch: { name: "Mutation holds initiator" },
    }]);
    await waitBlocked(adminPid);
    const adminBlockers = await blockingPids(adminPid);
    expect(adminBlockers).toContain(writerPid);
    expect(adminBlockers).not.toContain(executorPid);
    await writer.query("commit");
    expect((await updating).rows[0].r.outcome).toBe("applied");
    await waitBlocked(executorPid);
    expect(await blockingPids(executorPid)).toContain(adminPid);
    const faultObserved = true;
    await administrator.query("commit");
    expect((await executing).rows[0].r.operation.status).toBe("applied"); await executor.query("commit");
    expect(faultObserved).toBe(true);
    controls.initiatorPrelockMutationCaught = faultObserved;
  } finally {
    await writer.query("rollback"); await executor.query("rollback"); await administrator.query("rollback");
    await writer.end(); await executor.end(); await administrator.end(); await restore();
  }
});

test("TC-PERM-41 T06 takeover keeps initiator prelocked after its checkpoint while a catalog writer and admin queue", async () => {
  const gateKey = 202609160641;
  const f = await seed(), payload = payloads(f)["payment.take"], key = randomUUID();
  await setRights(E[2], ["payment.take"]);
  const initiator = await start(E[2]); await register(initiator.token, key, payload);
  await db.query("update public.employees set is_active=false where id=$1", [E[2]]);
  const manager = await start(E[1]), owner = await start();
  await db.query(`create function private.permission_financial_test_gate() returns trigger language plpgsql
    set search_path=pg_catalog as $$begin perform pg_advisory_xact_lock(${gateKey}::bigint); return new; end$$`);
  await db.query("create trigger permission_financial_test_gate before insert on public.order_events for each row execute function private.permission_financial_test_gate()");
  const gate = await connection(), executor = await connection(), writer = await connection(), administrator = await connection();
  try {
    await gate.query("begin"); await gate.query("select pg_advisory_xact_lock($1::bigint)", [gateKey]);
    await executor.query("begin"); await actor(executor, manager.token);
    const executorPid = Number((await executor.query("select pg_backend_pid() p")).rows[0].p);
    const executing = executor.query("select public.execute_write_operation($1,$2) r", [key, payload]);
    await waitBlocked(executorPid);

    await writer.query("begin");
    const writerPid = Number((await writer.query("select pg_backend_pid() p")).rows[0].p);
    const writing = writer.query("update public.permission_catalog set label_vi=label_vi where code='payment.take'");
    await waitBlocked(writerPid);
    expect(await blockingPids(writerPid)).toContain(executorPid);

    await administrator.query("begin"); await actor(administrator, owner.token);
    const adminPid = Number((await administrator.query("select pg_backend_pid() p")).rows[0].p);
    const updating = administrator.query("select public.permission_admin_update($1) r", [{
      requestId: randomUUID(), targetId: E[2], expectedRevision: 0, patch: { name: "Queued initiator" },
    }]);
    await waitBlocked(adminPid);
    expect(await blockingPids(adminPid)).toContain(executorPid);

    await gate.query("commit");
    const result = (await executing).rows[0].r; await executor.query("commit");
    expect(result.operation).toMatchObject({ status: "applied", initiatedByEmployeeId: E[2], executedByEmployeeId: E[1] });
    await writing; await writer.query("commit");
    expect((await updating).rows[0].r.outcome).toBe("applied"); await administrator.query("commit");
    controls.queuedWriterAndAdminAfterCheckpoint = true;
  } finally {
    await gate.query("rollback"); await executor.query("rollback"); await writer.query("rollback"); await administrator.query("rollback");
    await gate.end(); await executor.end(); await writer.end(); await administrator.end();
    await db.query("drop trigger if exists permission_financial_test_gate on public.order_events");
    await db.query("drop function if exists private.permission_financial_test_gate()");
  }
});

test("TC-PERM-41 T06 an initiator row wait precedes catalog and the final checkpoint observes session expiry", async () => {
  const clock = await installClock("2026-09-16T00:00:00Z");
  const administrator = await connection(), executor = await connection(), catalogWriter = await connection();
  try {
    const f = await seed(), payload = payloads(f)["payment.take"], key = randomUUID();
    await setRights(E[2], ["payment.take"]);
    const initiator = await start(E[2]); await register(initiator.token, key, payload);
    const manager = await start(E[1]), owner = await start();
    await catalogWriter.query("begin");
    await catalogWriter.query("select pg_advisory_xact_lock(hashtextextended('permission-catalog',0))");
    await administrator.query("begin"); await actor(administrator, owner.token);
    const adminPid = Number((await administrator.query("select pg_backend_pid() p")).rows[0].p);
    const updating = administrator.query("select public.permission_admin_update($1) r", [{
      requestId: randomUUID(), targetId: E[2], expectedRevision: 0, patch: { name: "Admin holds initiator" },
    }]);
    await waitBlocked(adminPid);
    await executor.query("begin"); await actor(executor, manager.token);
    const executorPid = Number((await executor.query("select pg_backend_pid() p")).rows[0].p);
    const pending = executor.query("select public.execute_write_operation($1,$2) r", [key, payload]);
    await waitBlocked(executorPid);
    expect(await blockingPids(executorPid)).toContain(adminPid);
    await clock.set("2026-09-16T12:00:00.001Z");
    await catalogWriter.query("commit");
    expect((await updating).rows[0].r.error.code).toBe("EMPLOYEE_SESSION_REQUIRED"); await administrator.query("commit");
    const result = (await pending).rows[0].r; await executor.query("commit");
    expect(result.error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
    const row = await operationRow(key); expect(row.status).toBe("pending"); expect(row.result).toBeNull();
    expect((await db.query("select count(*)::int n from public.payments where store_id=$1 and order_id=$2", [S[0], f.openOrderId])).rows[0].n).toBe(0);
    controls.initiatorBeforeCatalogCheckpoint = true;
  } finally {
    await administrator.query("rollback"); await executor.query("rollback"); await catalogWriter.query("rollback");
    await administrator.end(); await executor.end(); await catalogWriter.end(); await clock.restore();
  }
});

test("TC-PERM-41 T06 an initiator row wait independently observes K expiry with a still-valid session", async () => {
  const clock = await installClock("2026-09-16T00:00:00Z");
  const administrator = await connection(), executor = await connection(), catalogWriter = await connection();
  try {
    const f = await seed(), payload = payloads(f)["payment.take"], key = randomUUID();
    await setRights(E[2], ["payment.take"]);
    const initiator = await start(E[2]); await register(initiator.token, key, payload);
    await clock.set("2026-09-16T23:59:00Z");
    const manager = await start(E[1]), owner = await start();
    await catalogWriter.query("begin"); await catalogWriter.query("select pg_advisory_xact_lock(hashtextextended('permission-catalog',0))");
    await administrator.query("begin"); await actor(administrator, owner.token);
    const adminPid = Number((await administrator.query("select pg_backend_pid() p")).rows[0].p);
    const updating = administrator.query("select public.permission_admin_update($1) r", [{
      requestId: randomUUID(), targetId: E[2], expectedRevision: 0, patch: { name: "Admin holds K initiator" },
    }]);
    await waitBlocked(adminPid);
    await executor.query("begin"); await actor(executor, manager.token);
    const executorPid = Number((await executor.query("select pg_backend_pid() p")).rows[0].p);
    const pending = executor.query("select public.execute_write_operation($1,$2) r", [key, payload]);
    await waitBlocked(executorPid); expect(await blockingPids(executorPid)).toContain(adminPid);
    await clock.set("2026-09-17T00:00:00.001Z");
    await catalogWriter.query("commit");
    expect((await updating).rows[0].r.outcome).toBe("applied"); await administrator.query("commit");
    const result = (await pending).rows[0].r; await executor.query("commit");
    expect(result.operation.status).toBe("expired");
    expect((await operationRow(key)).result).toBeNull();
    expect((await db.query("select count(*)::int n from public.payments where store_id=$1 and order_id=$2", [S[0], f.openOrderId])).rows[0].n).toBe(0);
    controls.kExpiryAfterInitiatorWait = true;
  } finally {
    await administrator.query("rollback"); await executor.query("rollback"); await catalogWriter.query("rollback");
    await administrator.end(); await executor.end(); await catalogWriter.end(); await clock.restore();
  }
});

test.each(ttlCases)("TC-PERM-54 T06 pending TTL boundary %s at %s through %s preserves order lifetime", async (boundary, moment, mode) => {
  const clock = await installClock("2026-09-16T00:00:00Z");
  try {
    const f = await seed(), payload = payloads(f)["payment.take"], key = randomUUID();
    const owner = await start(); await register(owner.token, key, payload);
    await clock.set(moment);
    const fresh = await start();
    const response = mode === "get" ? await getOperation(fresh.token, key)
      : mode === "execute" ? await execute(fresh.token, key, payload)
      : mode === "cancel" ? await cancel(fresh.token, key)
      : (await listOperations(fresh.token, { p_limit: 100 })).page.items.find((item: { operationId: string }) => item.operationId === key);
    const expected = boundary !== "minus" ? "expired" : mode === "execute" ? "applied" : mode === "cancel" ? "cancelled" : "pending";
    expect(mode === "list" ? response.status : response.operation.status).toBe(expected);
    expect((await db.query("select status from public.orders where store_id=$1 and id=$2", [S[0], f.openOrderId])).rows[0].status)
      .toBe(expected === "applied" ? "paid" : "open");
  } finally { await clock.restore(); }
});

test("TC-PERM-54 T06 lost responses and later catalog edits never rewrite K payload, initiator, executor, or R1", async () => {
  const f = await seed(), payload = payloads(f)["payment.take"], key = randomUUID();
  const manager = await start(E[1]);
  await register(manager.token, key, payload); // Response deliberately discarded.
  const pending = await getOperation(manager.token, key);
  expect(pending.operation.status).toBe("pending");
  await execute(manager.token, key, payload); // Response deliberately discarded.
  const terminal = await getOperation(manager.token, key);
  expect(terminal.operation.status).toBe("applied");
  const rawBefore = await operationRow(key);
  const owner = await start();
  expect((await revokeAction(owner.token, E[1], "payment.take")).outcome).toBe("applied");
  expect((await getOperation(manager.token, key)).error.code).toBe("FORBIDDEN");
  await db.query("update public.menu_items set name='Catalog changed',price=99999 where id=$1", [f.menuItemId]);
  const recovered = await getOperation(owner.token, key);
  expect(recovered.operation.result).toEqual(terminal.operation.result);
  const replay = await execute(owner.token, key, payload);
  expect(replay.operation.result).toEqual(terminal.operation.result);
  expect(replay.operation).toMatchObject({ initiatedByEmployeeId: E[1], executedByEmployeeId: E[1] });
  const mismatched = { ...payload, receivedAmount: (payload as { receivedAmount: number }).receivedAmount + 1 };
  expect((await execute(owner.token, key, mismatched)).error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  const rawAfter = await operationRow(key);
  expect({ payload: rawAfter.payload, result: rawAfter.result, initiated: rawAfter.initiated_by_employee_id, executed: rawAfter.executed_by_employee_id, expires: rawAfter.expires_at })
    .toEqual({ payload: rawBefore.payload, result: rawBefore.result, initiated: rawBefore.initiated_by_employee_id, executed: rawBefore.executed_by_employee_id, expires: rawBefore.expires_at });
  expect((await db.query("select count(*)::int n from public.payments where store_id=$1 and order_id=$2", [S[0], f.openOrderId])).rows[0].n).toBe(1);
  controls.historicalTerminalImmutable = true;
});

test("TC-PERM-54 T06 a terminal operation created before activation replays its stored R1 without touching business rows", async () => {
  const rawBefore = (await db.query(`select to_jsonb(w) row from public.write_operations w
    where store_id=$1 and status='applied' and registered_at<'2026-09-02T00:00:00Z'
    order by registered_at,operation_id limit 1`, [S[0]])).rows[0]?.row;
  expect(rawBefore).toBeTruthy();
  const businessBefore = await businessState();
  const owner = await start();
  const recovered = await getOperation(owner.token, rawBefore.operation_id);
  expect(recovered.operation).toMatchObject({ status: "applied", result: rawBefore.result });
  const replayed = await execute(owner.token, rawBefore.operation_id, rawBefore.payload);
  expect(replayed.operation).toMatchObject({ status: "applied", result: rawBefore.result });
  const rawAfter = await operationRow(rawBefore.operation_id);
  expect({ payload: rawAfter.payload, result: rawAfter.result, expires: rawAfter.expires_at,
    initiated: rawAfter.initiated_by_employee_id, executed: rawAfter.executed_by_employee_id })
    .toEqual({ payload: rawBefore.payload, result: rawBefore.result, expires: rawBefore.expires_at,
      initiated: rawBefore.initiated_by_employee_id, executed: rawBefore.executed_by_employee_id });
  expect(await businessState()).toEqual(businessBefore);
  controls.preactivationTerminalReplay = true;
});

test("TC-PERM-54 T06 missing and cross-store operation IDs are indistinguishable", async () => {
  const owner = await start(), f = await seed(), payload = payloads(f)["payment.take"];
  const foreignKey = (await db.query("select operation_id from public.write_operations where store_id=$1 order by operation_id limit 1", [S[1]])).rows[0].operation_id;
  for (const key of [randomUUID(), foreignKey]) {
    expect((await getOperation(owner.token, key)).error.code).toBe("OPERATION_NOT_FOUND");
    expect((await execute(owner.token, key, payload)).error.code).toBe("OPERATION_NOT_FOUND");
    expect((await cancel(owner.token, key)).error.code).toBe("OPERATION_NOT_FOUND");
  }
  controls.crossStoreOperationHidden = true;
});
