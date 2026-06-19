import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createMockState } from "@/adapters/mock";
import type { Employee } from "@/domain";
import { PortsContext } from "@/ports/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const admin: Employee = { id: "emp-admin", name: "Quản lý", role: "admin", isActive: true };

const resetAppStoreForFloorEditor = () => {
  useAppStore.setState({
    screen: "passcode",
    currentEmployee: admin,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: "floorEditor",
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
  });
};

const renderFloorEditor = () => {
  const state = createMockState();
  state.session = { storeId: "store-demo-001", storeNo: 1 };
  const ports = createMockPorts(state);
  const saveSpy = vi.spyOn(ports.floorPlan, "saveFloorPlan");
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  resetAppStoreForFloorEditor();
  render(
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </PortsContext.Provider>,
  );

  return { saveSpy, state };
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

describe("FloorEditorDrawer", () => {
  it("saves new tables through floor changesets without table status", async () => {
    const user = userEvent.setup();
    const { saveSpy, state } = renderFloorEditor();

    await user.click(await screen.findByTestId("add-table-round"));
    await user.click(screen.getByTestId("save-floor-button"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const changes = saveSpy.mock.calls[0][0];

    expect(changes.tables.created).toHaveLength(1);
    expect(changes.tables.created[0]).toMatchObject({
      areaId: state.floorPlan.areas[0].id,
      name: "B09",
      posX: 800,
      posY: 450,
      shape: "round",
    });
    expect(changes.tables.created[0].id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(changes.tables.created[0]).not.toHaveProperty("status");
  });

  it("saves logical table updates without overwriting status", async () => {
    const user = userEvent.setup();
    const { saveSpy } = renderFloorEditor();

    await user.click(await screen.findByTestId("fe-table-tbl-b01"));
    await user.clear(screen.getByTestId("fe-table-name-input"));
    await user.type(screen.getByTestId("fe-table-name-input"), "B01A");
    await user.click(screen.getByRole("button", { name: /Nâng cao/ }));
    await user.clear(screen.getByLabelText("X"));
    await user.type(screen.getByLabelText("X"), "300");
    await user.click(screen.getByTestId("save-floor-button"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const changes = saveSpy.mock.calls[0][0];

    expect(changes.tables.updated).toEqual([{ id: "tbl-b01", name: "B01A", posX: 300 }]);
    expect(changes.tables.updated[0]).not.toHaveProperty("status");
  });

  it("sends tombstones for deleted tables and decor", async () => {
    const user = userEvent.setup();
    const { saveSpy } = renderFloorEditor();

    await user.click(await screen.findByTestId("fe-table-tbl-b01"));
    await user.click(screen.getByRole("button", { name: "Xoá bàn" }));
    await user.click(screen.getByTestId("fe-decor-decor-counter"));
    await user.click(screen.getByRole("button", { name: "Xoá trang trí" }));
    await user.click(screen.getByTestId("save-floor-button"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const changes = saveSpy.mock.calls[0][0];

    expect(changes.tables.deleted).toEqual([{ id: "tbl-b01", deletedByEmployeeId: admin.id }]);
    expect(changes.decorItems.deleted).toEqual([{ id: "decor-counter", deletedByEmployeeId: admin.id }]);
  });

  it("renders table geometry as percentages of the logical 1600x900 stage", async () => {
    renderFloorEditor();

    const table = await screen.findByTestId("fe-table-tbl-b01");
    const style = table.getAttribute("style") ?? "";

    expect(style).toContain("left: 16.25%");
    expect(style).toContain("top: 21.11111111111111%");
    expect(style).toContain("width: 7.5%");
    expect(style).toContain("height: 8.444444444444445%");
  });
});
