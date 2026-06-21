import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createMockState, type MockState } from "@/adapters/mock";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const admin: Employee = { id: "emp-admin", name: "Quản lý", role: "admin", isActive: true };

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

const shiftBusinessDate = (businessDate: string, days: number): string => {
  const date = new Date(`${businessDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const seedOrdersForToday = (state: MockState, businessDate: string) => {
  state.orders = state.orders.map((order) => ({
    ...order,
    businessDate,
    paidAt: order.paidAt ? `${businessDate}T09:15:00.000Z` : null,
  }));
};

const resetAppStoreForDrawer = (drawer: "orderHistory" | "reportSettings") => {
  useAppStore.setState({
    screen: "passcode",
    currentEmployee: admin,
    activeAreaId: null,
    activeCategoryId: null,
    drawer,
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
  });
};

const renderDrawer = (drawer: "orderHistory" | "reportSettings") => {
  const state = createMockState();
  state.session = { storeId: "store-demo-001", storeNo: 1 };
  const businessDate = businessDateForTest();
  seedOrdersForToday(state, businessDate);
  const ports = createMockPorts(state);
  const historySpy = vi.spyOn(ports.order, "listOrderHistory");
  const detailSpy = vi.spyOn(ports.order, "getOrder");
  const reportSpy = vi.spyOn(ports.report, "getCoreReport");
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  resetAppStoreForDrawer(drawer);
  render(
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </PortsContext.Provider>,
  );

  return { businessDate, detailSpy, historySpy, reportSpy };
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

describe("Report and history drawers", () => {
  it("loads order history through the order history port and fetches selected order detail", async () => {
    const user = userEvent.setup();
    const { businessDate, detailSpy, historySpy } = renderDrawer("orderHistory");

    await waitFor(() =>
      expect(historySpy).toHaveBeenCalledWith({
        fromDate: businessDate,
        toDate: businessDate,
        page: 1,
        pageSize: 8,
      }),
    );

    await user.click(await screen.findByTestId("history-row-ord-paid-1"));

    await waitFor(() => expect(detailSpy).toHaveBeenCalledWith("ord-paid-1"));
    expect(await screen.findByText(/Latte/)).toBeInTheDocument();
  });

  it("applies custom order history date ranges to the query payload", async () => {
    const user = userEvent.setup();
    const { businessDate, historySpy } = renderDrawer("orderHistory");
    const fromDate = shiftBusinessDate(businessDate, -2);

    await user.click(await screen.findByRole("button", { name: "Tuỳ chọn" }));
    await user.clear(screen.getByTestId("history-from-date"));
    await user.type(screen.getByTestId("history-from-date"), fromDate);
    await user.clear(screen.getByTestId("history-to-date"));
    await user.type(screen.getByTestId("history-to-date"), businessDate);

    await waitFor(() =>
      expect(historySpy).toHaveBeenLastCalledWith({
        fromDate,
        toDate: businessDate,
        page: 1,
        pageSize: 8,
      }),
    );
  });

  it("loads report metrics through daily core report queries", async () => {
    const { businessDate, historySpy, reportSpy } = renderDrawer("reportSettings");

    await waitFor(() => expect(reportSpy).toHaveBeenCalledWith({ businessDate }));
    await waitFor(() =>
      expect(historySpy).toHaveBeenCalledWith({
        fromDate: businessDate,
        toDate: businessDate,
        page: 1,
        pageSize: 20,
      }),
    );
    expect((await screen.findAllByText(/77\.000/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Latte").length).toBeGreaterThan(0);
  });

  it("expands 7-day report ranges into daily report calls without changing the port contract", async () => {
    const user = userEvent.setup();
    const { businessDate, reportSpy } = renderDrawer("reportSettings");
    const expectedDates = Array.from({ length: 7 }, (_, index) => shiftBusinessDate(businessDate, index - 6));

    await user.click(await screen.findByRole("button", { name: "7 ngày" }));

    await waitFor(() => {
      const calledDates = reportSpy.mock.calls.map(([filter]) => filter.businessDate);
      expect(calledDates).toEqual(expect.arrayContaining(expectedDates));
    });
  });
});
