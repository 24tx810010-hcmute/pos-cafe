import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { useAppStore } from "../useAppStore";
import { FloorWorkspace } from "./FloorWorkspace";

const admin: Employee = { id: "6b7bd350-7db2-4160-8471-cca2668c070d", name: "Quản lý", role: "admin", isActive: true };

const renderWorkspace = (configureState?: (state: ReturnType<typeof createSeededMockState>) => void) => {
  const state = createSeededMockState();
  configureState?.(state);
  const ports = createMockPorts(state);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  useAppStore.setState({
    screen: "passcode",
    currentEmployee: admin,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: null,
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
  });

  return render(
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={queryClient}>
        <FloorWorkspace />
      </QueryClientProvider>
    </PortsContext.Provider>,
  );
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

describe("FloorWorkspace", () => {
  it("renders the selected table background while keeping the status border", async () => {
    renderWorkspace((state) => {
      state.floorPlan.tables[0].backgroundAssetKey = "/floor-assets/tables/table-bg-11.png";
    });

    const table = await screen.findByTestId("table-7b035353-73d6-44bc-8ec4-1ab9951f7a58");
    expect(table.getAttribute("style")).toContain('/floor-assets/tables/table-bg-11.png');
    expect(table).toHaveClass("border-[#86efac]");
  });

  it("renders catalog decoration images on the POS floor", async () => {
    renderWorkspace((state) => {
      state.floorPlan.decorItems.push({
        id: "decor-seat-image",
        areaId: state.floorPlan.areas[0].id,
        kind: "image",
        label: "Ghế 29",
        assetKey: "/floor-assets/decor/deco-seat-29.png",
        posX: 500,
        posY: 320,
        width: 120,
        height: 120,
        rotation: 0,
        zIndex: 2,
        isLocked: false,
      });
    });

    const decor = await screen.findByTestId("decor-decor-seat-image");
    expect(within(decor).getByRole("img", { name: "Ghế 29" })).toHaveAttribute(
      "src",
      "/floor-assets/decor/deco-seat-29.png",
    );
  });

  it("keeps refresh near the floor controls without rendering the old top chrome", async () => {
    renderWorkspace();

    expect(await screen.findByTestId("floor-view")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sơ đồ bàn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo đơn nhanh" })).not.toBeInTheDocument();
    expect(screen.getByTestId("floor-refresh-button")).toHaveTextContent("Làm mới");
  });
});
