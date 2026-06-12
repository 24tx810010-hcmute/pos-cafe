import type {
  AppPorts,
  IAuthRepo,
  IEmployeeRepo,
  IFloorPlanRepo,
  IMenuRepo,
  IOrderRepo,
  IPaymentRepo,
  IPrintPort,
  IRealtimePort,
  IReportRepo,
  ISeedRepo,
  ISettingsRepo,
} from "@/ports";
import type {
  CoreReport,
  Employee,
  EmployeeInput,
  EmployeeUpdate,
  FloorPlan,
  FloorPlanChanges,
  MenuCatalog,
  MenuChanges,
  OrderDetail,
  OrderHistoryFilter,
  OrderSummary,
  PayOrderInput,
  PayOrderResult,
  PrintReceipt,
  PrintTicket,
  StoreSession,
  StoreSettings,
  StoreSettingsUpdate,
  SubmitOrderChangesInput,
  SubmitOrderChangesResult,
} from "@/domain";
import { AppError } from "@/core/appError";
import { calculateSnapshotTotal, snapshotDraftItems } from "@/core/orderDraft";
import {
  mockEmployees,
  mockFloorPlan,
  mockMenuCatalog,
  mockOrders,
  mockPins,
  mockSettings,
  mockStoreId,
} from "./mockData";

const clone = <T>(value: T): T => structuredClone(value);

const todayBusinessDate = "2026-06-11";

const parseStoreNo = (storeKey: string): number => {
  const [storeNo] = storeKey.split("-");
  const parsed = Number.parseInt(storeNo, 10);
  return Number.isFinite(parsed) ? parsed : 1;
};

const stripUndefined = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const updateById = <T extends { id: string }>(
  items: T[],
  update: Partial<T> & { id: string },
): T[] =>
  items.map((item) => (item.id === update.id ? { ...item, ...stripUndefined(update) } : item));

const removeByIds = <T extends { id: string }>(items: T[], deleted: Array<{ id: string }>): T[] => {
  const deletedIds = new Set(deleted.map((item) => item.id));
  return items.filter((item) => !deletedIds.has(item.id));
};

export type MockState = {
  session: StoreSession | null;
  employees: Employee[];
  pins: Record<string, string>;
  menu: MenuCatalog;
  floorPlan: FloorPlan;
  orders: OrderDetail[];
  settings: StoreSettings;
  nextOrderNo: number;
  lastTicket: PrintTicket | null;
  lastReceipt: PrintReceipt | null;
};

export const createMockState = (): MockState => ({
  session: { storeId: mockStoreId, storeNo: 1 },
  employees: clone(mockEmployees),
  pins: clone(mockPins),
  menu: clone(mockMenuCatalog),
  floorPlan: clone(mockFloorPlan),
  orders: clone(mockOrders),
  settings: clone(mockSettings),
  nextOrderNo: 30,
  lastTicket: null,
  lastReceipt: null,
});

const toSummary = (order: OrderDetail): OrderSummary => ({
  id: order.id,
  orderNo: order.orderNo,
  status: order.status,
  total: order.total,
  lockVersion: order.lockVersion,
  tableId: order.tableId,
  orderType: order.orderType,
  businessDate: order.businessDate,
});

const makeTicket = (order: OrderDetail, floorPlan: FloorPlan): PrintTicket => {
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

class MockAuthRepo implements IAuthRepo {
  constructor(private readonly state: MockState) {}

  async pairStore(storeKey: string): Promise<void> {
    this.state.session = { storeId: mockStoreId, storeNo: parseStoreNo(storeKey) };
  }

  async createStore(): Promise<import("@/domain").CreateStoreResult> {
    this.state.session = { storeId: mockStoreId, storeNo: 1 };
    return {
      storeId: mockStoreId,
      storeNo: 1,
      storeKey: "0001-X8F3QA",
      adminPin: "123456",
      seedStatus: "seeded",
      canRetrySeed: false,
    };
  }

  async unpairStore(): Promise<void> {
    this.state.session = null;
  }

  async getStoreSession(): Promise<StoreSession | null> {
    return clone(this.state.session);
  }
}

class MockEmployeeRepo implements IEmployeeRepo {
  constructor(private readonly state: MockState) {}

  async listActiveEmployees(): Promise<Employee[]> {
    return clone(this.state.employees.filter((employee) => employee.isActive));
  }

  async verifyPin(employeeId: string, pin: string): Promise<Employee> {
    const employee = this.state.employees.find((candidate) => candidate.id === employeeId && candidate.isActive);

    if (!employee || this.state.pins[employeeId] !== pin) {
      throw new AppError("INVALID_PIN", "PIN không đúng.");
    }

    return clone(employee);
  }

  async createEmployee(input: EmployeeInput): Promise<Employee> {
    const employee: Employee = { id: input.id, name: input.name, role: input.role, isActive: true };
    this.state.employees.push(employee);
    this.state.pins[input.id] = input.pin;
    return clone(employee);
  }

  async updateEmployee(input: EmployeeUpdate): Promise<Employee> {
    const employee = this.state.employees.find((candidate) => candidate.id === input.id);

    if (!employee) {
      throw new AppError("NOT_FOUND", "Không tìm thấy nhân viên.");
    }

    Object.assign(employee, input);
    return clone(employee);
  }

  async resetPin(employeeId: string, newPin: string): Promise<void> {
    this.state.pins[employeeId] = newPin;
  }
}

class MockMenuRepo implements IMenuRepo {
  constructor(private readonly state: MockState) {}

  async getMenu(): Promise<MenuCatalog> {
    return clone(this.state.menu);
  }

  async saveMenuChanges(changes: MenuChanges): Promise<void> {
    this.state.menu.categories.push(...changes.categories.created);
    this.state.menu.menuItems.push(
      ...changes.menuItems.created.map((item) => ({
        ...item,
        imageAssetKey: item.imageAssetKey ?? null,
      })),
    );
    this.state.menu.optionGroups.push(...changes.optionGroups.created);
    this.state.menu.optionValues.push(...changes.optionValues.created);

    for (const category of changes.categories.updated) {
      this.state.menu.categories = updateById(this.state.menu.categories, category);
    }
    for (const item of changes.menuItems.updated) {
      this.state.menu.menuItems = updateById(this.state.menu.menuItems, item);
    }
    for (const group of changes.optionGroups.updated) {
      this.state.menu.optionGroups = updateById(this.state.menu.optionGroups, group);
    }
    for (const value of changes.optionValues.updated) {
      this.state.menu.optionValues = updateById(this.state.menu.optionValues, value);
    }

    this.state.menu.optionValues = removeByIds(this.state.menu.optionValues, changes.optionValues.deleted);
    this.state.menu.optionGroups = removeByIds(this.state.menu.optionGroups, changes.optionGroups.deleted);
    this.state.menu.menuItems = removeByIds(this.state.menu.menuItems, changes.menuItems.deleted);
    this.state.menu.categories = removeByIds(this.state.menu.categories, changes.categories.deleted);
  }
}

class MockFloorPlanRepo implements IFloorPlanRepo {
  constructor(private readonly state: MockState) {}

  async getFloorPlan(): Promise<FloorPlan> {
    return clone(this.state.floorPlan);
  }

  async saveFloorPlan(changes: FloorPlanChanges): Promise<void> {
    this.state.floorPlan.areas.push(...changes.areas.created);
    this.state.floorPlan.tables.push(
      ...changes.tables.created.map((table) => ({
        ...table,
        status: "empty" as const,
      })),
    );
    this.state.floorPlan.decorItems.push(
      ...changes.decorItems.created.map((decor) => ({
        ...decor,
        label: decor.label ?? null,
      })),
    );

    for (const area of changes.areas.updated) {
      this.state.floorPlan.areas = updateById(this.state.floorPlan.areas, area);
    }
    for (const table of changes.tables.updated) {
      const tableUpdate = stripUndefined(table);
      this.state.floorPlan.tables = this.state.floorPlan.tables.map((candidate) =>
        candidate.id === table.id ? { ...candidate, ...tableUpdate, status: candidate.status } : candidate,
      );
    }
    for (const decor of changes.decorItems.updated) {
      this.state.floorPlan.decorItems = updateById(this.state.floorPlan.decorItems, decor);
    }

    this.state.floorPlan.decorItems = removeByIds(this.state.floorPlan.decorItems, changes.decorItems.deleted);
    this.state.floorPlan.tables = removeByIds(this.state.floorPlan.tables, changes.tables.deleted);
    this.state.floorPlan.areas = removeByIds(this.state.floorPlan.areas, changes.areas.deleted);
  }
}

class MockOrderRepo implements IOrderRepo {
  constructor(private readonly state: MockState) {}

  async listOpenOrders(): Promise<OrderSummary[]> {
    return this.state.orders.filter((order) => order.status === "open").map(toSummary);
  }

  async getOrder(orderId: string): Promise<OrderDetail> {
    const order = this.state.orders.find((candidate) => candidate.id === orderId);

    if (!order) {
      throw new AppError("NOT_FOUND", "Không tìm thấy đơn.");
    }

    return clone(order);
  }

  async submitOrderChanges(input: SubmitOrderChangesInput): Promise<SubmitOrderChangesResult> {
    const activeItems = input.items.filter((item) => item.quantity > 0);
    const existingOrder = input.orderId
      ? this.state.orders.find((candidate) => candidate.id === input.orderId)
      : null;

    if (existingOrder) {
      if (existingOrder.status !== "open" || existingOrder.lockVersion !== input.expectedVersion) {
        throw new AppError("ORDER_VERSION_CONFLICT", "Dữ liệu đã thay đổi, vui lòng tải lại.");
      }

      if (activeItems.length === 0) {
        existingOrder.status = "void";
        existingOrder.items = [];
        existingOrder.total = 0;
        existingOrder.lockVersion += 1;
        if (existingOrder.tableId) {
          this.setTableStatus(existingOrder.tableId, "empty");
        }

        return {
          orderId: existingOrder.id,
          status: "void",
          tableId: existingOrder.tableId,
          tableStatus: existingOrder.tableId ? "empty" : null,
          orderNo: existingOrder.orderNo,
          businessDate: existingOrder.businessDate,
          lockVersion: existingOrder.lockVersion,
          ticket: null,
        };
      }

      existingOrder.items = snapshotDraftItems(this.state.menu, activeItems);
      existingOrder.total = calculateSnapshotTotal(existingOrder.items);
      existingOrder.lockVersion += 1;
      const ticket = makeTicket(existingOrder, this.state.floorPlan);
      this.state.lastTicket = ticket;
      return {
        orderId: existingOrder.id,
        status: "open",
        tableId: existingOrder.tableId,
        tableStatus: existingOrder.tableId ? "occupied" : null,
        orderNo: existingOrder.orderNo,
        businessDate: existingOrder.businessDate,
        lockVersion: existingOrder.lockVersion,
        ticket,
      };
    }

    if (activeItems.length === 0) {
      return {
        orderId: null,
        status: "void",
        tableId: input.tableId,
        tableStatus: null,
        orderNo: 0,
        businessDate: todayBusinessDate,
        lockVersion: 0,
        ticket: null,
      };
    }

    const order: OrderDetail = {
      id: input.orderId ?? crypto.randomUUID(),
      tableId: input.tableId,
      orderType: input.orderType,
      orderNo: this.state.nextOrderNo++,
      businessDate: todayBusinessDate,
      status: "open",
      lockVersion: 0,
      paidAt: null,
      total: 0,
      items: snapshotDraftItems(this.state.menu, activeItems),
    };
    order.total = calculateSnapshotTotal(order.items);
    this.state.orders.push(order);

    if (order.tableId) {
      this.setTableStatus(order.tableId, "occupied");
    }

    const ticket = makeTicket(order, this.state.floorPlan);
    this.state.lastTicket = ticket;
    return {
      orderId: order.id,
      status: "open",
      tableId: order.tableId,
      tableStatus: order.tableId ? "occupied" : null,
      orderNo: order.orderNo,
      businessDate: order.businessDate,
      lockVersion: order.lockVersion,
      ticket,
    };
  }

  async listTakeawayOpenOrders(): Promise<OrderSummary[]> {
    return this.state.orders
      .filter((order) => order.status === "open" && order.orderType === "takeaway")
      .map(toSummary);
  }

  async listOrderHistory(filter: OrderHistoryFilter): Promise<import("@/domain").OrderSummaryPage> {
    const items = this.state.orders
      .filter((order) => order.businessDate >= filter.fromDate && order.businessDate <= filter.toDate)
      .map(toSummary);
    return { items, total: items.length };
  }

  private setTableStatus(tableId: string, status: "empty" | "occupied"): void {
    const table = this.state.floorPlan.tables.find((candidate) => candidate.id === tableId);
    if (table) {
      table.status = status;
    }
  }
}

class MockPaymentRepo implements IPaymentRepo {
  constructor(private readonly state: MockState) {}

  async payOrder(input: PayOrderInput): Promise<PayOrderResult> {
    const order = this.state.orders.find((candidate) => candidate.id === input.orderId);

    if (!order || order.status !== "open" || order.lockVersion !== input.expectedVersion) {
      throw new AppError("ORDER_VERSION_CONFLICT", "Dữ liệu đã thay đổi, vui lòng tải lại.");
    }

    if (input.receivedAmount < order.total) {
      throw new AppError("PAYMENT_AMOUNT_TOO_LOW", "Tiền khách đưa nhỏ hơn tổng tiền.");
    }

    order.status = "paid";
    order.lockVersion += 1;
    order.paidAt = new Date().toISOString();
    if (order.tableId) {
      const table = this.state.floorPlan.tables.find((candidate) => candidate.id === order.tableId);
      if (table) {
        table.status = "empty";
      }
    }

    const receipt: PrintReceipt = {
      ...makeTicket(order, this.state.floorPlan),
      receivedAmount: input.receivedAmount,
      changeAmount: input.receivedAmount - order.total,
      paidAt: order.paidAt,
    };
    this.state.lastReceipt = receipt;

    return {
      orderId: order.id,
      paymentId: input.paymentId,
      status: "paid",
      total: order.total,
      receivedAmount: input.receivedAmount,
      changeAmount: input.receivedAmount - order.total,
      lockVersion: order.lockVersion,
      receipt,
    };
  }
}

class MockReportRepo implements IReportRepo {
  constructor(private readonly state: MockState) {}

  async getCoreReport(): Promise<CoreReport> {
    const paidOrders = this.state.orders.filter((order) => order.status === "paid");
    const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
    const hourlyRevenue = new Map<string, number>();
    const topItems = new Map<string, number>();

    for (const order of paidOrders) {
      const paidAt = order.paidAt ? new Date(order.paidAt) : null;
      const label = paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt.getHours().toString().padStart(2, "0") : "--";
      hourlyRevenue.set(label, (hourlyRevenue.get(label) ?? 0) + order.total);

      for (const item of order.items) {
        topItems.set(item.itemName, (topItems.get(item.itemName) ?? 0) + item.quantity);
      }
    }

    return {
      businessDate: todayBusinessDate,
      revenue,
      paidOrders: paidOrders.length,
      averageTicket: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
      topItemName: [...topItems.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-",
      hourlyRevenue: [...hourlyRevenue.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, revenue: value })),
    };
  }
}

class MockSettingsRepo implements ISettingsRepo {
  constructor(private readonly state: MockState) {}

  async getSettings(): Promise<StoreSettings> {
    return clone(this.state.settings);
  }

  async updateSettings(input: StoreSettingsUpdate): Promise<StoreSettings> {
    this.state.settings = { ...this.state.settings, ...input };
    return clone(this.state.settings);
  }

  async clearDemoData(): Promise<void> {
    if (this.state.orders.some((order) => order.status === "open")) {
      throw new AppError("OPEN_ORDERS_BLOCK_CLEAR_DEMO", "Còn đơn đang mở, không thể xoá demo data.");
    }
  }
}

class MockSeedRepo implements ISeedRepo {
  async seedDemo(): Promise<void> {
    await Promise.resolve();
  }

  async retrySeedDemo(): Promise<void> {
    await Promise.resolve();
  }

  async seedBlank(): Promise<void> {
    await Promise.resolve();
  }
}

class MockPrintPort implements IPrintPort {
  constructor(private readonly state: MockState) {}

  async renderOrderTicket(ticket: PrintTicket): Promise<void> {
    this.state.lastTicket = ticket;
  }

  async renderReceipt(receipt: PrintReceipt): Promise<void> {
    this.state.lastReceipt = receipt;
  }
}

class MockRealtimePort implements IRealtimePort {
  startStoreInvalidation(): () => void {
    return () => undefined;
  }
}

export const createMockPorts = (state = createMockState()): AppPorts => ({
  auth: new MockAuthRepo(state),
  employee: new MockEmployeeRepo(state),
  menu: new MockMenuRepo(state),
  floorPlan: new MockFloorPlanRepo(state),
  order: new MockOrderRepo(state),
  payment: new MockPaymentRepo(state),
  report: new MockReportRepo(state),
  settings: new MockSettingsRepo(state),
  seed: new MockSeedRepo(),
  print: new MockPrintPort(state),
  realtime: new MockRealtimePort(),
});
