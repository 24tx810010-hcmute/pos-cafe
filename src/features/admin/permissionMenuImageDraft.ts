import type { MenuCatalog, MenuChanges } from "@/domain";
import type { IPermissionMenuImagePort } from "@/ports/permissionImages";
import type { DraftItem } from "./menuDraft";
import { clearPendingImageFields } from "./menuImageDraft";
import { assertCompatibilityCurrent } from "@/features/shared/permissionSession";

export async function stageMenuDraftImages(items: DraftItem[], base: MenuCatalog, port: IPermissionMenuImagePort) {
  const staged: string[] = [], imageChanges: NonNullable<MenuChanges["imageChanges"]> = [];
  try {
    for (const item of items) {
      if (item.deleted) continue;
      if (item.pendingImageFile) {
        assertCompatibilityCurrent();
        const { uploadHandle } = await port.stageMenuItemImage({ itemId: item.id, file: item.pendingImageFile });
        assertCompatibilityCurrent();
        staged.push(uploadHandle); imageChanges.push({ itemId: item.id, uploadHandle });
      } else if (item.imageAssetKey === null && base.menuItems.find(old => old.id === item.id)?.imageAssetKey) {
        imageChanges.push({ itemId: item.id, uploadHandle: null });
      }
    }
    // Asset keys are server-owned. A handle is finalized only by the menu transaction.
    const itemsForSave = items.map(item => clearPendingImageFields({ ...item,
      imageAssetKey: base.menuItems.find(old => old.id === item.id)?.imageAssetKey ?? null }));
    return { itemsForSave, imageChanges, discard: () => {
      assertCompatibilityCurrent(); return Promise.allSettled(staged.map(id => port.discardStagedMenuItemImage(id)));
    } };
  } catch (error) {
    try { assertCompatibilityCurrent(); await Promise.allSettled(staged.map(id => port.discardStagedMenuItemImage(id))); } catch { /* leave server-owned staged handles for expiry */ }
    throw error;
  }
}
