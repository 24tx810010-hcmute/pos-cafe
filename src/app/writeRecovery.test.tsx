import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import { mockWriteState } from "@/adapters/mock/writeState";
import type { OrderDetail, SplitWritePayload, SubmitOrderDraftItem } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { WriteRecoveryDrawer } from "./drawers/pos/WriteRecoveryDrawer";
import { OrderDrawer } from "./drawers/pos/OrderDrawer";
import { ticketFromOrderDetail } from "./components/ReceiptPreview";
import { PriceChangedNotice } from "./drawers/pos/PriceChangedNotice";
import { useServerOrderDraft } from "./drawers/pos/useServerOrderDraft";
import { useAppStore } from "./useAppStore";
import { WriteLifecycle } from "./WriteLifecycle";
import { getWriteCoordinator, orderDetailToDraft, payOrderAndPrint, payOrderItemsAndPrint, voidPaidOrder } from "@/features/pos";

const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => { cleanup(); useAppStore.setState({ currentEmployee: null, drawer: null, orderContext: null, paymentOrderId: null, receiptPreview: null, draftItems: [] }); });
const fixture = async () => {
  const state = createSeededMockState();
  state.session = { storeId: state.settings.storeId, storeNo: 1 };
  const source = state.orders.find((order) => order.status === "open")!;
  source.id = id(1); source.orderNo = 7; source.lockVersion = 5; source.total = 150_000;
  source.items = [{ ...source.items[0], id: id(2), itemName: "A", quantity: 5, unitPrice: 30_000, options: [] }];
  state.orders = [source];
  const ports = createMockPorts(state);
  const admin = state.employees.find((employee) => employee.role === "admin")!;
  await ports.employee.startSession(admin.id, state.pins[admin.id]);
  return { ports, state, source, admin };
};

describe("server operation recovery UI (memory adapter only)", () => {
  it("TC-IDEM-055/ui-memory-adapter independently lists stored K1/K2 and keeps historical source 120k separate from current 90k", async () => {
    const { ports: origin, state, source, admin } = await fixture();
    const body = (offset: number, version: number): SplitWritePayload => ({ schemaVersion: 1, kind: "pay_order_items", orderId: source.id,
      paymentId: id(10 + offset), newOrderId: id(20 + offset), expectedVersion: version, method: "cash", receivedAmount: 30_000,
      lines: [{ orderItemId: id(2), quantity: 1, splitItemId: id(30 + offset) }] });
    const first = body(1, 5); const second = body(2, 6);
    await origin.write.register(id(40), first); await origin.write.execute(id(40), first);
    await origin.write.register(id(41), second);
    // A fresh adapter gets no attempt pointer or credentials from the first adapter.
    const recovery = createMockPorts(state);
    const cashier = state.employees.find((employee) => employee.role === "cashier")!;
    await recovery.employee.startSession(cashier.id, state.pins[cashier.id]);
    const execute = vi.spyOn(recovery.write, "execute");
    const register = vi.spyOn(recovery.write, "register");
    const print = vi.spyOn(recovery.print, "renderReceipt");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAppStore.setState({ currentEmployee: cashier, drawer: "writeRecovery", receiptPreview: null });
    render(<PortsContext.Provider value={recovery}><QueryClientProvider client={queryClient}><WriteRecoveryDrawer /></QueryClientProvider></PortsContext.Provider>);
    fireEvent.click(await screen.findByTestId(`operation-${id(41)}`));
    expect(await screen.findByText("Chưa ghi giao dịch. Các số tiền bên dưới là nội dung dự kiến của lệnh.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục đúng thao tác này" }));
    await waitFor(() => expect(execute).toHaveBeenCalledExactlyOnceWith(id(41), second));
    await waitFor(() => expect(state.orders.find((order) => order.id === source.id)?.total).toBe(90_000));
    fireEvent.click(screen.getByTestId(`operation-${id(40)}`));
    await waitFor(() => expect(screen.getByTestId("historical-result")).toHaveTextContent("120.000"));
    await waitFor(() => expect(screen.getByTestId("current-order")).toHaveTextContent("90.000"));
    expect(state.orders.filter((order) => order.payment)).toHaveLength(2);
    expect(Object.values(mockWriteState(state).operations).find((operation) => operation.operationId === id(41))!.initiatedByEmployeeId).toBe(admin.id);
    expect(Object.values(mockWriteState(state).operations).find((operation) => operation.operationId === id(41))!.executedByEmployeeId).toBe(cashier.id);
    expect(register).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
    expect(useAppStore.getState().receiptPreview).toBeNull();
    queryClient.clear();
  });

  it("TC-IDEM-059/ui-memory-adapter cancels only the selected pending operation and leaves the open order intact", async () => {
    const { ports, source, admin, state } = await fixture();
    const body = { schemaVersion: 1 as const, kind: "pay_order" as const, orderId: source.id, paymentId: id(10), expectedVersion: 5, method: "cash" as const, receivedAmount: 150_000 };
    await ports.write.register(id(40), body);
    const before = structuredClone(state.orders);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAppStore.setState({ currentEmployee: admin, drawer: "writeRecovery" });
    render(<PortsContext.Provider value={ports}><QueryClientProvider client={queryClient}><WriteRecoveryDrawer /></QueryClientProvider></PortsContext.Provider>);
    fireEvent.click(await screen.findByTestId(`operation-${id(40)}`));
    fireEvent.click(await screen.findByRole("button", { name: "Hủy lệnh chưa thực hiện" }));
    await waitFor(() => expect(Object.values(mockWriteState(state).operations).find((operation) => operation.operationId === id(40))!.status).toBe("cancelled"));
    expect(state.orders).toEqual(before);
    expect(mockWriteState(state).events).toHaveLength(0);
    queryClient.clear();
  });
});

describe("reviewing changed drafts", () => {
  it("TC-IDEM-089/core regression seams: dirty-exit, empty selection, provisional total and pay-then-void current version", async () => {
    const { ports, source, admin, state } = await fixture();
    const register = vi.spyOn(ports.write, "register"); const execute = vi.spyOn(ports.write, "execute"); const cancel = vi.spyOn(ports.write, "cancel");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAppStore.setState({ currentEmployee: admin, drawer: "order", orderContext: { orderId: null, tableId: null, orderType: "takeaway" } });
    const view = render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><OrderDrawer /></QueryClientProvider></PortsContext.Provider>);
    await screen.findByTestId("order-drawer");
    const draft: SubmitOrderDraftItem[] = [{ id: id(70), menuItemId: source.items[0].menuItemId, quantity: 1, quotedBasePrice: 30_000, options: [] }];
    act(() => useAppStore.getState().setDraftItems(draft));
    fireEvent.click(screen.getByTestId("order-close-button"));
    expect(await screen.findByRole("heading", { name: "Bỏ đơn chưa gửi?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục chỉnh sửa" }));
    expect(useAppStore.getState().draftItems).toEqual(draft);
    expect(register).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
    expect(ticketFromOrderDetail(source, null)).toMatchObject({ total: 150_000, lines: [{ name: "A", quantity: 5, unitPrice: 30_000, options: expect.any(Array) }] });
    await expect(payOrderItemsAndPrint(ports, { actor: admin, order: source, receivedAmount: 150_000, selection: {} })).rejects.toMatchObject({ code: "INVALID_ORDER_ITEMS" });
    expect(register).not.toHaveBeenCalled();
    view.unmount(); client.clear();
    await payOrderAndPrint(ports, { actor: admin, order: source, receivedAmount: 150_000 });
    const paid = await ports.order.getOrder(source.id);
    expect(paid.lockVersion).toBe(6);
    await voidPaidOrder(ports, { actor: admin, order: paid, reasonCode: "duplicate", reasonNote: null });
    const [key, body] = register.mock.calls[1];
    expect(body).toMatchObject({ kind: "void_order", expectedVersion: 6 });
    const replay = await ports.write.execute(key, body);
    expect(replay.result).toMatchObject({ kind: "void_order", order: { status: "void", lockVersion: 7 } });
    expect(state.orders.filter((order) => order.payment)).toHaveLength(1);
    expect(state.lastReceipt).toBeNull();
  });
  it("TC-IDEM-027/ui preserves a dirty source draft on polling until explicitly discarded", async () => {
    const { source } = await fixture();
    const context = { orderId: source.id, tableId: source.tableId, orderType: source.orderType };
    const hook = renderHook(({ current }: { current: OrderDetail }) => useServerOrderDraft(context, current), { initialProps: { current: structuredClone(source) } });
    act(() => useAppStore.getState().setDraftItems(orderDetailToDraft(source).map((item) => ({ ...item, note: "Bản đang sửa" }))));
    const changed = { ...structuredClone(source), lockVersion: 6, total: 120_000, items: [{ ...source.items[0], quantity: 4 }] };
    hook.rerender({ current: changed });
    expect(hook.result.current.remoteConflict).toBe(true);
    expect(hook.result.current.editingOrder?.lockVersion).toBe(5);
    expect(useAppStore.getState().draftItems[0]).toMatchObject({ sourceItemId: id(2), quantity: 5, note: "Bản đang sửa" });
    act(() => hook.result.current.acceptCurrent());
    expect(hook.result.current.remoteConflict).toBe(false);
    expect(useAppStore.getState().draftItems[0]).toMatchObject({ sourceItemId: id(2), quantity: 4 });
  });

  it("TC-IDEM-034/ui reviewing new prices changes only unsent portions and still requires a separate submit", () => {
    const draft: SubmitOrderDraftItem[] = [{ id: id(2), sourceItemId: id(2), menuItemId: id(3), quantity: 2, quotedBasePrice: 30_000, options: [] },
      { id: id(4), menuItemId: id(3), quantity: 1, quotedBasePrice: 30_000, options: [] }];
    const update = vi.fn(); const reviewed = vi.fn();
    render(<PriceChangedNotice draftItems={draft} priceChanged={{ lines: [{ lineId: id(4), base: { quoted: 30_000, current: 40_000 }, options: [] }], proposedNewLinesTotal: 40_000 }} setDraftItems={update} onReviewed={reviewed} />);
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByTestId("price-changed-review")).toHaveTextContent("40.000");
    fireEvent.click(screen.getByRole("button", { name: "Dùng giá mới để kiểm tra lại giỏ" }));
    expect(update).toHaveBeenCalledExactlyOnceWith([{ ...draft[0] }, { ...draft[1], quotedBasePrice: 40_000 }]);
    expect(reviewed).toHaveBeenCalledTimes(1);
    expect(draft[1].quotedBasePrice).toBe(30_000);
  });

  it("TC-IDEM-053/ui lifecycle invalidates a delayed register when the drawer closes, and locking revokes the session", async () => {
    const { ports, source, admin } = await fixture();
    let release!: (value: Awaited<ReturnType<typeof ports.write.register>>) => void;
    const originalRegister = ports.write.register.bind(ports.write);
    let stored!: Awaited<ReturnType<typeof ports.write.register>>;
    vi.spyOn(ports.write, "register").mockImplementation(async (key, body) => { stored = await originalRegister(key, body); return new Promise((done) => { release = done; }); });
    const execute = vi.spyOn(ports.write, "execute"); const revoke = vi.spyOn(ports.employee, "revokeSession");
    useAppStore.setState({ currentEmployee: admin, drawer: "payment", paymentOrderId: source.id });
    render(<PortsContext.Provider value={ports}><WriteLifecycle /></PortsContext.Provider>);
    const coordinator = getWriteCoordinator(ports.write);
    const result = coordinator.begin({ schemaVersion: 1, kind: "pay_order", orderId: source.id, paymentId: id(50), expectedVersion: 5, method: "cash", receivedAmount: 150_000 }).catch((error) => error);
    await waitFor(() => expect(release).toBeDefined());
    act(() => useAppStore.getState().closeDrawer());
    release(stored);
    expect(await result).toMatchObject({ code: "WRITE_RESULT_UNKNOWN" });
    expect(execute).not.toHaveBeenCalled();
    act(() => useAppStore.getState().setCurrentEmployee(null));
    expect(revoke).toHaveBeenCalledTimes(1);
  });
});
