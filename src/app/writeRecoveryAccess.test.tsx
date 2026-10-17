import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AppError } from "@/core/appError";
import { activateCandidateUi, createCandidateRuntimeFixture } from "@/test/candidateRuntimeFixture";
import { PortsContext } from "@/features/shared/portsContext";
import { sessionQueryKeys } from "@/features/session/useSessionFlow";
import { WriteRecoveryDrawer } from "./drawers/pos/WriteRecoveryDrawer";
import { WriteLifecycle } from "./WriteLifecycle";
import { useAppStore } from "./useAppStore";

const id = (n: number) => `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks();
  useAppStore.getState().setCurrentEmployee(null);
  useAppStore.setState({ drawer: null, receiptPreview: null });
});
function Surface() {
  const employee = useAppStore(state => state.currentEmployee);
  const drawer = useAppStore(state => state.drawer);
  return employee && drawer === "writeRecovery" ? <WriteRecoveryDrawer /> : null;
}
async function fixture() {
  const candidate=await createCandidateRuntimeFixture({demoCredentials:true,role:"manager"}),state=candidate.business,ports=candidate.ports,admin=candidate.actor;activateCandidateUi(candidate);
  const order = state.orders.find(row => row.status === "open")!;
  order.id = id(1); order.lockVersion = 5; order.total = 150000;
  order.items = [{ ...order.items[0], id: id(2), itemName: "Dữ liệu của A", quantity: 5, unitPrice: 30000, options: [] }];
  state.orders = [order];
  const denied = candidate.state.employees.find(employee => employee.role === "cashier")!;
  denied.overrides = { grants: [], denies: ["order.create", "order.update", "order.voidOpen", "payment.take", "order.voidPaid", "orderHistory.view"] };
  const payload = { schemaVersion: 1 as const, kind: "pay_order" as const, orderId: order.id, paymentId: id(3), expectedVersion: 5, method: "cash" as const, receivedAmount: 200000 };
  await ports.write.register(id(4), payload); await ports.write.execute(id(4), payload);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 } } }); clients.push(client);
  useAppStore.getState().setCurrentEmployee(admin); useAppStore.getState().openDrawer("writeRecovery");
  const view = render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><WriteLifecycle /><Surface /></QueryClientProvider></PortsContext.Provider>);
  const showDetail = async () => {
    fireEvent.click(await screen.findByTestId(`operation-${id(4)}`));
    await waitFor(() => expect(screen.getByTestId("historical-result")).toHaveTextContent("150.000"));
  };
  return { state, ports, client, admin, permissionAdmin:candidate.owner, pin:candidate.pin, denied, view, showDetail };
}
const noHistory = () => {
  expect(screen.queryByTestId("historical-result")).not.toBeInTheDocument();
  expect(screen.queryByTestId(`operation-${id(4)}`)).not.toBeInTheDocument();
  expect(screen.queryByTestId("write-recovery-resume")).not.toBeInTheDocument();
};

test("TC-IDEM-006/core/cache=different_employee a denied employee cannot inherit A's list or detail", async () => {
  const { ports, client, admin, denied, pin, showDetail } = await fixture(); await showDetail();
  act(() => useAppStore.getState().setCurrentEmployee(null));
  expect(client.getQueryCache().findAll({ queryKey: ["write-recovery"] })).toHaveLength(0);
  const deniedSession=await ports.permission!.session.startSession(denied.id, "111111");
  act(() => { useAppStore.getState().startEmployeeSession({id:denied.id,name:denied.name},deniedSession); useAppStore.getState().openDrawer("writeRecovery"); });
  noHistory(); await screen.findByText("Bạn không có quyền thực hiện thao tác này."); noHistory();
  await expect(ports.write.get(id(4))).rejects.toMatchObject({ code: "FORBIDDEN" });
  act(() => useAppStore.getState().setCurrentEmployee(null));
  const adminSession=await ports.permission!.session.startSession(admin.id, pin);
  act(() => { useAppStore.getState().startEmployeeSession(admin,adminSession); useAppStore.getState().openDrawer("writeRecovery"); });
  await showDetail();
});

test("TC-IDEM-006/core/cache=same_employee a new login by the same employee cannot reuse an earlier session", async () => {
  const { client, admin, permissionAdmin, pin, ports, showDetail } = await fixture(); await showDetail();
  const oldKeys = client.getQueryCache().findAll({ queryKey: ["write-recovery"] }).map(query => query.queryHash);
  act(() => useAppStore.getState().setCurrentEmployee(null));
  permissionAdmin.overrides={grants:[],denies:["payment.take"]};permissionAdmin.permissionRevision++;
  const nextSession=await ports.permission!.session.startSession(admin.id, pin);
  act(() => { useAppStore.getState().startEmployeeSession(admin,nextSession); useAppStore.getState().openDrawer("writeRecovery"); });
  noHistory(); await screen.findByText("Không tìm thấy thao tác phù hợp.");
  expect(client.getQueryCache().getAll().some(query => oldKeys.includes(query.queryHash))).toBe(false);
});

test("TC-IDEM-006/core/cache=store_change a different store cannot display the earlier store's recovery data", async () => {
  const { client, ports, showDetail } = await fixture(); await showDetail();
  vi.spyOn(ports.write, "list").mockResolvedValue({ items: [], nextCursor: null, serverTime: new Date().toISOString() });
  act(() => client.setQueryData(sessionQueryKeys.storeSession, { status: "paired", session: { storeId: id(99), storeNo: 2 } }));
  await waitFor(noHistory); await screen.findByText("Không tìm thấy thao tác phù hợp."); noHistory();
});

test("TC-IDEM-006/core/cache=late_response a completed read from A cannot repopulate cache after the session changes", async () => {
  const { ports, client, denied, state } = await fixture();
  const result = await ports.write.get(id(4)); let release!: () => void;
  vi.spyOn(ports.write, "get").mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(result); }));
  fireEvent.click(await screen.findByTestId(`operation-${id(4)}`)); await waitFor(() => expect(release).toBeDefined());
  const oldKeys = client.getQueryCache().findAll({ queryKey: ["write-recovery"] }).map(query => query.queryHash);
  act(() => useAppStore.getState().setCurrentEmployee(null));
  const deniedSession=await ports.permission!.session.startSession(denied.id, "111111");
  act(() => { useAppStore.getState().startEmployeeSession({id:denied.id,name:denied.name},deniedSession); useAppStore.getState().openDrawer("writeRecovery"); });
  await screen.findByText("Bạn không có quyền thực hiện thao tác này.");
  await act(async () => { release(); await Promise.resolve(); }); noHistory();
  expect(client.getQueryCache().getAll().some(query => oldKeys.includes(query.queryHash))).toBe(false);
});

for (const transition of ["employee_change", "permission_denied"] as const) {
  test(`TC-IDEM-006/core/cache=late_reprint/transition=${transition} a delayed receipt cannot bypass lost recovery access`, async () => {
    const { ports, client, denied, state, showDetail } = await fixture(); await showDetail();
    const document = await ports.permission!.print.prepareReceiptReprint(id(1)); let release!: () => void;
    vi.spyOn(ports.permission!.print, "prepareReceiptReprint").mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(document); }));
    fireEvent.click(screen.getByTestId("write-recovery-reprint")); await waitFor(() => expect(release).toBeDefined());
    if (transition === "employee_change") {
      act(() => useAppStore.getState().setCurrentEmployee(null));
      const deniedSession=await ports.permission!.session.startSession(denied.id, "111111");
      act(() => { useAppStore.getState().startEmployeeSession({id:denied.id,name:denied.name},deniedSession); useAppStore.getState().openDrawer("writeRecovery"); });
      await screen.findByText("Bạn không có quyền thực hiện thao tác này.");
    } else {
      vi.spyOn(ports.write, "get").mockRejectedValue(new AppError("FORBIDDEN", "Quyền truy cập đã bị từ chối."));
      await act(async () => { await client.invalidateQueries({ predicate: query => query.queryKey[0] === "write-recovery" && query.queryKey[4] === "detail" }); });
      await screen.findByText("Quyền truy cập đã bị từ chối.");
    }
    await act(async () => { release(); await Promise.resolve(); });
    noHistory(); expect(useAppStore.getState().receiptPreview).toBeNull();
  });
}

for (const endpoint of ["list", "detail"] as const) for (const code of ["FORBIDDEN", "AUTH_REQUIRED", "EMPLOYEE_SESSION_REQUIRED"] as const) {
  test(`TC-IDEM-006/core/cache=${endpoint}_denied/error=${code} clears sensitive data and permits an explicit fresh authorized read`, async () => {
    const { ports, client, showDetail } = await fixture(); await showDetail();
    const method = endpoint === "list" ? "list" : "get";
    const spy = vi.spyOn(ports.write, method).mockRejectedValue(new AppError(code, "Quyền truy cập đã bị từ chối."));
    await act(async () => { await client.invalidateQueries({ predicate: query => query.queryKey[0] === "write-recovery" && query.queryKey[4] === endpoint }); });
    await screen.findByText("Quyền truy cập đã bị từ chối."); noHistory();
    await waitFor(() => expect(client.getQueryCache().findAll({ queryKey: ["write-recovery"] }).every(query => query.state.data === undefined)).toBe(true));
    spy.mockRestore(); fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    await showDetail();
  });
}
