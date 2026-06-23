import { AppError } from "@/core/appError";
import type { IMenuImagePort, MenuItemImageUploadInput, MenuItemImageUploadResult } from "@/ports";
import { throwIfError } from "./errors";
import { requireStoreId, type SupabaseAnyClient } from "./repoShared";

const MENU_ITEM_IMAGES_BUCKET = "menu-item-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const extensionForMime = (mimeType: string): string => {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "bin";
};

const toStoragePath = (assetKey: string): string =>
  assetKey.startsWith(`${MENU_ITEM_IMAGES_BUCKET}/`)
    ? assetKey.slice(MENU_ITEM_IMAGES_BUCKET.length + 1)
    : assetKey;

const validateImageFile = (file: File): void => {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new AppError("UNKNOWN", "Ảnh món chỉ hỗ trợ JPG, PNG hoặc WebP.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new AppError("UNKNOWN", "Ảnh món tối đa 5MB.");
  }
};

export class SupabaseMenuImagePort implements IMenuImagePort {
  constructor(private readonly client: SupabaseAnyClient) {}

  async uploadMenuItemImage(input: MenuItemImageUploadInput): Promise<MenuItemImageUploadResult> {
    validateImageFile(input.file);

    const storeId = await requireStoreId(this.client);
    const path = `${storeId}/menu-items/${input.itemId}/${crypto.randomUUID()}.${extensionForMime(input.file.type)}`;
    const { error } = await this.client.storage
      .from(MENU_ITEM_IMAGES_BUCKET)
      .upload(path, input.file, {
        cacheControl: "3600",
        contentType: input.file.type,
        upsert: false,
      });

    throwIfError(error);

    const assetKey = `${MENU_ITEM_IMAGES_BUCKET}/${path}`;
    return {
      assetKey,
      publicUrl: this.getImageUrl(assetKey) ?? "",
    };
  }

  async deleteMenuItemImage(assetKey: string): Promise<void> {
    const path = toStoragePath(assetKey);
    const { error } = await this.client.storage.from(MENU_ITEM_IMAGES_BUCKET).remove([path]);
    throwIfError(error);
  }

  getImageUrl(assetKey: string | null | undefined): string | null {
    if (!assetKey) {
      return null;
    }

    const { data } = this.client.storage
      .from(MENU_ITEM_IMAGES_BUCKET)
      .getPublicUrl(toStoragePath(assetKey));

    return data.publicUrl;
  }
}

