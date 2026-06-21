import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createMockState } from "@/adapters/mock";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const admin: Employee = { id: "emp-admin", name: "Quản lý", role: "admin", isActive: true };

const resetAppStoreForMenuEditor = () => {
  useAppStore.setState({
    screen: "passcode",
    currentEmployee: admin,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: "menuEditor",
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
  });
};

const renderMenuEditor = () => {
  const state = createMockState();
  state.session = { storeId: "store-demo-001", storeNo: 1 };
  const ports = createMockPorts(state);
  const saveSpy = vi.spyOn(ports.menu, "saveMenuChanges");
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  resetAppStoreForMenuEditor();
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

describe("MenuEditorDrawer", () => {
  it("saves new menu items through menu changesets", async () => {
    const user = userEvent.setup();
    const { saveSpy, state } = renderMenuEditor();

    await user.click(await screen.findByTestId("add-item-button"));
    await user.type(screen.getByTestId("menu-item-name-input"), "Espresso mới");
    await user.click(screen.getByTestId("save-menu-button"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const changes = saveSpy.mock.calls[0][0];

    expect(changes.menuItems.created).toHaveLength(1);
    expect(changes.menuItems.created[0]).toMatchObject({
      categoryId: state.menu.categories[0].id,
      name: "Espresso mới",
      price: 0,
      isAvailable: true,
    });
    expect(changes.menuItems.created[0].id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(state.menu.menuItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Espresso mới" })]),
    );
  });

  it("sends tombstones for deleted existing categories", async () => {
    const user = userEvent.setup();
    const { saveSpy, state } = renderMenuEditor();
    const deletedCategoryId = state.menu.categories[0].id;

    await user.click(await screen.findByRole("button", { name: "Xoá danh mục" }));
    await user.click(screen.getByTestId("save-menu-button"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const changes = saveSpy.mock.calls[0][0];

    expect(changes.categories.deleted).toEqual([
      { id: deletedCategoryId, deletedByEmployeeId: admin.id },
    ]);
  });
});
