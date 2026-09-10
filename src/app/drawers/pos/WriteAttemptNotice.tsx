import { Button } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { invalidateAfterOrderMutation } from "@/features/pos/posInvalidation";
import { notifyUiError } from "../../appErrors";
import { useWriteAttempt } from "@/features/pos/useWriteAttempt";
import { useAppStore } from "../../useAppStore";

export function WriteAttemptNotice() {
  const { attempt, online, coordinator } = useWriteAttempt();
  const queryClient = useQueryClient();
  const retry = useMutation({ retry: false, networkMode: "always", mutationFn: () => coordinator.retryCurrent(), onError: notifyUiError,
    onSuccess: (operation) => {
      void invalidateAfterOrderMutation(queryClient, operation.payload.orderId);
      if (operation.status === "applied") toast.success("Server đã ghi nhận thao tác này. Kết quả không được ghi thêm lần nữa.");
      else if (operation.error) toast.error(operation.error.message);
    },
  });
  const open = useAppStore((state) => state.openDrawer);
  if (online && attempt?.status !== "unknown") return null;
  return <div role="alert" data-testid="write-attempt-notice" className="m-3 rounded border border-amber-400 bg-amber-50 p-3">
    <p>{online ? "Chưa xác định kết quả trên server. Hãy tra cứu thao tác trước khi tiếp tục." : "Đang mất kết nối. Chỉ có thể ghi thao tác khi kết nối lại; ứng dụng không tự gửi lại."}</p>
    {attempt && <p className="break-all text-xs">Mã thao tác: {attempt.operationId}</p>}
    {attempt?.status === "unknown" && <Button disabled={!online || retry.isPending} onClick={() => retry.mutate()}>Thử lại cùng lệnh</Button>}
    <Button onClick={() => open("writeRecovery")}>Tra cứu thao tác</Button>
  </div>;
}
