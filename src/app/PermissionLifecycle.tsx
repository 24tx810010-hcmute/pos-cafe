import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { PermissionLifecycle as AuthorityLifecycle } from "@/core/permissionLifecycle";
import { usePermissionPorts } from "@/features/shared/portsContext";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { useAppStore } from "./useAppStore";
import { clearDrawerExitGuard } from "./drawerNavigation";
import { bundleHas, drawerAllowed, purposePermissions } from "./permissionUi";
import { getWriteCoordinator } from "@/features/pos/writeOperationFlow";
import { writePermission } from "@/core/writePayload";
import { usePorts } from "@/features/shared/portsContext";
import { requireCompatibilityUpdate } from "./compatibilityGate";
import { writeError } from "@/core/writeErrors";

export function PermissionLifecycle() {
  const ports = usePermissionPorts(), queryClient = useQueryClient();
  const appPorts = usePorts();
  const session = usePermissionSession(state => state.session);
  const controller = useRef<AuthorityLifecycle | null>(null);
  useEffect(() => {
    if (!session) return;
    const lifecycle = new AuthorityLifecycle({
      getRevision: () => ports.authority.getRevision(), getAuthority: () => ports.authority.getAuthority(),
      status: status => usePermissionSession.getState().setStatus(status),
      expired: () => useAppStore.getState().setCurrentEmployee(null),
      unsupported: () => requireCompatibilityUpdate(writeError("WRITE_PROTOCOL_UNSUPPORTED")),
      apply: (bundle, previous) => {
        const lost = previous?.snapshot.permissions.filter(code => !bundleHas(bundle, code)) ?? [];
        if (lost.length) {
          const coordinator = getWriteCoordinator(appPorts.write), attempt = coordinator.snapshot();
          if (attempt && attempt.status !== "settled" && lost.includes(writePermission(attempt.payload))) coordinator.suspend();
          if (lost.some(code => ["order.create", "order.update", "order.voidOpen", "payment.take", "order.voidPaid", "orderHistory.view"].includes(code))) {
            void queryClient.cancelQueries({ queryKey: ["write-recovery"] }); queryClient.removeQueries({ queryKey: ["write-recovery"] });
          }
          const filter = { predicate: (q: { queryKey: readonly unknown[] }) => {
            if (q.queryKey[0] !== "permission") return false;
            const required = purposePermissions[String(q.queryKey[4])];
            return !!required?.length && !required.some(code => bundleHas(bundle, code));
          } };
          void queryClient.cancelQueries(filter); queryClient.removeQueries(filter);
          const app = useAppStore.getState();
          const lostOrderDraft = app.drawer === "order" && lost.includes(app.orderContext?.orderId ? "order.update" : "order.create");
          const close = !drawerAllowed(bundle, app.drawer, app.orderContext) || lostOrderDraft;
          const preview = app.receiptPreview;
          const closePreview = !!preview && (preview.variant === "receipt"
            ? !bundleHas(bundle, "payment.take") && !bundleHas(bundle, "orderHistory.view")
            : !bundleHas(bundle, preview.requiredPermission ?? "payment.take"));
          if (close || closePreview) {
            clearDrawerExitGuard();
            useAppStore.setState({ ...(close ? { drawer: null, orderContext: null, paymentOrderId: null } : {}),
              ...(lostOrderDraft ? { draftItems: [] } : {}), ...(closePreview ? { receiptPreview: null } : {}) });
            toast("Quyền của bạn đã thay đổi. Phần đang thao tác không còn được phép đã đóng; dữ liệu chưa lưu của phần đó đã được bỏ.");
          }
        }
        usePermissionSession.getState().apply(bundle);
      },
    });
    controller.current = lifecycle;
    lifecycle.start(session, document.visibilityState !== "hidden" && navigator.onLine);
    const resume = () => { if (document.visibilityState !== "hidden" && navigator.onLine) void lifecycle.resume(); };
    const visibility = () => document.visibilityState === "hidden" ? lifecycle.hide() : resume();
    const offline = () => lifecycle.hide();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", resume); window.addEventListener("online", resume); window.addEventListener("offline", offline);
    let permissionSignalRevision = -1, catalogSignalRevision = -1;
    const unsubscribe = ports.signals.subscribe({ storeId: session.authority.snapshot.storeId,
      onStoreSignal: signal => {
        if (signal.topic === "permission") {
          if (signal.revision > permissionSignalRevision) {
            permissionSignalRevision = signal.revision;
            void lifecycle.signal().then(() => queryClient.invalidateQueries({ predicate: q => q.queryKey[0] === "permission" && q.queryKey[4] === "employees" }));
          }
          return;
        }
        const topics: Record<string, string[]> = { menu: ["pos-menu", "menu-admin"], floor: ["floor", "floor-admin"],
          orders: ["floor", "floor-admin", "open-order", "history", "history-detail", "report", "report-orders"],
          report: ["report", "report-orders"], settings: ["settings", "display", "report"] };
        void queryClient.invalidateQueries({ predicate: q => q.queryKey[0] === "permission" && !!topics[signal.topic]?.includes(String(q.queryKey[4])) });
      }, onCatalogSignal: signal => {
        if (signal.revision > catalogSignalRevision) { catalogSignalRevision = signal.revision; void lifecycle.signal(); }
      }, onReconnect: () => {
        resume();
        // Realtime is an invalidation hint. A disconnected client may have
        // missed any topic, so refetch every mounted protected query.
        void queryClient.invalidateQueries({ predicate: q => q.queryKey[0] === "permission" });
      },
    });
    return () => {
      lifecycle.stop(); controller.current = null; unsubscribe();
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume); window.removeEventListener("offline", offline);
      void queryClient.cancelQueries({ queryKey: ["permission"] }); queryClient.removeQueries({ queryKey: ["permission"] });
    };
  }, [ports, appPorts.write, queryClient, session]);
  const status = usePermissionSession(state => state.status);
  if (!session || status === "verified") return null;
  return <div className="fixed inset-0 z-[2000] grid place-content-center gap-4 bg-pos-bg p-6 text-center" role="status" data-testid="permission-verification-gate">
    <p>Chưa xác minh được quyền. Kiểm tra kết nối và thử lại.</p>
    <button className="rounded-pos bg-pos-primary px-5 py-3 font-bold text-white" onClick={() => void controller.current?.resume()}>Thử lại</button>
  </div>;
}
