import type { MenuCatalog } from "@/domain";
import type { IMenuImagePort } from "@/ports";
import type { DraftItem } from "./menuDraft";
import { clearPendingImageFields } from "./menuImageDraft";
import { assertCompatibilityCurrent } from "@/features/shared/permissionSession";

export async function deleteMenuImagesBestEffort(menuImages: IMenuImagePort, assetKeys: string[]) {
  assertCompatibilityCurrent();
  const uniqueAssetKeys = [...new Set(assetKeys.filter(Boolean))];
  await Promise.allSettled(uniqueAssetKeys.map((assetKey) => menuImages.deleteMenuItemImage(assetKey)));
}

export async function uploadPendingMenuItemImages(
  items: DraftItem[],
  sourceMenu: MenuCatalog,
  menuImages: IMenuImagePort,
) {
  const originalItems = new Map(sourceMenu.menuItems.map((item) => [item.id, item]));
  const uploadedAssetKeys: string[] = [];
  const itemsForSave: DraftItem[] = [];

  for (const item of items) {
    if (!item.pendingImageFile || item.deleted) {
      itemsForSave.push(clearPendingImageFields(item));
      continue;
    }

    assertCompatibilityCurrent();
    const uploaded = await menuImages.uploadMenuItemImage({
      itemId: item.id,
      file: item.pendingImageFile,
    });
    assertCompatibilityCurrent(); uploadedAssetKeys.push(uploaded.assetKey);
    itemsForSave.push(clearPendingImageFields({ ...item, imageAssetKey: uploaded.assetKey }));
  }

  const replacedAssetKeys = itemsForSave.flatMap((item) => {
    const originalImage = originalItems.get(item.id)?.imageAssetKey;
    if (!originalImage) return [];
    if (item.deleted || item.imageAssetKey !== originalImage) return [originalImage];
    return [];
  });

  return { itemsForSave, uploadedAssetKeys, replacedAssetKeys };
}
