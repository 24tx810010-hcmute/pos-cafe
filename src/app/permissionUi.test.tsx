import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const cashierDeniedCreate: Employee = {
  id: "emp-cashier-1",
  name: "Thu ngân",
  role: "cashier",
  isActive: true,
  permissionOverrides: { grants: [], denies: ["order.create"] },
};

const renderNewOrder = () => {
  const state = createSeededMockState();
  state.session = { storeId: "store-demo-001", storeNo: 1 };
  const ports = createMockPorts(state);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  useAppStore.setState({
    screen: "passcode",
    currentEmployee: cashierDeniedCreate,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: "order",
    orderContext: { orderId: null, tableId: "tbl-b01", orderType: "dine_in" },
    paymentOrderId: null,
    draftItems: [],
    receiptPreview: null,
  });

  render(
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </PortsContext.Provider>,
  );

  return ports;
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
    receiptPreview: null,
  });
});

describe("POS permission soft gates", () => {
  it("keeps both create-order actions disabled with a Vietnamese reason", async () => {
    const user = userEvent.setup();
    const ports = renderNewOrder();
    const submitSpy = vi.spyOn(ports.order, "submitOrderChanges");

    await screen.findByTestId("order-drawer");
    await user.click(await screen.findByTestId("menu-item-mi-americano"));

    for (const testId of ["submit-order-button", "submit-order-button-footer"]) {
      const button = screen.getByTestId(testId);
      await waitFor(() => expect(button).toBeDisabled());
      expect(button).toHaveAttribute("title", "Không có quyền tạo đơn");
    }
    expect(submitSpy).not.toHaveBeenCalled();
  });
});
