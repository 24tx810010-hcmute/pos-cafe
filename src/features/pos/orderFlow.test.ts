import { describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import { mockMenuCatalog } from "@/adapters/mock/mockData";
import type { Employee, OrderDetail, SubmitOrderDraftItem } from "@/domain";
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

const adminActor: Employee = { id: "6b7bd350-7db2-4160-8471-cca2668c070d", name: "Quản lý", role: "admin", isActive: true };

const pairedMockPorts = async () => {
  const state = createSeededMockState();
  state.session = { storeId: state.settings.storeId, storeNo: 1 };
  const ports = createMockPorts(state);
  await ports.employee.startSession(adminActor.id, "123456");
  return ports;
};

const getMockOrder = async (): Promise<OrderDetail> => {
  const ports = await pairedMockPorts();
  return ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
};

describe("orderFlow", () => {
  it("preserves source identity and immutable price/name snapshots in drafts", async () => {
    const order = await getMockOrder();
    const draft = orderDetailToDraft(order);

    expect(draft[0]).toMatchObject({
      menuItemId: "3e43bb8c-198f-443f-83ab-18696983edaa",
      quantity: 2,
      note: "Ít đá",
      options: [expect.objectContaining({ optionValueId: "a5f986a6-ea67-4dd3-866e-42a0be8a0497" })],
    });
    expect(draft[0].id).toBe("3c00b7a3-016f-45a3-8f96-664314c26b4a");
    expect(draft[0].options[0].id).toBe("a23319a4-5efa-4e59-8207-57e881d5d631");
    expect(draft[0]).not.toHaveProperty("itemName");
    expect(draft[0]).not.toHaveProperty("unitPrice");
  });

  it("diffs only the newly added kitchen lines when re-submitting an order", async () => {
    const order = await getMockOrder();
    const base = orderDetailToDraft(order);

    // Không thay đổi -> không có dòng món mới.
    expect(diffAddedPrintLines(mockMenuCatalog, order, base)).toEqual([]);

    // Thêm 1 Latte -> phiếu bếp chỉ có Latte x1.
    const withLatte = addDraftMenuItem(base, { id: "d50ff72b-d0bc-4832-8888-183c19f5a158" });
    expect(diffAddedPrintLines(mockMenuCatalog, order, withLatte)).toEqual([
      expect.objectContaining({ name: "Latte", quantity: 1, options: [] }),
    ]);

    // Tăng số lượng món đã có -> delta = phần tăng thêm.
    const moreCoffee = adjustDraftQuantity(base, base[0].id, 1, mockMenuCatalog);
    expect(diffAddedPrintLines(mockMenuCatalog, order, moreCoffee)).toEqual([
      expect.objectContaining({ name: "Cà phê sữa", quantity: 1 }),
    ]);

    // Đơn mới (chưa có order) -> tất cả draft đều là món mới.
    expect(diffAddedPrintLines(mockMenuCatalog, null, withLatte).length).toBeGreaterThan(0);
  });

  it("builds cart lines from menu catalog and option deltas", () => {
    const draft: SubmitOrderDraftItem[] = [
      {
        id: "10000000-0000-4000-8000-000000000001",
        menuItemId: "d50ff72b-d0bc-4832-8888-183c19f5a158",
        quantity: 2,
        note: null,
        options: [{ id: "draft-option-1", optionValueId: "a4b5f811-749a-4634-8def-b0cb4b080a05", quantity: 1 }],
      },
    ];

    const lines = buildCartLines(mockMenuCatalog, draft);

    expect(lines).toEqual([
      {
        id: "10000000-0000-4000-8000-000000000001",
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
      { id: "10000000-0000-4000-8000-000000000001", menuItemId: "d50ff72b-d0bc-4832-8888-183c19f5a158", quantity: 1, note: null, options: [] },
    ];

    const incremented = addDraftMenuItem(draft, { id: "d50ff72b-d0bc-4832-8888-183c19f5a158" });
    const removed = adjustDraftQuantity(incremented, "10000000-0000-4000-8000-000000000001", -2);

    expect(incremented).toEqual([
      { id: "10000000-0000-4000-8000-000000000001", menuItemId: "d50ff72b-d0bc-4832-8888-183c19f5a158", quantity: 2, note: null, options: [] },
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

  it("registers and executes an order without automatically printing", async () => {
    const ports = await pairedMockPorts();
    const printSpy = vi.spyOn(ports.print, "renderOrderTicket");

    const result = await submitOrderAndPrint(ports, {
      context: { orderId: null, tableId: "7b035353-73d6-44bc-8ec4-1ab9951f7a58", orderType: "dine_in" },
      actor: adminActor,
      expectedVersion: null,
      menu: mockMenuCatalog,
      items: [{ id: "10000000-0000-4000-8000-000000000001", menuItemId: "d50ff72b-d0bc-4832-8888-183c19f5a158", quantity: 1, note: null, options: [] }],
    });

    expect(result.status).toBe("open");
    expect(result.tableStatus).toBe("occupied");
    expect(printSpy).not.toHaveBeenCalled();
    expect(result.initialSuccess).toBe(true);
  });

  it("blocks insufficient cash before calling payment port", async () => {
    const ports = await pairedMockPorts();
    const order = await ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    const paymentSpy = vi.spyOn(ports.payment, "payOrder");

    await expect(
      payOrderAndPrint(ports, {
        order,
        actor: adminActor,
        receivedAmount: order.total - 1,
        paymentId: "10000000-0000-4000-8000-000000000003",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_TOO_LOW" });
    expect(paymentSpy).not.toHaveBeenCalled();
  });

  it("registers and executes payment and returns its immutable receipt", async () => {
    const ports = await pairedMockPorts();
    const order = await ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    const printSpy = vi.spyOn(ports.print, "renderReceipt");

    const result = await payOrderAndPrint(ports, {
      order,
      actor: adminActor,
      receivedAmount: order.total + 5000,
      paymentId: "10000000-0000-4000-8000-000000000004",
    });

    expect(result.status).toBe("paid");
    expect(result.changeAmount).toBe(5000);
    expect(printSpy).not.toHaveBeenCalled();
    expect(result.initialSuccess).toBe(true);
  });

  it("can complete payment without printing the receipt", async () => {
    const ports = await pairedMockPorts();
    const order = await ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    const printSpy = vi.spyOn(ports.print, "renderReceipt");

    const result = await payOrderAndPrint(ports, {
      order,
      actor: adminActor,
      receivedAmount: order.total,
      paymentId: "10000000-0000-4000-8000-000000000005",
      printReceipt: false,
    });

    expect(result.status).toBe("paid");
    expect(printSpy).not.toHaveBeenCalled();
  });
});

describe("orderFlow action permissions", () => {
  it("requires the permission for the exact new, update, and void-open branch", async () => {
    const ports = await pairedMockPorts();
    const submitSpy = vi.spyOn(ports.order, "submitOrderChanges");
    const existing = await ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    const cashierDeniedCreate: Employee = {
      id: "emp-cashier-create-denied",
      name: "Thu ngân",
      role: "cashier",
      isActive: true,
      permissionOverrides: { grants: [], denies: ["order.create"] },
    };

    await expect(
      submitOrderAndPrint(ports, {
        context: { orderId: null, tableId: "7b035353-73d6-44bc-8ec4-1ab9951f7a58", orderType: "dine_in" },
        actor: cashierDeniedCreate,
        expectedVersion: null,
        menu: mockMenuCatalog,
        items: [{ id: "10000000-0000-4000-8000-000000000002", menuItemId: "d50ff72b-d0bc-4832-8888-183c19f5a158", quantity: 1, note: null, options: [] }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const cashierDeniedUpdate: Employee = {
      ...cashierDeniedCreate,
      id: "emp-cashier-update-denied",
      permissionOverrides: { grants: [], denies: ["order.update"] },
    };
    await expect(
      submitOrderAndPrint(ports, {
        context: {
          orderId: existing.id,
          tableId: existing.tableId,
          orderType: existing.orderType,
        },
        actor: cashierDeniedUpdate,
        expectedVersion: existing.lockVersion,
        items: orderDetailToDraft(existing),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const cashierDeniedVoidOpen: Employee = {
      ...cashierDeniedCreate,
      id: "emp-cashier-void-denied",
      permissionOverrides: { grants: [], denies: ["order.voidOpen"] },
    };
    await expect(
      submitOrderAndPrint(ports, {
        context: {
          orderId: existing.id,
          tableId: existing.tableId,
          orderType: existing.orderType,
        },
        actor: cashierDeniedVoidOpen,
        expectedVersion: existing.lockVersion,
        items: [],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("allows a kitchen employee granted order.create without granting other order rights", async () => {
    const ports = await pairedMockPorts();
    const kitchenWithCreate: Employee = {
      id: "b1885ef9-c9c0-4a02-8757-875a44e8c814-create",
      name: "Bếp tạo đơn",
      role: "kitchen",
      isActive: true,
      permissionOverrides: { grants: ["order.create"], denies: [] },
    };

    await ports.employee.createEmployee({ id: kitchenWithCreate.id, name: kitchenWithCreate.name, role: "kitchen", pin: "222222" });
    await ports.employee.updateEmployee({ id: kitchenWithCreate.id, permissionOverrides: kitchenWithCreate.permissionOverrides });
    await ports.employee.startSession(kitchenWithCreate.id, "222222");
    await expect(
      submitOrderAndPrint(ports, {
        context: { orderId: null, tableId: "7b035353-73d6-44bc-8ec4-1ab9951f7a58", orderType: "dine_in" },
        actor: kitchenWithCreate,
        expectedVersion: null,
        menu: mockMenuCatalog,
        items: [{ id: "10000000-0000-4000-8000-000000000002", menuItemId: "d50ff72b-d0bc-4832-8888-183c19f5a158", quantity: 1, note: null, options: [] }],
      }),
    ).resolves.toMatchObject({ status: "open" });
  });

  it("blocks both full and split payments before either payment port is called", async () => {
    const ports = await pairedMockPorts();
    const order = await ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    const paySpy = vi.spyOn(ports.payment, "payOrder");
    const payItemsSpy = vi.spyOn(ports.payment, "payOrderItems");
    const cashierDeniedPayment: Employee = {
      id: "emp-cashier-payment-denied",
      name: "Thu ngân",
      role: "cashier",
      isActive: true,
      permissionOverrides: { grants: [], denies: ["payment.take"] },
    };

    await expect(
      payOrderAndPrint(ports, {
        order,
        actor: cashierDeniedPayment,
        receivedAmount: order.total,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      payOrderItemsAndPrint(ports, {
        order,
        actor: cashierDeniedPayment,
        receivedAmount: 29000,
        selection: { "3c00b7a3-016f-45a3-8f96-664314c26b4a": 1 },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(paySpy).not.toHaveBeenCalled();
    expect(payItemsSpy).not.toHaveBeenCalled();
  });
});

describe("instant pay selection", () => {
  // 7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c: Cà phê sữa ×2 (29k, đã gồm option) + Bạc xỉu ×1 (32k) + Croissant ×1 (35k) = 125k.
  it("builds payable lines with per-unit totals", async () => {
    const order = await getMockOrder();
    const lines = buildPayableLines(order);

    expect(lines).toEqual([
      expect.objectContaining({ orderItemId: "3c00b7a3-016f-45a3-8f96-664314c26b4a", name: "Cà phê sữa", quantity: 2, unitTotal: 29000 }),
      expect.objectContaining({ orderItemId: "64a0c267-a3e2-47ca-878b-c5b47c7452e5", unitTotal: 32000 }),
      expect.objectContaining({ orderItemId: "923bfabf-cffd-4d90-84a8-50bd47b0fd09", unitTotal: 35000 }),
    ]);
  });

  it("computes selection totals, full-selection detection, and clamping", async () => {
    const order = await getMockOrder();
    const lines = buildPayableLines(order);

    const all = fullSelection(lines);
    expect(selectionAmount(lines, all)).toBe(125000);
    expect(isFullSelection(lines, all)).toBe(true);

    const partial = { "3c00b7a3-016f-45a3-8f96-664314c26b4a": 1, "64a0c267-a3e2-47ca-878b-c5b47c7452e5": 1 };
    expect(selectionAmount(lines, partial)).toBe(61000);
    expect(isFullSelection(lines, partial)).toBe(false);

    // Clamp: vượt số lượng -> hạ về còn lại; dòng lạ -> loại bỏ; qty 0 -> loại bỏ.
    expect(clampSelection(lines, { "3c00b7a3-016f-45a3-8f96-664314c26b4a": 9, "oi-missing": 1, "923bfabf-cffd-4d90-84a8-50bd47b0fd09": 0 })).toEqual({
      "3c00b7a3-016f-45a3-8f96-664314c26b4a": 2,
    });
  });

  it("routes a partial selection through payOrderItems: split order paid, source stays open", async () => {
    const ports = await pairedMockPorts();
    const order = await ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    const payOrderSpy = vi.spyOn(ports.payment, "payOrder");
    const printSpy = vi.spyOn(ports.print, "renderReceipt");

    const result = await payOrderItemsAndPrint(ports, {
      order,
      actor: adminActor,
      receivedAmount: 61000,
      selection: { "3c00b7a3-016f-45a3-8f96-664314c26b4a": 1, "64a0c267-a3e2-47ca-878b-c5b47c7452e5": 1 },
      paymentId: "10000000-0000-4000-8000-000000000006",
    });

    expect(payOrderSpy).not.toHaveBeenCalled();
    // Đơn tách kế thừa số #24 và paid ngay; đơn gốc còn 64k, vẫn mở.
    expect(result).toMatchObject({
      mode: "split",
      status: "paid",
      orderNo: 24,
      total: 61000,
      sourceOrderId: "7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c",
      sourceTotal: 64000,
    });
    expect(printSpy).not.toHaveBeenCalled();
    expect(result.initialSuccess).toBe(true);

    const source = await ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    expect(source.status).toBe("open");
  });

  it("routes a full selection through payOrder so the table is freed in one call", async () => {
    const ports = await pairedMockPorts();
    const order = await ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    const payItemsSpy = vi.spyOn(ports.payment, "payOrderItems");

    const result = await payOrderItemsAndPrint(ports, {
      order,
      actor: adminActor,
      receivedAmount: 125000,
      selection: fullSelection(buildPayableLines(order)),
      paymentId: "10000000-0000-4000-8000-000000000007",
    });

    expect(payItemsSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ mode: "full", status: "paid", total: 125000 });
  });

  it("rejects empty selections and low cash before calling the payment port", async () => {
    const ports = await pairedMockPorts();
    const order = await ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    const payItemsSpy = vi.spyOn(ports.payment, "payOrderItems");

    await expect(
      payOrderItemsAndPrint(ports, { order, actor: adminActor, receivedAmount: 99000, selection: {} }),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_ITEMS" });
    await expect(
      payOrderItemsAndPrint(ports, {
        order,
        actor: adminActor,
        receivedAmount: 28000,
        selection: { "3c00b7a3-016f-45a3-8f96-664314c26b4a": 1 },
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_TOO_LOW" });
    expect(payItemsSpy).not.toHaveBeenCalled();
  });

  it("keeps the source order draft-able like a normal order after a split", async () => {
    const ports = await pairedMockPorts();
    const before = await ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    await payOrderItemsAndPrint(ports, {
      order: before,
      actor: adminActor,
      receivedAmount: 61000,
      selection: { "3c00b7a3-016f-45a3-8f96-664314c26b4a": 1, "64a0c267-a3e2-47ca-878b-c5b47c7452e5": 1 },
      printReceipt: false,
    });

    const order = await ports.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    const draft = orderDetailToDraft(order);

    // Đơn gốc là đơn thường: draft = phần còn lại (1 Cà phê sữa + 1 Croissant).
    expect(draft).toHaveLength(2);
    expect(isDraftChangedFromOrder(order, draft)).toBe(false);
    expect(getOrderPrimaryAction(order, draft)).toBe("payment");

    // Thêm 1 Cà phê sữa nữa: phiếu bếp chỉ in phần chênh so với đơn gốc hiện tại.
    const coffeeLine = draft.find((item) => item.menuItemId === "3e43bb8c-198f-443f-83ab-18696983edaa");
    const moreCoffee = adjustDraftQuantity(draft, coffeeLine!.id, 1, mockMenuCatalog);
    expect(diffAddedPrintLines(mockMenuCatalog, order, moreCoffee)).toEqual([
      expect.objectContaining({ name: "Cà phê sữa", quantity: 1 }),
    ]);
  });
});
