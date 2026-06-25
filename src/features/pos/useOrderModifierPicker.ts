import { useState } from "react";
import type { MenuCatalog, MenuItem, SubmitOrderDraftItem, SubmitOrderDraftOption } from "@/domain";
import { addDraftMenuItem, getItemModifierGroups } from "./orderFlow";

// Điều phối việc thêm món vào giỏ: món có nhóm tuỳ chọn thì mở popup chọn modifier,
// món không có thì thêm thẳng. Tách khỏi OrderDrawer để giữ component gọn.
export function useOrderModifierPicker(
  menu: MenuCatalog | undefined,
  draftItems: SubmitOrderDraftItem[],
  setDraftItems: (items: SubmitOrderDraftItem[]) => void,
) {
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);

  const requestAdd = (menuItem: MenuItem) => {
    if (!menuItem.isAvailable) return;
    if (menu && getItemModifierGroups(menu, menuItem.id).length > 0) {
      setModifierItem(menuItem);
      return;
    }
    setDraftItems(addDraftMenuItem(draftItems, menuItem));
  };

  const confirm = (options: SubmitOrderDraftOption[]) => {
    if (modifierItem) {
      setDraftItems(addDraftMenuItem(draftItems, modifierItem, options));
    }
    setModifierItem(null);
  };

  const cancel = () => setModifierItem(null);

  return { modifierItem, requestAdd, confirm, cancel };
}
