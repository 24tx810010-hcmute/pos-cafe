import clsx from "clsx";
import { Lock } from "lucide-react";
import type { CSSProperties, PointerEventHandler } from "react";
import type { DecorKind } from "@/domain";
import { DECOR_LABEL, type DraftDecor } from "@/features/admin/floorEditorDraft";
import { FloorDecorVisual } from "../../components/FloorDecorVisual";
import { getFloorDecorAsset } from "../../floorDecorAssets";

const decorToneClass = (kind: DecorKind) => {
  switch (kind) {
    case "counter": return "border-[#94a3b8] bg-[#e2e8f0] text-[#475569]";
    case "decor":
    case "image": return "border-[#c4b5fd] bg-[#ede9fe] text-[#6d28d9]";
    case "door": return "border-[#fde047] bg-[#fef9c3] text-[#713f12]";
    case "plant": return "border-[#86efac] bg-[#dcfce7] text-[#166534]";
    case "wall": return "border-[#cbd5e1] bg-[#f1f5f9] text-[#64748b]";
    default: return "border-[#cbd5e1] bg-[#e2e8f0] text-[#475569]";
  }
};

interface FloorEditorDecorNodeProps {
  item: DraftDecor;
  isSelected: boolean;
  labelBoost: number;
  style: CSSProperties;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
}

export function FloorEditorDecorNode({ item, isSelected, labelBoost, style, onPointerDown, onPointerMove, onPointerUp }: FloorEditorDecorNodeProps) {
  const visualAsset = getFloorDecorAsset(item.assetKey);
  return (
    <div
      className={clsx(
        "absolute grid cursor-grab place-items-center text-center text-xs font-black",
        visualAsset ? "overflow-hidden rounded-pos border border-transparent bg-transparent" : clsx("rounded-pos border border-dashed", decorToneClass(item.kind)),
        isSelected && "!z-50 outline outline-2 outline-offset-2 outline-pos-primary",
        item.deleted && "opacity-40",
        item.isLocked && "cursor-not-allowed",
      )}
      style={style}
      data-testid={`fe-decor-${item.id}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <FloorDecorVisual assetKey={item.assetKey} kind={item.kind} label={item.label} fallbackLabel={DECOR_LABEL[item.kind]} labelBoost={labelBoost} />
      {item.isLocked && <Lock size={11} className="absolute right-0.5 top-0.5" />}
    </div>
  );
}
