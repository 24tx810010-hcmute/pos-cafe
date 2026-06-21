import type { FloorPlan, OrderDetail, OrderSummary, PrintTicket } from "@/domain";

export const stripUndefined = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

export const updateById = <T extends { id: string }>(
  items: T[],
  update: Partial<T> & { id: string },
): T[] =>
  items.map((item) => (item.id === update.id ? { ...item, ...stripUndefined(update) } : item));

export const removeByIds = <T extends { id: string }>(items: T[], deleted: Array<{ id: string }>): T[] => {
  const deletedIds = new Set(deleted.map((item) => item.id));
  return items.filter((item) => !deletedIds.has(item.id));
};

export const toSummary = (order: OrderDetail): OrderSummary => ({
  id: order.id,
  orderNo: order.orderNo,
  status: order.status,
  total: order.total,
  lockVersion: order.lockVersion,
  tableId: order.tableId,
  orderType: order.orderType,
  businessDate: order.businessDate,
});

export const makeTicket = (order: OrderDetail, floorPlan: FloorPlan): PrintTicket => {
  const table = order.tableId ? floorPlan.tables.find((candidate) => candidate.id === order.tableId) : null;

  return {
    orderNo: order.orderNo,
    tableName: table?.name ?? null,
    orderType: order.orderType,
    total: order.total,
    lines: order.items.map((item) => ({
      name: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      options: item.options.map((option) => option.optionName),
    })),
  };
};
