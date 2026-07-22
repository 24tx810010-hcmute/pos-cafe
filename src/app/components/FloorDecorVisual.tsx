import type { DecorKind } from "@/domain";
import { getFloorDecorAsset } from "../floorDecorAssets";

interface FloorDecorVisualProps {
  assetKey: string;
  kind: DecorKind;
  label: string | null;
  fallbackLabel: string;
  labelBoost?: number;
}

export function FloorDecorVisual({
  assetKey,
  kind,
  label,
  fallbackLabel,
  labelBoost = 1,
}: FloorDecorVisualProps) {
  const asset = getFloorDecorAsset(assetKey);

  if (asset) {
    return (
      <img
        alt={label ?? asset.label}
        className={kind === "wall" ? "pointer-events-none h-full w-full select-none object-cover" : "pointer-events-none h-full w-full select-none object-contain"}
        draggable={false}
        src={asset.assetKey}
      />
    );
  }

  return (
    <span
      data-floor-label="name"
      style={{ transform: `scale(${labelBoost})`, transformOrigin: "center" }}
    >
      {label ?? fallbackLabel}
    </span>
  );
}
