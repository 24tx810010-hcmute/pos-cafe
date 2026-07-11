import { describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import { mockMenuCatalog } from "@/adapters/mock/mockData";
import type { OrderDetail, SubmitOrderDraftItem } from "@/domain";
import {
  addDraftMenuItem,
  adjustDraftQuantity,
  buildCartLines,
  buildPayableLines,
  calculateCartTotal,
  clampSelection,
  diffAddedPrintLines,
  fullSelection,
  getOrderPrimaryAction,
  isDraftChangedFromOrder,
  isFullSelection,
  orderDetailToDraft,
  payOrderAndPrint,
  payOrderItemsAndPrint,
  selectionAmount,
  submitOrderAndPrint,
} from "./orderFlow";

const getMockOrder = async (): Promise<OrderDetail> => {
  const ports = createMockPorts(createSeededMockState());
  return ports.order.getOrder("ord-b02");
};

describe("orderFlow", () => {
  it("converts order snapshots to draft items without display-only price/name fields", async () => {
    const order = await getMockOrder();
    const draft = orderDetailToDraft(order);

    expect(draft[0]).toMatchObject({
      menuItemId: "mi-ca-phe-sua",
      quantity: 2,
      note: "Ít đá",
      options: [expect.objectContaining({ optionValueId: "ov-size-m" })],
    });
    expect(draft[0].id).not.toBe("oi-b02-1");
    expect(draft[0].options[0].id).not.toBe("oio-b02-1");
    expect(draft[0]).not.toHaveProperty("itemName");
    expect(draft[0]).not.toHaveProperty("unitPrice");
  });

  it("diffs only the newly added kitchen lines when re-submitting an order", async () => {
    const order = await getMockOrder();
    const base = orderDetailToDraft(order);

    // Không thay đổi -> không có dòng món mới.
    expect(diffAddedPrintLines(mockMenuCatalog, order, base)).toEqual([]);

    // Thêm 1 Latte -> phiếu bếp chỉ có Latte x1.
    const withLatte = addDraftMenuItem(base, { id: "mi-latte" });
    expect(diffAddedPrintLines(mockMenuCatalog, order, withLatte)).toEqual([
      expect.objectContaining({ name: "Latte", quantity: 1, options: [] }),
    ]);

    // Tăng số lượng món đã có -> delta = phần tăng thêm.
    const moreCoffee = adjustDraftQuantity(base, base[0].id, 1);
    expect(diffAddedPrintLines(mockMenuCatalog, order, moreCoffee)).toEqual([
      expect.objectContaining({ name: "Cà phê sữa", quantity: 1 }),
    ]);

    // Đơn mới (chưa có order) -> tất cả draft đều là món mới.
    expect(diffAddedPrintLines(mockMenuCatalog, null, withLatte).length).toBeGreaterThan(0);
  });

  it("builds cart lines from menu catalog and option deltas", () => {
    const draft: SubmitOrderDraftItem[] = [
      {
        id: "draft-1",
        menuItemId: "mi-latte",
        quantity: 2,
        note: null,
        options: [{ id: "draft-option-1", optionValueId: "ov-them-shot", quantity: 1 }],
      },
    ];

    const lines = buildCartLines(mockMenuCatalog, draft);

    expect(lines).toEqual([
      {
        id: "draft-1",
        name: "Latte",
        quantity: 2,
        optionText: "Thêm shot",
        total: 110000,
      },
    ]);
    expect(calculateCartTotal(lines)).toBe(110000);
  });

  it("increments simple menu lines and removes zero quantity lines", () => {
    const draft: SubmitOrderDraftItem[] = [
      { id: "draft-1", menuItemId: "mi-latte", quantity: 1, note: null, options: [] },
    ];

    const incremented = addDraftMenuItem(draft, { id: "mi-latte" });
    const removed = adjustDraftQuantity(incremented, "draft-1", -2);

    expect(incremented).toEqual([
      { id: "draft-1", menuItemId: "mi-latte", quantity: 2, note: null, options: [] },
    ]);
    expect(removed).toEqual([]);
  });

  it("detects unchanged existing orders independent of item order", async () => {
    const order = await getMockOrder();
    const draft = orderDetailToDraft(order).reverse();

    expect(isDraftChangedFromOrder(order, draft)).toBe(false);
    expect(getOrderPrimaryAction(order, draft)).toBe("payment");

    const changed = draft.map((item, index) =>
      index === 0 ? { ...item, quantity: item.quantity + 1 } : item,
    );
    expect(isDraftChangedFromOrder(order, changed)).toBe(true);
    expect(getOrderPrimaryAction(order, changed)).toBe("submit");
  });

  it("marks paid or void orders as closed for primary actions", async () => {
    const order = await getMockOrder();
    const paidOrder: OrderDetail = { ...order, status: "paid" };
    const draft = orderDetailToDraft(paidOrder);

    expect(getOrderPrimaryAction(paidOrder, draft)).toBe("closed");
  });

  it("submits order changes through the order port and prints the returned ticket", async () => {
    const ports = createMockPorts(createSeededMockState());
    const printSpy = vi.spyOn(ports.print, "renderOrderTicket");

    const result = await submitOrderAndPrint(ports, {
      context: { orderId: null, tableId: "tbl-b01", orderType: "dine_in" },
      employeeId: "emp-admin",
      expectedVersion: null,
      items: [{ id: "draft-1", menuItemId: "mi-latte", quantity: 1, note: null, options: [] }],
    });

    expect(result.status).toBe("open");
    expect(result.tableStatus).toBe("occupied");
    expect(printSpy).toHaveBeenCalledWith(result.ticket);
  });

  it("blocks insufficient cash before calling payment port", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");
    const paymentSpy = vi.spyOn(ports.payment, "payOrder");

    await expect(
      payOrderAndPrint(ports, {
        order,
        employeeId: "emp-admin",
        receivedAmount: order.total - 1,
        paymentId: "pay-low",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_TOO_LOW" });
    expect(paymentSpy).not.toHaveBeenCalled();
  });

  it("pays through the payment port and prints the returned receipt", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");
    const printSpy = vi.spyOn(ports.print, "renderReceipt");

    const result = await payOrderAndPrint(ports, {
      order,
      employeeId: "emp-admin",
      receivedAmount: order.total + 5000,
      paymentId: "pay-ok",
    });

    expect(result.status).toBe("paid");
    expect(result.changeAmount).toBe(5000);
    expect(printSpy).toHaveBeenCalledWith(result.receipt);
  });

  it("can complete payment without printing the receipt", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");
    const printSpy = vi.spyOn(ports.print, "renderReceipt");

    const result = await payOrderAndPrint(ports, {
      order,
      employeeId: "emp-admin",
      receivedAmount: order.total,
      paymentId: "pay-no-print",
      printReceipt: false,
    });

    expect(result.status).toBe("paid");
    expect(printSpy).not.toHaveBeenCalled();
  });
});

describe("instant pay selection", () => {
  // ord-b02: Cà phê sữa ×2 (29k, đã gồm option) + Bạc xỉu ×1 (32k) + Croissant ×1 (35k) = 125k.
  it("builds payable lines with per-unit totals", async () => {
    const order = await getMockOrder();
    const lines = buildPayableLines(order);

    expect(lines).toEqual([
      expect.objectContaining({ orderItemId: "oi-b02-1", name: "Cà phê sữa", quantity: 2, unitTotal: 29000 }),
      expect.objectContaining({ orderItemId: "oi-b02-2", unitTotal: 32000 }),
      expect.objectContaining({ orderItemId: "oi-b02-3", unitTotal: 35000 }),
    ]);
  });

  it("computes selection totals, full-selection detection, and clamping", async () => {
    const order = await getMockOrder();
    const lines = buildPayableLines(order);

    const all = fullSelection(lines);
    expect(selectionAmount(lines, all)).toBe(125000);
    expect(isFullSelection(lines, all)).toBe(true);

    const partial = { "oi-b02-1": 1, "oi-b02-2": 1 };
    expect(selectionAmount(lines, partial)).toBe(61000);
    expect(isFullSelection(lines, partial)).toBe(false);

    // Clamp: vượt số lượng -> hạ về còn lại; dòng lạ -> loại bỏ; qty 0 -> loại bỏ.
    expect(clampSelection(lines, { "oi-b02-1": 9, "oi-missing": 1, "oi-b02-3": 0 })).toEqual({
      "oi-b02-1": 2,
    });
  });

  it("routes a partial selection through payOrderItems: split order paid, source stays open", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");
    const payOrderSpy = vi.spyOn(ports.payment, "payOrder");
    const printSpy = vi.spyOn(ports.print, "renderReceipt");

    const result = await payOrderItemsAndPrint(ports, {
      order,
      employeeId: "emp-admin",
      receivedAmount: 61000,
      selection: { "oi-b02-1": 1, "oi-b02-2": 1 },
      paymentId: "pay-part",
    });

    expect(payOrderSpy).not.toHaveBeenCalled();
    // Đơn tách kế thừa số #24 và paid ngay; đơn gốc còn 64k, vẫn mở.
    expect(result).toMatchObject({
      mode: "split",
      status: "paid",
      orderNo: 24,
      total: 61000,
      sourceOrderId: "ord-b02",
      sourceTotal: 64000,
    });
    expect(printSpy).toHaveBeenCalledWith(result.receipt);

    const source = await ports.order.getOrder("ord-b02");
    expect(source.status).toBe("open");
  });

  it("routes a full selection through payOrder so the table is freed in one call", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");
    const payItemsSpy = vi.spyOn(ports.payment, "payOrderItems");

    const result = await payOrderItemsAndPrint(ports, {
      order,
      employeeId: "emp-admin",
      receivedAmount: 125000,
      selection: fullSelection(buildPayableLines(order)),
      paymentId: "pay-full",
    });

    expect(payItemsSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ mode: "full", status: "paid", total: 125000 });
  });

  it("rejects empty selections and low cash before calling the payment port", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");
    const payItemsSpy = vi.spyOn(ports.payment, "payOrderItems");

    await expect(
      payOrderItemsAndPrint(ports, { order, employeeId: "emp-admin", receivedAmount: 99000, selection: {} }),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_ITEMS" });
    await expect(
      payOrderItemsAndPrint(ports, {
        order,
        employeeId: "emp-admin",
        receivedAmount: 28000,
        selection: { "oi-b02-1": 1 },
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_TOO_LOW" });
    expect(payItemsSpy).not.toHaveBeenCalled();
  });

  it("keeps the source order draft-able like a normal order after a split", async () => {
    const ports = createMockPorts(createSeededMockState());
    const before = await ports.order.getOrder("ord-b02");
    await payOrderItemsAndPrint(ports, {
      order: before,
      employeeId: "emp-admin",
      receivedAmount: 61000,
      selection: { "oi-b02-1": 1, "oi-b02-2": 1 },
      printReceipt: false,
    });

    const order = await ports.order.getOrder("ord-b02");
    const draft = orderDetailToDraft(order);

    // Đơn gốc là đơn thường: draft = phần còn lại (1 Cà phê sữa + 1 Croissant).
    expect(draft).toHaveLength(2);
    expect(isDraftChangedFromOrder(order, draft)).toBe(false);
    expect(getOrderPrimaryAction(order, draft)).toBe("payment");

    // Thêm 1 Cà phê sữa nữa: phiếu bếp chỉ in phần chênh so với đơn gốc hiện tại.
    const coffeeLine = draft.find((item) => item.menuItemId === "mi-ca-phe-sua");
    const moreCoffee = adjustDraftQuantity(draft, coffeeLine!.id, 1);
    expect(diffAddedPrintLines(mockMenuCatalog, order, moreCoffee)).toEqual([
      expect.objectContaining({ name: "Cà phê sữa", quantity: 1 }),
    ]);
  });
});
