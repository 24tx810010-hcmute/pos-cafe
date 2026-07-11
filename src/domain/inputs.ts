import type {
  OrderType,
  PaymentMethod,
  SeedStatus,
  SubmitOrderDraftItem,
} from "./models";

export type CreateStoreInput = {
  displayName?: string;
  address?: string;
  /** Tạo sẵn dữ liệu mẫu (menu/floor/cashier demo) khi tạo store. Mặc định false. */
  seedDemo?: boolean;
};

export type CreateStoreResult = {
  storeId: string;
  storeNo: number;
  storeKey: string;
  adminPin: string;
  seedStatus: Exclude<SeedStatus, "pending">;
  canRetrySeed: boolean;
};

export type EmployeeInput = {
  id: string;
  name: string;
  role: "admin" | "cashier" | "kitchen";
  pin: string;
};

export type EmployeeUpdate = Partial<Omit<EmployeeInput, "id" | "pin">> & {
  id: string;
  isActive?: boolean;
};

export type SubmitOrderChangesInput = {
  orderId: string | null;
  tableId: string | null;
  orderType: OrderType;
  employeeId: string;
  expectedVersion: number | null;
  items: SubmitOrderDraftItem[];
};

export type PayOrderInput = {
  paymentId: string;
  orderId: string;
  employeeId: string;
  method: PaymentMethod;
  expectedVersion: number;
  receivedAmount: number;
};

export type PayOrderItemLine = {
  orderItemId: string;
  /** Số lượng trả lần này, 1..số lượng của dòng. */
  quantity: number;
  /** UUID client sinh sẵn cho dòng tách ra khi trả một phần số lượng (offline-seam: id do client cấp). */
  splitItemId: string;
};

/** Instant pay: tách các món được chọn ra một đơn mới (UUID client cấp) và thanh toán đơn đó ngay. */
export type PayOrderItemsInput = {
  paymentId: string;
  /** Đơn gốc đang mở trên bàn. */
  orderId: string;
  /** UUID client sinh sẵn cho đơn tách. */
  newOrderId: string;
  employeeId: string;
  method: PaymentMethod;
  expectedVersion: number;
  receivedAmount: number;
  items: PayOrderItemLine[];
};

export type OrderHistoryFilter = {
  fromDate: string;
  toDate: string;
  page: number;
  pageSize: number;
  status?: "paid" | "void";
  orderType?: OrderType;
  search?: string;
  tableIds?: string[];
};

export type OrderSummaryPage = {
  items: import("./models").OrderSummary[];
  total: number;
};

export type ReportFilter = {
  businessDate: string;
};

export type StoreSettingsUpdate = Partial<{
  displayName: string;
  address: string;
  billFooter: string;
  timezone: string;
}>;
