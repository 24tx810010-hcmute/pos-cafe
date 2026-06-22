import { describe, expect, it } from "vitest";
import type { FloorPlanChanges, MenuChanges } from "@/domain";
import { createMockPorts, createMockState } from "./mockRepos";

describe("mock repositories", () => {
  it("keeps inactive employees visible to admin list but hidden from passcode list", async () => {
    const ports = createMockPorts();

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
    const ports = createMockPorts();
    const order = await ports.order.getOrder("ord-b02");
    const draft = order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      note: item.note,
      options: item.options.map((option) => ({ id: option.id, optionValueId: option.optionValueId })),
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
    const ports = createMockPorts();
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

  it("voids an open order when all lines are removed through submitOrderChanges", async () => {
    const ports = createMockPorts();
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
    const ports = createMockPorts();

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
    const state = createMockState();
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

    const freshPorts = createMockPorts();
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
            options: [{ id: "draft-option-1", optionValueId: "ov-size-l" }],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "OPTION_VALUE_UNAVAILABLE" });
  });

  it("applies mock menu changesets so UI can refetch edited catalog state", async () => {
    const ports = createMockPorts();
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
    };

    await ports.menu.saveMenuChanges(changes);
    const menu = await ports.menu.getMenu();

    expect(menu.categories).toEqual(expect.arrayContaining([expect.objectContaining({ id: "cat-new" })]));
    expect(menu.categories.find((category) => category.id === "cat-coffee")?.name).toBe("Cà phê mới");
    expect(menu.categories.some((category) => category.id === "cat-blended")).toBe(false);
    expect(menu.menuItems.find((item) => item.id === "mi-latte")?.price).toBe(47000);
    expect(menu.menuItems.some((item) => item.id === "mi-cold-brew")).toBe(false);
  });

  it("applies mock floor-plan changesets without overwriting table status", async () => {
    const ports = createMockPorts();
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
});
