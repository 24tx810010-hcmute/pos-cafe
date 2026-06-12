import type {
  Employee,
  OrderDetail,
  StoreSettings,
} from "@/domain";
import { demoFloorPlan, demoMenuCatalog } from "@/seed/demoSeedData";

export const mockStoreId = "store-demo-001";

export const mockEmployees: Employee[] = [
  { id: "emp-admin", name: "Quản lý", role: "admin", isActive: true },
  { id: "emp-cashier-1", name: "Thu ngân 1", role: "cashier", isActive: true },
  { id: "emp-cashier-2", name: "Thu ngân 2", role: "cashier", isActive: true },
  { id: "emp-kitchen", name: "Bếp", role: "kitchen", isActive: true },
];

export const mockPins: Record<string, string> = {
  "emp-admin": "123456",
  "emp-cashier-1": "111111",
  "emp-cashier-2": "111111",
  "emp-kitchen": "222222",
};

export const mockSettings: StoreSettings = {
  storeId: mockStoreId,
  displayName: "POS Demo",
  address: "01 Demo Street",
  currency: "VND",
  timezone: "Asia/Saigon",
  billFooter: "Cảm ơn quý khách và hẹn gặp lại.",
};

export const mockMenuCatalog = demoMenuCatalog;
export const mockFloorPlan = demoFloorPlan;

export const mockOpenOrders: OrderDetail[] = [
  {
    id: "ord-b02",
    tableId: "tbl-b02",
    orderNo: 24,
    businessDate: "2026-06-11",
    status: "open",
    total: 125000,
    lockVersion: 3,
    orderType: "dine_in",
    paidAt: null,
    items: [
      {
        id: "oi-b02-1",
        menuItemId: "mi-ca-phe-sua",
        itemName: "Cà phê sữa",
        quantity: 2,
        unitPrice: 29000,
        note: "Ít đá",
        options: [{ id: "oio-b02-1", optionValueId: "ov-size-m", optionName: "Size M", priceDelta: 0 }],
      },
      {
        id: "oi-b02-2",
        menuItemId: "mi-bac-xiu",
        itemName: "Bạc xỉu",
        quantity: 1,
        unitPrice: 32000,
        note: null,
        options: [{ id: "oio-b02-2", optionValueId: "ov-duong-50", optionName: "50% đường", priceDelta: 0 }],
      },
      {
        id: "oi-b02-3",
        menuItemId: "mi-croissant",
        itemName: "Croissant",
        quantity: 1,
        unitPrice: 35000,
        note: "Hâm nóng",
        options: [],
      },
    ],
  },
  {
    id: "ord-b05",
    tableId: "tbl-b05",
    orderNo: 25,
    businessDate: "2026-06-11",
    status: "open",
    total: 86000,
    lockVersion: 1,
    orderType: "dine_in",
    paidAt: null,
    items: [
      { id: "oi-b05-1", menuItemId: "mi-tra-dao", itemName: "Trà đào", quantity: 1, unitPrice: 42000, note: null, options: [] },
      { id: "oi-b05-2", menuItemId: "mi-ca-phe-muoi", itemName: "Cà phê muối", quantity: 1, unitPrice: 39000, note: null, options: [] },
      { id: "oi-b05-3", menuItemId: "mi-tran-chau", itemName: "Topping", quantity: 1, unitPrice: 5000, note: null, options: [] },
    ],
  },
  {
    id: "ord-takeaway-1",
    tableId: null,
    orderNo: 26,
    businessDate: "2026-06-11",
    status: "open",
    total: 84000,
    lockVersion: 2,
    orderType: "takeaway",
    paidAt: null,
    items: [
      { id: "oi-takeaway-1", menuItemId: "mi-tra-dao", itemName: "Trà đào", quantity: 1, unitPrice: 42000, note: null, options: [] },
      { id: "oi-takeaway-2", menuItemId: "mi-tra-vai", itemName: "Trà vải", quantity: 1, unitPrice: 42000, note: "Ít đá", options: [] },
    ],
  },
];

export const mockPaidOrders: OrderDetail[] = [
  {
    id: "ord-paid-1",
    tableId: "tbl-l01",
    orderNo: 23,
    businessDate: "2026-06-11",
    status: "paid",
    total: 77000,
    lockVersion: 2,
    orderType: "dine_in",
    paidAt: "2026-06-11T09:15:00.000Z",
    items: [
      {
        id: "oi-paid-1",
        menuItemId: "mi-latte",
        itemName: "Latte",
        quantity: 1,
        unitPrice: 45000,
        note: null,
        options: [],
      },
      {
        id: "oi-paid-2",
        menuItemId: "mi-bac-xiu",
        itemName: "Bạc xỉu",
        quantity: 1,
        unitPrice: 32000,
        note: null,
        options: [{ id: "oio-paid-2", optionValueId: "ov-duong-50", optionName: "50% đường", priceDelta: 0 }],
      },
    ],
  },
];

export const mockOrders: OrderDetail[] = [...mockOpenOrders, ...mockPaidOrders];
