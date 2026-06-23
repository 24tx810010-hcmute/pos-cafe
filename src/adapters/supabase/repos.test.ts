import { describe, expect, it, vi } from "vitest";
import type { MenuChanges, FloorPlanChanges } from "@/domain";
import { createSupabasePorts } from "./repos";
import { mapOrderDetail } from "./mappers";

const submitResult = {
  orderId: "ord-1",
  status: "open",
  tableId: "tbl-b01",
  tableStatus: "occupied",
  orderNo: 31,
  businessDate: "2026-06-12",
  lockVersion: 1,
  ticket: {
    orderNo: 31,
    tableName: "B01",
    orderType: "dine_in",
    total: 45000,
    lines: [{ name: "Latte", quantity: 1, unitPrice: 45000, options: [] }],
  },
};

const payResult = {
  orderId: "ord-1",
  paymentId: "pay-1",
  status: "paid",
  total: 45000,
  receivedAmount: 50000,
  changeAmount: 5000,
  lockVersion: 2,
  receipt: {
    orderNo: 31,
    tableName: "B01",
    orderType: "dine_in",
    total: 45000,
    receivedAmount: 50000,
    changeAmount: 5000,
    paidAt: "2026-06-12T08:30:00.000Z",
    lines: [{ name: "Latte", quantity: 1, unitPrice: 45000, options: [] }],
  },
};

const createRpcClient = (dataByRpc: Record<string, unknown> = {}) => ({
  rpc: vi.fn(async (name: string) => ({ data: dataByRpc[name] ?? null, error: null })),
});

type MutationCall = {
  table: string;
  action: "insert" | "update";
  payload: unknown;
  filters: Array<{ column: string; value: unknown }>;
};

const createMutationClient = () => {
  const calls: MutationCall[] = [];
  const client = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: "store-demo-001" } } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => ({
      insert: vi.fn(async (payload: unknown) => {
        calls.push({ table, action: "insert", payload, filters: [] });
        return { error: null };
      }),
      update: vi.fn((payload: unknown) => {
        const call: MutationCall = { table, action: "update", payload, filters: [] };
        calls.push(call);
        return {
          eq: vi.fn(async (column: string, value: unknown) => {
            call.filters.push({ column, value });
            return { error: null };
          }),
        };
      }),
    })),
  };

  return { client, calls };
};

const createEmployeeQueryClient = () => {
  const data = [{ id: "emp-cashier-1", name: "Thu ngân", role: "cashier", is_active: false }];
  const order = vi.fn(async () => ({ data, error: null }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq, order }));
  const client = {
    from: vi.fn(() => ({ select })),
  };

  return { client, select, eq, order };
};

const createOrderHistoryQueryClient = () => {
  const chain = {
    select: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(async () => ({ data: [], error: null, count: 0 })),
  };
  const client = {
    from: vi.fn(() => chain),
  };

  return { client, chain };
};

describe("Supabase adapter ports", () => {
  it("uses separate employee list queries for admin and active passcode views", async () => {
    const { client, select, eq, order } = createEmployeeQueryClient();
    const ports = createSupabasePorts(client as never);

    await expect(ports.employee.listEmployees()).resolves.toEqual([
      expect.objectContaining({ id: "emp-cashier-1", isActive: false }),
    ]);
    expect(client.from).toHaveBeenCalledWith("employees");
    expect(select).toHaveBeenCalledWith("id,name,role,is_active");
    expect(eq).not.toHaveBeenCalled();

    await ports.employee.listActiveEmployees();
    expect(eq).toHaveBeenCalledWith("is_active", true);
    expect(order).toHaveBeenCalledWith("name");
  });

  it("maps submitOrderChanges camelCase input to submit_order_changes RPC params", async () => {
    const client = createRpcClient({ submit_order_changes: submitResult });
    const ports = createSupabasePorts(client as never);
    const items = [
      {
        id: "draft-1",
        menuItemId: "mi-latte",
        quantity: 1,
        note: "Ít đá",
        options: [{ id: "draft-option-1", optionValueId: "ov-them-shot" }],
      },
    ];

    const result = await ports.order.submitOrderChanges({
      orderId: "ord-1",
      tableId: "tbl-b01",
      orderType: "dine_in",
      employeeId: "emp-admin",
      expectedVersion: 0,
      items,
    });

    expect(client.rpc).toHaveBeenCalledWith("submit_order_changes", {
      p_order_id: "ord-1",
      p_table_id: "tbl-b01",
      p_order_type: "dine_in",
      p_employee_id: "emp-admin",
      p_expected_lock_version: 0,
      p_items: items,
    });
    expect(result.ticket?.lines[0]).toEqual({
      name: "Latte",
      quantity: 1,
      unitPrice: 45000,
      options: [],
    });
  });

  it("keeps empty new drafts as a no-op RPC with null order id", async () => {
    const client = createRpcClient({
      submit_order_changes: {
        ...submitResult,
        orderId: null,
        status: "void",
        tableId: null,
        tableStatus: null,
        orderNo: 0,
        lockVersion: 0,
        ticket: null,
      },
    });
    const ports = createSupabasePorts(client as never);

    await ports.order.submitOrderChanges({
      orderId: null,
      tableId: null,
      orderType: "takeaway",
      employeeId: "emp-admin",
      expectedVersion: null,
      items: [],
    });

    expect(client.rpc).toHaveBeenCalledWith("submit_order_changes", {
      p_order_id: null,
      p_table_id: null,
      p_order_type: "takeaway",
      p_employee_id: "emp-admin",
      p_expected_lock_version: null,
      p_items: [],
    });
  });

  it("maps payOrder and clearDemoData to their RPC param contracts", async () => {
    const client = createRpcClient({ pay_order: payResult, clear_demo_data: null });
    const ports = createSupabasePorts(client as never);

    const result = await ports.payment.payOrder({
      paymentId: "pay-1",
      orderId: "ord-1",
      employeeId: "emp-admin",
      method: "cash",
      expectedVersion: 1,
      receivedAmount: 50000,
    });
    await ports.settings.clearDemoData("emp-admin");

    expect(client.rpc).toHaveBeenCalledWith("pay_order", {
      p_payment_id: "pay-1",
      p_order_id: "ord-1",
      p_employee_id: "emp-admin",
      p_method: "cash",
      p_expected_lock_version: 1,
      p_received_amount: 50000,
    });
    expect(client.rpc).toHaveBeenCalledWith("clear_demo_data", { p_employee_id: "emp-admin" });
    expect(result.receipt.changeAmount).toBe(5000);
  });

  it("maps order detail payment snapshots from payment rows", () => {
    const detail = mapOrderDetail(
      {
        id: "ord-1",
        order_no: 31,
        status: "paid",
        total: 45000,
        lock_version: 2,
        table_id: "tbl-b01",
        order_type: "dine_in",
        business_date: "2026-06-12",
        paid_at: "2026-06-12T08:30:00.000Z",
      },
      [{ id: "oi-1", menu_item_id: "mi-latte", item_name: "Latte", quantity: 1, unit_price: 45000, note: null }],
      [],
      {
        id: "pay-1",
        employee_id: "emp-admin",
        method: "cash",
        amount: 45000,
        received_amount: 50000,
        change_amount: 5000,
        paid_at: "2026-06-12T08:30:00.000Z",
      },
    );

    expect(detail.payment).toEqual({
      id: "pay-1",
      employeeId: "emp-admin",
      method: "cash",
      amount: 45000,
      receivedAmount: 50000,
      changeAmount: 5000,
      paidAt: "2026-06-12T08:30:00.000Z",
    });
  });

  it("limits Supabase order history to completed orders", async () => {
    const { client, chain } = createOrderHistoryQueryClient();
    const ports = createSupabasePorts(client as never);

    await ports.order.listOrderHistory({
      fromDate: "2026-06-12",
      toDate: "2026-06-12",
      page: 2,
      pageSize: 8,
    });

    expect(client.from).toHaveBeenCalledWith("orders");
    expect(chain.in).toHaveBeenCalledWith("status", ["paid", "void"]);
    expect(chain.range).toHaveBeenCalledWith(8, 15);
  });

  it("applies Supabase order history filters before pagination", async () => {
    const { chain, client } = createOrderHistoryQueryClient();
    const ports = createSupabasePorts(client as never);

    await ports.order.listOrderHistory({
      fromDate: "2026-06-12",
      toDate: "2026-06-12",
      page: 1,
      pageSize: 8,
      status: "paid",
      orderType: "dine_in",
      search: "#31",
      tableIds: ["tbl-b01"],
    });

    expect(chain.in).toHaveBeenCalledWith("status", ["paid"]);
    expect(chain.eq).toHaveBeenCalledWith("order_type", "dine_in");
    expect(chain.or).toHaveBeenCalledWith("order_no.eq.31,id.ilike.%#31%,table_id.ilike.%#31%,table_id.in.(tbl-b01)");
    expect(chain.range).toHaveBeenCalledWith(0, 7);
  });

  it("maps menu changesets to table row mutations without Supabase types leaking to callers", async () => {
    const { client, calls } = createMutationClient();
    const ports = createSupabasePorts(client as never);
    const changes: MenuChanges = {
      categories: {
        created: [{ id: "cat-new", name: "Mới", sortOrder: 9 }],
        updated: [{ id: "cat-coffee", name: "Cà phê mới" }],
        deleted: [{ id: "cat-old", deletedByEmployeeId: "emp-admin" }],
      },
      menuItems: { created: [], updated: [], deleted: [] },
      optionGroups: { created: [], updated: [], deleted: [] },
      optionValues: { created: [], updated: [], deleted: [] },
    };

    await ports.menu.saveMenuChanges(changes);

    expect(calls).toContainEqual({
      table: "categories",
      action: "insert",
      payload: [{ id: "cat-new", store_id: "store-demo-001", name: "Mới", sort_order: 9 }],
      filters: [],
    });
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "categories",
          action: "update",
          payload: { name: "Cà phê mới" },
          filters: [{ column: "id", value: "cat-coffee" }],
        }),
        expect.objectContaining({
          table: "categories",
          action: "update",
          payload: expect.objectContaining({ deleted_by_employee_id: "emp-admin" }),
          filters: [{ column: "id", value: "cat-old" }],
        }),
      ]),
    );
  });

  it("maps floor-plan changes without writing table status during layout updates", async () => {
    const { client, calls } = createMutationClient();
    const ports = createSupabasePorts(client as never);
    const changes: FloorPlanChanges = {
      areas: { created: [], updated: [], deleted: [] },
      tables: {
        created: [],
        updated: [{ id: "tbl-b01", posX: 320, posY: 220, name: "B01" }],
        deleted: [],
      },
      decorItems: { created: [], updated: [], deleted: [] },
    };

    await ports.floorPlan.saveFloorPlan(changes);

    const tableUpdate = calls.find((call) => call.table === "tables" && call.action === "update");
    expect(tableUpdate?.payload).toEqual({ name: "B01", pos_x: 320, pos_y: 220 });
    expect(tableUpdate?.payload).not.toHaveProperty("status");
    expect(tableUpdate?.filters).toEqual([{ column: "id", value: "tbl-b01" }]);
  });
});
