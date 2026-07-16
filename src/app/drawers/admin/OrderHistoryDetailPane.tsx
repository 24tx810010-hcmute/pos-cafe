import clsx from "clsx";
import { AlertTriangle, Ban, CheckCircle2, Copy, Printer, ReceiptText, RefreshCw } from "lucide-react";
import { formatVndShort } from "@/core/money";
import type { OrderDetail, OrderPaymentSnapshot } from "@/domain";
import { voidReasonLabel, type HistoryOrderRow } from "@/features/pos/historyHelpers";
import { toToastError } from "../../appErrors";
import { IconButton, itemLineTotal, itemMeta, statusClass, statusLabel } from "./orderHistoryShared";

interface OrderHistoryDetailPaneProps {
  selected: HistoryOrderRow | null;
  detail: OrderDetail | null;
  payment: OrderPaymentSnapshot | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  cashierLabel: string;
  paymentMethodLabel: string;
  paidTimeLabel: string;
  canVoid: boolean;
  voidedByLabel: string;
  voidedTimeLabel: string;
  onReprint: () => void;
  onCopyOrderNo: () => void;
  onRetry: () => void;
  onVoid: () => void;
}

export function OrderHistoryDetailPane({
  selected,
  detail,
  payment,
  isLoading,
  isError,
  error,
  cashierLabel,
  paymentMethodLabel,
  paidTimeLabel,
  canVoid,
  voidedByLabel,
  voidedTimeLabel,
  onReprint,
  onCopyOrderNo,
  onRetry,
  onVoid,
}: OrderHistoryDetailPaneProps) {
  return (
    <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border border-pos-line bg-white">
      <div className="flex min-h-[54px] items-center justify-between gap-2 border-b border-pos-line px-3 py-2 max-[760px]:min-h-[44px] max-[760px]:px-2">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-[15px] font-black text-pos-ink max-[760px]:text-[13px]">
            {selected ? `Chi tiết đơn #${selected.orderNo}` : "Chi tiết đơn"}
          </h3>
          <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-pos-muted max-[760px]:hidden">
            {selected ? `${selected.tableLabel} · ${selected.createdAt}` : "Chọn một đơn bên trái"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <IconButton disabled={!selected || selected.status === "void"} label="In lại hóa đơn" onClick={onReprint}>
            <Printer size={16} />
          </IconButton>
          <IconButton disabled={!selected} label="Sao chép mã đơn" onClick={onCopyOrderNo}>
            <Copy size={16} />
          </IconButton>
          <IconButton disabled={!selected} label="Tải lại chi tiết" onClick={onRetry}>
            <RefreshCw size={16} />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 overflow-auto p-3 max-[760px]:p-2">
        {!selected ? (
          <div className="grid h-full min-h-[260px] place-items-center content-center gap-3 text-center text-pos-muted">
            <ReceiptText size={34} color="#94a3b8" />
            <p className="m-0 px-4 text-sm">Chọn một đơn để xem danh sách món và thông tin thanh toán.</p>
          </div>
        ) : isError ? (
          <div className="grid h-full min-h-[260px] place-items-center content-center gap-3 text-center text-pos-muted">
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
        ) : (
          <div className="grid gap-3">
            <div className="flex min-w-0 items-start justify-between gap-2 border-b border-pos-line pb-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <strong className="truncate text-[24px] font-black leading-tight text-pos-ink max-[760px]:text-[17px]">
                    #{selected.orderNo}
                  </strong>
                  <span
                    className={clsx(
                      "shrink-0 rounded-full border px-2 py-1 text-xs font-black max-[760px]:px-1.5 max-[760px]:py-0.5 max-[760px]:text-[10px]",
                      statusClass[selected.status],
                    )}
                  >
                    {statusLabel[selected.status]}
                  </span>
                </div>
                <p className="m-0 mt-1 text-xs font-semibold text-pos-muted max-[760px]:text-[11px]">
                  Ngày bán {selected.createdAt} · Thanh toán {paidTimeLabel}
                </p>
              </div>
              {selected.status === "paid" && <CheckCircle2 className="shrink-0 text-[#16a34a]" size={22} />}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs max-[760px]:gap-1.5">
              <div className="min-w-0 rounded-[8px] border border-pos-line bg-pos-surface2 px-2 py-1.5">
                <span className="block truncate font-bold text-pos-muted">Khách hàng</span>
                <strong className="block truncate text-[13px] text-pos-ink max-[760px]:text-xs">Khách lẻ</strong>
              </div>
              <div className="min-w-0 rounded-[8px] border border-pos-line bg-pos-surface2 px-2 py-1.5">
                <span className="block truncate font-bold text-pos-muted">Người thanh toán</span>
                <strong className="block truncate text-[13px] text-pos-ink max-[760px]:text-xs">Khách lẻ</strong>
              </div>
              <div className="min-w-0 rounded-[8px] border border-pos-line bg-pos-surface2 px-2 py-1.5">
                <span className="block truncate font-bold text-pos-muted">Thu ngân</span>
                <strong className="block truncate text-[13px] text-pos-ink max-[760px]:text-xs">{cashierLabel}</strong>
              </div>
              <div className="min-w-0 rounded-[8px] border border-pos-line bg-pos-surface2 px-2 py-1.5">
                <span className="block truncate font-bold text-pos-muted">Phương thức</span>
                <strong className="block truncate text-[13px] text-pos-ink max-[760px]:text-xs">{paymentMethodLabel}</strong>
              </div>
            </div>

            {selected.status === "void" && (
              <div
                data-testid="history-void-info"
                className="grid gap-1 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-pos-muted">Người hủy</span>
                  <strong className="truncate text-[13px] text-[#991b1b]">{voidedByLabel}</strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-pos-muted">Thời điểm hủy</span>
                  <strong className="truncate text-[13px] text-[#991b1b]">{voidedTimeLabel}</strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-pos-muted">Lý do</span>
                  <strong className="truncate text-[13px] text-[#991b1b]">{voidReasonLabel(detail?.voidReasonCode ?? null)}</strong>
                </div>
                {detail?.voidReasonNote && (
                  <p className="m-0 mt-0.5 border-t border-[#fecaca] pt-1 text-[11px] font-semibold text-pos-muted">
                    {detail.voidReasonNote}
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="m-0 text-sm font-black text-pos-ink max-[760px]:text-xs">
                  Danh sách món
                </h4>
                <span className="text-xs font-bold text-pos-muted">
                  {detail?.items.length ?? 0} món
                </span>
              </div>

              {isLoading ? (
                <div className="grid gap-2">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-[64px] rounded-[9px] bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] animate-[skeleton-shimmer_1.4s_infinite]"
                    />
                  ))}
                </div>
              ) : detail?.items.length ? (
                <div className="grid gap-2">
                  {detail.items.map((item) => {
                    const meta = itemMeta(item);
                    return (
                      <div
                        key={item.id}
                        className="grid min-h-[68px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-[9px] border border-pos-line bg-pos-surface2 px-2.5 py-2 max-[760px]:grid-cols-[34px_minmax(0,1fr)_auto] max-[760px]:gap-2 max-[760px]:px-2"
                      >
                        <div className="grid h-11 w-11 place-items-center rounded-[8px] border border-pos-line bg-white text-xs font-black text-pos-primary max-[760px]:h-[34px] max-[760px]:w-[34px]">
                          x{item.quantity}
                        </div>
                        <div className="min-w-0">
                          <strong className="block truncate text-sm font-black text-pos-ink max-[760px]:text-xs">
                            {item.itemName}
                          </strong>
                          <span className="mt-0.5 block truncate text-xs font-semibold text-pos-muted max-[760px]:text-[11px]">
                            {meta || "Không có tuỳ chọn"}
                          </span>
                        </div>
                        <strong className="whitespace-nowrap text-sm font-black text-pos-ink max-[760px]:text-xs">
                          {formatVndShort(itemLineTotal(item))}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="m-0 rounded-[9px] border border-pos-line bg-pos-surface2 p-3 text-sm font-semibold text-pos-muted">
                  Không có chi tiết món.
                </p>
              )}
            </div>

          </div>
        )}
      </div>

      <div
        data-testid="history-payment-summary"
        className="grid gap-1.5 border-t border-pos-line bg-white px-3 py-3 shadow-[0_-10px_28px_rgb(15_23_42_/_6%)] max-[760px]:px-2 max-[760px]:py-2"
      >
        <div className="flex items-center justify-between gap-3 text-sm max-[760px]:text-xs">
          <span data-testid="history-payment-label" className="font-bold text-pos-muted">
            Khách đưa
          </span>
          <strong className="whitespace-nowrap font-black text-pos-ink">
            {payment ? formatVndShort(payment.receivedAmount) : "Chưa ghi nhận"}
          </strong>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm max-[760px]:text-xs">
          <span data-testid="history-payment-label" className="font-bold text-pos-muted">
            Tiền thừa
          </span>
          <strong className="whitespace-nowrap font-black text-[#0f766e]">
            {payment ? formatVndShort(payment.changeAmount) : "Chưa ghi nhận"}
          </strong>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-pos-line pt-2">
          <span data-testid="history-payment-label" className="text-sm font-black text-pos-ink max-[760px]:text-xs">
            Tổng tiền
          </span>
          <strong className="whitespace-nowrap text-[24px] font-black text-pos-primary max-[760px]:text-[17px]">
            {formatVndShort(detail?.total ?? selected?.total ?? 0)}
          </strong>
        </div>

        {canVoid && selected?.status === "paid" && (
          <button
            type="button"
            data-testid="history-void-order"
            disabled={!detail}
            onClick={onVoid}
            className="mt-1 inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-[#fecaca] bg-[#fef2f2] px-3 text-sm font-black text-[#b91c1c] transition-colors hover:border-[#f87171] hover:bg-[#fee2e2] disabled:cursor-not-allowed disabled:opacity-40 max-[760px]:min-h-9 max-[760px]:text-xs"
          >
            <Ban size={16} />
            Hủy đơn
          </button>
        )}
      </div>
    </aside>
  );
}
