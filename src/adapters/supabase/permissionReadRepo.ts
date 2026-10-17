import { AppError, type AppErrorCode } from "@/core/appError";
import { permissionErrorMessages } from "@/core/permissionErrors";
import { parsePermissionHistoryFilter, parsePermissionReportFilter, parsePermissionReportSummaryFilter, validatePermissionReadOrderId } from "@/core/permissionReadInputs";
import { writeErrorMessages } from "@/core/writeErrors";
import type {
  CoreReport, FloorPlan, MenuCatalog, OrderDetail, OrderHistoryFilter, OrderItemOptionSnapshot,
  OrderItemSnapshot, OrderPaymentSnapshot, OrderSummary, OrderSummaryPage, ReceiptSnapshot,
  ReportFilter, StoreSettings,
} from "@/domain";
import type {
  FloorOperationalView, IPermissionReadRepo, OpenOrderOperationalView, OrderHistoryView, PaidOrderVoidView,
  ReportOrderSummary, ReportSummaryFilter, StoreDisplayView,
} from "@/ports/permissions";
import { employeeCredential } from "./employeeCredential";
import { mapSupabaseError } from "./errors";
import type { SupabaseAnyClient } from "./repoShared";

type ReadErrorCode =
  | "FORBIDDEN" | "NOT_FOUND" | "EMPLOYEE_SESSION_REQUIRED" | "AUTH_REQUIRED"
  | "RECEIPT_UNAVAILABLE" | "INVALID_WRITE_REQUEST" | "EMPLOYEE_ROLE_UNAVAILABLE";

const sessionMessage = "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.";
const readMessages: Record<ReadErrorCode, string> = {
  AUTH_REQUIRED: sessionMessage,
  EMPLOYEE_SESSION_REQUIRED: sessionMessage,
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu được phép truy cập.",
  RECEIPT_UNAVAILABLE: writeErrorMessages.RECEIPT_UNAVAILABLE,
  INVALID_WRITE_REQUEST: writeErrorMessages.INVALID_WRITE_REQUEST,
  EMPLOYEE_ROLE_UNAVAILABLE: permissionErrorMessages.EMPLOYEE_ROLE_UNAVAILABLE,
};
const readCodes = new Set<string>(Object.keys(readMessages));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const unavailable = () => new AppError("PERMISSION_REFRESH_UNAVAILABLE", permissionErrorMessages.PERMISSION_REFRESH_UNAVAILABLE);
const stale = () => new AppError("EMPLOYEE_SESSION_REQUIRED", sessionMessage);
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const record = (value: unknown) => { if (!isRecord(value)) throw unavailable(); return value; };
const string = (value: unknown) => { if (typeof value !== "string") throw unavailable(); return value; };
const nullableString = (value: unknown) => value === null ? null : string(value);
const boolean = (value: unknown) => { if (typeof value !== "boolean") throw unavailable(); return value; };
const number = (value: unknown) => { if (typeof value !== "number" || !Number.isFinite(value)) throw unavailable(); return value; };
const integer = (value: unknown) => { const result = number(value); if (!Number.isSafeInteger(result)) throw unavailable(); return result; };
const nonNegativeInteger = (value: unknown) => { const result = integer(value); if (result < 0) throw unavailable(); return result; };
const uuid = (value: unknown) => { const result = string(value); if (!uuidPattern.test(result)) throw unavailable(); return result.toLowerCase(); };
const timestamp = (value: unknown) => { const result = string(value); if (!Number.isFinite(Date.parse(result))) throw unavailable(); return result; };
const businessDate = (value: unknown) => { const result = string(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw unavailable(); return result; };
function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
  const result = string(value); if (!values.includes(result as T)) throw unavailable(); return result as T;
}
function array<T>(value: unknown, mapper: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw unavailable(); return value.map(mapper);
}

const mapCategory = (value: unknown): MenuCatalog["categories"][number] => {
  const row = record(value); return { id: uuid(row.id), name: string(row.name), sortOrder: integer(row.sortOrder) };
};
const mapMenuItem = (value: unknown): MenuCatalog["menuItems"][number] => {
  const row = record(value); return {
    id: uuid(row.id), categoryId: uuid(row.categoryId), name: string(row.name), price: nonNegativeInteger(row.price),
    imageAssetKey: nullableString(row.imageAssetKey), sortOrder: integer(row.sortOrder), isAvailable: boolean(row.isAvailable),
  };
};
const mapOptionGroup = (value: unknown): MenuCatalog["optionGroups"][number] => {
  const row = record(value); return {
    id: uuid(row.id), name: string(row.name), selectType: oneOf(row.selectType, ["single", "multi"]),
    isRequired: boolean(row.isRequired), sortOrder: integer(row.sortOrder),
  };
};
const mapOptionValue = (value: unknown): MenuCatalog["optionValues"][number] => {
  const row = record(value); return {
    id: uuid(row.id), optionGroupId: uuid(row.optionGroupId), name: string(row.name),
    priceDelta: integer(row.priceDelta), sortOrder: integer(row.sortOrder),
  };
};
const mapMenuItemOptionGroup = (value: unknown): MenuCatalog["menuItemOptionGroups"][number] => {
  const row = record(value); return {
    id: uuid(row.id), menuItemId: uuid(row.menuItemId), optionGroupId: uuid(row.optionGroupId), sortOrder: integer(row.sortOrder),
  };
};
const mapMenu = (value: unknown): MenuCatalog => {
  const row = record(value); return {
    categories: array(row.categories, mapCategory), menuItems: array(row.menuItems, mapMenuItem),
    optionGroups: array(row.optionGroups, mapOptionGroup), optionValues: array(row.optionValues, mapOptionValue),
    menuItemOptionGroups: array(row.menuItemOptionGroups, mapMenuItemOptionGroup),
  };
};

const mapArea = (value: unknown): FloorPlan["areas"][number] => {
  const row = record(value); return { id: uuid(row.id), name: string(row.name), sortOrder: integer(row.sortOrder) };
};
const mapTable = (value: unknown): FloorPlan["tables"][number] => {
  const row = record(value); return {
    id: uuid(row.id), areaId: uuid(row.areaId), name: string(row.name), backgroundAssetKey: nullableString(row.backgroundAssetKey),
    posX: number(row.posX), posY: number(row.posY), width: number(row.width), height: number(row.height),
    shape: oneOf(row.shape, ["round", "square", "rectangle"]), rotation: number(row.rotation), seats: nonNegativeInteger(row.seats),
    sortOrder: integer(row.sortOrder), status: oneOf(row.status, ["empty", "occupied"]),
  };
};
const mapDecor = (value: unknown): FloorPlan["decorItems"][number] => {
  const row = record(value); return {
    id: uuid(row.id), areaId: uuid(row.areaId), kind: oneOf(row.kind, ["wall", "plant", "counter", "door", "decor", "image"]),
    label: nullableString(row.label), assetKey: string(row.assetKey), posX: number(row.posX), posY: number(row.posY),
    width: number(row.width), height: number(row.height), rotation: number(row.rotation), zIndex: integer(row.zIndex), isLocked: boolean(row.isLocked),
  };
};
const mapFloor = (value: unknown): FloorPlan => {
  const row = record(value); return { areas: array(row.areas, mapArea), tables: array(row.tables, mapTable), decorItems: array(row.decorItems, mapDecor) };
};

const mapOrderSummary = (value: unknown): OrderSummary => {
  const row = record(value); return {
    id: uuid(row.id), orderNo: nonNegativeInteger(row.orderNo), status: oneOf(row.status, ["open", "paid", "void"]),
    total: nonNegativeInteger(row.total), lockVersion: nonNegativeInteger(row.lockVersion), tableId: row.tableId === null ? null : uuid(row.tableId),
    orderType: oneOf(row.orderType, ["dine_in", "takeaway"]), businessDate: businessDate(row.businessDate),
  };
};
const mapItemOption = (value: unknown): OrderItemOptionSnapshot => {
  const row = record(value); return {
    id: uuid(row.id), optionValueId: uuid(row.optionValueId), optionName: string(row.optionName),
    priceDelta: integer(row.priceDelta), quantity: nonNegativeInteger(row.quantity),
  };
};
const mapOrderItem = (value: unknown): OrderItemSnapshot => {
  const row = record(value); return {
    id: uuid(row.id), menuItemId: uuid(row.menuItemId), itemName: string(row.itemName), quantity: nonNegativeInteger(row.quantity),
    unitPrice: nonNegativeInteger(row.unitPrice), ...(row.note === undefined ? {} : { note: nullableString(row.note) }),
    options: array(row.options, mapItemOption),
  };
};
const mapPayment = (value: unknown): OrderPaymentSnapshot | null => {
  if (value === null) return null;
  const row = record(value); return {
    id: uuid(row.id), employeeId: uuid(row.employeeId), method: oneOf(row.method, ["cash", "bank_transfer", "qr", "other"]),
    amount: nonNegativeInteger(row.amount), receivedAmount: nonNegativeInteger(row.receivedAmount),
    changeAmount: nonNegativeInteger(row.changeAmount), paidAt: timestamp(row.paidAt),
  };
};

const mapReceiptOption = (value: unknown): ReceiptSnapshot["lines"][number]["options"][number] => {
  const row = record(value); return {
    optionValueId: uuid(row.optionValueId), name: string(row.name), priceDelta: integer(row.priceDelta), quantity: nonNegativeInteger(row.quantity),
  };
};
const mapReceiptLine = (value: unknown): ReceiptSnapshot["lines"][number] => {
  const row = record(value); return {
    orderItemId: uuid(row.orderItemId), menuItemId: uuid(row.menuItemId), name: string(row.name), quantity: nonNegativeInteger(row.quantity),
    baseUnitPrice: nonNegativeInteger(row.baseUnitPrice), options: array(row.options, mapReceiptOption),
    unitTotal: nonNegativeInteger(row.unitTotal), lineTotal: nonNegativeInteger(row.lineTotal), note: nullableString(row.note),
  };
};
const mapReceipt = (value: unknown): ReceiptSnapshot => {
  const row = record(value); if (row.schemaVersion !== 1) throw unavailable();
  return {
    schemaVersion: 1, orderId: uuid(row.orderId), paymentId: uuid(row.paymentId), orderNo: nonNegativeInteger(row.orderNo),
    businessDate: businessDate(row.businessDate), storeName: string(row.storeName), address: string(row.address), footer: string(row.footer),
    tableName: nullableString(row.tableName), paidAt: timestamp(row.paidAt), employeeName: string(row.employeeName),
    lines: array(row.lines, mapReceiptLine), total: nonNegativeInteger(row.total), receivedAmount: nonNegativeInteger(row.receivedAmount),
    changeAmount: nonNegativeInteger(row.changeAmount),
  };
};

const mapOrderDetail = (value: unknown): OrderDetail => {
  const row = record(value), summary = mapOrderSummary(row);
  const detail: OrderDetail = {
    ...summary, items: array(row.items, mapOrderItem), paidAt: nullableString(row.paidAt), payment: mapPayment(row.payment),
    voidedAt: row.voidedAt === null ? null : timestamp(row.voidedAt),
    voidedByEmployeeId: row.voidedByEmployeeId === null ? null : uuid(row.voidedByEmployeeId),
    voidReasonCode: row.voidReasonCode === null ? null : oneOf(row.voidReasonCode, ["wrong_order", "customer_request", "out_of_stock", "duplicate", "other"] as const),
    voidReasonNote: nullableString(row.voidReasonNote),
  };
  if (row.receiptSnapshot !== undefined) detail.receiptSnapshot = row.receiptSnapshot === null ? null : mapReceipt(row.receiptSnapshot);
  if (row.createdAt !== undefined) detail.createdAt = timestamp(row.createdAt);
  if (row.updatedAt !== undefined) detail.updatedAt = timestamp(row.updatedAt);
  if (row.createdByEmployeeId !== undefined) detail.createdByEmployeeId = row.createdByEmployeeId === null ? null : uuid(row.createdByEmployeeId);
  if (row.lastModifiedByEmployeeId !== undefined) detail.lastModifiedByEmployeeId = row.lastModifiedByEmployeeId === null ? null : uuid(row.lastModifiedByEmployeeId);
  return detail;
};
const mapOrderHistory = (value: unknown): OrderHistoryView => {
  const row = record(value); return {
    ...mapOrderDetail(row), cashierName: nullableString(row.cashierName), voidedByName: nullableString(row.voidedByName),
  };
};

const mapOpenOrder = (value: unknown): OpenOrderOperationalView => {
  const row = record(value); return {
    id: uuid(row.id), orderNo: nonNegativeInteger(row.orderNo), orderType: oneOf(row.orderType, ["dine_in", "takeaway"]),
    tableId: row.tableId === null ? null : uuid(row.tableId), status: oneOf(row.status, ["open"]), total: nonNegativeInteger(row.total),
    lockVersion: nonNegativeInteger(row.lockVersion), items: array(row.items, mapOrderItem),
  };
};
const mapPaidOrder = (value: unknown): PaidOrderVoidView => {
  const row = record(value); return {
    id: uuid(row.id), orderNo: nonNegativeInteger(row.orderNo), status: oneOf(row.status, ["paid"]),
    total: nonNegativeInteger(row.total), lockVersion: nonNegativeInteger(row.lockVersion),
  };
};
const mapFloorOperational = (value: unknown): FloorOperationalView => {
  const row = record(value); return {
    floorPlan: mapFloor(row.floorPlan), openOrders: array(row.openOrders, item => {
      const order = record(item); return {
        id: uuid(order.id), tableId: order.tableId === null ? null : uuid(order.tableId),
        orderType: oneOf(order.orderType, ["dine_in", "takeaway"]), orderNo: nonNegativeInteger(order.orderNo),
        total: nonNegativeInteger(order.total), createdAt: order.createdAt === null ? null : timestamp(order.createdAt),
      };
    }),
  };
};
const mapHistoryPage = (value: unknown): OrderSummaryPage => {
  const row = record(value); return { items: array(row.items, mapOrderSummary), total: nonNegativeInteger(row.total) };
};
const mapReport = (value: unknown): CoreReport => {
  const row = record(value); return {
    businessDate: businessDate(row.businessDate), revenue: nonNegativeInteger(row.revenue), paidOrders: nonNegativeInteger(row.paidOrders),
    averageTicket: nonNegativeInteger(row.averageTicket), topItemName: string(row.topItemName),
    hourlyRevenue: array(row.hourlyRevenue, item => { const hour = record(item); return { label: string(hour.label), revenue: nonNegativeInteger(hour.revenue) }; }),
    voidCount: nonNegativeInteger(row.voidCount), voidAmount: nonNegativeInteger(row.voidAmount),
  };
};
const mapReportOrder = (value: unknown): ReportOrderSummary => {
  const row = record(value); return {
    id: uuid(row.id), orderNo: nonNegativeInteger(row.orderNo), businessDate: businessDate(row.businessDate),
    orderType: oneOf(row.orderType, ["dine_in", "takeaway"]), total: nonNegativeInteger(row.total),
    status: oneOf(row.status, ["paid"]), tableName: nullableString(row.tableName),
  };
};
const mapSettings = (value: unknown): StoreSettings => {
  const row = record(value); if (row.currency !== "VND") throw unavailable();
  return {
    storeId: uuid(row.storeId), displayName: string(row.displayName), address: string(row.address), currency: "VND",
    timezone: string(row.timezone), billFooter: string(row.billFooter),
  };
};
const mapDisplay = (value: unknown): StoreDisplayView => {
  const row = record(value); if (row.currency !== "VND") throw unavailable();
  return { displayName: string(row.displayName), address: string(row.address), billFooter: string(row.billFooter), currency: "VND", timezone: string(row.timezone) };
};

/** Staged T07 adapter. Runtime composition remains unchanged until the activation task. */
export class SupabasePermissionReadRepo implements IPermissionReadRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  private assertGeneration(generation: number) {
    if (generation !== employeeCredential(this.client).generation) throw stale();
  }

  private transport(error: unknown): AppError {
    const mapped = mapSupabaseError(error, "PERMISSION_REFRESH_UNAVAILABLE");
    const code = readCodes.has(mapped.code) ? mapped.code as ReadErrorCode : "PERMISSION_REFRESH_UNAVAILABLE";
    const message = code === "PERMISSION_REFRESH_UNAVAILABLE" ? permissionErrorMessages.PERMISSION_REFRESH_UNAVAILABLE : readMessages[code];
    return new AppError(code as AppErrorCode, message);
  }

  private denial(value: unknown): never {
    const envelope = record(value), error = record(envelope.error), code = string(error.code);
    if (!readCodes.has(code)) throw unavailable();
    throw new AppError(code as ReadErrorCode, readMessages[code as ReadErrorCode]);
  }

  private async read<T>(
    name: string,
    args: (() => Record<string, unknown>) | undefined,
    decode: (envelope: Record<string, unknown>) => T,
  ): Promise<T> {
    const credential = employeeCredential(this.client), token = credential.token, generation = credential.generation;
    if (!token) throw stale();
    const parsedArgs = args?.();
    let response: { data: unknown; error: unknown };
    try {
      const request = parsedArgs === undefined ? this.client.rpc(name) : this.client.rpc(name, parsedArgs);
      response = await request.setHeader("x-pos-employee-token", token);
    } catch (error) {
      this.assertGeneration(generation); throw this.transport(error);
    }
    this.assertGeneration(generation);
    if (response.error) throw this.transport(response.error);
    const envelope = record(response.data);
    if (envelope.ok === false) this.denial(envelope);
    if (envelope.ok !== true) throw unavailable();
    const result = decode(envelope);
    // A credential switch queued alongside the transport resolution must win
    // before the old employee's decoded projection reaches its consumer.
    await Promise.resolve();
    this.assertGeneration(generation);
    return result;
  }

  getFloorOperational() {
    return this.read("permission_get_floor_operational", undefined, envelope => mapFloorOperational(envelope.data));
  }
  getPosMenu() { return this.read("permission_get_pos_menu", undefined, envelope => mapMenu(envelope.data)); }
  getOpenOrderDetail(orderId: string) {
    return this.read("permission_get_open_order_detail", () => ({ p_order_id: validatePermissionReadOrderId(orderId) }), envelope => mapOpenOrder(envelope.data));
  }
  getPaidOrderForVoid(orderId: string) {
    return this.read("permission_get_paid_order_for_void", () => ({ p_order_id: validatePermissionReadOrderId(orderId) }), envelope => mapPaidOrder(envelope.data));
  }
  listOrderHistory(filter: OrderHistoryFilter) {
    return this.read("permission_list_order_history", () => ({ p_filter: parsePermissionHistoryFilter(filter) }), envelope => mapHistoryPage(envelope.data));
  }
  getOrderHistoryDetail(orderId: string) {
    return this.read("permission_get_order_history_detail", () => ({ p_order_id: validatePermissionReadOrderId(orderId) }), envelope => mapOrderHistory(envelope.data));
  }
  getReceipt(orderId: string) {
    return this.read("get_payment_receipt", () => ({ p_order_id: validatePermissionReadOrderId(orderId) }), envelope => {
      if (typeof envelope.legacyMetadata !== "boolean") throw unavailable();
      return { receipt: mapReceipt(envelope.receipt), legacyMetadata: envelope.legacyMetadata };
    });
  }
  getSalesReport(filter: ReportFilter) {
    return this.read("permission_get_sales_report", () => ({ p_filter: parsePermissionReportFilter(filter) }), envelope => mapReport(envelope.data));
  }
  listReportOrders(filter: ReportSummaryFilter) {
    return this.read("permission_list_report_orders", () => ({ p_filter: parsePermissionReportSummaryFilter(filter) }), envelope => array(envelope.data, mapReportOrder));
  }
  getMenuAdmin() { return this.read("permission_get_menu_admin", undefined, envelope => mapMenu(envelope.data)); }
  getFloorAdmin() { return this.read("permission_get_floor_admin", undefined, envelope => mapFloor(envelope.data)); }
  getSettingsAdmin() { return this.read("permission_get_settings_admin", undefined, envelope => mapSettings(envelope.data)); }
  getStoreDisplay() { return this.read("permission_get_store_display", undefined, envelope => mapDisplay(envelope.data)); }
}
