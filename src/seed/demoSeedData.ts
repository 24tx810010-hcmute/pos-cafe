import type { FloorPlan, MenuCatalog } from "@/domain";

// Bộ dữ liệu mẫu (tuỳ chọn) khi tạo store có tick "Khởi tạo dữ liệu mẫu",
// hoặc khi bấm "Khởi tạo dữ liệu mẫu" trong Cài đặt. Cố tình giữ gọn:
// vài category/món, 1 khu vực + vài bàn, 1 nhóm tuỳ chọn đơn giản.
export const demoMenuCatalog: MenuCatalog = {
  categories: [
    { id: "cat-coffee", name: "Cà phê", sortOrder: 1 },
    { id: "cat-tea", name: "Trà & trà sữa", sortOrder: 2 },
  ],
  menuItems: [
    { id: "mi-ca-phe-sua", categoryId: "cat-coffee", name: "Cà phê sữa", price: 29000, imageAssetKey: null, sortOrder: 1, isAvailable: true },
    { id: "mi-bac-xiu", categoryId: "cat-coffee", name: "Bạc xỉu", price: 32000, imageAssetKey: null, sortOrder: 2, isAvailable: true },
    { id: "mi-latte", categoryId: "cat-coffee", name: "Latte", price: 45000, imageAssetKey: null, sortOrder: 3, isAvailable: true },
    { id: "mi-tra-dao", categoryId: "cat-tea", name: "Trà đào", price: 42000, imageAssetKey: null, sortOrder: 4, isAvailable: true },
    { id: "mi-tra-sua-truyen-thong", categoryId: "cat-tea", name: "Trà sữa truyền thống", price: 39000, imageAssetKey: null, sortOrder: 5, isAvailable: true },
    { id: "mi-tra-chanh", categoryId: "cat-tea", name: "Trà chanh", price: 29000, imageAssetKey: null, sortOrder: 6, isAvailable: true },
  ],
  optionGroups: [
    { id: "og-coffee-size", menuItemId: "mi-ca-phe-sua", name: "Size", selectType: "single", isRequired: false, minSelect: 0, maxSelect: 1, sortOrder: 1 },
  ],
  optionValues: [
    { id: "ov-size-m", optionGroupId: "og-coffee-size", name: "Size M", priceDelta: 0, sortOrder: 1 },
    { id: "ov-size-l", optionGroupId: "og-coffee-size", name: "Size L", priceDelta: 7000, sortOrder: 2 },
  ],
};

export const demoFloorPlan: FloorPlan = {
  areas: [
    { id: "area-ground", name: "Tầng trệt", sortOrder: 1 },
  ],
  tables: [
    { id: "tbl-b01", areaId: "area-ground", name: "B01", posX: 260, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 1, status: "empty" },
    { id: "tbl-b02", areaId: "area-ground", name: "B02", posX: 500, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 2, status: "empty" },
    { id: "tbl-b03", areaId: "area-ground", name: "B03", posX: 750, posY: 190, width: 126, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 3, status: "empty" },
    { id: "tbl-b04", areaId: "area-ground", name: "B04", posX: 1040, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 4, status: "empty" },
  ],
  decorItems: [],
};

// Nhân viên thu ngân mẫu (PIN demo) đi kèm bộ dữ liệu mẫu.
export const demoCashier = { id: "demo-emp-cashier", name: "Thu ngân demo", role: "cashier" as const, isActive: true };
export const demoCashierPin = "111111";

// Tập id của dữ liệu mẫu — dùng để xoá đúng phần demo, giữ lại data người dùng tự tạo.
export const demoSeedIds = {
  categories: demoMenuCatalog.categories.map((c) => c.id),
  menuItems: demoMenuCatalog.menuItems.map((i) => i.id),
  optionGroups: demoMenuCatalog.optionGroups.map((g) => g.id),
  optionValues: demoMenuCatalog.optionValues.map((v) => v.id),
  areas: demoFloorPlan.areas.map((a) => a.id),
  tables: demoFloorPlan.tables.map((t) => t.id),
  decorItems: demoFloorPlan.decorItems.map((d) => d.id),
  employees: [demoCashier.id],
};
