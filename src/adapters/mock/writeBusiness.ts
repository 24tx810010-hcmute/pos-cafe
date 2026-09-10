import type { BusinessResult, Employee, ItemSnapshot, NewLine, OrderDetail, OrderItemSnapshot, OrderSnapshot, PaymentSnapshot, PriceChangedDetails, ReceiptSnapshot, WritePayloadV1 } from "@/domain";
import { checkedMoney, MAX_MONEY } from "@/core/writePayload";
import { writeError } from "@/core/writeErrors";
import { clone, getTodayBusinessDate, type MockState } from "./mockState";
import type { MockWriteState } from "./writeState";

const unit = (i: OrderItemSnapshot): number => checkedMoney(i.unitPrice + i.options.reduce((n, o) => n + checkedMoney(o.priceDelta * o.quantity), 0));
const total = (items: OrderItemSnapshot[]): number => checkedMoney(items.reduce((n, i) => n + checkedMoney(unit(i) * i.quantity), 0));
const itemView = (i: OrderItemSnapshot): ItemSnapshot => ({ id: i.id, menuItemId: i.menuItemId, name: i.itemName, quantity: i.quantity, baseUnitPrice: i.unitPrice, note: i.note ?? null, options: i.options.map(o => ({ id: o.id, optionValueId: o.optionValueId, name: o.optionName, priceDelta: o.priceDelta, quantity: o.quantity })), unitTotal: unit(i), lineTotal: checkedMoney(unit(i) * i.quantity), status: "active" });
export const mockOrderSnapshot = (state: MockState, order: OrderDetail): OrderSnapshot => ({
  id: order.id, storeId: state.session!.storeId, orderNo: order.orderNo, businessDate: order.businessDate,
  orderType: order.orderType, tableId: order.tableId, status: order.status, lockVersion: order.lockVersion,
  subtotal: order.total, total: order.total, createdAt: order.createdAt ?? `${order.businessDate}T00:00:00.000Z`, updatedAt: order.updatedAt ?? `${order.businessDate}T00:00:00.000Z`,
  paidAt: order.paidAt, createdByEmployeeId: order.createdByEmployeeId ?? null, lastModifiedByEmployeeId: order.lastModifiedByEmployeeId ?? null,
  items: order.items.map(itemView), voidedAt: order.voidedAt, voidedByEmployeeId: order.voidedByEmployeeId,
  voidReasonCode: order.voidReasonCode, voidReasonNote: order.voidReasonNote,
});

const newSnapshots = (state: MockState, lines: NewLine[]): { items: OrderItemSnapshot[]; changed: PriceChangedDetails | null; quotedTotal: number } => {
  const changed: PriceChangedDetails = { lines: [], proposedNewLinesTotal: 0 };
  let quotedTotal = 0;
  const items = lines.map(line => {
    const menu = state.menu.menuItems.find(i => i.id === line.menuItemId && i.isAvailable);
    if (!menu) throw writeError("MENU_ITEM_UNAVAILABLE");
    const groups = state.menu.menuItemOptionGroups.filter(l => l.menuItemId === menu.id).map(l => state.menu.optionGroups.find(g => g.id === l.optionGroupId)).filter(g => g !== undefined);
    const selected = new Set<string>();
    const options = line.options.map(option => {
      const value = state.menu.optionValues.find(v => v.id === option.optionValueId);
      if (!value || !groups.some(g => g.id === value.optionGroupId)) throw writeError("OPTION_VALUE_UNAVAILABLE");
      if (selected.has(value.id)) throw writeError("INVALID_ORDER_ITEMS");
      selected.add(value.id);
      checkedMoney(value.priceDelta);
      return { id: option.id, optionValueId: value.id, optionName: value.name, quantity: option.quantity, priceDelta: value.priceDelta };
    });
    for (const group of groups) {
      const count = options.filter(o => state.menu.optionValues.find(v => v.id === o.optionValueId)!.optionGroupId === group.id).length;
      if (group.isRequired && count === 0 || group.selectType === "single" && count > 1) throw writeError("OPTION_VALUE_UNAVAILABLE");
    }
    checkedMoney(menu.price);
    const item: OrderItemSnapshot = { id: line.id, menuItemId: menu.id, itemName: menu.name, quantity: line.quantity, unitPrice: menu.price, note: line.note ?? null, options };
    // Validate both the original quoted amounts and current proposal, before PRICE_CHANGED.
    quotedTotal = checkedMoney(quotedTotal + checkedMoney(line.quantity * checkedMoney(line.quotedBasePrice + line.options.reduce((n, o) => n + checkedMoney(o.quotedPriceDelta * o.quantity), 0))));
    const differences = options.map((o, i) => ({ optionValueId: o.optionValueId, quoted: line.options[i].quotedPriceDelta, current: o.priceDelta }));
    if (menu.price !== line.quotedBasePrice || differences.some(o => o.quoted !== o.current)) changed.lines.push({ lineId: line.id, base: { quoted: line.quotedBasePrice, current: menu.price }, options: differences });
    return item;
  });
  changed.proposedNewLinesTotal = total(items);
  return { items, changed: changed.lines.length ? changed : null, quotedTotal };
};

const requireFreshIds = (state: MockState, writes: MockWriteState, p: WritePayloadV1): void => {
  const allItems = [...state.orders.flatMap(o => o.items), ...writes.removedItems.map(r => r.item)];
  const ids = new Set(allItems.map(i => i.id));
  const optionIds = new Set(allItems.flatMap(i => i.options.map(o => o.id)));
  const reserve = (id: string, set: Set<string>): void => { if (set.has(id)) throw writeError("ENTITY_ID_CONFLICT"); set.add(id); };
  if (p.kind === "submit_order_changes" && p.action !== "void_open") for (const line of p.newLines) {
    reserve(line.id, ids);
    for (const option of line.options) reserve(option.id, optionIds);
  }
  if (p.kind === "pay_order" || p.kind === "pay_order_items") {
    if (state.orders.some(o => o.payment?.id === p.paymentId)) throw writeError("ENTITY_ID_CONFLICT");
    if (p.kind === "pay_order_items") {
      if (state.orders.some(o => o.id === p.newOrderId)) throw writeError("ENTITY_ID_CONFLICT");
      for (const line of p.lines) reserve(line.splitItemId, ids);
    }
  }
};

const nextNo = (state: MockState, date: string): number => Math.max(0, ...state.orders.filter(o => o.businessDate === date).map(o => o.orderNo)) + 1;
const tableStatus = (state: MockState, tableId: string | null): void => {
  const table = state.floorPlan.tables.find(t => t.id === tableId);
  if (table) table.status = state.orders.some(o => o.tableId === tableId && o.status === "open") ? "occupied" : "empty";
};
const blankOrder = (id: string, now: string, employeeId: string): OrderDetail => ({
  id, tableId: null, orderType: "takeaway", orderNo: 0, businessDate: "", status: "open", lockVersion: 0, total: 0, items: [],
  createdAt: now, updatedAt: now, createdByEmployeeId: employeeId, lastModifiedByEmployeeId: employeeId,
  paidAt: null, payment: null, voidedAt: null, voidedByEmployeeId: null, voidReasonCode: null, voidReasonNote: null,
});
const pay = (state: MockState, order: OrderDetail, paymentId: string, received: number, actor: Employee, now: string): { payment: PaymentSnapshot; receipt: ReceiptSnapshot } => {
  if (order.total <= 0) throw writeError("INVALID_ORDER_ITEMS");
  if (received < order.total) throw writeError("PAYMENT_AMOUNT_TOO_LOW");
  order.status = "paid"; order.paidAt = now; order.updatedAt = now;
  order.payment = { id: paymentId, employeeId: actor.id, method: "cash", amount: order.total, receivedAmount: received, changeAmount: received - order.total, paidAt: now };
  const payment: PaymentSnapshot = { id: paymentId, orderId: order.id, employeeId: actor.id, method: "cash", amount: order.total, receivedAmount: received, changeAmount: received - order.total, createdAt: now };
  const receipt: ReceiptSnapshot = {
    schemaVersion: 1, orderId: order.id, paymentId, orderNo: order.orderNo, businessDate: order.businessDate,
    storeName: state.settings.displayName, address: state.settings.address, footer: state.settings.billFooter,
    tableName: state.floorPlan.tables.find(t => t.id === order.tableId)?.name ?? null, paidAt: now, employeeName: actor.name,
    lines: order.items.map(item => { const i = itemView(item); return { orderItemId: i.id, menuItemId: i.menuItemId, name: i.name, quantity: i.quantity, baseUnitPrice: i.baseUnitPrice, options: i.options.map(({ id: _id, ...o }) => o), unitTotal: i.unitTotal, lineTotal: i.lineTotal, note: i.note }; }),
    total: order.total, receivedAmount: received, changeAmount: received - order.total,
  };
  order.receiptSnapshot = clone(receipt);
  tableStatus(state, order.tableId);
  return { payment, receipt };
};

// Executes only against a cloned transaction workspace. The coordinator commits it
// after validation, expiry/session checkpoint, and both fault seams succeed.
export const applyMockWrite = (state: MockState, writes: MockWriteState, p: WritePayloadV1, actor: Employee, now: string): BusinessResult => {
  const create = p.kind === "submit_order_changes" && p.action === "create";
  let order = state.orders.find(o => o.id === p.orderId);
  if (create && order) throw writeError("ENTITY_ID_CONFLICT");
  if (!create) {
    if (!order) throw writeError("NOT_FOUND");
    if (order.lockVersion !== p.expectedVersion || order.status !== (p.kind === "void_order" ? "paid" : "open")) throw writeError("ORDER_VERSION_CONFLICT");
    if (order.lockVersion >= MAX_MONEY) throw writeError("INVALID_WRITE_REQUEST");
  }
  requireFreshIds(state, writes, p);
  if (p.kind === "submit_order_changes") {
    if (p.action === "create") {
      if (p.tableId) {
        if (!state.floorPlan.tables.some(t => t.id === p.tableId)) throw writeError("TABLE_NOT_FOUND");
        if (state.orders.some(o => o.status === "open" && o.tableId === p.tableId)) throw writeError("TABLE_OCCUPIED");
      }
      const proposed = newSnapshots(state, p.newLines);
      if (proposed.changed) throw writeError("PRICE_CHANGED", proposed.changed);
      order = blankOrder(p.orderId, now, actor.id);
      order.orderType = p.orderType; order.tableId = p.tableId;
      order.businessDate = getTodayBusinessDate(new Date(now), state.settings.timezone);
      order.orderNo = nextNo(state, order.businessDate);
      order.items = proposed.items; order.total = total(order.items);
      state.orders.push(order);
    } else if (p.action === "update") {
      const sources = new Map(order!.items.map(i => [i.id, i]));
      const seen = new Set<string>();
      const retained = p.retainedLines.map(l => {
        const source = sources.get(l.sourceItemId);
        if (!source || seen.has(l.sourceItemId) || l.quantity > source.quantity) throw writeError("INVALID_ORDER_ITEMS");
        seen.add(source.id);
        return { ...clone(source), quantity: l.quantity, note: l.note ?? null };
      });
      if (seen.size !== sources.size) throw writeError("INVALID_ORDER_ITEMS");
      const kept = retained.filter(i => i.quantity > 0);
      if (kept.length + p.newLines.length < 1 || kept.length + p.newLines.length > 200) throw writeError("INVALID_ORDER_ITEMS");
      const proposed = newSnapshots(state, p.newLines);
      total([...kept, ...proposed.items]);
      checkedMoney(total(kept) + proposed.quotedTotal);
      if (proposed.changed) throw writeError("PRICE_CHANGED", proposed.changed);
      for (const i of retained.filter(i => i.quantity === 0)) writes.removedItems.push({ orderId: order!.id, item: clone(sources.get(i.id)!) });
      order!.items = [...kept, ...proposed.items]; order!.total = total(order!.items);
      order!.lastModifiedByEmployeeId = actor.id; order!.lockVersion++;
    } else {
      for (const i of order!.items) writes.removedItems.push({ orderId: order!.id, item: clone(i) });
      order!.items = []; order!.total = 0; order!.status = "void"; order!.lastModifiedByEmployeeId = actor.id; order!.lockVersion++;
    }
    order!.updatedAt = now;
    tableStatus(state, order!.tableId);
    return { kind: p.kind, action: p.action, order: mockOrderSnapshot(state, order!) };
  }
  if (p.kind === "void_order") {
    if (p.reason === "other" && !p.reasonNote?.trim()) throw writeError("VOID_REASON_REQUIRED");
    order!.status = "void"; order!.voidedAt = now; order!.voidedByEmployeeId = actor.id; order!.voidReasonCode = p.reason;
    order!.voidReasonNote = p.reasonNote?.trim() || null; order!.updatedAt = now; order!.lockVersion++;
    return { kind: p.kind, order: mockOrderSnapshot(state, order!) };
  }
  if (p.kind === "pay_order") {
    order!.total = total(order!.items); order!.lockVersion++;
    return { kind: p.kind, ...pay(state, order!, p.paymentId, p.receivedAmount, actor, now), order: mockOrderSnapshot(state, order!) };
  }
  const source = order!;
  const selection = new Map<string, number>();
  for (const line of p.lines) {
    const item = source.items.find(i => i.id === line.orderItemId);
    if (!item || selection.has(item.id) || line.quantity > item.quantity) throw writeError("INVALID_ORDER_ITEMS");
    selection.set(item.id, line.quantity);
  }
  if (source.items.every(i => selection.get(i.id) === i.quantity)) throw writeError("INVALID_ORDER_ITEMS");
  const child = blankOrder(p.newOrderId, now, actor.id);
  child.tableId = source.tableId; child.orderType = source.orderType; child.businessDate = source.businessDate; child.orderNo = source.orderNo;
  source.orderNo = nextNo(state, source.businessDate);
  for (const line of p.lines) {
    const item = source.items.find(i => i.id === line.orderItemId)!;
    if (item.quantity === line.quantity) { child.items.push(item); source.items = source.items.filter(i => i.id !== item.id); }
    else { item.quantity -= line.quantity; child.items.push({ ...clone(item), id: line.splitItemId, quantity: line.quantity, options: item.options.map(o => ({ ...o, id: crypto.randomUUID() })) }); }
  }
  child.total = total(child.items); source.total = total(source.items); source.lockVersion++; source.updatedAt = now;
  state.orders.push(child);
  return { kind: p.kind, ...pay(state, child, p.paymentId, p.receivedAmount, actor, now), sourceOrder: mockOrderSnapshot(state, source), paidOrder: mockOrderSnapshot(state, child) };
};
