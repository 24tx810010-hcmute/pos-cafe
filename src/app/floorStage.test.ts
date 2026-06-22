import { describe, expect, it } from "vitest";
import { logicalStage, pointerClientToLogical, stageStyle } from "./floorStage";

describe("floorStage", () => {
  it("keeps the existing 1600x900 logical coordinate space", () => {
    expect(logicalStage).toEqual({ width: 1600, height: 900 });
  });

  it("renders logical node geometry as pixels inside the fixed stage", () => {
    expect(stageStyle(260, 190, 120, 76)).toMatchObject({
      left: "260px",
      top: "190px",
      width: "120px",
      height: "76px",
    });
  });

  it("maps viewport pointer coordinates back to logical stage coordinates", () => {
    const rect = {
      left: 100,
      top: 50,
      width: 800,
      height: 450,
    };

    expect(pointerClientToLogical(230, 145, rect)).toEqual({ x: 260, y: 190 });
  });
});
