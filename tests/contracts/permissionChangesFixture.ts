export const emptyMenuChanges = {
  categories: { created: [], updated: [], deleted: [] },
  menuItems: { created: [], updated: [], deleted: [] },
  optionGroups: { created: [], updated: [], deleted: [] },
  optionValues: { created: [], updated: [], deleted: [] },
  menuItemOptionGroups: { created: [], updated: [], deleted: [] },
};

export const emptyFloorChanges = {
  areas: { created: [], updated: [], deleted: [] },
  tables: { created: [], updated: [], deleted: [] },
  decorItems: { created: [], updated: [], deleted: [] },
};

export const rpcContracts = {
  applyMenu: { name: "apply_menu_changes", args: { p_changes: emptyMenuChanges } },
  applyFloor: { name: "apply_floor_changes", args: { p_changes: emptyFloorChanges } },
  updateSettings: { name: "update_store_settings", args: { p_input: { displayName: "Quán thử" } } },
  clearDemo: { name: "clear_demo_data", args: { p_request_id: "00000000-0000-4000-8000-000000000012", p_confirmation: true } },
} as const;
