import { Button } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { isAppError } from "@/core/appError";
import type { InitialSeedStage, InitialSeedStatus } from "@/domain/permissions";
import { usePermissionPorts } from "@/features/shared/portsContext";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { useAppStore } from "./useAppStore";

const STAGES: InitialSeedStage[] = ["employee", "menu", "floor"];

export function InitialSeedLifecycle() {
  const ports = usePermissionPorts();
  const session = usePermissionSession(state => state.session);
  const owner = usePermissionSession(state => state.bundle?.snapshot.role === "owner");
  const setCurrentEmployee = useAppStore(state => state.setCurrentEmployee);
  const setSessionNotice = useAppStore(state => state.setSessionNotice);
  const [status, setStatus] = useState<InitialSeedStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [needsExplicitRetry, setNeedsExplicitRetry] = useState(false);
  const [readingStatus, setReadingStatus] = useState(false);
  const runToken = useRef(0);
  const autoAttempted = useRef(false);

  const isCurrent = (token: number, generation: number) => token === runToken.current
    && generation === usePermissionSession.getState().generation
    && usePermissionSession.getState().session === session;

  const handleFailure = (cause: unknown, token: number, generation: number) => {
    if (!isCurrent(token, generation)) return;
    if (isAppError(cause) && cause.code === "EMPLOYEE_SESSION_REQUIRED") {
      setCurrentEmployee(null);
      setSessionNotice("Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.");
      return;
    }
    setMessage(isAppError(cause) && cause.code === "INITIAL_SEED_ATTEMPT_STALE"
      ? "Tiến trình dữ liệu mẫu đã thay đổi. Kiểm tra trạng thái trước khi thử lại."
      : isAppError(cause) && cause.code === "ENTITY_ID_CONFLICT"
        ? "Dữ liệu hiện có trùng với dữ liệu mẫu. Đã dừng để giữ các thay đổi của quán."
        : "Chưa hoàn tất dữ liệu mẫu. Bạn vẫn có thể vào quán hoặc chọn thử lại.");
    setNeedsExplicitRetry(true);
  };

  const runPendingStages = async (initial: InitialSeedStatus, runGeneration: number, token: number, generation: number) => {
    let current = initial;
    for (const stage of STAGES) {
      if (!isCurrent(token, generation)) return;
      if (current.stages.find(receipt => receipt.stage === stage)?.status === "committed") continue;
      current = await ports.initialSeed.runStage({ runGeneration, stage });
      if (!isCurrent(token, generation)) return;
      setStatus(current);
      setMessage("");
    }
    if (current.status === "completed") toast.success("Đã thêm dữ liệu mẫu.");
  };

  const beginAndRun = async (mode: "initial" | "retry", current: InitialSeedStatus) => {
    if (!session || running) return;
    const token = ++runToken.current;
    const generation = usePermissionSession.getState().generation;
    setRunning(true);
    setMessage("");
    setNeedsExplicitRetry(false);
    try {
      const begun = await ports.initialSeed.begin({ mode, expectedWorkflowRevision: current.workflowRevision });
      if (!isCurrent(token, generation)) return;
      const refreshed = await ports.initialSeed.getStatus();
      if (!isCurrent(token, generation)) return;
      setStatus(refreshed);
      if (begun.acquired) await runPendingStages(refreshed, begun.runGeneration, token, generation);
    } catch (cause) {
      handleFailure(cause, token, generation);
      if (isCurrent(token, generation)) {
        try {
          const refreshed = await ports.initialSeed.getStatus();
          if (isCurrent(token, generation)) {
            setStatus(refreshed);
            if (refreshed.status === "completed") {
              setNeedsExplicitRetry(false);
              setMessage("");
              toast.success("Đã thêm dữ liệu mẫu.");
            }
          }
        } catch { /* Status remains unknown; retry stays explicit. */ }
      }
    } finally {
      if (isCurrent(token, generation)) setRunning(false);
    }
  };

  const readStatus = async (allowAutoClaim: boolean) => {
    if (!session || !owner || readingStatus) return;
    const token = ++runToken.current;
    const generation = usePermissionSession.getState().generation;
    setReadingStatus(true);
    if (allowAutoClaim) {
      setStatus(null);
      setMessage("");
      setNeedsExplicitRetry(false);
    }
    try {
      const current = await ports.initialSeed.getStatus();
      if (!isCurrent(token, generation)) return;
      setStatus(current);
      if (current.status === "completed" || current.status === "skipped") {
        setMessage("");
        setNeedsExplicitRetry(false);
        return;
      }
      if (allowAutoClaim && current.status === "pending" && current.autoEligible && !autoAttempted.current) {
        autoAttempted.current = true;
        setReadingStatus(false);
        void beginAndRun("initial", current);
      } else if (!allowAutoClaim && current.status === "pending") {
        setNeedsExplicitRetry(true);
      }
    } catch (cause) {
      handleFailure(cause, token, generation);
    } finally {
      if (isCurrent(token, generation)) setReadingStatus(false);
    }
  };

  useEffect(() => {
    if (!session || !owner) return;
    void readStatus(true);
    return () => { runToken.current += 1; };
    // Session generation defines this lifecycle; a status refresh never starts a second automatic run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, ports.initialSeed, session]);

  if (!session || !owner) return null;
  if (!status) return message ? (
    <aside className="fixed bottom-4 right-4 z-[1200] grid max-w-[420px] gap-2 rounded-pos border border-pos-line bg-pos-surface p-4 shadow-lg" data-testid="initial-seed-status">
      <strong>Dữ liệu mẫu</strong>
      <span className="text-sm text-pos-muted">{message}</span>
      <Button size="small" variant="outlined" disabled={readingStatus} onClick={() => void readStatus(false)} data-testid="refresh-initial-seed-status">
        {readingStatus ? "Đang kiểm tra..." : "Kiểm tra trạng thái"}
      </Button>
    </aside>
  ) : null;
  if (status.status === "skipped" || status.status === "completed") return null;
  const retryable = needsExplicitRetry || status.status === "needs_retry" || status.status === "in_progress";
  return (
    <aside className="fixed bottom-4 right-4 z-[1200] grid max-w-[420px] gap-2 rounded-pos border border-pos-line bg-pos-surface p-4 shadow-lg" data-testid="initial-seed-status">
      <strong>Dữ liệu mẫu</strong>
      <span className="text-sm text-pos-muted">
        {running ? "Đang thêm dữ liệu mẫu..." : message || "Dữ liệu mẫu đang chờ tiếp tục."}
      </span>
      {retryable && !running && (
        <Button size="small" variant="outlined" onClick={() => void beginAndRun(status.status === "pending" ? "initial" : "retry", status)} data-testid="retry-initial-seed">
          Thử lại dữ liệu mẫu
        </Button>
      )}
    </aside>
  );
}
