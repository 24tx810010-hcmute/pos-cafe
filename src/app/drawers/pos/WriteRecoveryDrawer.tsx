import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@mui/material";
import type { OperationView, WriteOperationFilter, WriteStatus, WriteKind } from "@/domain";
import { formatVnd } from "@/core/money";
import { usePorts } from "@/features/shared/portsContext";
import { getWriteCoordinator, invalidateAfterOrderMutation, receiptToPrint, useWriteAttempt } from "@/features/pos";
import { PortalDrawer } from "../../components/PortalDrawer";
import { notifyUiError, toToastError } from "../../appErrors";
import { useAppStore } from "../../useAppStore";

const labels: Record<WriteStatus, string> = { pending: "Chưa thực hiện", applied: "Đã ghi thành công", rejected: "Đã từ chối", cancelled: "Đã hủy lệnh", expired: "Lệnh hết hạn" };
const kindLabel = (operation: OperationView) => operation.kind === "submit_order_changes"
  ? operation.action === "create" ? "Tạo đơn" : operation.action === "update" ? "Sửa đơn" : "Hủy đơn mở"
  : operation.kind === "pay_order" ? "Thanh toán toàn bộ" : operation.kind === "pay_order_items" ? "Thanh toán phần chọn" : "Hủy đơn đã thanh toán";

export function WriteRecoveryDrawer() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const close = useAppStore((state) => state.closeDrawer);
  const openPreview = useAppStore((state) => state.openReceiptPreview);
  const [status, setStatus] = useState<WriteStatus | "">("");
  const [orderId, setOrderId] = useState("");
  const [kind, setKind] = useState<WriteKind | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { online } = useWriteAttempt();
  const [cursor, setCursor] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filter: WriteOperationFilter = { ...(status ? { statuses: [status] } : {}), ...(orderId ? { orderId } : {}),
    ...(kind ? { kinds: [kind] } : {}), ...(from ? { registeredFrom: new Date(from).toISOString() } : {}),
    ...(to ? { registeredTo: new Date(to).toISOString() } : {}), limit: 50, cursor };
  const list = useQuery({ queryKey: ["write-recovery", "list", filter], queryFn: () => ports.write.list(filter), refetchInterval: 5_000, retry: false });
  const selected = useQuery({ queryKey: ["write-recovery", selectedId], queryFn: () => ports.write.get(selectedId!), enabled: !!selectedId, refetchInterval: 5_000, retry: false });
  const operation = selected.data;
  const current = useQuery({ queryKey: ["write-recovery", "current", operation?.payload.orderId],
    queryFn: () => ports.order.getOrder(operation!.payload.orderId), enabled: !!operation, refetchInterval: 5_000, retry: false });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => ports.employee.listActiveEmployees() });
  const employeeName = (id: string | null) => id ? employees.data?.find((employee) => employee.id === id)?.name ?? id : "Chưa ghi nhận";
  const action = useMutation({ retry: false, networkMode: "always",
    mutationFn: async (kind: "resume" | "cancel") => {
      if (!operation || !navigator.onLine) throw new Error("Cần kết nối để tra cứu và xử lý thao tác.");
      return kind === "resume" ? getWriteCoordinator(ports.write).resume(operation) : getWriteCoordinator(ports.write).cancel(operation);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["write-recovery"] });
      void invalidateAfterOrderMutation(queryClient, result.payload.orderId);
      // Recovery never opens a receipt or patches current order with historical R1.
    }, onError: notifyUiError,
  });
  const reprint = async () => {
    if (!operation?.result || !("receipt" in operation.result)) return;
    const receipt = operation.result.receipt;
    try {
      const fresh = await ports.order.getOrder(receipt.orderId);
      const document = await ports.order.getReceipt(receipt.orderId);
      if (useAppStore.getState().drawer !== "writeRecovery") return;
      openPreview({ variant: "receipt", doc: receiptToPrint(document.receipt, fresh.orderType), legacyMetadata: document.legacyMetadata });
    } catch (error) { notifyUiError(error); }
  };
  const payload = operation?.payload;
  return <PortalDrawer testId="write-recovery-drawer" onOutsideClick={close}>
    <header className="flex items-center justify-between border-b p-4"><h2 className="m-0 text-lg">Tra cứu thao tác trên server</h2><Button onClick={close}>Đóng</Button></header>
    <div className="overflow-auto p-4">
      <p>Đóng màn hình hoặc mất kết nối không hủy lệnh. Chỉ tiếp tục đúng thao tác đã chọn sau khi kiểm tra nội dung.</p>
      <div className="flex flex-wrap gap-3 py-2">
        <label>Trạng thái <select aria-label="Trạng thái thao tác" value={status} onChange={(event) => { setStatus(event.target.value as WriteStatus | ""); setCursor(undefined); }}><option value="">Tất cả</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Mã đơn <input aria-label="Mã đơn" value={orderId} onChange={(event) => { setOrderId(event.target.value); setCursor(undefined); }} /></label>
        <label>Loại thao tác <select aria-label="Loại thao tác" value={kind} onChange={(event) => { setKind(event.target.value as WriteKind | ""); setCursor(undefined); }}><option value="">Tất cả</option><option value="submit_order_changes">Tạo / sửa / hủy đơn mở</option><option value="pay_order">Thanh toán toàn bộ</option><option value="pay_order_items">Thanh toán phần chọn</option><option value="void_order">Hủy đơn đã thanh toán</option></select></label>
        <label>Từ <input type="datetime-local" aria-label="Đăng ký từ" value={from} onChange={(event) => { setFrom(event.target.value); setCursor(undefined); }} /></label>
        <label>Đến <input type="datetime-local" aria-label="Đăng ký đến" value={to} onChange={(event) => { setTo(event.target.value); setCursor(undefined); }} /></label>
        <Button onClick={() => void list.refetch()}>Tải lại</Button>
      </div>
      {list.isError && <p role="alert">{toToastError(list.error)}</p>}
      {!online && <p role="alert">Cần kết nối để tra cứu và xử lý thao tác.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Danh sách thao tác">{list.data?.items.map((item) => <button key={item.operationId} data-testid={`operation-${item.operationId}`} className={`mb-2 block w-full rounded border p-3 text-left ${selectedId === item.operationId ? "border-teal-600 bg-teal-50" : "bg-white"}`} onClick={() => setSelectedId(item.operationId)}>
          <strong>{kindLabel(item)} · {labels[item.status]}</strong><br />
          <span>{item.registeredAt} · {employeeName(item.initiatedByEmployeeId)}</span><br /><span className="break-all text-xs">Mã thao tác: {item.operationId}</span><br /><span className="break-all text-xs">Mã đơn: {item.payload.orderId}</span>
        </button>)}{list.data?.items.length === 0 && <p>Không tìm thấy thao tác phù hợp.</p>}
          <Button disabled={!cursor} onClick={() => setCursor(undefined)}>Trang đầu</Button><Button disabled={!list.data?.nextCursor} onClick={() => setCursor(list.data?.nextCursor ?? undefined)}>Trang tiếp</Button>
        </section>
        <section aria-label="Chi tiết thao tác" className="min-w-0 rounded border p-3">
          {selected.isError && <p role="alert">{toToastError(selected.error)}</p>}
          {!operation ? <p>Chọn một thao tác để xem nội dung đã lưu.</p> : <>
            <h3 data-testid="operation-status">{kindLabel(operation)} · {labels[operation.status]}</h3>
            <p className="break-all">Mã thao tác: {operation.operationId}</p>
            <p>Người khởi tạo: {employeeName(operation.initiatedByEmployeeId)}<br />Người thực hiện: {employeeName(operation.executedByEmployeeId)}<br />Người hủy lệnh: {employeeName(operation.cancelledByEmployeeId)}</p>
            <p>Đăng ký: {operation.registeredAt}<br />Hạn thực hiện lệnh: {operation.expiresAt}<br />Đã quyết định: {operation.decidedAt ?? "Chưa có"}</p>
            {operation.status === "pending" && <p className="font-bold text-amber-800">Chưa ghi giao dịch. Các số tiền bên dưới là nội dung dự kiến của lệnh.</p>}
            {payload && <div className="break-words text-sm"><p>Mã đơn: {payload.orderId} · Phiên bản xác nhận: {String(payload.expectedVersion)}</p>
              {"receivedAmount" in payload && <p>Tiền mặt nhận theo xác nhận: {formatVnd(payload.receivedAmount)}<br />Mã thanh toán: {payload.paymentId}</p>}
              {"lines" in payload && <ul>{payload.lines.map((line) => <li key={line.orderItemId}>Dòng {line.orderItemId}: {line.quantity} món</li>)}</ul>}
              {"newLines" in payload && <ul>{payload.newLines.map((line) => <li key={line.id}>Phần mới {line.menuItemId}: {line.quantity} × {formatVnd(line.quotedBasePrice)}{line.options.map((option) => <div key={option.id}>Tùy chọn {option.optionValueId}: {option.quantity} × {formatVnd(option.quotedPriceDelta)}</div>)}{line.note && <div>Ghi chú: {line.note}</div>}</li>)}</ul>}
              {"retainedLines" in payload && <ul>{payload.retainedLines.map((line) => <li key={line.sourceItemId}>Phần đã lưu {line.sourceItemId}: giữ {line.quantity} món{line.note && ` · ${line.note}`}</li>)}</ul>}
              {"reason" in payload && <p>Lý do: {payload.reason} · {payload.reasonNote}</p>}
            </div>}
            {operation.error && <p role="alert">{operation.error.message}</p>}
            {operation.result && <div data-testid="historical-result" className="rounded border bg-teal-50 p-2"><strong>Kết quả đã ghi của đúng lần này</strong><p>{"paidOrder" in operation.result ? `Đơn đã thanh toán #${operation.result.paidOrder.orderNo}, ${formatVnd(operation.result.paidOrder.total)}; đơn nguồn còn ${formatVnd(operation.result.sourceOrder.total)}` : `Đơn #${operation.result.order.orderNo}: ${operation.result.order.status}, ${formatVnd(operation.result.order.total)}`}</p></div>}
            <div data-testid="current-order" className="my-3 rounded border p-2"><strong>Trạng thái đơn hiện tại</strong><p>{current.data ? `Đơn #${current.data.orderNo}: ${current.data.status}, ${formatVnd(current.data.total)}, phiên bản ${current.data.lockVersion}` : current.isError ? "Chưa có dữ liệu đơn hiện tại hoặc không thể tải." : "Đang tải..."}</p></div>
            <div className="flex flex-wrap gap-2"><Button data-testid="write-recovery-resume" variant="contained" disabled={action.isPending || operation.status !== "pending" || !navigator.onLine} onClick={() => action.mutate("resume")}>Tiếp tục đúng thao tác này</Button><Button data-testid="write-recovery-cancel" color="error" disabled={action.isPending || operation.status !== "pending" || !navigator.onLine} onClick={() => action.mutate("cancel")}>Hủy lệnh chưa thực hiện</Button>
              {operation.result && "receipt" in operation.result && <Button data-testid="write-recovery-reprint" onClick={() => void reprint()}>In lại hóa đơn</Button>}
            </div>
            {(operation.status === "expired" || operation.status === "cancelled" || operation.status === "rejected") && <p>Đơn vẫn được giữ trên server. Hãy mở trạng thái đơn hiện tại và xác nhận một thao tác mới nếu cần.</p>}
          </>}
        </section>
      </div>
    </div>
  </PortalDrawer>;
}
