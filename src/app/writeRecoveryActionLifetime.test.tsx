import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import toast from "react-hot-toast";
import { AppError } from "@/core/appError";
import type { OperationView } from "@/domain";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import { PortsContext } from "@/features/shared/portsContext";
import { WriteRecoveryDrawer } from "./drawers/pos/WriteRecoveryDrawer";
import { WriteLifecycle } from "./WriteLifecycle";
import { useAppStore } from "./useAppStore";

const id = (n: number) => `91000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks();
  useAppStore.getState().setCurrentEmployee(null);
  useAppStore.setState({ drawer: null, receiptPreview: null, draftItems: [], orderContext: null, screen: "passcode" });
});
function Surface() {
  const employee = useAppStore(state => state.currentEmployee);
  const drawer = useAppStore(state => state.drawer);
  return employee && drawer === "writeRecovery" ? <WriteRecoveryDrawer /> : null;
}
async function fixture() {
  const state = createSeededMockState();
  state.session = { storeId: state.settings.storeId, storeNo: 1 };
  const order = state.orders.find(row => row.status === "open")!;
  order.id = id(1); order.lockVersion = 5;
  const ports = createMockPorts(state);
  const admin = state.employees.find(employee => employee.role === "admin")!;
  const cashier = state.employees.find(employee => employee.role === "cashier")!;
  await ports.employee.startSession(admin.id, state.pins[admin.id]);
  await ports.write.register(id(4), { schemaVersion: 1, kind: "pay_order", orderId: order.id,
    paymentId: id(3), expectedVersion: 5, method: "cash", receivedAmount: 200000 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 } } }); clients.push(client);
  useAppStore.getState().setScreen("passcode");
  useAppStore.getState().setCurrentEmployee(admin); useAppStore.getState().openDrawer("writeRecovery");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><WriteLifecycle /><Surface /></QueryClientProvider></PortsContext.Provider>);
  fireEvent.click(await screen.findByTestId(`operation-${id(4)}`));
  await waitFor(() => expect(screen.getByTestId("write-recovery-resume")).toBeEnabled());
  return { state, ports, client, admin, cashier };
}

for (const action of ["resume", "cancel"] as const) {
  for (const scenario of [
    { transition: "employee_change", code: "EMPLOYEE_SESSION_REQUIRED" },
    { transition: "employee_change", code: "AUTH_REQUIRED" },
    { transition: "close_reopen", code: "EMPLOYEE_SESSION_REQUIRED" },
    { transition: "offline_online", code: "EMPLOYEE_SESSION_REQUIRED" },
  ] as const) {
    const tc = scenario.transition === "offline_online" ? "TC-IDEM-054" : "TC-IDEM-053";
    test(`${tc}/core/recovery=${action}/transition=${scenario.transition}/error=${scenario.code} keeps late errors inside the old lifetime`, async () => {
      const { ports, cashier, state, client } = await fixture();
      let reject!: (reason: unknown) => void;
      const endpoint = vi.spyOn(ports.write, action === "resume" ? "execute" : "cancel")
        .mockImplementationOnce(() => new Promise<OperationView>((_, fail) => { reject = fail; }));
      fireEvent.click(screen.getByTestId(`write-recovery-${action}`));
      await waitFor(() => expect(endpoint).toHaveBeenCalledTimes(1));
      if (scenario.transition === "employee_change") {
        act(() => useAppStore.getState().setCurrentEmployee(null));
        await ports.employee.startSession(cashier.id, state.pins[cashier.id]);
        act(() => {
          useAppStore.getState().setCurrentEmployee(cashier);
          useAppStore.getState().openOrder({ orderId: null, tableId: null, orderType: "takeaway" });
          useAppStore.getState().setDraftItems([{ id: id(90), menuItemId: id(91), quantity: 1, quotedBasePrice: 20000, options: [] }]);
        });
      } else if (scenario.transition === "close_reopen") {
        act(() => useAppStore.getState().closeDrawer());
        act(() => useAppStore.getState().openDrawer("writeRecovery"));
        await screen.findByTestId(`operation-${id(4)}`);
      } else {
        act(() => {
          vi.spyOn(navigator, "onLine", "get").mockReturnValue(false); window.dispatchEvent(new Event("offline"));
          vi.spyOn(navigator, "onLine", "get").mockReturnValue(true); window.dispatchEvent(new Event("online"));
        });
      }
      const current = useAppStore.getState();
      const error = vi.spyOn(toast, "error");
      const revoke = vi.spyOn(ports.employee, "revokeSession");
      await act(async () => { reject(new AppError(scenario.code, "Lỗi phiên cũ")); });
      await waitFor(() => expect(client.getMutationCache().getAll().map(mutation => mutation.state.status)).toEqual(["error"]));
      expect(useAppStore.getState().currentEmployee).toBe(current.currentEmployee);
      expect(useAppStore.getState().draftItems).toEqual(current.draftItems);
      expect(useAppStore.getState().drawer).toBe(current.drawer);
      expect(useAppStore.getState().screen).toBe(current.screen);
      expect(error).not.toHaveBeenCalled();
      expect(revoke).not.toHaveBeenCalled();
      expect(endpoint).toHaveBeenCalledTimes(1);
    });
  }

  for (const code of ["EMPLOYEE_SESSION_REQUIRED", "AUTH_REQUIRED"] as const) {
    test(`TC-IDEM-006/core/recovery=${action}/error=${code} handles an authentication error from the current lifetime`, async () => {
      const { ports } = await fixture();
      vi.spyOn(ports.write, action === "resume" ? "execute" : "cancel").mockRejectedValueOnce(new AppError(code, "Phiên hiện tại hết hạn"));
      const error = vi.spyOn(toast, "error");
      const revoke = vi.spyOn(ports.employee, "revokeSession");
      fireEvent.click(screen.getByTestId(`write-recovery-${action}`));
      await waitFor(() => expect(useAppStore.getState().currentEmployee).toBeNull());
      expect(useAppStore.getState().screen).toBe(code === "AUTH_REQUIRED" ? "landing" : "passcode");
      expect(error).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledTimes(1);
    });
  }
}
