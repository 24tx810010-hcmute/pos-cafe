import type { DecorKind } from "@/domain";

export type FloorDecorAssetGroup = "tree" | "seat" | "fixtures" | "other";
export type FloorDecorAssetPickerMode = "wall" | "decor";

export interface FloorDecorAsset {
  id: string;
  assetKey: string;
  label: string;
  kind: DecorKind;
  width: number;
  height: number;
  group?: FloorDecorAssetGroup;
}

export const FLOOR_DECOR_GROUPS: Array<{
  id: FloorDecorAssetGroup;
  label: string;
  count: number;
}> = [
  { id: "tree", label: "Cây", count: 57 },
  { id: "seat", label: "Ghế", count: 29 },
  { id: "fixtures", label: "Thiết bị", count: 30 },
  { id: "other", label: "Khác", count: 15 },
];

const wallFiles = [
  "img-color-cell.png",
  ...Array.from({ length: 8 }, (_, index) => `img-color-cell${index + 1}.webp`),
];

export const FLOOR_WALL_ASSETS: FloorDecorAsset[] = wallFiles.map((file, index) => ({
  id: `wall-${String(index + 1).padStart(2, "0")}`,
  assetKey: `/floor-assets/walls/${file}`,
  label: `Tường ${String(index + 1).padStart(2, "0")}`,
  kind: "wall",
  width: 300,
  height: 36,
}));

const decorKindForGroup = (group: FloorDecorAssetGroup): DecorKind =>
  group === "tree" ? "plant" : "image";

const decorLabelForGroup = (group: FloorDecorAssetGroup) =>
  FLOOR_DECOR_GROUPS.find((item) => item.id === group)?.label ?? "Trang trí";

export const FLOOR_DECOR_ASSETS: FloorDecorAsset[] = FLOOR_DECOR_GROUPS.flatMap((group) =>
  Array.from({ length: group.count }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      id: `${group.id}-${number}`,
      assetKey: `/floor-assets/decor/deco-${group.id}-${number}.png`,
      label: `${decorLabelForGroup(group.id)} ${number}`,
      kind: decorKindForGroup(group.id),
      width: 120,
      height: 120,
      group: group.id,
    };
  }),
);

export const FLOOR_DECOR_ASSETS_BY_GROUP: Record<FloorDecorAssetGroup, FloorDecorAsset[]> = {
  tree: FLOOR_DECOR_ASSETS.filter((asset) => asset.group === "tree"),
  seat: FLOOR_DECOR_ASSETS.filter((asset) => asset.group === "seat"),
  fixtures: FLOOR_DECOR_ASSETS.filter((asset) => asset.group === "fixtures"),
  other: FLOOR_DECOR_ASSETS.filter((asset) => asset.group === "other"),
};

const floorDecorAssetMap = new Map(
  [...FLOOR_WALL_ASSETS, ...FLOOR_DECOR_ASSETS].map((asset) => [asset.assetKey, asset]),
);

export const getFloorDecorAsset = (assetKey: string | null | undefined) =>
  assetKey ? floorDecorAssetMap.get(assetKey) ?? null : null;
