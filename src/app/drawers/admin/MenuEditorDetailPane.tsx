import clsx from "clsx";
import { Button, TextField } from "@mui/material";
import { ChevronRight, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toInt, type DraftCategory, type DraftGroup, type DraftItem, type DraftValue } from "@/features/admin/menuDraft";

type PatchDraft<T> = (id: string, patch: Partial<T>) => void;

interface MenuEditorDetailPaneProps {
  selectedItem: DraftItem | null;
  selectedCategory: DraftCategory | null;
  sortedCats: DraftCategory[];
  itemGroups: DraftGroup[];
  groupValues: (groupId: string) => DraftValue[];
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  patchItem: PatchDraft<DraftItem>;
  toggleDeleteItem: (id: string) => void;
  addGroup: (itemId: string) => void;
  patchGroup: PatchDraft<DraftGroup>;
  toggleDeleteGroup: (id: string) => void;
  addValue: (groupId: string) => void;
  patchValue: PatchDraft<DraftValue>;
  toggleDeleteValue: (id: string) => void;
  patchCategory: PatchDraft<DraftCategory>;
  moveCategory: (id: string, dir: -1 | 1) => void;
  toggleDeleteCategory: (id: string) => void;
}

export function MenuEditorDetailPane({
  selectedItem,
  selectedCategory,
  sortedCats,
  itemGroups,
  groupValues,
  advancedOpen,
  onToggleAdvanced,
  patchItem,
  toggleDeleteItem,
  addGroup,
  patchGroup,
  toggleDeleteGroup,
  addValue,
  patchValue,
  toggleDeleteValue,
  patchCategory,
  moveCategory,
  toggleDeleteCategory,
}: MenuEditorDetailPaneProps) {
  return (
    <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
      <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">{selectedItem ? "Chi tiết món" : selectedCategory ? "Chi tiết danh mục" : "Thuộc tính"}</div>
      <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2 grid content-start gap-3">
        {selectedItem ? (
          <>
            <TextField
              label="Tên món"
              value={selectedItem.name}
              onChange={(e) => patchItem(selectedItem.id, { name: e.target.value })}
              error={!selectedItem.name.trim()}
              helperText={!selectedItem.name.trim() ? "Tên món bắt buộc." : ""}
              size="small"
              fullWidth
              inputProps={{ "data-testid": "menu-item-name-input" }}
            />
            <TextField
              label="Giá (VND)"
              value={String(selectedItem.price)}
              onChange={(e) => patchItem(selectedItem.id, { price: toInt(e.target.value) })}
              size="small"
              fullWidth
              inputProps={{ inputMode: "numeric" }}
            />
            <div className="grid gap-1.5">
              <span className="text-xs font-extrabold text-pos-muted">Danh mục</span>
              <div className="flex flex-wrap gap-1.5">
                {sortedCats.filter((c) => !c.deleted).map((c) => (
                  <button
                    key={c.id}
                    className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border border-pos-line bg-pos-surface px-2.5 py-2 text-[13px] font-bold text-pos-ink transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", selectedItem.categoryId === c.id && "border-pos-primaryLine bg-pos-primarySoft text-pos-primary")}
                    onClick={() => patchItem(selectedItem.id, { categoryId: c.id })}
                  >
                    {c.name || "(chưa đặt tên)"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-extrabold text-pos-muted">Trạng thái</span>
              <div className="flex flex-wrap gap-1.5">
                <button className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border border-pos-line bg-pos-surface px-2.5 py-2 text-[13px] font-bold text-pos-ink transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", selectedItem.isAvailable && "border-pos-primaryLine bg-pos-primarySoft text-pos-primary")} onClick={() => patchItem(selectedItem.id, { isAvailable: true })}>Đang bán</button>
                <button className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border border-pos-line bg-pos-surface px-2.5 py-2 text-[13px] font-bold text-pos-ink transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", !selectedItem.isAvailable && "border-[#fecaca] bg-[#fef2f2] text-pos-danger")} onClick={() => patchItem(selectedItem.id, { isAvailable: false })}>Tạm hết</button>
              </div>
            </div>
            {selectedItem.deleted && (
              <div className="flex items-center justify-between gap-2 rounded-[7px] border border-[#fde68a] bg-[#fffbeb] px-2.5 py-2 text-xs text-pos-warning">
                Đang chờ xóa.
                <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" onClick={() => toggleDeleteItem(selectedItem.id)}><RotateCcw size={13} /> Khôi phục</button>
              </div>
            )}

            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-[7px] border border-pos-line bg-pos-surface2 px-2.5 py-[9px] text-left text-[13px] font-extrabold text-pos-ink hover:border-pos-primary"
              aria-expanded={advancedOpen}
              onClick={onToggleAdvanced}
            >
              <ChevronRight size={15} className={clsx("shrink-0 transition-transform duration-150", advancedOpen && "rotate-90")} />
              Nâng cao
              <span className="text-pos-muted">Thứ tự · nhóm tuỳ chọn</span>
            </button>

            {advancedOpen && (
              <div className="grid gap-3">
                <TextField
                  label="Thứ tự"
                  value={String(selectedItem.sortOrder)}
                  onChange={(e) => patchItem(selectedItem.id, { sortOrder: toInt(e.target.value) })}
                  size="small"
                  fullWidth
                  inputProps={{ inputMode: "numeric" }}
                />

                <div className="grid gap-2.5 border-t border-dashed border-pos-line pt-3">
                  <div className="flex items-center justify-between text-[13px] font-extrabold">
                    <span>Nhóm tuỳ chọn</span>
                    <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5" onClick={() => addGroup(selectedItem.id)}><Plus size={13} /> Nhóm</button>
                  </div>
                  {itemGroups.length === 0 ? (
                    <p className="text-pos-muted">Chưa có nhóm tuỳ chọn.</p>
                  ) : (
                    itemGroups.map((g) => (
                      <div key={g.id} className={clsx("grid gap-2.5 rounded-pos border border-pos-line bg-pos-surface2 p-2.5", g.deleted && "opacity-55")}>
                        <div className="flex items-start gap-2 [&>*:first-child]:flex-[1_1_auto]">
                          <TextField label="Tên nhóm" value={g.name} onChange={(e) => patchGroup(g.id, { name: e.target.value })} size="small" fullWidth />
                          <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" title={g.deleted ? "Khôi phục" : "Xoá nhóm"} onClick={() => toggleDeleteGroup(g.id)}>
                            {g.deleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            <button className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border border-pos-line bg-pos-surface px-2.5 py-2 text-[13px] font-bold text-pos-ink transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", g.selectType === "single" && "border-pos-primaryLine bg-pos-primarySoft text-pos-primary")} onClick={() => patchGroup(g.id, { selectType: "single" })}>Chọn 1</button>
                            <button className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border border-pos-line bg-pos-surface px-2.5 py-2 text-[13px] font-bold text-pos-ink transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", g.selectType === "multi" && "border-pos-primaryLine bg-pos-primarySoft text-pos-primary")} onClick={() => patchGroup(g.id, { selectType: "multi" })}>Chọn nhiều</button>
                          </div>
                          <button className={clsx("cursor-pointer whitespace-nowrap rounded-[7px] border border-pos-line bg-pos-surface px-3 py-[7px] text-xs font-bold text-pos-muted disabled:cursor-not-allowed disabled:opacity-50", g.isRequired && "border-pos-primaryLine bg-pos-primarySoft text-pos-primary")} onClick={() => patchGroup(g.id, { isRequired: !g.isRequired })}>
                            {g.isRequired ? "Bắt buộc" : "Tuỳ chọn"}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <TextField label="Tối thiểu" value={String(g.minSelect)} onChange={(e) => patchGroup(g.id, { minSelect: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                          <TextField
                            label="Tối đa"
                            value={String(g.maxSelect)}
                            onChange={(e) => patchGroup(g.id, { maxSelect: toInt(e.target.value) })}
                            error={g.maxSelect < g.minSelect}
                            helperText={g.maxSelect < g.minSelect ? "≥ tối thiểu" : ""}
                            size="small"
                            inputProps={{ inputMode: "numeric" }}
                          />
                        </div>
                        <div className="grid gap-2">
                          {groupValues(g.id).map((v) => (
                            <div key={v.id} className={clsx("grid grid-cols-[1.4fr_0.9fr_auto] items-start gap-1.5", v.deleted && "opacity-55")}>
                              <TextField label="Tên" value={v.name} onChange={(e) => patchValue(v.id, { name: e.target.value })} size="small" />
                              <TextField label="+Giá" value={String(v.priceDelta)} onChange={(e) => patchValue(v.id, { priceDelta: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                              <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" title={v.deleted ? "Khôi phục" : "Xoá"} onClick={() => toggleDeleteValue(v.id)}>
                                {v.deleted ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                              </button>
                            </div>
                          ))}
                          <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 w-full justify-center border-dashed" onClick={() => addValue(g.id)}><Plus size={12} /> Giá trị</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
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
