import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getWriteCoordinator } from "@/features/pos/writeOperationFlow";
import { usePorts } from "@/features/shared/portsContext";
import { useAppStore } from "./useAppStore";

/** Invalidate synchronously on navigation; late requests cannot cross a drawer or employee session. */
export function WriteLifecycle() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  useEffect(() => {
    const coordinator = getWriteCoordinator(ports.write);
    const stop = useAppStore.subscribe((state, previous) => {
      if (state.currentEmployee !== previous.currentEmployee || state.employeeSessionVersion !== previous.employeeSessionVersion) {
        // Removing queries also cancels their results: an old request cannot refill the cache.
        queryClient.removeQueries({ queryKey: ["write-recovery"] });
      }
      if (state.currentEmployee !== previous.currentEmployee || state.employeeSessionVersion !== previous.employeeSessionVersion || state.drawer !== previous.drawer
        || state.orderContext !== previous.orderContext || state.paymentOrderId !== previous.paymentOrderId) {
        const pending = coordinator.snapshot();
        coordinator.leave();
        if (pending && pending.status !== "settled" && state.currentEmployee) toast("Thao tác có thể vẫn được server ghi nhận. Mở Tra cứu thao tác để kiểm tra.");
      }
      if (previous.currentEmployee && !state.currentEmployee) {
        void ports.employee.revokeSession().catch(() => {});
        useAppStore.setState({ receiptPreview: null, draftItems: [], drawer: null, orderContext: null, paymentOrderId: null });
      }
    });
    const offline = () => coordinator.suspend();
    window.addEventListener("offline", offline);
    return () => {
      stop(); window.removeEventListener("offline", offline); coordinator.leave();
      queryClient.removeQueries({ queryKey: ["write-recovery"] });
    };
  }, [ports, queryClient]);
  return null;
}
