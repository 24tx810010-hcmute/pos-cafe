import clsx from "clsx";
import type { CSSProperties, PointerEventHandler } from "react";
import type { DraftTable } from "@/features/admin/floorEditorDraft";
import { getFloorTableBackgroundAsset } from "../../floorTableBackgroundAssets";

interface FloorEditorTableNodeProps {
  item: DraftTable;
  isSelected: boolean;
  labelBoost: number;
  style: CSSProperties;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
}

export function FloorEditorTableNode({
  item,
  isSelected,
  labelBoost,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: FloorEditorTableNodeProps) {
  const background = getFloorTableBackgroundAsset(item.backgroundAssetKey);

  return (
    <div
      role="button"
      tabIndex={0}
      className={clsx(
        "absolute grid cursor-grab place-items-center overflow-hidden border-2 bg-white bg-cover bg-center text-center font-black shadow-[0_8px_18px_rgb(15_23_42_/_10%)] active:cursor-grabbing [&_small]:mt-[3px] [&_small]:block [&_small]:text-[10px] [&_small]:font-bold [&_small]:text-pos-muted",
        item.status === "occupied" ? "border-[#f97316]" : "border-[#86efac]",
        item.shape === "round" ? "rounded-full" : "rounded-pos",
        isSelected && "!z-50 outline outline-2 outline-offset-2 outline-pos-primary",
        item.deleted && "opacity-40",
      )}
      style={{
        ...style,
        backgroundImage: background ? `url("${background.assetKey}")` : undefined,
      }}
      data-testid={`fe-table-${item.id}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <span
        className="grid place-items-center leading-none"
        style={{ transform: `scale(${labelBoost})`, transformOrigin: "center" }}
      >
        <span data-floor-label="name">{item.name}</span>
      </span>
    </div>
  );
}
