import { AppError } from "@/core/appError";
import { writeError } from "@/core/writeErrors";
import { requirePermission } from "@/core/guards";
import type {
  Employee,
  EmployeePermission,
  MenuCatalog,
  MenuItem,
  OptionGroup,
  OptionValue,
  OrderDetail,
  OrderItemSnapshot,
  OrderType,
  PayOrderItemLine,
  PayOrderItemsResult,
  PayOrderResult,
  PrintLine,
  SubmitOrderChangesResult,
  SubmitOrderDraftItem,
  SubmitOrderDraftOption,
  VoidOrderResult,
  VoidReasonCode,
  NewLine,
  ReceiptSnapshot,
  PrintReceipt,
  WritePayloadV1,
} from "@/domain";
import type { AppPorts } from "@/ports";
import { appliedResult, getWriteCoordinator } from "./writeOperationFlow";

export type OrderFlowContext = {
  orderId: string | null;
  tableId: string | null;
  orderType: OrderType;
};

export type CartLine = {
  id: string;
  name: string;
  quantity: number;
  optionText: string;
  total: number;
};

export type OrderPrimaryAction = "submit" | "payment" | "closed";

export type SubmitOrderFlowInput = {
  context: OrderFlowContext;
  actor: Employee;
  expectedVersion: number | null;
  items: SubmitOrderDraftItem[];
  menu?: MenuCatalog;
};

export type PayOrderFlowInput = {
  order: OrderDetail;
  actor: Employee;
  receivedAmount: number;
  paymentId?: string;
  printReceipt?: boolean;
};

export const getSubmitOrderPermission = (
  context: Pick<OrderFlowContext, "orderId">,
  items: SubmitOrderDraftItem[],
): EmployeePermission => {
  if (context.orderId == null) return "order.create";
  return items.some((item) => item.quantity > 0) ? "order.update" : "order.voidOpen";
};

const createClientId = (): string => crypto.randomUUID();

export const snapshotToDraft = (item: OrderItemSnapshot): SubmitOrderDraftItem => ({
  id: item.id,
  sourceItemId: item.id,
  sourceQuantity: item.quantity,
  snapshotName: item.itemName,
  quotedBasePrice: item.unitPrice,
  menuItemId: item.menuItemId,
  quantity: item.quantity,
  note: item.note ?? null,
  options: item.options.map((option) => ({
    id: option.id,
    optionValueId: option.optionValueId,
    quantity: option.quantity,
    quotedPriceDelta: option.priceDelta,
    snapshotName: option.optionName,
  })),
});

export const orderDetailToDraft = (order: OrderDetail): SubmitOrderDraftItem[] =>
  order.items.map(snapshotToDraft);

export const buildCartLines = (menu: MenuCatalog, draftItems: SubmitOrderDraftItem[]): CartLine[] =>
  draftItems
    .filter((draft) => draft.quantity > 0)
    .map((draft) => {
      const menuItem = menu.menuItems.find((item) => item.id === draft.menuItemId);
      const options = draft.options.map((option) => ({
        option,
        value: menu.optionValues.find((candidate) => candidate.id === option.optionValueId),
      }));
      const optionDelta = options.reduce(
        (sum, option) => sum + (option.option.quotedPriceDelta ?? option.value?.priceDelta ?? 0) * option.option.quantity,
        0,
      );
      const unitPrice = draft.quotedBasePrice ?? menuItem?.price ?? 0;

      return {
        id: draft.id,
        name: draft.snapshotName ?? menuItem?.name ?? "Món không còn hợp lệ",
        quantity: draft.quantity,
        optionText: options
          .map((option) => {
            const name = option.option.snapshotName ?? option.value?.name ?? "Tuỳ chọn không còn hợp lệ";
            return option.option.quantity > 1 ? `${name} ×${option.option.quantity}` : name;
          })
          .filter(Boolean)
          .join(", "),
        total: (unitPrice + optionDelta) * draft.quantity,
      };
    });

export const calculateCartTotal = (cartLines: CartLine[]): number =>
  cartLines.reduce((sum, line) => sum + line.total, 0);

/**
 * Các dòng món MỚI THÊM so với đơn hiện tại (để in phiếu gửi bếp khi "Gửi đơn").
 * Các phần mới không có sourceItemId; giữ đúng giá đã hiển thị lúc xác nhận.
 * Đây chỉ là seam cho lượt gửi chủ động, không phục hồi/in lại delta bếp.
 */
export const diffAddedPrintLines = (
  menu: MenuCatalog,
  order: OrderDetail | null,
  draftItems: SubmitOrderDraftItem[],
): PrintLine[] => {
  const newItems = order ? draftItems.filter((item) => !item.sourceItemId) : draftItems;
  return buildCartLines(menu, newItems).map((line) => ({
    name: line.name, quantity: line.quantity, unitPrice: line.total / line.quantity,
    options: [line.optionText, newItems.find((item) => item.id === line.id)?.note ?? ""].filter(Boolean),
  }));
};

const optionSignature = (options: Pick<SubmitOrderDraftOption, "optionValueId" | "quantity">[]): string =>
  options.map((option) => `${option.optionValueId}:${option.quantity}`).sort().join(",");

export type ItemModifierGroup = {
  group: OptionGroup;
  values: OptionValue[];
};

/**
 * Các nhóm tuỳ chọn (kèm giá trị) gắn với một món, theo thứ tự sortOrder của liên kết.
 * Dùng để quyết định có hiện popup chọn modifier hay không và để dựng popup.
 */
export const getItemModifierGroups = (menu: MenuCatalog, menuItemId: string): ItemModifierGroup[] =>
  menu.menuItemOptionGroups
    .filter((link) => link.menuItemId === menuItemId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((link) => menu.optionGroups.find((group) => group.id === link.optionGroupId))
    .filter((group): group is OptionGroup => !!group)
    .map((group) => ({
      group,
      values: menu.optionValues
        .filter((value) => value.optionGroupId === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));

export const addDraftMenuItem = (
  draftItems: SubmitOrderDraftItem[],
  menuItem: Pick<MenuItem, "id"> & Partial<Pick<MenuItem, "price" | "name">>,
  options: SubmitOrderDraftOption[] = [],
): SubmitOrderDraftItem[] => {
  const signature = optionSignature(options);
  const existing = draftItems.find((item) => !item.sourceItemId && item.menuItemId === menuItem.id
    && !item.note && item.quotedBasePrice === menuItem.price && optionSignature(item.options) === signature
    && item.options.every((option) => option.quotedPriceDelta === options.find((other) => other.optionValueId === option.optionValueId)?.quotedPriceDelta));
  if (existing && existing.quantity < 999) return draftItems.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item);
  return [...draftItems, { id: createClientId(), menuItemId: menuItem.id, quantity: 1, note: null,
    quotedBasePrice: menuItem.price, snapshotName: menuItem.name, options }];
};

export const adjustDraftQuantity = (
  draftItems: SubmitOrderDraftItem[], draftItemId: string, delta: number, menu?: MenuCatalog,
): SubmitOrderDraftItem[] => {
  const source = draftItems.find((item) => item.id === draftItemId);
  if (source?.sourceItemId && delta > 0) {
    const current = menu?.menuItems.find((item) => item.id === source.menuItemId);
    if (!current?.isAvailable) throw new AppError("MENU_ITEM_UNAVAILABLE", "Món không còn khả dụng. Vui lòng chọn lại.");
    const groups = getItemModifierGroups(menu!, current.id);
    const options = source.options.map((option) => {
      const value = menu?.optionValues.find((candidate) => candidate.id === option.optionValueId);
      if (!value || !groups.some(({group}) => group.id === value.optionGroupId)) throw writeError("OPTION_VALUE_UNAVAILABLE");
      return { id: createClientId(), optionValueId: value.id, quantity: option.quantity, quotedPriceDelta: value.priceDelta, snapshotName: value.name };
    });
    for (const {group,values} of groups) {
      const count = options.filter(option => values.some(value => value.id === option.optionValueId)).length;
      if ((group.isRequired && count === 0) || (group.selectType === "single" && count > 1)) throw writeError("OPTION_VALUE_UNAVAILABLE");
    }
    return addDraftMenuItem(draftItems, current, options);
  }
  return draftItems.map((item) => item.id === draftItemId ? { ...item, quantity: Math.min(999, Math.max(0, item.quantity + delta)) } : item)
    .filter((item) => item.quantity > 0 || item.sourceItemId);
};

const normalizedDraft = (items: SubmitOrderDraftItem[]): string[] => items.map((item) => ({
  id: item.id, sourceItemId: item.sourceItemId, menuItemId: item.menuItemId, quantity: item.quantity,
  note: item.note ?? null, quotedBasePrice: item.quotedBasePrice,
  options: item.options.map((option) => `${option.id}:${option.optionValueId}:${option.quantity}:${option.quotedPriceDelta}`).sort(),
})).map((item) => JSON.stringify(item)).sort();

export const isDraftChangedFromOrder = (
  order: OrderDetail | null,
  draftItems: SubmitOrderDraftItem[],
): boolean => {
  if (!order) {
    return draftItems.some((item) => item.quantity > 0);
  }

  return JSON.stringify(normalizedDraft(orderDetailToDraft(order))) !== JSON.stringify(normalizedDraft(draftItems));
};

export const getOrderPrimaryAction = (
  order: OrderDetail | null,
  draftItems: SubmitOrderDraftItem[],
): OrderPrimaryAction => {
  if (order && order.status !== "open") {
    return "closed";
  }

  return order && !isDraftChangedFromOrder(order, draftItems) ? "payment" : "submit";
};

const newLinesFromDraft = (items: SubmitOrderDraftItem[], menu?: MenuCatalog): NewLine[] => items.filter((item) => !item.sourceItemId && item.quantity > 0).map((item) => ({
  id: item.id, menuItemId: item.menuItemId, quantity: item.quantity, note: item.note ?? null,
  quotedBasePrice: item.quotedBasePrice ?? menu?.menuItems.find((candidate) => candidate.id === item.menuItemId)?.price ?? Number.NaN,
  options: item.options.map((option) => ({ id: option.id, optionValueId: option.optionValueId, quantity: option.quantity,
    quotedPriceDelta: option.quotedPriceDelta ?? menu?.optionValues.find((candidate) => candidate.id === option.optionValueId)?.priceDelta ?? Number.NaN })),
}));

export const receiptToPrint = (snapshot: ReceiptSnapshot, orderType: OrderType): PrintReceipt => ({
  snapshot, orderType, orderNo: snapshot.orderNo, tableName: snapshot.tableName,
  total: snapshot.total, receivedAmount: snapshot.receivedAmount, changeAmount: snapshot.changeAmount, paidAt: snapshot.paidAt,
  lines: snapshot.lines.map((line) => ({ name: line.name, quantity: line.quantity, unitPrice: line.unitTotal,
    options: [...line.options.map((option) => option.quantity > 1 ? `${option.name} × ${option.quantity}` : option.name), ...(line.note ? [`Ghi chú: ${line.note}`] : [])] })),
});

export const submitOrderAndPrint = async (
  ports: AppPorts, input: SubmitOrderFlowInput,
): Promise<SubmitOrderChangesResult & { initialSuccess: boolean }> => {
  requirePermission(input.actor, getSubmitOrderPermission(input.context, input.items));
  const orderId = input.context.orderId ?? createClientId();
  const base = { schemaVersion: 1 as const, kind: "submit_order_changes" as const, orderId };
  let payload: WritePayloadV1;
  if (!input.context.orderId) payload = { ...base, action: "create", expectedVersion: null,
    orderType: input.context.orderType, tableId: input.context.tableId, newLines: newLinesFromDraft(input.items, input.menu) };
  else if (!input.items.some((item) => item.quantity > 0)) payload = { ...base, action: "void_open", expectedVersion: input.expectedVersion! };
  else payload = { ...base, action: "update", expectedVersion: input.expectedVersion!,
    retainedLines: input.items.filter((item) => item.sourceItemId).map((item) => ({ sourceItemId: item.sourceItemId!, quantity: item.quantity, note: item.note ?? null })),
    newLines: newLinesFromDraft(input.items, input.menu) };
  const { operation, initial } = await getWriteCoordinator(ports.write).begin(payload);
  const result = appliedResult(operation);
  if (result.kind !== "submit_order_changes") throw new AppError("INVALID_WRITE_REQUEST", "Kết quả thao tác không hợp lệ.");
  const order = result.order;
  return { initialSuccess: initial, orderId: order.id, orderNo: order.orderNo, status: order.status === "void" ? "void" : "open",
    tableId: order.tableId, tableStatus: order.tableId ? order.status === "open" ? "occupied" : "empty" : null,
    businessDate: order.businessDate, lockVersion: order.lockVersion, ticket: null };
};

export const payOrderAndPrint = async (
  ports: AppPorts, input: PayOrderFlowInput,
): Promise<PayOrderResult & { initialSuccess: boolean }> => {
  requirePermission(input.actor, "payment.take");
  if (input.order.total <= 0) throw new AppError("INVALID_ORDER_ITEMS", "Các món được chọn không hợp lệ. Vui lòng kiểm tra lại đơn.");
  if (input.receivedAmount < input.order.total) throw new AppError("PAYMENT_AMOUNT_TOO_LOW", "Tiền nhận chưa đủ để thanh toán phần đã chọn.");
  const { operation, initial } = await getWriteCoordinator(ports.write).begin({ schemaVersion: 1, kind: "pay_order", orderId: input.order.id,
    paymentId: input.paymentId ?? createClientId(), expectedVersion: input.order.lockVersion, method: "cash", receivedAmount: input.receivedAmount });
  const result = appliedResult(operation);
  if (result.kind !== "pay_order") throw new AppError("INVALID_WRITE_REQUEST", "Kết quả thao tác không hợp lệ.");
  return { initialSuccess: initial, orderId: result.order.id, paymentId: result.payment.id, status: "paid", total: result.payment.amount,
    receivedAmount: result.payment.receivedAmount, changeAmount: result.payment.changeAmount, lockVersion: result.order.lockVersion,
    receipt: receiptToPrint(result.receipt, result.order.orderType) };
};

// ----- Instant pay: chọn món/số lượng để tách đơn thanh toán riêng -------------

export type PayableLine = {
  orderItemId: string;
  name: string;
  optionText: string;
  note: string | null;
  quantity: number;
  /** Đơn giá 1 món đã gồm chênh lệch tuỳ chọn. */
  unitTotal: number;
};

/** Lựa chọn thanh toán: orderItemId -> số lượng trả lần này. */
export type PaymentSelection = Record<string, number>;

export const buildPayableLines = (order: OrderDetail): PayableLine[] =>
  order.items.map((item) => ({
    orderItemId: item.id,
    name: item.itemName,
    optionText: item.options
      .map((option) => (option.quantity > 1 ? `${option.optionName} ×${option.quantity}` : option.optionName))
      .join(", "),
    note: item.note ?? null,
    quantity: item.quantity,
    unitTotal: item.unitPrice + item.options.reduce((sum, option) => sum + option.priceDelta * option.quantity, 0),
  }));

/** Selection "Chọn tất cả": toàn bộ số lượng của mọi dòng. */
export const fullSelection = (lines: PayableLine[]): PaymentSelection =>
  Object.fromEntries(lines.map((line) => [line.orderItemId, line.quantity]));

/** Kẹp selection về dữ liệu đơn mới nhất (sau refetch): bỏ dòng không còn, chặn vượt số lượng. */
export const clampSelection = (lines: PayableLine[], selection: PaymentSelection): PaymentSelection => {
  const clamped: PaymentSelection = {};
  for (const line of lines) {
    const quantity = Math.min(selection[line.orderItemId] ?? 0, line.quantity);
    if (quantity > 0) clamped[line.orderItemId] = quantity;
  }
  return clamped;
};

export const selectionAmount = (lines: PayableLine[], selection: PaymentSelection): number =>
  lines.reduce((sum, line) => sum + (selection[line.orderItemId] ?? 0) * line.unitTotal, 0);

/** Chọn đủ 100% -> đi đường payOrder (đơn đóng, bàn trống), không tách đơn. */
export const isFullSelection = (lines: PayableLine[], selection: PaymentSelection): boolean =>
  lines.length > 0 && lines.every((line) => (selection[line.orderItemId] ?? 0) === line.quantity);

export type PayOrderItemsFlowInput = {
  order: OrderDetail;
  actor: Employee;
  receivedAmount: number;
  selection: PaymentSelection;
  paymentId?: string;
  printReceipt?: boolean;
};

export type PayOrderItemsFlowResult =
  | ({ mode: "full"; initialSuccess: boolean } & PayOrderResult)
  | ({ mode: "split"; initialSuccess: boolean } & PayOrderItemsResult);

/**
 * Thanh toán theo selection: đủ 100% -> payOrder (đơn đóng, bàn trống); một phần
 * -> payOrderItems TÁCH các món được chọn ra đơn mới độc lập và trả đơn đó ngay,
 * đơn gốc vẫn mở trên bàn với phần còn lại (và nhận order_no mới).
 */
export const payOrderItemsAndPrint = async (
  ports: AppPorts,
  input: PayOrderItemsFlowInput,
): Promise<PayOrderItemsFlowResult> => {
  requirePermission(input.actor, "payment.take");

  const lines = buildPayableLines(input.order);
  const selection = input.selection;
  if (Object.entries(selection).some(([id, quantity]) => !Number.isInteger(quantity) || quantity < 1 || quantity > (lines.find((line) => line.orderItemId === id)?.quantity ?? 0)))
    throw new AppError("INVALID_ORDER_ITEMS", "Các món được chọn không hợp lệ. Vui lòng kiểm tra lại đơn.");
  const amount = selectionAmount(lines, selection);

  if (amount <= 0 || Object.keys(selection).length === 0) {
    throw writeError("INVALID_ORDER_ITEMS");
  }

  if (isFullSelection(lines, selection)) {
    const result = await payOrderAndPrint(ports, {
      order: input.order,
      actor: input.actor,
      receivedAmount: input.receivedAmount,
      paymentId: input.paymentId,
      printReceipt: input.printReceipt,
    });
    return { mode: "full", ...result };
  }

  if (input.receivedAmount < amount) {
    throw writeError("PAYMENT_AMOUNT_TOO_LOW");
  }

  const items: PayOrderItemLine[] = Object.entries(selection).map(([orderItemId, quantity]) => ({
    orderItemId,
    quantity,
    splitItemId: createClientId(),
  }));

  const { operation, initial } = await getWriteCoordinator(ports.write).begin({ schemaVersion: 1, kind: "pay_order_items",
    paymentId: input.paymentId ?? createClientId(), orderId: input.order.id, newOrderId: createClientId(), method: "cash",
    expectedVersion: input.order.lockVersion, receivedAmount: input.receivedAmount, lines: items });
  const result = appliedResult(operation);
  if (result.kind !== "pay_order_items") throw new AppError("INVALID_WRITE_REQUEST", "Kết quả thao tác không hợp lệ.");
  return { mode: "split", initialSuccess: initial, orderId: result.paidOrder.id, orderNo: result.paidOrder.orderNo, paymentId: result.payment.id,
    status: "paid", total: result.payment.amount, receivedAmount: result.payment.receivedAmount, changeAmount: result.payment.changeAmount,
    receipt: receiptToPrint(result.receipt, result.paidOrder.orderType), sourceOrderId: result.sourceOrder.id,
    sourceOrderNo: result.sourceOrder.orderNo, sourceTotal: result.sourceOrder.total, sourceLockVersion: result.sourceOrder.lockVersion };
};

// ----- Hủy đơn đã thanh toán --------------------------------------------------

export type VoidPaidOrderFlowInput = {
  actor: Employee;
  order: Pick<OrderDetail, "id" | "lockVersion">;
  reasonCode: VoidReasonCode;
  reasonNote?: string | null;
};

/**
 * Hủy một đơn ĐÃ THANH TOÁN. Chốt quyền tại flow (không tin nút bị ẩn) qua
 * requirePermission("order.voidPaid"); "Lý do khác" bắt buộc có ghi chú.
 */
export const voidPaidOrder = async (
  ports: AppPorts,
  input: VoidPaidOrderFlowInput,
): Promise<VoidOrderResult> => {
  requirePermission(input.actor, "order.voidPaid");

  if (input.reasonNote != null && typeof input.reasonNote !== "string") throw writeError("INVALID_WRITE_REQUEST");
  const note = (input.reasonNote ?? "").trim();
  if (input.reasonCode === "other" && !note) {
    throw writeError("VOID_REASON_REQUIRED");
  }

  const { operation } = await getWriteCoordinator(ports.write).begin({ schemaVersion: 1, kind: "void_order", orderId: input.order.id,
    expectedVersion: input.order.lockVersion, reason: input.reasonCode, reasonNote: note || null });
  const result = appliedResult(operation);
  if (result.kind !== "void_order") throw new AppError("INVALID_WRITE_REQUEST", "Kết quả thao tác không hợp lệ.");
  return { orderId: result.order.id, status: "void", lockVersion: result.order.lockVersion, voidedAt: result.order.voidedAt! };
};
