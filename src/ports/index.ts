import type {
  EmployeeSession,
  ReceiptSnapshot,
  OperationView,
  WritePayloadV1,
  WriteCapabilities,
  WriteOperationFilter,
  WriteOperationPage,
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
  PayOrderItemsInput,
  PayOrderItemsResult,
  PayOrderResult,
  PrintReceipt,
  PrintTicket,
  ReportFilter,
  StoreSession,
  StoreSettings,
  StoreSettingsUpdate,
  SubmitOrderChangesInput,
  SubmitOrderChangesResult,
  VoidOrderInput,
  VoidOrderResult,
} from "@/domain";

export type * from "./permissions";
export type * from "./permissionPrint";

export type InitialReceiptExecutionResult = {
  operation: OperationView;
  initialReceiptPrintGrant?: import("./permissionPrint").InitialReceiptPrintGrant;
};

export interface IAuthRepo {
  pairStore(storeKey: string): Promise<void>;
  createStore(input: CreateStoreInput): Promise<CreateStoreResult>;
  /** Explicit acknowledgement releases the only in-memory copy of the generated secret. */
  acknowledgeCreatedStore(): void;
  unpairStore(): Promise<void>;
  getStoreSession(): Promise<StoreSession | null>;
}

export interface IEmployeeRepo {
  startSession(employeeId: string, pin: string): Promise<EmployeeSession>;
  revokeSession(): Promise<void>;
  listEmployees(): Promise<Employee[]>;
  listActiveEmployees(): Promise<Employee[]>;
  verifyPin(employeeId: string, pin: string): Promise<Employee>;
  createEmployee(input: EmployeeInput): Promise<Employee>;
  updateEmployee(input: EmployeeUpdate): Promise<Employee>;
  resetPin(employeeId: string, newPin: string): Promise<void>;
}

export interface IWriteOperationRepo {
  capabilities(): Promise<WriteCapabilities>;
  register(operationId: string, payload: WritePayloadV1): Promise<OperationView>;
  execute(operationId: string, payload: WritePayloadV1): Promise<OperationView>;
  executeForInitialReceipt(operationId: string, payload: WritePayloadV1, input: { grantId: string }): Promise<InitialReceiptExecutionResult>;
  get(operationId: string): Promise<OperationView>;
  list(filter?: WriteOperationFilter): Promise<WriteOperationPage>;
  cancel(operationId: string): Promise<OperationView>;
}

export interface IMenuRepo {
  getMenu(): Promise<MenuCatalog>;
  saveMenuChanges(changes: MenuChanges): Promise<void>;
}

export type MenuItemImageUploadInput = {
  itemId: string;
  file: File;
};

export type MenuItemImageUploadResult = {
  assetKey: string;
  publicUrl: string;
};

export interface IMenuImagePort {
  uploadMenuItemImage(input: MenuItemImageUploadInput): Promise<MenuItemImageUploadResult>;
  deleteMenuItemImage(assetKey: string): Promise<void>;
  getImageUrl(assetKey: string | null | undefined): string | null;
}

export interface IFloorPlanRepo {
  getFloorPlan(): Promise<FloorPlan>;
  saveFloorPlan(changes: FloorPlanChanges): Promise<void>;
}

export interface IOrderRepo {
  getReceipt(orderId: string): Promise<{ receipt: ReceiptSnapshot; legacyMetadata: boolean }>;
  listOpenOrders(): Promise<OrderSummary[]>;
  getOrder(orderId: string): Promise<OrderDetail>;
  submitOrderChanges(input: SubmitOrderChangesInput): Promise<SubmitOrderChangesResult>;
  listTakeawayOpenOrders(): Promise<OrderSummary[]>;
  listOrderHistory(filter: OrderHistoryFilter): Promise<OrderSummaryPage>;
  /** Hủy một đơn ĐÃ THANH TOÁN: giữ nguyên total/order_no/payment, chỉ đổi status + metadata hủy. */
  voidOrder(input: VoidOrderInput): Promise<VoidOrderResult>;
}

export interface IPaymentRepo {
  /** Thanh toán toàn bộ đơn; đơn chuyển "paid", bàn được trả. */
  payOrder(input: PayOrderInput): Promise<PayOrderResult>;
  /** Instant pay: tách các món được chọn ra đơn mới độc lập và thanh toán đơn đó ngay; đơn gốc vẫn mở với phần còn lại. */
  payOrderItems(input: PayOrderItemsInput): Promise<PayOrderItemsResult>;
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
  permission: import("./permissions").PermissionRuntimePorts;
  write: IWriteOperationRepo;
  auth: IAuthRepo;
  seed: ISeedRepo;
  print: IPrintPort;
};

/** Pre-permission repository surface retained for isolated legacy adapter tests. */
export type LegacyAppPorts = {
  write: IWriteOperationRepo;
  auth: IAuthRepo;
  employee: IEmployeeRepo;
  menu: IMenuRepo;
  menuImages: IMenuImagePort;
  floorPlan: IFloorPlanRepo;
  order: IOrderRepo;
  payment: IPaymentRepo;
  report: IReportRepo;
  settings: ISettingsRepo;
  seed: ISeedRepo;
  print: IPrintPort;
  realtime: IRealtimePort;
};
