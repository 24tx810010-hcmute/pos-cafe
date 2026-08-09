import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState, type MockState } from "@/adapters/mock";
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
    payment: order.payment ? { ...order.payment, paidAt: `${businessDate}T09:15:00.000Z` } : null,
  }));
};

const resetAppStoreForDrawer = (drawer: "orderHistory" | "report") => {
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

const renderDrawer = (
  drawer: "orderHistory" | "report",
  configureState?: (state: MockState, businessDate: string) => void,
) => {
  const state = createSeededMockState();
  state.session = { storeId: "store-demo-001", storeNo: 1 };
  const businessDate = businessDateForTest();
  seedOrdersForToday(state, businessDate);
  configureState?.(state, businessDate);
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
    const { detailSpy, historySpy } = renderDrawer("orderHistory");

    await waitFor(() =>
      expect(historySpy).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
      }),
    );
    expect(screen.getByTestId("history-date-filter-button")).toHaveTextContent("Thời gian: Gần đây");

    await user.click(await screen.findByTestId("history-row-ord-paid-1"));

    await waitFor(() => expect(detailSpy).toHaveBeenCalledWith("ord-paid-1"));
    expect(await screen.findByText(/Latte/)).toBeInTheDocument();
  });

  it("renders unique presentation numbers for repeated daily order numbers and keeps UUID selection", async () => {
    const user = userEvent.setup();
    const { detailSpy } = renderDrawer("orderHistory", (state, businessDate) => {
      const baseOrder = state.orders.find((order) => order.id === "ord-paid-1")!;
      state.orders = [
        { ...structuredClone(baseOrder), id: "ord-history-new", orderNo: 2, status: "void" },
        { ...structuredClone(baseOrder), id: "ord-history-middle", orderNo: 1 },
        {
          ...structuredClone(baseOrder),
          id: "ord-history-old",
          orderNo: 1,
          businessDate: shiftBusinessDate(businessDate, -2),
        },
      ];
    });

    const newestRow = await screen.findByTestId("history-row-ord-history-new");
    const middleRow = screen.getByTestId("history-row-ord-history-middle");
    const oldestRow = screen.getByTestId("history-row-ord-history-old");
    expect(within(newestRow).getByText("#3")).toBeInTheDocument();
    expect(within(middleRow).getByText("#2")).toBeInTheDocument();
    expect(within(oldestRow).getByText("#1")).toBeInTheDocument();

    await user.click(middleRow);
    await waitFor(() => expect(detailSpy).toHaveBeenCalledWith("ord-history-middle"));
    expect(await screen.findByText("Chi tiết đơn #2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Đã hủy" }));
    expect(within(await screen.findByTestId("history-row-ord-history-new")).getByText("#1")).toBeInTheDocument();
    expect(await screen.findByText("Chi tiết đơn #1")).toBeInTheDocument();
  });

  it("shows paid order payment snapshot in the receipt summary", async () => {
    const user = userEvent.setup();
    renderDrawer("orderHistory");

    await user.click(await screen.findByTestId("history-row-ord-paid-1"));

    expect(await screen.findByTestId("history-payment-employee")).toHaveTextContent("Thu ngân 1");
    expect(screen.getByText("Nhân viên thanh toán")).toBeInTheDocument();
    expect(screen.queryByText("Người thanh toán")).not.toBeInTheDocument();
    const paymentSummary = await screen.findByTestId("history-payment-summary");
    const labels = within(paymentSummary).getAllByTestId("history-payment-label").map((label) => label.textContent);

    expect(labels).toEqual(["Khách đưa", "Tiền thừa", "Tổng tiền"]);
    expect(within(paymentSummary).getByText("100.000đ")).toBeInTheDocument();
    expect(within(paymentSummary).getByText("23.000đ")).toBeInTheDocument();
    expect(within(paymentSummary).getByText("77.000đ")).toBeInTheDocument();
  });

  it("keeps open orders out of the order history view", async () => {
    renderDrawer("orderHistory");

    expect(await screen.findByTestId("history-row-ord-paid-1")).toBeInTheDocument();
    expect(screen.queryByTestId("history-row-ord-b02")).not.toBeInTheDocument();
    expect(screen.queryByTestId("history-row-ord-b05")).not.toBeInTheDocument();
    expect(screen.queryByTestId("history-row-ord-takeaway-1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đang mở" })).not.toBeInTheDocument();
  });

  it("applies custom order history date ranges to the query payload", async () => {
    const user = userEvent.setup();
    const { businessDate, historySpy } = renderDrawer("orderHistory");
    const fromDate = shiftBusinessDate(businessDate, -2);

    await user.click(await screen.findByTestId("history-date-filter-button"));
    await user.click(await screen.findByTestId("history-date-range-custom"));
    await user.clear(screen.getByTestId("history-from-date"));
    await user.type(screen.getByTestId("history-from-date"), fromDate);
    await user.clear(screen.getByTestId("history-to-date"));
    await user.type(screen.getByTestId("history-to-date"), businessDate);

    await waitFor(() =>
      expect(historySpy).toHaveBeenLastCalledWith({
        fromDate,
        toDate: businessDate,
        page: 1,
        pageSize: 20,
      }),
    );
  });

  it("loads report metrics through daily core report queries", async () => {
    const { businessDate, historySpy, reportSpy } = renderDrawer("report");

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
    const { businessDate, reportSpy } = renderDrawer("report");
    const expectedDates = Array.from({ length: 7 }, (_, index) => shiftBusinessDate(businessDate, index - 6));

    await user.click(await screen.findByRole("button", { name: "7 ngày" }));

    await waitFor(() => {
      const calledDates = reportSpy.mock.calls.map(([filter]) => filter.businessDate);
      expect(calledDates).toEqual(expect.arrayContaining(expectedDates));
    });
  });
});
