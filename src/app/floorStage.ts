export const logicalStage = { width: 1600, height: 900 };

export function stageStyle(posX: number, posY: number, width: number, height: number) {
  return {
    left: `${posX}px`,
    top: `${posY}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const boostForEffectiveScale = (stageScale: number, targetEffectiveScale: number, maxBoost: number) => {
  if (stageScale <= 0) return 1;
  return clamp(targetEffectiveScale / stageScale, 1, maxBoost);
};

export function getObjectBoost(stageScale: number) {
  return boostForEffectiveScale(stageScale, 0.5, 1.8);
}

export function getLabelBoost(effectiveScale: number) {
  return boostForEffectiveScale(effectiveScale, 0.95, 3);
}

export type FloorStageRect = Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">;

export function pointerClientToLogical(clientX: number, clientY: number, rect: FloorStageRect) {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: logicalStage.width / 2, y: logicalStage.height / 2 };
  }

  return {
    x: ((clientX - rect.left) / rect.width) * logicalStage.width,
    y: ((clientY - rect.top) / rect.height) * logicalStage.height,
  };
}
