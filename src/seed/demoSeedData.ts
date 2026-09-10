import type { FloorPlan, MenuCatalog } from "@/domain";

// Bộ dữ liệu mẫu (tuỳ chọn) khi tạo store có tick "Khởi tạo dữ liệu mẫu",
// hoặc khi bấm "Khởi tạo dữ liệu mẫu" trong Cài đặt. Giữ menu/floor gọn
// nhưng có đủ bàn và decor ảnh để demo luồng bán hàng + Floor Editor.
export const demoMenuCatalog: MenuCatalog = {
  categories: [
    { id: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Cà phê", sortOrder: 1 },
    { id: "1ebf92aa-cf30-4e0d-8279-2b6fe3f8fb54", name: "Trà & trà sữa", sortOrder: 2 },
  ],
  menuItems: [
    { id: "3e43bb8c-198f-443f-83ab-18696983edaa", categoryId: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Cà phê sữa", price: 29000, imageAssetKey: null, sortOrder: 1, isAvailable: true },
    { id: "aaa3b30e-131a-4435-889f-912b407a14dd", categoryId: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Bạc xỉu", price: 32000, imageAssetKey: null, sortOrder: 2, isAvailable: true },
    { id: "d50ff72b-d0bc-4832-8888-183c19f5a158", categoryId: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Latte", price: 45000, imageAssetKey: null, sortOrder: 3, isAvailable: true },
    { id: "95679b57-5004-46da-8c20-132ef7babf65", categoryId: "1ebf92aa-cf30-4e0d-8279-2b6fe3f8fb54", name: "Trà đào", price: 42000, imageAssetKey: null, sortOrder: 4, isAvailable: true },
    { id: "f6dec6d1-792d-4ccd-8892-86c3f3f550fc", categoryId: "1ebf92aa-cf30-4e0d-8279-2b6fe3f8fb54", name: "Trà sữa truyền thống", price: 39000, imageAssetKey: null, sortOrder: 5, isAvailable: true },
    { id: "23afb75f-a59c-417e-8a24-8c37d7845a8e", categoryId: "1ebf92aa-cf30-4e0d-8279-2b6fe3f8fb54", name: "Trà chanh", price: 29000, imageAssetKey: null, sortOrder: 6, isAvailable: true },
  ],
  // Nhóm tuỳ chọn dùng chung — gắn vào món qua menuItemOptionGroups.
  optionGroups: [
    { id: "054f9798-4ba4-49f3-8e40-8ca109eeb95e", name: "Size", selectType: "single", isRequired: false, sortOrder: 1 },
    { id: "7f7ac934-c745-413f-8920-40efad1aa761", name: "Topping", selectType: "multi", isRequired: false, sortOrder: 2 },
  ],
  optionValues: [
    { id: "a5f986a6-ea67-4dd3-866e-42a0be8a0497", optionGroupId: "054f9798-4ba4-49f3-8e40-8ca109eeb95e", name: "Size M", priceDelta: 0, sortOrder: 1 },
    { id: "62ca9453-5d44-47f4-8f85-a943d526348d", optionGroupId: "054f9798-4ba4-49f3-8e40-8ca109eeb95e", name: "Size L", priceDelta: 7000, sortOrder: 2 },
    { id: "dbbecac5-7b06-42c8-8a53-44e08e8d61c3", optionGroupId: "7f7ac934-c745-413f-8920-40efad1aa761", name: "Trân châu", priceDelta: 7000, sortOrder: 1 },
    { id: "f936dd2c-1be2-44bd-8e9a-cb1055995844", optionGroupId: "7f7ac934-c745-413f-8920-40efad1aa761", name: "Kem phô mai", priceDelta: 10000, sortOrder: 2 },
  ],
  menuItemOptionGroups: [
    { id: "f902f799-6379-44d8-882d-2a2abc7dd34c", menuItemId: "3e43bb8c-198f-443f-83ab-18696983edaa", optionGroupId: "054f9798-4ba4-49f3-8e40-8ca109eeb95e", sortOrder: 1 },
    { id: "b834bfab-5fae-4a77-8c29-d42ab32db58e", menuItemId: "aaa3b30e-131a-4435-889f-912b407a14dd", optionGroupId: "054f9798-4ba4-49f3-8e40-8ca109eeb95e", sortOrder: 1 },
    { id: "367f382a-2c93-4aa4-8328-132b2b565774", menuItemId: "f6dec6d1-792d-4ccd-8892-86c3f3f550fc", optionGroupId: "7f7ac934-c745-413f-8920-40efad1aa761", sortOrder: 1 },
  ],
};

export const demoFloorPlan: FloorPlan = {
  areas: [
    { id: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "Tầng trệt", sortOrder: 1 },
  ],
  tables: [
    { id: "7b035353-73d6-44bc-8ec4-1ab9951f7a58", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B01", backgroundAssetKey: null, posX: 260, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 1, status: "empty" },
    { id: "a254abd0-b883-4d5c-85c1-89f660409e02", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B02", backgroundAssetKey: null, posX: 500, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 2, status: "empty" },
    { id: "a58f6e30-c37e-4869-846e-7f98e0cbce1f", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B03", backgroundAssetKey: null, posX: 750, posY: 190, width: 126, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 3, status: "empty" },
    { id: "4d6d11e1-7d46-41f0-8c1e-9dd7bf4c5041", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B04", backgroundAssetKey: null, posX: 1040, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 4, status: "empty" },
  ],
  decorItems: [
    { id: "2e6cd27d-0476-4d7b-84d8-d3889669337d", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "wall", label: "Tường gạch", assetKey: "/floor-assets/walls/img-color-cell3.webp", posX: 800, posY: 40, width: 1500, height: 36, rotation: 0, zIndex: 0, isLocked: true },
    { id: "ac030d47-f87b-4d2b-8017-d8a71259c71e", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "image", label: "Quầy pha chế", assetKey: "/floor-assets/decor/deco-fixtures-03.png", posX: 1370, posY: 300, width: 220, height: 160, rotation: 0, zIndex: 1, isLocked: true },
    { id: "f7d63df4-e1f5-4435-8ded-8f0865dfd95d", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "image", label: "Lối vào", assetKey: "/floor-assets/decor/deco-other-15.png", posX: 1480, posY: 88, width: 110, height: 70, rotation: 0, zIndex: 1, isLocked: true },
    { id: "e7ae25fd-6e51-432a-85aa-6c3829e5b9f8", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "plant", label: "Cây lá xanh", assetKey: "/floor-assets/decor/deco-tree-05.png", posX: 220, posY: 700, width: 120, height: 120, rotation: 0, zIndex: 1, isLocked: false },
    { id: "26fbb5ee-9471-4600-8c74-073689cef849", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "image", label: "Ghế thư giãn", assetKey: "/floor-assets/decor/deco-seat-08.png", posX: 500, posY: 620, width: 100, height: 130, rotation: 0, zIndex: 1, isLocked: false },
    { id: "f8004f3e-4f1b-47a8-8941-3036162edbb6", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "image", label: "Quầy đón khách", assetKey: "/floor-assets/decor/deco-other-10.png", posX: 800, posY: 720, width: 210, height: 70, rotation: 0, zIndex: 1, isLocked: true },
    { id: "23d7bea8-0f54-4ec3-85b7-567ed09a5ee0", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "image", label: "Bàn bi-a", assetKey: "/floor-assets/decor/deco-other-01.png", posX: 1200, posY: 650, width: 210, height: 130, rotation: 0, zIndex: 1, isLocked: false },
  ],
};

// Nhân viên thu ngân mẫu (PIN demo) đi kèm bộ dữ liệu mẫu.
export const demoCashier = { id: "70040500-c9b4-4648-8be0-3e41fcad337d", name: "Thu ngân demo", role: "cashier" as const, isActive: true };
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
