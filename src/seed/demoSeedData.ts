import type { FloorPlan, MenuCatalog } from "@/domain";

// Bộ dữ liệu mẫu (tuỳ chọn) khi tạo store có tick "Khởi tạo dữ liệu mẫu",
// hoặc khi bấm "Khởi tạo dữ liệu mẫu" trong Cài đặt. Giữ menu/floor gọn
// nhưng có đủ bàn và decor ảnh để demo luồng bán hàng + Floor Editor.
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
  // Nhóm tuỳ chọn dùng chung — gắn vào món qua menuItemOptionGroups.
  optionGroups: [
    { id: "og-coffee-size", name: "Size", selectType: "single", isRequired: false, sortOrder: 1 },
    { id: "og-tea-topping", name: "Topping", selectType: "multi", isRequired: false, sortOrder: 2 },
  ],
  optionValues: [
    { id: "ov-size-m", optionGroupId: "og-coffee-size", name: "Size M", priceDelta: 0, sortOrder: 1 },
    { id: "ov-size-l", optionGroupId: "og-coffee-size", name: "Size L", priceDelta: 7000, sortOrder: 2 },
    { id: "ov-tran-chau", optionGroupId: "og-tea-topping", name: "Trân châu", priceDelta: 7000, sortOrder: 1 },
    { id: "ov-kem-pho-mai", optionGroupId: "og-tea-topping", name: "Kem phô mai", priceDelta: 10000, sortOrder: 2 },
  ],
  menuItemOptionGroups: [
    { id: "miog-size-ca-phe-sua", menuItemId: "mi-ca-phe-sua", optionGroupId: "og-coffee-size", sortOrder: 1 },
    { id: "miog-size-bac-xiu", menuItemId: "mi-bac-xiu", optionGroupId: "og-coffee-size", sortOrder: 1 },
    { id: "miog-topping-tra-sua", menuItemId: "mi-tra-sua-truyen-thong", optionGroupId: "og-tea-topping", sortOrder: 1 },
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
  decorItems: [
    { id: "decor-wall-ground", areaId: "area-ground", kind: "wall", label: "Tường gạch", assetKey: "/floor-assets/walls/img-color-cell3.webp", posX: 800, posY: 40, width: 1500, height: 36, rotation: 0, zIndex: 0, isLocked: true },
    { id: "decor-counter", areaId: "area-ground", kind: "image", label: "Quầy pha chế", assetKey: "/floor-assets/decor/deco-fixtures-03.png", posX: 1370, posY: 300, width: 220, height: 160, rotation: 0, zIndex: 1, isLocked: true },
    { id: "decor-door", areaId: "area-ground", kind: "image", label: "Lối vào", assetKey: "/floor-assets/decor/deco-other-15.png", posX: 1480, posY: 88, width: 110, height: 70, rotation: 0, zIndex: 1, isLocked: true },
    { id: "decor-plant", areaId: "area-ground", kind: "plant", label: "Cây lá xanh", assetKey: "/floor-assets/decor/deco-tree-05.png", posX: 220, posY: 700, width: 120, height: 120, rotation: 0, zIndex: 1, isLocked: false },
    { id: "decor-seat-ground", areaId: "area-ground", kind: "image", label: "Ghế thư giãn", assetKey: "/floor-assets/decor/deco-seat-08.png", posX: 500, posY: 620, width: 100, height: 130, rotation: 0, zIndex: 1, isLocked: false },
    { id: "decor-reception-ground", areaId: "area-ground", kind: "image", label: "Quầy đón khách", assetKey: "/floor-assets/decor/deco-other-10.png", posX: 800, posY: 720, width: 210, height: 70, rotation: 0, zIndex: 1, isLocked: true },
    { id: "decor-game-ground", areaId: "area-ground", kind: "image", label: "Bàn bi-a", assetKey: "/floor-assets/decor/deco-other-01.png", posX: 1200, posY: 650, width: 210, height: 130, rotation: 0, zIndex: 1, isLocked: false },
  ],
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
  menuItemOptionGroups: demoMenuCatalog.menuItemOptionGroups.map((l) => l.id),
  areas: demoFloorPlan.areas.map((a) => a.id),
  tables: demoFloorPlan.tables.map((t) => t.id),
  decorItems: demoFloorPlan.decorItems.map((d) => d.id),
  employees: [demoCashier.id],
};
