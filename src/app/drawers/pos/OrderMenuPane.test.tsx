import { render, screen, within } from "@testing-library/react";
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
});
