import { AppError } from "@/core/appError";
import type {
  MenuCatalog,
  MenuItem,
  OptionGroup,
  OptionValue,
  OrderDetail,
  OrderItemSnapshot,
  OrderType,
  PayOrderResult,
  PrintLine,
  SubmitOrderChangesResult,
  SubmitOrderDraftItem,
  SubmitOrderDraftOption,
} from "@/domain";
import type { AppPorts } from "@/ports";

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
  employeeId: string;
  expectedVersion: number | null;
  items: SubmitOrderDraftItem[];
};

export type PayOrderFlowInput = {
  order: OrderDetail;
  employeeId: string;
  receivedAmount: number;
  paymentId?: string;
  printReceipt?: boolean;
};

const createClientId = (): string => crypto.randomUUID();

export const snapshotToDraft = (item: OrderItemSnapshot): SubmitOrderDraftItem => ({
  id: createClientId(),
  menuItemId: item.menuItemId,
  quantity: item.quantity,
  note: item.note ?? null,
  options: item.options.map((option) => ({
    id: createClientId(),
    optionValueId: option.optionValueId,
    quantity: option.quantity,
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
        (sum, option) => sum + (option.value?.priceDelta ?? 0) * option.option.quantity,
        0,
      );
      const unitPrice = menuItem?.price ?? 0;

      return {
        id: draft.id,
        name: menuItem?.name ?? "Món không còn hợp lệ",
        quantity: draft.quantity,
        optionText: options
          .map((option) => {
            const name = option.value?.name ?? "Tuỳ chọn không còn hợp lệ";
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
 * Khớp theo nội dung (menuItem + tổ hợp option + ghi chú) vì draft sinh id mới
 * mỗi lần nên không thể khớp theo id với snapshot đơn cũ. Trả về phần chênh > 0.
 */
export const diffAddedPrintLines = (
  menu: MenuCatalog,
  order: OrderDetail | null,
  draftItems: SubmitOrderDraftItem[],
): PrintLine[] => {
  type OptionPair = { optionValueId: string; quantity: number };
  const optionTokens = (options: OptionPair[]): string[] =>
    options.map((option) => `${option.optionValueId}:${option.quantity}`).sort();
  const signature = (menuItemId: string, options: OptionPair[], note: string | null): string =>
    `${menuItemId}|${optionTokens(options).join(",")}|${note ?? ""}`;

  const oldQty = new Map<string, number>();
  for (const item of order?.items ?? []) {
    const key = signature(item.menuItemId, item.options, item.note ?? null);
    oldQty.set(key, (oldQty.get(key) ?? 0) + item.quantity);
  }

  const aggregated = new Map<
    string,
    { qty: number; menuItemId: string; options: OptionPair[]; note: string | null }
  >();
  for (const draft of draftItems) {
    if (draft.quantity <= 0) continue;
    const key = signature(draft.menuItemId, draft.options, draft.note ?? null);
    const current = aggregated.get(key);
    if (current) current.qty += draft.quantity;
    else aggregated.set(key, { qty: draft.quantity, menuItemId: draft.menuItemId, options: draft.options, note: draft.note ?? null });
  }

  const lines: PrintLine[] = [];
  for (const entry of aggregated.values()) {
    const key = signature(entry.menuItemId, entry.options, entry.note);
    const added = entry.qty - (oldQty.get(key) ?? 0);
    if (added <= 0) continue;

    const menuItem = menu.menuItems.find((candidate) => candidate.id === entry.menuItemId);
    const optionNames: string[] = [];
    let optionDelta = 0;
    for (const option of entry.options) {
      const optionValue = menu.optionValues.find((candidate) => candidate.id === option.optionValueId);
      if (optionValue) {
        optionNames.push(option.quantity > 1 ? `${optionValue.name} ×${option.quantity}` : optionValue.name);
        optionDelta += optionValue.priceDelta * option.quantity;
      }
    }

    lines.push({
      name: menuItem?.name ?? "Món",
      quantity: added,
      unitPrice: (menuItem?.price ?? 0) + optionDelta,
      options: [...optionNames, ...(entry.note ? [`Ghi chú: ${entry.note}`] : [])],
    });
  }
  return lines;
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
  menuItem: Pick<MenuItem, "id">,
  options: SubmitOrderDraftOption[] = [],
): SubmitOrderDraftItem[] => {
  // Gộp với dòng cùng món, cùng tổ hợp tuỳ chọn và chưa có ghi chú riêng.
  const signature = optionSignature(options);
  const existing = draftItems.find(
    (item) =>
      item.menuItemId === menuItem.id && !item.note && optionSignature(item.options) === signature,
  );

  if (existing) {
    return draftItems.map((item) =>
      item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item,
    );
  }

  return [
    ...draftItems,
    {
      id: createClientId(),
      menuItemId: menuItem.id,
      quantity: 1,
      note: null,
      options,
    },
  ];
};

export const adjustDraftQuantity = (
  draftItems: SubmitOrderDraftItem[],
  draftItemId: string,
  delta: number,
): SubmitOrderDraftItem[] =>
  draftItems
    .map((item) =>
      item.id === draftItemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item,
    )
    .filter((item) => item.quantity > 0);

const normalizedDraft = (items: SubmitOrderDraftItem[]): string[] =>
  items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      note: item.note ?? null,
      options: item.options.map((option) => `${option.optionValueId}:${option.quantity}`).sort(),
    }))
    .map((item) => JSON.stringify(item))
    .sort((a, b) => a.localeCompare(b));

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

export const submitOrderAndPrint = async (
  ports: AppPorts,
  input: SubmitOrderFlowInput,
): Promise<SubmitOrderChangesResult> => {
  const result = await ports.order.submitOrderChanges({
    orderId: input.context.orderId,
    tableId: input.context.tableId,
    orderType: input.context.orderType,
    employeeId: input.employeeId,
    expectedVersion: input.expectedVersion,
    items: input.items,
  });

  if (result.ticket) {
    await ports.print.renderOrderTicket(result.ticket);
  }

  return result;
};

export const payOrderAndPrint = async (
  ports: AppPorts,
  input: PayOrderFlowInput,
): Promise<PayOrderResult> => {
  if (input.receivedAmount < input.order.total) {
    throw new AppError("PAYMENT_AMOUNT_TOO_LOW", "Tiền khách đưa nhỏ hơn tổng tiền.");
  }

  const result = await ports.payment.payOrder({
    paymentId: input.paymentId ?? createClientId(),
    orderId: input.order.id,
    employeeId: input.employeeId,
    method: "cash",
    expectedVersion: input.order.lockVersion,
    receivedAmount: input.receivedAmount,
  });

  if (input.printReceipt ?? true) {
    await ports.print.renderReceipt(result.receipt);
  }

  return result;
};
