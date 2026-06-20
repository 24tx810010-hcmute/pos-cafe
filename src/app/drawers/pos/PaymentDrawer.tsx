import { AlertTriangle, CreditCard, ReceiptText } from "lucide-react";
import clsx from "clsx";
import { Button, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { formatVnd } from "@/core/money";
import { useFloorPlanQuery, useOrderDetailQuery, usePayOrderMutation } from "@/features/pos";
import { notifyUiError, toToastError } from "../../appErrors";
import { CartSnapshotList } from "../../components/CartSnapshotList";
import { useAppStore } from "../../useAppStore";

export function PaymentDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const paymentOrderId = useAppStore((state) => state.paymentOrderId);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const floorPlanQuery = useFloorPlanQuery();
  const orderQuery = useOrderDetailQuery(paymentOrderId);
  const payMutation = usePayOrderMutation();
  const order = orderQuery.data;
  const [receivedAmount, setReceivedAmount] = useState(0);

  useEffect(() => {
    if (order) setReceivedAmount(order.total);
  }, [order]);

  const changeAmount = receivedAmount - (order?.total ?? 0);
  const insufficient = receivedAmount < (order?.total ?? 0);
  const orderClosed = !!order && order.status !== "open";
  const paymentDisabled = !order || orderClosed || orderQuery.isError || insufficient || payMutation.isPending;
  const paymentButtonLabel = orderClosed
    ? order.status === "paid"
      ? "Đơn đã thanh toán"
      : "Đơn đã đóng"
    : payMutation.isPending
      ? "Đang xử lý..."
      : "Hoàn tất thanh toán";

  const table = order?.tableId ? floorPlanQuery.data?.tables.find((t) => t.id === order.tableId) : null;

  const payOrder = () => {
    if (!order || !currentEmployee) return;

    if (orderClosed) {
      toast("Đơn này đã được cập nhật trên thiết bị khác.");
      return;
    }

    payMutation.mutate(
      { order, employeeId: currentEmployee.id, receivedAmount },
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
      <section className="absolute inset-y-3 right-3 z-10 grid w-[min(88vw,1440px)] max-w-[calc(100vw-96px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface shadow-[0_22px_60px_rgb(15_23_42_/_18%)] max-[980px]:inset-y-0 max-[980px]:right-0 max-[980px]:w-full max-[980px]:max-w-none max-[980px]:rounded-none max-[980px]:border-y-0" data-testid="payment-drawer">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
          <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap"><h2>Thanh toán</h2></div>
          <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]"><Button variant="outlined" onClick={closeDrawer}>Đóng</Button></div>
        </header>
        <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2"><p className="text-pos-muted p-4">Không tìm thấy đơn.</p></div>
      </section>
    );
  }

  return (
    <section className="absolute inset-y-3 right-3 z-10 grid w-[min(88vw,1440px)] max-w-[calc(100vw-96px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface shadow-[0_22px_60px_rgb(15_23_42_/_18%)] max-[980px]:inset-y-0 max-[980px]:right-0 max-[980px]:w-full max-[980px]:max-w-none max-[980px]:rounded-none max-[980px]:border-y-0" data-testid="payment-drawer">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>Thanh toán · Đơn #{order?.orderNo ?? "..."}</h2>
          <p>
            {table ? `Bàn ${table.name}` : order?.orderType === "takeaway" ? "Mang đi" : "—"}
            {" · "}Xác nhận trước khi in biên lai
          </p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]">
          <Button variant="outlined" onClick={closeDrawer}>Quay lại</Button>
          <Button
            variant="contained"
            data-testid="pay-button"
            disabled={paymentDisabled}
            onClick={payOrder}
            color={insufficient ? "error" : "primary"}
          >
            {paymentButtonLabel}
          </Button>
        </div>
      </header>

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2">
        {orderQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted" data-testid="payment-loading-state">
            <ReceiptText size={32} color="#94a3b8" />
            <p>Đang tải đơn thanh toán...</p>
          </div>
        ) : orderQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted" data-testid="payment-error-state">
            <AlertTriangle size={32} color="#b45309" />
            <strong>Không tải được đơn thanh toán</strong>
            <p>{toToastError(orderQuery.error)}</p>
            <Button variant="contained" size="small" onClick={() => void orderQuery.refetch()}>
              Thử tải lại
            </Button>
          </div>
        ) : (
        <div className="grid h-full min-h-0 min-w-[620px] grid-cols-[minmax(280px,1fr)_minmax(260px,360px)] gap-2.5 max-[720px]:min-w-0 max-[720px]:grid-cols-1">
          {/* Main: bill summary (order info folded in) + receipt */}
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
            <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">Hoá đơn</div>
            <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2">
              <div className="mb-2 grid content-start gap-2.5 border-b border-pos-line px-1 pb-3 pt-1">
                <div className="flex items-center justify-between gap-2 text-[13px] [&_span]:text-pos-muted">
                  <span>Loại</span>
                  <strong>{order?.orderType === "takeaway" ? "Mang đi" : "Tại bàn"}</strong>
                </div>
                {table && (
                  <div className="flex items-center justify-between gap-2 text-[13px] [&_span]:text-pos-muted">
                    <span>Bàn</span>
                    <strong>{table.name}</strong>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 text-[13px] [&_span]:text-pos-muted">
                  <span>Đơn số</span>
                  <strong>#{order?.orderNo ?? "—"}</strong>
                </div>
                <div className="flex items-center justify-between gap-2 text-[13px] [&_span]:text-pos-muted">
                  <span>Nhân viên</span>
                  <strong>{currentEmployee?.name ?? "—"}</strong>
                </div>
                <div className="flex items-center justify-between gap-2 text-[13px] [&_span]:text-pos-muted">
                  <span>Ngày</span>
                  <strong>{order?.businessDate ?? new Date().toLocaleDateString("vi-VN")}</strong>
                </div>
                <div className="border-t border-pos-line" />
                <div className="flex items-center justify-between gap-2 text-[13px] [&_span]:text-pos-muted mt-1 text-sm">
                  <span>Tổng cần thu</span>
                  <strong className="font-black text-pos-primary text-xl font-black">{formatVnd(order?.total ?? 0)}</strong>
                </div>
              </div>
              {orderQuery.isLoading ? (
                <p className="text-pos-muted p-3">Đang tải đơn...</p>
              ) : (
                <CartSnapshotList order={order} />
              )}
            </div>
          </section>

          {/* Right: Payment controls */}
          <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface grid-rows-[auto_minmax(0,1fr)_auto]">
            <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">Thanh toán</div>
            <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2 grid content-start gap-3.5 p-3">
              {orderClosed && (
                <div className="mx-3.5 mt-2.5 flex items-center gap-2.5 rounded-pos border border-[#fbbf24] bg-[#fffbeb] px-3 py-2.5 text-[#92400e] [&_.MuiButton-root]:ml-auto [&_.MuiButton-root]:shrink-0 [&_p]:mb-0 [&_p]:mt-0.5 [&_p]:text-[13px] [&_p]:text-[#92400e]" data-testid="payment-closed-state">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Đơn đã được cập nhật</strong>
                    <p>Thiết bị khác đã thanh toán hoặc đóng đơn này. Tải lại để xem trạng thái mới nhất.</p>
                    <Button
                      size="small"
                      variant="outlined"
                      className="!mt-1"
                      onClick={() => { void orderQuery.refetch(); void floorPlanQuery.refetch(); }}
                    >
                      Tải lại đơn
                    </Button>
                  </div>
                </div>
              )}

              {/* Cash payment */}
              <div className="flex items-center gap-2 rounded-[7px] border border-pos-primaryLine bg-pos-primarySoft px-3 py-2 text-[13px] font-bold text-pos-primary">
                <CreditCard size={15} />
                <span>Thanh toán tiền mặt</span>
              </div>

              {/* Received amount */}
              <div className="grid gap-1">
                <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-pos-muted">Tiền khách đưa</label>
                <TextField
                  type="number"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(Math.max(0, Number(e.target.value)))}
                  size="small"
                  fullWidth
                  error={insufficient}
                  helperText=" "
                  inputProps={{ min: 0, step: 1000 }}
                />
              </div>

              {insufficient && (
                <div className="flex items-center gap-2 rounded-[7px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] font-bold text-pos-danger" data-testid="payment-insufficient-warning">
                  <AlertTriangle size={15} />
                  <span>Khách đưa chưa đủ. Còn thiếu {formatVnd(Math.abs(changeAmount))}.</span>
                </div>
              )}

              {/* Quick cash buttons */}
              <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-pos-muted">Chọn nhanh</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
                {[
                  { label: "Đúng tiền", value: order?.total ?? 0 },
                  { label: "+10k", value: (order?.total ?? 0) + 10000 },
                  { label: "+20k", value: (order?.total ?? 0) + 20000 },
                  { label: "+50k", value: (order?.total ?? 0) + 50000 },
                  { label: "100k", value: 100000 },
                  { label: "200k", value: 200000 },
                  { label: "500k", value: 500000 },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    className={clsx("cursor-pointer rounded-[7px] border border-pos-line bg-pos-surface px-1 py-1.5 text-center text-xs font-bold text-pos-ink transition-[border-color] hover:border-pos-primary", receivedAmount === opt.value && "border-pos-primary bg-pos-primarySoft text-pos-primary")}
                    onClick={() => setReceivedAmount(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Change */}
              <div className={clsx("grid gap-2 rounded-pos p-3", insufficient ? "border border-[#fda4af] bg-[#fff1f2]" : "border border-[#86efac] bg-[#f0fdf4]")}>
                <div className="flex justify-between text-[13px] [&_span]:text-pos-muted">
                  <span>Tổng cần thu</span>
                  <strong>{formatVnd(order?.total ?? 0)}</strong>
                </div>
                <div className="flex justify-between text-[13px] [&_span]:text-pos-muted">
                  <span>Khách đưa</span>
                  <strong>{formatVnd(receivedAmount)}</strong>
                </div>
                <div className="border-t border-current opacity-20" />
                <div className="flex justify-between text-[13px] [&_span]:text-pos-muted text-base font-extrabold">
                  <span>{insufficient ? "Còn thiếu" : "Tiền thối lại"}</span>
                  <strong className={clsx(insufficient ? "text-pos-danger" : "font-black text-pos-primary")}>
                    {formatVnd(Math.abs(changeAmount))}
                  </strong>
                </div>
              </div>
            </div>

            {/* Sticky complete button */}
            <div className="border-t border-pos-line bg-pos-surface p-2.5">
              <Button
                variant="contained"
                fullWidth
                size="large"
                data-testid="pay-button-footer"
                disabled={paymentDisabled}
                onClick={payOrder}
                className="!rounded-pos !text-base !font-extrabold"
              >
                {paymentButtonLabel}
              </Button>
            </div>
          </aside>
        </div>
        )}
      </div>
    </section>
  );
}
