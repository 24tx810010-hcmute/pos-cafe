import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import type { MockState } from "@/adapters/mock";
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

const renderMenuEditor = (configureState?: (state: MockState) => void) => {
  const state = createSeededMockState();
  state.session = { storeId: "store-demo-001", storeNo: 1 };
  configureState?.(state);
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

  return { ports, saveSpy, state };
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

    const addItemButton = await screen.findByTestId("add-item-button");
    expect(addItemButton.closest("aside")).toHaveTextContent("Chi tiết danh mục");
    await user.click(addItemButton);
    expect(screen.getByTestId("menu-item-name-input")).toHaveValue("Món mới 1");
    expect(screen.getByDisplayValue("0")).toBeInTheDocument();
    expect(screen.getByText("Món mới 1")).toBeInTheDocument();
    await user.clear(screen.getByTestId("menu-item-name-input"));
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

  it("uploads a selected item image before saving menu changes", async () => {
    const user = userEvent.setup();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:latte-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const { ports, saveSpy } = renderMenuEditor();
    const uploadSpy = vi
      .spyOn(ports.menuImages, "uploadMenuItemImage")
      .mockResolvedValue({
        assetKey: "menu-item-images/store-demo-001/menu-items/mi-latte/new.webp",
        publicUrl: "https://assets.local/mi-latte/new.webp",
      });

    await user.click(await screen.findByTestId("menu-edit-card-mi-latte"));
    const imageInput = await screen.findByLabelText("Chọn ảnh món");
    const file = new File(["image"], "latte.webp", { type: "image/webp" });
    await user.upload(imageInput, file);

    const previews = await screen.findAllByAltText("Ảnh Latte");
    expect(previews.length).toBeGreaterThan(0);
    expect(previews.every((previewImage) => previewImage.getAttribute("src") === "blob:latte-preview")).toBe(true);
    const cardImage = within(screen.getByTestId("menu-edit-card-mi-latte")).getByAltText("Ảnh Latte");
    expect(cardImage).toHaveClass("object-cover");

    await user.click(screen.getByTestId("save-menu-button"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(uploadSpy).toHaveBeenCalledWith(expect.objectContaining({ itemId: "mi-latte", file }));
    expect(saveSpy.mock.calls[0][0].menuItems.updated).toEqual([
      {
        id: "mi-latte",
        imageAssetKey: "menu-item-images/store-demo-001/menu-items/mi-latte/new.webp",
      },
    ]);
  });

  it("warns about the menu image size limit and blocks oversized files", async () => {
    const user = userEvent.setup();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:oversized-preview"),
    });
    const { ports } = renderMenuEditor();
    const uploadSpy = vi.spyOn(ports.menuImages, "uploadMenuItemImage");

    await user.click(await screen.findByTestId("menu-edit-card-mi-latte"));
    expect(screen.getByText("JPG, PNG hoặc WebP. Tối đa 5MB.")).toBeInTheDocument();

    const oversizedFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "latte.webp", {
      type: "image/webp",
    });
    await user.upload(screen.getByLabelText("Chọn ảnh món"), oversizedFile);

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByAltText("Ảnh Latte")).not.toBeInTheDocument();
    expect(screen.queryByTestId("menu-dirty-badge")).not.toBeInTheDocument();
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("shows sold out treatment on unavailable edit menu cards without status pills", async () => {
    renderMenuEditor((state) => {
      const latte = state.menu.menuItems.find((item) => item.id === "mi-latte");
      if (latte) latte.isAvailable = false;
    });

    const card = await screen.findByTestId("menu-edit-card-mi-latte");

    expect(within(card).getByText("Đã bán hết")).toBeInTheDocument();
    expect(within(card).queryByText("Đang bán")).not.toBeInTheDocument();
    expect(within(card).queryByText("Tạm hết")).not.toBeInTheDocument();
  });

  it("moves a menu item to the selected category from the detail select", async () => {
    const user = userEvent.setup();
    const { saveSpy } = renderMenuEditor();

    await user.click(await screen.findByTestId("menu-edit-card-mi-latte"));
    await user.click(screen.getByRole("combobox", { name: "Danh mục" }));
    await user.click(await screen.findByRole("option", { name: "Trà & trà sữa" }));

    expect(screen.getByTestId("menu-dirty-badge")).toBeInTheDocument();
    expect(screen.getByTestId("menu-edit-card-mi-latte")).toBeInTheDocument();

    await user.click(screen.getByTestId("save-menu-button"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][0].menuItems.updated).toEqual([
      {
        id: "mi-latte",
        categoryId: "cat-tea",
        sortOrder: 13,
      },
    ]);
  });

  it("swaps menu item positions from switch mode", async () => {
    const user = userEvent.setup();
    const { saveSpy } = renderMenuEditor();

    await user.click(await screen.findByTestId("menu-edit-card-mi-ca-phe-sua"));
    const detailPane = screen.getByTestId("menu-editor-detail-pane");
    const swapSwitch = within(detailPane).getByRole("checkbox", { name: "Đổi vị trí" });
    await user.click(swapSwitch);

    expect(swapSwitch).toBeChecked();
    expect(screen.getByTestId("menu-item-name-input")).toBeDisabled();
    expect(screen.getByTestId("add-item-button")).toBeDisabled();
    expect(screen.getByLabelText("Chọn ảnh món")).toBeDisabled();
    expect(within(detailPane).getByRole("combobox", { name: "Danh mục" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /Trà & trà sữa/ })).toBeDisabled();
    expect(within(detailPane).getByRole("button", { name: "Tạm hết" })).toBeDisabled();
    await user.click(screen.getByTestId("menu-edit-card-mi-latte"));

    const cardOrder = screen.getAllByTestId(/menu-edit-card-/).map((card) => card.getAttribute("data-testid"));
    expect(cardOrder[0]).toBe("menu-edit-card-mi-latte");
    expect(cardOrder[3]).toBe("menu-edit-card-mi-ca-phe-sua");
    expect(screen.getByTestId("menu-item-name-input")).toHaveValue("Cà phê sữa");
    expect(swapSwitch).not.toBeChecked();
    expect(screen.getByTestId("menu-item-name-input")).toBeEnabled();
    expect(screen.getByTestId("add-item-button")).toBeEnabled();
    expect(screen.getByTestId("menu-dirty-badge")).toBeInTheDocument();

    await user.click(screen.getByTestId("save-menu-button"));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][0].menuItems.updated).toEqual([
      { id: "mi-ca-phe-sua", sortOrder: 4 },
      { id: "mi-latte", sortOrder: 1 },
    ]);
  });
});
