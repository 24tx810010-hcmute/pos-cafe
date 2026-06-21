import clsx from "clsx";
import { Hand, Magnet, MousePointer2, Plus, ZoomIn, ZoomOut } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { DecorKind, TableShape } from "@/domain";
import {
  DECOR_LABEL,
  DECOR_LIBRARY,
  SHAPE_LABEL,
  type FloorTool,
} from "@/features/admin/floorEditorDraft";

interface FloorEditorToolbarProps {
  areaDeleted?: boolean;
  tool: FloorTool;
  zoom: number;
  snap: boolean;
  setTool: (tool: FloorTool) => void;
  setZoom: Dispatch<SetStateAction<number>>;
  setSnap: Dispatch<SetStateAction<boolean>>;
  addTable: (shape: TableShape) => void;
  addDecor: (kind: DecorKind) => void;
}

export function FloorEditorToolbar({
  areaDeleted,
  tool,
  zoom,
  snap,
  setTool,
  setZoom,
  setSnap,
  addTable,
  addDecor,
}: FloorEditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden px-0.5 pb-0.5 pt-px [scrollbar-width:thin] gap-2 pb-1">
      <div className="inline-flex flex-none items-center gap-1.5">
        <button className={clsx("inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border px-2 text-xs font-bold transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5", tool === "select" ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary" : "border-pos-line bg-pos-surface2 text-pos-ink")} onClick={() => setTool("select")} title="Chọn">
          <MousePointer2 size={14} /> Chọn
        </button>
        <button className={clsx("inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border px-2 text-xs font-bold transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5", tool === "pan" ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary" : "border-pos-line bg-pos-surface2 text-pos-ink")} onClick={() => setTool("pan")} title="Di chuyển khung nhìn">
          <Hand size={14} /> Di chuyển
        </button>
      </div>
      <span className="mx-0.5 min-h-[26px] w-px self-stretch bg-pos-line" aria-hidden="true" />
      <div className="inline-flex flex-none items-center gap-1.5">
        <span className="text-xs font-extrabold text-pos-muted">Thêm bàn</span>
        {(["round", "square", "rectangle"] as TableShape[]).map((shape) => (
          <button
            key={shape}
            className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5"
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
        {DECOR_LIBRARY.map((kind) => (
          <button key={kind} className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5" onClick={() => addDecor(kind)} disabled={areaDeleted}>
            <Plus size={12} /> {DECOR_LABEL[kind]}
          </button>
        ))}
      </div>
      <span className="mx-0.5 min-h-[26px] w-px self-stretch bg-pos-line" aria-hidden="true" />
      <div className="inline-flex flex-none items-center gap-1.5">
        <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" title="Thu nhỏ" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}><ZoomOut size={14} /></button>
        <span className="min-w-10 text-center text-xs font-bold">{Math.round(zoom * 100)}%</span>
        <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" title="Phóng to" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.2).toFixed(1)))}><ZoomIn size={14} /></button>
        <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" onClick={() => setZoom(1)}>100%</button>
        <button className={clsx("inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border px-2 text-xs font-bold transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5", snap ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary" : "border-pos-line bg-pos-surface2 text-pos-ink")} onClick={() => setSnap((s) => !s)}>
          <Magnet size={14} /> Bắt lưới {snap ? "Bật" : "Tắt"}
        </button>
      </div>
    </div>
  );
}
