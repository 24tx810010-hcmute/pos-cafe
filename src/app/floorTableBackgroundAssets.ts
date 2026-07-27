export interface FloorTableBackgroundAsset {
  id: string;
  assetKey: string | null;
  label: string;
}

export const DEFAULT_TABLE_BACKGROUND_ASSET: FloorTableBackgroundAsset = {
  id: "default",
  assetKey: null,
  label: "Trắng mặc định",
};

export const FLOOR_TABLE_BACKGROUND_ASSETS: FloorTableBackgroundAsset[] = Array.from(
  { length: 11 },
  (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      id: `table-bg-${number}`,
      assetKey: `/floor-assets/tables/table-bg-${number}.png`,
      label: `Nền bàn ${number}`,
    };
  },
);

export const FLOOR_TABLE_BACKGROUND_OPTIONS = [
  DEFAULT_TABLE_BACKGROUND_ASSET,
  ...FLOOR_TABLE_BACKGROUND_ASSETS,
];

const tableBackgroundAssetMap = new Map(
  FLOOR_TABLE_BACKGROUND_ASSETS.map((asset) => [asset.assetKey, asset]),
);

export const getFloorTableBackgroundAsset = (assetKey: string | null | undefined) =>
  assetKey ? tableBackgroundAssetMap.get(assetKey) ?? null : null;
