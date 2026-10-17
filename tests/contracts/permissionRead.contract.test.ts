import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { observeCandidateStage } from "./permissionStageObservation";
import { permissionFingerprint } from "../../scripts/permission-preflight-core.mjs";
import {
  actor,
  cleanupReadFixture,
  connection,
  db,
  EMPLOYEE_IDS as E,
  env,
  fixtureEvidence,
  readFingerprint,
  readRelations,
  resetReadFixture,
  rpc,
  setupReadFixture,
  STORE_IDS as S,
} from "./permissionReadFixture";

const PIN = "384729";
const source = permissionFingerprint();
const controls: Record<string, unknown> = {};
const permissionCodes = [
  "floor.view", "order.create", "order.update", "order.voidOpen", "payment.take",
  "orderHistory.view", "order.voidPaid", "menu.manage", "floor.manage", "employee.manage",
  "employee.permission.edit", "report.view", "settings.manage", "data.clearDemo", "receipt.reprint",
] as const;
type PermissionCode = typeof permissionCodes[number];

type ReadSeed = {
  paidOrderId: string;
  openOrderId: string;
  paymentId: string;
  tableId: string;
  menuItemId: string;
  paidOrderNo: number;
  businessDate: string;
};
type EndpointCase = {
  label: string;
  name: string;
  permission: PermissionCode | null;
  args(seed: ReadSeed): Record<string, unknown>;
  assertProjection(result: any): void;
};

beforeAll(async () => {
  await setupReadFixture();
  await observeCandidateStage(db);
  controls.endpointCount = 13;
});
afterEach(resetReadFixture);
afterAll(async () => {
  try {
    await cleanupReadFixture();
  } finally {
    if (process.env.PERM_READ_EVIDENCE_FILE) {
      writeFileSync(process.env.PERM_READ_EVIDENCE_FILE, JSON.stringify({
        sourceFingerprint: source,
        sourceAfter: permissionFingerprint(),
        fixtureEvidence,
        controls,
      }, null, 2));
    }
  }
});

const start = (id = E[0], pin = PIN) => rpc("permission_start_session", { p_employee_id: id, p_pin: pin });
const call = (endpoint: EndpointCase, token: string, seed: ReadSeed, extra: Record<string, unknown> = {}) =>
  rpc(endpoint.name, { ...endpoint.args(seed), ...extra }, token);
const exactKeys = (value: object, keys: string[]) => expect(Object.keys(value).sort()).toEqual([...keys].sort());

async function seed(): Promise<ReadSeed> {
  const row = (await db.query(`select
    (select id from public.orders where store_id=$1 and status='paid' order by id limit 1) paid_order_id,
    (select order_no::int from public.orders where store_id=$1 and status='paid' order by id limit 1) paid_order_no,
    (select business_date::text from public.orders where store_id=$1 and status='paid' order by id limit 1) business_date,
    (select id from public.orders where store_id=$1 and status='open' order by id limit 1) open_order_id,
    (select id from public.payments where store_id=$1 order by id limit 1) payment_id,
    (select id from public.tables where store_id=$1 order by id limit 1) table_id,
    (select id from public.menu_items where store_id=$1 order by id limit 1) menu_item_id`, [S[0]])).rows[0];
  if (!row.paid_order_id || !row.open_order_id || !row.payment_id || !row.table_id || !row.menu_item_id) {
    throw new Error("READ_FIXTURE_INCOMPLETE");
  }
  return {
    paidOrderId: row.paid_order_id,
    openOrderId: row.open_order_id,
    paymentId: row.payment_id,
    tableId: row.table_id,
    menuItemId: row.menu_item_id,
    paidOrderNo: row.paid_order_no,
    businessDate: row.business_date,
  };
}

async function setRights(employeeId: string, grants: readonly PermissionCode[]) {
  const denied = permissionCodes.filter(code => code !== "floor.view" && !grants.includes(code));
  await db.query("update public.employees set permission_overrides=$2 where id=$1", [employeeId, {
    grants: [...grants],
    denies: denied,
  }]);
}

async function expire(token: string, revoked = false) {
  if (revoked) {
    await db.query(`update private.employee_sessions set revoked_at=statement_timestamp()
      where token_hash=extensions.digest(convert_to($1,'UTF8'),'sha256')`, [token]);
  } else {
    await db.query(`update private.employee_sessions
      set issued_at=statement_timestamp()-interval '13 hours',expires_at=statement_timestamp()-interval '1 hour'
      where token_hash=extensions.digest(convert_to($1,'UTF8'),'sha256')`, [token]);
  }
}

async function sqlCall(storeId: string, name: string, args: unknown[]) {
  const client = await connection();
  try {
    await client.query("begin");
    await actor(client, "", storeId);
    const placeholders = args.map((_, index) => `$${index + 1}`).join(",");
    const result = (await client.query(`select public.${name}(${placeholders}) result`, args)).rows[0].result;
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

async function startInStore(storeId: string, employeeId: string) {
  return sqlCall(storeId, "permission_start_session", [employeeId, PIN]);
}

async function sqlRejected(statement: string, token?: string) {
  const client = await connection();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await actor(client, token);
    let sqlState = "";
    try { await client.query(statement); } catch (error) { sqlState = (error as { code?: string }).code ?? ""; }
    expect(sqlState).toBe("42501");
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

async function blockOrder(orderId: string) {
  const client = await connection();
  let closed = false;
  await client.query("begin");
  const pid = Number((await client.query("select pg_backend_pid() pid")).rows[0].pid);
  await client.query("select 1 from public.orders where id=$1 for update", [orderId]);
  return {
    client,
    pid,
    release: async () => { if (closed) return; closed = true; await client.query("commit"); await client.end(); },
    close: async () => { if (closed) return; closed = true; await client.query("rollback"); await client.end(); },
  };
}

async function waitContender(blockerPid: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const row = (await db.query(`select pid from pg_stat_activity where datname=current_database()
      and $1=any(pg_blocking_pids(pid)) and wait_event_type='Lock' order by pid limit 1`, [blockerPid])).rows[0];
    if (row) return Number(row.pid);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error("READ_CONTENDER_NOT_BLOCKED");
}
async function settle(pending: Promise<unknown> | null) {
  if (pending) await pending.catch(() => undefined);
}

const endpoints: EndpointCase[] = [
  {
    label: "floor operational", name: "permission_get_floor_operational", permission: null, args: () => ({}),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]); exactKeys(result.data, ["floorPlan", "openOrders"]);
      exactKeys(result.data.floorPlan, ["areas", "tables", "decorItems"]); expect(result.data.openOrders.length).toBeGreaterThan(0);
      exactKeys(result.data.openOrders[0], ["id", "tableId", "orderType", "orderNo", "total", "createdAt"]);
    },
  },
  {
    label: "POS menu", name: "permission_get_pos_menu", permission: "order.create", args: () => ({}),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]);
      exactKeys(result.data, ["categories", "menuItems", "optionGroups", "optionValues", "menuItemOptionGroups"]);
      expect(result.data.menuItems.length).toBeGreaterThan(0); expect(result.data.menuItems.every((item: any) => item.isAvailable === true)).toBe(true);
      exactKeys(result.data.menuItems[0], ["id", "categoryId", "name", "price", "imageAssetKey", "sortOrder", "isAvailable"]);
    },
  },
  {
    label: "open order detail", name: "permission_get_open_order_detail", permission: "order.update", args: value => ({ p_order_id: value.openOrderId }),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]);
      exactKeys(result.data, ["id", "orderNo", "orderType", "tableId", "status", "total", "lockVersion", "items"]);
      expect(result.data.status).toBe("open"); expect(result.data.items.length).toBeGreaterThan(0);
    },
  },
  {
    label: "paid order for void", name: "permission_get_paid_order_for_void", permission: "order.voidPaid", args: value => ({ p_order_id: value.paidOrderId }),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]);
      exactKeys(result.data, ["id", "orderNo", "status", "total", "lockVersion"]); expect(result.data.status).toBe("paid");
    },
  },
  {
    label: "order history page", name: "permission_list_order_history", permission: "orderHistory.view",
    args: () => ({ p_filter: { page: 1, pageSize: 20 } }),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]); exactKeys(result.data, ["items", "total"]);
      expect(result.data.items.length).toBeGreaterThan(0); expect(result.data.items.every((item: any) => item.status !== "open")).toBe(true);
      exactKeys(result.data.items[0], ["id", "orderNo", "status", "total", "lockVersion", "tableId", "orderType", "businessDate"]);
    },
  },
  {
    label: "order history detail", name: "permission_get_order_history_detail", permission: "orderHistory.view", args: value => ({ p_order_id: value.paidOrderId }),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]);
      exactKeys(result.data, ["id", "orderNo", "status", "total", "lockVersion", "tableId", "orderType", "businessDate",
        "createdAt", "updatedAt", "createdByEmployeeId", "lastModifiedByEmployeeId", "items", "paidAt", "payment",
        "voidedAt", "voidedByEmployeeId", "voidReasonCode", "voidReasonNote", "receiptSnapshot", "cashierName", "voidedByName"]);
      expect(result.data.status).toBe("paid"); expect(typeof result.data.cashierName).toBe("string");
    },
  },
  {
    label: "payment receipt", name: "get_payment_receipt", permission: "orderHistory.view", args: value => ({ p_order_id: value.paidOrderId }),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "receipt", "legacyMetadata"]);
      expect(result.legacyMetadata).toBe(false); exactKeys(result.receipt, ["schemaVersion", "orderId", "paymentId", "orderNo",
        "businessDate", "storeName", "address", "footer", "tableName", "paidAt", "employeeName", "lines", "total", "receivedAmount", "changeAmount"]);
    },
  },
  {
    label: "sales report", name: "permission_get_sales_report", permission: "report.view", args: value => ({ p_filter: { businessDate: value.businessDate } }),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]);
      exactKeys(result.data, ["businessDate", "revenue", "paidOrders", "averageTicket", "topItemName", "hourlyRevenue", "voidCount", "voidAmount"]);
      expect(result.data.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(Array.isArray(result.data.hourlyRevenue)).toBe(true);
    },
  },
  {
    label: "report paid-order summaries", name: "permission_list_report_orders", permission: "report.view",
    args: value => ({ p_filter: { fromDate: value.businessDate, toDate: value.businessDate } }),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]); expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0); expect(result.data.length).toBeLessThanOrEqual(20);
      exactKeys(result.data[0], ["id", "orderNo", "businessDate", "orderType", "total", "status", "tableName"]);
      expect(result.data.every((order: any) => order.status === "paid" && (order.tableName === null || typeof order.tableName === "string"))).toBe(true);
    },
  },
  {
    label: "menu administration", name: "permission_get_menu_admin", permission: "menu.manage", args: () => ({}),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]);
      exactKeys(result.data, ["categories", "menuItems", "optionGroups", "optionValues", "menuItemOptionGroups"]);
    },
  },
  {
    label: "floor administration", name: "permission_get_floor_admin", permission: "floor.manage", args: () => ({}),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]); exactKeys(result.data, ["areas", "tables", "decorItems"]);
    },
  },
  {
    label: "settings administration", name: "permission_get_settings_admin", permission: "settings.manage", args: () => ({}),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]);
      exactKeys(result.data, ["storeId", "displayName", "address", "currency", "timezone", "billFooter"]);
    },
  },
  {
    label: "store display", name: "permission_get_store_display", permission: null, args: () => ({}),
    assertProjection(result) {
      expect(result.ok).toBe(true); exactKeys(result, ["ok", "data"]);
      exactKeys(result.data, ["displayName", "address", "currency", "timezone", "billFooter"]);
    },
  },
];

test("TC-PERM-25 T07 read endpoint manifest has exactly thirteen non-overloaded JSON contracts", async () => {
  const names = endpoints.map(endpoint => endpoint.name).sort();
  expect(new Set(names).size).toBe(13);
  const rows = (await db.query(`select p.proname,p.prosecdef,pg_get_function_result(p.oid) result,
      pg_get_function_identity_arguments(p.oid) arguments
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any($1::text[]) order by p.proname`, [names])).rows;
  expect(rows).toHaveLength(13);
  expect(rows.map(row => row.proname)).toEqual(names);
  expect(rows.every(row => row.prosecdef === true && row.result === "jsonb")).toBe(true);
  expect(rows.every(row => !/actor|employee|permission/i.test(row.arguments))).toBe(true);
});

test.each(endpoints)("TC-PERM-25 T07 allowed projection: $label", async endpoint => {
  const fixture = await seed();
  await setRights(E[2], endpoint.permission ? [endpoint.permission] : []);
  const session = await start(E[2]);
  expect(session.ok).toBe(true);
  endpoint.assertProjection(await call(endpoint, session.token, fixture));
  controls.allowedEndpointCount = Number(controls.allowedEndpointCount ?? 0) + 1;
});

test.each(endpoints)("TC-PERM-25 T07 missing permission or invalid baseline session: $label", async endpoint => {
  const fixture = await seed();
  await setRights(E[2], []);
  const session = await start(E[2]);
  expect(session.ok).toBe(true);
  const response = await call(endpoint, endpoint.permission === null ? "x".repeat(43) : session.token, fixture);
  expect(response.error.code).toBe(endpoint.permission === null ? "EMPLOYEE_SESSION_REQUIRED" : "FORBIDDEN");
  controls.deniedEndpointCount = Number(controls.deniedEndpointCount ?? 0) + 1;
});

test.each(endpoints)("TC-PERM-28 T07 expired session is rechecked: $label", async endpoint => {
  const fixture = await seed();
  await setRights(E[2], endpoint.permission ? [endpoint.permission] : []);
  const session = await start(E[2]);
  await expire(session.token);
  expect((await call(endpoint, session.token, fixture)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  controls.expiredEndpointCount = Number(controls.expiredEndpointCount ?? 0) + 1;
});

test.each(endpoints)("TC-PERM-25/28 T07 wrong-store session is rejected: $label", async endpoint => {
  const fixture = await seed();
  const foreign = await startInStore(S[1], E[3]);
  expect(foreign.ok).toBe(true);
  expect((await call(endpoint, foreign.token, fixture)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  controls.foreignEndpointCount = Number(controls.foreignEndpointCount ?? 0) + 1;
});

test.each(endpoints)("TC-PERM-28 T07 forged actor fields cannot bind any read RPC: $label", async endpoint => {
  const fixture = await seed();
  await setRights(E[2], endpoint.permission ? [endpoint.permission] : []);
  const session = await start(E[2]);
  const response = await call(endpoint, session.token, fixture, { p_actor_id: E[0], p_permissions: permissionCodes });
  expect(response.code).toBe("PGRST202");
  controls.forgedEndpointCount = Number(controls.forgedEndpointCount ?? 0) + 1;
  if (["allowedEndpointCount", "deniedEndpointCount", "expiredEndpointCount", "foreignEndpointCount", "forgedEndpointCount"]
    .every(key => controls[key] === endpoints.length)) controls.endpointPermissionMatrix = true;
});

test("TC-PERM-02/26 T07 pre-PIN roster remains minimal while raw employee reads stay closed", async () => {
  const roster = await rpc("permission_list_roster");
  expect(roster.ok).toBe(true); expect(roster.data).toHaveLength(3);
  expect(roster.data.every((entry: object) => Object.keys(entry).sort().join() === "id,name")).toBe(true);
  await sqlRejected("select id,name from public.employees");
  const owner = await start(E[0]);
  expect((await rpc("permission_admin_list", {}, owner.token)).ok).toBe(true);
  expect((await rpc("permission_admin_audit", { p_filter: { limit: 1 } }, owner.token)).ok).toBe(true);
  controls.administrationStillUsable = true;
});

test("TC-PERM-13 T07 history and payment independently permit receipt reads without granting reprint or write authority", async () => {
  const fixture = await seed();
  for (const permission of ["orderHistory.view", "payment.take"] as const) {
    await setRights(E[2], [permission]);
    const session = await start(E[2]);
    expect((await rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, session.token)).ok).toBe(true);
    expect((await rpc("permission_get_paid_order_for_void", { p_order_id: fixture.paidOrderId }, session.token)).error.code).toBe("FORBIDDEN");
    await resetReadFixture();
  }
  await setRights(E[2], ["receipt.reprint"]);
  const reprintOnly = await start(E[2]);
  expect((await rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, reprintOnly.token)).error.code).toBe("FORBIDDEN");
});

test("TC-PERM-25 T07 each alternative open-order action grants only the operational detail", async () => {
  const fixture = await seed();
  for (const permission of ["order.update", "order.voidOpen", "payment.take"] as const) {
    await setRights(E[2], [permission]);
    const session = await start(E[2]);
    expect((await rpc("permission_get_open_order_detail", { p_order_id: fixture.openOrderId }, session.token)).ok).toBe(true);
    expect((await rpc("permission_get_order_history_detail", { p_order_id: fixture.paidOrderId }, session.token)).error.code).toBe("FORBIDDEN");
    await resetReadFixture();
  }
});

test("TC-PERM-25 T07 one isolated action never opens unrelated read endpoints", async () => {
  const fixture = await seed();
  await setRights(E[2], ["report.view"]);
  const session = await start(E[2]);
  expect((await rpc("permission_get_sales_report", { p_filter: { businessDate: fixture.businessDate } }, session.token)).ok).toBe(true);
  for (const [name, args] of [
    ["permission_get_menu_admin", {}], ["permission_get_floor_admin", {}], ["permission_get_settings_admin", {}],
    ["permission_list_order_history", { p_filter: { page: 1, pageSize: 20 } }],
    ["permission_get_open_order_detail", { p_order_id: fixture.openOrderId }],
  ] as const) expect((await rpc(name, args, session.token)).error.code).toBe("FORBIDDEN");
});

test("TC-PERM-25 T07 report-only authority can list report summaries but cannot read history detail or receipt", async () => {
  const fixture = await seed();
  await setRights(E[2], ["report.view"]);
  const session = await start(E[2]);
  const summaries = await rpc("permission_list_report_orders", {
    p_filter: { fromDate: fixture.businessDate, toDate: fixture.businessDate },
  }, session.token);
  expect(summaries.ok).toBe(true); expect(summaries.data.length).toBeGreaterThan(0);
  expect((await rpc("permission_get_order_history_detail", { p_order_id: fixture.paidOrderId }, session.token)).error.code).toBe("FORBIDDEN");
  expect((await rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, session.token)).error.code).toBe("FORBIDDEN");
});

test("TC-PERM-26/27 T07 all sensitive public relations lose table and inherited column SELECT grants", async () => {
  const existing = (await db.query(`select c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any($1::text[])`, [readRelations])).rows;
  expect(existing.map(row => row.relname).sort()).toEqual([...readRelations].sort());
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const relation of readRelations) {
      const privileges = (await db.query(`select has_table_privilege($1,$2,'SELECT') table_select,
        has_any_column_privilege($1,$2,'SELECT') column_select`, [role, `public.${relation}`])).rows[0];
      expect(privileges, `${role} ${relation}`).toEqual({ table_select: false, column_select: false });
    }
  }
  expect(fixtureEvidence.readAclNegativeControl).toBe(true);
  controls.rawSelectClosed = true;
});

test("TC-PERM-26 T07 real authenticated SQL cannot read raw tables through owner or cashier sessions", async () => {
  const owner = await start(E[0]);
  await setRights(E[2], ["orderHistory.view"]);
  const cashier = await start(E[2]);
  const probes = [
    "select id from public.stores", "select display_name from public.store_settings", "select name from public.employees",
    "select code from public.permission_catalog", "select role_code from public.role_permission_defaults",
    "select name from public.categories", "select price from public.menu_items", "select name from public.option_groups",
    "select name from public.option_values", "select menu_item_id from public.menu_item_option_groups",
    "select name from public.floor_areas", "select status from public.tables", "select asset_key from public.floor_decor_items",
    "select total from public.orders", "select unit_price from public.order_items", "select price_delta from public.order_item_options",
    "select receipt_snapshot from public.payments", "select payload from public.write_operations", "select summary from public.order_events",
    "select before_snapshot from public.employee_admin_audit", "select id from public.history_entries",
  ];
  for (const token of [owner.token, cashier.token]) for (const probe of probes) await sqlRejected(probe, token);
  controls.rawSelectProbeCount = probes.length * 2;
});

test("TC-PERM-26 T07 authenticated cannot execute private projection helpers by grant or actual SQL call", async () => {
  const helpers = (await db.query(`select p.oid::regprocedure::text signature,p.proname,
      has_function_privilege('authenticated',p.oid,'EXECUTE') allowed
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname like 'permission_read_%' order by p.proname,p.oid`)).rows;
  expect(helpers.length).toBeGreaterThanOrEqual(8);
  expect(helpers.every(row => row.allowed === false)).toBe(true);
  await sqlRejected("select private.permission_read_missing()");
  await sqlRejected(`select private.permission_read_floor('${S[0]}'::uuid)`);
  await sqlRejected("select private.permission_read_guard(array['floor.view']::text[])");
  controls.privateHelperClosed = true;
});

test("TC-PERM-25/26 T07 positive REST controls distinguish closed raw access from an unavailable backend", async () => {
  const fixture = await seed();
  const owner = await start(E[0]);
  for (const endpoint of endpoints) endpoint.assertProjection(await call(endpoint, owner.token, fixture));
  controls.positiveProjectionCount = endpoints.length;
});

test("TC-PERM-25 T07 history accepts typed boundaries and sanitizes REST grammar characters without widening scope", async () => {
  const fixture = await seed();
  await setRights(E[2], ["orderHistory.view"]);
  const session = await start(E[2]);
  const list = (filter: object) => rpc("permission_list_order_history", { p_filter: filter }, session.token);

  expect((await list({ page: 1, pageSize: 1 })).data.items).toHaveLength(1);
  expect((await list({ page: Number.MAX_SAFE_INTEGER, pageSize: 1 })).data.items).toHaveLength(0);
  expect((await list({ page: 1, pageSize: 100, fromDate: fixture.businessDate, toDate: fixture.businessDate,
    status: "paid", orderType: "takeaway" })).data.items.some((item: any) => item.id === fixture.paidOrderId)).toBe(true);

  const sanitized = await list({ page: 1, pageSize: 20, search: `  %, (#${fixture.paidOrderNo})  ` });
  expect(sanitized.data.items.map((item: any) => item.id)).toContain(fixture.paidOrderId);
  expect((await list({ page: 1, pageSize: 20, search: `#${fixture.paidOrderNo}0` })).data.items).toHaveLength(0);
  expect((await list({ page: 1, pageSize: 20, search: fixture.paidOrderId.slice(0, 18).toUpperCase() })).data.items[0].id).toBe(fixture.paidOrderId);

  await db.query("update public.orders set table_id=$2 where store_id=$1 and id=$3", [S[0], fixture.tableId, fixture.paidOrderId]);
  expect((await list({ page: 1, pageSize: 20, search: fixture.tableId.slice(0, 18).toUpperCase() })).data.items[0].id).toBe(fixture.paidOrderId);
  expect((await list({ page: 1, pageSize: 20, search: "definitely-no-match", tableIds: [fixture.tableId] })).data.items[0].id).toBe(fixture.paidOrderId);
  expect((await list({ page: 1, pageSize: 20, search: `#${fixture.paidOrderNo}`, tableIds: [randomUUID()] })).data.items[0].id).toBe(fixture.paidOrderId);
  controls.historyFilterBoundaries = true;
});

test("TC-PERM-25 T07 REST preserves integral JSON decimals for history page bounds", async () => {
  await setRights(E[2], ["orderHistory.view"]);
  const session = await start(E[2]);
  const response = await fetch(env.api + "/rest/v1/rpc/permission_list_order_history", {
    method: "POST",
    headers: { apikey: env.anonKey, Authorization: "Bearer " + env.storeJwt, "Content-Type": "application/json", "x-pos-employee-token": session.token },
    body: '{"p_filter":{"page":1.0,"pageSize":20.0}}',
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json();
  expect(response.ok).toBe(true); expect(result.ok).toBe(true); expect(result.data.items.length).toBeGreaterThan(0);
});

const invalidHistoryFilters: Array<[string, object]> = [
  ["missing page", { pageSize: 20 }], ["missing pageSize", { page: 1 }], ["page zero", { page: 0, pageSize: 20 }],
  ["page fractional", { page: 1.5, pageSize: 20 }], ["page string", { page: "1", pageSize: 20 }],
  ["page above safe integer", { page: Number.MAX_SAFE_INTEGER + 1, pageSize: 20 }], ["pageSize zero", { page: 1, pageSize: 0 }],
  ["pageSize above 100", { page: 1, pageSize: 101 }], ["date format", { page: 1, pageSize: 20, fromDate: "2026-9-01" }],
  ["impossible date", { page: 1, pageSize: 20, fromDate: "2026-02-30" }],
  ["descending dates", { page: 1, pageSize: 20, fromDate: "2026-09-02", toDate: "2026-09-01" }],
  ["open status", { page: 1, pageSize: 20, status: "open" }], ["unknown order type", { page: 1, pageSize: 20, orderType: "delivery" }],
  ["non-string search", { page: 1, pageSize: 20, search: 7 }], ["non-array tableIds", { page: 1, pageSize: 20, tableIds: "x" }],
  ["invalid table UUID", { page: 1, pageSize: 20, tableIds: ["x"] }], ["unknown key", { page: 1, pageSize: 20, actorId: E[0] }],
];

test.each(invalidHistoryFilters)("TC-PERM-25 T07 history rejects typed filter boundary: %s", async (_label, filter) => {
  await setRights(E[2], ["orderHistory.view"]);
  const session = await start(E[2]);
  expect((await rpc("permission_list_order_history", { p_filter: filter }, session.token)).error.code).toBe("INVALID_WRITE_REQUEST");
});

test.each([
  ["missing businessDate", {}], ["non-string businessDate", { businessDate: 20260901 }],
  ["bad businessDate format", { businessDate: "2026-9-01" }], ["impossible businessDate", { businessDate: "2026-02-30" }],
  ["unknown report key", { businessDate: "2026-09-01", timezone: "UTC" }],
])("TC-PERM-25 T07 report rejects typed filter boundary: %s", async (_label, filter) => {
  await setRights(E[2], ["report.view"]);
  const session = await start(E[2]);
  expect((await rpc("permission_get_sales_report", { p_filter: filter }, session.token)).error.code).toBe("INVALID_WRITE_REQUEST");
});

const invalidReportOrderFilters: Array<[string, object]> = [
  ["forged limit", { fromDate: "2026-09-01", toDate: "2026-09-03", limit: 20 }],
  ["forged page", { fromDate: "2026-09-01", toDate: "2026-09-03", page: 1 }],
  ["forged status", { fromDate: "2026-09-01", toDate: "2026-09-03", status: "paid" }],
  ["missing fromDate", { toDate: "2026-09-03" }],
  ["invalid date format", { fromDate: "2026-9-01", toDate: "2026-09-03" }],
  ["impossible date", { fromDate: "2026-09-01", toDate: "2026-02-30" }],
  ["descending dates", { fromDate: "2026-09-03", toDate: "2026-09-01" }],
];

test.each(invalidReportOrderFilters)("TC-PERM-25 T07 report-order filter rejects boundary: %s", async (_label, filter) => {
  await setRights(E[2], ["report.view"]);
  const session = await start(E[2]);
  expect((await rpc("permission_list_report_orders", { p_filter: filter }, session.token)).error.code).toBe("INVALID_WRITE_REQUEST");
});

test("TC-PERM-25 T07 wrong-state, missing, and cross-store targets use safe purpose-specific errors", async () => {
  const fixture = await seed();
  const foreignPaid = (await db.query("select id from public.orders where store_id=$1 and status='paid' order by id limit 1", [S[1]])).rows[0].id;
  const missing = randomUUID();
  await setRights(E[2], ["order.update", "order.voidPaid", "orderHistory.view", "payment.take"]);
  const session = await start(E[2]);
  for (const target of [fixture.paidOrderId, foreignPaid, missing]) {
    expect((await rpc("permission_get_open_order_detail", { p_order_id: target }, session.token)).error.code).toBe("NOT_FOUND");
  }
  for (const target of [fixture.openOrderId, foreignPaid, missing]) {
    expect((await rpc("permission_get_paid_order_for_void", { p_order_id: target }, session.token)).error.code).toBe("NOT_FOUND");
    expect((await rpc("permission_get_order_history_detail", { p_order_id: target }, session.token)).error.code).toBe("NOT_FOUND");
  }
  for (const target of [fixture.openOrderId, foreignPaid, missing]) {
    expect((await rpc("get_payment_receipt", { p_order_id: target }, session.token)).error.code).toBe("RECEIPT_UNAVAILABLE");
  }
});

test("TC-PERM-38 T07 stored and legacy receipts preserve historical lines and expose the legacy marker", async () => {
  const fixture = await seed();
  await setRights(E[2], ["orderHistory.view"]);
  const session = await start(E[2]);
  const stored = await rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, session.token);
  expect(stored.ok).toBe(true); expect(stored.legacyMetadata).toBe(false);
  exactKeys(stored.receipt.lines[0], ["orderItemId", "menuItemId", "name", "quantity", "baseUnitPrice", "options", "unitTotal", "lineTotal", "note"]);
  if (stored.receipt.lines[0].options.length > 0) {
    exactKeys(stored.receipt.lines[0].options[0], ["optionValueId", "name", "priceDelta", "quantity"]);
  }
  await db.query("update public.menu_items set name='Current renamed item',price=99000 where id=$1", [fixture.menuItemId]);
  await db.query("update public.store_settings set display_name='Current renamed store',bill_footer='Current footer' where store_id=$1", [S[0]]);
  const reread = await rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, session.token);
  expect(reread).toEqual(stored);

  await db.query("update public.payments set receipt_snapshot=null where id=$1", [fixture.paymentId]);
  const legacy = await rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, session.token);
  expect(legacy.ok).toBe(true); expect(legacy.legacyMetadata).toBe(true);
  expect(legacy.receipt.lines.map((line: any) => [line.name, line.baseUnitPrice, line.quantity]))
    .toEqual(stored.receipt.lines.map((line: any) => [line.name, line.baseUnitPrice, line.quantity]));
  expect(legacy.receipt.orderId).toBe(fixture.paidOrderId); expect(legacy.receipt.paymentId).toBe(fixture.paymentId);
  controls.receiptSnapshotsImmutable = true;
});

test("TC-PERM-25/38 T07 receipt projections deep-redact unknown root line and option fields without rewriting storage", async () => {
  const fixture = await seed();
  const original = (await db.query("select receipt_snapshot snapshot from public.payments where id=$1", [fixture.paymentId])).rows[0].snapshot;
  const injected = structuredClone(original);
  injected.rootSecret = "root-marker";
  injected.lines[0].lineSecret = "line-marker";
  injected.lines[0].options = [{ optionValueId: randomUUID(), name: "Historical option", priceDelta: 7, quantity: 1, optionSecret: "option-marker" }];
  await db.query("update public.payments set receipt_snapshot=$2 where id=$1", [fixture.paymentId, injected]);
  await setRights(E[2], ["orderHistory.view"]);
  const session = await start(E[2]);
  const receipt = await rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, session.token);
  const history = await rpc("permission_get_order_history_detail", { p_order_id: fixture.paidOrderId }, session.token);
  expect(receipt.ok).toBe(true); expect(history.ok).toBe(true);
  expect(JSON.stringify(receipt)).not.toMatch(/root-marker|line-marker|option-marker|rootSecret|lineSecret|optionSecret/);
  expect(JSON.stringify(history)).not.toMatch(/root-marker|line-marker|option-marker|rootSecret|lineSecret|optionSecret/);
  exactKeys(receipt.receipt.lines[0], ["orderItemId", "menuItemId", "name", "quantity", "baseUnitPrice", "options", "unitTotal", "lineTotal", "note"]);
  exactKeys(receipt.receipt.lines[0].options[0], ["optionValueId", "name", "priceDelta", "quantity"]);
  expect(receipt.receipt.lines[0].options[0]).toMatchObject({ name: "Historical option", priceDelta: 7, quantity: 1 });
  expect(history.data.receiptSnapshot).toEqual(receipt.receipt);
  expect((await db.query("select receipt_snapshot snapshot from public.payments where id=$1", [fixture.paymentId])).rows[0].snapshot).toEqual(injected);
});

test("TC-PERM-38 T07 voided receipt becomes unavailable while terminal R1 remains byte-equivalent", async () => {
  const fixture = await seed();
  await setRights(E[2], ["orderHistory.view"]);
  const session = await start(E[2]);
  expect((await rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, session.token)).ok).toBe(true);
  const before = (await db.query("select result from public.write_operations where store_id=$1 and payload->>'orderId'=$2", [S[0], fixture.paidOrderId])).rows[0].result;
  await db.query(`update public.orders set status='void',voided_at=statement_timestamp(),voided_by_employee_id=$3,
    void_reason_code='duplicate',void_reason_note='fixture transition',lock_version=lock_version+1 where store_id=$1 and id=$2`, [S[0], fixture.paidOrderId, E[0]]);
  expect((await rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, session.token)).error.code).toBe("RECEIPT_UNAVAILABLE");
  expect((await db.query("select result from public.write_operations where store_id=$1 and payload->>'orderId'=$2", [S[0], fixture.paidOrderId])).rows[0].result).toEqual(before);
});

test("TC-PERM-38 T07 a revoked token cannot reuse an already-read receipt", async () => {
  const fixture = await seed();
  await setRights(E[2], ["orderHistory.view"]);
  const session = await start(E[2]);
  expect((await rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, session.token)).ok).toBe(true);
  await expire(session.token, true);
  expect((await rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, session.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
});

test("TC-PERM-25/38 T07 every read endpoint is side-effect free", async () => {
  const fixture = await seed();
  const owner = await start(E[0]);
  const before = await readFingerprint();
  const evidenceBefore = (await db.query(`select
    (select count(*)::int from public.employee_admin_audit) audit,
    (select count(*)::int from public.store_change_signals) signals,
    (select count(*)::int from public.order_events) events`)).rows[0];
  for (const endpoint of endpoints) endpoint.assertProjection(await call(endpoint, owner.token, fixture));
  expect(await readFingerprint()).toBe(before);
  expect((await db.query(`select
    (select count(*)::int from public.employee_admin_audit) audit,
    (select count(*)::int from public.store_change_signals) signals,
    (select count(*)::int from public.order_events) events`)).rows[0]).toEqual(evidenceBefore);
  controls.readOnlyStateUnchanged = true;
});

test("TC-PERM-25 T07 report buckets paid timestamps in store timezone and rounds a noninteger average", async () => {
  const fixture = await seed();
  const first = randomUUID(), second = randomUUID(), firstItem = randomUUID(), secondItem = randomUUID();
  await db.query("update public.store_settings set timezone='Asia/Ho_Chi_Minh' where store_id=$1", [S[0]]);
  await db.query(`insert into public.orders(id,store_id,order_type,order_no,business_date,status,subtotal,total,employee_id,
      created_by_employee_id,last_modified_by_employee_id,created_at,updated_at,paid_at)
    values($1,$3,'takeaway',9101,'2026-09-03','paid',1,1,$4,$4,$4,'2026-09-03T18:30:00Z','2026-09-03T18:30:00Z',null),
          ($2,$3,'takeaway',9102,'2026-09-03','paid',2,2,$4,$4,$4,'2026-09-03T19:30:00Z','2026-09-03T19:30:00Z',null)`,
    [first, second, S[0], E[0]]);
  await db.query(`insert into public.order_items(id,store_id,order_id,menu_item_id,item_name,quantity,unit_price,status)
    values($1,$5,$3,$6,'B item',1,1,'done'),($2,$5,$4,$6,'A item',1,2,'done')`,
    [firstItem, secondItem, first, second, S[0], fixture.menuItemId]);
  await setRights(E[2], ["report.view"]);
  const session = await start(E[2]);
  const report = await rpc("permission_get_sales_report", { p_filter: { businessDate: "2026-09-03" } }, session.token);
  expect(report.data).toMatchObject({ businessDate: "2026-09-03", revenue: 3, paidOrders: 2, averageTicket: 2, topItemName: "A item" });
  expect(report.data.hourlyRevenue).toEqual([{ label: "01", revenue: 1 }, { label: "02", revenue: 2 }]);
  controls.reportStoreTimezone = true;
});

test("TC-PERM-25 T07 report summaries cap the whole inclusive date range at twenty paid orders in deterministic order", async () => {
  const fixture = await seed();
  const inserted: Array<{ id: string; businessDate: string; orderNo: number }> = [];
  for (let index = 0; index < 22; index += 1) {
    const id = randomUUID();
    const businessDate = index < 11 ? "2026-09-02" : "2026-09-03";
    const orderNo = 100 + index;
    inserted.push({ id, businessDate, orderNo });
    await db.query(`insert into public.orders(id,store_id,table_id,order_type,order_no,business_date,status,subtotal,total,
      employee_id,created_by_employee_id,last_modified_by_employee_id,created_at,updated_at,paid_at)
      values($1,$2,$3,'takeaway',$4,$5,'paid',$4,$4,$6,$6,$6,'2026-09-03T00:00:00Z','2026-09-03T00:00:00Z','2026-09-03T00:00:00Z')`,
    [id, S[0], index === 21 ? fixture.tableId : null, orderNo, businessDate, E[0]]);
  }
  const openId = randomUUID();
  await db.query(`insert into public.orders(id,store_id,order_type,order_no,business_date,status,subtotal,total,employee_id,
    created_by_employee_id,last_modified_by_employee_id) values($1,$2,'takeaway',999,'2026-09-03','open',999,999,$3,$3,$3)`,
  [openId, S[0], E[0]]);

  await setRights(E[2], ["report.view"]);
  const session = await start(E[2]);
  const list = (fromDate: string, toDate: string) => rpc("permission_list_report_orders", { p_filter: { fromDate, toDate } }, session.token);
  const result = await list("2026-09-01", "2026-09-03");
  expect(result.ok).toBe(true); expect(result.data).toHaveLength(20);
  const expected = [...inserted].sort((left, right) => right.businessDate.localeCompare(left.businessDate)
    || right.orderNo - left.orderNo || right.id.localeCompare(left.id)).slice(0, 20).map(order => order.id);
  expect(result.data.map((order: any) => order.id)).toEqual(expected);
  expect(result.data.some((order: any) => order.id === openId)).toBe(false);
  expect(result.data.every((order: any) => order.status === "paid")).toBe(true);
  expect(result.data[0]).toMatchObject({ id: inserted[21].id, tableName: "Fixture table" });
  for (const order of result.data) exactKeys(order, ["id", "orderNo", "businessDate", "orderType", "total", "status", "tableName"]);

  const lowerBoundary = await list("2026-09-01", "2026-09-01");
  expect(lowerBoundary.data.map((order: any) => order.id)).toContain(fixture.paidOrderId);
  const upperBoundary = await list("2026-09-03", "2026-09-03");
  expect(upperBoundary.data).toHaveLength(11);
  await db.query("update public.tables set deleted_at=statement_timestamp(),deleted_by_employee_id=$2 where id=$1", [fixture.tableId, E[0]]);
  const afterTableDelete = await list("2026-09-03", "2026-09-03");
  expect(afterTableDelete.data.find((order: any) => order.id === inserted[21].id).tableName).toBeNull();
  controls.reportOrderSummaries = true;
});

test("TC-PERM-25/38 T07 open-detail and receipt state transitions committed during an order lock wait are observed", async () => {
  const fixture = await seed();
  const owner = await start(E[0]);
  const openBlocker = await blockOrder(fixture.openOrderId);
  let openRead: Promise<any> | null = null;
  try {
    openRead = rpc("permission_get_open_order_detail", { p_order_id: fixture.openOrderId }, owner.token);
    await waitContender(openBlocker.pid);
    await openBlocker.client.query("update public.orders set status='paid',paid_at=statement_timestamp() where id=$1", [fixture.openOrderId]);
    await openBlocker.release();
    expect((await openRead).error.code).toBe("NOT_FOUND");
  } finally { await openBlocker.close(); await settle(openRead); }

  const receiptBlocker = await blockOrder(fixture.paidOrderId);
  let receiptRead: Promise<any> | null = null;
  try {
    receiptRead = rpc("get_payment_receipt", { p_order_id: fixture.paidOrderId }, owner.token);
    await waitContender(receiptBlocker.pid);
    await receiptBlocker.client.query(`update public.orders set status='void',voided_at=statement_timestamp(),voided_by_employee_id=$2,
      void_reason_code='duplicate',lock_version=lock_version+1 where id=$1`, [fixture.paidOrderId, E[0]]);
    await receiptBlocker.release();
    expect((await receiptRead).error.code).toBe("RECEIPT_UNAVAILABLE");
  } finally { await receiptBlocker.close(); await settle(receiptRead); }
  controls.orderStateFreshAfterWait = true;
});

test.each([["expired", false], ["revoked", true]] as const)(
  "TC-PERM-28 T07 session becomes %s while open-detail waits and is rejected after the lock",
  async (_label, revoke) => {
    const fixture = await seed();
    await setRights(E[2], ["order.update"]);
    const session = await start(E[2]);
    const blocker = await blockOrder(fixture.openOrderId);
    let pending: Promise<any> | null = null;
    try {
      pending = rpc("permission_get_open_order_detail", { p_order_id: fixture.openOrderId }, session.token);
      await waitContender(blocker.pid);
      await expire(session.token, revoke);
      await blocker.release();
      expect((await pending).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
    } finally { await blocker.close(); await settle(pending); }
    controls.sessionWaitVariantCount = Number(controls.sessionWaitVariantCount ?? 0) + 1;
    if (controls.sessionWaitVariantCount === 2) controls.sessionFreshAfterWait = true;
  },
);

test("TC-PERM-25/28 T07 employee action revoke committed during an order wait is observed", async () => {
  const fixture = await seed();
  await setRights(E[2], ["order.update"]);
  const session = await start(E[2]);
  const blocker = await blockOrder(fixture.openOrderId);
  let pending: Promise<any> | null = null;
  try {
    pending = rpc("permission_get_open_order_detail", { p_order_id: fixture.openOrderId }, session.token);
    await waitContender(blocker.pid);
    await setRights(E[2], []);
    await blocker.release();
    expect((await pending).error.code).toBe("FORBIDDEN");
  } finally { await blocker.close(); await settle(pending); }
  controls.authorityFreshAfterWait = true;
});

test("TC-PERM-25/28 T07 catalog default removal committed during an order wait is observed", async () => {
  const fixture = await seed();
  const session = await start(E[2]);
  const removed = ["order.update", "order.voidOpen", "payment.take"];
  const initialDefaults = (await db.query(`select permission_code from public.role_permission_defaults
    where role_code='cashier' and permission_code=any($1::text[]) order by permission_code`, [removed])).rows.map(row => row.permission_code as string);
  const catalogState = (await db.query("select revision::text,changed_in_transaction::text changed from public.permission_catalog_state where singleton")).rows[0];
  const blocker = await blockOrder(fixture.openOrderId);
  let pending: Promise<any> | null = null;
  try {
    pending = rpc("permission_get_open_order_detail", { p_order_id: fixture.openOrderId }, session.token);
    await waitContender(blocker.pid);
    await db.query("delete from public.role_permission_defaults where role_code='cashier' and permission_code=any($1::text[])", [removed]);
    await blocker.release();
    expect((await pending).error.code).toBe("FORBIDDEN");
    controls.catalogFreshAfterWait = true;
  } finally {
    await blocker.close();
    await settle(pending);
    await db.query(`insert into public.role_permission_defaults(role_code,permission_code)
      select 'cashier',x from unnest($1::text[]) x on conflict do nothing`, [initialDefaults]);
    await db.query("update public.permission_catalog_state set revision=$1::bigint,changed_in_transaction=$2::xid8 where singleton", [catalogState.revision, catalogState.changed]);
  }
});

test("TC-PERM-25 T07 negative control proves the post-lock permission detector fails when removed", async () => {
  const fixture = await seed();
  await setRights(E[2], []);
  const session = await start(E[2]);
  expect((await rpc("permission_get_open_order_detail", { p_order_id: fixture.openOrderId }, session.token)).error.code).toBe("FORBIDDEN");
  const original = (await db.query("select pg_get_functiondef('public.permission_get_open_order_detail(uuid)'::regprocedure) definition")).rows[0].definition as string;
  const weakened = original.replace(/\s*perform private\.permission_read_guard\(array\[[^;]+\]\);/i, "");
  expect(weakened).not.toBe(original);
  try {
    await db.query(weakened);
    const leaked = await rpc("permission_get_open_order_detail", { p_order_id: fixture.openOrderId }, session.token);
    expect(leaked.ok).toBe(true);
    controls.postLockAuthorityNegativeControl = true;
  } finally {
    await db.query(original);
    await db.query("notify pgrst,'reload schema'");
  }
});
