import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MockState } from "@/adapters/mock";
import type { AppPorts } from "@/ports";
import { activateCandidateUi, createCandidateRuntimeFixture } from "@/test/candidateRuntimeFixture";
import { AppError } from "@/core/appError";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const admin: Employee = { id: "30000000-0000-4000-8000-000000000011", name: "Chủ cửa hàng", role: "admin", isActive: true };

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

const renderAppWithPorts = async (
  override: Partial<ReturnType<typeof useAppStore.getState>> = {},
  configure?: (ports: AppPorts, state: MockState) => void,
) => {
  const fixture = await createCandidateRuntimeFixture(); const state = fixture.business; const ports = fixture.ports;
  configure?.(ports, state);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  activateCandidateUi(fixture);
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
  await user.click(await screen.findByRole("button", { name: "Bảo trì dữ liệu" }));
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
    await renderAppWithPorts({}, (ports) => {
      vi.spyOn(ports.permission!.read, "getFloorOperational").mockReturnValue(new Promise(() => {}));
    });

    await openClearDemoDialog();

    expect(await screen.findByTestId("clear-demo-loading")).toBeInTheDocument();
    expect(screen.getByTestId("clear-demo-confirm-button")).toBeDisabled();
  });

  it("keeps clear-demo disabled when open-order check fails and can retry", async () => {
    let listSpy: ReturnType<typeof vi.spyOn>;
    let rejectOpenOrders: (error: unknown) => void = () => {};
    await renderAppWithPorts({}, (ports) => {
      listSpy = vi
        .spyOn(ports.permission!.read, "getFloorOperational")
        .mockImplementationOnce(
          () =>
            new Promise((_, reject) => {
              rejectOpenOrders = reject;
            }),
        )
        .mockResolvedValueOnce({ floorPlan: { areas: [], tables: [], decorItems: [] }, openOrders: [] });
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

  it("keeps one request id across a lost ACK retry and generates a new id for a new action", async () => {
    let clearSpy!: ReturnType<typeof vi.spyOn>;
    await renderAppWithPorts({}, (ports) => {
      vi.spyOn(ports.permission!.read, "getFloorOperational").mockResolvedValue({
        floorPlan: { areas: [], tables: [], decorItems: [] }, openOrders: [],
      });
      clearSpy = vi.spyOn(ports.permission!.changes, "clearDemoData")
        .mockRejectedValueOnce(new AppError("PERMISSION_UPDATE_UNAVAILABLE", "Chưa thể xác nhận thay đổi."))
        .mockResolvedValue(undefined);
    });

    const user = await openClearDemoDialog();
    await user.type(await screen.findByTestId("clear-demo-confirm-input"), "CLEAR");
    await user.click(screen.getByTestId("clear-demo-confirm-button"));
    await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(1));
    await user.click(screen.getByTestId("clear-demo-confirm-button"));
    await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(2));
    expect(clearSpy!.mock.calls[1][0]).toEqual(clearSpy!.mock.calls[0][0]);
    await waitFor(() => expect(screen.queryByTestId("clear-demo-dialog")).not.toBeInTheDocument());

    await user.click(await screen.findByRole("button", { name: "Bảo trì dữ liệu" }));
    await user.click(await screen.findByTestId("open-clear-demo"));
    await user.type(await screen.findByTestId("clear-demo-confirm-input"), "CLEAR");
    await user.click(screen.getByTestId("clear-demo-confirm-button"));
    await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(3));
    expect(clearSpy!.mock.calls[2][0]).not.toEqual(clearSpy!.mock.calls[0][0]);
  });

  it("shows a payment error state instead of a zero-value bill when the order cannot load", async () => {
    const { ports } = await renderAppWithPorts({ drawer: "payment", paymentOrderId: "missing-order" });
    vi.spyOn(ports.permission!.read, "getOpenOrderDetail").mockRejectedValue(new AppError("NOT_FOUND", "Không tìm thấy đơn."));

    expect(await screen.findByTestId("payment-error-state")).toBeInTheDocument();
    expect(screen.getByTestId("pay-button")).toBeDisabled();
  });

  it("refetches the payment order after an order conflict", async () => {
    const user = userEvent.setup();
    const { ports } = await renderAppWithPorts({ drawer: "payment", paymentOrderId: "7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c" });
    const getOrderSpy = vi.spyOn(ports.permission!.read, "getOpenOrderDetail");
    const paySpy = vi.spyOn(ports.write, "execute").mockRejectedValue(
      new AppError("ORDER_VERSION_CONFLICT", "Dữ liệu đã thay đổi, vui lòng tải lại."),
    );

    await screen.findByText("Thanh toán · Đơn #24");
    await waitFor(() => expect(screen.getByTestId("pay-button")).toBeEnabled());
    const callsBeforePayment = getOrderSpy.mock.calls.length;
    await user.click(screen.getByTestId("pay-button"));

    await waitFor(() => expect(paySpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getOrderSpy.mock.calls.length).toBeGreaterThan(callsBeforePayment));
  });

  it("refuses payment when an order is no longer open on another device", async () => {
    await renderAppWithPorts({ drawer: "payment", paymentOrderId: "7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c" }, (_ports, state) => {
      const order = state.orders.find((candidate) => candidate.id === "7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
      if (order) {
        order.status = "paid";
        order.paidAt = new Date().toISOString();
        order.lockVersion += 1;
      }
    });

    expect(await screen.findByTestId("payment-error-state")).toBeInTheDocument();
    expect(screen.getByTestId("pay-button")).toBeDisabled();
    expect(screen.queryByTestId("pay-button-footer")).not.toBeInTheDocument();
  });

  it("renders the cashier payment console with balanced payment summary", async () => {
    await renderAppWithPorts({ drawer: "payment", paymentOrderId: "7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c" });

    const drawer = await screen.findByTestId("payment-drawer");
    expect(await within(drawer).findByTestId("payment-cashier-console")).toBeInTheDocument();
    expect(within(drawer).getByTestId("payment-method-list")).toBeInTheDocument();
    expect(within(drawer).getByTestId("payment-keypad")).toBeInTheDocument();
    expect(within(drawer).getByTestId("payment-order-items")).toHaveClass("overflow-y-auto");

    const printCheckbox = within(drawer).getByTestId("print-receipt-checkbox");
    expect(printCheckbox).toBeChecked();

    const receivedValue = within(drawer).getByTestId("payment-received-summary-value");
    const changeValue = within(drawer).getByTestId("payment-change-summary-value");
    expect(receivedValue.className).toBe(changeValue.className);

    const summary = within(drawer).getByTestId("payment-order-summary");
    const completeButton = within(summary).getByTestId("pay-button-footer");
    expect(summary.contains(printCheckbox)).toBe(true);
    expect(summary.contains(completeButton)).toBe(true);
  });
});
