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
export interface DraftGroup {
  id: string;
  menuItemId: string;
  name: string;
  selectType: "single" | "multi";
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
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
