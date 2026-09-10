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
  id: "22828322-623b-42e7-8a28-a2bdf367c364",
  name: "Thu ngân",
  role: "cashier",
  isActive: true,
  permissionOverrides: { grants: [], denies: ["order.create"] },
};

const renderNewOrder = () => {
  const state = createSeededMockState();
  state.session = { storeId: "e572ea5f-9adf-493c-8d84-dca3cd86e1eb", storeNo: 1 };
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
    orderContext: { orderId: null, tableId: "7b035353-73d6-44bc-8ec4-1ab9951f7a58", orderType: "dine_in" },
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
    await user.click(await screen.findByTestId("menu-item-80cfbd5a-a538-4da6-888d-2f732b7b8e2d"));

    for (const testId of ["submit-order-button", "submit-order-button-footer"]) {
      const button = screen.getByTestId(testId);
      await waitFor(() => expect(button).toBeDisabled());
      expect(button).toHaveAttribute("title", "Không có quyền tạo đơn");
    }
    expect(submitSpy).not.toHaveBeenCalled();
  });
});
