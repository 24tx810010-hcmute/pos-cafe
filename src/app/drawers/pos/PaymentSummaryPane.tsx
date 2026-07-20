import clsx from "clsx";
import { AlertTriangle, Plus, Printer } from "lucide-react";
import { Button } from "@mui/material";
import { formatVnd } from "@/core/money";
import type { OrderDetail } from "@/domain";
import type { PayableLine, PaymentSelection } from "@/features/pos";
import {
  SummaryRow,
  getOrderTypeLabel,
  paymentButtonText,
  paymentText,
} from "./paymentShared";

interface PaymentSummaryPaneProps {
  order?: OrderDetail | null;
  payableLines: PayableLine[];
  selection: PaymentSelection;
  selectAllChecked: boolean;
  amountDue: number;
  orderClosed: boolean;
  receivedAmount: number;
  changeAmount: number;
  orderTotal: number;
  insufficient: boolean;
  printReceipt: boolean;
  paymentDisabled: boolean;
  paymentButtonLabel: string;
  paymentButtonTitle?: string;
  isError: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleLine: (orderItemId: string) => void;
  onCycleLineQuantity: (orderItemId: string) => void;
  onReloadOrder: () => void;
  onTogglePrint: (checked: boolean) => void;
  onPrintProvisional: () => void;
  onPay: () => void;
}

export function PaymentSummaryPane({
  order,
  payableLines,
  selection,
  selectAllChecked,
  amountDue,
  orderClosed,
  receivedAmount,
  changeAmount,
  orderTotal,
  insufficient,
  printReceipt,
  paymentDisabled,
  paymentButtonLabel,
  paymentButtonTitle,
  isError,
  onToggleSelectAll,
  onToggleLine,
  onCycleLineQuantity,
  onReloadOrder,
  onTogglePrint,
  onPrintProvisional,
  onPay,
}: PaymentSummaryPaneProps) {
  const selectedCount = payableLines.reduce((sum, line) => sum + (selection[line.orderItemId] ?? 0), 0);

  return (
    <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
      <section className="border-b border-pos-line bg-[#eef4ff] px-4 py-3 max-[900px]:px-3 max-[900px]:py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={clsx("m-0 font-black uppercase tracking-[0.06em] text-pos-muted", paymentText.secondary)}>
              Khách hàng
            </p>
            <strong className={clsx("mt-0.5 block truncate leading-tight text-pos-primary", paymentText.strong)}>
              Khách lẻ
            </strong>
          </div>
          <span className={clsx("rounded-full bg-white px-2.5 py-1 font-black text-pos-primary shadow-sm max-[900px]:px-2 max-[900px]:py-0.5", paymentText.micro)}>
            {getOrderTypeLabel(order)}
          </span>
        </div>
      </section>

      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-pos-line px-4 py-2.5 max-[900px]:px-3 max-[900px]:py-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              data-testid="pay-select-all"
              checked={selectAllChecked}
              disabled={orderClosed || payableLines.length === 0}
              onChange={(event) => onToggleSelectAll(event.target.checked)}
              className="size-4 accent-pos-primary"
            />
            <span className={clsx("font-black leading-tight text-pos-ink", paymentText.strong)}>Chọn tất cả</span>
          </label>
          <span className={clsx("font-bold text-pos-muted", paymentText.micro)}>{selectedCount} món đã chọn</span>
        </div>
        <div data-testid="payment-order-items" className="min-h-0 overflow-y-auto px-3 py-2 max-[900px]:px-2 max-[900px]:py-1.5">
          {payableLines.length === 0 ? (
            <p className={clsx("m-0 p-3 text-center text-pos-muted", paymentText.secondary)}>Chưa có món trong đơn.</p>
          ) : (
            <div className="grid gap-2">
              {payableLines.map((line) => {
                const selected = selection[line.orderItemId] ?? 0;
                return (
                  <article
                    key={line.orderItemId}
                    data-testid="pay-item-line"
                    className={clsx(
                      "rounded-pos border bg-white px-3 py-2 max-[900px]:px-2 max-[900px]:py-1.5",
                      selected > 0 ? "border-pos-primaryLine" : "border-pos-line",
                    )}
                  >
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                      <input
                        type="checkbox"
                        data-testid="pay-item-checkbox"
                        checked={selected > 0}
                        disabled={orderClosed}
                        onChange={() => onToggleLine(line.orderItemId)}
                        className="size-4 accent-pos-primary"
                      />
                      <div className="min-w-0">
                        <h4 className={clsx("m-0 truncate font-black leading-tight text-pos-ink", paymentText.strong)}>
                          {line.name}
                        </h4>
                        {(line.optionText || line.note) && (
                          <p className={clsx("m-0 mt-0.5 truncate font-bold text-pos-muted", paymentText.micro)}>
                            {[line.optionText, line.note ? `Ghi chú: ${line.note}` : ""].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <span className="flex items-center gap-1.5">
                        <span
                          data-testid="pay-item-quantity"
                          className={clsx(
                            "min-w-[44px] rounded-full border px-2 py-0.5 text-center font-black",
                            paymentText.micro,
                            selected > 0
                              ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary"
                              : "border-pos-line text-pos-muted",
                          )}
                        >
                          {selected}/{line.quantity}
                        </span>
                        <button
                          type="button"
                          data-testid="pay-item-plus"
                          aria-label={`Tăng số lượng thanh toán ${line.name}`}
                          disabled={orderClosed}
                          onClick={() => onCycleLineQuantity(line.orderItemId)}
                          className="grid size-7 place-items-center rounded-full border border-pos-line bg-white text-pos-primary transition hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus size={14} />
                        </button>
                      </span>
                    </div>
                    <div className={clsx("mt-1 flex items-center justify-between gap-2 font-bold", paymentText.micro)}>
                      <span className="text-pos-muted">{formatVnd(line.unitTotal)}</span>
                      <span className="text-pos-primary">{formatVnd(line.unitTotal * selected)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section data-testid="payment-order-summary" className="border-t border-pos-line bg-white p-4 max-[900px]:p-3">
        {orderClosed && (
          <div
            className="mb-2.5 rounded-pos border border-[#fbbf24] bg-[#fffbeb] px-3 py-2 text-[#92400e] max-[900px]:px-2 max-[900px]:py-1.5"
            data-testid="payment-closed-state"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={17} />
              <div className="min-w-0">
                <strong className={clsx("block leading-tight", paymentText.body)}>
                  Đơn đã được cập nhật
                </strong>
                <p className={clsx("m-0 mt-0.5 leading-snug", paymentText.secondary)}>
                  Tải lại để xem trạng thái mới nhất.
                </p>
              </div>
            </div>
            <Button
              size="small"
              variant="outlined"
              className={clsx("!mt-2 !min-h-7", paymentButtonText.body)}
              onClick={onReloadOrder}
            >
              Tải lại đơn
            </Button>
          </div>
        )}

        <div className="grid gap-2 max-[900px]:gap-1.5">
          <SummaryRow label="Khách đưa" value={formatVnd(receivedAmount)} valueTestId="payment-received-summary-value" />
          <SummaryRow
            label={insufficient ? "Còn thiếu" : "Tiền thối"}
            value={formatVnd(Math.abs(changeAmount))}
            valueTestId="payment-change-summary-value"
          />
          <SummaryRow label="Tổng đơn" value={formatVnd(orderTotal)} valueTestId="payment-order-total-value" />
          <div className="my-1 border-t border-pos-line" />
          <div className="flex items-end justify-between gap-3">
            <span className={clsx("font-black text-pos-muted", paymentText.secondary)}>Thanh toán lần này</span>
            <strong
              data-testid="payment-amount-due-value"
              className={clsx("text-right font-black leading-none text-pos-primary", paymentText.emphasis)}
            >
              {formatVnd(amountDue)}
            </strong>
          </div>
        </div>

        <label className={clsx("mt-3 flex cursor-pointer items-center gap-2 rounded-pos border border-pos-line bg-pos-bg px-3 py-2 font-bold text-pos-ink max-[900px]:mt-2 max-[900px]:px-2 max-[900px]:py-1.5", paymentText.secondary)}>
          <input
            type="checkbox"
            data-testid="print-receipt-checkbox"
            checked={printReceipt}
            onChange={(event) => onTogglePrint(event.target.checked)}
            className="size-4 accent-pos-primary"
          />
          <Printer size={16} />
          <span>In hóa đơn sau khi thanh toán</span>
        </label>

        <button
          type="button"
          data-testid="print-provisional-button"
          disabled={!order || isError}
          onClick={onPrintProvisional}
          className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-pos border border-pos-line bg-white px-4 text-sm font-bold text-pos-ink hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 max-[900px]:min-h-[36px]"
        >
          <Printer size={15} /> In tạm tính
        </button>

        <Button
          variant="contained"
          fullWidth
          size="large"
          data-testid="pay-button-footer"
          disabled={paymentDisabled}
          title={paymentButtonTitle}
          onClick={onPay}
          className={clsx(
            "!mt-3 !min-h-[46px] !rounded-pos !font-extrabold max-[900px]:!mt-2 max-[900px]:!min-h-[38px]",
            paymentButtonText.emphasis,
          )}
        >
          {paymentButtonLabel}
        </Button>
      </section>
    </aside>
  );
}
