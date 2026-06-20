import clsx from "clsx";
import { Button, TextField } from "@mui/material";
import { ChevronRight, Lock, RotateCcw, Trash2, Unlock } from "lucide-react";
import type { TableShape } from "@/domain";
import { toInt } from "../../helpers/menuDraft.helpers";
import {
  DECOR_LABEL,
  DECOR_LIBRARY,
  SHAPE_LABEL,
  tableDefaultSize,
  type DraftArea,
  type DraftDecor,
  type DraftTable,
} from "../../helpers/floorEditor.helpers";

type PatchDraft<T> = (id: string, patch: Partial<T>) => void;

interface FloorEditorInspectorPaneProps {
  currentArea: DraftArea | null;
  selectedTable: DraftTable | null;
  selectedDecor: DraftDecor | null;
  sortedAreas: DraftArea[];
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  patchArea: PatchDraft<DraftArea>;
  toggleDeleteArea: (id: string) => void;
  patchTable: PatchDraft<DraftTable>;
  toggleDeleteTable: (id: string) => void;
  patchDecor: PatchDraft<DraftDecor>;
  toggleDeleteDecor: (id: string) => void;
}

export function FloorEditorInspectorPane({
  currentArea,
  selectedTable,
  selectedDecor,
  sortedAreas,
  advancedOpen,
  onToggleAdvanced,
  patchArea,
  toggleDeleteArea,
  patchTable,
  toggleDeleteTable,
  patchDecor,
  toggleDeleteDecor,
}: FloorEditorInspectorPaneProps) {
  return (
    <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
      <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">{selectedTable ? "Chi tiết bàn" : selectedDecor ? "Chi tiết trang trí" : "Chi tiết khu"}</div>
      <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2 grid content-start gap-3">
        {selectedTable ? (
          <>
            <TextField label="Tên bàn" value={selectedTable.name} onChange={(e) => patchTable(selectedTable.id, { name: e.target.value })} size="small" fullWidth inputProps={{ "data-testid": "fe-table-name-input" }} />
            <TextField label="Số chỗ" value={String(selectedTable.seats)} onChange={(e) => patchTable(selectedTable.id, { seats: toInt(e.target.value) })} size="small" fullWidth inputProps={{ inputMode: "numeric" }} />
            <div className="grid gap-1.5">
              <span className="text-xs font-extrabold text-pos-muted">Hình dạng</span>
              <div className="flex flex-wrap gap-1.5">
                {(["round", "square", "rectangle"] as TableShape[]).map((shape) => (
                  <button key={shape} className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border border-pos-line bg-pos-surface px-2.5 py-2 text-[13px] font-bold text-pos-ink transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", selectedTable.shape === shape && "border-pos-primaryLine bg-pos-primarySoft text-pos-primary")} onClick={() => patchTable(selectedTable.id, { shape, ...tableDefaultSize(shape) })}>
                    {SHAPE_LABEL[shape]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-extrabold text-pos-muted">Khu vực</span>
              <div className="flex flex-wrap gap-1.5">
                {sortedAreas.map((a) => (
                  <button key={a.id} className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border border-pos-line bg-pos-surface px-2.5 py-2 text-[13px] font-bold text-pos-ink transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", selectedTable.areaId === a.id && "border-pos-primaryLine bg-pos-primarySoft text-pos-primary")} onClick={() => patchTable(selectedTable.id, { areaId: a.id })}>{a.name}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-pos-muted">Trạng thái (chỉ xem)</span>
              <span className={clsx("inline-flex min-h-[22px] w-fit items-center rounded-full border border-pos-line bg-pos-surface2 px-2 py-0.5 text-[11px] font-bold text-pos-muted", selectedTable.status !== "occupied" && "border-[#bbf7d0] bg-[#f0fdf4] text-pos-success")}>{selectedTable.status === "occupied" ? "Có khách" : "Trống"}</span>
            </div>
            <Button variant="outlined" color={selectedTable.deleted ? "primary" : "error"} startIcon={selectedTable.deleted ? <RotateCcw size={15} /> : <Trash2 size={15} />} onClick={() => toggleDeleteTable(selectedTable.id)}>
              {selectedTable.deleted ? "Khôi phục bàn" : "Xoá bàn"}
            </Button>
            <p className="text-pos-muted">Trạng thái bàn lấy từ đơn đang mở.</p>

            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-[7px] border border-pos-line bg-pos-surface2 px-2.5 py-[9px] text-left text-[13px] font-extrabold text-pos-ink hover:border-pos-primary"
              aria-expanded={advancedOpen}
              onClick={onToggleAdvanced}
            >
              <ChevronRight size={15} className={clsx("shrink-0 transition-transform duration-150", advancedOpen && "rotate-90")} />
              Nâng cao
              <span className="text-pos-muted">Vị trí · kích thước · xoay</span>
            </button>
            {advancedOpen && (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="X" value={String(selectedTable.posX)} onChange={(e) => patchTable(selectedTable.id, { posX: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                  <TextField label="Y" value={String(selectedTable.posY)} onChange={(e) => patchTable(selectedTable.id, { posY: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                  <TextField label="Rộng" value={String(selectedTable.width)} onChange={(e) => patchTable(selectedTable.id, { width: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                  <TextField label="Cao" value={String(selectedTable.height)} onChange={(e) => patchTable(selectedTable.id, { height: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                </div>
                <TextField label="Xoay (°)" value={String(selectedTable.rotation)} onChange={(e) => patchTable(selectedTable.id, { rotation: toInt(e.target.value) % 360 })} size="small" fullWidth inputProps={{ inputMode: "numeric" }} />
              </div>
            )}
          </>
        ) : selectedDecor ? (
          <>
            <div className="grid gap-1.5">
              <span className="text-xs font-extrabold text-pos-muted">Loại</span>
              <div className="flex flex-wrap gap-1.5">
                {DECOR_LIBRARY.map((kind) => (
                  <button key={kind} className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border border-pos-line bg-pos-surface px-2.5 py-2 text-[13px] font-bold text-pos-ink transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", selectedDecor.kind === kind && "border-pos-primaryLine bg-pos-primarySoft text-pos-primary")} onClick={() => patchDecor(selectedDecor.id, { kind })}>{DECOR_LABEL[kind]}</button>
                ))}
              </div>
            </div>
            <TextField label="Nhãn" value={selectedDecor.label ?? ""} onChange={(e) => patchDecor(selectedDecor.id, { label: e.target.value })} size="small" fullWidth />
            <button className={clsx("inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5", selectedDecor.isLocked && "border-pos-primaryLine bg-pos-primarySoft text-pos-primary")} onClick={() => patchDecor(selectedDecor.id, { isLocked: !selectedDecor.isLocked })}>
              {selectedDecor.isLocked ? <Lock size={14} /> : <Unlock size={14} />} {selectedDecor.isLocked ? "Đã khoá (không kéo)" : "Khoá vị trí"}
            </button>
            <Button variant="outlined" color={selectedDecor.deleted ? "primary" : "error"} startIcon={selectedDecor.deleted ? <RotateCcw size={15} /> : <Trash2 size={15} />} onClick={() => toggleDeleteDecor(selectedDecor.id)}>
              {selectedDecor.deleted ? "Khôi phục" : "Xoá trang trí"}
            </Button>

            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-[7px] border border-pos-line bg-pos-surface2 px-2.5 py-[9px] text-left text-[13px] font-extrabold text-pos-ink hover:border-pos-primary"
              aria-expanded={advancedOpen}
              onClick={onToggleAdvanced}
            >
              <ChevronRight size={15} className={clsx("shrink-0 transition-transform duration-150", advancedOpen && "rotate-90")} />
              Nâng cao
              <span className="text-pos-muted">Vị trí · kích thước · lớp</span>
            </button>
            {advancedOpen && (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="X" value={String(selectedDecor.posX)} disabled={selectedDecor.isLocked} onChange={(e) => patchDecor(selectedDecor.id, { posX: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                  <TextField label="Y" value={String(selectedDecor.posY)} disabled={selectedDecor.isLocked} onChange={(e) => patchDecor(selectedDecor.id, { posY: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                  <TextField label="Rộng" value={String(selectedDecor.width)} onChange={(e) => patchDecor(selectedDecor.id, { width: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                  <TextField label="Cao" value={String(selectedDecor.height)} onChange={(e) => patchDecor(selectedDecor.id, { height: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="Xoay (°)" value={String(selectedDecor.rotation)} onChange={(e) => patchDecor(selectedDecor.id, { rotation: toInt(e.target.value) % 360 })} size="small" inputProps={{ inputMode: "numeric" }} />
                  <TextField label="Lớp hiển thị" value={String(selectedDecor.zIndex)} onChange={(e) => patchDecor(selectedDecor.id, { zIndex: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                </div>
              </div>
            )}
          </>
        ) : currentArea ? (
          <>
            <TextField
              label="Tên khu"
              value={currentArea.name}
              onChange={(e) => patchArea(currentArea.id, { name: e.target.value })}
              size="small"
              fullWidth
              inputProps={{ "data-testid": "fe-area-name-input" }}
            />
            <TextField
              label="Thứ tự"
              value={String(currentArea.sortOrder)}
              onChange={(e) => patchArea(currentArea.id, { sortOrder: toInt(e.target.value) })}
              size="small"
              fullWidth
              inputProps={{ inputMode: "numeric" }}
            />
            {currentArea.deleted && (
              <div className="flex items-center justify-between gap-2 rounded-[7px] border border-[#fde68a] bg-[#fffbeb] px-2.5 py-2 text-xs text-pos-warning">
                Khu đang đánh dấu xoá. Không thêm bàn hoặc trang trí mới vào khu này.
              </div>
            )}
            <Button
              variant="outlined"
              color={currentArea.deleted ? "primary" : "error"}
              startIcon={currentArea.deleted ? <RotateCcw size={15} /> : <Trash2 size={15} />}
              onClick={() => toggleDeleteArea(currentArea.id)}
            >
              {currentArea.deleted ? "Khôi phục khu" : "Xoá khu"}
            </Button>
            <p className="text-pos-muted">Chọn bàn hoặc trang trí trên khu vực thiết kế để chỉnh chi tiết.</p>
          </>
        ) : (
          <p className="text-pos-muted p-2">Thêm khu để bắt đầu chỉnh sơ đồ.</p>
        )}
      </div>
    </aside>
  );
}
