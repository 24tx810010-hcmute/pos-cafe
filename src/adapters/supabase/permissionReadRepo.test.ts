import { describe, expect, it, vi } from "vitest";
import { employeeCredential } from "./employeeCredential";
import { SupabasePermissionReadRepo } from "./permissionReadRepo";
import type { SupabaseAnyClient } from "./repoShared";

const actorToken = "a".repeat(43);
const nextToken = "b".repeat(43);
const sessionMessage = "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.";
const id = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const orderId = id(1), tableId = id(2), areaId = id(3), menuId = id(4), categoryId = id(5);
const optionGroupId = id(6), optionValueId = id(7), linkId = id(8), itemId = id(9), optionId = id(10);
const employeeId = id(11), paymentId = id(12), storeId = id(13);

const menu = {
  categories: [{ id: categoryId, name: "Cà phê", sortOrder: 0, privateMac: "secret" }],
  menuItems: [{ id: menuId, categoryId, name: "Đen đá", price: 30000, imageAssetKey: null, sortOrder: 0, isAvailable: true, token: actorToken }],
  optionGroups: [{ id: optionGroupId, name: "Đường", selectType: "single", isRequired: false, sortOrder: 0 }],
  optionValues: [{ id: optionValueId, optionGroupId, name: "Ít", priceDelta: 0, sortOrder: 0 }],
  menuItemOptionGroups: [{ id: linkId, menuItemId: menuId, optionGroupId, sortOrder: 0 }],
  extra: "secret",
};
const floor = {
  areas: [{ id: areaId, name: "Tầng trệt", sortOrder: 0 }],
  tables: [{ id: tableId, areaId, name: "Bàn 1", backgroundAssetKey: null, posX: 1, posY: 2, width: 80, height: 80,
    shape: "square", rotation: 0, seats: 4, sortOrder: 0, status: "occupied", passcodeHash: "secret" }],
  decorItems: [{ id: id(14), areaId, kind: "plant", label: null, assetKey: "plant-1", posX: 4, posY: 5,
    width: 20, height: 20, rotation: 0, zIndex: 1, isLocked: false }],
};
const orderItem = {
  id: itemId, menuItemId: menuId, itemName: "Đen đá", quantity: 1, unitPrice: 30000, note: null,
  options: [{ id: optionId, optionValueId, optionName: "Ít", priceDelta: 0, quantity: 1, rawSecret: "secret" }],
};
const summary = {
  id: orderId, orderNo: 7, status: "paid", total: 30000, lockVersion: 2, tableId, orderType: "dine_in", businessDate: "2026-09-17",
};
const detail = {
  ...summary, items: [orderItem], paidAt: "2026-09-17T01:00:00.000Z",
  payment: { id: paymentId, employeeId, method: "cash", amount: 30000, receivedAmount: 50000, changeAmount: 20000, paidAt: "2026-09-17T01:00:00.000Z" },
  voidedAt: null, voidedByEmployeeId: null, voidReasonCode: null, voidReasonNote: null,
  createdAt: "2026-09-17T00:00:00.000Z", updatedAt: "2026-09-17T01:00:00.000Z",
  createdByEmployeeId: employeeId, lastModifiedByEmployeeId: employeeId, cashierName: "Mai", voidedByName: null,
  internalPayload: "secret",
};
const receipt = {
  schemaVersion: 1, orderId, paymentId, orderNo: 7, businessDate: "2026-09-17", storeName: "Quán", address: "1 Đường A",
  footer: "Cảm ơn", tableName: "Bàn 1", paidAt: "2026-09-17T01:00:00.000Z", employeeName: "Mai",
  lines: [{ orderItemId: itemId, menuItemId: menuId, name: "Đen đá", quantity: 1, baseUnitPrice: 30000,
    options: [{ optionValueId, name: "Ít", priceDelta: 0, quantity: 1 }], unitTotal: 30000, lineTotal: 30000, note: null }],
  total: 30000, receivedAmount: 50000, changeAmount: 20000, sql: "secret",
};
const report = {
  businessDate: "2026-09-17", revenue: 30000, paidOrders: 1, averageTicket: 30000, topItemName: "Đen đá",
  hourlyRevenue: [{ label: "01:00", revenue: 30000 }], voidCount: 0, voidAmount: 0,
};
const settings = { storeId, displayName: "Quán", address: "1 Đường A", currency: "VND", timezone: "Asia/Ho_Chi_Minh", billFooter: "Cảm ơn", privateKey: "secret" };

type Response = { data: unknown; error: unknown };
type Deferred = { promise: Promise<Response>; resolve(value: Response): void; reject(value: unknown): void };
function deferred(): Deferred {
  let resolve!: Deferred["resolve"], reject!: Deferred["reject"];
  const promise = new Promise<Response>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function clientWith(responses: Array<Promise<Response>>) {
  const headers = vi.fn();
  const rpc = vi.fn((..._args: unknown[]) => {
    const response = responses.shift(); if (!response) throw new Error("missing response");
    return Object.assign(response, { setHeader(name: string, value: string) { headers(name, value); return response; } });
  });
  const client = { rpc } as unknown as SupabaseAnyClient;
  employeeCredential(client).token = actorToken;
  return { client, rpc, headers };
}
const ok = (data: unknown) => Promise.resolve({ data: { ok: true, data, transportToken: actorToken }, error: null });
const receiptOk = () => Promise.resolve({ data: { ok: true, receipt, legacyMetadata: false, transportToken: actorToken }, error: null });

describe("SupabasePermissionReadRepo", () => {
  it("routes every staged read RPC with the current credential and passes typed filters unchanged", async () => {
    const historyFilter = { page: 2, pageSize: 25, status: "paid" as const, search: "#7" };
    const reportFilter = { businessDate: "2026-09-17" };
    const reportSummaryFilter = { fromDate: "2026-09-01", toDate: "2026-09-17" };
    const reportOrder = { id: orderId, orderNo: 7, businessDate: "2026-09-17", orderType: "dine_in", total: 30000,
      status: "paid", tableName: "Bàn 1", tableId, lockVersion: 2, items: [orderItem], payment: { token: actorToken }, receipt, employeeId };
    const { client, rpc, headers } = clientWith([
      ok({ floorPlan: floor, openOrders: [{ id: orderId, tableId, orderType: "dine_in", orderNo: 7, total: 30000, createdAt: "2026-09-17T00:00:00Z" }] }),
      ok(menu), ok({ id: orderId, orderNo: 7, orderType: "dine_in", tableId, status: "open", total: 30000, lockVersion: 1, items: [orderItem] }),
      ok({ id: orderId, orderNo: 7, status: "paid", total: 30000, lockVersion: 2 }), ok({ items: [summary], total: 1 }),
      ok(detail), receiptOk(), ok(report), ok([reportOrder]), ok(menu), ok(floor), ok(settings),
      ok({ displayName: settings.displayName, address: settings.address, billFooter: settings.billFooter, currency: "VND", timezone: settings.timezone, hash: "secret" }),
    ]);
    const repo = new SupabasePermissionReadRepo(client);
    const results = [
      await repo.getFloorOperational(), await repo.getPosMenu(), await repo.getOpenOrderDetail(orderId),
      await repo.getPaidOrderForVoid(orderId), await repo.listOrderHistory(historyFilter), await repo.getOrderHistoryDetail(orderId),
      await repo.getReceipt(orderId), await repo.getSalesReport(reportFilter), await repo.listReportOrders(reportSummaryFilter), await repo.getMenuAdmin(), await repo.getFloorAdmin(),
      await repo.getSettingsAdmin(), await repo.getStoreDisplay(),
    ];

    expect(rpc.mock.calls).toEqual([
      ["permission_get_floor_operational"], ["permission_get_pos_menu"],
      ["permission_get_open_order_detail", { p_order_id: orderId }], ["permission_get_paid_order_for_void", { p_order_id: orderId }],
      ["permission_list_order_history", { p_filter: historyFilter }], ["permission_get_order_history_detail", { p_order_id: orderId }],
      ["get_payment_receipt", { p_order_id: orderId }], ["permission_get_sales_report", { p_filter: reportFilter }],
      ["permission_list_report_orders", { p_filter: reportSummaryFilter }], ["permission_get_menu_admin"], ["permission_get_floor_admin"],
      ["permission_get_settings_admin"], ["permission_get_store_display"],
    ]);
    expect((rpc.mock.calls[4][1] as { p_filter: unknown }).p_filter).toEqual(historyFilter);
    expect((rpc.mock.calls[4][1] as { p_filter: unknown }).p_filter).not.toBe(historyFilter);
    expect((rpc.mock.calls[7][1] as { p_filter: unknown }).p_filter).toEqual(reportFilter);
    expect((rpc.mock.calls[7][1] as { p_filter: unknown }).p_filter).not.toBe(reportFilter);
    expect((rpc.mock.calls[8][1] as { p_filter: unknown }).p_filter).toEqual(reportSummaryFilter);
    expect((rpc.mock.calls[8][1] as { p_filter: unknown }).p_filter).not.toBe(reportSummaryFilter);
    expect(headers).toHaveBeenCalledTimes(13);
    expect(headers.mock.calls.every(([name, token]) => name === "x-pos-employee-token" && token === actorToken)).toBe(true);
    expect(JSON.stringify(results)).not.toMatch(/secret|privateMac|passcodeHash|transportToken|internalPayload|rawSecret|privateKey|sql|hash/);
    expect(results[5]).toMatchObject({ cashierName: "Mai", voidedByName: null });
    expect(results[8]).toEqual([{ id: orderId, orderNo: 7, businessDate: "2026-09-17", orderType: "dine_in", total: 30000, status: "paid", tableName: "Bàn 1" }]);
    expect(results[12]).toEqual({ displayName: "Quán", address: "1 Đường A", billFooter: "Cảm ơn", currency: "VND", timezone: "Asia/Ho_Chi_Minh" });
  });

  it("preserves long and legacy business text without applying write-only bounds", async () => {
    const legacy = "Dòng cũ\n" + "🌸".repeat(2_000);
    const { client } = clientWith([ok({ ...settings, displayName: legacy, address: legacy, billFooter: legacy })]);
    expect(await new SupabasePermissionReadRepo(client).getSettingsAdmin()).toMatchObject({ displayName: legacy, address: legacy, billFooter: legacy });
  });

  it("validates and canonicalizes read inputs locally before issuing RPCs", async () => {
    const uppercase = "50000000-0000-4000-8000-0000000000AA";
    const { client, rpc } = clientWith([
      ok({ id: uppercase.toLowerCase(), orderNo: 7, status: "paid", total: 30000, lockVersion: 2 }),
      ok({ items: [], total: 0 }), ok(report),
    ]);
    const repo = new SupabasePermissionReadRepo(client);
    await repo.getPaidOrderForVoid(uppercase);
    await repo.listOrderHistory({ page: 1, pageSize: 10, search: "  #7%,(bàn)  ", tableIds: [uppercase, uppercase.toLowerCase()] });
    await repo.getSalesReport({ businessDate: "2024-02-29" });
    expect(rpc.mock.calls).toEqual([
      ["permission_get_paid_order_for_void", { p_order_id: uppercase.toLowerCase() }],
      ["permission_list_order_history", { p_filter: { page: 1, pageSize: 10, search: "#7bàn", tableIds: [uppercase.toLowerCase()] } }],
      ["permission_get_sales_report", { p_filter: { businessDate: "2024-02-29" } }],
    ]);
  });

  it.each([
    ["open order", (repo: SupabasePermissionReadRepo) => repo.getOpenOrderDetail("not-an-id")],
    ["paid order", (repo: SupabasePermissionReadRepo) => repo.getPaidOrderForVoid("00000000-0000-0000-0000-000000000000")],
    ["history detail", (repo: SupabasePermissionReadRepo) => repo.getOrderHistoryDetail("not-an-id")],
    ["receipt", (repo: SupabasePermissionReadRepo) => repo.getReceipt("not-an-id")],
    ["history filter", (repo: SupabasePermissionReadRepo) => repo.listOrderHistory({ page: 0, pageSize: 10 })],
    ["report filter", (repo: SupabasePermissionReadRepo) => repo.getSalesReport({ businessDate: "2023-02-29" })],
    ["report summary limit", (repo: SupabasePermissionReadRepo) => repo.listReportOrders({ fromDate: "2026-09-01", toDate: "2026-09-17", limit: 21 } as never)],
    ["report summary range", (repo: SupabasePermissionReadRepo) => repo.listReportOrders({ fromDate: "2026-09-18", toDate: "2026-09-17" })],
    ["report summary field", (repo: SupabasePermissionReadRepo) => repo.listReportOrders({ fromDate: "2026-09-01", toDate: "2026-09-17", actorId: employeeId } as never)],
  ])("rejects invalid %s input without sending a request", async (_name, invoke) => {
    const { client, rpc } = clientWith([]);
    await expect(invoke(new SupabasePermissionReadRepo(client))).rejects.toMatchObject({
      code: "INVALID_WRITE_REQUEST", message: "Dữ liệu thao tác không hợp lệ. Vui lòng tải lại và kiểm tra.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("checks local employee credential availability before validating caller input", async () => {
    const { client, rpc } = clientWith([]); employeeCredential(client).token = null;
    await expect(new SupabasePermissionReadRepo(client).getOpenOrderDetail("not-an-id")).rejects.toMatchObject({
      code: "EMPLOYEE_SESSION_REQUIRED", message: sessionMessage,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["floor", (repo: SupabasePermissionReadRepo) => repo.getFloorOperational(), ok(null)],
    ["menu", (repo: SupabasePermissionReadRepo) => repo.getPosMenu(), ok(null)],
    ["open order", (repo: SupabasePermissionReadRepo) => repo.getOpenOrderDetail(orderId), ok(null)],
    ["paid order", (repo: SupabasePermissionReadRepo) => repo.getPaidOrderForVoid(orderId), ok(null)],
    ["history page", (repo: SupabasePermissionReadRepo) => repo.listOrderHistory({ page: 1, pageSize: 10 }), ok(null)],
    ["history detail", (repo: SupabasePermissionReadRepo) => repo.getOrderHistoryDetail(orderId), ok(null)],
    ["receipt", (repo: SupabasePermissionReadRepo) => repo.getReceipt(orderId), Promise.resolve({ data: { ok: true, receipt: null, legacyMetadata: false }, error: null })],
    ["report", (repo: SupabasePermissionReadRepo) => repo.getSalesReport({ businessDate: "2026-09-17" }), ok(null)],
    ["report orders", (repo: SupabasePermissionReadRepo) => repo.listReportOrders({ fromDate: "2026-09-01", toDate: "2026-09-17" }), ok([null])],
    ["menu admin", (repo: SupabasePermissionReadRepo) => repo.getMenuAdmin(), ok(null)],
    ["floor admin", (repo: SupabasePermissionReadRepo) => repo.getFloorAdmin(), ok(null)],
    ["settings", (repo: SupabasePermissionReadRepo) => repo.getSettingsAdmin(), ok(null)],
    ["display", (repo: SupabasePermissionReadRepo) => repo.getStoreDisplay(), ok(null)],
  ])("rejects malformed %s DTOs as a sanitized refresh failure", async (_name, invoke, response) => {
    const { client } = clientWith([response]);
    const error = await invoke(new SupabasePermissionReadRepo(client)).catch(value => value);
    expect(error).toMatchObject({ code: "PERMISSION_REFRESH_UNAVAILABLE", message: "Chưa xác minh được quyền. Kiểm tra kết nối và thử lại." });
    expect(error.cause).toBeUndefined();
  });

  it("discards stale successful and failed responses before exposing old-session data or errors", async () => {
    const successful = deferred(), failed = deferred();
    const { client } = clientWith([successful.promise, failed.promise]);
    const repo = new SupabasePermissionReadRepo(client);
    const first = repo.getSettingsAdmin();
    employeeCredential(client).generation += 1; employeeCredential(client).token = nextToken;
    successful.resolve({ data: { ok: true, data: settings }, error: null });
    await expect(first).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED", message: sessionMessage });

    const second = repo.getStoreDisplay();
    employeeCredential(client).generation += 1; employeeCredential(client).token = "c".repeat(43);
    failed.reject({ code: "FORBIDDEN", message: `old error token=${actorToken}` });
    const error = await second.catch(value => value);
    expect(error).toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED", message: sessionMessage });
    expect(error.cause).toBeUndefined(); expect(JSON.stringify(error)).not.toContain(actorToken);
  });

  it("rejects an old projection when credential replacement is queued with the successful transport resolution", async () => {
    const pending = deferred(), { client } = clientWith([pending.promise]);
    const result = new SupabasePermissionReadRepo(client).getFloorOperational();
    pending.resolve({ data: { ok: true, data: { floorPlan: floor, openOrders: [] } }, error: null });
    queueMicrotask(() => {
      employeeCredential(client).generation += 1;
      employeeCredential(client).token = null;
    });
    await expect(result).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED", message: sessionMessage });
  });

  it.each([
    ["FORBIDDEN", "Bạn không có quyền thực hiện thao tác này."],
    ["NOT_FOUND", "Không tìm thấy dữ liệu được phép truy cập."],
    ["EMPLOYEE_SESSION_REQUIRED", sessionMessage], ["AUTH_REQUIRED", sessionMessage],
    ["RECEIPT_UNAVAILABLE", "Đơn chưa thanh toán hoặc đã hủy nên không thể in hóa đơn."],
    ["INVALID_WRITE_REQUEST", "Dữ liệu thao tác không hợp lệ. Vui lòng tải lại và kiểm tra."],
    ["EMPLOYEE_ROLE_UNAVAILABLE", "Vai trò này chưa được hỗ trợ trên ứng dụng."],
  ])("preserves safe denial %s with its standard message and removes server details", async (code, message) => {
    const { client } = clientWith([Promise.resolve({ data: { ok: false, error: { code, message: `secret ${actorToken}`, details: { token: actorToken } }, sql: "private" }, error: null })]);
    const error = await new SupabasePermissionReadRepo(client).getPosMenu().catch(value => value);
    expect(error).toMatchObject({ code, message }); expect(error.cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toMatch(/private|token|aaaaaa/);
  });

  it("maps transport failures to a redacted refresh error without retaining requests or credentials", async () => {
    const raw = { code: "XX000", message: `database failed token=${actorToken}`, details: "private stack", request: { pin: "384729" } };
    const { client } = clientWith([Promise.resolve({ data: null, error: raw })]);
    const error = await new SupabasePermissionReadRepo(client).getFloorAdmin().catch(value => value);
    expect(error).toMatchObject({ code: "PERMISSION_REFRESH_UNAVAILABLE", message: "Chưa xác minh được quyền. Kiểm tra kết nối và thử lại." });
    expect(error.cause).toBeUndefined(); expect(JSON.stringify(error)).not.toMatch(/384729|private|token|request/);
  });
});
