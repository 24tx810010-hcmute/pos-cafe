import type { DraftItem } from "./menuDraft";

const MENU_IMAGE_MAX_MB = 5;
const MAX_MENU_IMAGE_BYTES = MENU_IMAGE_MAX_MB * 1024 * 1024;
const MENU_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MENU_IMAGE_HELP_TEXT = `JPG, PNG hoặc WebP. Tối đa ${MENU_IMAGE_MAX_MB}MB.`;

export const revokePendingItemPreviews = (draftItems: DraftItem[]) => {
  for (const item of draftItems) {
    if (item.pendingImagePreviewUrl) {
      URL.revokeObjectURL(item.pendingImagePreviewUrl);
    }
  }
};

export const clearPendingImageFields = (item: DraftItem): DraftItem => ({
  ...item,
  pendingImageFile: null,
  pendingImagePreviewUrl: null,
});

export const getMenuImageError = (file: File): string | null => {
  if (!MENU_IMAGE_TYPES.has(file.type)) {
    return "Ảnh món chỉ hỗ trợ JPG, PNG hoặc WebP.";
  }

  if (file.size > MAX_MENU_IMAGE_BYTES) {
    return `Ảnh món tối đa ${MENU_IMAGE_MAX_MB}MB.`;
  }

  return null;
};
