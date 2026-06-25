import { useState } from "react";
import type { MenuCatalog } from "@/domain";
import { nextDraftId, nextSort } from "./draftUtils";
import type { DraftGroup, DraftLink, DraftValue } from "./menuDraft";

// Quản lý draft cho modifier dùng chung: nhóm tuỳ chọn, giá trị, và liên kết món<->nhóm.
// Tách khỏi MenuEditorDrawer để giữ component gọn (xem tailwindMigration guard).
export function useMenuModifierDrafts(touch: () => void) {
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [values, setValues] = useState<DraftValue[]>([]);
  const [links, setLinks] = useState<DraftLink[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const reset = (catalog: MenuCatalog) => {
    setGroups(
      catalog.optionGroups.map((g) => ({
        id: g.id,
        name: g.name,
        selectType: g.selectType,
        isRequired: g.isRequired,
        sortOrder: g.sortOrder,
      })),
    );
    setValues(
      catalog.optionValues.map((v) => ({
        id: v.id,
        optionGroupId: v.optionGroupId,
        name: v.name,
        priceDelta: v.priceDelta,
        sortOrder: v.sortOrder,
      })),
    );
    setLinks(
      catalog.menuItemOptionGroups.map((l) => ({
        id: l.id,
        menuItemId: l.menuItemId,
        optionGroupId: l.optionGroupId,
        sortOrder: l.sortOrder,
      })),
    );
    setEditingGroupId(null);
  };

  // Tạo nhóm mới + mở popup; kèm itemId thì tự gắn nhóm vào món đó.
  const addGroup = (itemId?: string) => {
    const id = nextDraftId("og");
    setGroups((list) => [
      ...list,
      { id, name: "Nhóm tuỳ chọn mới", selectType: "single", isRequired: false, sortOrder: nextSort(list.map((g) => g.sortOrder)), isNew: true },
    ]);
    if (itemId) {
      const linkId = nextDraftId("miog");
      setLinks((list) => [...list, { id: linkId, menuItemId: itemId, optionGroupId: id, sortOrder: nextSort(list.filter((l) => l.menuItemId === itemId).map((l) => l.sortOrder)), isNew: true }]);
    }
    setEditingGroupId(id);
    touch();
  };

  const patchGroup = (id: string, patch: Partial<DraftGroup>) => {
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    touch();
  };

  // Xoá hẳn nhóm khỏi thư viện + bỏ mọi liên kết tới nhóm.
  const deleteGroup = (id: string) => {
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, deleted: true } : g)));
    setLinks((list) =>
      list
        .filter((l) => !(l.optionGroupId === id && l.isNew))
        .map((l) => (l.optionGroupId === id ? { ...l, deleted: true } : l)),
    );
    setEditingGroupId(null);
    touch();
  };

  // Tick/bỏ tick liên kết món<->nhóm.
  const toggleLink = (itemId: string, groupId: string) => {
    const existing = links.find((l) => l.menuItemId === itemId && l.optionGroupId === groupId);
    if (existing && !existing.deleted) {
      setLinks((list) =>
        existing.isNew
          ? list.filter((l) => l.id !== existing.id)
          : list.map((l) => (l.id === existing.id ? { ...l, deleted: true } : l)),
      );
    } else if (existing && existing.deleted) {
      setLinks((list) => list.map((l) => (l.id === existing.id ? { ...l, deleted: false } : l)));
    } else {
      const id = nextDraftId("miog");
      setLinks((list) => [...list, { id, menuItemId: itemId, optionGroupId: groupId, sortOrder: nextSort(list.filter((l) => l.menuItemId === itemId).map((l) => l.sortOrder)), isNew: true }]);
    }
    touch();
  };

  const addValue = (groupId: string) => {
    const id = nextDraftId("ov");
    setValues((list) => [
      ...list,
      { id, optionGroupId: groupId, name: "Giá trị mới", priceDelta: 0, sortOrder: nextSort(list.filter((v) => v.optionGroupId === groupId).map((v) => v.sortOrder)), isNew: true },
    ]);
    touch();
  };

  const patchValue = (id: string, patch: Partial<DraftValue>) => {
    setValues((list) => list.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    touch();
  };

  const toggleDeleteValue = (id: string) => {
    setValues((list) =>
      list
        .filter((v) => !(v.id === id && v.isNew))
        .map((v) => (v.id === id ? { ...v, deleted: !v.deleted } : v)),
    );
    touch();
  };

  const groupValues = (groupId: string): DraftValue[] =>
    values.filter((v) => v.optionGroupId === groupId && !v.deleted).sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    groups,
    values,
    links,
    editingGroupId,
    setEditingGroupId,
    reset,
    addGroup,
    patchGroup,
    deleteGroup,
    toggleLink,
    addValue,
    patchValue,
    toggleDeleteValue,
    groupValues,
  };
}
