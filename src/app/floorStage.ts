export const logicalStage = { width: 1600, height: 900 };

export function stageStyle(posX: number, posY: number, width: number, height: number) {
  return {
    left: `${(posX / logicalStage.width) * 100}%`,
    top: `${(posY / logicalStage.height) * 100}%`,
    width: `${(width / logicalStage.width) * 100}%`,
    height: `${(height / logicalStage.height) * 100}%`,
  };
}
