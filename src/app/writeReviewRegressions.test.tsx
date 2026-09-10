import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import type { OrderDetail, WritePayloadV1 } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { adjustDraftQuantity, getWriteCoordinator, orderDetailToDraft } from "@/features/pos";
import { OrderDrawer } from "./drawers/pos/OrderDrawer";
import { OrderHistoryDrawer } from "./drawers/admin/OrderHistoryDrawer";
import { WriteAttemptNotice } from "./drawers/pos/WriteAttemptNotice";
import { WriteLifecycle } from "./WriteLifecycle";
import { useAppStore } from "./useAppStore";

// Review regressions use real flows/components and the memory adapter only.
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup(); clients.splice(0).forEach(client => client.clear()); onlineManager.setOnline(true);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  window.dispatchEvent(new Event("online"));
  useAppStore.setState({ currentEmployee: null, drawer: null, orderContext: null, draftItems: [], receiptPreview: null });
});
const fixture = async () => {
  const state = createSeededMockState(); state.session = { storeId: state.settings.storeId, storeNo: 1 };
  const actor = state.employees.find(employee => employee.role === "admin")!;
  const ports = createMockPorts(state); await ports.employee.startSession(actor.id, state.pins[actor.id]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client);
  const renderUI = (children: React.ReactNode) => render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><WriteLifecycle />{children}</QueryClientProvider></PortsContext.Provider>);
  return { state, actor, ports, renderUI };
};
const CurrentDrawer = () => {
  const drawer = useAppStore(state => state.drawer);
  return drawer === "order" ? <OrderDrawer /> : drawer === "orderHistory" ? <OrderHistoryDrawer /> : null;
};

describe("review: navigation and asynchronous reads", () => {
  it.each([true, false])("unsent draft requires explicit discard for sidebar navigation, online=%s", async (online) => {
    const { state, actor, ports, renderUI } = await fixture();
    const register = vi.spyOn(ports.write, "register"); const execute = vi.spyOn(ports.write, "execute");
    useAppStore.setState({ currentEmployee: actor, drawer: "order", orderContext: { orderId: null, tableId: null, orderType: "takeaway" } });
    renderUI(<CurrentDrawer />); await screen.findByTestId("order-drawer");
    const draft = [{ id: id(1), menuItemId: state.menu.menuItems[0].id, quantity: 1, options: [], quotedBasePrice: 30_000 }];
    act(() => useAppStore.getState().setDraftItems(draft));
    act(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: online }); if (!online) window.dispatchEvent(new Event("offline")); });
    act(() => useAppStore.getState().openDrawer("writeRecovery"));
    expect(useAppStore.getState().drawer).toBe("order");
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục chỉnh sửa" }));
    expect(useAppStore.getState().draftItems).toEqual(draft);
    act(() => useAppStore.getState().openDrawer("writeRecovery"));
    fireEvent.click(screen.getByRole("button", { name: "Bỏ đơn" }));
    expect(useAppStore.getState().drawer).toBe("writeRecovery");
    expect(register).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled();
  });

  it("locking clears an unsent draft and revokes credentials without a discard prompt", async () => {
    const { state, actor, ports, renderUI } = await fixture(); const revoke = vi.spyOn(ports.employee, "revokeSession");
    useAppStore.setState({ currentEmployee: actor, drawer: "order", orderContext: { orderId: null, tableId: null, orderType: "takeaway" } });
    renderUI(<CurrentDrawer />); await screen.findByTestId("order-drawer");
    act(() => useAppStore.getState().setDraftItems([{ id: id(1), menuItemId: state.menu.menuItems[0].id, quantity: 1, options: [] }]));
    act(() => useAppStore.getState().setCurrentEmployee(null));
    expect(useAppStore.getState()).toMatchObject({ currentEmployee: null, drawer: null, draftItems: [] });
    expect(screen.queryByRole("heading", { name: "Bỏ đơn chưa gửi?" })).not.toBeInTheDocument();
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it.each(["close", "lock", "offline", "leave_and_return"])("late read before void confirmation cannot survive %s", async (variant) => {
    const { state, actor, ports, renderUI } = await fixture(); const paid = state.orders.find(order => order.status === "paid")!;
    const register = vi.spyOn(ports.write, "register"); const execute = vi.spyOn(ports.write, "execute");
    useAppStore.setState({ currentEmployee: actor, drawer: "orderHistory", orderContext: null });
    renderUI(<CurrentDrawer />);
    fireEvent.click(await screen.findByTestId(`history-row-${paid.id}`));
    const button = await screen.findByTestId("history-void-order"); await waitFor(() => expect(button).not.toBeDisabled());
    let release!: (order: OrderDetail) => void;
    vi.spyOn(ports.order, "getOrder").mockImplementationOnce(() => new Promise(done => { release = done; }));
    fireEvent.click(button); await waitFor(() => expect(release).toBeDefined());
    act(() => {
      if (variant === "lock") useAppStore.getState().setCurrentEmployee(null);
      else if (variant === "offline") { Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); window.dispatchEvent(new Event("offline")); }
      else { useAppStore.getState().closeDrawer(); if (variant === "leave_and_return") useAppStore.getState().openDrawer("orderHistory"); }
    });
    await act(async () => { release(structuredClone(paid)); await Promise.resolve(); });
    expect(screen.queryByTestId("history-void-popup")).not.toBeInTheDocument();
    expect(register).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled(); expect(paid.status).toBe("paid");
  });

  it("manual retry button replays the original frozen command and never previews or prints", async () => {
    const { state, actor, ports, renderUI } = await fixture(); const source = state.orders.find(order => order.status === "open")!;
    useAppStore.setState({ currentEmployee: actor, drawer: "payment", paymentOrderId: source.id }); renderUI(<WriteAttemptNotice />);
    const register = vi.spyOn(ports.write, "register"); const realExecute = ports.write.execute.bind(ports.write);
    const execute = vi.spyOn(ports.write, "execute").mockImplementationOnce(async (key, body) => { await realExecute(key, body); throw new Error("Lost ACK"); });
    const print = vi.spyOn(ports.print, "renderReceipt");
    const payload: WritePayloadV1 = { schemaVersion: 1, kind: "pay_order", orderId: source.id, expectedVersion: source.lockVersion, paymentId: id(20), receivedAmount: source.total, method: "cash" };
    await act(async () => { await getWriteCoordinator(ports.write).begin(payload).catch(() => {}); });
    const [key, original] = register.mock.calls[0];
    fireEvent.click(await screen.findByRole("button", { name: "Thử lại cùng lệnh" }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(execute).toHaveBeenNthCalledWith(2, key, original); expect(register).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(getWriteCoordinator(ports.write).snapshot()?.status).toBe("settled"));
    expect(print).not.toHaveBeenCalled(); expect(useAppStore.getState().receiptPreview).toBeNull();
    expect(state.orders.filter(order => order.payment?.id === id(20))).toHaveLength(1);
  });
});

describe("review: current modifier constraints", () => {
  it.each(["unlinked", "required", "single"])("retained plus rejects %s configuration without changing the old portion", async (variant) => {
    const { state } = await fixture(); const source = state.orders.find(order => order.status === "open")!; const menuItem = state.menu.menuItems[0];
    state.menu.optionGroups = [{ id: id(30), name: "Nhóm", isRequired: variant === "required", selectType: "single", sortOrder: 0 }];
    state.menu.menuItemOptionGroups = variant === "unlinked" ? [] : [{ id: id(31), menuItemId: menuItem.id, optionGroupId: id(30), sortOrder: 0 }];
    state.menu.optionValues = [1, 2].map(n => ({ id: id(31 + n), name: `Món kèm ${n}`, priceDelta: 0, optionGroupId: id(30), sortOrder: n }));
    source.items = [{ id: id(40), menuItemId: menuItem.id, itemName: menuItem.name, quantity: 2, unitPrice: 30_000, options: variant === "required" ? [] : state.menu.optionValues.slice(0, variant === "single" ? 2 : 1).map((value, index) => ({ id: id(41 + index), optionValueId: value.id, optionName: value.name, quantity: 1, priceDelta: 0 })) }];
    const draft = orderDetailToDraft(source); const original = structuredClone(draft);
    expect(() => adjustDraftQuantity(draft, id(40), 1, state.menu)).toThrow(expect.objectContaining({ code: "OPTION_VALUE_UNAVAILABLE" }));
    expect(draft).toEqual(original); expect(source.items[0].quantity).toBe(2);
  });
});
