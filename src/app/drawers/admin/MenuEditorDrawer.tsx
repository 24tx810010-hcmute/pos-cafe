import { AlertTriangle, ArrowLeft, Eye, Save } from "lucide-react";
import { Button } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { MenuCatalog } from "@/domain";
import {
  useAdminMenuQuery,
  useSaveMenuMutation,
  hasMenuChanges,
} from "@/features/admin";
import { usePorts } from "@/features/shared/portsContext";
import { useAppStore } from "../../useAppStore";
import { toToastError } from "../../appErrors";
import { nextDraftId, nextSort } from "@/features/admin/draftUtils";
import { type DraftCategory, type DraftItem } from "@/features/admin/menuDraft";
import { buildMenuChangesFromDrafts } from "@/features/admin/menuEditorDraft";
import { useMenuModifierDrafts } from "@/features/admin/useMenuModifierDrafts";
import { ModifierGroupEditor } from "./ModifierGroupEditor";
import { swapMenuItemSortOrderInCategory } from "@/features/admin/menuItemOrderDraft";
import { getMenuImageError, revokePendingItemPreviews } from "@/features/admin/menuImageDraft";
import { deleteMenuImagesBestEffort, uploadPendingMenuItemImages } from "@/features/admin/menuImageSaveDraft";
import { PortalDrawer } from "../../components/PortalDrawer";
import { PortalPopup } from "../../components/PortalPopup";
import { MenuCatalogPane } from "./MenuCatalogPane";
import { MenuEditorDetailPane } from "./MenuEditorDetailPane";

const nextNewItemName = (items: DraftItem[], categoryId: string) => {
  const names = new Set(items.filter((item) => item.categoryId === categoryId).map((item) => item.name.trim()));
  let index = 1;
  while (names.has(`Món mới ${index}`)) index += 1;
  return `Món mới ${index}`;
};

export function MenuEditorDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const ports = usePorts();
  const menuQuery = useAdminMenuQuery();
  const saveMenuMutation = useSaveMenuMutation(currentEmployee);

  const [seeded, setSeeded] = useState(false);
  const [baseMenu, setBaseMenu] = useState<MenuCatalog | null>(null);
  const [cats, setCats] = useState<DraftCategory[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [itemSwapMode, setItemSwapMode] = useState(false);

  const touch = () => setDirty(true);
  const mod = useMenuModifierDrafts(touch);

  const seedDraftFromMenu = (catalog: MenuCatalog) => {
    revokePendingItemPreviews(items);
    setBaseMenu(catalog);
    setCats(catalog.categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder })));
    setItems(
      catalog.menuItems.map((m) => ({
        id: m.id,
        categoryId: m.categoryId,
        name: m.name,
        price: m.price,
        imageAssetKey: m.imageAssetKey,
        sortOrder: m.sortOrder,
        isAvailable: m.isAvailable,
      })),
    );
    mod.reset(catalog);
    setSelectedCategoryId(catalog.categories[0]?.id ?? "");
    setSelectedItemId(null);
    setItemSwapMode(false);
    setDirty(false);
    setSeeded(true);
  };

  useEffect(() => {
    if (menuQuery.data && !seeded) {
      seedDraftFromMenu(menuQuery.data);
    }
  }, [menuQuery.data, seeded]);

  // --- Category ops ---
  const addCategory = () => {
    const id = nextDraftId("cat");
    setCats((list) => [...list, { id, name: "Danh mục mới", sortOrder: nextSort(list.map((c) => c.sortOrder)), isNew: true }]);
    setSelectedCategoryId(id);
    setSelectedItemId(null);
    setItemSwapMode(false);
    touch();
  };
  const patchCategory = (id: string, patch: Partial<DraftCategory>) => {
    setCats((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    touch();
  };
  const toggleDeleteCategory = (id: string) => {
    setCats((list) => list.map((c) => (c.id === id ? { ...c, deleted: !c.deleted } : c)));
    touch();
  };
  const moveCategory = (id: string, dir: -1 | 1) => {
    const sorted = [...cats].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((c) => c.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    setCats((list) =>
      list.map((c) => (c.id === a.id ? { ...c, sortOrder: b.sortOrder } : c.id === b.id ? { ...c, sortOrder: a.sortOrder } : c)),
    );
    touch();
  };

  // --- Item ops ---
  const addItem = () => {
    if (!selectedCategoryId) return;
    const id = nextDraftId("mi");
    setItems((list) => [
      ...list,
      {
        id,
        categoryId: selectedCategoryId,
        name: nextNewItemName(list, selectedCategoryId),
        price: 0,
        imageAssetKey: null,
        sortOrder: nextSort(list.filter((i) => i.categoryId === selectedCategoryId).map((i) => i.sortOrder)),
        isAvailable: true,
        isNew: true,
      },
    ]);
    setSelectedItemId(id);
    setItemSwapMode(false);
    touch();
  };
  const patchItem = (id: string, patch: Partial<DraftItem>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    touch();
  };
  const changeItemCategory = (id: string, categoryId: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || item.categoryId === categoryId) return;

    const sortOrder = nextSort(items.filter((candidate) => candidate.id !== id && candidate.categoryId === categoryId).map((candidate) => candidate.sortOrder));
    setItems((list) => list.map((candidate) => (candidate.id === id ? { ...candidate, categoryId, sortOrder } : candidate)));
    setSelectedCategoryId(categoryId); setSelectedItemId(id); setItemSwapMode(false); touch();
  };
  const swapItemOrder = (targetItemId: string) => {
    if (!selectedItemId || selectedItemId === targetItemId) return;
    const updated = swapMenuItemSortOrderInCategory(items, selectedCategoryId, selectedItemId, targetItemId);
    if (updated === items) return;
    setItems(updated);
    setItemSwapMode(false);
    touch();
  };
  const toggleDeleteItem = (id: string) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, deleted: !i.deleted } : i)));
    touch();
  };
  const setItemImageFile = (id: string, file: File) => {
    const errorMessage = getMenuImageError(file);
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }

    setItems((list) =>
      list.map((item) => {
        if (item.id !== id) return item;
        if (item.pendingImagePreviewUrl) URL.revokeObjectURL(item.pendingImagePreviewUrl);
        return {
          ...item,
          pendingImageFile: file,
          pendingImagePreviewUrl: URL.createObjectURL(file),
        };
      }),
    );
    touch();
  };
  const removeItemImage = (id: string) => {
    setItems((list) =>
      list.map((item) => {
        if (item.id !== id) return item;
        if (item.pendingImagePreviewUrl) URL.revokeObjectURL(item.pendingImagePreviewUrl);
        return {
          ...item,
          imageAssetKey: null,
          pendingImageFile: null,
          pendingImagePreviewUrl: null,
        };
      }),
    );
    touch();
  };

  // --- Derived ---
  const sortedCats = [...cats].sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedCategory = cats.find((c) => c.id === selectedCategoryId) ?? null;
  const catItems = items.filter((i) => i.categoryId === selectedCategoryId).sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;
  const activeGroups = mod.groups.filter((g) => !g.deleted).sort((a, b) => a.sortOrder - b.sortOrder);
  const linkedGroupIds = selectedItem
    ? new Set(mod.links.filter((l) => l.menuItemId === selectedItem.id && !l.deleted).map((l) => l.optionGroupId))
    : new Set<string>();
  const editingGroup = mod.editingGroupId ? mod.groups.find((g) => g.id === mod.editingGroupId) ?? null : null;
  const activeCatCount = cats.filter((c) => !c.deleted).length;
  const activeItemCount = items.filter((i) => !i.deleted).length;
  const selectedItemImageUrl = selectedItem
    ? selectedItem.pendingImagePreviewUrl ?? ports.menuImages.getImageUrl(selectedItem.imageAssetKey)
    : null;

  const handleSave = async () => {
    if (saveMenuMutation.isPending) return;
    const sourceMenu = baseMenu ?? menuQuery.data;
    if (!sourceMenu) {
      toast.error("Menu chưa tải xong.");
      return;
    }
    const badItem = items.find((i) => !i.deleted && (!i.name.trim() || i.price < 0));
    if (badItem) {
      setSelectedCategoryId(badItem.categoryId);
      setSelectedItemId(badItem.id);
      toast.error("Kiểm tra lại: tên món bắt buộc, giá ≥ 0.");
      return;
    }
    const badGroup = mod.groups.find((g) => !g.deleted && !g.name.trim());
    if (badGroup) {
      mod.setEditingGroupId(badGroup.id);
      toast.error("Nhóm tuỳ chọn: tên nhóm bắt buộc.");
      return;
    }

    let uploadedAssetKeys: string[] = [];
    try {
      const uploadResult = await uploadPendingMenuItemImages(items, sourceMenu, ports.menuImages);
      uploadedAssetKeys = uploadResult.uploadedAssetKeys;
      const changes = buildMenuChangesFromDrafts({
      base: sourceMenu,
      categories: cats,
      items: uploadResult.itemsForSave,
      groups: mod.groups,
      values: mod.values,
      links: mod.links,
      actorId: currentEmployee?.id,
    });
    if (!hasMenuChanges(changes)) {
      setItems(uploadResult.itemsForSave);
      setDirty(false);
      toast.success("Không có thay đổi cần lưu.");
      return;
    }

      await saveMenuMutation.mutateAsync({ changes });
      void deleteMenuImagesBestEffort(ports.menuImages, uploadResult.replacedAssetKeys);
      const refreshed = await menuQuery.refetch();
      if (refreshed.data) {
        seedDraftFromMenu(refreshed.data);
      } else {
        setItems(uploadResult.itemsForSave);
        setDirty(false);
      }
      toast.success("Đã lưu menu.");
    } catch (error) {
      void deleteMenuImagesBestEffort(ports.menuImages, uploadedAssetKeys);
      toast.error(toToastError(error));
    }
  };

  const handleCancel = () => {
    if (dirty) setConfirmCancel(true);
    else closeDrawer();
  };

  return (
    <PortalDrawer testId="menu-editor" onOutsideClick={closeDrawer}>
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>
            Quản lý menu {dirty && <span className="ml-2 inline-flex items-center rounded-full bg-[#fff7ed] px-2 py-px text-[11px] font-extrabold text-[#c2410c]" data-testid="menu-dirty-badge">Chưa lưu</span>}
          </h2>
          <p>
            <span className="mr-1 inline-block h-[7px] w-[7px] align-middle rounded-full bg-[#22c55e]" />
            {activeCatCount} danh mục · {activeItemCount} món · online
          </p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]">
          <Button variant="text" startIcon={<ArrowLeft size={15} />} onClick={handleCancel}>Thoát</Button>
          <Button variant="outlined" startIcon={<Eye size={15} />} onClick={() => setPreview((p) => !p)} disabled={itemSwapMode}>
            {preview ? "Thoát xem trước" : "Xem trước"}
          </Button>
          <Button
            variant="contained"
            startIcon={<Save size={15} />}
            data-testid="save-menu-button"
            onClick={handleSave}
            disabled={!dirty || saveMenuMutation.isPending}
          >
            {saveMenuMutation.isPending ? "Đang lưu..." : "Lưu menu"}
          </Button>
        </div>
      </header>

      <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)] gap-2 overflow-hidden bg-pos-bg p-3 max-[980px]:p-2">
        {menuQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted" data-testid="menu-editor-error-state">
            <AlertTriangle size={32} color="#b45309" />
            <strong>Không tải được menu</strong>
            <p>{toToastError(menuQuery.error)}</p>
            <Button variant="contained" size="small" onClick={() => void menuQuery.refetch()}>
              Thử tải lại
            </Button>
          </div>
        ) : !seeded ? (
          <p className="text-pos-muted p-4">Đang tải menu...</p>
        ) : (
          <>
            <div className="grid h-full min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(300px,360px)] grid-rows-[minmax(0,1fr)] gap-2.5 max-[980px]:min-w-[650px]">
              <MenuCatalogPane
                sortedCats={sortedCats}
                selectedCategoryId={selectedCategoryId}
                selectedItemId={selectedItemId}
                preview={preview}
                catItems={catItems}
                items={items}
                links={mod.links}
                getMenuImageUrl={(assetKey) => ports.menuImages.getImageUrl(assetKey)}
                setSelectedCategoryId={setSelectedCategoryId}
                setSelectedItemId={setSelectedItemId}
                addCategory={addCategory}
                patchItem={patchItem}
                toggleDeleteItem={toggleDeleteItem}
                controlsLocked={itemSwapMode}
                itemSwapMode={itemSwapMode}
                onSwapItem={swapItemOrder}
              />

              <MenuEditorDetailPane
                selectedItem={selectedItem}
                selectedCategory={selectedCategory}
                selectedItemImageUrl={selectedItemImageUrl}
                sortedCats={sortedCats}
                sharedGroups={activeGroups}
                linkedGroupIds={linkedGroupIds}
                groupValues={mod.groupValues}
                controlsLocked={itemSwapMode}
                itemSwapMode={itemSwapMode}
                onItemSwapModeChange={setItemSwapMode}
                patchItem={patchItem}
                onItemCategoryChange={changeItemCategory}
                toggleDeleteItem={toggleDeleteItem}
                onImageSelected={setItemImageFile}
                onImageRemoved={removeItemImage}
                addItem={addItem}
                onAddGroup={mod.addGroup}
                onToggleLink={mod.toggleLink}
                onEditGroup={mod.setEditingGroupId}
                patchCategory={patchCategory}
                moveCategory={moveCategory}
                toggleDeleteCategory={toggleDeleteCategory}
              />
            </div>
          </>
        )}
      </div>

      {editingGroup && (
        <ModifierGroupEditor
          group={editingGroup}
          values={mod.groupValues(editingGroup.id)}
          onPatchGroup={mod.patchGroup}
          onAddValue={mod.addValue}
          onPatchValue={mod.patchValue}
          onDeleteValue={mod.toggleDeleteValue}
          onDeleteGroup={mod.deleteGroup}
          onClose={() => mod.setEditingGroupId(null)}
        />
      )}

      {confirmCancel && (
        <PortalPopup placement="Centered" viewport="workspace" overlayClassName="bg-slate-900/50" onOutsideClick={() => setConfirmCancel(false)}>
          <div className="grid w-[min(360px,90vw)] gap-3 rounded-pos bg-pos-surface p-6 shadow-[0_20px_60px_rgb(0_0_0_/_25%)] [&_h3]:m-0 [&_p]:m-0 [&_p]:text-sm [&_p]:text-pos-muted" onClick={(e) => e.stopPropagation()}>
            <h3>Bỏ thay đổi menu?</h3>
            <p>Các chỉnh sửa chưa lưu sẽ bị huỷ.</p>
            <div className="flex flex-wrap justify-end gap-2.5 [&_.MuiButton-root]:min-w-24">
              <Button variant="outlined" onClick={() => setConfirmCancel(false)}>Ở lại</Button>
              <Button variant="contained" color="error" onClick={() => { setConfirmCancel(false); closeDrawer(); }}>Bỏ thay đổi</Button>
            </div>
          </div>
        </PortalPopup>
      )}
    </PortalDrawer>
  );
}
