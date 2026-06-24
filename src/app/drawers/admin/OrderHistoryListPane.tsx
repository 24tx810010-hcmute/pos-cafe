import clsx from "clsx";
import { AlertTriangle, ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";
import type { HistoryOrderRow } from "@/features/pos/historyHelpers";
import { toToastError } from "../../appErrors";
import { formatMoney, statusClass, statusLabel } from "./orderHistoryShared";

interface OrderHistoryListPaneProps {
  rows: HistoryOrderRow[];
  total: number;
  dateRangeLabel: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  selectedId: string | null;
  page: number;
  totalPages: number;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
}

export function OrderHistoryListPane({
  rows,
  total,
  dateRangeLabel,
  isLoading,
  isError,
  error,
  selectedId,
  page,
  totalPages,
  onSelect,
  onRetry,
  onClearFilters,
  onPageChange,
}: OrderHistoryListPaneProps) {
  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border border-pos-line bg-white">
      <div className="flex min-h-[48px] items-center justify-between gap-2 border-b border-pos-line px-3 py-2 max-[760px]:min-h-[40px] max-[760px]:px-2">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-[15px] font-black text-pos-ink max-[760px]:text-[13px]">
            Danh sách đơn
          </h3>
          <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-pos-muted max-[760px]:hidden">
            {dateRangeLabel}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-pos-surface2 px-2 py-1 text-xs font-black text-pos-muted max-[760px]:text-[11px]">
          {rows.length}/{total}
        </span>
      </div>

      <div className="min-h-0 overflow-auto p-2 max-[760px]:p-1.5">
        {isLoading ? (
          <div className="grid gap-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-[76px] rounded-[9px] bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] animate-[skeleton-shimmer_1.4s_infinite]"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="grid h-full min-h-[220px] place-items-center content-center gap-3 text-center text-pos-muted">
            <AlertTriangle size={32} color="#b45309" />
            <p className="m-0 px-4 text-sm">{toToastError(error)}</p>
            <button
              type="button"
              onClick={onRetry}
              className="min-h-9 rounded-[8px] border border-pos-line bg-white px-3 text-sm font-black text-pos-ink hover:border-pos-primary"
            >
              Tải lại
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="grid h-full min-h-[220px] place-items-center content-center gap-3 text-center text-pos-muted">
            <ReceiptText size={34} color="#94a3b8" />
            <p className="m-0 px-4 text-sm">Không có đơn phù hợp với bộ lọc hiện tại.</p>
            <button
              type="button"
              onClick={onClearFilters}
              className="min-h-9 rounded-[8px] border border-pos-line bg-white px-3 text-sm font-black text-pos-ink hover:border-pos-primary"
            >
              Xem hôm nay
            </button>
          </div>
        ) : (
          <div className="grid gap-2">
            {rows.map((order) => (
              <button
                type="button"
                key={order.id}
                data-testid={`history-row-${order.id}`}
                onClick={() => onSelect(order.id)}
                className={clsx(
                  "grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-[9px] border px-3 py-2 text-left transition-[border-color,background,box-shadow] max-[760px]:min-h-[68px] max-[760px]:px-2 max-[760px]:py-1.5",
                  selectedId === order.id
                    ? "border-pos-primary bg-pos-primarySoft shadow-[inset_3px_0_0_var(--primary)]"
                    : "border-pos-line bg-white hover:border-pos-primaryLine hover:bg-pos-surface2",
                )}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <strong className="truncate text-[18px] font-black text-pos-ink max-[760px]:text-[14px]">
                      #{order.orderNo}
                    </strong>
                    <span
                      className={clsx(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-black max-[760px]:px-1.5 max-[760px]:text-[10px]",
                        statusClass[order.status],
                      )}
                    >
                      {statusLabel[order.status]}
                    </span>
                  </div>
                  <div className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-xs font-semibold text-pos-muted max-[760px]:text-[11px]">
                    <span className="truncate">{order.tableLabel}</span>
                    <span className="max-[700px]:hidden">·</span>
                    <span className="truncate max-[700px]:hidden">{order.createdAt}</span>
                  </div>
                </div>
                <div className="grid justify-items-end gap-1 text-right">
                  <strong className="whitespace-nowrap text-[16px] font-black text-pos-primary max-[760px]:text-[13px]">
                    {formatMoney(order.total)}
                  </strong>
                  <span className="rounded-full bg-pos-surface2 px-2 py-0.5 text-[11px] font-black text-pos-muted max-[700px]:hidden">
                    {order.orderType === "takeaway" ? "Mang đi" : "Tại bàn"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-h-[48px] items-center justify-between gap-2 border-t border-pos-line px-3 py-2 max-[760px]:min-h-[40px] max-[760px]:px-2">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="inline-flex min-h-8 items-center gap-1 rounded-[8px] border border-pos-line bg-white px-2.5 text-xs font-black text-pos-ink hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-40 max-[760px]:px-1.5"
        >
          <ChevronLeft size={15} />
          <span className="max-[700px]:hidden">Trước</span>
        </button>
        <span className="text-xs font-black text-pos-muted">
          Trang {page}/{totalPages}
        </span>
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="inline-flex min-h-8 items-center gap-1 rounded-[8px] border border-pos-line bg-white px-2.5 text-xs font-black text-pos-ink hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-40 max-[760px]:px-1.5"
        >
          <span className="max-[700px]:hidden">Sau</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </section>
  );
}
