import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MenuItem } from "@/domain";
import type { ItemModifierGroup } from "@/features/pos";
import { ModifierPickerPopup } from "./ModifierPickerPopup";

const menuItem: MenuItem = {
  id: "mi-latte",
  categoryId: "cat-coffee",
  name: "Latte",
  price: 45000,
  imageAssetKey: null,
  sortOrder: 1,
  isAvailable: true,
};

const groups: ItemModifierGroup[] = [
  {
    group: { id: "og-size", name: "Size", selectType: "single", isRequired: true, sortOrder: 1 },
    values: [
      { id: "ov-m", optionGroupId: "og-size", name: "M", priceDelta: 0, sortOrder: 1 },
      { id: "ov-l", optionGroupId: "og-size", name: "L", priceDelta: 7000, sortOrder: 2 },
    ],
  },
  {
    group: { id: "og-topping", name: "Topping", selectType: "multi", isRequired: false, sortOrder: 2 },
    values: [{ id: "ov-tran-chau", optionGroupId: "og-topping", name: "Trân châu", priceDelta: 7000, sortOrder: 1 }],
  },
];

describe("ModifierPickerPopup", () => {
  it("keeps confirm disabled until a required group is satisfied", () => {
    render(<ModifierPickerPopup menuItem={menuItem} groups={groups} onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByTestId("modifier-confirm")).toBeDisabled();
    fireEvent.click(screen.getByTestId("modifier-value-ov-l"));
    expect(screen.getByTestId("modifier-confirm")).toBeEnabled();
  });

  it("confirms selected options with per-option quantity for multi groups", () => {
    const onConfirm = vi.fn();
    render(<ModifierPickerPopup menuItem={menuItem} groups={groups} onConfirm={onConfirm} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId("modifier-value-ov-m"));
    fireEvent.click(screen.getByTestId("modifier-value-ov-tran-chau"));
    // Mặc định số lượng 1, tăng lên 2.
    expect(screen.getByTestId("modifier-qty-ov-tran-chau")).toHaveTextContent("1");
    fireEvent.click(screen.getByTestId("modifier-qty-inc-ov-tran-chau"));
    expect(screen.getByTestId("modifier-qty-ov-tran-chau")).toHaveTextContent("2");

    fireEvent.click(screen.getByTestId("modifier-confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const options = onConfirm.mock.calls[0][0] as Array<{ optionValueId: string; quantity: number }>;
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ optionValueId: "ov-m", quantity: 1 }),
        expect.objectContaining({ optionValueId: "ov-tran-chau", quantity: 2 }),
      ]),
    );
    expect(options).toHaveLength(2);
  });

  it("replaces the pick within a single-select group", () => {
    const onConfirm = vi.fn();
    render(<ModifierPickerPopup menuItem={menuItem} groups={groups} onConfirm={onConfirm} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId("modifier-value-ov-m"));
    fireEvent.click(screen.getByTestId("modifier-value-ov-l"));
    fireEvent.click(screen.getByTestId("modifier-confirm"));

    const options = onConfirm.mock.calls[0][0] as Array<{ optionValueId: string }>;
    expect(options).toEqual([expect.objectContaining({ optionValueId: "ov-l" })]);
  });
});
