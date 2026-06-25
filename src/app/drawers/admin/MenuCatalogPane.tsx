import clsx from "clsx";
import { Coffee, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { DraftCategory, DraftItem, DraftLink } from "@/features/admin/menuDraft";
import { formatVnd } from "@/core/money";

interface MenuCatalogPaneProps {
  sortedCats: DraftCategory[];
  selectedCategoryId: string;
  selectedItemId: string | null;
  preview: boolean;
  catItems: DraftItem[];
  items: DraftItem[];
  links: DraftLink[];
  getMenuImageUrl: (assetKey: string | null | undefined) => string | null;
  setSelectedCategoryId: (id: string) => void;
  setSelectedItemId: (id: string | null) => void;
  addCategory: () => void;
  patchItem: (id: string, patch: Partial<DraftItem>) => void;
  toggleDeleteItem: (id: string) => void;
  controlsLocked: boolean;
  itemSwapMode: boolean;
  onSwapItem: (id: string) => void;
}

const itemImageUrl = (
  item: DraftItem,
  getMenuImageUrl: (assetKey: string | null | undefined) => string | null,
) => item.pendingImagePreviewUrl ?? getMenuImageUrl(item.imageAssetKey);

function ItemImage({
  item,
  imageUrl,
  sizeClassName,
}: {
  item: DraftItem;
  imageUrl: string | null;
  sizeClassName: string;
}) {
  return (
    <div
      className={clsx(
        "relative grid place-items-center overflow-hidden rounded-[7px] border",
        sizeClassName,
        item.isAvailable
          ? "border-pos-line bg-pos-primarySoft text-pos-primary"
          : "border-[#fecaca] bg-[#fff7f7] text-pos-danger",
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={`Ảnh ${item.name || "món"}`} className="h-full w-full object-cover" />
      ) : (
        <Coffee size={22} />
      )}
      {!item.isAvailable && (
        <>
          <span className="absolute inset-0 bg-white/70" />
          <span className="absolute left-1/2 top-1/2 w-[calc(100%-10px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#fecaca] bg-white/95 px-1.5 py-1 text-center text-[10px] font-black leading-tight text-pos-danger shadow-sm">
            Đã bán hết
          </span>
        </>
      )}
    </div>
  );
}

export function MenuCatalogPane({
  sortedCats,
  selectedCategoryId,
  selectedItemId,
  preview,
  catItems,
  items,
  links,
  getMenuImageUrl,
  setSelectedCategoryId,
  setSelectedItemId,
  addCategory,
  patchItem,
  toggleDeleteItem,
  controlsLocked,
  itemSwapMode,
  onSwapItem,
}: MenuCatalogPaneProps) {
  const visibleCatItems = catItems.filter((item) => !item.isNew || item.name.trim());

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
      <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">
        <div className="flex min-w-0 flex-[1_1_auto] flex-nowrap items-center gap-1.5 overflow-x-auto [scrollbar-width:thin]">
          {sortedCats.map((category) => (
            <button
              key={category.id}
              className={clsx(
                "inline-flex min-h-8 flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary",
                category.id === selectedCategoryId
                  ? "border-pos-primary bg-pos-primarySoft text-pos-primary"
                  : "border-pos-line bg-pos-surface",
                category.deleted && "opacity-70 line-through",
                controlsLocked && "cursor-not-allowed opacity-50",
              )}
              disabled={controlsLocked}
              onClick={() => {
                setSelectedCategoryId(category.id);
                setSelectedItemId(null);
              }}
            >
              {category.name || "(chưa đặt tên)"}
              {category.deleted ? (
                <span className="self-start rounded-full border border-[#fde68a] bg-[#fffbeb] px-2 text-[11px] font-bold text-pos-warning">Đang chờ xóa</span>
              ) : (
                <span className="rounded-[10px] bg-pos-surface2 px-1.5 py-px text-[11px] font-semibold text-pos-muted">{items.filter((item) => item.categoryId === category.id && !item.deleted).length}</span>
              )}
            </button>
          ))}
          <button
            className="inline-flex min-h-8 flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-pos-line bg-pos-surface px-3 py-1 text-[13px] font-bold text-pos-muted transition-[border-color,background,color] hover:border-pos-primary"
            data-testid="add-category-button"
            disabled={controlsLocked}
            onClick={addCategory}
          >
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
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
              <Coffee size={30} color="#94a3b8" />
              <p>Danh mục chưa có món.</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5 [@media(max-width:980px)_and_(orientation:landscape)]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] [@media(max-width:980px)_and_(orientation:landscape)]:gap-[7px]">
              {catItems.filter((item) => !item.deleted).map((item) => {
                const imageUrl = itemImageUrl(item, getMenuImageUrl);
                return (
                  <div
                    key={item.id}
                    className={clsx(
                      "grid min-h-[86px] grid-cols-[74px_minmax(0,1fr)] items-center gap-2 rounded-pos border p-2",
                      item.isAvailable ? "border-pos-line bg-white" : "border-[#fecaca] bg-[#fff7f7]",
                    )}
                  >
                    <ItemImage item={item} imageUrl={imageUrl} sizeClassName="h-[70px] w-[70px]" />
                    <div className="min-w-0">
                      <strong className="block overflow-hidden text-ellipsis whitespace-nowrap">{item.name || "(chưa đặt tên)"}</strong>
                      <span className="font-black text-pos-primary">{formatVnd(item.price)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="grid content-start grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2.5">
            {visibleCatItems.map((item) => {
              const imageUrl = itemImageUrl(item, getMenuImageUrl);
              return (
                <div
                  key={item.id}
                  className={clsx(
                    "grid min-h-[104px] cursor-pointer grid-cols-[92px_minmax(0,1fr)] items-stretch gap-2.5 rounded-pos border-[1.5px] p-2.5 transition-[border-color,box-shadow] hover:border-pos-primary",
                    item.id === selectedItemId
                      ? "border-pos-primary bg-pos-primarySoft shadow-[0_0_0_2px_var(--primary-soft)]"
                      : !item.isAvailable
                        ? "border-[#fecaca] bg-[#fff7f7]"
                        : "border-pos-line bg-white",
                    item.deleted && "opacity-55 [&_strong]:line-through",
                  )}
                  data-testid={`menu-edit-card-${item.id}`}
                  onClick={() => (itemSwapMode ? onSwapItem(item.id) : setSelectedItemId(item.id))}
                >
                  <ItemImage item={item} imageUrl={imageUrl} sizeClassName="h-[84px] w-[84px]" />
                  <div className="grid min-w-0 grid-rows-[auto_auto_1fr] gap-1">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{item.name || "(chưa đặt tên)"}</strong>
                    <span className="font-black text-pos-primary">{formatVnd(item.price)}</span>
                    <div className="flex flex-wrap content-start gap-1.5">
                      <span className="inline-flex min-h-[22px] w-fit items-center rounded-full border border-pos-line bg-pos-surface2 px-2 py-0.5 text-[11px] font-bold text-pos-muted">{links.filter((link) => link.menuItemId === item.id && !link.deleted).length} tùy chọn</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1" onClick={(event) => event.stopPropagation()}>
                      <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2.5 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" disabled={controlsLocked} onClick={() => patchItem(item.id, { isAvailable: !item.isAvailable })}>
                        {item.isAvailable ? "Tạm hết" : "Mở bán"}
                      </button>
                      <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" disabled={controlsLocked} title={item.deleted ? "Khôi phục" : "Xóa"} onClick={() => toggleDeleteItem(item.id)}>
                        {item.deleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
