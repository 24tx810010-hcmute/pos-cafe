import { AppError } from "@/core/appError";
import type {
  MenuCatalog,
  MenuItem,
  OrderDetail,
  OrderItemSnapshot,
  OrderType,
  PayOrderResult,
  SubmitOrderChangesResult,
  SubmitOrderDraftItem,
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

export type OrderPrimaryAction = "submit" | "payment";

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
      const optionDelta = options.reduce((sum, option) => sum + (option.value?.priceDelta ?? 0), 0);
      const unitPrice = menuItem?.price ?? 0;

      return {
        id: draft.id,
        name: menuItem?.name ?? "Món không còn hợp lệ",
        quantity: draft.quantity,
        optionText: options
          .map((option) => option.value?.name ?? "Tuỳ chọn không còn hợp lệ")
          .filter(Boolean)
          .join(", "),
        total: (unitPrice + optionDelta) * draft.quantity,
      };
    });

export const calculateCartTotal = (cartLines: CartLine[]): number =>
  cartLines.reduce((sum, line) => sum + line.total, 0);

export const addDraftMenuItem = (
  draftItems: SubmitOrderDraftItem[],
  menuItem: Pick<MenuItem, "id">,
): SubmitOrderDraftItem[] => {
  const existing = draftItems.find((item) => item.menuItemId === menuItem.id && item.options.length === 0);

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
      options: [],
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
      options: item.options.map((option) => option.optionValueId).sort(),
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
): OrderPrimaryAction => (order && !isDraftChangedFromOrder(order, draftItems) ? "payment" : "submit");

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

  await ports.print.renderReceipt(result.receipt);

  return result;
};
