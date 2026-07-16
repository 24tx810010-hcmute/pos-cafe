import { describe, expect, it, vi } from "vitest";
import type { FloorPlanChanges, MenuChanges } from "@/domain";
import { createMockPorts, createSeededMockState } from "./mockRepos";

const businessDateInTimezone = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
};

describe("mock repositories", () => {
  it("keeps inactive employees visible to admin list but hidden from passcode list", async () => {
    const ports = createMockPorts(createSeededMockState());

    await ports.employee.updateEmployee({ id: "emp-cashier-1", isActive: false });

    await expect(ports.employee.listEmployees()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "emp-cashier-1", isActive: false }),
      ]),
    );
    await expect(ports.employee.listActiveEmployees()).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "emp-cashier-1" }),
      ]),
    );
    await expect(ports.employee.verifyPin("missing", "0000")).rejects.toMatchObject({ code: "INVALID_PIN" });
    await expect(ports.employee.resetPin("missing", "0000")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("submits open order changes with expected lock version and rejects stale version", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");
    const draft = order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      note: item.note,
      options: item.options.map((option) => ({ id: option.id, optionValueId: option.optionValueId, quantity: option.quantity })),
    }));

    const result = await ports.order.submitOrderChanges({
      orderId: order.id,
      tableId: order.tableId,
      orderType: order.orderType,
      employeeId: "emp-admin",
      expectedVersion: order.lockVersion,
      items: draft,
    });

    expect(result.lockVersion).toBe(order.lockVersion + 1);

    await expect(
      ports.order.submitOrderChanges({
        orderId: order.id,
        tableId: order.tableId,
        orderType: order.orderType,
        employeeId: "emp-admin",
        expectedVersion: order.lockVersion,
        items: draft,
      }),
    ).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
  });

  it("blocks payment when received amount is lower than order total", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");

    await expect(
      ports.payment.payOrder({
        paymentId: "payment-1",
        orderId: order.id,
        employeeId: "emp-admin",
        method: "cash",
        expectedVersion: order.lockVersion,
        receivedAmount: order.total - 1,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_TOO_LOW" });
  });

  it("stores payment snapshot on paid mock orders", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");

    const result = await ports.payment.payOrder({
      paymentId: "payment-ok",
      orderId: order.id,
      employeeId: "emp-admin",
      method: "cash",
      expectedVersion: order.lockVersion,
      receivedAmount: order.total + 5000,
    });
    const paidOrder = await ports.order.getOrder(order.id);

    expect(result.changeAmount).toBe(5000);
    expect(paidOrder.payment).toMatchObject({
      id: "payment-ok",
      employeeId: "emp-admin",
      method: "cash",
      amount: order.total,
      receivedAmount: order.total + 5000,
      changeAmount: 5000,
    });
  });

  it("keeps newly paid mock orders visible in today's order history", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");
    const today = businessDateInTimezone(new Date(), "Asia/Saigon");

    await ports.payment.payOrder({
      paymentId: "payment-today",
      orderId: order.id,
      employeeId: "emp-admin",
      method: "cash",
      expectedVersion: order.lockVersion,
      receivedAmount: order.total,
    });

    const history = await ports.order.listOrderHistory({
      fromDate: today,
      toDate: today,
      page: 1,
      pageSize: 20,
    });

    expect(history.items.map((item) => item.id)).toContain(order.id);
  });

  it("excludes open orders from mock order history", async () => {
    const ports = createMockPorts(createSeededMockState());
    const today = businessDateInTimezone(new Date(), "Asia/Saigon");

    const history = await ports.order.listOrderHistory({
      fromDate: today,
      toDate: today,
      page: 1,
      pageSize: 20,
    });

    expect(history.items.map((item) => item.id)).not.toEqual(
      expect.arrayContaining(["ord-b02", "ord-b05", "ord-takeaway-1"]),
    );
    expect(history.items.every((item) => item.status !== "open")).toBe(true);
  });

  it("voids an open order when all lines are removed through submitOrderChanges", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");

    const result = await ports.order.submitOrderChanges({
      orderId: order.id,
      tableId: order.tableId,
      orderType: order.orderType,
      employeeId: "emp-admin",
      expectedVersion: order.lockVersion,
      items: [],
    });

    expect(result.status).toBe("void");
    expect(result.tableStatus).toBe("empty");
  });

  it("exposes takeaway open orders and paid order history/report states", async () => {
    const ports = createMockPorts(createSeededMockState());

    const takeawayOrders = await ports.order.listTakeawayOpenOrders();
    const history = await ports.order.listOrderHistory({
      fromDate: "2026-06-11",
      toDate: "2026-06-11",
      page: 1,
      pageSize: 20,
    });
    const report = await ports.report.getCoreReport({ businessDate: "2026-06-11" });

    expect(takeawayOrders).toEqual([
      expect.objectContaining({ id: "ord-takeaway-1", orderType: "takeaway", status: "open", tableId: null }),
    ]);
    expect(history.items.map((order) => order.id)).toContain("ord-paid-1");
    expect(report).toMatchObject({
      revenue: 77000,
      paidOrders: 1,
      averageTicket: 77000,
      topItemName: "Latte",
    });
    expect(report.hourlyRevenue.reduce((sum, bucket) => sum + bucket.revenue, 0)).toBe(77000);
  });

  it("throws menu and option unavailable errors from mock submit flow", async () => {
    const state = createSeededMockState();
    const latte = state.menu.menuItems.find((item) => item.id === "mi-latte");
    if (latte) {
      latte.isAvailable = false;
    }
    const ports = createMockPorts(state);

    await expect(
      ports.order.submitOrderChanges({
        orderId: null,
        tableId: "tbl-b01",
        orderType: "dine_in",
        employeeId: "emp-admin",
        expectedVersion: null,
        items: [{ id: "draft-1", menuItemId: "mi-latte", quantity: 1, note: null, options: [] }],
      }),
    ).rejects.toMatchObject({ code: "MENU_ITEM_UNAVAILABLE" });

    const freshPorts = createMockPorts(createSeededMockState());
    await expect(
      freshPorts.order.submitOrderChanges({
        orderId: null,
        tableId: "tbl-b01",
        orderType: "dine_in",
        employeeId: "emp-admin",
        expectedVersion: null,
        items: [
          {
            id: "draft-2",
            menuItemId: "mi-latte",
            quantity: 1,
            note: null,
            options: [{ id: "draft-option-1", optionValueId: "ov-tran-chau", quantity: 1 }],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "OPTION_VALUE_UNAVAILABLE" });
  });

  it("applies mock menu changesets so UI can refetch edited catalog state", async () => {
    const ports = createMockPorts(createSeededMockState());
    const changes: MenuChanges = {
      categories: {
        created: [{ id: "cat-new", name: "Món mới", sortOrder: 99 }],
        updated: [{ id: "cat-coffee", name: "Cà phê mới" }],
        deleted: [{ id: "cat-blended", deletedByEmployeeId: "emp-admin" }],
      },
      menuItems: {
        created: [
          {
            id: "mi-new",
            categoryId: "cat-new",
            name: "Món thử",
            price: 12345,
            imageAssetKey: null,
            sortOrder: 99,
            isAvailable: true,
          },
        ],
        updated: [{ id: "mi-latte", price: 47000 }],
        deleted: [{ id: "mi-cold-brew", deletedByEmployeeId: "emp-admin" }],
      },
      optionGroups: { created: [], updated: [], deleted: [] },
      optionValues: { created: [], updated: [], deleted: [] },
      menuItemOptionGroups: { created: [], updated: [], deleted: [] },
    };

    await ports.menu.saveMenuChanges(changes);
    const menu = await ports.menu.getMenu();

    expect(menu.categories).toEqual(expect.arrayContaining([expect.objectContaining({ id: "cat-new" })]));
    expect(menu.categories.find((category) => category.id === "cat-coffee")?.name).toBe("Cà phê mới");
    expect(menu.categories.some((category) => category.id === "cat-blended")).toBe(false);
    expect(menu.menuItems.find((item) => item.id === "mi-latte")?.price).toBe(47000);
    expect(menu.menuItems.some((item) => item.id === "mi-cold-brew")).toBe(false);
  });

  it("returns browser object URLs for uploaded mock menu item images", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:mock-menu-image"),
    });
    const ports = createMockPorts(createSeededMockState());
    const file = new File(["image"], "latte.webp", { type: "image/webp" });

    const uploaded = await ports.menuImages.uploadMenuItemImage({ itemId: "mi-latte", file });

    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(ports.menuImages.getImageUrl(uploaded.assetKey)).toBe("blob:mock-menu-image");
  });

  it("applies mock floor-plan changesets without overwriting table status", async () => {
    const ports = createMockPorts(createSeededMockState());
    const before = await ports.floorPlan.getFloorPlan();
    const originalStatus = before.tables.find((table) => table.id === "tbl-b02")?.status;
    const changes: FloorPlanChanges = {
      areas: { created: [{ id: "area-rooftop", name: "Sân thượng", sortOrder: 3 }], updated: [], deleted: [] },
      tables: {
        created: [
          {
            id: "tbl-r01",
            areaId: "area-rooftop",
            name: "R01",
            posX: 120,
            posY: 160,
            width: 120,
            height: 76,
            shape: "rectangle",
            rotation: 0,
            seats: 4,
            sortOrder: 1,
          },
        ],
        updated: [{ id: "tbl-b02", posX: 540, posY: 240 }],
        deleted: [],
      },
      decorItems: { created: [], updated: [], deleted: [] },
    };

    await ports.floorPlan.saveFloorPlan(changes);
    const floorPlan = await ports.floorPlan.getFloorPlan();
    const movedTable = floorPlan.tables.find((table) => table.id === "tbl-b02");

    expect(floorPlan.areas).toEqual(expect.arrayContaining([expect.objectContaining({ id: "area-rooftop" })]));
    expect(floorPlan.tables).toEqual(expect.arrayContaining([expect.objectContaining({ id: "tbl-r01", status: "empty" })]));
    expect(movedTable).toMatchObject({ posX: 540, posY: 240, status: originalStatus });
  });

  it("voidOrder guards against missing orders, non-paid orders and lacking permission", async () => {
    const ports = createMockPorts(createSeededMockState());

    // Không tồn tại.
    await expect(
      ports.order.voidOrder({
        orderId: "does-not-exist",
        employeeId: "emp-admin",
        expectedVersion: 0,
        reasonCode: "wrong_order",
        reasonNote: null,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Đơn đang mở (chưa thanh toán) không đi đường này.
    const open = await ports.order.getOrder("ord-b02");
    await expect(
      ports.order.voidOrder({
        orderId: "ord-b02",
        employeeId: "emp-admin",
        expectedVersion: open.lockVersion,
        reasonCode: "wrong_order",
        reasonNote: null,
      }),
    ).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });

    // Thu ngân không có quyền.
    const paid = await ports.order.getOrder("ord-paid-1");
    await expect(
      ports.order.voidOrder({
        orderId: "ord-paid-1",
        employeeId: "emp-cashier-1",
        expectedVersion: paid.lockVersion,
        reasonCode: "wrong_order",
        reasonNote: null,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});


describe("mock instant pay (payOrderItems - tách đơn độc lập)", () => {
  // ord-b02 (#24, lockVersion 3): Cà phê sữa ×2 (29k) + Bạc xỉu ×1 (32k) + Croissant ×1 (35k) = 125k.
  // Seeded nextOrderNo = 30.
  const paySplit = async (ports: ReturnType<typeof createMockPorts>) => {
    const order = await ports.order.getOrder("ord-b02");
    return ports.payment.payOrderItems({
      paymentId: "pay-split-1",
      orderId: order.id,
      newOrderId: "ord-split-1",
      employeeId: "emp-admin",
      method: "cash",
      expectedVersion: order.lockVersion,
      receivedAmount: 61000,
      items: [
        { orderItemId: "oi-b02-1", quantity: 1, splitItemId: "oi-b02-1-split" },
        { orderItemId: "oi-b02-2", quantity: 1, splitItemId: "oi-b02-2-split" },
      ],
    });
  };

  it("splits selected items into an independent paid order and keeps the source open", async () => {
    const ports = createMockPorts(createSeededMockState());
    const result = await paySplit(ports);

    // Đơn tách kế thừa số #24 của đơn gốc; đơn gốc nhận số mới (30).
    expect(result).toMatchObject({
      orderId: "ord-split-1",
      orderNo: 24,
      status: "paid",
      total: 61000,
      changeAmount: 0,
      sourceOrderId: "ord-b02",
      sourceOrderNo: 30,
      sourceTotal: 64000,
    });
    expect(result.receipt.total).toBe(61000);
    expect(result.receipt.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Cà phê sữa", quantity: 1 }),
        expect.objectContaining({ name: "Bạc xỉu", quantity: 1 }),
      ]),
    );

    // Đơn tách: paid ngay, có payment snapshot riêng — hai đơn không liên kết gì nhau.
    const splitOrder = await ports.order.getOrder("ord-split-1");
    expect(splitOrder.status).toBe("paid");
    expect(splitOrder.total).toBe(61000);
    expect(splitOrder.payment).toMatchObject({ id: "pay-split-1", amount: 61000, employeeId: "emp-admin" });
    expect(splitOrder.items).toHaveLength(2);

    // Đơn gốc: vẫn mở, chỉ còn phần chưa trả (1 Cà phê sữa + Croissant), bàn vẫn occupied.
    const source = await ports.order.getOrder("ord-b02");
    expect(source.status).toBe("open");
    expect(source.orderNo).toBe(30);
    expect(source.total).toBe(64000);
    expect(source.items).toHaveLength(2);
    expect(source.items.find((item) => item.id === "oi-b02-1")?.quantity).toBe(1);

    const floorPlan = await ports.floorPlan.getFloorPlan();
    expect(floorPlan.tables.find((table) => table.id === "tbl-b02")?.status).toBe("occupied");
  });

  it("shows the split order in history and report immediately, while the source stays out", async () => {
    const ports = createMockPorts(createSeededMockState());
    await paySplit(ports);
    const today = businessDateInTimezone(new Date(), "Asia/Saigon");

    const history = await ports.order.listOrderHistory({
      fromDate: today,
      toDate: today,
      page: 1,
      pageSize: 20,
    });
    expect(history.items.map((item) => item.id)).toContain("ord-split-1");
    expect(history.items.map((item) => item.id)).not.toContain("ord-b02");

    // Tiền đã thu vào report NGAY (đơn tách là đơn paid) — không chờ đơn gốc đóng.
    const report = await ports.report.getCoreReport({ businessDate: today });
    expect(report.revenue).toBe(61000);
    expect(report.paidOrders).toBe(1);
  });

  it("numbers bills by payment order: earlier payment gets the smaller order number", async () => {
    const ports = createMockPorts(createSeededMockState());
    const billNos: number[] = [];

    // Lần 1: tách 1 Cà phê sữa.
    let order = await ports.order.getOrder("ord-b02");
    const first = await ports.payment.payOrderItems({
      paymentId: "pay-1",
      orderId: order.id,
      newOrderId: "ord-split-a",
      employeeId: "emp-admin",
      method: "cash",
      expectedVersion: order.lockVersion,
      receivedAmount: 29000,
      items: [{ orderItemId: "oi-b02-1", quantity: 1, splitItemId: "split-a" }],
    });
    billNos.push(first.orderNo);

    // Lần 2: tách Bạc xỉu.
    order = await ports.order.getOrder("ord-b02");
    const second = await ports.payment.payOrderItems({
      paymentId: "pay-2",
      orderId: order.id,
      newOrderId: "ord-split-b",
      employeeId: "emp-admin",
      method: "cash",
      expectedVersion: order.lockVersion,
      receivedAmount: 32000,
      items: [{ orderItemId: "oi-b02-2", quantity: 1, splitItemId: "split-b" }],
    });
    billNos.push(second.orderNo);

    // Lần 3: trả nốt phần còn lại bằng payOrder (đơn gốc đóng với số hiện tại).
    order = await ports.order.getOrder("ord-b02");
    await ports.payment.payOrder({
      paymentId: "pay-3",
      orderId: order.id,
      employeeId: "emp-admin",
      method: "cash",
      expectedVersion: order.lockVersion,
      receivedAmount: order.total,
    });
    billNos.push(order.orderNo);

    // Bill trả trước luôn mang số nhỏ hơn: #24 -> #30 -> #31.
    expect(billNos).toEqual([24, 30, 31]);
    expect(billNos[0]).toBeLessThan(billNos[1]);
    expect(billNos[1]).toBeLessThan(billNos[2]);

    const floorPlan = await ports.floorPlan.getFloorPlan();
    expect(floorPlan.tables.find((table) => table.id === "tbl-b02")?.status).toBe("empty");
  });

  it("keeps the source order editable and voidable after a split", async () => {
    const ports = createMockPorts(createSeededMockState());
    await paySplit(ports);
    const source = await ports.order.getOrder("ord-b02");

    // Đơn gốc là đơn bình thường: huỷ toàn bộ phần còn lại -> void, bàn trống.
    const result = await ports.order.submitOrderChanges({
      orderId: source.id,
      tableId: source.tableId,
      orderType: source.orderType,
      employeeId: "emp-admin",
      expectedVersion: source.lockVersion,
      items: [],
    });
    expect(result.status).toBe("void");
    expect(result.tableStatus).toBe("empty");

    // Tiền đã thu nằm an toàn ở đơn tách, không bị ảnh hưởng.
    const splitOrder = await ports.order.getOrder("ord-split-1");
    expect(splitOrder.status).toBe("paid");
    expect(splitOrder.total).toBe(61000);
  });

  it("rejects over-quantity, duplicates, empty/full selections, low cash, and stale versions", async () => {
    const ports = createMockPorts(createSeededMockState());
    const order = await ports.order.getOrder("ord-b02");
    const base = {
      orderId: order.id,
      employeeId: "emp-admin",
      method: "cash" as const,
      expectedVersion: order.lockVersion,
    };
    const line = { orderItemId: "oi-b02-1", quantity: 1, splitItemId: "split-x" };

    await expect(
      ports.payment.payOrderItems({ ...base, paymentId: "p1", newOrderId: "n1", receivedAmount: 999000, items: [{ ...line, quantity: 3 }] }),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_ITEMS" });
    await expect(
      ports.payment.payOrderItems({ ...base, paymentId: "p2", newOrderId: "n2", receivedAmount: 999000, items: [] }),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_ITEMS" });
    await expect(
      ports.payment.payOrderItems({ ...base, paymentId: "p3", newOrderId: "n3", receivedAmount: 999000, items: [line, { ...line, splitItemId: "split-y" }] }),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_ITEMS" });
    await expect(
      ports.payment.payOrderItems({ ...base, paymentId: "p4", newOrderId: "n4", receivedAmount: 28000, items: [line] }),
    ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_TOO_LOW" });
    await expect(
      ports.payment.payOrderItems({ ...base, paymentId: "p5", newOrderId: "n5", expectedVersion: order.lockVersion + 9, receivedAmount: 29000, items: [line] }),
    ).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
    // Chọn đủ 100% đơn -> phải dùng payOrder, không tách.
    await expect(
      ports.payment.payOrderItems({
        ...base,
        paymentId: "p6",
        newOrderId: "n6",
        receivedAmount: 999000,
        items: [
          { orderItemId: "oi-b02-1", quantity: 2, splitItemId: "s1" },
          { orderItemId: "oi-b02-2", quantity: 1, splitItemId: "s2" },
          { orderItemId: "oi-b02-3", quantity: 1, splitItemId: "s3" },
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_ITEMS" });
  });
});
