import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button, TextField } from "@mui/material";
import { useState } from "react";
import toast from "react-hot-toast";
import { useOpenOrdersQuery } from "@/features/pos";
import { useClearDemoDataMutation } from "@/features/admin";
import { useAppStore } from "../../useAppStore";
import { notifyUiError, toToastError } from "../../appErrors";
import { PortalPopup } from "../../components/PortalPopup";

export function ClearDemoDialog({ onClose }: { onClose: () => void }) {
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const openOrdersQuery = useOpenOrdersQuery();
  const clearDemoMutation = useClearDemoDataMutation(currentEmployee);
  const openCount = openOrdersQuery.data?.length ?? 0;
  const [confirmText, setConfirmText] = useState("");

  const checkingOpenOrders = openOrdersQuery.isLoading || (openOrdersQuery.isFetching && !openOrdersQuery.data);
  const openOrdersError = openOrdersQuery.isError;
  const blocked = openOrdersQuery.isSuccess && openCount > 0;
  const ready = openOrdersQuery.isSuccess && !blocked && confirmText.trim().toUpperCase() === "CLEAR";
  const processing = clearDemoMutation.isPending;

  const checklist = ["Menu mẫu", "Sơ đồ bàn mẫu", "Trang trí mẫu", "Nhân viên mẫu", "Giữ lại tài khoản quản lý"];

  const handleClear = () => {
    clearDemoMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Đã đặt lại dữ liệu mẫu");
        onClose();
      },
      onError: (error) => {
        const uiError = notifyUiError(error);
        if (uiError.action === "closeOpenOrders") {
          void openOrdersQuery.refetch();
        }
      },
    });
  };

  return (
    <PortalPopup
      placement="Centered"
      viewport="workspace"
      overlayClassName="bg-slate-900/50"
      onOutsideClick={processing ? undefined : onClose}
    >
      <div className="grid max-h-[88%] w-[min(600px,92vw)] gap-3 overflow-auto rounded-pos bg-pos-surface p-6 text-left shadow-[0_20px_60px_rgb(0_0_0_/_25%)] [&_h3]:m-0 [&_p]:m-0 [&_p]:text-sm [&_p]:text-pos-muted" data-testid="clear-demo-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 [&_h3]:m-0">
          <AlertTriangle size={20} color="#b45309" />
          <h3>Đặt lại dữ liệu mẫu</h3>
        </div>
        <p>Thao tác này chỉ đặt lại dữ liệu mẫu có sẵn, không xoá dữ liệu người dùng tự tạo và giữ lại tài khoản quản lý hiện tại.</p>

        {checkingOpenOrders ? (
          <div className="grid gap-1 rounded-pos border border-[#fecaca] bg-[#fef2f2] p-3 [&_strong]:text-pos-danger" data-testid="clear-demo-loading">
            <strong>Đang kiểm tra đơn đang mở...</strong>
            <span className="text-pos-muted">Chờ hệ thống tải danh sách đơn trước khi cho phép đặt lại dữ liệu mẫu.</span>
          </div>
        ) : openOrdersError ? (
          <div className="grid gap-1 rounded-pos border border-[#fecaca] bg-[#fef2f2] p-3 [&_strong]:text-pos-danger" data-testid="clear-demo-error">
            <strong>Không kiểm tra được đơn đang mở</strong>
            <span className="text-pos-muted">{toToastError(openOrdersQuery.error)}</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <Button variant="contained" size="small" onClick={() => void openOrdersQuery.refetch()}>
                Thử kiểm tra lại
              </Button>
            </div>
          </div>
        ) : blocked ? (
          <div className="grid gap-1 rounded-pos border border-[#fecaca] bg-[#fef2f2] p-3 [&_strong]:text-pos-danger" data-testid="clear-demo-blocked">
            <strong>Còn {openCount} đơn đang mở</strong>
            <span className="text-pos-muted">Cần thanh toán hoặc huỷ các đơn đang mở trước khi đặt lại dữ liệu mẫu.</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <Button variant="contained" size="small" onClick={onClose}>Đóng đơn đang mở trước</Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="m-0 grid list-none gap-1.5 p-0 [&_li]:flex [&_li]:items-center [&_li]:gap-2 [&_li]:text-[13px] [&_li]:font-semibold">
              {checklist.map((c) => (
                <li key={c}><CheckCircle2 size={14} color="#0F766E" /> {c}</li>
              ))}
            </ul>
            <TextField
              label='Gõ "CLEAR" để xác nhận'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              size="small"
              fullWidth
              inputProps={{ "data-testid": "clear-demo-confirm-input" }}
            />
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2.5 [&_.MuiButton-root]:min-w-24">
          <Button variant="outlined" onClick={onClose} disabled={processing}>Huỷ</Button>
          <Button
            variant="contained"
            color="error"
            data-testid="clear-demo-confirm-button"
            disabled={!ready || processing || checkingOpenOrders || openOrdersError}
            onClick={handleClear}
          >
            {processing ? "Đang xử lý..." : "Đặt lại dữ liệu"}
          </Button>
        </div>
      </div>
    </PortalPopup>
  );
}
