import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import { mockWriteState } from "@/adapters/mock/writeState";
import { PortsContext } from "@/features/shared/portsContext";
import { OrderDrawer } from "./drawers/pos/OrderDrawer";
import { WriteLifecycle } from "./WriteLifecycle";
import { useAppStore } from "./useAppStore";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks();
  useAppStore.setState({ currentEmployee: null, drawer: null, orderContext: null, paymentOrderId: null, draftItems: [], receiptPreview: null });
});
function Surface() { return useAppStore(state => state.drawer) === "order" ? <OrderDrawer /> : null; }
async function fixture() {
  const state = createSeededMockState(); state.session = { storeId: state.settings.storeId, storeNo: 1 }; state.orders = [];
  state.menu.optionGroups = []; state.menu.optionValues = []; state.menu.menuItemOptionGroups = [];
  const menuItem = state.menu.menuItems[0]; menuItem.price = 30000;
  const ports = createMockPorts(state); const admin = state.employees.find(e => e.role === "admin")!;
  await ports.employee.startSession(admin.id, state.pins[admin.id]);
  useAppStore.setState({ currentEmployee: admin, drawer: "order", orderContext: { orderId: null, tableId: null, orderType: "takeaway" } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><WriteLifecycle /><Surface /></QueryClientProvider></PortsContext.Provider>);
  fireEvent.click(await screen.findByTestId(`menu-item-${menuItem.id}`));
  return { state, ports, menuItem };
}
for (const lost of ["pending", "committed"] as const) test(`TC-IDEM-052/core/draft=${lost} retry consumes the confirmed draft without a second registration or preview`, async () => {
  const { ports, state, menuItem } = await fixture(); const register = vi.spyOn(ports.write, "register");
  const original = ports.write.execute.bind(ports.write); let first = true;
  const execute = vi.spyOn(ports.write, "execute").mockImplementation(async (key, payload) => {
    if (!first) return original(key, payload);
    first = false; if (lost === "committed") await original(key, payload); throw new Error("lost ACK");
  });
  const originalDraft = structuredClone(useAppStore.getState().draftItems);
  fireEvent.click(screen.getByTestId("submit-order-button"));
  const retry = await screen.findByRole("button", { name: "Thử lại cùng lệnh" });
  expect(screen.getByTestId(`menu-item-${menuItem.id}`)).toBeDisabled();
  expect(screen.getByTestId("order-cart-increase")).toBeDisabled();
  await userEvent.click(screen.getByTestId("order-cart-increase"));
  expect(useAppStore.getState().draftItems).toEqual(originalDraft);
  fireEvent.click(retry);
  await waitFor(() => expect(useAppStore.getState().drawer).toBeNull());
  expect(useAppStore.getState().draftItems).toEqual([]); expect(useAppStore.getState().orderContext).toBeNull();
  expect(useAppStore.getState().receiptPreview).toBeNull(); expect(state.orders).toHaveLength(1);
  expect(register).toHaveBeenCalledTimes(1); expect(execute).toHaveBeenCalledTimes(2);
  expect(execute.mock.calls[0]).toEqual(execute.mock.calls[1]);
  expect(Object.values(mockWriteState(state).operations)).toHaveLength(1);
  act(() => useAppStore.getState().openOrder({ orderId: null, tableId: null, orderType: "takeaway" }));
  await screen.findByTestId("order-drawer"); expect(useAppStore.getState().draftItems).toEqual([]);
  expect(register).toHaveBeenCalledTimes(1); expect(state.lastTicket).toBeNull();
});
test("TC-IDEM-052/core/draft=late_retry a response after leaving cannot consume another draft", async () => {
  const { ports } = await fixture(); const original = ports.write.execute.bind(ports.write); let first = true;
  let release!: () => void;
  vi.spyOn(ports.write, "execute").mockImplementation(async (key, payload) => {
    if (first) { first = false; await original(key, payload); throw new Error("lost ACK"); }
    const result = await original(key, payload); await new Promise<void>(done => { release = done; }); return result;
  });
  fireEvent.click(screen.getByTestId("submit-order-button"));
  fireEvent.click(await screen.findByRole("button", { name: "Thử lại cùng lệnh" }));
  await waitFor(() => expect(release).toBeDefined());
  act(() => useAppStore.getState().closeDrawer());
  act(() => useAppStore.getState().openOrder({ orderId: null, tableId: null, orderType: "takeaway" }));
  const freshContext = useAppStore.getState().orderContext;
  const newDraft = [{ id: crypto.randomUUID(), menuItemId: crypto.randomUUID(), quantity: 1, quotedBasePrice: 20000, options: [] }];
  act(() => useAppStore.getState().setDraftItems(newDraft));
  await act(async () => release());
  expect(useAppStore.getState().orderContext).toBe(freshContext); expect(useAppStore.getState().draftItems).toEqual(newDraft);
  expect(useAppStore.getState().receiptPreview).toBeNull();
});
