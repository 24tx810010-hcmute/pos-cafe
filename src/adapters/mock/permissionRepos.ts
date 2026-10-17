import type { AuthorityBundle, AuthorityRevision, EmployeeAdminView, PermissionCode, PermissionEmployee } from "@/domain/permissions";
import type { CoreReport, FloorPlan, MenuCatalog, OrderDetail, OrderHistoryFilter, ReceiptSnapshot, ReportFilter } from "@/domain";
import type { IEmployeeAdminReadRepo, IPermissionAuthorityRepo, IPermissionReadRepo, PermissionFoundationPorts, ReportSummaryFilter } from "@/ports/permissions";
import { AppError } from "@/core/appError";
import { createAuthoritySnapshot, hasCatalogPermission } from "@/core/permissionAuthority";
import { configuredPermissions } from "@/core/permissionOverrides";
import { validatePermissionCatalog } from "@/core/permissionCatalog";
import { permissionUuid } from "@/core/permissionInputs";
import { parsePermissionHistoryFilter, parsePermissionReportFilter, parsePermissionReportSummaryFilter, validatePermissionReadOrderId } from "@/core/permissionReadInputs";
import { clone } from "./mockState";
import { createMockPermissionState, type MockPermissionState } from "./permissionState";
import { MockPermissionAdminRepo } from "./permissionAdminRepo";
import { writeError } from "@/core/writeErrors";
import { requireMockNormalPermissionActor } from "./permissionIdentityRepo";

const floorView = (floor: FloorPlan): FloorPlan => ({
  areas: floor.areas.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
  tables: floor.tables.map(({ id, areaId, name, backgroundAssetKey, posX, posY, width, height, shape, rotation, seats, sortOrder, status }) =>
    ({ id, areaId, name, backgroundAssetKey, posX, posY, width, height, shape, rotation, seats, sortOrder, status })),
  decorItems: floor.decorItems.map(({ id, areaId, kind, label, assetKey, posX, posY, width, height, rotation, zIndex, isLocked }) =>
    ({ id, areaId, kind, label, assetKey, posX, posY, width, height, rotation, zIndex, isLocked })),
});

const menuView = (menu: MenuCatalog): MenuCatalog => ({
  categories: menu.categories.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
  menuItems: menu.menuItems.map(({ id, categoryId, name, price, imageAssetKey, sortOrder, isAvailable }) =>
    ({ id, categoryId, name, price, imageAssetKey, sortOrder, isAvailable })),
  optionGroups: menu.optionGroups.map(({ id, name, selectType, isRequired, sortOrder }) => ({ id, name, selectType, isRequired, sortOrder })),
  optionValues: menu.optionValues.map(({ id, optionGroupId, name, priceDelta, sortOrder }) => ({ id, optionGroupId, name, priceDelta, sortOrder })),
  menuItemOptionGroups: menu.menuItemOptionGroups.map(({ id, menuItemId, optionGroupId, sortOrder }) => ({ id, menuItemId, optionGroupId, sortOrder })),
});

const itemView = (item: OrderDetail["items"][number]): OrderDetail["items"][number] => ({
  id: item.id, menuItemId: item.menuItemId, itemName: item.itemName, quantity: item.quantity, unitPrice: item.unitPrice,
  ...(item.note !== undefined ? { note: item.note } : {}),
  options: item.options.map(({ id, optionValueId, optionName, priceDelta, quantity }) => ({ id, optionValueId, optionName, priceDelta, quantity })),
});

const receiptView = (receipt: ReceiptSnapshot): ReceiptSnapshot => ({
  schemaVersion: 1, orderId: receipt.orderId, paymentId: receipt.paymentId, orderNo: receipt.orderNo,
  businessDate: receipt.businessDate, storeName: receipt.storeName, address: receipt.address, footer: receipt.footer,
  tableName: receipt.tableName, paidAt: receipt.paidAt, employeeName: receipt.employeeName,
  lines: receipt.lines.map(line => ({
    orderItemId: line.orderItemId, menuItemId: line.menuItemId, name: line.name, quantity: line.quantity,
    baseUnitPrice: line.baseUnitPrice, note: line.note,
    options: line.options.map(({ optionValueId, name, priceDelta, quantity }) => ({ optionValueId, name, priceDelta, quantity })),
    unitTotal: line.unitTotal, lineTotal: line.lineTotal,
  })),
  total: receipt.total, receivedAmount: receipt.receivedAmount, changeAmount: receipt.changeAmount,
});

const orderView = (order: OrderDetail): OrderDetail => ({
  id: order.id, orderNo: order.orderNo, status: order.status, total: order.total, lockVersion: order.lockVersion,
  tableId: order.tableId, orderType: order.orderType, businessDate: order.businessDate,
  ...(order.receiptSnapshot !== undefined ? { receiptSnapshot: order.receiptSnapshot ? receiptView(order.receiptSnapshot) : order.receiptSnapshot } : {}),
  ...(order.createdAt !== undefined ? { createdAt: order.createdAt } : {}),
  ...(order.updatedAt !== undefined ? { updatedAt: order.updatedAt } : {}),
  ...(order.createdByEmployeeId !== undefined ? { createdByEmployeeId: order.createdByEmployeeId } : {}),
  ...(order.lastModifiedByEmployeeId !== undefined ? { lastModifiedByEmployeeId: order.lastModifiedByEmployeeId } : {}),
  items: order.items.map(itemView), paidAt: order.paidAt,
  payment: order.payment ? {
    id: order.payment.id, employeeId: order.payment.employeeId, method: order.payment.method, amount: order.payment.amount,
    receivedAmount: order.payment.receivedAmount, changeAmount: order.payment.changeAmount, paidAt: order.payment.paidAt,
  } : null,
  voidedAt: order.voidedAt, voidedByEmployeeId: order.voidedByEmployeeId,
  voidReasonCode: order.voidReasonCode, voidReasonNote: order.voidReasonNote,
});

const reportView = (report: CoreReport): CoreReport => ({
  businessDate: report.businessDate, revenue: report.revenue, paidOrders: report.paidOrders, averageTicket: report.averageTicket,
  topItemName: report.topItemName, hourlyRevenue: report.hourlyRevenue.map(({ label, revenue }) => ({ label, revenue })),
  voidCount: report.voidCount, voidAmount: report.voidAmount,
});

const summaryView = (order: OrderDetail) => ({
  id: order.id, orderNo: order.orderNo, status: order.status, total: order.total, lockVersion: order.lockVersion,
  tableId: order.tableId, orderType: order.orderType, businessDate: order.businessDate,
});

class MockPermissionContext {
  constructor(readonly state: MockPermissionState) {}
  paired(): void {
    if (!this.state.paired) throw new AppError("AUTH_REQUIRED", "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.");
  }
  actor(): PermissionEmployee {
    return requireMockNormalPermissionActor(this.state);
  }
  requireAny(permissions: readonly PermissionCode[]): PermissionEmployee {
    const actor = this.actor();
    const snapshot = createAuthoritySnapshot(this.state.catalog, actor, true);
    if (!permissions.some(p => hasCatalogPermission(this.state.catalog, { status: "verified", snapshot }, p)))
      throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    return actor;
  }
  notFound(): never { throw new AppError("NOT_FOUND", "Không tìm thấy dữ liệu được phép truy cập."); }
  employeeView(e: PermissionEmployee): EmployeeAdminView {
    const rights = configuredPermissions(this.state.catalog, e.role, e.overrides);
    return clone({ id: e.id, name: e.name, role: e.role, isActive: e.isActive,
      permissionRevision: e.permissionRevision, overrides: e.overrides, effective: rights.permissions, sources: rights.sources });
  }
}

class MockPermissionAuthorityRepo implements IPermissionAuthorityRepo {
  constructor(private readonly context: MockPermissionContext) {}
  async getAuthority(): Promise<AuthorityBundle> {
    const actor = this.context.actor();
    // No await between reads: catalog and employee belong to one mock checkpoint.
    return { catalog: clone(this.context.state.catalog), snapshot: createAuthoritySnapshot(this.context.state.catalog, actor, true) };
  }
  async getRevision(): Promise<AuthorityRevision> {
    const actor = this.context.actor();
    return { employeeRevision: actor.permissionRevision, catalogRevision: this.context.state.catalog.revision,
      serverTime: new Date(this.context.state.now()).toISOString() };
  }
  async listRoster() {
    this.context.paired();
    const state = this.context.state;
    validatePermissionCatalog(state.catalog);
    return state.employees.filter(e => e.storeId === state.storeId && e.isActive && state.catalog.roles.some(r => r.code === e.role && r.enabled))
      .map(e => ({ id: e.id, name: e.name }));
  }
}

class MockEmployeeAdminReadRepo implements IEmployeeAdminReadRepo {
  constructor(private readonly context: MockPermissionContext) {}
  async listEmployees(): Promise<EmployeeAdminView[]> {
    this.context.requireAny(["employee.manage", "employee.permission.edit"]);
    return this.context.state.employees.filter(e => e.storeId === this.context.state.storeId).map(e => this.context.employeeView(e));
  }
  async getEmployee(targetId: string): Promise<EmployeeAdminView> {
    this.context.requireAny(["employee.manage", "employee.permission.edit"]);
    const id = permissionUuid(targetId);
    const employee = this.context.state.employees.find(e => e.id === id && e.storeId === this.context.state.storeId);
    if (!employee) return this.context.notFound();
    return this.context.employeeView(employee);
  }
}

class MockPermissionReadRepo implements IPermissionReadRepo {
  constructor(private readonly context: MockPermissionContext) {}
  async getFloorOperational() {
    this.context.requireAny(["floor.view"]);
    const state = this.context.state.business;
    return { floorPlan: floorView(state.floorPlan), openOrders: state.orders.filter(o => o.status === "open").map(o => ({
      id: o.id, tableId: o.tableId, orderType: o.orderType, orderNo: o.orderNo, total: o.total, createdAt: o.createdAt ?? null,
    })) };
  }
  async getPosMenu() {
    this.context.requireAny(["order.create", "order.update"]);
    const menu = this.context.state.business.menu;
    const menuItems = menu.menuItems.filter(i => i.isAvailable);
    const menuItemIds = new Set(menuItems.map(i => i.id));
    const existingGroupIds = new Set(menu.optionGroups.map(g => g.id));
    const menuItemOptionGroups = menu.menuItemOptionGroups.filter(l => menuItemIds.has(l.menuItemId) && existingGroupIds.has(l.optionGroupId));
    const usedGroupIds = new Set(menuItemOptionGroups.map(l => l.optionGroupId));
    const optionGroups = menu.optionGroups.filter(g => menuItemOptionGroups.some(l => l.optionGroupId === g.id));
    return menuView({ menuItems, categories: menu.categories.filter(c => menuItems.some(i => i.categoryId === c.id)),
      menuItemOptionGroups, optionGroups, optionValues: menu.optionValues.filter(v => usedGroupIds.has(v.optionGroupId)) });
  }
  async getOpenOrderDetail(orderId: string) {
    this.context.requireAny(["order.update", "order.voidOpen", "payment.take"]);
    const validatedId = validatePermissionReadOrderId(orderId);
    const order = this.context.state.business.orders.find(o => o.id === validatedId && o.status === "open");
    if (!order) return this.context.notFound();
    const { id, orderNo, orderType, tableId, status, total, lockVersion, items } = order;
    return { id, orderNo, orderType, tableId, status, total, lockVersion, items: items.map(itemView) };
  }
  async getPaidOrderForVoid(orderId: string) {
    this.context.requireAny(["order.voidPaid"]);
    const validatedId = validatePermissionReadOrderId(orderId);
    const order = this.context.state.business.orders.find(o => o.id === validatedId && o.status === "paid");
    if (!order) return this.context.notFound();
    const { id, orderNo, status, total, lockVersion } = order;
    return { id, orderNo, status, total, lockVersion };
  }
  async listOrderHistory(filter: OrderHistoryFilter) {
    this.context.requireAny(["orderHistory.view"]);
    const input = parsePermissionHistoryFilter(filter);
    const search = input.search?.toLowerCase() ?? "";
    const bill = /^#?\d+$/.test(search) ? Number(search.replace(/^#/, "")) : null;
    const tableIds = new Set(input.tableIds ?? []);
    const hasLookup = search.length > 0 || tableIds.size > 0;
    const rows = this.context.state.business.orders
      .filter(order => order.status === "paid" || order.status === "void")
      .filter(order => !input.fromDate || order.businessDate >= input.fromDate)
      .filter(order => !input.toDate || order.businessDate <= input.toDate)
      .filter(order => !input.status || order.status === input.status)
      .filter(order => !input.orderType || order.orderType === input.orderType)
      .filter(order => !hasLookup || (
        (search.length > 0 && (order.orderNo === bill || order.id.toLowerCase().includes(search)
          || (order.tableId?.toLowerCase().includes(search) ?? false)))
        || (order.tableId !== null && tableIds.has(order.tableId.toLowerCase()))
      ))
      .sort((left, right) => right.businessDate.localeCompare(left.businessDate)
        || right.orderNo - left.orderNo || right.id.localeCompare(left.id));
    const from = (input.page - 1) * input.pageSize;
    return { items: rows.slice(from, from + input.pageSize).map(summaryView), total: rows.length };
  }
  async getOrderHistoryDetail(orderId: string) {
    this.context.requireAny(["orderHistory.view"]);
    const id = validatePermissionReadOrderId(orderId);
    const state = this.context.state;
    const order = state.business.orders.find(o => o.id === id && (o.status === "paid" || o.status === "void"));
    if (!order) return this.context.notFound();
    const employeeName = (id: string | null | undefined) => id
      ? state.employees.find(employee => employee.id === id && employee.storeId === state.storeId)?.name
        ?? state.business.employees.find(employee => employee.id === id)?.name ?? null
      : null;
    return { ...orderView(order), cashierName: employeeName(order.payment?.employeeId), voidedByName: employeeName(order.voidedByEmployeeId) };
  }
  async getReceipt(orderId: string) {
    this.context.requireAny(["orderHistory.view", "payment.take"]);
    const id = validatePermissionReadOrderId(orderId);
    const state = this.context.state.business;
    const order = state.orders.find(o => o.id === id);
    if (!order || order.status !== "paid" || !order.payment || !order.paidAt) throw writeError("RECEIPT_UNAVAILABLE");
    if (order.receiptSnapshot) return { receipt: receiptView(order.receiptSnapshot), legacyMetadata: false };
    const payment = order.payment;
    return { legacyMetadata: true, receipt: receiptView({
      schemaVersion: 1, orderId: id, paymentId: payment.id, orderNo: order.orderNo, businessDate: order.businessDate,
      storeName: state.settings.displayName, address: state.settings.address, footer: state.settings.billFooter,
      tableName: state.floorPlan.tables.find(t => t.id === order.tableId)?.name ?? null, paidAt: order.paidAt,
      employeeName: this.context.state.employees.find(e => e.id === payment.employeeId && e.storeId === this.context.state.storeId)?.name
        ?? state.employees.find(e => e.id === payment.employeeId)?.name ?? "Không xác định (dữ liệu cũ)",
      total: order.total, receivedAmount: payment.receivedAmount, changeAmount: payment.changeAmount,
      lines: order.items.map(i => {
        const unitTotal = i.unitPrice + i.options.reduce((n, o) => n + o.priceDelta * o.quantity, 0);
        return { orderItemId: i.id, menuItemId: i.menuItemId, name: i.itemName, quantity: i.quantity,
          baseUnitPrice: i.unitPrice, note: i.note ?? null,
          options: i.options.map(o => ({ name: o.optionName, optionValueId: o.optionValueId, priceDelta: o.priceDelta, quantity: o.quantity })),
          unitTotal, lineTotal: i.quantity * unitTotal };
      }),
    }) };
  }
  async getSalesReport(filter: ReportFilter) {
    this.context.requireAny(["report.view"]);
    const input = parsePermissionReportFilter(filter);
    const state = this.context.state.business;
    const paidOrders = state.orders.filter(order => order.status === "paid" && order.businessDate === input.businessDate);
    const voidedPaidOrders = state.orders.filter(order => order.status === "void" && order.paidAt !== null && order.businessDate === input.businessDate);
    const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
    const hourlyRevenue = new Map<string, number>();
    const topItems = new Map<string, number>();
    const hourFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: state.settings.timezone, hour: "2-digit", hourCycle: "h23",
    });
    for (const order of paidOrders) {
      const timestamp = order.paidAt ?? order.createdAt;
      const instant = timestamp ? new Date(timestamp) : null;
      const hour = instant && !Number.isNaN(instant.getTime())
        ? hourFormatter.formatToParts(instant).find(part => part.type === "hour")?.value ?? "--"
        : "--";
      hourlyRevenue.set(hour, (hourlyRevenue.get(hour) ?? 0) + order.total);
      for (const item of order.items) {
        if ((item as typeof item & { status?: string }).status === "removed") continue;
        topItems.set(item.itemName, (topItems.get(item.itemName) ?? 0) + item.quantity);
      }
    }
    const topItemName = [...topItems.entries()].sort(([leftName, leftCount], [rightName, rightCount]) =>
      rightCount - leftCount || (leftName < rightName ? -1 : leftName > rightName ? 1 : 0))[0]?.[0] ?? "-";
    return reportView({
      businessDate: input.businessDate, revenue, paidOrders: paidOrders.length,
      averageTicket: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
      topItemName,
      hourlyRevenue: [...hourlyRevenue.entries()].sort(([left], [right]) => left.localeCompare(right))
        .map(([label, value]) => ({ label, revenue: value })),
      voidCount: voidedPaidOrders.length,
      voidAmount: voidedPaidOrders.reduce((sum, order) => sum + order.total, 0),
    });
  }
  async listReportOrders(filter: ReportSummaryFilter) {
    this.context.requireAny(["report.view"]);
    const input = parsePermissionReportSummaryFilter(filter);
    const state = this.context.state.business;
    return state.orders
      .filter(order => order.status === "paid" && order.businessDate >= input.fromDate && order.businessDate <= input.toDate)
      .sort((left, right) => right.businessDate.localeCompare(left.businessDate)
        || right.orderNo - left.orderNo || right.id.localeCompare(left.id))
      .slice(0, 20)
      .map(order => ({
        id: order.id, orderNo: order.orderNo, businessDate: order.businessDate, orderType: order.orderType,
        total: order.total, status: "paid" as const,
        tableName: order.tableId === null ? null : state.floorPlan.tables.find(table => table.id === order.tableId)?.name ?? null,
      }));
  }
  async getMenuAdmin() {
    this.context.requireAny(["menu.manage"]); return menuView(this.context.state.business.menu);
  }
  async getFloorAdmin() {
    this.context.requireAny(["floor.manage"]); return floorView(this.context.state.business.floorPlan);
  }
  async getSettingsAdmin() {
    this.context.requireAny(["settings.manage"]);
    const { storeId, displayName, address, currency, timezone, billFooter } = this.context.state.business.settings;
    return { storeId, displayName, address, currency, timezone, billFooter };
  }
  async getStoreDisplay() {
    this.context.actor();
    const { displayName, address, billFooter, currency, timezone } = this.context.state.business.settings;
    return { displayName, address, billFooter, currency, timezone };
  }
}

export const createMockPermissionPorts = (state: MockPermissionState = createMockPermissionState()): PermissionFoundationPorts => {
  const context = new MockPermissionContext(state);
  return { authority: new MockPermissionAuthorityRepo(context), employeeAdmin: new MockPermissionAdminRepo(state), read: new MockPermissionReadRepo(context) };
};
