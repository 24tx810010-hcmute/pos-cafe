import { describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import { mockMenuCatalog } from "@/adapters/mock/mockData";
import type { OrderDetail, SubmitOrderDraftItem } from "@/domain";
import {
  addDraftMenuItem,
  adjustDraftQuantity,
  buildCartLines,
  calculateCartTotal,
  getOrderPrimaryAction,
  isDraftChangedFromOrder,
  orderDetailToDraft,
  payOrderAndPrint,
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

  it("builds cart lines from menu catalog and option deltas", () => {
    const draft: SubmitOrderDraftItem[] = [
      {
        id: "draft-1",
        menuItemId: "mi-latte",
        quantity: 2,
        note: null,
        options: [{ id: "draft-option-1", optionValueId: "ov-them-shot" }],
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
