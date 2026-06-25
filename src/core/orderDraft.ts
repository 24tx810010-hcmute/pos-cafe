import type { MenuCatalog, OptionGroup, OrderItemSnapshot, SubmitOrderDraftItem } from "@/domain";
import { AppError } from "./appError";

export const calculateSnapshotTotal = (items: OrderItemSnapshot[]): number =>
  items.reduce((sum, item) => {
    const optionsTotal = item.options.reduce(
      (optionSum, option) => optionSum + option.priceDelta * option.quantity,
      0,
    );
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
        // Nhóm tuỳ chọn dùng chung: hợp lệ khi nhóm có liên kết với đúng món này.
        const isLinkedToItem =
          !!optionGroup &&
          catalog.menuItemOptionGroups.some(
            (link) => link.menuItemId === menuItem.id && link.optionGroupId === optionGroup.id,
          );

        if (!optionValue || !optionGroup || !isLinkedToItem) {
          throw new AppError("OPTION_VALUE_UNAVAILABLE", "Tuỳ chọn món không còn hợp lệ.");
        }

        return {
          id: option.id,
          optionValueId: optionValue.id,
          optionName: optionValue.name,
          priceDelta: optionValue.priceDelta,
          quantity: option.quantity,
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

// ----- Validate lựa chọn modifier (dùng chung cho popup chọn ở màn order) -----

export type ModifierSelection = {
  optionGroupId: string;
  optionValueId: string;
  quantity: number;
};

type GroupRule = Pick<OptionGroup, "id" | "selectType" | "isRequired">;

/**
 * Một nhóm hợp lệ khi: nhóm chọn-1 không chọn quá 1 giá trị; nhóm bắt buộc phải
 * chọn ít nhất 1. Mỗi giá trị đã chọn phải có số lượng >= 1.
 */
export const isGroupSelectionValid = (group: GroupRule, selections: ModifierSelection[]): boolean => {
  const picked = selections.filter((selection) => selection.optionGroupId === group.id);
  if (picked.some((selection) => selection.quantity < 1)) return false;
  if (group.selectType === "single" && picked.length > 1) return false;
  if (group.isRequired && picked.length < 1) return false;
  return true;
};

export const validateModifierSelection = (
  groups: GroupRule[],
  selections: ModifierSelection[],
): boolean => groups.every((group) => isGroupSelectionValid(group, selections));
