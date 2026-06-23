import type { DraftItem } from "./menuDraft";

const canSwapItem = (item: DraftItem | undefined, categoryId: string) =>
  Boolean(item && item.categoryId === categoryId && !item.deleted && (!item.isNew || item.name.trim()));

export function swapMenuItemSortOrderInCategory(
  items: DraftItem[],
  categoryId: string,
  sourceItemId: string,
  targetItemId: string,
): DraftItem[] {
  if (sourceItemId === targetItemId) return items;
  const sourceItem = items.find((item) => item.id === sourceItemId);
  const targetItem = items.find((item) => item.id === targetItemId);
  if (!canSwapItem(sourceItem, categoryId) || !canSwapItem(targetItem, categoryId)) return items;

  return items.map((item) => {
    if (item.id === sourceItemId) return { ...item, sortOrder: targetItem!.sortOrder };
    if (item.id === targetItemId) return { ...item, sortOrder: sourceItem!.sortOrder };
    return item;
  });
}
