export type EmployeeRole = "admin" | "cashier" | "kitchen";
export type OrderType = "dine_in" | "takeaway";
export type OrderStatus = "open" | "paid" | "void";
export type TableStatus = "empty" | "occupied";
export type PaymentMethod = "cash" | "bank_transfer" | "qr" | "other";
export type SeedStatus = "pending" | "seeded" | "failed";

export type StoreSession = {
  storeId: string;
  storeNo: number;
};

export type Employee = {
  id: string;
  name: string;
  role: EmployeeRole;
  isActive: boolean;
};

export type StoreSettings = {
  storeId: string;
  displayName: string;
  address: string;
  currency: "VND";
  timezone: string;
  billFooter: string;
};

export type Category = {
  id: string;
  name: string;
  sortOrder: number;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  imageAssetKey: string | null;
  sortOrder: number;
  isAvailable: boolean;
};

export type OptionGroup = {
  id: string;
  menuItemId: string;
  name: string;
  selectType: "single" | "multi";
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
};

export type OptionValue = {
  id: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
};

export type MenuCatalog = {
  categories: Category[];
  menuItems: MenuItem[];
  optionGroups: OptionGroup[];
  optionValues: OptionValue[];
};

export type FloorArea = {
  id: string;
  name: string;
  sortOrder: number;
};

export type TableShape = "round" | "square" | "rectangle";

export type FloorTable = {
  id: string;
  areaId: string;
  name: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  shape: TableShape;
  rotation: number;
  seats: number;
  sortOrder: number;
  status: TableStatus;
};

export type DecorKind = "wall" | "plant" | "counter" | "door" | "decor" | "image";

export type FloorDecorItem = {
  id: string;
  areaId: string;
  kind: DecorKind;
  label: string | null;
  assetKey: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  isLocked: boolean;
};

export type FloorPlan = {
  areas: FloorArea[];
  tables: FloorTable[];
  decorItems: FloorDecorItem[];
};

export type SubmitOrderDraftOption = {
  id: string;
  optionValueId: string;
};

export type SubmitOrderDraftItem = {
  id: string;
  menuItemId: string;
  quantity: number;
  note?: string | null;
  options: SubmitOrderDraftOption[];
};

export type OrderItemOptionSnapshot = {
  id: string;
  optionValueId: string;
  optionName: string;
  priceDelta: number;
};

export type OrderItemSnapshot = {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  note?: string | null;
  options: OrderItemOptionSnapshot[];
};

export type OrderSummary = {
  id: string;
  orderNo: number;
  status: OrderStatus;
  total: number;
  lockVersion: number;
  tableId: string | null;
  orderType: OrderType;
  businessDate: string;
};

export type OrderPaymentSnapshot = {
  id: string;
  employeeId: string;
  method: PaymentMethod;
  amount: number;
  receivedAmount: number;
  changeAmount: number;
  paidAt: string;
};

export type OrderDetail = OrderSummary & {
  items: OrderItemSnapshot[];
  paidAt: string | null;
  payment: OrderPaymentSnapshot | null;
};

export type PrintLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  options: string[];
};

export type PrintTicket = {
  orderNo: number;
  tableName: string | null;
  orderType: OrderType;
  lines: PrintLine[];
  total: number;
};

export type PrintReceipt = PrintTicket & {
  receivedAmount: number;
  changeAmount: number;
  paidAt: string;
};

export type SubmitOrderChangesResult = {
  orderId: string | null;
  status: "open" | "void";
  tableId: string | null;
  tableStatus: TableStatus | null;
  orderNo: number;
  businessDate: string;
  lockVersion: number;
  ticket: PrintTicket | null;
};

export type PayOrderResult = {
  orderId: string;
  paymentId: string;
  status: "paid";
  total: number;
  receivedAmount: number;
  changeAmount: number;
  lockVersion: number;
  receipt: PrintReceipt;
};

export type CoreReport = {
  businessDate: string;
  revenue: number;
  paidOrders: number;
  averageTicket: number;
  topItemName: string;
  hourlyRevenue: Array<{ label: string; revenue: number }>;
};
