import type {
  Employee,
  FloorPlan,
  MenuCatalog,
  OrderDetail,
  StoreSettings,
} from "@/domain";

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

export const mockMenuCatalog: MenuCatalog = {
  categories: [
    { id: "cat-coffee", name: "Cà phê", sortOrder: 1 },
    { id: "cat-tea", name: "Trà & trà sữa", sortOrder: 2 },
    { id: "cat-blended", name: "Đá xay", sortOrder: 3 },
    { id: "cat-snack", name: "Bánh/snack", sortOrder: 4 },
  ],
  menuItems: [
    { id: "mi-ca-phe-sua", categoryId: "cat-coffee", name: "Cà phê sữa", price: 29000, imageAssetKey: null, sortOrder: 1, isAvailable: true },
    { id: "mi-bac-xiu", categoryId: "cat-coffee", name: "Bạc xỉu", price: 32000, imageAssetKey: null, sortOrder: 2, isAvailable: true },
    { id: "mi-americano", categoryId: "cat-coffee", name: "Americano", price: 35000, imageAssetKey: null, sortOrder: 3, isAvailable: true },
    { id: "mi-latte", categoryId: "cat-coffee", name: "Latte", price: 45000, imageAssetKey: null, sortOrder: 4, isAvailable: true },
    { id: "mi-cold-brew", categoryId: "cat-coffee", name: "Cold brew", price: 49000, imageAssetKey: null, sortOrder: 5, isAvailable: true },
    { id: "mi-ca-phe-muoi", categoryId: "cat-coffee", name: "Cà phê muối", price: 39000, imageAssetKey: null, sortOrder: 6, isAvailable: true },
    { id: "mi-tra-dao", categoryId: "cat-tea", name: "Trà đào", price: 42000, imageAssetKey: null, sortOrder: 7, isAvailable: true },
    { id: "mi-tra-vai", categoryId: "cat-tea", name: "Trà vải", price: 42000, imageAssetKey: null, sortOrder: 8, isAvailable: true },
    { id: "mi-tra-sua-truyen-thong", categoryId: "cat-tea", name: "Trà sữa truyền thống", price: 39000, imageAssetKey: null, sortOrder: 9, isAvailable: true },
    { id: "mi-tra-chanh", categoryId: "cat-tea", name: "Trà chanh", price: 29000, imageAssetKey: null, sortOrder: 10, isAvailable: true },
    { id: "mi-matcha-latte", categoryId: "cat-tea", name: "Matcha latte", price: 49000, imageAssetKey: null, sortOrder: 11, isAvailable: true },
    { id: "mi-sua-tuoi-tran-chau", categoryId: "cat-tea", name: "Sữa tươi trân châu", price: 45000, imageAssetKey: null, sortOrder: 12, isAvailable: true },
    { id: "mi-cookie-da-xay", categoryId: "cat-blended", name: "Cookie đá xay", price: 55000, imageAssetKey: null, sortOrder: 13, isAvailable: true },
    { id: "mi-matcha-da-xay", categoryId: "cat-blended", name: "Matcha đá xay", price: 59000, imageAssetKey: null, sortOrder: 14, isAvailable: true },
    { id: "mi-cacao-da-xay", categoryId: "cat-blended", name: "Ca cao đá xay", price: 52000, imageAssetKey: null, sortOrder: 15, isAvailable: true },
    { id: "mi-sinh-to-bo", categoryId: "cat-blended", name: "Sinh tố bơ", price: 49000, imageAssetKey: null, sortOrder: 16, isAvailable: true },
    { id: "mi-nuoc-ep-cam", categoryId: "cat-blended", name: "Nước ép cam", price: 45000, imageAssetKey: null, sortOrder: 17, isAvailable: true },
    { id: "mi-nuoc-ep-dua-hau", categoryId: "cat-blended", name: "Nước ép dưa hấu", price: 39000, imageAssetKey: null, sortOrder: 18, isAvailable: true },
    { id: "mi-croissant", categoryId: "cat-snack", name: "Croissant", price: 35000, imageAssetKey: null, sortOrder: 19, isAvailable: true },
    { id: "mi-banh-mi-que", categoryId: "cat-snack", name: "Bánh mì que", price: 25000, imageAssetKey: null, sortOrder: 20, isAvailable: true },
    { id: "mi-tiramisu", categoryId: "cat-snack", name: "Tiramisu", price: 45000, imageAssetKey: null, sortOrder: 21, isAvailable: true },
    { id: "mi-khoai-tay-chien", categoryId: "cat-snack", name: "Khoai tây chiên", price: 39000, imageAssetKey: null, sortOrder: 22, isAvailable: true },
  ],
  optionGroups: [
    { id: "og-coffee-size", menuItemId: "mi-ca-phe-sua", name: "Size", selectType: "single", isRequired: false, minSelect: 0, maxSelect: 1, sortOrder: 1 },
    { id: "og-coffee-ice", menuItemId: "mi-ca-phe-sua", name: "Đá", selectType: "single", isRequired: false, minSelect: 0, maxSelect: 1, sortOrder: 2 },
    { id: "og-bac-xiu-sugar", menuItemId: "mi-bac-xiu", name: "Đường", selectType: "single", isRequired: false, minSelect: 0, maxSelect: 1, sortOrder: 1 },
    { id: "og-tea-topping", menuItemId: "mi-tra-sua-truyen-thong", name: "Topping", selectType: "multi", isRequired: false, minSelect: 0, maxSelect: 3, sortOrder: 1 },
    { id: "og-latte-shot", menuItemId: "mi-latte", name: "Thêm shot", selectType: "multi", isRequired: false, minSelect: 0, maxSelect: 1, sortOrder: 1 },
  ],
  optionValues: [
    { id: "ov-size-m", optionGroupId: "og-coffee-size", name: "Size M", priceDelta: 0, sortOrder: 1 },
    { id: "ov-size-l", optionGroupId: "og-coffee-size", name: "Size L", priceDelta: 7000, sortOrder: 2 },
    { id: "ov-it-da", optionGroupId: "og-coffee-ice", name: "Ít đá", priceDelta: 0, sortOrder: 1 },
    { id: "ov-khong-da", optionGroupId: "og-coffee-ice", name: "Không đá", priceDelta: 0, sortOrder: 2 },
    { id: "ov-duong-50", optionGroupId: "og-bac-xiu-sugar", name: "50% đường", priceDelta: 0, sortOrder: 1 },
    { id: "ov-duong-100", optionGroupId: "og-bac-xiu-sugar", name: "100% đường", priceDelta: 0, sortOrder: 2 },
    { id: "ov-tran-chau", optionGroupId: "og-tea-topping", name: "Trân châu", priceDelta: 7000, sortOrder: 1 },
    { id: "ov-kem-pho-mai", optionGroupId: "og-tea-topping", name: "Kem phô mai", priceDelta: 10000, sortOrder: 2 },
    { id: "ov-them-shot", optionGroupId: "og-latte-shot", name: "Thêm shot", priceDelta: 10000, sortOrder: 1 },
  ],
};

export const mockFloorPlan: FloorPlan = {
  areas: [
    { id: "area-ground", name: "Tầng trệt", sortOrder: 1 },
    { id: "area-first", name: "Lầu 1", sortOrder: 2 },
  ],
  tables: [
    { id: "tbl-b01", areaId: "area-ground", name: "B01", posX: 260, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 1, status: "empty" },
    { id: "tbl-b02", areaId: "area-ground", name: "B02", posX: 500, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 2, status: "occupied" },
    { id: "tbl-b03", areaId: "area-ground", name: "B03", posX: 750, posY: 190, width: 126, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 3, status: "occupied" },
    { id: "tbl-b04", areaId: "area-ground", name: "B04", posX: 1040, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 4, status: "empty" },
    { id: "tbl-b05", areaId: "area-ground", name: "B05", posX: 300, posY: 520, width: 126, height: 84, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 5, status: "occupied" },
    { id: "tbl-b06", areaId: "area-ground", name: "B06", posX: 600, posY: 520, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 6, status: "empty" },
    { id: "tbl-b07", areaId: "area-ground", name: "B07", posX: 880, posY: 520, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 7, status: "empty" },
    { id: "tbl-b08", areaId: "area-ground", name: "B08", posX: 1180, posY: 520, width: 126, height: 84, shape: "rectangle", rotation: 0, seats: 6, sortOrder: 8, status: "occupied" },
    { id: "tbl-l01", areaId: "area-first", name: "L01", posX: 260, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 1, status: "empty" },
    { id: "tbl-l02", areaId: "area-first", name: "L02", posX: 500, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 2, status: "empty" },
    { id: "tbl-l03", areaId: "area-first", name: "L03", posX: 750, posY: 190, width: 126, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 3, status: "empty" },
    { id: "tbl-l04", areaId: "area-first", name: "L04", posX: 1040, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 4, status: "empty" },
    { id: "tbl-l05", areaId: "area-first", name: "L05", posX: 460, posY: 500, width: 126, height: 84, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 5, status: "empty" },
    { id: "tbl-l06", areaId: "area-first", name: "L06", posX: 760, posY: 500, width: 126, height: 84, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 6, status: "empty" },
  ],
  decorItems: [
    { id: "decor-counter", areaId: "area-ground", kind: "counter", label: "Quầy", assetKey: "counter_01", posX: 48, posY: 48, width: 210, height: 72, rotation: 0, zIndex: 1, isLocked: true },
    { id: "decor-door", areaId: "area-ground", kind: "door", label: "Cửa", assetKey: "door_01", posX: 1480, posY: 88, width: 52, height: 190, rotation: 0, zIndex: 1, isLocked: true },
    { id: "decor-plant", areaId: "area-ground", kind: "plant", label: "Cây", assetKey: "plant_01", posX: 300, posY: 760, width: 120, height: 52, rotation: 0, zIndex: 1, isLocked: false },
    { id: "decor-wall", areaId: "area-first", kind: "wall", label: "Tường", assetKey: "wall_01", posX: 90, posY: 80, width: 310, height: 34, rotation: 0, zIndex: 1, isLocked: true },
  ],
};

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
