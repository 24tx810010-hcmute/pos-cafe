import { beforeEach, describe, expect, it } from "vitest";
import type { PermissionEmployee, PermissionRole } from "@/domain/permissions";
import { canAccessWriteLookup, canReprintReceipt } from "@/core/permissionAuthority";
import { createMockPermissionPorts } from "./permissionRepos";
import { createMockPermissionState } from "./permissionState";

describe("T07 mock permission read projections", () => {
  let state: ReturnType<typeof createMockPermissionState>;
  let ports: ReturnType<typeof createMockPermissionPorts>;
  const login = (employee: PermissionEmployee) => {
    state.session = { employeeId: employee.id, storeId: state.storeId, expiresAt: state.now() + 60_000, revoked: false };
    return employee;
  };
  const asRole = (role: PermissionRole) => login(state.employees.find(employee => employee.role === role)!);

  beforeEach(() => {
    state = createMockPermissionState();
    state.now = () => Date.UTC(2026, 8, 16);
    ports = createMockPermissionPorts(state);
  });

  it("projects only active POS menu data, open floor summaries, and whitelisted open-order fields", async () => {
    asRole("cashier");
    const business = state.business;
    const unavailableItem = {
      id: "unavailable-item", categoryId: "unused-category", name: "Ẩn", price: 1, imageAssetKey: null,
      sortOrder: 999, isAvailable: false,
    };
    business.menu.categories.push({ id: "unused-category", name: "Unused", sortOrder: 999 });
    business.menu.menuItems.push(unavailableItem);
    business.menu.optionGroups.push({ id: "unused-group", name: "Unused", selectType: "single", isRequired: false, sortOrder: 999 });
    business.menu.optionValues.push({ id: "unused-value", optionGroupId: "unused-group", name: "Unused", priceDelta: 1, sortOrder: 999 });
    business.menu.menuItemOptionGroups.push({ id: "unused-link", menuItemId: unavailableItem.id, optionGroupId: "unused-group", sortOrder: 999 });
    business.menu.menuItemOptionGroups.push({ id: "broken-link", menuItemId: business.menu.menuItems[0].id, optionGroupId: "missing-group", sortOrder: 999 });
    Object.assign(business.menu, { internalSecret: "MENU_SECRET" });
    for (const value of [business.menu.categories[0], business.menu.menuItems[0], business.menu.optionGroups[0],
      business.menu.optionValues[0], business.menu.menuItemOptionGroups[0]]) Object.assign(value, { internalSecret: "MENU_SECRET" });

    Object.assign(business.floorPlan, { internalSecret: "FLOOR_SECRET" });
    for (const value of [business.floorPlan.areas[0], business.floorPlan.tables[0], business.floorPlan.decorItems[0]])
      Object.assign(value, { internalSecret: "FLOOR_SECRET" });
    const open = business.orders.find(order => order.status === "open")!;
    Object.assign(open, { internalSecret: "ORDER_SECRET", payment: { token: "PAYMENT_SECRET" } });
    Object.assign(open.items[0], { internalSecret: "ITEM_SECRET" });
    Object.assign(open.items[0].options[0], { internalSecret: "OPTION_SECRET" });

    const menu = await ports.read.getPosMenu();
    expect(menu.menuItems.some(item => item.id === unavailableItem.id)).toBe(false);
    expect(menu.categories.some(category => category.id === "unused-category")).toBe(false);
    expect(menu.optionGroups.some(group => group.id === "unused-group")).toBe(false);
    expect(menu.optionValues.some(value => value.id === "unused-value")).toBe(false);
    expect(menu.menuItemOptionGroups.some(link => link.id === "unused-link" || link.id === "broken-link")).toBe(false);
    expect(JSON.stringify(menu)).not.toContain("MENU_SECRET");
    expect(Object.keys(menu.menuItems[0]).sort()).toEqual(["categoryId", "id", "imageAssetKey", "isAvailable", "name", "price", "sortOrder"].sort());

    const floor = await ports.read.getFloorOperational();
    expect(floor.openOrders).toHaveLength(business.orders.filter(order => order.status === "open").length);
    expect(floor.openOrders.every(order => Object.keys(order).sort().join() === "createdAt,id,orderNo,orderType,tableId,total")).toBe(true);
    expect(JSON.stringify(floor)).not.toMatch(/FLOOR_SECRET|ORDER_SECRET|PAYMENT_SECRET/);
    floor.floorPlan.areas[0].name = "changed";
    expect(business.floorPlan.areas[0].name).not.toBe("changed");

    const detail = await ports.read.getOpenOrderDetail(open.id);
    expect(Object.keys(detail).sort()).toEqual(["id", "items", "lockVersion", "orderNo", "orderType", "status", "tableId", "total"].sort());
    expect(Object.keys(detail.items[0]).sort()).toEqual(["id", "itemName", "menuItemId", "note", "options", "quantity", "unitPrice"].sort());
    expect(Object.keys(detail.items[0].options[0]).sort()).toEqual(["id", "optionName", "optionValueId", "priceDelta", "quantity"].sort());
    expect(JSON.stringify(detail)).not.toMatch(/ORDER_SECRET|PAYMENT_SECRET|ITEM_SECRET|OPTION_SECRET/);
  });

  it("keeps paid-void lookup minimal and history limited to closed, whitelisted orders", async () => {
    asRole("manager");
    const paid = state.business.orders.find(order => order.status === "paid")!;
    const open = state.business.orders.find(order => order.status === "open")!;
    const voided = structuredClone(paid);
    voided.id = "11111111-1111-4111-8111-111111111111"; voided.status = "void"; voided.lockVersion++;
    voided.voidedByEmployeeId = paid.payment!.employeeId;
    state.business.orders.push(voided);
    paid.receiptSnapshot = (await ports.read.getReceipt(paid.id)).receipt;
    Object.assign(paid.receiptSnapshot, { internalSecret: "RECEIPT_SECRET" });
    Object.assign(paid, { internalSecret: "ORDER_SECRET" });
    Object.assign(paid.payment!, { token: "PAYMENT_SECRET" });
    Object.assign(paid.items[0], { costPrice: "ITEM_SECRET" });
    if (paid.items[1]?.options[0]) Object.assign(paid.items[1].options[0], { supplier: "OPTION_SECRET" });

    const target = await ports.read.getPaidOrderForVoid(paid.id);
    expect(Object.keys(target).sort()).toEqual(["id", "lockVersion", "orderNo", "status", "total"]);
    expect(JSON.stringify(target)).not.toContain("SECRET");
    await expect(ports.read.getPaidOrderForVoid(voided.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(ports.read.getPaidOrderForVoid(open.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const page = await ports.read.listOrderHistory({ page: 1, pageSize: 100 });
    expect(page.items.some(order => order.id === open.id)).toBe(false);
    expect(page.items.some(order => order.id === paid.id)).toBe(true);
    expect(page.items.some(order => order.id === voided.id)).toBe(true);
    expect(page.items.every(order => Object.keys(order).sort().join() === "businessDate,id,lockVersion,orderNo,orderType,status,tableId,total")).toBe(true);
    const detail = await ports.read.getOrderHistoryDetail(paid.id);
    expect(detail.status).toBe("paid");
    expect(detail.cashierName).toBe(state.business.employees.find(employee => employee.id === paid.payment!.employeeId)?.name);
    expect(detail.voidedByName).toBeNull();
    expect(JSON.stringify(detail)).not.toMatch(/ORDER_SECRET|PAYMENT_SECRET|ITEM_SECRET|OPTION_SECRET|RECEIPT_SECRET/);
    detail.items[0].itemName = "changed";
    expect(paid.items[0].itemName).not.toBe("changed");
    const voidDetail = await ports.read.getOrderHistoryDetail(voided.id);
    expect(voidDetail.voidedByName).toBe(state.business.employees.find(employee => employee.id === voided.voidedByEmployeeId)?.name);
    await expect(ports.read.getOrderHistoryDetail(open.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows receipt content for history or payment without granting reprint or write takeover", async () => {
    const reader = login(state.employees.find(employee => employee.name === "Nhân viên chỉ xem")!);
    const paid = state.business.orders.find(order => order.status === "paid")!;
    state.business.settings.displayName = "Current store";
    state.business.settings.address = "Current address";
    state.business.settings.billFooter = "Current footer";
    const table = state.business.floorPlan.tables.find(candidate => candidate.id === paid.tableId)!;
    table.name = "Current table";
    const employee = state.business.employees.find(candidate => candidate.id === paid.payment!.employeeId)!;
    employee.name = "Legacy employee";
    const candidateEmployee = structuredClone(state.employees.find(candidate => candidate.role === "cashier")!);
    candidateEmployee.id = paid.payment!.employeeId;
    candidateEmployee.name = "Current candidate employee";
    state.employees.push(candidateEmployee);
    state.business.menu.menuItems.find(item => item.id === paid.items[0].menuItemId)!.name = "Current catalog name";

    const before = structuredClone(reader.overrides);
    const legacy = await ports.read.getReceipt(paid.id);
    expect(legacy.legacyMetadata).toBe(true);
    expect(legacy.receipt).toMatchObject({
      orderId: paid.id, paymentId: paid.payment!.id, storeName: "Current store", address: "Current address",
      footer: "Current footer", tableName: "Current table", employeeName: "Current candidate employee",
      total: paid.total, receivedAmount: paid.payment!.receivedAmount, changeAmount: paid.payment!.changeAmount,
    });
    expect(legacy.receipt.lines[0].name).toBe(paid.items[0].itemName);
    expect(legacy.receipt.lines[0].name).not.toBe("Current catalog name");
    expect(reader.overrides).toEqual(before);
    const authority = await ports.authority.getAuthority();
    expect(canReprintReceipt(authority.catalog, { status: "verified", snapshot: authority.snapshot })).toBe(false);
    expect(canAccessWriteLookup(authority.catalog, { status: "verified", snapshot: authority.snapshot })).toBe(false);

    const printOnly = asRole("waiter");
    printOnly.overrides = { grants: ["receipt.reprint"], denies: ["order.create", "order.update"] };
    await expect(ports.read.getReceipt(paid.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const printAuthority = await ports.authority.getAuthority();
    expect(canReprintReceipt(printAuthority.catalog, { status: "verified", snapshot: printAuthority.snapshot })).toBe(false);
    expect(canAccessWriteLookup(printAuthority.catalog, { status: "verified", snapshot: printAuthority.snapshot })).toBe(false);

    asRole("cashier");
    expect((await ports.read.getReceipt(paid.id)).receipt.orderId).toBe(paid.id);
  });

  it("returns an immutable stored receipt and rejects open, void, or missing receipt targets", async () => {
    asRole("manager");
    const paid = state.business.orders.find(order => order.status === "paid")!;
    const candidateEmployee = structuredClone(state.employees.find(candidate => candidate.role === "cashier")!);
    candidateEmployee.id = paid.payment!.employeeId;
    candidateEmployee.name = "Frozen employee";
    state.employees.push(candidateEmployee);
    const legacy = await ports.read.getReceipt(paid.id);
    paid.receiptSnapshot = structuredClone(legacy.receipt);
    paid.receiptSnapshot.storeName = "Frozen store";
    paid.receiptSnapshot.lines[0].name = "Frozen item";
    Object.assign(paid.receiptSnapshot, { internalSecret: "RECEIPT_SECRET" });
    Object.assign(paid.receiptSnapshot.lines[0], { costPrice: "LINE_SECRET" });
    if (paid.receiptSnapshot.lines[1]?.options[0]) Object.assign(paid.receiptSnapshot.lines[1].options[0], { internalId: "OPTION_SECRET" });

    const stored = await ports.read.getReceipt(paid.id);
    expect(stored.legacyMetadata).toBe(false);
    expect(stored.receipt.storeName).toBe("Frozen store");
    expect(stored.receipt.employeeName).toBe("Frozen employee");
    expect(stored.receipt.lines[0].name).toBe("Frozen item");
    expect(JSON.stringify(stored)).not.toMatch(/RECEIPT_SECRET|LINE_SECRET|OPTION_SECRET/);
    stored.receipt.storeName = "changed"; stored.receipt.lines[0].name = "changed";
    state.business.settings.displayName = "Current changed store";
    candidateEmployee.name = "Current changed employee";
    paid.items[0].itemName = "Current changed item";
    const reread = await ports.read.getReceipt(paid.id);
    expect(reread.receipt.storeName).toBe("Frozen store");
    expect(reread.receipt.employeeName).toBe("Frozen employee");
    expect(reread.receipt.lines[0].name).toBe("Frozen item");

    const open = state.business.orders.find(order => order.status === "open")!;
    await expect(ports.read.getReceipt(open.id)).rejects.toMatchObject({ code: "RECEIPT_UNAVAILABLE" });
    paid.status = "void";
    await expect(ports.read.getReceipt(paid.id)).rejects.toMatchObject({ code: "RECEIPT_UNAVAILABLE" });
    await expect(ports.read.getReceipt("99999999-9999-4999-8999-999999999999")).rejects.toMatchObject({ code: "RECEIPT_UNAVAILABLE" });
  });

  it("matches canonical history filters, grouped lookup, deterministic ties, and paging", async () => {
    const reader = login(state.employees.find(employee => employee.name === "Nhân viên chỉ xem")!);
    const base = state.business.orders.find(order => order.status === "paid")!;
    const firstTable = state.business.floorPlan.tables[0].id;
    const secondTable = state.business.floorPlan.tables[1].id;
    const make = (id: string, orderNo: number, businessDate: string, tableId: string, status: "paid" | "void", orderType: "dine_in" | "takeaway") => ({
      ...structuredClone(base), id, orderNo, businessDate, tableId, status, orderType,
    });
    const a = make("22222222-2222-4222-8222-222222222221", 50, "2026-07-02", firstTable, "paid", "dine_in");
    const b = make("22222222-2222-4222-8222-222222222222", 40, "2026-07-02", secondTable, "paid", "takeaway");
    const c = make("22222222-2222-4222-8222-222222222223", 40, "2026-07-02", secondTable, "paid", "takeaway");
    const d = make("22222222-2222-4222-8222-222222222224", 30, "2026-07-01", firstTable, "void", "dine_in");
    state.business.orders.push(a, b, c, d);

    const mixed = await ports.read.listOrderHistory({
      fromDate: "2026-07-02", toDate: "2026-07-02", page: 1, pageSize: 1, status: "paid", orderType: "takeaway",
      search: "#999", tableIds: [secondTable],
    });
    expect(mixed.total).toBe(2);
    expect(mixed.items.map(order => order.id)).toEqual([c.id]);
    const secondPage = await ports.read.listOrderHistory({
      fromDate: "2026-07-02", toDate: "2026-07-02", page: 2, pageSize: 1, status: "paid", orderType: "takeaway",
      search: "#999", tableIds: [secondTable],
    });
    expect(secondPage.items.map(order => order.id)).toEqual([b.id]);

    const bill = await ports.read.listOrderHistory({ fromDate: "2026-07-02", toDate: "2026-07-02", page: 1, pageSize: 100, search: "#40" });
    expect(bill.items.map(order => order.id)).toEqual([c.id, b.id]);
    const literalId = await ports.read.listOrderHistory({
      fromDate: "2026-07-02", toDate: "2026-07-02", page: 1, pageSize: 100,
      search: `%(${b.id.toUpperCase()}),`,
    });
    expect(literalId.items.map(order => order.id)).toEqual([b.id]);
    const tablesOnly = await ports.read.listOrderHistory({
      fromDate: "2026-07-01", toDate: "2026-07-02", page: 1, pageSize: 100, tableIds: [firstTable],
    });
    expect(tablesOnly.items.filter(order => [a.id, d.id].includes(order.id)).map(order => order.id)).toEqual([a.id, d.id]);
    for (const search of ["paid", "takeaway", base.items[0].itemName]) {
      const result = await ports.read.listOrderHistory({ fromDate: "2026-07-02", toDate: "2026-07-02", page: 1, pageSize: 100, search });
      expect(result.items).toHaveLength(0);
    }
    expect(reader.overrides?.grants).toContain("orderHistory.view");
  });

  it("validates history, report, and order IDs only after current authority", async () => {
    const waiter = asRole("waiter");
    waiter.overrides = null;
    await expect(ports.read.listOrderHistory({ page: 0, pageSize: 500 } as never)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(ports.read.getPaidOrderForVoid("bad-id")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(ports.read.getSalesReport({ businessDate: "2026-02-30" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const reader = login(state.employees.find(employee => employee.name === "Nhân viên chỉ xem")!);
    await expect(ports.read.listOrderHistory({ page: 1, pageSize: 20, unknown: true } as never)).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    await expect(ports.read.listOrderHistory({ page: 1, pageSize: 20, fromDate: "2026-02-30" })).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    await expect(ports.read.listOrderHistory({ page: 0, pageSize: 20 })).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    await expect(ports.read.listOrderHistory({ page: 1, pageSize: 101 })).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    await expect(ports.read.listOrderHistory({ page: 1, pageSize: 20, tableIds: ["bad-id"] })).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    await expect(ports.read.getOrderHistoryDetail("bad-id")).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    await expect(ports.read.getSalesReport({ businessDate: "2026-02-30" })).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    expect(reader.overrides?.grants).toEqual(expect.arrayContaining(["orderHistory.view", "report.view"]));
  });

  it("buckets paid revenue in the store timezone while retaining the stored business date", async () => {
    login(state.employees.find(employee => employee.name === "Nhân viên chỉ xem")!);
    const base = state.business.orders.find(order => order.status === "paid")!;
    const makeItem = (name: string, quantity: number, status?: "removed") =>
      Object.assign(structuredClone(base.items[0]), { itemName: name, quantity }, status ? { status } : {});
    const makeOrder = (
      id: string, total: number, paidAt: string | null, createdAt: string,
      status: "paid" | "void", items: ReturnType<typeof makeItem>[],
    ) => Object.assign(structuredClone(base), {
      id, total, paidAt, createdAt, status, businessDate: "2026-09-16", items,
    });

    state.business.orders = [
      makeOrder("report-paid-midnight", 100, "2026-09-15T17:30:00.000Z", "2026-09-15T17:00:00.000Z", "paid", [makeItem("Beta", 2)]),
      makeOrder("report-paid-late", 200, "2026-09-16T16:30:00.000Z", "2026-09-16T16:00:00.000Z", "paid", [makeItem("Alpha", 2)]),
      makeOrder("report-paid-created-fallback", 50, null, "2026-09-16T00:15:00.000Z", "paid", [
        makeItem("Removed", 100, "removed"), makeItem("Gamma", 1),
      ]),
      makeOrder("report-void-paid", 75, "2026-09-16T02:00:00.000Z", "2026-09-16T01:00:00.000Z", "void", [makeItem("Void item", 99)]),
      makeOrder("report-void-unpaid", 999, null, "2026-09-16T03:00:00.000Z", "void", [makeItem("Unpaid void", 99)]),
    ];
    state.business.settings.timezone = "Asia/Ho_Chi_Minh";

    const vietnam = await ports.read.getSalesReport({ businessDate: "2026-09-16" });
    expect(vietnam).toMatchObject({
      businessDate: "2026-09-16", revenue: 350, paidOrders: 3, averageTicket: 117,
      topItemName: "Alpha", voidCount: 1, voidAmount: 75,
    });
    expect(vietnam.hourlyRevenue).toEqual([
      { label: "00", revenue: 100 }, { label: "07", revenue: 50 }, { label: "23", revenue: 200 },
    ]);

    state.business.settings.timezone = "America/New_York";
    const newYork = await ports.read.getSalesReport({ businessDate: "2026-09-16" });
    expect(newYork).toMatchObject({ revenue: 350, paidOrders: 3, voidCount: 1, voidAmount: 75 });
    expect(newYork.hourlyRevenue).toEqual([
      { label: "12", revenue: 200 }, { label: "13", revenue: 100 }, { label: "20", revenue: 50 },
    ]);
    expect(await ports.read.getSalesReport({ businessDate: "2026-09-15" })).toMatchObject({
      businessDate: "2026-09-15", revenue: 0, paidOrders: 0, voidCount: 0, voidAmount: 0,
    });

    asRole("waiter").overrides = null;
    await expect(ports.read.getSalesReport({ businessDate: "2026-09-16" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("grants report summaries without granting history and rejects forged summary filters", async () => {
    const reportOnly = asRole("waiter");
    reportOnly.overrides = { grants: ["report.view"], denies: [] };
    const paid = state.business.orders.find(order => order.status === "paid")!;

    await expect(ports.read.listOrderHistory({ page: 1, pageSize: 20 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const summaries = await ports.read.listReportOrders({ fromDate: paid.businessDate, toDate: paid.businessDate });
    expect(summaries.some(order => order.id === paid.id)).toBe(true);
    await expect(ports.read.listReportOrders({
      fromDate: paid.businessDate, toDate: paid.businessDate, page: 1,
    } as never)).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    await expect(ports.read.listReportOrders({
      fromDate: paid.businessDate, toDate: paid.businessDate, status: "void",
    } as never)).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
  });

  it("returns a globally capped, sorted, minimal list of paid report orders", async () => {
    const reportOnly = asRole("waiter");
    reportOnly.overrides = { grants: ["report.view"], denies: [] };
    const base = state.business.orders.find(order => order.status === "paid")!;
    const table = state.business.floorPlan.tables[0];
    const paid = Array.from({ length: 25 }, (_, index) => Object.assign(structuredClone(base), {
      id: `44444444-4444-4444-8444-${String(index + 1).padStart(12, "0")}`,
      businessDate: index < 12 ? "2026-09-16" : "2026-09-15",
      orderNo: index % 4 === 0 ? 50 : index,
      orderType: index % 3 === 0 ? "takeaway" as const : "dine_in" as const,
      tableId: index % 3 === 0 ? null : index === 23 ? "deleted-table" : table.id,
      status: "paid" as const,
    }));
    const voided = Object.assign(structuredClone(base), {
      id: "55555555-5555-4555-8555-555555555555", businessDate: "2026-09-16", orderNo: 999, status: "void" as const,
    });
    state.business.orders = [...paid, voided];

    const expected = [...paid].sort((left, right) => right.businessDate.localeCompare(left.businessDate)
      || right.orderNo - left.orderNo || right.id.localeCompare(left.id)).slice(0, 20);
    const result = await ports.read.listReportOrders({ fromDate: "2026-09-15", toDate: "2026-09-16" });
    expect(result).toHaveLength(20);
    expect(result.map(order => order.id)).toEqual(expected.map(order => order.id));
    expect(result.some(order => order.id === voided.id)).toBe(false);
    expect(result.every(order => Object.keys(order).sort().join() ===
      "businessDate,id,orderNo,orderType,status,tableName,total")).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/employee|items|payment|receipt/i);
    expect(result.find(order => order.orderType === "takeaway")?.tableName).toBeNull();

    const deleted = paid.find(order => order.tableId === "deleted-table")!;
    const deletedOnly = await ports.read.listReportOrders({ fromDate: deleted.businessDate, toDate: deleted.businessDate });
    expect(deletedOnly.find(order => order.id === deleted.id)?.tableName).toBeNull();
  });

  it("whitelists full admin and report DTOs instead of cloning injected state fields", async () => {
    asRole("owner");
    Object.assign(state.business.menu, { privateKey: "MENU_SECRET" });
    Object.assign(state.business.menu.menuItems[0], { costPrice: "ITEM_SECRET" });
    Object.assign(state.business.floorPlan, { privateLayout: "FLOOR_SECRET" });
    Object.assign(state.business.floorPlan.tables[0], { alarmCode: "TABLE_SECRET" });
    Object.assign(state.business.settings, { storeKey: "SETTINGS_SECRET" });
    Object.assign(state.business.orders.find(order => order.status === "paid")!, { analyticsSecret: "REPORT_SECRET" });

    const menu = await ports.read.getMenuAdmin();
    const floor = await ports.read.getFloorAdmin();
    const settings = await ports.read.getSettingsAdmin();
    const display = await ports.read.getStoreDisplay();
    const paid = state.business.orders.find(order => order.status === "paid")!;
    const report = await ports.read.getSalesReport({ businessDate: paid.businessDate });
    expect(JSON.stringify({ menu, floor, settings, display, report })).not.toMatch(/MENU_SECRET|ITEM_SECRET|FLOOR_SECRET|TABLE_SECRET|SETTINGS_SECRET|REPORT_SECRET/);
    expect(Object.keys(settings).sort()).toEqual(["address", "billFooter", "currency", "displayName", "storeId", "timezone"].sort());
    expect(Object.keys(display).sort()).toEqual(["address", "billFooter", "currency", "displayName", "timezone"].sort());
    expect(Object.keys(report).sort()).toEqual(["averageTicket", "businessDate", "hourlyRevenue", "paidOrders", "revenue", "topItemName", "voidAmount", "voidCount"].sort());
  });
});
