import { AlertTriangle } from "lucide-react";
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-2.5">
            {items.map((item) => (
              <button
                key={item.id}
                className={clsx("grid min-h-24 cursor-pointer grid-rows-[6px_1fr_auto] overflow-hidden rounded-pos border border-pos-line bg-white p-0 text-left transition-[border-color,box-shadow] hover:border-pos-primary hover:shadow-[0_0_0_2px_rgb(15_118_110_/_12%)] disabled:cursor-not-allowed", !item.isAvailable && "cursor-not-allowed opacity-50")}
                data-testid={`menu-item-${item.id}`}
                onClick={() => onAddItem(item)}
                disabled={!item.isAvailable}
              >
                <div className={clsx("h-1.5 w-full rounded-t-pos", item.categoryId === "cat-coffee" && "bg-[#7c3aed]", item.categoryId === "cat-tea" && "bg-[#0891b2]", item.categoryId === "cat-blended" && "bg-[#0d9488]", item.categoryId === "cat-snack" && "bg-[#d97706]", item.categoryId !== "cat-coffee" && item.categoryId !== "cat-tea" && item.categoryId !== "cat-blended" && item.categoryId !== "cat-snack" && "bg-[#64748b]")} />
                <div className="grid gap-[3px] px-2.5 pb-1 pt-2">
                  <strong className="text-[13px] font-bold leading-[1.3]">{item.name}</strong>
                  {!item.isAvailable && <span className="w-fit rounded bg-[#fee2e2] px-1.5 py-px text-[10px] font-bold text-pos-danger">Tạm hết</span>}
                </div>
                <span className="font-black text-pos-primary">{formatVnd(item.price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
