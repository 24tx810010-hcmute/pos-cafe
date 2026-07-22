import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FLOOR_DECOR_ASSETS,
  FLOOR_DECOR_ASSETS_BY_GROUP,
  FLOOR_WALL_ASSETS,
  getFloorDecorAsset,
} from "./floorDecorAssets";

describe("floor decor asset catalog", () => {
  it("indexes every imported wall and decoration asset", () => {
    expect(FLOOR_WALL_ASSETS).toHaveLength(9);
    expect(FLOOR_DECOR_ASSETS).toHaveLength(131);
    expect(FLOOR_DECOR_ASSETS_BY_GROUP.tree).toHaveLength(57);
    expect(FLOOR_DECOR_ASSETS_BY_GROUP.seat).toHaveLength(29);
    expect(FLOOR_DECOR_ASSETS_BY_GROUP.fixtures).toHaveLength(30);
    expect(FLOOR_DECOR_ASSETS_BY_GROUP.other).toHaveLength(15);

    const allAssets = [...FLOOR_WALL_ASSETS, ...FLOOR_DECOR_ASSETS];
    expect(new Set(allAssets.map((asset) => asset.assetKey))).toHaveLength(140);
    expect(allAssets.every((asset) => existsSync(resolve(process.cwd(), "public", asset.assetKey.slice(1))))).toBe(true);
    expect(allAssets.every((asset) => getFloorDecorAsset(asset.assetKey) === asset)).toBe(true);
  });
});
