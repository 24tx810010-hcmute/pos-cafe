import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderMenuPane } from "./OrderMenuPane";
import type { Category, MenuItem } from "@/domain";

const categories: Category[] = [{ id: "cat-coffee", name: "Cà phê", sortOrder: 1 }];

const items: MenuItem[] = [
  {
    id: "mi-latte",
    categoryId: "cat-coffee",
    name: "Latte",
    price: 45000,
    imageAssetKey: "menu-item-images/store-demo-001/menu-items/mi-latte/photo.webp",
    sortOrder: 1,
    isAvailable: true,
  },
  {
    id: "mi-cold-brew",
    categoryId: "cat-coffee",
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
        categoryId="cat-coffee"
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
      "https://assets.local/menu-item-images/store-demo-001/menu-items/mi-latte/photo.webp",
    );
    expect(image).toHaveClass("object-cover");

    const soldOutCard = screen.getByTestId("menu-item-mi-cold-brew");
    expect(within(soldOutCard).getByText("Đã bán hết")).toBeInTheDocument();
    expect(within(soldOutCard).queryByText("Tạm hết")).not.toBeInTheDocument();
  });
});
