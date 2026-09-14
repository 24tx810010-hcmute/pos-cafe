import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import toast from "react-hot-toast";
import { AppError } from "@/core/appError";
import type { OperationView } from "@/domain";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import { PortsContext } from "@/features/shared/portsContext";
import { OrderHistoryDrawer } from "./drawers/admin/OrderHistoryDrawer";
import { WriteLifecycle } from "./WriteLifecycle";
import { useAppStore } from "./useAppStore";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks();
  useAppStore.setState({ currentEmployee: null, drawer: null, receiptPreview: null, draftItems: [], orderContext: null, paymentOrderId: null, screen: "passcode" });
});
function Surface() { return useAppStore(state => state.drawer) === "orderHistory" ? <OrderHistoryDrawer /> : null; }
async function fixture() {
  const state = createSeededMockState(); state.session = { storeId: state.settings.storeId, storeNo: 1 };
  const paid = state.orders.find(order => order.status === "paid")!; state.orders = [paid];
  const ports = createMockPorts(state); const actor = state.employees.find(employee => employee.role === "admin")!;
  const cashier = state.employees.find(employee => employee.role === "cashier")!;
  await ports.employee.startSession(actor.id, state.pins[actor.id]);
  useAppStore.setState({ currentEmployee: actor, drawer: "orderHistory", orderContext: null, paymentOrderId: null, draftItems: [], receiptPreview: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnReconnect: false }, mutations: { retry: false } } }); clients.push(client);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><WriteLifecycle /><Surface /></QueryClientProvider></PortsContext.Provider>);
  fireEvent.click(await screen.findByTestId(`history-row-${paid.id}`));
  await waitFor(() => expect(screen.getByTestId("history-reprint-button")).toBeEnabled());
  await waitFor(() => expect(screen.getByTestId("history-void-order")).toBeEnabled());
  return { state, ports, actor, cashier, client, paid };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function transition(f: Fixture, kind: "employee_change" | "same_employee" | "offline_online") {
  if (kind === "offline_online") {
    act(() => { vi.spyOn(navigator, "onLine", "get").mockReturnValue(false); window.dispatchEvent(new Event("offline")); vi.spyOn(navigator, "onLine", "get").mockReturnValue(true); window.dispatchEvent(new Event("online")); });
  } else {
    const actor = kind === "employee_change" ? f.cashier : f.actor;
    if (kind === "employee_change") act(() => useAppStore.getState().setCurrentEmployee(null));
    await f.ports.employee.startSession(actor.id, f.state.pins[actor.id]);
    act(() => {
      useAppStore.getState().setCurrentEmployee(actor);
      if (kind === "employee_change") {
        useAppStore.getState().openOrder({ orderId: null, tableId: null, orderType: "takeaway" });
        useAppStore.getState().setDraftItems([{ id: crypto.randomUUID(), menuItemId: crypto.randomUUID(), quantity: 1, quotedBasePrice: 20000, options: [] }]);
      }
    });
  }
}
for (const stage of ["order", "receipt"] as const) for (const change of ["employee_change", "offline_online"] as const) for (const code of ["EMPLOYEE_SESSION_REQUIRED", "AUTH_REQUIRED"] as const) {
  test(`TC-IDEM-051/core/history=reprint/stage=${stage}/transition=${change}/error=${code} ignores a delayed failed read`, async () => {
    const f = await fixture(); let reject!: (reason: unknown) => void;
    const endpoint = vi.spyOn(f.ports.order, stage === "order" ? "getOrder" : "getReceipt")
      .mockImplementationOnce(() => new Promise<never>((_, fail) => { reject = fail; }));
    fireEvent.click(screen.getByTestId("history-reprint-button")); await waitFor(() => expect(reject).toBeDefined());
    await transition(f, change);
    const before = useAppStore.getState(); const error = vi.spyOn(toast, "error"); const revoke = vi.spyOn(f.ports.employee, "revokeSession");
    await act(async () => reject(new AppError(code, "Old history read error")));
    expect.soft(useAppStore.getState().currentEmployee).toBe(before.currentEmployee);
    expect.soft(useAppStore.getState().draftItems).toEqual(before.draftItems);
    expect.soft(useAppStore.getState().screen).toBe(before.screen);
    expect.soft(useAppStore.getState().drawer).toBe(before.drawer);
    expect.soft(useAppStore.getState().receiptPreview).toBeNull();
    expect.soft(error).not.toHaveBeenCalled(); expect.soft(revoke).not.toHaveBeenCalled();
    expect(endpoint).toHaveBeenCalledTimes(1);
  });
}
for (const code of ["EMPLOYEE_SESSION_REQUIRED", "AUTH_REQUIRED"] as const) {
  test(`TC-IDEM-006/core/history=reprint/error=${code} handles a current read failure`, async () => {
    const f = await fixture(); vi.spyOn(f.ports.order, "getReceipt").mockRejectedValueOnce(new AppError(code, "Current history read error"));
    const error = vi.spyOn(toast, "error"); const revoke = vi.spyOn(f.ports.employee, "revokeSession");
    fireEvent.click(screen.getByTestId("history-reprint-button"));
    await waitFor(() => expect(useAppStore.getState().currentEmployee).toBeNull());
    expect(useAppStore.getState().screen).toBe(code === "AUTH_REQUIRED" ? "landing" : "passcode");
    expect(error).toHaveBeenCalledTimes(1); expect(revoke).toHaveBeenCalledTimes(1);
  });
}
test("TC-IDEM-051/core/history=reprint/result=applied opens a preview after a current successful read", async () => {
  const f = await fixture(); const receipt = vi.spyOn(f.ports.order, "getReceipt");
  fireEvent.click(screen.getByTestId("history-reprint-button"));
  await waitFor(() => expect(useAppStore.getState().receiptPreview?.variant).toBe("receipt"));
  expect(receipt).toHaveBeenCalledTimes(1); expect(useAppStore.getState().currentEmployee).toBe(f.actor);
});
async function openVoid() {
  const f = await fixture(); fireEvent.click(screen.getByTestId("history-void-order"));
  await waitFor(() => expect(screen.getByTestId("history-void-confirm")).toBeEnabled());
  return f;
}
for (const change of ["same_employee", "offline_online"] as const) for (const outcome of ["EMPLOYEE_SESSION_REQUIRED", "AUTH_REQUIRED", "applied"] as const) {
  test(`${change === "same_employee" ? "TC-IDEM-053" : "TC-IDEM-054"}/core/history=void/transition=${change}/result=${outcome} ignores an obsolete mutation callback`, async () => {
    const f = await openVoid(); let settle!: () => void; const original = f.ports.write.execute.bind(f.ports.write);
    const execute = vi.spyOn(f.ports.write, "execute").mockImplementationOnce(async (key, payload) => {
      if (outcome === "applied") { const result = await original(key, payload); await new Promise<void>(resolve => { settle = resolve; }); return result; }
      return new Promise<OperationView>((_, reject) => { settle = () => reject(new AppError(outcome, "Old history void error")); });
    });
    fireEvent.click(screen.getByTestId("history-void-confirm")); await waitFor(() => expect(settle).toBeDefined());
    await transition(f, change);
    const before = useAppStore.getState(); const error = vi.spyOn(toast, "error"); const success = vi.spyOn(toast, "success");
    const read = vi.spyOn(f.ports.order, "getOrder");
    await act(async () => settle());
    await waitFor(() => expect(f.client.getMutationCache().getAll().every(mutation => mutation.state.status !== "pending")).toBe(true));
    expect.soft(error).not.toHaveBeenCalled(); expect.soft(success).not.toHaveBeenCalled(); expect.soft(read).not.toHaveBeenCalled();
    expect(useAppStore.getState().currentEmployee).toBe(before.currentEmployee); expect(useAppStore.getState().receiptPreview).toBeNull();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(f.state.orders[0].status).toBe(outcome === "applied" ? "void" : "paid");
  });
}
for (const code of ["EMPLOYEE_SESSION_REQUIRED", "AUTH_REQUIRED"] as const) {
  test(`TC-IDEM-006/core/history=void/error=${code} keeps current error feedback and refetch`, async () => {
    const f = await openVoid(); vi.spyOn(f.ports.write, "execute").mockRejectedValueOnce(new AppError(code, "Current history void error"));
    const error = vi.spyOn(toast, "error"); const read = vi.spyOn(f.ports.order, "getOrder");
    fireEvent.click(screen.getByTestId("history-void-confirm"));
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(read).toHaveBeenCalledTimes(1); expect(f.state.orders[0].status).toBe("paid");
  });
}
test("TC-IDEM-051/core/history=void/result=applied retains current success feedback", async () => {
  const f = await openVoid(); const execute = vi.spyOn(f.ports.write, "execute"); const success = vi.spyOn(toast, "success");
  fireEvent.click(screen.getByTestId("history-void-confirm"));
  await waitFor(() => expect(screen.queryByTestId("history-void-popup")).toBeNull());
  expect(success).toHaveBeenCalledTimes(1); expect(execute).toHaveBeenCalledTimes(1); expect(f.state.orders[0].status).toBe("void");
});
test("TC-IDEM-053/core/history=void/transition=reopen_confirmation/result=late_error preserves a newer confirmation read's busy state", async () => {
  const f = await openVoid(); let reject!: (reason: unknown) => void;
  vi.spyOn(f.ports.write, "execute").mockImplementationOnce(() => new Promise<OperationView>((_, fail) => { reject = fail; }));
  fireEvent.click(screen.getByTestId("history-void-confirm")); await waitFor(() => expect(reject).toBeDefined());
  fireEvent.click(within(screen.getByTestId("history-void-popup")).getByRole("button", { name: "Đóng" }));
  await transition(f, "same_employee");
  const releases: Array<() => void> = [];
  const read = vi.spyOn(f.ports.order, "getOrder").mockImplementation(() => new Promise(resolve => { releases.push(() => resolve(structuredClone(f.paid))); }));
  fireEvent.click(screen.getByTestId("history-void-order")); await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  await act(async () => reject(new AppError("EMPLOYEE_SESSION_REQUIRED", "Old void after reopening")));
  await waitFor(() => expect(f.client.getMutationCache().getAll().every(mutation => mutation.state.status !== "pending")).toBe(true));
  fireEvent.click(screen.getByTestId("history-void-order"));
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => releases.forEach(release => release()));
  await waitFor(() => expect(screen.getByTestId("history-void-confirm")).toBeEnabled());
});
