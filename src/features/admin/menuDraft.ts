export interface DraftCategory {
  id: string;
  name: string;
  sortOrder: number;
  deleted?: boolean;
  isNew?: boolean;
}
export interface DraftItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  imageAssetKey: string | null;
  sortOrder: number;
  isAvailable: boolean;
  pendingImageFile?: File | null;
  pendingImagePreviewUrl?: string | null;
  deleted?: boolean;
  isNew?: boolean;
}
// Nhóm tuỳ chọn dùng CHUNG cho mọi món (không gắn cứng vào 1 món).
export interface DraftGroup {
  id: string;
  name: string;
  selectType: "single" | "multi";
  isRequired: boolean;
  sortOrder: number;
  deleted?: boolean;
  isNew?: boolean;
}
export interface DraftValue {
  id: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  deleted?: boolean;
  isNew?: boolean;
}
// Liên kết món <-> nhóm tuỳ chọn dùng chung (món nào "tick" dùng nhóm nào).
export interface DraftLink {
  id: string;
  menuItemId: string;
  optionGroupId: string;
  sortOrder: number;
  deleted?: boolean;
  isNew?: boolean;
}
