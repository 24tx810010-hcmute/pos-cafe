import clsx from "clsx";
import { Button, TextField } from "@mui/material";
import { Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toInt } from "@/features/admin/draftUtils";
import type { DraftGroup, DraftValue } from "@/features/admin/menuDraft";
import { PortalPopup } from "../../components/PortalPopup";

interface ModifierGroupEditorProps {
  group: DraftGroup;
  values: DraftValue[];
  onPatchGroup: (id: string, patch: Partial<DraftGroup>) => void;
  onAddValue: (groupId: string) => void;
  onPatchValue: (id: string, patch: Partial<DraftValue>) => void;
  onDeleteValue: (id: string) => void;
  onDeleteGroup: (id: string) => void;
  onClose: () => void;
}

// Popup chỉnh sửa một nhóm tuỳ chọn dùng chung (tên, kiểu chọn, bắt buộc, các giá trị).
export function ModifierGroupEditor({
  group,
  values,
  onPatchGroup,
  onAddValue,
  onPatchValue,
  onDeleteValue,
  onDeleteGroup,
  onClose,
}: ModifierGroupEditorProps) {
  return (
    <PortalPopup placement="Centered" viewport="workspace" overlayClassName="bg-slate-900/50" onOutsideClick={onClose}>
      <div
        className="grid w-[min(520px,92vw)] gap-3.5 rounded-pos bg-pos-surface p-5 shadow-[0_20px_60px_rgb(0_0_0_/_25%)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-base font-black">Sửa nhóm tuỳ chọn</h3>
          <button
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-pos-muted transition-colors hover:bg-pos-surface2 hover:text-pos-ink"
            title="Đóng"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <TextField
          label="Tên nhóm"
          value={group.name}
          onChange={(event) => onPatchGroup(group.id, { name: event.target.value })}
          error={!group.name.trim()}
          helperText={!group.name.trim() ? "Tên nhóm bắt buộc." : ""}
          size="small"
          fullWidth
          inputProps={{ "data-testid": "modifier-group-name-input" }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              className={clsx(
                "min-w-[96px] cursor-pointer rounded-[7px] border px-2.5 py-2 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary",
                group.selectType === "single"
                  ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary"
                  : "border-pos-line bg-pos-surface text-pos-ink",
              )}
              onClick={() => onPatchGroup(group.id, { selectType: "single" })}
            >
              Chỉ chọn 1
            </button>
            <button
              className={clsx(
                "min-w-[96px] cursor-pointer rounded-[7px] border px-2.5 py-2 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary",
                group.selectType === "multi"
                  ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary"
                  : "border-pos-line bg-pos-surface text-pos-ink",
              )}
              onClick={() => onPatchGroup(group.id, { selectType: "multi" })}
            >
              Chọn nhiều
            </button>
          </div>
          <button
            className={clsx(
              "cursor-pointer whitespace-nowrap rounded-[7px] border px-3 py-[9px] text-xs font-bold",
              group.isRequired
                ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary"
                : "border-pos-line bg-pos-surface text-pos-muted",
            )}
            onClick={() => onPatchGroup(group.id, { isRequired: !group.isRequired })}
          >
            {group.isRequired ? "Bắt buộc chọn" : "Không bắt buộc"}
          </button>
        </div>

        <div className="grid gap-2 border-t border-dashed border-pos-line pt-3">
          <span className="text-xs font-extrabold text-pos-muted">Các lựa chọn</span>
          {values.length === 0 ? (
            <p className="m-0 text-sm text-pos-muted">Chưa có lựa chọn nào.</p>
          ) : (
            values.map((value) => (
              <div key={value.id} className="grid grid-cols-[1.6fr_1fr_auto] items-start gap-1.5">
                <TextField
                  label="Tên"
                  value={value.name}
                  onChange={(event) => onPatchValue(value.id, { name: event.target.value })}
                  size="small"
                />
                <TextField
                  label="Giá (VND)"
                  value={String(value.priceDelta)}
                  onChange={(event) => onPatchValue(value.id, { priceDelta: toInt(event.target.value) })}
                  size="small"
                  inputProps={{ inputMode: "numeric" }}
                />
                <button
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[6px] border border-pos-line bg-pos-surface2 text-pos-muted transition-[border-color,color] hover:border-pos-danger hover:text-pos-danger"
                  title="Xoá lựa chọn"
                  onClick={() => onDeleteValue(value.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
          <button
            className="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-dashed border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary"
            onClick={() => onAddValue(group.id)}
          >
            <Plus size={13} /> Thêm lựa chọn
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-pos-line pt-3">
          {group.deleted ? (
            <Button variant="outlined" startIcon={<RotateCcw size={15} />} onClick={() => onPatchGroup(group.id, { deleted: false })}>
              Khôi phục nhóm
            </Button>
          ) : (
            <Button variant="outlined" color="error" startIcon={<Trash2 size={15} />} onClick={() => onDeleteGroup(group.id)}>
              Xoá nhóm
            </Button>
          )}
          <Button variant="contained" onClick={onClose}>
            Xong
          </Button>
        </div>
      </div>
    </PortalPopup>
  );
}
