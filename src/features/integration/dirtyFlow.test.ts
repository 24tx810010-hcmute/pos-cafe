import { describe, expect, it } from "vitest";
import { createSaveFeedback, getDirtyExitDecision } from "./dirtyFlow";

describe("dirtyFlow", () => {
  it("allows clean exits, confirms dirty exits, and blocks exits while saving", () => {
    expect(getDirtyExitDecision({ isDirty: false })).toBe("allow");
    expect(getDirtyExitDecision({ isDirty: true })).toBe("confirmDiscard");
    expect(getDirtyExitDecision({ isDirty: false, isSaving: true })).toBe("blockWhileSaving");
    expect(getDirtyExitDecision({ isDirty: true, isSaving: true })).toBe("blockWhileSaving");
  });

  it("creates consistent save feedback for admin surfaces", () => {
    expect(createSaveFeedback("menu", "success")).toEqual({
      kind: "success",
      title: "Đã lưu",
      message: "Thay đổi menu đã được lưu.",
    });
    expect(createSaveFeedback("floorPlan", "error")).toEqual({
      kind: "error",
      title: "Chưa lưu được",
      message: "Thay đổi sơ đồ bàn chưa được lưu. Hãy thử lại.",
    });
  });
});
