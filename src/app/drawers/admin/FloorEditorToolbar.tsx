import clsx from "clsx";
import { ImagePlus, Magnet, Plus, PanelsTopLeft } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { TableShape } from "@/domain";
import { SHAPE_LABEL } from "@/features/admin/floorEditorDraft";

interface FloorEditorToolbarProps {
  areaDeleted?: boolean;
  snap: boolean;
  setSnap: Dispatch<SetStateAction<boolean>>;
  addTable: (shape: TableShape) => void;
  onAddWall: () => void;
  onAddDecoration: () => void;
}

export function FloorEditorToolbar({
  areaDeleted,
  snap,
  setSnap,
  addTable,
  onAddWall,
  onAddDecoration,
}: FloorEditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden px-0.5 pb-1 pt-px [scrollbar-width:thin]">
      <div className="inline-flex flex-none items-center gap-1.5">
        <span className="text-xs font-extrabold text-pos-muted">Thêm bàn</span>
        {(["round", "square", "rectangle"] as TableShape[]).map((shape) => (
          <button
            key={shape}
            className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2.5 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40"
            data-testid={`add-table-${shape}`}
            onClick={() => addTable(shape)}
            disabled={areaDeleted}
          >
            <Plus size={12} /> {SHAPE_LABEL[shape]}
          </button>
        ))}
      </div>
      <span className="mx-0.5 min-h-[26px] w-px self-stretch bg-pos-line" aria-hidden="true" />
      <div className="inline-flex flex-none items-center gap-1.5">
        <span className="text-xs font-extrabold text-pos-muted">Trang trí</span>
        <button
          className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2.5 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="add-wall-asset"
          onClick={onAddWall}
          disabled={areaDeleted}
        >
          <PanelsTopLeft size={13} /> Tường
        </button>
        <button
          className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2.5 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="add-decor-asset"
          onClick={onAddDecoration}
          disabled={areaDeleted}
        >
          <ImagePlus size={13} /> Ảnh trang trí
        </button>
      </div>
      <span className="mx-0.5 min-h-[26px] w-px self-stretch bg-pos-line" aria-hidden="true" />
      <div className="inline-flex flex-none items-center gap-1.5">
        <button
          className={clsx(
            "inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border px-2.5 text-xs font-bold transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40",
            snap ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary" : "border-pos-line bg-pos-surface2 text-pos-ink",
          )}
          onClick={() => setSnap((s) => !s)}
        >
          <Magnet size={14} /> Bắt lưới {snap ? "Bật" : "Tắt"}
        </button>
      </div>
    </div>
  );
}
