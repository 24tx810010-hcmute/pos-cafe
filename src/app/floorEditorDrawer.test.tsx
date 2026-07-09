import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
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
  const state = createSeededMockState();
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

const mockFloorEditorStageRect = async () => {
  const stage = await screen.findByTestId("floor-editor-stage");
  vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
    bottom: 900,
    height: 900,
    left: 0,
    right: 1600,
    top: 0,
    width: 1600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  return stage;
};

const firePointer = (element: Element, type: "pointerdown" | "pointermove" | "pointerup", point = { x: 0, y: 0 }) => {
  fireEvent(element, new MouseEvent(type, { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y }));
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

  it("shows transform handles only for the selected unlocked floor object", async () => {
    const user = userEvent.setup();
    renderFloorEditor();

    expect(screen.queryByTestId("fe-object-rotate-handle-tbl-b01")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fe-object-resize-handle-tbl-b01")).not.toBeInTheDocument();

    await user.click(await screen.findByTestId("fe-table-tbl-b01"));
    expect(screen.getByTestId("fe-object-rotate-handle-tbl-b01")).toBeVisible();
    expect(screen.getByTestId("fe-object-resize-handle-tbl-b01")).toBeVisible();

    await user.click(within(screen.getByTestId("floor-editor-inspector")).getByRole("button", { name: /Xo.*b/ }));
    expect(screen.queryByTestId("fe-object-rotate-handle-tbl-b01")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fe-object-resize-handle-tbl-b01")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("fe-decor-decor-plant"));
    expect(screen.getByTestId("fe-object-rotate-handle-decor-plant")).toBeVisible();
    expect(screen.getByTestId("fe-object-resize-handle-decor-plant")).toBeVisible();
    expect(screen.queryByTestId("fe-object-rotate-handle-tbl-b01")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("fe-decor-decor-counter"));
    expect(screen.queryByTestId("fe-object-rotate-handle-decor-counter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fe-object-resize-handle-decor-counter")).not.toBeInTheDocument();

    firePointer(screen.getByTestId("floor-editor-stage"), "pointerdown");
    expect(screen.queryByTestId("fe-object-rotate-handle-decor-counter")).not.toBeInTheDocument();
  });

  it("saves table resize and rotation from selected object handles", async () => {
    const user = userEvent.setup();
    const { saveSpy } = renderFloorEditor();
    const stage = await mockFloorEditorStageRect();

    await user.click(await screen.findByTestId("fe-table-tbl-b01"));

    const resizeHandle = screen.getByTestId("fe-object-resize-handle-tbl-b01");
    firePointer(resizeHandle, "pointerdown", { x: 320, y: 228 });
    firePointer(resizeHandle, "pointermove", { x: 340, y: 250 });
    firePointer(resizeHandle, "pointerup");

    const rotateHandle = screen.getByTestId("fe-object-rotate-handle-tbl-b01");
    firePointer(rotateHandle, "pointerdown", { x: 200, y: 228 });
    firePointer(rotateHandle, "pointermove", { x: 260, y: 290 });
    firePointer(rotateHandle, "pointerup");

    firePointer(stage, "pointerdown");
    await user.click(screen.getByTestId("save-floor-button"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const changes = saveSpy.mock.calls[0][0];

    expect(changes.tables.updated).toEqual([{ id: "tbl-b01", width: 160, height: 120, rotation: 90 }]);
  });

  it("keeps transform handles horizontally below the unrotated object bounds", async () => {
    const user = userEvent.setup();
    renderFloorEditor();
    await mockFloorEditorStageRect();

    await user.click(await screen.findByTestId("fe-table-tbl-b01"));
    const rotateHandle = screen.getByTestId("fe-object-rotate-handle-tbl-b01");
    firePointer(rotateHandle, "pointerdown", { x: 200, y: 228 });
    firePointer(rotateHandle, "pointermove", { x: 260, y: 290 });
    firePointer(rotateHandle, "pointerup");

    expect(screen.getByTestId("fe-table-tbl-b01").getAttribute("style")).toContain("rotate(90deg)");

    const rotateStyle = screen.getByTestId("fe-object-rotate-handle-tbl-b01").getAttribute("style") ?? "";
    const resizeStyle = screen.getByTestId("fe-object-resize-handle-tbl-b01").getAttribute("style") ?? "";

    expect(rotateStyle).toContain("left: 200px");
    expect(rotateStyle).toContain("top: 240px");
    expect(rotateStyle).not.toContain("rotate(");
    expect(resizeStyle).toContain("left: 320px");
    expect(resizeStyle).toContain("top: 240px");
    expect(resizeStyle).not.toContain("rotate(");
  });

  it("saves decor resize and rotation from selected object handles", async () => {
    const user = userEvent.setup();
    const { saveSpy } = renderFloorEditor();
    await mockFloorEditorStageRect();

    await user.click(await screen.findByTestId("fe-decor-decor-plant"));

    const resizeHandle = screen.getByTestId("fe-object-resize-handle-decor-plant");
    firePointer(resizeHandle, "pointerdown", { x: 360, y: 786 });
    firePointer(resizeHandle, "pointermove", { x: 380, y: 820 });
    firePointer(resizeHandle, "pointerup");

    const rotateHandle = screen.getByTestId("fe-object-rotate-handle-decor-plant");
    firePointer(rotateHandle, "pointerdown", { x: 240, y: 786 });
    firePointer(rotateHandle, "pointermove", { x: 300, y: 860 });
    firePointer(rotateHandle, "pointerup");

    await user.click(screen.getByTestId("save-floor-button"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const changes = saveSpy.mock.calls[0][0];

    expect(changes.decorItems.updated).toEqual([{ id: "decor-plant", width: 160, height: 120, rotation: 90 }]);
  });

  it("renders table geometry as logical pixels inside the scaled stage", async () => {
    renderFloorEditor();

    const table = await screen.findByTestId("fe-table-tbl-b01");
    const style = table.getAttribute("style") ?? "";

    expect(style).toContain("left: 260px");
    expect(style).toContain("top: 190px");
    expect(style).toContain("width: 120px");
    expect(style).toContain("height: 76px");
  });

  it("omits manual zoom controls because the stage auto-fits its container", async () => {
    renderFloorEditor();

    await screen.findByTestId("floor-editor-stage");

    expect(screen.queryByTitle("Phóng to")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Thu nhỏ")).not.toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });
});
