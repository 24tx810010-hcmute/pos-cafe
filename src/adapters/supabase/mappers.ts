import type {
  Category,
  CoreReport,
  DecorKind,
  Employee,
  EmployeeRole,
  FloorArea,
  FloorDecorItem,
  FloorPlan,
  FloorTable,
  MenuCatalog,
  MenuItem,
  OptionGroup,
  OptionValue,
  OrderDetail,
  OrderItemOptionSnapshot,
  OrderItemSnapshot,
  OrderPaymentSnapshot,
  OrderStatus,
  OrderSummary,
  PayOrderResult,
  PaymentMethod,
  PrintLine,
  PrintReceipt,
  PrintTicket,
  StoreSettings,
  SubmitOrderChangesResult,
  TableShape,
  TableStatus,
} from "@/domain";

export type Row = Record<string, unknown>;

const asString = (value: unknown): string => String(value ?? "");
const asNullableString = (value: unknown): string | null => (value == null ? null : String(value));
const asNumber = (value: unknown): number => Number(value ?? 0);
const asBoolean = (value: unknown): boolean => Boolean(value);

export const mapEmployee = (row: Row): Employee => ({
  id: asString(row.id),
  name: asString(row.name),
  role: asString(row.role) as EmployeeRole,
  isActive: row.is_active == null ? true : asBoolean(row.is_active),
});

export const mapSettings = (row: Row): StoreSettings => ({
  storeId: asString(row.store_id),
  displayName: asString(row.display_name),
  address: asString(row.address),
  currency: "VND",
  timezone: asString(row.timezone || "Asia/Saigon"),
  billFooter: asString(row.bill_footer),
});

export const mapCategory = (row: Row): Category => ({
  id: asString(row.id),
  name: asString(row.name),
  sortOrder: asNumber(row.sort_order),
});

export const mapMenuItem = (row: Row): MenuItem => ({
  id: asString(row.id),
  categoryId: asString(row.category_id),
  name: asString(row.name),
  price: asNumber(row.price),
  imageAssetKey: asNullableString(row.image_asset_key),
  sortOrder: asNumber(row.sort_order),
  isAvailable: asBoolean(row.is_available),
});

export const mapOptionGroup = (row: Row): OptionGroup => ({
  id: asString(row.id),
  menuItemId: asString(row.menu_item_id),
  name: asString(row.name),
  selectType: asString(row.select_type) as OptionGroup["selectType"],
  isRequired: asBoolean(row.is_required),
  minSelect: asNumber(row.min_select),
  maxSelect: asNumber(row.max_select),
  sortOrder: asNumber(row.sort_order),
});

export const mapOptionValue = (row: Row): OptionValue => ({
  id: asString(row.id),
  optionGroupId: asString(row.option_group_id),
  name: asString(row.name),
  priceDelta: asNumber(row.price_delta),
  sortOrder: asNumber(row.sort_order),
});

export const mapMenuCatalog = (
  categories: Row[],
  menuItems: Row[],
  optionGroups: Row[],
  optionValues: Row[],
): MenuCatalog => ({
  categories: categories.map(mapCategory),
  menuItems: menuItems.map(mapMenuItem),
  optionGroups: optionGroups.map(mapOptionGroup),
  optionValues: optionValues.map(mapOptionValue),
});

export const mapFloorArea = (row: Row): FloorArea => ({
  id: asString(row.id),
  name: asString(row.name),
  sortOrder: asNumber(row.sort_order),
});

export const mapFloorTable = (row: Row): FloorTable => ({
  id: asString(row.id),
  areaId: asString(row.area_id),
  name: asString(row.name),
  posX: asNumber(row.pos_x),
  posY: asNumber(row.pos_y),
  width: asNumber(row.width),
  height: asNumber(row.height),
  shape: asString(row.shape) as TableShape,
  rotation: asNumber(row.rotation),
  seats: asNumber(row.seats),
  sortOrder: asNumber(row.sort_order),
  status: asString(row.status) as TableStatus,
});

export const mapFloorDecorItem = (row: Row): FloorDecorItem => ({
  id: asString(row.id),
  areaId: asString(row.area_id),
  kind: asString(row.kind) as DecorKind,
  label: asNullableString(row.label),
  assetKey: asString(row.asset_key),
  posX: asNumber(row.pos_x),
  posY: asNumber(row.pos_y),
  width: asNumber(row.width),
  height: asNumber(row.height),
  rotation: asNumber(row.rotation),
  zIndex: asNumber(row.z_index),
  isLocked: asBoolean(row.is_locked),
});

export const mapFloorPlan = (areas: Row[], tables: Row[], decorItems: Row[]): FloorPlan => ({
  areas: areas.map(mapFloorArea),
  tables: tables.map(mapFloorTable),
  decorItems: decorItems.map(mapFloorDecorItem),
});

export const mapOrderSummary = (row: Row): OrderSummary => ({
  id: asString(row.id),
  orderNo: asNumber(row.order_no),
  status: asString(row.status) as OrderStatus,
  total: asNumber(row.total),
  lockVersion: asNumber(row.lock_version),
  tableId: asNullableString(row.table_id),
  orderType: asString(row.order_type) as OrderSummary["orderType"],
  businessDate: asString(row.business_date),
});

export const mapOrderItemOption = (row: Row): OrderItemOptionSnapshot => ({
  id: asString(row.id),
  optionValueId: asString(row.option_value_id),
  optionName: asString(row.option_name),
  priceDelta: asNumber(row.price_delta),
});

export const mapOrderItem = (row: Row, options: OrderItemOptionSnapshot[]): OrderItemSnapshot => ({
  id: asString(row.id),
  menuItemId: asString(row.menu_item_id),
  itemName: asString(row.item_name),
  quantity: asNumber(row.quantity),
  unitPrice: asNumber(row.unit_price),
  note: asNullableString(row.note),
  options,
});

export const mapOrderPayment = (row: Row | null | undefined): OrderPaymentSnapshot | null => {
  if (!row) return null;

  return {
    id: asString(row.id),
    employeeId: asString(row.employee_id),
    method: asString(row.method) as PaymentMethod,
    amount: asNumber(row.amount),
    receivedAmount: asNumber(row.received_amount),
    changeAmount: asNumber(row.change_amount),
    paidAt: asString(row.paid_at),
  };
};

export const mapOrderDetail = (
  orderRow: Row,
  itemRows: Row[],
  optionRows: Row[],
  paymentRow?: Row | null,
): OrderDetail => {
  const optionsByItem = new Map<string, OrderItemOptionSnapshot[]>();

  for (const optionRow of optionRows) {
    const orderItemId = asString(optionRow.order_item_id);
    const options = optionsByItem.get(orderItemId) ?? [];
    options.push(mapOrderItemOption(optionRow));
    optionsByItem.set(orderItemId, options);
  }

  return {
    ...mapOrderSummary(orderRow),
    paidAt: asNullableString(orderRow.paid_at),
    payment: mapOrderPayment(paymentRow),
    items: itemRows.map((itemRow) => mapOrderItem(itemRow, optionsByItem.get(asString(itemRow.id)) ?? [])),
  };
};

const mapPrintLine = (line: Row): PrintLine => ({
  name: asString(line.name),
  quantity: asNumber(line.quantity),
  unitPrice: asNumber(line.unitPrice),
  options: Array.isArray(line.options) ? line.options.map(String) : [],
});

export const mapPrintTicket = (value: unknown): PrintTicket | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Row;
  const lines = Array.isArray(row.lines) ? (row.lines as Row[]).map(mapPrintLine) : [];

  return {
    orderNo: asNumber(row.orderNo),
    tableName: asNullableString(row.tableName),
    orderType: asString(row.orderType) as PrintTicket["orderType"],
    lines,
    total: asNumber(row.total),
  };
};

export const mapPrintReceipt = (value: unknown): PrintReceipt => {
  const ticket = mapPrintTicket(value) ?? {
    orderNo: 0,
    tableName: null,
    orderType: "takeaway",
    lines: [],
    total: 0,
  };
  const row = (value ?? {}) as Row;

  return {
    ...ticket,
    receivedAmount: asNumber(row.receivedAmount),
    changeAmount: asNumber(row.changeAmount),
    paidAt: asString(row.paidAt),
  };
};

export const mapSubmitOrderChangesResult = (row: Row): SubmitOrderChangesResult => ({
  orderId: asNullableString(row.orderId),
  status: asString(row.status) as SubmitOrderChangesResult["status"],
  tableId: asNullableString(row.tableId),
  tableStatus: row.tableStatus == null ? null : (asString(row.tableStatus) as TableStatus),
  orderNo: asNumber(row.orderNo),
  businessDate: asString(row.businessDate),
  lockVersion: asNumber(row.lockVersion),
  ticket: mapPrintTicket(row.ticket),
});

export const mapPayOrderResult = (row: Row): PayOrderResult => ({
  orderId: asString(row.orderId),
  paymentId: asString(row.paymentId),
  status: "paid",
  total: asNumber(row.total),
  receivedAmount: asNumber(row.receivedAmount),
  changeAmount: asNumber(row.changeAmount),
  lockVersion: asNumber(row.lockVersion),
  receipt: mapPrintReceipt(row.receipt),
});

export const emptyCoreReport = (businessDate: string): CoreReport => ({
  businessDate,
  revenue: 0,
  paidOrders: 0,
  averageTicket: 0,
  topItemName: "-",
  hourlyRevenue: [],
});
