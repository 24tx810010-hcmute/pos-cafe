import clsx from "clsx";
import { AlertTriangle, Delete } from "lucide-react";
import { formatVnd } from "@/core/money";
import {
  PanelTitle,
  QuickAmountButtons,
  formatAmountInputValue,
  keypadKeys,
  paymentText,
  type PaymentMethodOption,
} from "./paymentShared";

interface PaymentCashierPaneProps {
  cashierName: string;
  paymentMethods: PaymentMethodOption[];
  receivedAmount: number;
  receivedAmountInput: string;
  insufficient: boolean;
  changeAmount: number;
  orderTotal: number;
  onAmountChange: (value: string) => void;
  onSetReceivedAmount: (value: number) => void;
  onAppendKey: (key: string) => void;
  onDeleteDigit: () => void;
}

export function PaymentCashierPane({
  cashierName,
  paymentMethods,
  receivedAmount,
  receivedAmountInput,
  insufficient,
  changeAmount,
  orderTotal,
  onAmountChange,
  onSetReceivedAmount,
  onAppendKey,
  onDeleteDigit,
}: PaymentCashierPaneProps) {
  return (
    <section
      data-testid="payment-cashier-console"
      className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface"
    >
      <PanelTitle title="Thu tiền" subtitle={`${cashierName} kiểm tra và nhập số tiền khách đưa`} />
      <div className="grid min-h-0 grid-cols-[minmax(176px,0.36fr)_minmax(240px,1fr)] gap-3 overflow-hidden p-3 min-[1024px]:grid-cols-[minmax(220px,0.36fr)_minmax(260px,1fr)] max-[900px]:grid-cols-[156px_minmax(248px,1fr)] max-[900px]:gap-1.5 max-[900px]:p-1.5">
        <div data-testid="payment-method-list" className="min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-2 max-[900px]:gap-1.5">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.id}
                  type="button"
                  disabled={!method.active}
                  className={clsx(
                    "grid min-h-[58px] grid-cols-[34px_minmax(0,1fr)] items-center gap-2 rounded-pos border px-2.5 text-left transition max-[900px]:min-h-[44px] max-[900px]:grid-cols-[28px_minmax(0,1fr)] max-[900px]:gap-1.5 max-[900px]:px-1.5",
                    method.active
                      ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary shadow-[0_8px_20px_rgb(37_99_235_/_10%)]"
                      : "cursor-not-allowed border-pos-line bg-white text-pos-muted opacity-75",
                  )}
                >
                  <span
                    className={clsx(
                      "grid size-[34px] place-items-center rounded-[7px] max-[900px]:size-[28px]",
                      method.active ? "bg-pos-primary text-white" : "bg-pos-bg text-pos-muted",
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className={clsx("block truncate font-black leading-tight", paymentText.strong)}>
                      {method.label}
                    </span>
                    <span className={clsx("mt-0.5 block truncate font-bold leading-tight text-current opacity-80", paymentText.micro)}>
                      {method.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden max-[900px]:gap-2">
          <section className="grid gap-1.5 rounded-pos border border-pos-line bg-white p-3 max-[900px]:gap-1 max-[900px]:p-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                className={clsx("font-black uppercase tracking-[0.06em] text-pos-muted", paymentText.amountHeader)}
                htmlFor="payment-received-amount"
              >
                Tiền khách đưa
              </label>
              <span className={clsx("truncate font-bold text-pos-muted", paymentText.amountHeader)}>
                {formatVnd(receivedAmount)}
              </span>
            </div>
            <div
              className={clsx(
                "grid grid-cols-[minmax(0,1fr)_44px] overflow-hidden rounded-[8px] border bg-pos-bg",
                insufficient ? "border-pos-danger" : "border-pos-line",
              )}
            >
              <input
                id="payment-received-amount"
                value={formatAmountInputValue(receivedAmountInput)}
                onChange={(event) => onAmountChange(event.target.value)}
                inputMode="numeric"
                className={clsx(
                  "h-[48px] min-w-0 bg-transparent px-3 text-right font-black leading-none text-pos-ink outline-none max-[900px]:h-[34px] max-[900px]:px-2",
                  paymentText.emphasis,
                )}
              />
              <span className={clsx("grid place-items-center border-l border-pos-line font-black text-pos-muted", paymentText.micro)}>
                VND
              </span>
            </div>
          </section>

          {insufficient ? (
            <div
              className={clsx(
                "flex items-center gap-2 rounded-pos border border-[#fecaca] bg-[#fef2f2] px-3 py-2 font-bold text-pos-danger max-[900px]:px-2 max-[900px]:py-1.5",
                paymentText.body,
              )}
              data-testid="payment-insufficient-warning"
            >
              <AlertTriangle size={15} />
              <span>Còn thiếu {formatVnd(Math.abs(changeAmount))}.</span>
            </div>
          ) : (
            <QuickAmountButtons total={orderTotal} receivedAmount={receivedAmount} onSelect={onSetReceivedAmount} />
          )}

          <div data-testid="payment-keypad" className="grid min-h-0 grid-cols-3 gap-2 max-[900px]:gap-1">
            {keypadKeys.map((key) => (
              <button
                key={key}
                type="button"
                className={clsx(
                  "min-h-[46px] rounded-pos border border-pos-line bg-white font-black text-pos-ink shadow-sm transition hover:border-pos-primary hover:bg-pos-primarySoft max-[900px]:min-h-[30px]",
                  paymentText.emphasis,
                )}
                onClick={() => onAppendKey(key)}
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              className="grid min-h-[46px] place-items-center rounded-pos border border-pos-line bg-white text-pos-ink shadow-sm transition hover:border-pos-danger hover:bg-[#fff1f2] max-[900px]:min-h-[30px]"
              onClick={onDeleteDigit}
              aria-label="Xóa một số"
            >
              <Delete size={22} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
