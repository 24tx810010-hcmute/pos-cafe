import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { activateCandidateUi, createCandidateRuntimeFixture } from "@/test/candidateRuntimeFixture";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const admin: Employee = { id: "30000000-0000-4000-8000-000000000011", name: "Chủ cửa hàng", role: "admin", isActive: true };

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

const renderApp = async (
  override: Partial<ReturnType<typeof useAppStore.getState>> = {},
  options: { paired?: boolean } = {},
) => {
  const fixture = await createCandidateRuntimeFixture(); const state = fixture.business; const ports = fixture.ports;
  if (!(options.paired ?? true)) await ports.auth.unpairStore();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  if ((options.paired ?? true) && override.currentEmployee !== null) activateCandidateUi(fixture);
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
    createdStoreResult: null,
    pendingStoreCreationInput: null,
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
    const { container } = await renderApp({ screen: "landing", currentEmployee: null }, { paired: false });

    expect(await screen.findByTestId("landing-screen")).toBeInTheDocument();
    expectNoImplementationCopy(container);

    await user.click(screen.getByTestId("go-create-store"));
    await user.type(screen.getByTestId("store-name-input"), "Cafe Sáng");
    await user.click(screen.getByTestId("key-loss-acknowledgement"));
    await user.click(screen.getByTestId("create-store-button"));

    expect(await screen.findByTestId("create-store-result")).toBeInTheDocument();
    expectNoImplementationCopy(container);
  });

  it("does not show feature bullets on the landing screen", async () => {
    await renderApp({ screen: "landing", currentEmployee: null }, { paired: false });

    expect(await screen.findByTestId("landing-screen")).toBeInTheDocument();
    expect(screen.queryByText("Dùng được trên máy tính, máy tính bảng và điện thoại nằm ngang.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nhân viên đăng nhập nhanh bằng mã PIN riêng.")).not.toBeInTheDocument();
    expect(screen.queryByText("Dữ liệu đồng bộ tức thời giữa các thiết bị cùng quán.")).not.toBeInTheDocument();
  });

  it("keeps the sample Store Key as placeholder copy instead of a submitted value", async () => {
    const user = userEvent.setup();
    await renderApp({ screen: "landing", currentEmployee: null }, { paired: false });

    await user.click(await screen.findByTestId("go-store-pairing"));
    const input = screen.getByTestId("store-key-input");

    expect(input).toHaveValue("");
    await user.click(screen.getByTestId("go-passcode"));

    expect(await screen.findByText(/Sai định dạng/)).toBeInTheDocument();
  });

  it("keeps the future kitchen role out of the employee PIN screen", async () => {
    await renderApp({ screen: "passcode", currentEmployee: null });

    expect(await screen.findByTestId("employee-30000000-0000-4000-8000-000000000011")).toBeInTheDocument();
    expect(screen.getByTestId("employee-30000000-0000-4000-8000-000000000013")).toBeInTheDocument();
    expect(screen.queryByTestId("employee-30000000-0000-4000-8000-000000000015")).not.toBeInTheDocument();
  });

  it("keeps order UI free of database and draft wording", async () => {
    const { container } = await renderApp({
      drawer: "order",
      orderContext: { orderId: null, tableId: "7b035353-73d6-44bc-8ec4-1ab9951f7a58", orderType: "dine_in" },
    });

    expect(await screen.findByTestId("order-drawer")).toBeInTheDocument();
    expectNoImplementationCopy(container);
  });

  it("keeps admin drawers free of implementation copy", async () => {
    for (const drawer of ["menuEditor", "floorEditor", "report", "paymentSettings"] as const) {
      cleanup();
      const { container } = await renderApp({ drawer });
      expect(await screen.findByTestId(drawer === "report" ? "report" : drawer === "menuEditor" ? "menu-editor" : drawer === "floorEditor" ? "floor-editor" : "payment-settings-drawer")).toBeInTheDocument();
      expectNoImplementationCopy(container);
    }
  });

  it("keeps maintenance reset copy user-facing", async () => {
    const user = userEvent.setup();
    const { container } = await renderApp({ drawer: "settings" });

    expect(await screen.findByTestId("settings-drawer")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Bảo trì dữ liệu" }));
    await user.click(screen.getByTestId("open-clear-demo"));
    expect(await screen.findByTestId("clear-demo-dialog")).toBeInTheDocument();

    expectNoImplementationCopy(container);
  });
});

describe("drawer overlays", () => {
  it("closes the active drawer when the overlay is clicked", async () => {
    await renderApp({ drawer: "paymentSettings" });

    const drawer = await screen.findByTestId("payment-settings-drawer");
    const overlay = drawer.parentElement;
    expect(overlay).not.toBeNull();

    fireEvent.click(overlay!);

    await waitFor(() => {
      expect(screen.queryByTestId("payment-settings-drawer")).not.toBeInTheDocument();
    });
    expect(useAppStore.getState().drawer).toBeNull();
  });
});
