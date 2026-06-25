import clsx from "clsx";
import { Button, FormControlLabel, MenuItem as MuiMenuItem, Switch, TextField } from "@mui/material";
import { Pencil, Plus, RotateCcw } from "lucide-react";
import { toInt } from "@/features/admin/draftUtils";
import type { DraftCategory, DraftGroup, DraftItem, DraftValue } from "@/features/admin/menuDraft";
import { MENU_IMAGE_HELP_TEXT } from "@/features/admin/menuImageDraft";

type PatchDraft<T> = (id: string, patch: Partial<T>) => void;

interface MenuEditorDetailPaneProps {
  selectedItem: DraftItem | null;
  selectedCategory: DraftCategory | null;
  selectedItemImageUrl: string | null;
  sortedCats: DraftCategory[];
  sharedGroups: DraftGroup[];
  linkedGroupIds: Set<string>;
  groupValues: (groupId: string) => DraftValue[];
  controlsLocked: boolean;
  itemSwapMode: boolean;
  onItemSwapModeChange: (enabled: boolean) => void;
  patchItem: PatchDraft<DraftItem>;
  onItemCategoryChange: (id: string, categoryId: string) => void;
  toggleDeleteItem: (id: string) => void;
  onImageSelected: (id: string, file: File) => void;
  onImageRemoved: (id: string) => void;
  addItem: () => void;
  onAddGroup: (itemId?: string) => void;
  onToggleLink: (itemId: string, groupId: string) => void;
  onEditGroup: (groupId: string) => void;
  patchCategory: PatchDraft<DraftCategory>;
  moveCategory: (id: string, dir: -1 | 1) => void;
  toggleDeleteCategory: (id: string) => void;
}

export function MenuEditorDetailPane({
  selectedItem,
  selectedCategory,
  selectedItemImageUrl,
  sortedCats,
  sharedGroups,
  linkedGroupIds,
  groupValues,
  controlsLocked,
  itemSwapMode,
  onItemSwapModeChange,
  patchItem,
  onItemCategoryChange,
  toggleDeleteItem,
  onImageSelected,
  onImageRemoved,
  addItem,
  onAddGroup,
  onToggleLink,
  onEditGroup,
  patchCategory,
  moveCategory,
  toggleDeleteCategory,
}: MenuEditorDetailPaneProps) {
  const activeCategories = sortedCats.filter((category) => !category.deleted);
  const selectedItemCategoryValue =
    selectedItem && activeCategories.some((category) => category.id === selectedItem.categoryId)
      ? selectedItem.categoryId
      : "";
  const canAddItem = Boolean(selectedCategory && !selectedCategory.deleted);

  return (
    <aside className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface" data-testid="menu-editor-detail-pane">
      <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">
        <span>{selectedItem ? "Chi tiết món" : selectedCategory ? "Chi tiết danh mục" : "Thuộc tính"}</span>
        {selectedCategory && (
          <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5" data-testid="add-item-button" disabled={controlsLocked || !canAddItem} onClick={addItem}>
            <Plus size={13} /> Thêm món
          </button>
        )}
      </div>
      <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2 grid content-start gap-3">
        {selectedItem ? (
          <>
            <div className="flex items-center justify-between rounded-[7px] border border-pos-line bg-pos-surface2 px-2.5 py-1.5">
              <FormControlLabel
                control={<Switch checked={itemSwapMode} onChange={(event) => onItemSwapModeChange(event.target.checked)} />}
                label="Đổi vị trí"
              />
            </div>
            <fieldset className="contents" disabled={controlsLocked}>
            <div className="grid gap-2 rounded-[7px] border border-pos-line bg-pos-surface2 p-2.5">
              <span className="text-xs font-extrabold text-pos-muted">Ảnh món</span>
              <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2.5">
                <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-[7px] border border-pos-line bg-pos-primarySoft text-pos-primary">
                  {selectedItemImageUrl ? (
                    <img src={selectedItemImageUrl} alt={`Ảnh ${selectedItem.name || "món"}`} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[11px] font-bold text-pos-muted">Chưa có ảnh</span>
                  )}
                </div>
                <div className="grid gap-2">
                  <label className="inline-flex h-8 w-fit cursor-pointer items-center justify-center rounded-[6px] border border-pos-line bg-white px-3 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary">
                    Chọn ảnh
                    <input
                      aria-label="Chọn ảnh món"
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) onImageSelected(selectedItem.id, file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <button
                    className="inline-flex h-8 w-fit cursor-pointer items-center justify-center rounded-[6px] border border-pos-line bg-white px-3 text-xs font-bold text-pos-muted transition-[border-color,color] hover:border-pos-danger hover:text-pos-danger disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!selectedItemImageUrl && !selectedItem.imageAssetKey}
                    onClick={() => onImageRemoved(selectedItem.id)}
                  >
                    Xóa ảnh
                  </button>
                  <p className="m-0 text-[11px] font-semibold leading-snug text-pos-muted">{MENU_IMAGE_HELP_TEXT}</p>
                </div>
              </div>
            </div>
            <TextField
              label="Tên món"
              value={selectedItem.name}
              onChange={(e) => patchItem(selectedItem.id, { name: e.target.value })}
              error={!selectedItem.name.trim()}
              helperText={!selectedItem.name.trim() ? "Tên món bắt buộc." : ""}
              size="small"
              fullWidth
              disabled={controlsLocked}
              inputProps={{ "data-testid": "menu-item-name-input" }}
            />
            <TextField
              label="Giá (VND)"
              value={String(selectedItem.price)}
              onChange={(e) => patchItem(selectedItem.id, { price: toInt(e.target.value) })}
              size="small"
              fullWidth
              disabled={controlsLocked}
              inputProps={{ inputMode: "numeric" }}
            />
            <TextField
              select
              label="Danh mục"
              value={selectedItemCategoryValue}
              onChange={(event) => {
                const categoryId = event.target.value;
                if (categoryId) onItemCategoryChange(selectedItem.id, categoryId);
              }}
              size="small"
              fullWidth
              disabled={controlsLocked}
            >
              <MuiMenuItem value="" disabled>
                Chọn danh mục
              </MuiMenuItem>
              {activeCategories.map((category) => (
                <MuiMenuItem key={category.id} value={category.id}>
                  {category.name || "(chưa đặt tên)"}
                </MuiMenuItem>
              ))}
            </TextField>
            <div className="grid gap-1.5">
              <span className="text-xs font-extrabold text-pos-muted">Trạng thái</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  className={clsx(
                    "min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border px-2.5 py-2 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line",
                    selectedItem.isAvailable
                      ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary"
                      : "border-pos-line bg-pos-surface text-pos-ink",
                  )}
                  onClick={() => patchItem(selectedItem.id, { isAvailable: true })}
                >
                  Đang bán
                </button>
                <button
                  className={clsx(
                    "min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border px-2.5 py-2 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line",
                    !selectedItem.isAvailable
                      ? "border-[#fecaca] bg-[#fef2f2] text-pos-danger"
                      : "border-pos-line bg-pos-surface text-pos-ink",
                  )}
                  onClick={() => patchItem(selectedItem.id, { isAvailable: false })}
                >
                  Tạm hết
                </button>
              </div>
            </div>
            {selectedItem.deleted && (
              <div className="flex items-center justify-between gap-2 rounded-[7px] border border-[#fde68a] bg-[#fffbeb] px-2.5 py-2 text-xs text-pos-warning">
                Đang chờ xóa.
                <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" onClick={() => toggleDeleteItem(selectedItem.id)}><RotateCcw size={13} /> Khôi phục</button>
              </div>
            )}

            <div className="grid gap-2.5 border-t border-dashed border-pos-line pt-3">
                  <div className="flex items-center justify-between text-[13px] font-extrabold">
                    <span>Nhóm tuỳ chọn dùng chung</span>
                    <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2.5 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onAddGroup(selectedItem.id)}><Plus size={13} /> Tạo nhóm</button>
                  </div>
                  <p className="m-0 text-[11px] leading-snug text-pos-muted">Tick để gắn nhóm vào món này. Nhóm dùng chung cho mọi món — sửa nhóm sẽ ảnh hưởng tất cả món đang dùng.</p>
                  {sharedGroups.length === 0 ? (
                    <p className="text-pos-muted">Chưa có nhóm tuỳ chọn nào. Bấm "Tạo nhóm" để thêm.</p>
                  ) : (
                    sharedGroups.map((g) => {
                      const linked = linkedGroupIds.has(g.id);
                      const valueSummary = groupValues(g.id).map((v) => v.name).filter(Boolean).join(", ");
                      return (
                        <div key={g.id} className={clsx("flex items-start gap-2.5 rounded-pos border bg-pos-surface2 p-2.5", linked ? "border-pos-primaryLine" : "border-pos-line")}>
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-pos-primary"
                            checked={linked}
                            aria-label={`Gắn nhóm ${g.name}`}
                            data-testid={`link-group-${g.id}`}
                            onChange={() => onToggleLink(selectedItem.id, g.id)}
                          />
                          <div className="grid min-w-0 flex-[1_1_auto] gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <strong className="truncate text-[13px]">{g.name || "(chưa đặt tên)"}</strong>
                              <span className="shrink-0 rounded-full bg-pos-surface px-1.5 py-px text-[10px] font-bold text-pos-muted">{g.selectType === "single" ? "Chọn 1" : "Chọn nhiều"}</span>
                              {g.isRequired && <span className="shrink-0 rounded-full bg-pos-primarySoft px-1.5 py-px text-[10px] font-bold text-pos-primary">Bắt buộc</span>}
                            </div>
                            <span className="truncate text-[11px] text-pos-muted">{valueSummary || "Chưa có lựa chọn"}</span>
                          </div>
                          <button
                            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border border-pos-line bg-pos-surface text-pos-muted transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary"
                            title="Sửa nhóm"
                            data-testid={`edit-group-${g.id}`}
                            onClick={() => onEditGroup(g.id)}
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      );
                    })
                  )}
            </div>
            </fieldset>
          </>
        ) : selectedCategory ? (
          <>
            <TextField label="Tên danh mục" value={selectedCategory.name} onChange={(e) => patchCategory(selectedCategory.id, { name: e.target.value })} size="small" fullWidth />
            <div className="grid gap-1.5">
              <span className="text-xs font-extrabold text-pos-muted">Sắp xếp danh mục</span>
              <div className="flex flex-wrap items-center gap-2">
                <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5" onClick={() => moveCategory(selectedCategory.id, -1)}>↑ Lên</button>
                <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5" onClick={() => moveCategory(selectedCategory.id, 1)}>↓ Xuống</button>
              </div>
            </div>
            {selectedCategory.deleted && (
              <div className="flex items-center justify-between gap-2 rounded-[7px] border border-[#fde68a] bg-[#fffbeb] px-2.5 py-2 text-xs text-pos-warning">
                Đang chờ xóa.
                <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" onClick={() => toggleDeleteCategory(selectedCategory.id)}><RotateCcw size={13} /> Khôi phục</button>
              </div>
            )}
            <Button variant="outlined" color={selectedCategory.deleted ? "primary" : "error"} onClick={() => toggleDeleteCategory(selectedCategory.id)}>
              {selectedCategory.deleted ? "Khôi phục danh mục" : "Xoá danh mục"}
            </Button>
            <p className="text-pos-muted">Chọn một món để chỉnh sửa chi tiết và nhóm tuỳ chọn. Mục đã xoá vẫn có thể hoàn tác trước khi lưu.</p>
          </>
        ) : (
          <p className="text-pos-muted p-2">Chọn món hoặc danh mục để chỉnh sửa.</p>
        )}
      </div>
    </aside>
  );
}
