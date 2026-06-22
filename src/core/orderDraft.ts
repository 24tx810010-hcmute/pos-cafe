import type { MenuCatalog, OrderItemSnapshot, SubmitOrderDraftItem } from "@/domain";
import { AppError } from "./appError";

export const calculateSnapshotTotal = (items: OrderItemSnapshot[]): number =>
  items.reduce((sum, item) => {
    const optionsTotal = item.options.reduce((optionSum, option) => optionSum + option.priceDelta, 0);
    return sum + (item.unitPrice + optionsTotal) * item.quantity;
  }, 0);

export const snapshotDraftItems = (
  catalog: MenuCatalog,
  draftItems: SubmitOrderDraftItem[],
): OrderItemSnapshot[] =>
  draftItems
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const menuItem = catalog.menuItems.find((candidate) => candidate.id === item.menuItemId);

      if (!menuItem || !menuItem.isAvailable) {
        throw new AppError("MENU_ITEM_UNAVAILABLE", "Món đã bị xoá hoặc tạm hết.");
      }

      const optionSnapshots = item.options.map((option) => {
        const optionValue = catalog.optionValues.find((candidate) => candidate.id === option.optionValueId);
        const optionGroup = optionValue
          ? catalog.optionGroups.find((candidate) => candidate.id === optionValue.optionGroupId)
          : null;

        if (!optionValue || !optionGroup || optionGroup.menuItemId !== menuItem.id) {
          throw new AppError("OPTION_VALUE_UNAVAILABLE", "Tuỳ chọn món không còn hợp lệ.");
        }

        return {
          id: option.id,
          optionValueId: optionValue.id,
          optionName: optionValue.name,
          priceDelta: optionValue.priceDelta,
        };
      });

      return {
        id: item.id,
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        quantity: item.quantity,
        unitPrice: menuItem.price,
        note: item.note ?? null,
        options: optionSnapshots,
      };
    });
