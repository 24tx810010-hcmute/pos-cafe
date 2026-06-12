import type {
  CoreReport,
  CreateStoreInput,
  CreateStoreResult,
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
  OrderSummaryPage,
  PayOrderInput,
  PayOrderResult,
  PrintReceipt,
  PrintTicket,
  ReportFilter,
  StoreSession,
  StoreSettings,
  StoreSettingsUpdate,
  SubmitOrderChangesInput,
  SubmitOrderChangesResult,
} from "@/domain";

export interface IAuthRepo {
  pairStore(storeKey: string): Promise<void>;
  createStore(input: CreateStoreInput): Promise<CreateStoreResult>;
  unpairStore(): Promise<void>;
  getStoreSession(): Promise<StoreSession | null>;
}

export interface IEmployeeRepo {
  listEmployees(): Promise<Employee[]>;
  listActiveEmployees(): Promise<Employee[]>;
  verifyPin(employeeId: string, pin: string): Promise<Employee>;
  createEmployee(input: EmployeeInput): Promise<Employee>;
  updateEmployee(input: EmployeeUpdate): Promise<Employee>;
  resetPin(employeeId: string, newPin: string): Promise<void>;
}

export interface IMenuRepo {
  getMenu(): Promise<MenuCatalog>;
  saveMenuChanges(changes: MenuChanges): Promise<void>;
}

export interface IFloorPlanRepo {
  getFloorPlan(): Promise<FloorPlan>;
  saveFloorPlan(changes: FloorPlanChanges): Promise<void>;
}

export interface IOrderRepo {
  listOpenOrders(): Promise<OrderSummary[]>;
  getOrder(orderId: string): Promise<OrderDetail>;
  submitOrderChanges(input: SubmitOrderChangesInput): Promise<SubmitOrderChangesResult>;
  listTakeawayOpenOrders(): Promise<OrderSummary[]>;
  listOrderHistory(filter: OrderHistoryFilter): Promise<OrderSummaryPage>;
}

export interface IPaymentRepo {
  payOrder(input: PayOrderInput): Promise<PayOrderResult>;
}

export interface IReportRepo {
  getCoreReport(filter: ReportFilter): Promise<CoreReport>;
}

export interface ISettingsRepo {
  getSettings(): Promise<StoreSettings>;
  updateSettings(input: StoreSettingsUpdate): Promise<StoreSettings>;
  clearDemoData(employeeId: string): Promise<void>;
}

export interface ISeedRepo {
  seedDemo(storeId: string): Promise<void>;
  retrySeedDemo(storeId: string): Promise<void>;
  seedBlank(storeId: string): Promise<void>;
}

export interface IPrintPort {
  renderOrderTicket(ticket: PrintTicket): Promise<void>;
  renderReceipt(receipt: PrintReceipt): Promise<void>;
}

export type RealtimeInvalidationInput = {
  storeId: string;
  invalidateMenu(): void;
  invalidateFloorPlan(): void;
  invalidateOpenOrders(): void;
  invalidateReport(): void;
};

export interface IRealtimePort {
  startStoreInvalidation(input: RealtimeInvalidationInput): () => void;
}

export type AppPorts = {
  auth: IAuthRepo;
  employee: IEmployeeRepo;
  menu: IMenuRepo;
  floorPlan: IFloorPlanRepo;
  order: IOrderRepo;
  payment: IPaymentRepo;
  report: IReportRepo;
  settings: ISettingsRepo;
  seed: ISeedRepo;
  print: IPrintPort;
  realtime: IRealtimePort;
};
