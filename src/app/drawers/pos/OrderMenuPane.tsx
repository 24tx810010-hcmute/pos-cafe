import { AlertTriangle, Coffee } from "lucide-react";
import clsx from "clsx";
import { Button, TextField } from "@mui/material";
import type { Category, MenuItem } from "@/domain";
import { formatVnd } from "@/core/money";
import { toToastError } from "../../appErrors";

type OrderMenuPaneProps = {
  categories: Category[] | undefined;
  items: MenuItem[];
  categoryId: string;
  search: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  getMenuImageUrl: (assetKey: string | null | undefined) => string | null;
  onSelectCategory: (categoryId: string) => void;
  onSearchChange: (search: string) => void;
  onRetry: () => void;
  onAddItem: (item: MenuItem) => void;
};

export function OrderMenuPane({
  categories,
  items,
  categoryId,
  search,
  isLoading,
  isError,
  error,
  getMenuImageUrl,
  onSelectCategory,
  onSearchChange,
  onRetry,
  onAddItem,
}: OrderMenuPaneProps) {
  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
      <div className="flex min-h-11 items-center gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2">
        <div className="flex min-w-0 flex-[1_1_auto] flex-nowrap items-center gap-1.5 overflow-x-auto [scrollbar-width:thin]">
          {categories?.map((cat) => (
            <button
              key={cat.id}
              className={clsx(
                "flex min-h-[34px] items-center whitespace-nowrap rounded-[7px] border px-3 font-extrabold",
                cat.id === categoryId && !search
                  ? "border-[rgb(15_118_110_/_45%)] bg-pos-primarySoft text-pos-primary"
                  : "border-pos-line bg-pos-surface text-pos-muted",
              )}
              onClick={() => onSelectCategory(cat.id)}
            >
              <span className={clsx("mr-1 inline-block h-2 w-2 shrink-0 rounded-full align-middle", cat.id === "cat-coffee" && "bg-[#7c3aed]", cat.id === "cat-tea" && "bg-[#0891b2]", cat.id === "cat-blended" && "bg-[#0d9488]", cat.id === "cat-snack" && "bg-[#d97706]", cat.id !== "cat-coffee" && cat.id !== "cat-tea" && cat.id !== "cat-blended" && cat.id !== "cat-snack" && "bg-[#64748b]")} />
              {cat.name}
            </button>
          ))}
        </div>
        <TextField
          size="small"
          placeholder="Tìm món..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="max-w-[180px]"
        />
      </div>
      <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2">
        {isLoading ? (
          <p className="text-pos-muted p-3">Đang tải menu...</p>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted" data-testid="order-menu-error-state">
            <AlertTriangle size={30} color="#b45309" />
            <strong>Không tải được menu</strong>
            <p>{toToastError(error)}</p>
            <Button variant="contained" size="small" onClick={onRetry}>
              Thử tải lại
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="text-pos-muted p-3">Không có món.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
            {items.map((item) => {
              const imageUrl = getMenuImageUrl(item.imageAssetKey);
              return (
                <button
                  key={item.id}
                  className={clsx(
                    "grid min-h-[96px] cursor-pointer grid-cols-[82px_minmax(0,1fr)] overflow-hidden rounded-pos border p-2 text-left transition-[border-color,box-shadow] disabled:cursor-not-allowed",
                    item.isAvailable
                      ? "border-pos-line bg-white hover:border-pos-primary hover:shadow-[0_0_0_2px_rgb(15_118_110_/_12%)]"
                      : "border-[#fecaca] bg-[#fff7f7] hover:border-[#fecaca] hover:shadow-none",
                  )}
                  data-testid={`menu-item-${item.id}`}
                  onClick={() => onAddItem(item)}
                  disabled={!item.isAvailable}
                >
                  <div
                    className={clsx(
                      "relative grid h-20 w-20 place-items-center overflow-hidden rounded-[7px] border",
                      item.isAvailable
                        ? "border-pos-line bg-pos-primarySoft text-pos-primary"
                        : "border-[#fecaca] bg-[#fff7f7] text-pos-danger",
                    )}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt={`Ảnh ${item.name}`} className="h-full w-full object-cover" />
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
                  <div className="grid min-w-0 content-between gap-1 px-2">
                    <div className="grid min-w-0 gap-1">
                      <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold leading-[1.3]">{item.name}</strong>
                    </div>
                    <span className="font-black text-pos-primary">{formatVnd(item.price)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
