import { AlertTriangle, Banknote, CreditCard, Delete, Landmark, Printer, QrCode, ReceiptText } from "lucide-react";
import clsx from "clsx";
import { Button } from "@mui/material";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { formatVnd } from "@/core/money";
import type { OrderDetail } from "@/domain";
import { useFloorPlanQuery, useOrderDetailQuery, usePayOrderMutation } from "@/features/pos";
import { notifyUiError, toToastError } from "../../appErrors";
import { PortalDrawer } from "../../components/PortalDrawer";
import { useAppStore } from "../../useAppStore";

const keypadKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "00", "0"] as const;

const paymentText = {
  amountHeader: "text-[12px] min-[1024px]:text-[15px] min-[1280px]:text-[16px]",
  body: "text-[13px] min-[1024px]:text-[15px] min-[1280px]:text-[16px]",
  emphasis: "text-[16px] min-[1024px]:text-[17px]",
  micro: "text-[12px] min-[1024px]:text-[13px] min-[1280px]:text-[14px]",
  secondary: "text-[12px] min-[1024px]:text-[14px] min-[1280px]:text-[15px]",
  strong: "text-[15px] min-[1024px]:text-[16px] min-[1280px]:text-[17px]",
} as const;

const paymentButtonText = {
  body: "!text-[13px] min-[1024px]:!text-[15px] min-[1280px]:!text-[16px]",
  emphasis: "!text-[16px] min-[1024px]:!text-[17px]",
} as const;

const paymentSummaryValueClass =
  clsx("min-w-[118px] text-right font-black leading-tight text-pos-ink max-[900px]:min-w-[96px]", paymentText.strong);

const getOrderTypeLabel = (order?: OrderDetail | null) => (order?.orderType === "takeaway" ? "Mang đi" : "Tại bàn");

const formatAmountInputValue = (rawDigits: string) => {
  const normalized = rawDigits.replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export function PaymentDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const paymentOrderId = useAppStore((state) => state.paymentOrderId);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const floorPlanQuery = useFloorPlanQuery();
  const orderQuery = useOrderDetailQuery(paymentOrderId);
  const payMutation = usePayOrderMutation();
  const order = orderQuery.data;
  const [receivedAmountInput, setReceivedAmountInput] = useState("0");
  const [printReceipt, setPrintReceipt] = useState(true);

  useEffect(() => {
    if (order) setReceivedAmountInput(String(order.total));
  }, [order?.id, order?.total]);

  const table = order?.tableId ? floorPlanQuery.data?.tables.find((candidate) => candidate.id === order.tableId) : null;
  const receivedAmount = Number.parseInt(receivedAmountInput || "0", 10) || 0;
  const orderTotal = order?.total ?? 0;
  const changeAmount = receivedAmount - orderTotal;
  const insufficient = receivedAmount < orderTotal;
  const orderClosed = !!order && order.status !== "open";
  const orderItemCount = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const paymentDisabled = !order || orderClosed || orderQuery.isError || insufficient || payMutation.isPending;
  const paymentButtonLabel = orderClosed
    ? order.status === "paid"
      ? "Đơn đã thanh toán"
      : "Đơn đã đóng"
    : payMutation.isPending
      ? "Đang xử lý..."
      : "Hoàn tất thanh toán";

  const orderLocationLabel = table ? `Bàn ${table.name}` : getOrderTypeLabel(order);
  const headerMeta = [
    `Thu ngân: ${currentEmployee?.name ?? "Chưa đăng nhập"}`,
    order ? orderLocationLabel : null,
    order ? `${orderItemCount} món` : null,
  ].filter(Boolean);

  const paymentMethods = useMemo(
    () => [
      {
        id: "cash",
        label: "Tiền mặt",
        description: "Đang chọn",
        icon: Banknote,
        active: true,
      },
      {
        id: "card",
        label: "Thẻ",
        description: "Chưa bật",
        icon: CreditCard,
        active: false,
      },
      {
        id: "transfer",
        label: "Chuyển khoản",
        description: "Chưa bật",
        icon: Landmark,
        active: false,
      },
      {
        id: "qr",
        label: "QR",
        description: "Chưa bật",
        icon: QrCode,
        active: false,
      },
    ],
    [],
  );

  const setReceivedAmount = (value: number) => {
    setReceivedAmountInput(String(Math.max(0, Math.floor(value))));
  };

  const handleAmountChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    setReceivedAmountInput(digits ? String(Number(digits)) : "0");
  };

  const appendKey = (key: string) => {
    setReceivedAmountInput((current) => {
      const normalized = current.replace(/^0+(?=\d)/, "") || "0";
      const next = normalized === "0" ? key : `${normalized}${key}`;
      return String(Number(next.slice(0, 9)));
    });
  };

  const deleteLastDigit = () => {
    setReceivedAmountInput((current) => (current.length > 1 ? current.slice(0, -1) : "0"));
  };

  const payOrder = () => {
    if (!order || !currentEmployee) return;

    if (orderClosed) {
      toast("Đơn này đã được cập nhật trên thiết bị khác.");
      return;
    }

    payMutation.mutate(
      { order, employeeId: currentEmployee.id, receivedAmount, printReceipt },
      {
        onSuccess: () => {
          toast.success("Đã thanh toán. Bàn đã trống.");
          closeDrawer();
        },
        onError: (error) => {
          const uiError = notifyUiError(error);
          if (uiError.action === "reloadOrder") {
            void orderQuery.refetch();
            void floorPlanQuery.refetch();
          }
        },
      },
    );
  };

  if (!paymentOrderId) {
    return (
      <PortalDrawer testId="payment-drawer" onOutsideClick={closeDrawer}>
        <PaymentHeader title="Thanh toán" onClose={closeDrawer} />
        <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2">
          <p className="p-4 text-pos-muted">Không tìm thấy đơn.</p>
        </div>
      </PortalDrawer>
    );
  }

  return (
    <PortalDrawer testId="payment-drawer" onOutsideClick={closeDrawer}>
      <PaymentHeader
        title={`Thanh toán · Đơn #${order?.orderNo ?? "..."}`}
        meta={headerMeta.join(" · ")}
        onClose={closeDrawer}
        action={
          <Button
            variant="contained"
            data-testid="pay-button"
            disabled={paymentDisabled}
            onClick={payOrder}
            color={insufficient ? "error" : "primary"}
            className={clsx(
              "!min-h-9 !whitespace-nowrap max-[900px]:!hidden max-[900px]:!min-h-[30px] max-[900px]:!px-2.5",
              paymentButtonText.emphasis,
            )}
          >
            {paymentButtonLabel}
          </Button>
        }
      />

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[900px]:p-1.5">
        {orderQuery.isLoading ? (
          <PaymentState testId="payment-loading-state" icon={<ReceiptText size={32} color="#94a3b8" />}>
            <p>Đang tải đơn thanh toán...</p>
          </PaymentState>
        ) : orderQuery.isError ? (
          <PaymentState testId="payment-error-state" icon={<AlertTriangle size={32} color="#b45309" />}>
            <strong>Không tải được đơn thanh toán</strong>
            <p>{toToastError(orderQuery.error)}</p>
            <Button variant="contained" size="small" onClick={() => void orderQuery.refetch()}>
              Thử tải lại
            </Button>
          </PaymentState>
        ) : (
          <div className="grid h-full min-h-0 min-w-[720px] grid-cols-[minmax(420px,1fr)_minmax(272px,330px)] gap-3 max-[900px]:grid-cols-[minmax(414px,1fr)_minmax(268px,300px)] max-[900px]:gap-1.5">
            <section
              data-testid="payment-cashier-console"
              className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface"
            >
              <PanelTitle
                title="Thu tiền"
                subtitle={`${currentEmployee?.name ?? "Thu ngân"} kiểm tra và nhập số tiền khách đưa`}
              />
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
                        onChange={(event) => handleAmountChange(event.target.value)}
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
                    <QuickAmountButtons total={orderTotal} receivedAmount={receivedAmount} onSelect={setReceivedAmount} />
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
                        onClick={() => appendKey(key)}
                      >
                        {key}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="grid min-h-[46px] place-items-center rounded-pos border border-pos-line bg-white text-pos-ink shadow-sm transition hover:border-pos-danger hover:bg-[#fff1f2] max-[900px]:min-h-[30px]"
                      onClick={deleteLastDigit}
                      aria-label="Xóa một số"
                    >
                      <Delete size={22} />
                    </button>
                  </div>
                </div>
              </div>
            </section>

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
                  <h3 className={clsx("m-0 font-black leading-tight text-pos-ink", paymentText.strong)}>Món trong đơn</h3>
                  <span className={clsx("font-bold text-pos-muted", paymentText.micro)}>{orderItemCount} món</span>
                </div>
                <div data-testid="payment-order-items" className="min-h-0 overflow-y-auto px-3 py-2 max-[900px]:px-2 max-[900px]:py-1.5">
                  <OrderItems order={order} />
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
                      onClick={() => {
                        void orderQuery.refetch();
                        void floorPlanQuery.refetch();
                      }}
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
                  <div className="my-1 border-t border-pos-line" />
                  <div className="flex items-end justify-between gap-3">
                    <span className={clsx("font-black text-pos-muted", paymentText.secondary)}>Tổng đơn</span>
                    <strong className={clsx("text-right font-black leading-none text-pos-primary", paymentText.emphasis)}>
                      {formatVnd(orderTotal)}
                    </strong>
                  </div>
                </div>

                <label className={clsx("mt-3 flex cursor-pointer items-center gap-2 rounded-pos border border-pos-line bg-pos-bg px-3 py-2 font-bold text-pos-ink max-[900px]:mt-2 max-[900px]:px-2 max-[900px]:py-1.5", paymentText.secondary)}>
                  <input
                    type="checkbox"
                    data-testid="print-receipt-checkbox"
                    checked={printReceipt}
                    onChange={(event) => setPrintReceipt(event.target.checked)}
                    className="size-4 accent-pos-primary"
                  />
                  <Printer size={16} />
                  <span>In hóa đơn sau khi thanh toán</span>
                </label>

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  data-testid="pay-button-footer"
                  disabled={paymentDisabled}
                  onClick={payOrder}
                  className={clsx(
                    "!mt-3 !min-h-[46px] !rounded-pos !font-extrabold max-[900px]:!mt-2 max-[900px]:!min-h-[38px]",
                    paymentButtonText.emphasis,
                  )}
                >
                  {paymentButtonLabel}
                </Button>
              </section>
            </aside>
          </div>
        )}
      </div>
    </PortalDrawer>
  );
}

function PaymentHeader({
  title,
  meta,
  onClose,
  action,
}: {
  title: string;
  meta?: string;
  onClose: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[900px]:min-h-[44px] max-[900px]:gap-1.5 max-[900px]:px-2 max-[900px]:py-1.5">
      <div className="grid min-w-0 flex-[1_1_260px] gap-1">
        <h2 className={clsx("m-0 truncate font-black leading-tight tracking-normal text-pos-ink", paymentText.emphasis)}>
          {title}
        </h2>
        {meta && <p className={clsx("m-0 truncate font-bold text-pos-muted", paymentText.micro)}>{meta}</p>}
      </div>
      <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2">
        <Button
          variant="outlined"
          onClick={onClose}
          className={clsx("!min-h-9 !whitespace-nowrap max-[900px]:!min-h-[30px] max-[900px]:!px-2.5", paymentButtonText.body)}
        >
          Quay lại
        </Button>
        {action}
      </div>
    </header>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-pos-line bg-[#fbfcfd] px-4 py-2.5 max-[900px]:min-h-[34px] max-[900px]:px-2.5 max-[900px]:py-1.5">
      <div className="min-w-0">
        <h3 className={clsx("m-0 truncate font-black leading-tight text-pos-ink", paymentText.strong)}>{title}</h3>
        <p className={clsx("m-0 mt-0.5 truncate font-bold text-pos-muted max-[900px]:hidden", paymentText.body)}>{subtitle}</p>
      </div>
    </div>
  );
}

function PaymentState({ testId, icon, children }: { testId: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted"
      data-testid={testId}
    >
      {icon}
      {children}
    </div>
  );
}

function QuickAmountButtons({
  total,
  receivedAmount,
  onSelect,
}: {
  total: number;
  receivedAmount: number;
  onSelect: (value: number) => void;
}) {
  const options = [
    { label: "Đúng tiền", value: total },
    { label: "+20k", value: total + 20000 },
    { label: "+50k", value: total + 50000 },
    { label: "200k", value: 200000 },
    { label: "500k", value: 500000 },
  ];

  return (
    <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-1.5 max-[900px]:gap-1">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          className={clsx(
            "min-h-[34px] rounded-[7px] border px-1 text-center font-black leading-[1.15] transition hover:border-pos-primary max-[900px]:min-h-[30px]",
            paymentText.body,
            receivedAmount === option.value
              ? "border-pos-primary bg-pos-primarySoft text-pos-primary"
              : "border-pos-line bg-white text-pos-ink",
          )}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function OrderItems({ order }: { order?: OrderDetail | null }) {
  if (!order?.items.length) {
    return <p className={clsx("m-0 p-3 text-center text-pos-muted", paymentText.secondary)}>Chưa có món trong đơn.</p>;
  }

  return (
    <div className="grid gap-2">
      {order.items.map((item) => {
        const optionText = item.options.map((option) => option.optionName).filter(Boolean).join(", ");
        const lineTotal = (item.unitPrice + item.options.reduce((sum, option) => sum + option.priceDelta, 0)) * item.quantity;

        return (
          <article key={item.id} className="rounded-pos border border-pos-line bg-white px-3 py-2 max-[900px]:px-2 max-[900px]:py-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="min-w-0">
                <h4 className={clsx("m-0 truncate font-black leading-tight text-pos-ink", paymentText.strong)}>
                  {item.itemName}
                </h4>
                {optionText && (
                  <p className={clsx("m-0 mt-0.5 truncate font-bold text-pos-muted", paymentText.micro)}>
                    {optionText}
                  </p>
                )}
              </div>
              <strong className={clsx("font-black text-pos-ink", paymentText.strong)}>x{item.quantity}</strong>
            </div>
            <div className={clsx("mt-1 flex items-center justify-between gap-2 font-bold", paymentText.micro)}>
              <span className="text-pos-muted">{formatVnd(item.unitPrice)}</span>
              <span className="text-pos-primary">{formatVnd(lineTotal)}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value, valueTestId }: { label: string; value: string; valueTestId: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={clsx("font-black text-pos-muted", paymentText.secondary)}>{label}</span>
      <strong className={paymentSummaryValueClass} data-testid={valueTestId}>
        {value}
      </strong>
    </div>
  );
}
