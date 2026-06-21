import { AlertTriangle, Eye, Save } from "lucide-react";
import { Button } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { MenuCatalog } from "@/domain";
import {
  useAdminMenuQuery,
  useSaveMenuMutation,
  hasMenuChanges,
} from "@/features/admin";
import { useAppStore } from "../../useAppStore";
import { toToastError } from "../../appErrors";
import { nextDraftId, nextSort } from "@/features/admin/draftUtils";
import {
  type DraftCategory,
  type DraftItem,
  type DraftGroup,
  type DraftValue,
} from "@/features/admin/menuDraft";
import { buildMenuChangesFromDrafts } from "@/features/admin/menuEditorDraft";
import { PortalDrawer } from "../../components/PortalDrawer";
import { PortalPopup } from "../../components/PortalPopup";
import { MenuCatalogPane } from "./MenuCatalogPane";
import { MenuEditorDetailPane } from "./MenuEditorDetailPane";

export function MenuEditorDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const menuQuery = useAdminMenuQuery();
  const saveMenuMutation = useSaveMenuMutation(currentEmployee);

  const [seeded, setSeeded] = useState(false);
  const [baseMenu, setBaseMenu] = useState<MenuCatalog | null>(null);
  const [cats, setCats] = useState<DraftCategory[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [values, setValues] = useState<DraftValue[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Advanced item fields (sort order + option groups) stay collapsed by default
  // so the basic name/price/category/availability fields lead the props pane.
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const seedDraftFromMenu = (catalog: MenuCatalog) => {
    setBaseMenu(catalog);
    setCats(catalog.categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder })));
    setItems(
      catalog.menuItems.map((m) => ({
        id: m.id,
        categoryId: m.categoryId,
        name: m.name,
        price: m.price,
        sortOrder: m.sortOrder,
        isAvailable: m.isAvailable,
      })),
    );
    setGroups(
      catalog.optionGroups.map((g) => ({
        id: g.id,
        menuItemId: g.menuItemId,
        name: g.name,
        selectType: g.selectType,
        isRequired: g.isRequired,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        sortOrder: g.sortOrder,
      })),
    );
    setValues(
      catalog.optionValues.map((v) => ({
        id: v.id,
        optionGroupId: v.optionGroupId,
        name: v.name,
        priceDelta: v.priceDelta,
        sortOrder: v.sortOrder,
      })),
    );
    setSelectedCategoryId(catalog.categories[0]?.id ?? "");
    setSelectedItemId(null);
    setDirty(false);
    setSeeded(true);
  };

  useEffect(() => {
    if (menuQuery.data && !seeded) {
      seedDraftFromMenu(menuQuery.data);
    }
  }, [menuQuery.data, seeded]);

  const touch = () => setDirty(true);

  // --- Category ops ---
  const addCategory = () => {
    const id = nextDraftId("cat");
    setCats((list) => [...list, { id, name: "Danh mục mới", sortOrder: nextSort(list.map((c) => c.sortOrder)), isNew: true }]);
    setSelectedCategoryId(id);
    setSelectedItemId(null);
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
        name: "",
        price: 0,
        sortOrder: nextSort(list.filter((i) => i.categoryId === selectedCategoryId).map((i) => i.sortOrder)),
        isAvailable: true,
        isNew: true,
      },
    ]);
    setSelectedItemId(id);
    touch();
  };
  const patchItem = (id: string, patch: Partial<DraftItem>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    touch();
  };
  const toggleDeleteItem = (id: string) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, deleted: !i.deleted } : i)));
    touch();
  };

  // --- Option group ops ---
  const addGroup = (itemId: string) => {
    const id = nextDraftId("og");
    setGroups((list) => [
      ...list,
      {
        id,
        menuItemId: itemId,
        name: "Nhóm tuỳ chọn",
        selectType: "single",
        isRequired: false,
        minSelect: 0,
        maxSelect: 1,
        sortOrder: nextSort(list.filter((g) => g.menuItemId === itemId).map((g) => g.sortOrder)),
        isNew: true,
      },
    ]);
    touch();
  };
  const patchGroup = (id: string, patch: Partial<DraftGroup>) => {
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    touch();
  };
  const toggleDeleteGroup = (id: string) => {
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, deleted: !g.deleted } : g)));
    touch();
  };

  // --- Option value ops ---
  const addValue = (groupId: string) => {
    const id = nextDraftId("ov");
    setValues((list) => [
      ...list,
      { id, optionGroupId: groupId, name: "Giá trị mới", priceDelta: 0, sortOrder: nextSort(list.filter((v) => v.optionGroupId === groupId).map((v) => v.sortOrder)), isNew: true },
    ]);
    touch();
  };
  const patchValue = (id: string, patch: Partial<DraftValue>) => {
    setValues((list) => list.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    touch();
  };
  const toggleDeleteValue = (id: string) => {
    setValues((list) => list.map((v) => (v.id === id ? { ...v, deleted: !v.deleted } : v)));
    touch();
  };

  // --- Derived ---
  const sortedCats = [...cats].sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedCategory = cats.find((c) => c.id === selectedCategoryId) ?? null;
  const catItems = items.filter((i) => i.categoryId === selectedCategoryId).sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;
  const itemGroups = selectedItem ? groups.filter((g) => g.menuItemId === selectedItem.id).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const groupValues = (gid: string) => values.filter((v) => v.optionGroupId === gid).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeCatCount = cats.filter((c) => !c.deleted).length;
  const activeItemCount = items.filter((i) => !i.deleted).length;

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
    const badGroup = groups.find((g) => !g.deleted && g.maxSelect < g.minSelect);
    if (badGroup) {
      setSelectedItemId(badGroup.menuItemId);
      toast.error("Nhóm tuỳ chọn: số chọn tối đa phải ≥ tối thiểu.");
      return;
    }

    const changes = buildMenuChangesFromDrafts({
      base: sourceMenu,
      categories: cats,
      items,
      groups,
      values,
      actorId: currentEmployee?.id,
    });
    if (!hasMenuChanges(changes)) {
      setDirty(false);
      toast.success("Không có thay đổi cần lưu.");
      return;
    }

    try {
      await saveMenuMutation.mutateAsync({ changes });
      const refreshed = await menuQuery.refetch();
      if (refreshed.data) {
        seedDraftFromMenu(refreshed.data);
      } else {
        setDirty(false);
      }
      toast.success("Đã lưu menu.");
    } catch (error) {
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
          <Button variant="text" onClick={handleCancel}>Huỷ</Button>
          <Button variant="outlined" startIcon={<Eye size={15} />} onClick={() => setPreview((p) => !p)}>
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

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
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
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(300px,360px)] gap-2.5 max-[980px]:min-w-[650px]">
              <MenuCatalogPane
                sortedCats={sortedCats}
                selectedCategoryId={selectedCategoryId}
                selectedItemId={selectedItemId}
                preview={preview}
                catItems={catItems}
                items={items}
                groups={groups}
                setSelectedCategoryId={setSelectedCategoryId}
                setSelectedItemId={setSelectedItemId}
                addCategory={addCategory}
                addItem={addItem}
                patchItem={patchItem}
                toggleDeleteItem={toggleDeleteItem}
              />

              <MenuEditorDetailPane
                selectedItem={selectedItem}
                selectedCategory={selectedCategory}
                sortedCats={sortedCats}
                itemGroups={itemGroups}
                groupValues={groupValues}
                advancedOpen={advancedOpen}
                onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
                patchItem={patchItem}
                toggleDeleteItem={toggleDeleteItem}
                addGroup={addGroup}
                patchGroup={patchGroup}
                toggleDeleteGroup={toggleDeleteGroup}
                addValue={addValue}
                patchValue={patchValue}
                toggleDeleteValue={toggleDeleteValue}
                patchCategory={patchCategory}
                moveCategory={moveCategory}
                toggleDeleteCategory={toggleDeleteCategory}
              />
            </div>
          </>
        )}
      </div>

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
