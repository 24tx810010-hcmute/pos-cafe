import { demoCashier, demoCashierPin, demoFloorPlan, demoMenuCatalog, demoSeedIds } from "@/seed/demoSeedData";
import { clone, type MockState } from "./mockState";

type WithId = { id: string };

// Upsert theo id: thêm các bản ghi mẫu còn thiếu, không đụng tới data người dùng tự tạo.
const upsertById = <T extends WithId>(existing: T[], incoming: T[]): T[] => {
  const incomingIds = new Set(incoming.map((row) => row.id));
  const kept = existing.filter((row) => !incomingIds.has(row.id));
  return [...kept, ...clone(incoming)];
};

const removeByIds = <T extends WithId>(rows: T[], ids: string[]): T[] => {
  const drop = new Set(ids);
  return rows.filter((row) => !drop.has(row.id));
};

// Ghi bộ dữ liệu mẫu (gọn) vào mock state — tương đương seed demo của Supabase.
export const applyDemoSeed = (state: MockState): void => {
  state.menu = {
    categories: upsertById(state.menu.categories, demoMenuCatalog.categories),
    menuItems: upsertById(state.menu.menuItems, demoMenuCatalog.menuItems),
    optionGroups: upsertById(state.menu.optionGroups, demoMenuCatalog.optionGroups),
    optionValues: upsertById(state.menu.optionValues, demoMenuCatalog.optionValues),
    menuItemOptionGroups: upsertById(state.menu.menuItemOptionGroups, demoMenuCatalog.menuItemOptionGroups),
  };
  state.floorPlan = {
    areas: upsertById(state.floorPlan.areas, demoFloorPlan.areas),
    tables: upsertById(state.floorPlan.tables, demoFloorPlan.tables),
    decorItems: upsertById(state.floorPlan.decorItems, demoFloorPlan.decorItems),
  };
  if (!state.employees.some((emp) => emp.id === demoCashier.id)) {
    state.employees = [...state.employees, { ...demoCashier }];
  }
  state.pins[demoCashier.id] = demoCashierPin;
};

// Xoá đúng phần dữ liệu mẫu, giữ lại data người dùng tự tạo và tài khoản quản lý.
export const removeDemoSeed = (state: MockState): void => {
  state.menu = {
    categories: removeByIds(state.menu.categories, demoSeedIds.categories),
    menuItems: removeByIds(state.menu.menuItems, demoSeedIds.menuItems),
    optionGroups: removeByIds(state.menu.optionGroups, demoSeedIds.optionGroups),
    optionValues: removeByIds(state.menu.optionValues, demoSeedIds.optionValues),
    menuItemOptionGroups: removeByIds(state.menu.menuItemOptionGroups, demoSeedIds.menuItemOptionGroups),
  };
  state.floorPlan = {
    areas: removeByIds(state.floorPlan.areas, demoSeedIds.areas),
    tables: removeByIds(state.floorPlan.tables, demoSeedIds.tables),
    decorItems: removeByIds(state.floorPlan.decorItems, demoSeedIds.decorItems),
  };
  state.employees = removeByIds(state.employees, demoSeedIds.employees);
  for (const id of demoSeedIds.employees) {
    delete state.pins[id];
  }
};
