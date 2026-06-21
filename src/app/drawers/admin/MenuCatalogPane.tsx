import clsx from "clsx";
import { Coffee, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { DraftCategory, DraftGroup, DraftItem } from "@/features/admin/menuDraft";
import { formatVnd } from "@/core/money";

interface MenuCatalogPaneProps {
  sortedCats: DraftCategory[];
  selectedCategoryId: string;
  selectedItemId: string | null;
  preview: boolean;
  catItems: DraftItem[];
  items: DraftItem[];
  groups: DraftGroup[];
  setSelectedCategoryId: (id: string) => void;
  setSelectedItemId: (id: string | null) => void;
  addCategory: () => void;
  addItem: () => void;
  patchItem: (id: string, patch: Partial<DraftItem>) => void;
  toggleDeleteItem: (id: string) => void;
}

export function MenuCatalogPane({
  sortedCats,
  selectedCategoryId,
  selectedItemId,
  preview,
  catItems,
  items,
  groups,
  setSelectedCategoryId,
  setSelectedItemId,
  addCategory,
  addItem,
  patchItem,
  toggleDeleteItem,
}: MenuCatalogPaneProps) {
  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
      <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs gap-2.5">
        <div className="flex min-w-0 flex-[1_1_auto] flex-nowrap items-center gap-1.5 overflow-x-auto [scrollbar-width:thin]">
          {sortedCats.map((category) => (
            <button
              key={category.id}
              className={clsx(
                "inline-flex min-h-8 flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-pos-line bg-pos-surface px-3 py-1 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary",
                category.id === selectedCategoryId && "border-pos-primary bg-pos-primarySoft text-pos-primary",
                category.deleted && "opacity-70 line-through",
              )}
              onClick={() => { setSelectedCategoryId(category.id); setSelectedItemId(null); }}
            >
              {category.name || "(chưa đặt tên)"}
              {category.deleted ? (
                <span className="self-start rounded-full border border-[#fde68a] bg-[#fffbeb] px-2 text-[11px] font-bold text-pos-warning">Đang chờ xóa</span>
              ) : (
                <span className="rounded-[10px] bg-pos-surface2 px-1.5 py-px text-[11px] font-semibold text-pos-muted">{items.filter((item) => item.categoryId === category.id && !item.deleted).length}</span>
              )}
            </button>
          ))}
          <button className="inline-flex min-h-8 flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-pos-line bg-pos-surface px-3 py-1 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary border-dashed text-pos-muted" data-testid="add-category-button" onClick={addCategory}>
            <Plus size={13} /> Danh mục
          </button>
        </div>
        {preview && <span className="text-pos-muted">{catItems.filter((item) => !item.deleted).length} món</span>}
      </div>
      <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2">
        {!selectedCategoryId ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
            <Coffee size={30} color="#94a3b8" />
            <p>Chọn hoặc thêm danh mục để bắt đầu.</p>
          </div>
        ) : preview ? (
          catItems.filter((item) => !item.deleted).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted"><Coffee size={30} color="#94a3b8" /><p>Danh mục chưa có món.</p></div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-2.5 [@media(max-width:980px)_and_(orientation:landscape)]:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] [@media(max-width:980px)_and_(orientation:landscape)]:gap-[7px]">
              {catItems.filter((item) => !item.deleted).map((item) => (
                <div key={item.id} className={clsx("grid justify-items-start gap-1 rounded-pos border border-pos-line bg-white p-2.5", !item.isAvailable && "opacity-60")}>
                  <div className="grid h-14 w-full place-items-center rounded-[6px] bg-pos-primarySoft text-pos-primary h-[72px]"><Coffee size={22} /></div>
                  <strong>{item.name || "(chưa đặt tên)"}</strong>
                  <span className="font-black text-pos-primary">{formatVnd(item.price)}</span>
                  {!item.isAvailable && <span className="inline-flex min-h-[22px] w-fit items-center rounded-full border border-pos-line bg-pos-surface2 px-2 py-0.5 text-[11px] font-bold text-pos-muted">Tạm hết</span>}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="grid content-start grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
            {catItems.map((item) => (
              <div
                key={item.id}
                className={clsx(
                  "grid cursor-pointer grid-rows-[auto_1fr_auto] gap-2 rounded-pos border-[1.5px] border-pos-line bg-white p-2.5 transition-[border-color,box-shadow] hover:border-pos-primary",
                  item.id === selectedItemId && "border-pos-primary shadow-[0_0_0_2px_var(--primary-soft)]",
                  item.deleted && "opacity-55 [&_strong]:line-through",
                  !item.isAvailable && "bg-[#fafafa]",
                )}
                data-testid={`menu-edit-card-${item.id}`}
                onClick={() => setSelectedItemId(item.id)}
              >
                <div className="grid h-14 w-full place-items-center rounded-[6px] bg-pos-primarySoft text-pos-primary"><Coffee size={18} /></div>
                <div className="grid min-w-0 gap-1 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap">
                  <strong>{item.name || "(chưa đặt tên)"}</strong>
                  <span className="font-black text-pos-primary">{formatVnd(item.price)}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex min-h-[22px] w-fit items-center rounded-full border border-pos-line bg-pos-surface2 px-2 py-0.5 text-[11px] font-bold text-pos-muted">{groups.filter((group) => group.menuItemId === item.id && !group.deleted).length} tuỳ chọn</span>
                    <span className={clsx("inline-flex min-h-[22px] w-fit items-center rounded-full border border-pos-line bg-pos-surface2 px-2 py-0.5 text-[11px] font-bold text-pos-muted", item.isAvailable && "border-[#bbf7d0] bg-[#f0fdf4] text-pos-success")}>{item.isAvailable ? "Đang bán" : "Tạm hết"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                  <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5" onClick={() => patchItem(item.id, { isAvailable: !item.isAvailable })}>
                    {item.isAvailable ? "Tạm hết" : "Mở bán"}
                  </button>
                  <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" title={item.deleted ? "Khôi phục" : "Xoá"} onClick={() => toggleDeleteItem(item.id)}>
                    {item.deleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))}
            <button className="grid min-h-[120px] cursor-pointer place-items-center content-center gap-1 rounded-pos border-[1.5px] border-dashed border-pos-line bg-pos-surface2 text-[13px] font-bold text-pos-muted transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary" data-testid="add-item-button" onClick={addItem}>
              <Plus size={20} />
              <span>Thêm món</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
