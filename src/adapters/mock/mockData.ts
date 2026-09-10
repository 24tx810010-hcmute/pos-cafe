import type {
  Employee,
  FloorPlan,
  MenuCatalog,
  OrderDetail,
  StoreSettings,
} from "@/domain";

export const mockStoreId = "e572ea5f-9adf-493c-8d84-dca3cd86e1eb";

export const mockEmployees: Employee[] = [
  { id: "6b7bd350-7db2-4160-8471-cca2668c070d", name: "Quản lý", role: "admin", isActive: true },
  { id: "22828322-623b-42e7-8a28-a2bdf367c364", name: "Thu ngân 1", role: "cashier", isActive: true },
  { id: "7f2bd35d-e96c-4d7b-8e5c-b09a075d9fc6", name: "Thu ngân 2", role: "cashier", isActive: true },
  { id: "b1885ef9-c9c0-4a02-8757-875a44e8c814", name: "Bếp", role: "kitchen", isActive: true },
];

export const mockPins: Record<string, string> = {
  "6b7bd350-7db2-4160-8471-cca2668c070d": "123456",
  "22828322-623b-42e7-8a28-a2bdf367c364": "111111",
  "7f2bd35d-e96c-4d7b-8e5c-b09a075d9fc6": "111111",
  "b1885ef9-c9c0-4a02-8757-875a44e8c814": "222222",
};

export const mockSettings: StoreSettings = {
  storeId: mockStoreId,
  displayName: "POS Demo",
  address: "01 Demo Street",
  currency: "VND",
  timezone: "Asia/Saigon",
  billFooter: "Cảm ơn quý khách và hẹn gặp lại.",
};

// Bộ fixture đầy đủ cho mock/test (giàu hơn bộ demo seed gọn của sản phẩm).
// mockOrders bên dưới tham chiếu các id món/bàn trong đây nên giữ self-contained.
export const mockMenuCatalog: MenuCatalog = {
  categories: [
    { id: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Cà phê", sortOrder: 1 },
    { id: "1ebf92aa-cf30-4e0d-8279-2b6fe3f8fb54", name: "Trà & trà sữa", sortOrder: 2 },
    { id: "0e2b2b01-1e52-436b-8130-428e82585276", name: "Đá xay", sortOrder: 3 },
    { id: "d8e03f30-1979-44b1-8fae-dc3cf6756680", name: "Bánh/snack", sortOrder: 4 },
  ],
  menuItems: [
    { id: "3e43bb8c-198f-443f-83ab-18696983edaa", categoryId: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Cà phê sữa", price: 29000, imageAssetKey: null, sortOrder: 1, isAvailable: true },
    { id: "aaa3b30e-131a-4435-889f-912b407a14dd", categoryId: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Bạc xỉu", price: 32000, imageAssetKey: null, sortOrder: 2, isAvailable: true },
    { id: "80cfbd5a-a538-4da6-888d-2f732b7b8e2d", categoryId: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Americano", price: 35000, imageAssetKey: null, sortOrder: 3, isAvailable: true },
    { id: "d50ff72b-d0bc-4832-8888-183c19f5a158", categoryId: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Latte", price: 45000, imageAssetKey: null, sortOrder: 4, isAvailable: true },
    { id: "9491e262-856d-4408-82b7-c9d7f7ac3f27", categoryId: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Cold brew", price: 49000, imageAssetKey: null, sortOrder: 5, isAvailable: true },
    { id: "230c8e39-02a6-4ec0-8f6e-a5643ad96d5c", categoryId: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Cà phê muối", price: 39000, imageAssetKey: null, sortOrder: 6, isAvailable: true },
    { id: "95679b57-5004-46da-8c20-132ef7babf65", categoryId: "1ebf92aa-cf30-4e0d-8279-2b6fe3f8fb54", name: "Trà đào", price: 42000, imageAssetKey: null, sortOrder: 7, isAvailable: true },
    { id: "9f374929-c16d-46b4-8ac8-4ae556823131", categoryId: "1ebf92aa-cf30-4e0d-8279-2b6fe3f8fb54", name: "Trà vải", price: 42000, imageAssetKey: null, sortOrder: 8, isAvailable: true },
    { id: "f6dec6d1-792d-4ccd-8892-86c3f3f550fc", categoryId: "1ebf92aa-cf30-4e0d-8279-2b6fe3f8fb54", name: "Trà sữa truyền thống", price: 39000, imageAssetKey: null, sortOrder: 9, isAvailable: true },
    { id: "23afb75f-a59c-417e-8a24-8c37d7845a8e", categoryId: "1ebf92aa-cf30-4e0d-8279-2b6fe3f8fb54", name: "Trà chanh", price: 29000, imageAssetKey: null, sortOrder: 10, isAvailable: true },
    { id: "e8b9b4bb-d09b-46a0-8340-01047e8394ee", categoryId: "1ebf92aa-cf30-4e0d-8279-2b6fe3f8fb54", name: "Matcha latte", price: 49000, imageAssetKey: null, sortOrder: 11, isAvailable: true },
    { id: "ad59de0c-8f30-4b81-824c-f4cd6a95d5c7", categoryId: "1ebf92aa-cf30-4e0d-8279-2b6fe3f8fb54", name: "Sữa tươi trân châu", price: 45000, imageAssetKey: null, sortOrder: 12, isAvailable: true },
    { id: "056821d1-a52e-4c33-8687-3244e9e2d4ba", categoryId: "0e2b2b01-1e52-436b-8130-428e82585276", name: "Cookie đá xay", price: 55000, imageAssetKey: null, sortOrder: 13, isAvailable: true },
    { id: "c137014a-a38e-434d-8a54-979b9b16f30d", categoryId: "0e2b2b01-1e52-436b-8130-428e82585276", name: "Matcha đá xay", price: 59000, imageAssetKey: null, sortOrder: 14, isAvailable: true },
    { id: "643425a6-e89e-41e0-857b-a1e61879a999", categoryId: "0e2b2b01-1e52-436b-8130-428e82585276", name: "Ca cao đá xay", price: 52000, imageAssetKey: null, sortOrder: 15, isAvailable: true },
    { id: "20e56db0-b610-4861-81fb-ead8b0887753", categoryId: "0e2b2b01-1e52-436b-8130-428e82585276", name: "Sinh tố bơ", price: 49000, imageAssetKey: null, sortOrder: 16, isAvailable: true },
    { id: "65e39379-01be-4164-8caa-30c8aad1938b", categoryId: "0e2b2b01-1e52-436b-8130-428e82585276", name: "Nước ép cam", price: 45000, imageAssetKey: null, sortOrder: 17, isAvailable: true },
    { id: "73a45672-cf7f-4a14-8c8a-5d33ea33a490", categoryId: "0e2b2b01-1e52-436b-8130-428e82585276", name: "Nước ép dưa hấu", price: 39000, imageAssetKey: null, sortOrder: 18, isAvailable: true },
    { id: "91bbd9ab-1397-4275-8e49-620b70f45b55", categoryId: "d8e03f30-1979-44b1-8fae-dc3cf6756680", name: "Croissant", price: 35000, imageAssetKey: null, sortOrder: 19, isAvailable: true },
    { id: "788e588c-8e10-4ae3-8f4b-b955b30ce0e3", categoryId: "d8e03f30-1979-44b1-8fae-dc3cf6756680", name: "Bánh mì que", price: 25000, imageAssetKey: null, sortOrder: 20, isAvailable: true },
    { id: "c2c2f420-5014-4e5c-8107-b1119ca6205a", categoryId: "d8e03f30-1979-44b1-8fae-dc3cf6756680", name: "Tiramisu", price: 45000, imageAssetKey: null, sortOrder: 21, isAvailable: true },
    { id: "f36d10b5-9a8b-4de0-85e9-985b948a089c", categoryId: "d8e03f30-1979-44b1-8fae-dc3cf6756680", name: "Khoai tây chiên", price: 39000, imageAssetKey: null, sortOrder: 22, isAvailable: true },
  ],
  // Nhóm tuỳ chọn dùng chung — không gắn cứng vào món, liên kết qua menuItemOptionGroups.
  optionGroups: [
    { id: "054f9798-4ba4-49f3-8e40-8ca109eeb95e", name: "Size", selectType: "single", isRequired: false, sortOrder: 1 },
    { id: "619801cd-dc48-48ea-872c-20f644d95acb", name: "Đá", selectType: "single", isRequired: false, sortOrder: 2 },
    { id: "a3ba3670-0f1d-44e7-8cc9-e10ec29acf0a", name: "Đường", selectType: "single", isRequired: false, sortOrder: 3 },
    { id: "7f7ac934-c745-413f-8920-40efad1aa761", name: "Topping", selectType: "multi", isRequired: false, sortOrder: 4 },
    { id: "8048edd4-a555-4cea-874d-40beb45b21e3", name: "Thêm shot", selectType: "multi", isRequired: false, sortOrder: 5 },
  ],
  optionValues: [
    { id: "a5f986a6-ea67-4dd3-866e-42a0be8a0497", optionGroupId: "054f9798-4ba4-49f3-8e40-8ca109eeb95e", name: "Size M", priceDelta: 0, sortOrder: 1 },
    { id: "62ca9453-5d44-47f4-8f85-a943d526348d", optionGroupId: "054f9798-4ba4-49f3-8e40-8ca109eeb95e", name: "Size L", priceDelta: 7000, sortOrder: 2 },
    { id: "9d64eca6-2712-484e-8962-848c27c41793", optionGroupId: "619801cd-dc48-48ea-872c-20f644d95acb", name: "Ít đá", priceDelta: 0, sortOrder: 1 },
    { id: "24a99344-1a3b-46e2-8ae7-16e2fc80f51b", optionGroupId: "619801cd-dc48-48ea-872c-20f644d95acb", name: "Không đá", priceDelta: 0, sortOrder: 2 },
    { id: "9896acae-6da1-47d9-8921-5ec660e2416e", optionGroupId: "a3ba3670-0f1d-44e7-8cc9-e10ec29acf0a", name: "50% đường", priceDelta: 0, sortOrder: 1 },
    { id: "ac7d02fc-1759-4922-8088-5d93b17396a4", optionGroupId: "a3ba3670-0f1d-44e7-8cc9-e10ec29acf0a", name: "100% đường", priceDelta: 0, sortOrder: 2 },
    { id: "dbbecac5-7b06-42c8-8a53-44e08e8d61c3", optionGroupId: "7f7ac934-c745-413f-8920-40efad1aa761", name: "Trân châu", priceDelta: 7000, sortOrder: 1 },
    { id: "f936dd2c-1be2-44bd-8e9a-cb1055995844", optionGroupId: "7f7ac934-c745-413f-8920-40efad1aa761", name: "Kem phô mai", priceDelta: 10000, sortOrder: 2 },
    { id: "a4b5f811-749a-4634-8def-b0cb4b080a05", optionGroupId: "8048edd4-a555-4cea-874d-40beb45b21e3", name: "Thêm shot", priceDelta: 10000, sortOrder: 1 },
  ],
  menuItemOptionGroups: [
    // Size dùng chung cho nhiều món cà phê.
    { id: "f902f799-6379-44d8-882d-2a2abc7dd34c", menuItemId: "3e43bb8c-198f-443f-83ab-18696983edaa", optionGroupId: "054f9798-4ba4-49f3-8e40-8ca109eeb95e", sortOrder: 1 },
    { id: "803bdcba-92fe-4816-8041-60cc0221e4d5", menuItemId: "3e43bb8c-198f-443f-83ab-18696983edaa", optionGroupId: "619801cd-dc48-48ea-872c-20f644d95acb", sortOrder: 2 },
    { id: "b834bfab-5fae-4a77-8c29-d42ab32db58e", menuItemId: "aaa3b30e-131a-4435-889f-912b407a14dd", optionGroupId: "054f9798-4ba4-49f3-8e40-8ca109eeb95e", sortOrder: 1 },
    { id: "b17c0c7f-e7ba-4a49-87af-99d05c37422a", menuItemId: "aaa3b30e-131a-4435-889f-912b407a14dd", optionGroupId: "a3ba3670-0f1d-44e7-8cc9-e10ec29acf0a", sortOrder: 2 },
    { id: "d9d76bca-5990-4d9c-8287-6e8c9691b438", menuItemId: "d50ff72b-d0bc-4832-8888-183c19f5a158", optionGroupId: "054f9798-4ba4-49f3-8e40-8ca109eeb95e", sortOrder: 1 },
    { id: "55292e6a-b7b2-448f-83b5-bf0dcc1fa12d", menuItemId: "d50ff72b-d0bc-4832-8888-183c19f5a158", optionGroupId: "8048edd4-a555-4cea-874d-40beb45b21e3", sortOrder: 2 },
    { id: "367f382a-2c93-4aa4-8328-132b2b565774", menuItemId: "f6dec6d1-792d-4ccd-8892-86c3f3f550fc", optionGroupId: "7f7ac934-c745-413f-8920-40efad1aa761", sortOrder: 1 },
    { id: "3c8bd73a-0214-47b3-86c7-62421748882f", menuItemId: "ad59de0c-8f30-4b81-824c-f4cd6a95d5c7", optionGroupId: "7f7ac934-c745-413f-8920-40efad1aa761", sortOrder: 1 },
  ],
};

export const mockFloorPlan: FloorPlan = {
  areas: [
    { id: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "Tầng trệt", sortOrder: 1 },
    { id: "ba1df31a-34f3-4ed7-8808-207160e8ae73", name: "Lầu 1", sortOrder: 2 },
  ],
  tables: [
    { id: "7b035353-73d6-44bc-8ec4-1ab9951f7a58", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B01", backgroundAssetKey: null, posX: 260, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 1, status: "empty" },
    { id: "a254abd0-b883-4d5c-85c1-89f660409e02", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B02", backgroundAssetKey: "/floor-assets/tables/table-bg-02.png", posX: 500, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 2, status: "occupied" },
    { id: "a58f6e30-c37e-4869-846e-7f98e0cbce1f", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B03", backgroundAssetKey: "/floor-assets/tables/table-bg-03.png", posX: 750, posY: 190, width: 126, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 3, status: "occupied" },
    { id: "4d6d11e1-7d46-41f0-8c1e-9dd7bf4c5041", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B04", backgroundAssetKey: "/floor-assets/tables/table-bg-04.png", posX: 1040, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 4, status: "empty" },
    { id: "e3044e3c-d111-4134-8648-c7df270f770b", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B05", backgroundAssetKey: "/floor-assets/tables/table-bg-05.png", posX: 300, posY: 520, width: 126, height: 84, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 5, status: "occupied" },
    { id: "0a5f0354-fea8-477e-8059-34710ec77469", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B06", backgroundAssetKey: "/floor-assets/tables/table-bg-06.png", posX: 600, posY: 520, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 6, status: "empty" },
    { id: "dd9faafb-7a12-4b21-8f4a-10a36eb7b941", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B07", backgroundAssetKey: "/floor-assets/tables/table-bg-07.png", posX: 880, posY: 520, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 7, status: "empty" },
    { id: "5d2847f6-adfe-4594-8673-a8375f27c148", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", name: "B08", backgroundAssetKey: "/floor-assets/tables/table-bg-08.png", posX: 1180, posY: 520, width: 126, height: 84, shape: "rectangle", rotation: 0, seats: 6, sortOrder: 8, status: "occupied" },
    { id: "4b64e07b-e0a5-4a3a-8c22-0ee265c85631", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", name: "L01", backgroundAssetKey: "/floor-assets/tables/table-bg-09.png", posX: 260, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 1, status: "empty" },
    { id: "6ccddd8e-d318-4deb-8f88-41472d693f3d", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", name: "L02", backgroundAssetKey: "/floor-assets/tables/table-bg-10.png", posX: 500, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 2, status: "empty" },
    { id: "b8eeaf3c-0af9-41d4-8ef2-f3789f37ac94", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", name: "L03", backgroundAssetKey: "/floor-assets/tables/table-bg-11.png", posX: 750, posY: 190, width: 126, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 3, status: "empty" },
    { id: "958c597a-363d-4ecc-8746-f0b33c62479e", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", name: "L04", backgroundAssetKey: null, posX: 1040, posY: 190, width: 120, height: 76, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 4, status: "empty" },
    { id: "59b1faa6-bab2-4cc1-8e81-19a806bbdfae", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", name: "L05", backgroundAssetKey: "/floor-assets/tables/table-bg-01.png", posX: 460, posY: 500, width: 126, height: 84, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 5, status: "empty" },
    { id: "fc8995ee-4028-48d6-84d1-aa5107865fa5", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", name: "L06", backgroundAssetKey: null, posX: 760, posY: 500, width: 126, height: 84, shape: "rectangle", rotation: 0, seats: 4, sortOrder: 6, status: "empty" },
  ],
  decorItems: [
    { id: "2e6cd27d-0476-4d7b-84d8-d3889669337d", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "wall", label: "Tường gạch", assetKey: "/floor-assets/walls/img-color-cell3.webp", posX: 800, posY: 40, width: 1500, height: 36, rotation: 0, zIndex: 0, isLocked: true },
    { id: "ac030d47-f87b-4d2b-8017-d8a71259c71e", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "image", label: "Quầy pha chế", assetKey: "/floor-assets/decor/deco-fixtures-03.png", posX: 1370, posY: 330, width: 220, height: 160, rotation: 0, zIndex: 1, isLocked: true },
    { id: "f7d63df4-e1f5-4435-8ded-8f0865dfd95d", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "image", label: "Lối vào", assetKey: "/floor-assets/decor/deco-other-15.png", posX: 1480, posY: 88, width: 110, height: 70, rotation: 0, zIndex: 1, isLocked: true },
    { id: "e7ae25fd-6e51-432a-85aa-6c3829e5b9f8", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "plant", label: "Cây lá xanh", assetKey: "/floor-assets/decor/deco-tree-05.png", posX: 300, posY: 760, width: 120, height: 120, rotation: 0, zIndex: 1, isLocked: false },
    { id: "26fbb5ee-9471-4600-8c74-073689cef849", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "image", label: "Ghế thư giãn", assetKey: "/floor-assets/decor/deco-seat-08.png", posX: 560, posY: 760, width: 100, height: 130, rotation: 0, zIndex: 1, isLocked: false },
    { id: "f8004f3e-4f1b-47a8-8941-3036162edbb6", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "image", label: "Quầy đón khách", assetKey: "/floor-assets/decor/deco-other-10.png", posX: 850, posY: 760, width: 210, height: 70, rotation: 0, zIndex: 1, isLocked: true },
    { id: "23d7bea8-0f54-4ec3-85b7-567ed09a5ee0", areaId: "045eee43-5266-442f-8e87-978c1cc30d0c", kind: "image", label: "Bàn bi-a", assetKey: "/floor-assets/decor/deco-other-01.png", posX: 1280, posY: 760, width: 210, height: 130, rotation: 0, zIndex: 1, isLocked: false },
    { id: "75a6ed69-ae58-42eb-85e5-75fcb6e664e9", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", kind: "wall", label: "Tường bê tông", assetKey: "/floor-assets/walls/img-color-cell7.webp", posX: 800, posY: 40, width: 1500, height: 36, rotation: 0, zIndex: 0, isLocked: true },
    { id: "399dfce4-c95d-42ad-8d19-59e2cb45d8a7", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", kind: "plant", label: "Bụi hoa", assetKey: "/floor-assets/decor/deco-tree-20.png", posX: 180, posY: 760, width: 120, height: 120, rotation: 0, zIndex: 1, isLocked: false },
    { id: "77c6961a-f8b5-45b3-80a6-42322ad3c2fc", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", kind: "image", label: "Sofa", assetKey: "/floor-assets/decor/deco-seat-21.png", posX: 520, posY: 760, width: 180, height: 110, rotation: 0, zIndex: 1, isLocked: false },
    { id: "ba3182bc-6c0b-4716-891c-c1e4eb00901d", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", kind: "image", label: "Quầy bar", assetKey: "/floor-assets/decor/deco-fixtures-18.png", posX: 1030, posY: 740, width: 240, height: 150, rotation: 0, zIndex: 1, isLocked: true },
    { id: "6c03dbc6-6827-43b9-8d81-818aa83a081e", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", kind: "image", label: "Bàn bi-a", assetKey: "/floor-assets/decor/deco-other-02.png", posX: 1370, posY: 500, width: 220, height: 130, rotation: 0, zIndex: 1, isLocked: false },
    { id: "1288048f-e6b9-4b3b-8489-4db996816ce6", areaId: "ba1df31a-34f3-4ed7-8808-207160e8ae73", kind: "image", label: "Lối cầu thang", assetKey: "/floor-assets/decor/deco-other-15.png", posX: 1480, posY: 110, width: 110, height: 70, rotation: 180, zIndex: 1, isLocked: true },
  ],
};

export const mockOpenOrders: OrderDetail[] = [
  {
    id: "7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c",
    tableId: "a254abd0-b883-4d5c-85c1-89f660409e02",
    orderNo: 24,
    businessDate: "2026-06-11",
    status: "open",
    total: 125000,
    lockVersion: 3,
    orderType: "dine_in",
    paidAt: null,
    payment: null,
    voidedAt: null,
    voidedByEmployeeId: null,
    voidReasonCode: null,
    voidReasonNote: null,
    items: [
      {
        id: "3c00b7a3-016f-45a3-8f96-664314c26b4a",
        menuItemId: "3e43bb8c-198f-443f-83ab-18696983edaa",
        itemName: "Cà phê sữa",
        quantity: 2,
        unitPrice: 29000,
        note: "Ít đá",
        options: [{ id: "a23319a4-5efa-4e59-8207-57e881d5d631", optionValueId: "a5f986a6-ea67-4dd3-866e-42a0be8a0497", optionName: "Size M", priceDelta: 0, quantity: 1 }],
      },
      {
        id: "64a0c267-a3e2-47ca-878b-c5b47c7452e5",
        menuItemId: "aaa3b30e-131a-4435-889f-912b407a14dd",
        itemName: "Bạc xỉu",
        quantity: 1,
        unitPrice: 32000,
        note: null,
        options: [{ id: "e2ed6a92-df31-4c1b-87a4-7dc5e3d8a9c2", optionValueId: "9896acae-6da1-47d9-8921-5ec660e2416e", optionName: "50% đường", priceDelta: 0, quantity: 1 }],
      },
      {
        id: "923bfabf-cffd-4d90-84a8-50bd47b0fd09",
        menuItemId: "91bbd9ab-1397-4275-8e49-620b70f45b55",
        itemName: "Croissant",
        quantity: 1,
        unitPrice: 35000,
        note: "Hâm nóng",
        options: [],
      },
    ],
  },
  {
    id: "3bb9652e-e153-45dd-8f41-2d41a1f7b04b",
    tableId: "e3044e3c-d111-4134-8648-c7df270f770b",
    orderNo: 25,
    businessDate: "2026-06-11",
    status: "open",
    total: 86000,
    lockVersion: 1,
    orderType: "dine_in",
    paidAt: null,
    payment: null,
    voidedAt: null,
    voidedByEmployeeId: null,
    voidReasonCode: null,
    voidReasonNote: null,
    items: [
      { id: "f8c99436-ac4f-49df-8c27-305d7699a4fd", menuItemId: "95679b57-5004-46da-8c20-132ef7babf65", itemName: "Trà đào", quantity: 1, unitPrice: 42000, note: null, options: [] },
      { id: "34817e53-841a-4845-8b69-ca1b8b76423a", menuItemId: "230c8e39-02a6-4ec0-8f6e-a5643ad96d5c", itemName: "Cà phê muối", quantity: 1, unitPrice: 39000, note: null, options: [] },
      { id: "a785e6b1-6080-4f8e-8f62-d5a2ae2fa22a", menuItemId: "9be2c20d-111c-4e13-8037-81ea0952eb98", itemName: "Topping", quantity: 1, unitPrice: 5000, note: null, options: [] },
    ],
  },
  {
    id: "86b29e38-e02e-4e9d-877a-5cebdd394c1d",
    tableId: null,
    orderNo: 26,
    businessDate: "2026-06-11",
    status: "open",
    total: 84000,
    lockVersion: 2,
    orderType: "takeaway",
    paidAt: null,
    payment: null,
    voidedAt: null,
    voidedByEmployeeId: null,
    voidReasonCode: null,
    voidReasonNote: null,
    items: [
      { id: "1781e766-4c91-4f3a-8d39-a3f3dc555fd0", menuItemId: "95679b57-5004-46da-8c20-132ef7babf65", itemName: "Trà đào", quantity: 1, unitPrice: 42000, note: null, options: [] },
      { id: "1d3d305d-249d-4dfa-8621-1a640143fb92", menuItemId: "9f374929-c16d-46b4-8ac8-4ae556823131", itemName: "Trà vải", quantity: 1, unitPrice: 42000, note: "Ít đá", options: [] },
    ],
  },
];

export const mockPaidOrders: OrderDetail[] = [
  {
    id: "3f6c6266-12b8-4f8b-8564-44d00d9210f8",
    tableId: "4b64e07b-e0a5-4a3a-8c22-0ee265c85631",
    orderNo: 23,
    businessDate: "2026-06-11",
    status: "paid",
    total: 77000,
    lockVersion: 2,
    orderType: "dine_in",
    paidAt: "2026-06-11T09:15:00.000Z",
    payment: {
      id: "04d8cac0-c930-4743-8b04-10be9b45417b",
      employeeId: "22828322-623b-42e7-8a28-a2bdf367c364",
      method: "cash",
      amount: 77000,
      receivedAmount: 100000,
      changeAmount: 23000,
      paidAt: "2026-06-11T09:15:00.000Z",
    },
    voidedAt: null,
    voidedByEmployeeId: null,
    voidReasonCode: null,
    voidReasonNote: null,
    items: [
      {
        id: "b00a9ecf-4da9-45f9-89ed-11570400cfea",
        menuItemId: "d50ff72b-d0bc-4832-8888-183c19f5a158",
        itemName: "Latte",
        quantity: 1,
        unitPrice: 45000,
        note: null,
        options: [],
      },
      {
        id: "c34ac076-3bdb-4e37-8a85-aadc2d748732",
        menuItemId: "aaa3b30e-131a-4435-889f-912b407a14dd",
        itemName: "Bạc xỉu",
        quantity: 1,
        unitPrice: 32000,
        note: null,
        options: [{ id: "46033640-1f83-4dc4-8414-9bdd6bfd5c8a", optionValueId: "9896acae-6da1-47d9-8921-5ec660e2416e", optionName: "50% đường", priceDelta: 0, quantity: 1 }],
      },
    ],
  },
];

export const mockOrders: OrderDetail[] = [...mockOpenOrders, ...mockPaidOrders];

// Blank store: chỉ có 1 admin, không menu/floor/order. Dùng cho createMockState().
export const mockAdminEmployee: Employee = { id: "6b7bd350-7db2-4160-8471-cca2668c070d", name: "Quản lý", role: "admin", isActive: true };
export const mockAdminPin = "123456";
export const emptyMenuCatalog: MenuCatalog = { categories: [], menuItems: [], optionGroups: [], optionValues: [], menuItemOptionGroups: [] };
export const emptyFloorPlan: FloorPlan = { areas: [], tables: [], decorItems: [] };
export const blankSettings: StoreSettings = {
  storeId: mockStoreId,
  displayName: "POS Demo",
  address: "",
  currency: "VND",
  timezone: "Asia/Saigon",
  billFooter: "",
};
