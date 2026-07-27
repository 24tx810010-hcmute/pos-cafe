import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TABLE_BACKGROUND_ASSET,
  FLOOR_TABLE_BACKGROUND_ASSETS,
  FLOOR_TABLE_BACKGROUND_OPTIONS,
  getFloorTableBackgroundAsset,
} from "./floorTableBackgroundAssets";

describe("floor table background assets", () => {
  it("exposes the white default and all 11 copied backgrounds", () => {
    expect(DEFAULT_TABLE_BACKGROUND_ASSET.assetKey).toBeNull();
    expect(FLOOR_TABLE_BACKGROUND_ASSETS).toHaveLength(11);
    expect(FLOOR_TABLE_BACKGROUND_OPTIONS).toHaveLength(12);
    expect(new Set(FLOOR_TABLE_BACKGROUND_ASSETS.map((asset) => asset.assetKey))).toHaveLength(11);
    expect(
      FLOOR_TABLE_BACKGROUND_ASSETS.every((asset) =>
        existsSync(resolve(process.cwd(), "public", asset.assetKey!.slice(1))),
      ),
    ).toBe(true);
    expect(
      FLOOR_TABLE_BACKGROUND_ASSETS.every(
        (asset) => getFloorTableBackgroundAsset(asset.assetKey) === asset,
      ),
    ).toBe(true);
    expect(getFloorTableBackgroundAsset(null)).toBeNull();
  });
});
