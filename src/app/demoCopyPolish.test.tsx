import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const admin: Employee = { id: "emp-admin", name: "Quản lý", role: "admin", isActive: true };

const implementationCopyPatterns = [
  /mock/i,
  /supabase/i,
  /raw Store Key/i,
  /app state/i,
  /\bDB\b/i,
  /\bDraft\b/i,
  /tombstone/i,
  /\bseed\b/i,
  /deactivate/i,
  /\bMVP\b/i,
  /Menu Editor/i,
  /Floor-Plan Editor/i,
  /Canvas\s*1600/i,
  /Clear demo/i,
  /Optional/i,
  /placeholder/i,
  /\bseam\b/i,
  /paid order/i,
  /\bvoid\b/i,
  /Đã TT/i,
];

const expectNoImplementationCopy = (container: HTMLElement) => {
  const visibleText = container.textContent ?? "";
  for (const pattern of implementationCopyPatterns) {
    expect(visibleText).not.toMatch(pattern);
  }
};

const resetAppStore = (override: Partial<ReturnType<typeof useAppStore.getState>> = {}) => {
  useAppStore.setState({
    screen: "passcode",
    currentEmployee: admin,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: null,
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
    ...override,
  });
};

const renderApp = (
  override: Partial<ReturnType<typeof useAppStore.getState>> = {},
  options: { paired?: boolean } = {},
) => {
  const state = createSeededMockState();
  if (options.paired ?? true) {
    state.session = { storeId: "store-demo-001", storeNo: 1 };
  }
  const ports = createMockPorts(state);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  resetAppStore(override);
  const view = render(
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </PortsContext.Provider>,
  );

  return { ...view, state };
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

describe("demo copy polish", () => {
  it("keeps setup screens free of implementation copy", async () => {
    const user = userEvent.setup();
    const { container } = renderApp({ screen: "landing", currentEmployee: null }, { paired: false });

    expect(await screen.findByTestId("landing-screen")).toBeInTheDocument();
    expectNoImplementationCopy(container);

    await user.click(screen.getByTestId("go-create-store"));
    await user.type(screen.getByTestId("store-name-input"), "Cafe Sáng");
    await user.click(screen.getByTestId("create-store-button"));

    expect(await screen.findByTestId("create-store-result")).toBeInTheDocument();
    expectNoImplementationCopy(container);
  });

  it("keeps the sample Store Key as placeholder copy instead of a submitted value", async () => {
    const user = userEvent.setup();
    renderApp({ screen: "landing", currentEmployee: null }, { paired: false });

    await user.click(await screen.findByTestId("go-store-pairing"));
    const input = screen.getByTestId("store-key-input");

    expect(input).toHaveValue("");
    await user.click(screen.getByTestId("go-passcode"));

    expect(await screen.findByText(/Sai định dạng/)).toBeInTheDocument();
  });

  it("keeps order UI free of database and draft wording", async () => {
    const { container } = renderApp({
      drawer: "order",
      orderContext: { orderId: null, tableId: "tbl-b01", orderType: "dine_in" },
    });

    expect(await screen.findByTestId("order-drawer")).toBeInTheDocument();
    expectNoImplementationCopy(container);
  });

  it("keeps admin drawers free of implementation copy", async () => {
    for (const drawer of ["menuEditor", "floorEditor", "report", "kitchen", "paymentSettings"] as const) {
      cleanup();
      const { container } = renderApp({ drawer });
      expect(await screen.findByTestId(drawer === "report" ? "report" : drawer === "menuEditor" ? "menu-editor" : drawer === "floorEditor" ? "floor-editor" : drawer === "kitchen" ? "kitchen-drawer" : "payment-settings-drawer")).toBeInTheDocument();
      expectNoImplementationCopy(container);
    }
  });

  it("keeps maintenance reset copy user-facing", async () => {
    const user = userEvent.setup();
    const { container } = renderApp({ drawer: "settings" });

    expect(await screen.findByTestId("settings-drawer")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Bảo trì dữ liệu" }));
    await user.click(screen.getByTestId("open-clear-demo"));
    expect(await screen.findByTestId("clear-demo-dialog")).toBeInTheDocument();

    expectNoImplementationCopy(container);
  });
});

describe("drawer overlays", () => {
  it("closes the active drawer when the overlay is clicked", async () => {
    renderApp({ drawer: "kitchen" });

    const drawer = await screen.findByTestId("kitchen-drawer");
    const overlay = drawer.parentElement;
    expect(overlay).not.toBeNull();

    fireEvent.click(overlay!);

    await waitFor(() => {
      expect(screen.queryByTestId("kitchen-drawer")).not.toBeInTheDocument();
    });
    expect(useAppStore.getState().drawer).toBeNull();
  });
});
