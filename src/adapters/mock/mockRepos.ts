import type {
  AppPorts,
  IAuthRepo,
  IEmployeeRepo,
  IFloorPlanRepo,
  IMenuRepo,
  IOrderRepo,
  IPaymentRepo,
  IPrintPort,
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
  MenuCatalog,
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
  mockOpenOrders,
  mockPins,
  mockSettings,
  mockStoreId,
} from "./mockData";

const clone = <T>(value: T): T => structuredClone(value);

const todayBusinessDate = "2026-06-11";

type MockState = {
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
  session: { storeId: mockStoreId, storeNo: 1, storeKey: "1" },
  employees: clone(mockEmployees),
  pins: clone(mockPins),
  menu: clone(mockMenuCatalog),
  floorPlan: clone(mockFloorPlan),
  orders: clone(mockOpenOrders),
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
    this.state.session = { storeId: mockStoreId, storeNo: Number(storeKey) || 1, storeKey };
  }

  async createStore(): Promise<import("@/domain").CreateStoreResult> {
    this.state.session = { storeId: mockStoreId, storeNo: 1, storeKey: "1" };
    return {
      storeId: mockStoreId,
      storeNo: 1,
      storeKey: "1",
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

  async saveMenuChanges(): Promise<void> {
    await Promise.resolve();
  }
}

class MockFloorPlanRepo implements IFloorPlanRepo {
  constructor(private readonly state: MockState) {}

  async getFloorPlan(): Promise<FloorPlan> {
    return clone(this.state.floorPlan);
  }

  async saveFloorPlan(): Promise<void> {
    await Promise.resolve();
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
    return {
      businessDate: todayBusinessDate,
      revenue,
      paidOrders: paidOrders.length,
      averageTicket: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
      topItemName: paidOrders[0]?.items[0]?.itemName ?? "Bạc xỉu",
      hourlyRevenue: [
        { label: "08", revenue: 180000 },
        { label: "10", revenue: 320000 },
        { label: "12", revenue: 260000 },
        { label: "14", revenue: 420000 },
        { label: "16", revenue: 360000 },
        { label: "18", revenue: 540000 },
      ],
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
});
