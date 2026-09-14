import { Button } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { invalidateAfterOrderMutation } from "@/features/pos/posInvalidation";
import { notifyUiError } from "../../appErrors";
import { useWriteAttempt } from "@/features/pos/useWriteAttempt";
import { useAppStore } from "../../useAppStore";
import { useViewLifetime } from "../../useViewLifetime";

export function WriteAttemptNotice({ onApplied }: { onApplied?: () => void } = {}) {
  const { attempt, online, coordinator } = useWriteAttempt();
  const queryClient = useQueryClient();
  const captureCurrent = useViewLifetime(attempt?.operationId);
  const retry = useMutation({ retry: false, networkMode: "always", mutationFn: (_input: { isCurrent: () => boolean }) => coordinator.retryCurrent(),
    onError: (error, input) => { if (input.isCurrent()) notifyUiError(error); },
    onSuccess: (operation, input) => {
      void invalidateAfterOrderMutation(queryClient, operation.payload.orderId);
      if (!input.isCurrent()) return;
      if (operation.status === "applied") {
        onApplied?.();
        toast.success("Server đã ghi nhận thao tác này. Kết quả không được ghi thêm lần nữa.");
      }
      else if (operation.error) toast.error(operation.error.message);
    },
  });
  const open = useAppStore((state) => state.openDrawer);
  if (online && attempt?.status !== "unknown") return null;
  return <div role="alert" data-testid="write-attempt-notice" className="m-3 rounded border border-amber-400 bg-amber-50 p-3">
    <p>{online ? "Chưa xác định kết quả trên server. Hãy tra cứu thao tác trước khi tiếp tục." : "Đang mất kết nối. Chỉ có thể ghi thao tác khi kết nối lại; ứng dụng không tự gửi lại."}</p>
    {attempt && <p className="break-all text-xs">Mã thao tác: {attempt.operationId}</p>}
    {attempt?.status === "unknown" && <Button disabled={!online || retry.isPending} onClick={() => retry.mutate({ isCurrent: captureCurrent() })}>Thử lại cùng lệnh</Button>}
    <Button onClick={() => open("writeRecovery")}>Tra cứu thao tác</Button>
  </div>;
}
