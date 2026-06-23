import type { IMenuImagePort, MenuItemImageUploadInput, MenuItemImageUploadResult } from "@/ports";
import { mockStoreId } from "./mockData";

const extensionFor = (file: File): string => {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  const fromName = file.name.split(".").pop()?.toLowerCase();
  return fromName || "bin";
};

export class MockMenuImagePort implements IMenuImagePort {
  private readonly imageUrls = new Map<string, string>();

  async uploadMenuItemImage(input: MenuItemImageUploadInput): Promise<MenuItemImageUploadResult> {
    const assetKey = `menu-item-images/${mockStoreId}/menu-items/${input.itemId}/mock-upload.${extensionFor(input.file)}`;
    const publicUrl =
      typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(input.file)
        : `mock-menu-image://${assetKey}`;
    this.imageUrls.set(assetKey, publicUrl);

    return {
      assetKey,
      publicUrl,
    };
  }

  async deleteMenuItemImage(assetKey: string): Promise<void> {
    const imageUrl = this.imageUrls.get(assetKey);
    if (imageUrl?.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(imageUrl);
    }
    this.imageUrls.delete(assetKey);
  }

  getImageUrl(assetKey: string | null | undefined): string | null {
    if (!assetKey) return null;
    return this.imageUrls.get(assetKey) ?? null;
  }
}
