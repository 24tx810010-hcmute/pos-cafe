import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createMockState } from "@/adapters/mock";
import { AppError } from "@/core/appError";
import type { Employee, OrderSummary } from "@/domain";
import { PortsContext } from "@/ports/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const admin: Employee = { id: "emp-admin", name: "Quản lý", role: "admin", isActive: true };

const resetAppStore = (override: Partial<ReturnType<typeof useAppStore.getState>> = {}) => {
  useAppStore.setState({
    screen: "passcode",
    currentEmployee: admin,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: "settings",
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
    ...override,
  });
};

const renderAppWithPorts = (
  override: Partial<ReturnType<typeof useAppStore.getState>> = {},
  configure?: (ports: ReturnType<typeof createMockPorts>, state: ReturnType<typeof createMockState>) => void,
) => {
  const state = createMockState();
  state.session = { storeId: "store-demo-001", storeNo: 1 };
  const ports = createMockPorts(state);
  configure?.(ports, state);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  resetAppStore(override);
  render(
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </PortsContext.Provider>,
  );

  return { ports, state };
};

const openClearDemoDialog = async () => {
  const user = userEvent.setup();

  await screen.findByTestId("settings-drawer");
  await screen.findByRole("button", { name: "Mục" });
  await user.click(screen.getByRole("button", { name: "Demo" }));
  fireEvent.click(screen.getByTestId("open-clear-demo"));

  return user;
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

describe("Demo hardening", () => {
  it("does not allow clear-demo while open orders are still being checked", async () => {
    renderAppWithPorts({}, (ports) => {
      vi.spyOn(ports.order, "listOpenOrders").mockReturnValue(new Promise<OrderSummary[]>(() => {}));
    });

    await openClearDemoDialog();

    expect(await screen.findByTestId("clear-demo-loading")).toBeInTheDocument();
    expect(screen.getByTestId("clear-demo-confirm-button")).toBeDisabled();
  });

  it("keeps clear-demo disabled when open-order check fails and can retry", async () => {
    let listSpy: ReturnType<typeof vi.spyOn>;
    let rejectOpenOrders: (error: unknown) => void = () => {};
    renderAppWithPorts({}, (ports) => {
      listSpy = vi
        .spyOn(ports.order, "listOpenOrders")
        .mockImplementationOnce(
          () =>
            new Promise<OrderSummary[]>((_, reject) => {
              rejectOpenOrders = reject;
            }),
        )
        .mockResolvedValueOnce([]);
    });

    const user = await openClearDemoDialog();

    expect(await screen.findByTestId("clear-demo-loading")).toBeInTheDocument();
    rejectOpenOrders(new AppError("UNKNOWN", "Network failed"));

    expect(await screen.findByTestId("clear-demo-error")).toBeInTheDocument();
    expect(screen.getByTestId("clear-demo-confirm-button")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Thử kiểm tra lại" }));

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("clear-demo-confirm-input")).toBeInTheDocument();
  });

  it("shows a payment error state instead of a zero-value bill when the order cannot load", async () => {
    const { ports } = renderAppWithPorts({ drawer: "payment", paymentOrderId: "missing-order" });
    vi.spyOn(ports.order, "getOrder").mockRejectedValue(new AppError("NOT_FOUND", "Không tìm thấy đơn."));

    expect(await screen.findByTestId("payment-error-state")).toBeInTheDocument();
    expect(screen.getByTestId("pay-button")).toBeDisabled();
  });

  it("refetches the payment order after an order conflict", async () => {
    const user = userEvent.setup();
    const { ports } = renderAppWithPorts({ drawer: "payment", paymentOrderId: "ord-b02" });
    const getOrderSpy = vi.spyOn(ports.order, "getOrder");
    const paySpy = vi.spyOn(ports.payment, "payOrder").mockRejectedValue(
      new AppError("ORDER_VERSION_CONFLICT", "Dữ liệu đã thay đổi, vui lòng tải lại."),
    );

    await screen.findByText("Thanh toán · Đơn #24");
    await waitFor(() => expect(screen.getByTestId("pay-button")).toBeEnabled());
    const callsBeforePayment = getOrderSpy.mock.calls.length;
    await user.click(screen.getByTestId("pay-button"));

    await waitFor(() => expect(paySpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getOrderSpy.mock.calls.length).toBeGreaterThan(callsBeforePayment));
  });
});
