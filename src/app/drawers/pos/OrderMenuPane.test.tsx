import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderMenuPane } from "./OrderMenuPane";
import type { Category, MenuItem } from "@/domain";

const categories: Category[] = [{ id: "c68d7fbd-c06a-42a4-8140-476da8ebbf74", name: "Cà phê", sortOrder: 1 }];

const items: MenuItem[] = [
  {
    id: "d50ff72b-d0bc-4832-8888-183c19f5a158",
    categoryId: "c68d7fbd-c06a-42a4-8140-476da8ebbf74",
    name: "Latte",
    price: 45000,
    imageAssetKey: "menu-item-images/e572ea5f-9adf-493c-8d84-dca3cd86e1eb/menu-items/d50ff72b-d0bc-4832-8888-183c19f5a158/photo.webp",
    sortOrder: 1,
    isAvailable: true,
  },
  {
    id: "9491e262-856d-4408-82b7-c9d7f7ac3f27",
    categoryId: "c68d7fbd-c06a-42a4-8140-476da8ebbf74",
    name: "Cold brew",
    price: 49000,
    imageAssetKey: null,
    sortOrder: 2,
    isAvailable: false,
  },
];

describe("OrderMenuPane", () => {
  it("fills menu item card images and marks sold out items without status pills", () => {
    const Component = OrderMenuPane as any;

    render(
      <Component
        categories={categories}
        items={items}
        categoryId="c68d7fbd-c06a-42a4-8140-476da8ebbf74"
        search=""
        isLoading={false}
        isError={false}
        error={null}
        onSelectCategory={vi.fn()}
        onSearchChange={vi.fn()}
        onRetry={vi.fn()}
        onAddItem={vi.fn()}
        getMenuImageUrl={(assetKey: string) => `https://assets.local/${assetKey}`}
      />,
    );

    const image = screen.getByAltText("Ảnh Latte");
    expect(image).toHaveAttribute(
      "src",
      "https://assets.local/menu-item-images/e572ea5f-9adf-493c-8d84-dca3cd86e1eb/menu-items/d50ff72b-d0bc-4832-8888-183c19f5a158/photo.webp",
    );
    expect(image).toHaveClass("object-cover");

    const soldOutCard = screen.getByTestId("menu-item-9491e262-856d-4408-82b7-c9d7f7ac3f27");
    expect(within(soldOutCard).getByText("Đã bán hết")).toBeInTheDocument();
    expect(within(soldOutCard).queryByText("Tạm hết")).not.toBeInTheDocument();
  });

  it("TC-PERM-47 keeps the item actionable when its published image fails", () => {
    const onAddItem = vi.fn();
    render(<OrderMenuPane categories={categories} items={[items[0]]} categoryId={categories[0].id} search=""
      isLoading={false} isError={false} error={null} onSelectCategory={vi.fn()} onSearchChange={vi.fn()}
      onRetry={vi.fn()} onAddItem={onAddItem} getMenuImageUrl={() => "https://assets.local/unavailable.webp"} />);
    const card = screen.getByTestId(`menu-item-${items[0].id}`);
    fireEvent.error(screen.getByAltText("Ảnh Latte"));
    expect(within(card).getByText("Latte")).toBeVisible();
    expect(within(card).getByText(/45\.000/)).toBeVisible();
    expect(within(card).getByTestId("menu-image-placeholder")).toBeVisible();
    fireEvent.click(card);
    expect(onAddItem).toHaveBeenCalledExactlyOnceWith(items[0]);
  });

  it("TC-PERM-47 resets an image failure when publication returns a new asset URL", () => {
    let url = "https://assets.local/old.webp";
    const props = { categories, items: [items[0]], categoryId: categories[0].id, search: "", isLoading: false,
      isError: false, error: null, onSelectCategory: vi.fn(), onSearchChange: vi.fn(), onRetry: vi.fn(), onAddItem: vi.fn() };
    const view = render(<OrderMenuPane {...props} getMenuImageUrl={() => url} />);
    fireEvent.error(screen.getByAltText("Ảnh Latte"));
    expect(screen.getByTestId("menu-image-placeholder")).toBeVisible();
    url = "https://assets.local/new.webp";
    view.rerender(<OrderMenuPane {...props} getMenuImageUrl={() => url} />);
    expect(screen.getByAltText("Ảnh Latte")).toHaveAttribute("src", url);
    expect(screen.queryByTestId("menu-image-placeholder")).not.toBeInTheDocument();
  });
});
