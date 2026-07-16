import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState, type MockState } from "@/adapters/mock";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const admin: Employee = { id: "emp-admin", name: "Quản lý", role: "admin", isActive: true };
const cashier: Employee = { id: "emp-cashier-1", name: "Thu ngân 1", role: "cashier", isActive: true };

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const businessDateForTest = (): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Saigon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
};

const seedOrdersForToday = (state: MockState, businessDate: string) => {
  state.orders = state.orders.map((order) => ({
    ...order,
    businessDate,
    paidAt: order.paidAt ? `${businessDate}T09:15:00.000Z` : null,
    payment: order.payment ? { ...order.payment, paidAt: `${businessDate}T09:15:00.000Z` } : null,
  }));
};

const resetStore = (actor: Employee) => {
  useAppStore.setState({
    screen: "passcode",
    currentEmployee: actor,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: "orderHistory",
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
  });
};

const renderDrawer = (options: { actor?: Employee; voidPaidOrder?: boolean } = {}) => {
  const actor = options.actor ?? admin;
  const state = createSeededMockState();
  state.session = { storeId: "store-demo-001", storeNo: 1 };
  const businessDate = businessDateForTest();
  seedOrdersForToday(state, businessDate);

  if (options.voidPaidOrder) {
    const paid = state.orders.find((order) => order.id === "ord-paid-1")!;
    paid.status = "void";
    paid.voidedAt = `${businessDate}T10:00:00.000Z`;
    paid.voidedByEmployeeId = "emp-admin";
    paid.voidReasonCode = "customer_request";
    paid.voidReasonNote = "Khách đổi ý";
  }

  const ports = createMockPorts(state);
  const voidSpy = vi.spyOn(ports.order, "voidOrder");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  resetStore(actor);
  render(
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </PortsContext.Provider>,
  );

  return { voidSpy };
};

afterEach(() => {
  cleanup();
  useAppStore.setState({
    screen: "landing",
    currentEmployee: null,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: null,
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
  });
});

describe("Order history — void paid order", () => {
  it("lets an admin void a paid order through the order port", async () => {
    const user = userEvent.setup();
    const { voidSpy } = renderDrawer();

    await user.click(await screen.findByTestId("history-row-ord-paid-1"));
    const voidButton = await screen.findByTestId("history-void-order");
    await waitFor(() => expect(voidButton).not.toBeDisabled());
    await user.click(voidButton);

    await user.selectOptions(await screen.findByTestId("history-void-reason"), "duplicate");
    await user.click(screen.getByTestId("history-void-confirm"));

    await waitFor(() =>
      expect(voidSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "ord-paid-1",
          employeeId: "emp-admin",
          reasonCode: "duplicate",
        }),
      ),
    );
  });

  it("hides the void action from a cashier without the permission", async () => {
    const user = userEvent.setup();
    renderDrawer({ actor: cashier });

    await user.click(await screen.findByTestId("history-row-ord-paid-1"));
    await screen.findByTestId("history-payment-summary");
    expect(screen.queryByTestId("history-void-order")).not.toBeInTheDocument();
  });

  it("disables confirm when reason is other and note is empty", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(await screen.findByTestId("history-row-ord-paid-1"));
    const voidButton = await screen.findByTestId("history-void-order");
    await waitFor(() => expect(voidButton).not.toBeDisabled());
    await user.click(voidButton);

    await user.selectOptions(await screen.findByTestId("history-void-reason"), "other");
    expect(screen.getByTestId("history-void-confirm")).toBeDisabled();

    await user.type(screen.getByTestId("history-void-note"), "Ghi chú lý do");
    expect(screen.getByTestId("history-void-confirm")).not.toBeDisabled();
  });

  it("shows who voided the order and disables reprint for a voided order", async () => {
    const user = userEvent.setup();
    renderDrawer({ voidPaidOrder: true });

    await user.click(await screen.findByTestId("history-row-ord-paid-1"));

    const voidInfo = await screen.findByTestId("history-void-info");
    expect(voidInfo).toHaveTextContent("Quản lý");
    expect(voidInfo).toHaveTextContent("Khách đổi ý / trả món");
    expect(screen.queryByTestId("history-void-order")).not.toBeInTheDocument();
    expect(screen.getByLabelText("In lại hóa đơn")).toBeDisabled();
  });
});
