import type {
  DecorKind,
  TableShape,
} from "./models";

export type TombstoneDelete = {
  id: string;
  deletedByEmployeeId?: string | null;
};

export type Changeset<TCreate, TUpdate, TDelete> = {
  created: TCreate[];
  updated: TUpdate[];
  deleted: TDelete[];
};

export type CategoryCreate = { id: string; name: string; sortOrder: number };
export type CategoryUpdate = Partial<CategoryCreate> & { id: string };

export type MenuItemCreate = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  imageAssetKey?: string | null;
  sortOrder: number;
  isAvailable: boolean;
};
export type MenuItemUpdate = Partial<MenuItemCreate> & { id: string };

export type OptionGroupCreate = {
  id: string;
  name: string;
  selectType: "single" | "multi";
  isRequired: boolean;
  sortOrder: number;
};
export type OptionGroupUpdate = Partial<OptionGroupCreate> & { id: string };

export type OptionValueCreate = {
  id: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
};
export type OptionValueUpdate = Partial<OptionValueCreate> & { id: string };

export type MenuItemOptionGroupCreate = {
  id: string;
  menuItemId: string;
  optionGroupId: string;
  sortOrder: number;
};
export type MenuItemOptionGroupUpdate = Partial<MenuItemOptionGroupCreate> & { id: string };

export type MenuChanges = {
  categories: Changeset<CategoryCreate, CategoryUpdate, TombstoneDelete>;
  menuItems: Changeset<MenuItemCreate, MenuItemUpdate, TombstoneDelete>;
  optionGroups: Changeset<OptionGroupCreate, OptionGroupUpdate, TombstoneDelete>;
  optionValues: Changeset<OptionValueCreate, OptionValueUpdate, TombstoneDelete>;
  menuItemOptionGroups: Changeset<
    MenuItemOptionGroupCreate,
    MenuItemOptionGroupUpdate,
    TombstoneDelete
  >;
};

export type FloorAreaCreate = { id: string; name: string; sortOrder: number };
export type FloorAreaUpdate = Partial<FloorAreaCreate> & { id: string };

export type TableCreate = {
  id: string;
  areaId: string;
  name: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  shape: TableShape;
  rotation: number;
  seats: number;
  sortOrder: number;
};

export type TableLayoutUpdate = Partial<Omit<TableCreate, "id">> & { id: string };

export type DecorCreate = {
  id: string;
  areaId: string;
  kind: DecorKind;
  label?: string | null;
  assetKey: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  isLocked: boolean;
};

export type DecorUpdate = Partial<DecorCreate> & { id: string };

export type FloorPlanChanges = {
  areas: Changeset<FloorAreaCreate, FloorAreaUpdate, TombstoneDelete>;
  tables: Changeset<TableCreate, TableLayoutUpdate, TombstoneDelete>;
  decorItems: Changeset<DecorCreate, DecorUpdate, TombstoneDelete>;
};

export const emptyChangeset = <TCreate, TUpdate, TDelete>(): Changeset<TCreate, TUpdate, TDelete> => ({
  created: [],
  updated: [],
  deleted: [],
});
