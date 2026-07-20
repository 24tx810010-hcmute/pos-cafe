import { AlertTriangle, Banknote, CreditCard, Landmark, QrCode, ReceiptText } from "lucide-react";
import clsx from "clsx";
import { Button } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { hasPermission } from "@/core/guards";
import { formatVnd } from "@/core/money";
import type { PaymentSelection } from "@/features/pos";
import {
  buildPayableLines,
  clampSelection,
  fullSelection,
  isFullSelection,
  selectionAmount,
  useFloorPlanQuery,
  useOrderDetailQuery,
  usePayOrderItemsMutation,
} from "@/features/pos";
import { notifyUiError, toToastError } from "../../appErrors";
import { PortalDrawer } from "../../components/PortalDrawer";
import { ticketFromOrderDetail } from "../../components/ReceiptPreview";
import { useAppStore } from "../../useAppStore";
import { PaymentCashierPane } from "./PaymentCashierPane";
import { PaymentSummaryPane } from "./PaymentSummaryPane";
import {
  PaymentHeader,
  PaymentState,
  getOrderTypeLabel,
  paymentButtonText,
  type PaymentMethodOption,
} from "./paymentShared";

export function PaymentDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const openReceiptPreview = useAppStore((state) => state.openReceiptPreview);
  const paymentOrderId = useAppStore((state) => state.paymentOrderId);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const floorPlanQuery = useFloorPlanQuery();
  const orderQuery = useOrderDetailQuery(paymentOrderId);
  const payMutation = usePayOrderItemsMutation();
  const order = orderQuery.data;
  const [receivedAmountInput, setReceivedAmountInput] = useState("0");
  const [printReceipt, setPrintReceipt] = useState(true);

  // Instant pay: selection = món/số lượng trả lần này. Mặc định "Chọn tất cả".
  const payableLines = useMemo(() => (order ? buildPayableLines(order) : []), [order]);
  const [selection, setSelection] = useState<PaymentSelection>({});
  const orderStamp = order ? `${order.id}:${order.lockVersion}` : null;
  const lastStampRef = useRef<string | null>(null);

  useEffect(() => {
    if (!order || !orderStamp || orderStamp === lastStampRef.current) return;
    const sameOrder = lastStampRef.current?.startsWith(`${order.id}:`) ?? false;
    lastStampRef.current = orderStamp;
    setSelection((previous) => {
      // Đơn đổi phiên bản (máy khác sửa / vừa trả một phần): kẹp selection về dữ
      // liệu mới; nếu không còn gì hợp lệ thì quay về mặc định "Chọn tất cả".
      const next = sameOrder ? clampSelection(payableLines, previous) : fullSelection(payableLines);
      return Object.keys(next).length > 0 ? next : fullSelection(payableLines);
    });
  }, [order, orderStamp, payableLines]);

  const amountDue = selectionAmount(payableLines, selection);
  const selectAllChecked = isFullSelection(payableLines, selection);

  useEffect(() => {
    setReceivedAmountInput(String(amountDue));
  }, [order?.id, amountDue]);

  const table = order?.tableId ? floorPlanQuery.data?.tables.find((candidate) => candidate.id === order.tableId) : null;
  const receivedAmount = Number.parseInt(receivedAmountInput || "0", 10) || 0;
  const orderTotal = order?.total ?? 0;
  const changeAmount = receivedAmount - amountDue;
  const insufficient = receivedAmount < amountDue;
  const orderClosed = !!order && order.status !== "open";
  const orderItemCount = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const nothingSelected = !!order && !orderClosed && amountDue <= 0;
  const paymentPermissionDenied = !hasPermission(currentEmployee, "payment.take");
  const paymentPermissionTitle = paymentPermissionDenied ? "Không có quyền thanh toán" : undefined;
  const paymentDisabled =
    !order ||
    orderClosed ||
    orderQuery.isError ||
    insufficient ||
    nothingSelected ||
    paymentPermissionDenied ||
    payMutation.isPending;
  const paymentButtonLabel = orderClosed
    ? order.status === "paid"
      ? "Đơn đã thanh toán"
      : "Đơn đã đóng"
    : payMutation.isPending
      ? "Đang xử lý..."
      : selectAllChecked
        ? "Hoàn tất thanh toán"
        : "Thanh toán món đã chọn";

  const orderLocationLabel = table ? `Bàn ${table.name}` : getOrderTypeLabel(order);
  const headerMeta = [
    `Thu ngân: ${currentEmployee?.name ?? "Chưa đăng nhập"}`,
    order ? orderLocationLabel : null,
    order ? `${orderItemCount} món` : null,
  ].filter(Boolean);

  const paymentMethods = useMemo<PaymentMethodOption[]>(
    () => [
      { id: "cash", label: "Tiền mặt", description: "Đang chọn", icon: Banknote, active: true },
      { id: "card", label: "Thẻ", description: "Chưa bật", icon: CreditCard, active: false },
      { id: "transfer", label: "Chuyển khoản", description: "Chưa bật", icon: Landmark, active: false },
      { id: "qr", label: "QR", description: "Chưa bật", icon: QrCode, active: false },
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

  const printProvisional = () => {
    if (!order) return;
    openReceiptPreview({ variant: "ticket", doc: ticketFromOrderDetail(order, table?.name ?? null) });
  };

  const reloadOrder = () => {
    void orderQuery.refetch();
    void floorPlanQuery.refetch();
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelection(checked ? fullSelection(payableLines) : {});
  };

  const toggleLine = (orderItemId: string) => {
    setSelection((previous) => {
      const next = { ...previous };
      if (next[orderItemId]) {
        delete next[orderItemId];
        return next;
      }
      const line = payableLines.find((candidate) => candidate.orderItemId === orderItemId);
      if (line) next[orderItemId] = 1;
      return next;
    });
  };

  // Nút "+": tăng số lượng trả lần này, chạm trần thì quay về 1 (một nút, hợp tablet).
  const cycleLineQuantity = (orderItemId: string) => {
    const line = payableLines.find((candidate) => candidate.orderItemId === orderItemId);
    if (!line) return;
    setSelection((previous) => {
      const current = previous[orderItemId] ?? 0;
      const next = current + 1 > line.quantity ? 1 : current + 1;
      return { ...previous, [orderItemId]: next };
    });
  };

  const payOrder = () => {
    if (!order || !currentEmployee) return;

    if (orderClosed) {
      toast("Đơn này đã được cập nhật trên thiết bị khác.");
      return;
    }

    payMutation.mutate(
      { order, actor: currentEmployee, receivedAmount, selection, printReceipt },
      {
        onSuccess: (result) => {
          // In bill từ payload trả về ngay trong mutation (không chờ refetch).
          if (printReceipt) {
            openReceiptPreview({ variant: "receipt", doc: result.receipt });
          }
          if (result.mode === "full") {
            toast.success("Đã thanh toán. Bàn đã trống.");
            closeDrawer();
            return;
          }
          // Tách đơn: các món được chọn thành đơn #N đã thanh toán; đơn gốc còn lại trên bàn.
          toast.success(
            `Đã tách và thanh toán đơn #${result.orderNo} (${formatVnd(result.total)}). Bàn còn ${formatVnd(result.sourceTotal)}.`,
          );
          // Xoá selection để effect đồng bộ đưa về mặc định "Chọn tất cả" phần còn lại.
          setSelection({});
          void orderQuery.refetch();
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
            title={paymentPermissionTitle}
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
            <PaymentCashierPane
              cashierName={currentEmployee?.name ?? "Thu ngân"}
              paymentMethods={paymentMethods}
              receivedAmount={receivedAmount}
              receivedAmountInput={receivedAmountInput}
              insufficient={insufficient}
              changeAmount={changeAmount}
              orderTotal={amountDue}
              onAmountChange={handleAmountChange}
              onSetReceivedAmount={setReceivedAmount}
              onAppendKey={appendKey}
              onDeleteDigit={deleteLastDigit}
            />

            <PaymentSummaryPane
              order={order}
              payableLines={payableLines}
              selection={selection}
              selectAllChecked={selectAllChecked}
              amountDue={amountDue}
              orderClosed={orderClosed}
              receivedAmount={receivedAmount}
              changeAmount={changeAmount}
              orderTotal={orderTotal}
              insufficient={insufficient}
              printReceipt={printReceipt}
              paymentDisabled={paymentDisabled}
              paymentButtonLabel={paymentButtonLabel}
              paymentButtonTitle={paymentPermissionTitle}
              isError={orderQuery.isError}
              onToggleSelectAll={toggleSelectAll}
              onToggleLine={toggleLine}
              onCycleLineQuantity={cycleLineQuantity}
              onReloadOrder={reloadOrder}
              onTogglePrint={setPrintReceipt}
              onPrintProvisional={printProvisional}
              onPay={payOrder}
            />
          </div>
        )}
      </div>
    </PortalDrawer>
  );
}
