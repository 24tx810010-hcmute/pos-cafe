import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
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
} from "./permissionFinancialFixture";

const PIN = "384729";
const source = permissionFingerprint();
const controls: Record<string, boolean> = {};

beforeAll(setupFinancialFixture);
afterEach(resetFinancialFixture);
afterAll(async () => {
  try { await cleanupFinancialFixture(); }
  finally {
    if (process.env.PERM_FINANCIAL_EVIDENCE_FILE) writeFileSync(
      process.env.PERM_FINANCIAL_EVIDENCE_FILE + ".regression.json",
      JSON.stringify({ sourceFingerprint: source, sourceAfter: permissionFingerprint(), fixtureEvidence, controls }, null, 2),
    );
  }
});

type Seed = {
  menuItemId: string;
  menuPrice: number;
  areaId: string;
  tableId: string;
  openOrderId: string;
  openVersion: number;
  openItemId: string;
  openQuantity: number;
  paidOrderId: string;
  paidVersion: number;
  paidPaymentId: string;
};

async function seed(): Promise<Seed> {
  const open = (await db.query(`select m.id menu_item_id,m.price::int menu_price,t.area_id,t.id table_id,
    o.id open_order_id,o.lock_version::int open_version,i.id open_item_id,i.quantity::int open_quantity
    from public.orders o join public.order_items i on i.store_id=o.store_id and i.order_id=o.id
    join public.menu_items m on m.store_id=i.store_id and m.id=i.menu_item_id
    join public.tables t on t.store_id=o.store_id and t.id=o.table_id
    where o.store_id=$1 and o.status='open' order by o.id,i.id limit 1`, [S[0]])).rows[0];
  const paid = (await db.query(`select o.id paid_order_id,o.lock_version::int paid_version,p.id paid_payment_id
    from public.orders o join public.payments p on p.store_id=o.store_id and p.order_id=o.id
    where o.store_id=$1 and o.status='paid' order by o.id,p.id limit 1`, [S[0]])).rows[0];
  if (!open || !paid) throw new Error("FINANCIAL_REGRESSION_SEED_INCOMPLETE");
  return {
    menuItemId: open.menu_item_id,
    menuPrice: open.menu_price,
    areaId: open.area_id,
    tableId: open.table_id,
    openOrderId: open.open_order_id,
    openVersion: open.open_version,
    openItemId: open.open_item_id,
    openQuantity: open.open_quantity,
    paidOrderId: paid.paid_order_id,
    paidVersion: paid.paid_version,
    paidPaymentId: paid.paid_payment_id,
  };
}

async function start(employeeId: string) {
  const session = await rpc("permission_start_session", { p_employee_id: employeeId, p_pin: PIN });
  expect(session.ok).toBe(true);
  return session.token as string;
}

async function register(token: string, key: string, payload: object) {
  const response = await rpc("register_write_operation", { p_operation_id: key, p_payload: payload }, token);
  expect(response.ok).toBe(true);
  return response.operation;
}

async function execute(token: string, key: string, payload: object) {
  const response = await rpc("execute_write_operation", { p_operation_id: key, p_payload: payload }, token);
  expect(response.ok).toBe(true);
  return response.operation;
}

async function apply(token: string, key: string, payload: object) {
  expect((await register(token, key, payload)).status).toBe("pending");
  return execute(token, key, payload);
}

function frozenTerminal(operation: Record<string, unknown>) {
  const { replayCount: _replayCount, ...terminal } = operation;
  return terminal;
}

async function expectFrozenReplay(token: string, key: string, payload: object, first: Record<string, unknown>) {
  const replay = await execute(token, key, payload);
  expect(Number(replay.replayCount)).toBe(Number(first.replayCount) + 1);
  expect(frozenTerminal(replay)).toEqual(frozenTerminal(first));
  const fetched = await rpc("get_write_operation", { p_operation_id: key }, token);
  expect(fetched.ok).toBe(true);
  expect(frozenTerminal(fetched.operation)).toEqual(frozenTerminal(first));
}

async function eventCount(key: string) {
  return Number((await db.query("select count(*)::int n from public.order_events where store_id=$1 and operation_id=$2", [S[0], key])).rows[0].n);
}

async function businessState() {
  const state: Record<string, unknown> = {};
  for (const table of ["orders", "order_items", "order_item_options", "payments", "order_events"])
    state[table] = (await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows
      from public.${table} t where store_id=$1`, [S[0]])).rows[0].rows;
  return state;
}

function expectUtcTimestamp(value: unknown) {
  expect(typeof value).toBe("string");
  expect(Number.isNaN(Date.parse(value as string))).toBe(false);
  expect(value).toMatch(/(?:Z|[+]00(?::?00)?)$/);
}

function expectUtcOperation(operation: any) {
  expectUtcTimestamp(operation.registeredAt);
  expectUtcTimestamp(operation.expiresAt);
  if (operation.decidedAt !== null) expectUtcTimestamp(operation.decidedAt);
  for (const value of [
    operation.result?.order?.createdAt,
    operation.result?.order?.updatedAt,
    operation.result?.order?.paidAt,
    operation.result?.payment?.createdAt,
    operation.result?.receipt?.paidAt,
  ]) if (value != null) expectUtcTimestamp(value);
}

test("PERM-T06 regression/protocol v1 create, retained-price update, and void-open keep one immutable result per K", async () => {
  const fixture = await seed();
  const tableId = randomUUID(), groupId = randomUUID(), optionValueId = randomUUID(), linkId = randomUUID();
  await db.query(`insert into public.tables(id,store_id,area_id,name,pos_x,pos_y,width,height,shape,status)
    values($1,$2,$3,'Regression table',100,100,80,80,'square','empty')`, [tableId, S[0], fixture.areaId]);
  await db.query(`insert into public.option_groups(id,store_id,name,select_type,is_required)
    values($1,$2,'Fixture topping group','multi',false)`, [groupId, S[0]]);
  await db.query(`insert into public.option_values(id,store_id,option_group_id,name,price_delta)
    values($1,$2,$3,'Fixture topping old',5000)`, [optionValueId, S[0], groupId]);
  await db.query(`insert into public.menu_item_option_groups(id,store_id,menu_item_id,option_group_id)
    values($1,$2,$3,$4)`, [linkId, S[0], fixture.menuItemId, groupId]);

  const token = await start(E[2]);
  const orderId = randomUUID(), oldLineId = randomUUID(), oldOptionId = randomUUID(), createKey = randomUUID();
  const create = {
    schemaVersion: 1, kind: "submit_order_changes", action: "create", orderId, expectedVersion: null,
    orderType: "dine_in", tableId,
    newLines: [{
      id: oldLineId, menuItemId: fixture.menuItemId, quantity: 2, quotedBasePrice: fixture.menuPrice,
      options: [{ id: oldOptionId, optionValueId, quantity: 1, quotedPriceDelta: 5000 }],
    }],
  };
  const created = await apply(token, createKey, create);
  expect(created).toMatchObject({ status: "applied", result: { order: {
    id: orderId, status: "open", lockVersion: 0, total: 70_000, createdByEmployeeId: E[2],
    items: [{ id: oldLineId, name: "Fixture coffee", quantity: 2, baseUnitPrice: 30_000, lineTotal: 70_000,
      options: [{ id: oldOptionId, name: "Fixture topping old", quantity: 1, priceDelta: 5000 }] }],
  } } });
  await expectFrozenReplay(token, createKey, create, created);
  expect(await eventCount(createKey)).toBe(1);
  expect((await db.query("select status from public.tables where store_id=$1 and id=$2", [S[0], tableId])).rows[0].status).toBe("occupied");

  await db.query("update public.menu_items set name='Fixture coffee current',price=40000 where store_id=$1 and id=$2", [S[0], fixture.menuItemId]);
  await db.query("update public.option_values set name='Fixture topping current',price_delta=7000 where store_id=$1 and id=$2", [S[0], optionValueId]);
  const newLineId = randomUUID(), newOptionId = randomUUID(), updateKey = randomUUID();
  const update = {
    schemaVersion: 1, kind: "submit_order_changes", action: "update", orderId, expectedVersion: 0,
    retainedLines: [{ sourceItemId: oldLineId, quantity: 1, note: "giữ giá cũ" }],
    newLines: [{
      id: newLineId, menuItemId: fixture.menuItemId, quantity: 1, quotedBasePrice: 40_000,
      options: [{ id: newOptionId, optionValueId, quantity: 1, quotedPriceDelta: 7000 }],
    }],
  };
  const updated = await apply(token, updateKey, update);
  expect(updated).toMatchObject({ status: "applied", result: { order: { id: orderId, status: "open", lockVersion: 1, total: 82_000 } } });
  expect(updated.result.order.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: oldLineId, name: "Fixture coffee", quantity: 1, baseUnitPrice: 30_000, lineTotal: 35_000,
      options: [expect.objectContaining({ name: "Fixture topping old", quantity: 1, priceDelta: 5000 })] }),
    expect.objectContaining({ id: newLineId, name: "Fixture coffee current", quantity: 1, baseUnitPrice: 40_000, lineTotal: 47_000,
      options: [expect.objectContaining({ name: "Fixture topping current", quantity: 1, priceDelta: 7000 })] }),
  ]));
  const snapshots = (await db.query(`select i.id,i.item_name,i.unit_price::int,o.option_name,o.price_delta::int,o.quantity::int option_quantity
    from public.order_items i join public.order_item_options o on o.store_id=i.store_id and o.order_item_id=i.id
    where i.store_id=$1 and i.order_id=$2 order by i.id`, [S[0], orderId])).rows;
  expect(snapshots).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: oldLineId, item_name: "Fixture coffee", unit_price: 30_000, option_name: "Fixture topping old", price_delta: 5000, option_quantity: 1 }),
    expect.objectContaining({ id: newLineId, item_name: "Fixture coffee current", unit_price: 40_000, option_name: "Fixture topping current", price_delta: 7000, option_quantity: 1 }),
  ]));
  await expectFrozenReplay(token, updateKey, update, updated);
  expect(await eventCount(updateKey)).toBe(1);

  const voidKey = randomUUID();
  const voidOpen = { schemaVersion: 1, kind: "submit_order_changes", action: "void_open", orderId, expectedVersion: 1 };
  const voided = await apply(token, voidKey, voidOpen);
  expect(voided).toMatchObject({ status: "applied", result: { order: { id: orderId, status: "void", lockVersion: 2, subtotal: 0, total: 0, items: [] } } });
  expect((await db.query("select status,quantity::int from public.order_items where store_id=$1 and order_id=$2 order by id", [S[0], orderId])).rows)
    .toEqual([expect.objectContaining({ status: "removed", quantity: 1 }), expect.objectContaining({ status: "removed", quantity: 1 })]);
  expect((await db.query("select status from public.tables where store_id=$1 and id=$2", [S[0], tableId])).rows[0].status).toBe("empty");
  expect((await db.query("select status from public.tables where store_id=$1 and id=$2", [S[0], fixture.tableId])).rows[0].status).toBe("occupied");
  await expectFrozenReplay(token, voidKey, voidOpen, voided);
  expect(await eventCount(voidKey)).toBe(1);
  controls.createUpdateVoidOpenRegression = true;
});

test("PERM-T06 regression/protocol v1 full payment freezes receipt and terminal R1 across catalog changes", async () => {
  const fixture = await seed(), token = await start(E[2]), key = randomUUID(), paymentId = randomUUID();
  const payload = {
    schemaVersion: 1, kind: "pay_order", orderId: fixture.openOrderId, paymentId,
    expectedVersion: fixture.openVersion, method: "cash", receivedAmount: 50_000,
  };
  const paid = await apply(token, key, payload);
  expect(paid).toMatchObject({ status: "applied", result: {
    order: { id: fixture.openOrderId, status: "paid", lockVersion: fixture.openVersion + 1, total: 30_000 },
    payment: { id: paymentId, orderId: fixture.openOrderId, employeeId: E[2], amount: 30_000, receivedAmount: 50_000, changeAmount: 20_000 },
    receipt: { orderId: fixture.openOrderId, paymentId, total: 30_000, receivedAmount: 50_000, changeAmount: 20_000,
      lines: [expect.objectContaining({ name: "Fixture coffee", baseUnitPrice: 30_000, quantity: 1, lineTotal: 30_000 })] },
  } });
  await db.query("update public.menu_items set name='Renamed after payment',price=91000 where store_id=$1 and id=$2", [S[0], fixture.menuItemId]);
  await expectFrozenReplay(token, key, payload, paid);
  expect(await eventCount(key)).toBe(1);
  expect((await db.query("select count(*)::int n from public.payments where store_id=$1 and id=$2", [S[0], paymentId])).rows[0].n).toBe(1);
  expect((await db.query("select status from public.tables where store_id=$1 and id=$2", [S[0], fixture.tableId])).rows[0].status).toBe("empty");
  controls.fullPaymentRegression = true;
});

test("PERM-T06 regression/protocol v1 partial split preserves source, paid child, payment, and terminal R1", async () => {
  const fixture = await seed();
  await db.query("update public.order_items set quantity=2 where store_id=$1 and id=$2", [S[0], fixture.openItemId]);
  await db.query("update public.orders set subtotal=60000,total=60000 where store_id=$1 and id=$2", [S[0], fixture.openOrderId]);
  const token = await start(E[1]), key = randomUUID(), childOrderId = randomUUID(), childItemId = randomUUID(), paymentId = randomUUID();
  const payload = {
    schemaVersion: 1, kind: "pay_order_items", orderId: fixture.openOrderId, newOrderId: childOrderId, paymentId,
    expectedVersion: fixture.openVersion, method: "cash", receivedAmount: 50_000,
    lines: [{ orderItemId: fixture.openItemId, quantity: 1, splitItemId: childItemId }],
  };
  const split = await apply(token, key, payload);
  expect(split).toMatchObject({ status: "applied", result: {
    sourceOrder: { id: fixture.openOrderId, status: "open", lockVersion: fixture.openVersion + 1, total: 30_000,
      items: [expect.objectContaining({ id: fixture.openItemId, quantity: 1, baseUnitPrice: 30_000 })] },
    paidOrder: { id: childOrderId, status: "paid", lockVersion: 0, total: 30_000,
      items: [expect.objectContaining({ id: childItemId, quantity: 1, baseUnitPrice: 30_000 })] },
    payment: { id: paymentId, orderId: childOrderId, employeeId: E[1], amount: 30_000, receivedAmount: 50_000, changeAmount: 20_000 },
  } });
  await expectFrozenReplay(token, key, payload, split);
  expect(await eventCount(key)).toBe(1);
  expect((await db.query("select count(*)::int n from public.payments where store_id=$1 and id=$2", [S[0], paymentId])).rows[0].n).toBe(1);
  expect((await db.query("select id,order_id,quantity::int from public.order_items where store_id=$1 and id=any($2::uuid[]) order by id", [S[0], [fixture.openItemId, childItemId]])).rows)
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixture.openItemId, order_id: fixture.openOrderId, quantity: 1 }),
      expect.objectContaining({ id: childItemId, order_id: childOrderId, quantity: 1 }),
    ]));
  expect((await db.query("select status from public.tables where store_id=$1 and id=$2", [S[0], fixture.tableId])).rows[0].status).toBe("occupied");
  controls.partialSplitRegression = true;
});

test("PERM-T06 regression/protocol v1 void-paid retains money and leaves a table occupied by another open order", async () => {
  const fixture = await seed();
  await db.query("update public.orders set order_type='dine_in',table_id=$3 where store_id=$1 and id=$2", [S[0], fixture.paidOrderId, fixture.tableId]);
  const token = await start(E[0]), key = randomUUID();
  const payload = {
    schemaVersion: 1, kind: "void_order", orderId: fixture.paidOrderId,
    expectedVersion: fixture.paidVersion, reason: "duplicate",
  };
  const voided = await apply(token, key, payload);
  expect(voided).toMatchObject({ status: "applied", result: { order: {
    id: fixture.paidOrderId, status: "void", lockVersion: fixture.paidVersion + 1, total: 30_000,
  } } });
  expect((await db.query("select amount::int,received_amount::int,change_amount::int from public.payments where store_id=$1 and id=$2", [S[0], fixture.paidPaymentId])).rows[0])
    .toEqual({ amount: 30_000, received_amount: 50_000, change_amount: 20_000 });
  expect((await db.query("select status from public.tables where store_id=$1 and id=$2", [S[0], fixture.tableId])).rows[0].status).toBe("occupied");
  expect((await db.query("select status,total::int from public.orders where store_id=$1 and id=$2", [S[0], fixture.openOrderId])).rows[0])
    .toEqual({ status: "open", total: 30_000 });
  await expectFrozenReplay(token, key, payload, voided);
  expect(await eventCount(key)).toBe(1);
  controls.voidPaidRegression = true;
});

test("PERM-T06 regression/a known price rejection rolls back business effects and remains the immutable terminal R1", async () => {
  const fixture = await seed(), token = await start(E[2]), key = randomUUID(), orderId = randomUUID();
  const payload = {
    schemaVersion: 1, kind: "submit_order_changes", action: "create", orderId, expectedVersion: null,
    orderType: "takeaway", tableId: null,
    newLines: [{ id: randomUUID(), menuItemId: fixture.menuItemId, quantity: 1, quotedBasePrice: fixture.menuPrice - 1, options: [] }],
  };
  const before = await businessState();
  const rejected = await apply(token, key, payload);
  expect(rejected).toMatchObject({ status: "rejected", result: null, error: { code: "PRICE_CHANGED" } });
  expect(await businessState()).toEqual(before);
  expect(await eventCount(key)).toBe(0);
  expect((await db.query("select count(*)::int n from public.orders where store_id=$1 and id=$2", [S[0], orderId])).rows[0].n).toBe(0);

  // Even after the catalog would make this payload valid for a fresh K, replay
  // must return the original rejected terminal record without business effects.
  await db.query("update public.menu_items set price=$3 where store_id=$1 and id=$2", [S[0], fixture.menuItemId, fixture.menuPrice - 1]);
  await expectFrozenReplay(token, key, payload, rejected);
  expect(await eventCount(key)).toBe(0);
  expect((await db.query("select count(*)::int n from public.orders where store_id=$1 and id=$2", [S[0], orderId])).rows[0].n).toBe(0);
  controls.knownRejectionRollback = true;
});

test("PERM-T06 regression/cash underpayment rejects without a payment or partial order effects", async () => {
  const fixture = await seed(), token = await start(E[2]), key = randomUUID(), paymentId = randomUUID();
  const payload = {
    schemaVersion: 1, kind: "pay_order", orderId: fixture.openOrderId, paymentId,
    expectedVersion: fixture.openVersion, method: "cash", receivedAmount: 29_999,
  };
  const before = await businessState();
  const rejected = await apply(token, key, payload);
  expect(rejected).toMatchObject({ status: "rejected", result: null, error: { code: "PAYMENT_AMOUNT_TOO_LOW" } });
  expect(await businessState()).toEqual(before);
  expect(await eventCount(key)).toBe(0);
  expect((await db.query("select count(*)::int n from public.payments where store_id=$1 and id=$2", [S[0], paymentId])).rows[0].n).toBe(0);
  expect((await db.query("select status,lock_version::int,total::int from public.orders where store_id=$1 and id=$2", [S[0], fixture.openOrderId])).rows[0])
    .toEqual({ status: "open", lock_version: fixture.openVersion, total: 30_000 });
  await expectFrozenReplay(token, key, payload, rejected);
  expect(await eventCount(key)).toBe(0);
  controls.underpaymentRollback = true;
});

test("PERM-T06 regression/protocol RPC timestamps stay UTC without changing an Asia/Bangkok SQL caller", async () => {
  const fixture = await seed(), token = await start(E[2]);
  const paymentKey = randomUUID(), paymentId = randomUUID();
  const paymentPayload = {
    schemaVersion: 1, kind: "pay_order", orderId: fixture.openOrderId, paymentId,
    expectedVersion: fixture.openVersion, method: "cash", receivedAmount: 50_000,
  };
  const cancelKey = randomUUID();
  const cancelPayload = {
    schemaVersion: 1, kind: "submit_order_changes", action: "create", orderId: randomUUID(), expectedVersion: null,
    orderType: "takeaway", tableId: null,
    newLines: [{ id: randomUUID(), menuItemId: fixture.menuItemId, quantity: 1, quotedBasePrice: fixture.menuPrice, options: [] }],
  };
  const client = await connection();
  let committed = false;
  try {
    await client.query("begin");
    await client.query("set local time zone 'Asia/Bangkok'");
    await actor(client, token, S[0]);
    expect((await client.query("select current_setting('TimeZone') zone")).rows[0].zone).toBe("Asia/Bangkok");

    const registered = (await client.query("select public.register_write_operation($1,$2) r", [paymentKey, paymentPayload])).rows[0].r;
    expect(registered).toMatchObject({ ok: true, operation: { status: "pending" } });
    expectUtcOperation(registered.operation);
    expect((await client.query("select current_setting('TimeZone') zone")).rows[0].zone).toBe("Asia/Bangkok");

    const executed = (await client.query("select public.execute_write_operation($1,$2) r", [paymentKey, paymentPayload])).rows[0].r;
    expect(executed).toMatchObject({ ok: true, operation: { status: "applied", result: { payment: { id: paymentId } } } });
    expectUtcOperation(executed.operation);
    const persisted = (await client.query("select result from public.write_operations where store_id=$1 and operation_id=$2", [S[0], paymentKey])).rows[0].result;
    expect(persisted).toEqual(executed.operation.result);
    for (const value of [persisted.order.createdAt, persisted.order.updatedAt, persisted.order.paidAt,
      persisted.payment.createdAt, persisted.receipt.paidAt]) expectUtcTimestamp(value);

    const fetched = (await client.query("select public.get_write_operation($1) r", [paymentKey])).rows[0].r;
    expect(fetched.operation.result).toEqual(executed.operation.result);
    expectUtcOperation(fetched.operation);
    const listed = (await client.query("select public.list_write_operations(null,null,null,null,null,null,100) r")).rows[0].r;
    const listedPayment = listed.page.items.find((item: { operationId: string }) => item.operationId === paymentKey);
    expect(listedPayment.result).toEqual(executed.operation.result);
    expectUtcTimestamp(listed.page.serverTime);
    expectUtcOperation(listedPayment);

    const cancelRegistered = (await client.query("select public.register_write_operation($1,$2) r", [cancelKey, cancelPayload])).rows[0].r;
    expect(cancelRegistered.operation.status).toBe("pending");
    expectUtcOperation(cancelRegistered.operation);
    const cancelled = (await client.query("select public.cancel_write_operation($1) r", [cancelKey])).rows[0].r;
    expect(cancelled.operation.status).toBe("cancelled");
    expectUtcOperation(cancelled.operation);
    expect((await client.query("select current_setting('TimeZone') zone")).rows[0].zone).toBe("Asia/Bangkok");
    await client.query("commit"); committed = true;
  } finally {
    if (!committed) await client.query("rollback");
    await client.end();
  }
  controls.utcRpcTimestamps = true;
});
