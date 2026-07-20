import { Minus, Plus } from "lucide-react";
import clsx from "clsx";
import { Button, TextField } from "@mui/material";
import type { SubmitOrderDraftItem } from "@/domain";
import type { CartLine } from "@/features/pos";
import { formatCompactVnd, formatVnd } from "@/core/money";

type OrderCartPaneProps = {
  cartLines: CartLine[];
  draftItems: SubmitOrderDraftItem[];
  noteOpenId: string | null;
  total: number;
  showPaymentHint: boolean;
  primaryDisabled: boolean;
  primaryActionLabel: string;
  primaryActionTitle?: string;
  onAdjustQuantity: (lineId: string, delta: number) => void;
  onToggleNote: (lineId: string) => void;
  onUpdateNote: (lineId: string, note: string) => void;
  onPrimaryAction: () => void;
};

export function OrderCartPane({
  cartLines,
  draftItems,
  noteOpenId,
  total,
  showPaymentHint,
  primaryDisabled,
  primaryActionLabel,
  primaryActionTitle,
  onAdjustQuantity,
  onToggleNote,
  onUpdateNote,
  onPrimaryAction,
}: OrderCartPaneProps) {
  const noteFor = (lineId: string) => draftItems.find((draft) => draft.id === lineId)?.note ?? "";

  return (
    <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">
        <span>Giỏ hàng</span>
        <span className="text-pos-muted">{cartLines.length} món</span>
      </div>
      <div className="grid min-h-0 content-start gap-2 overflow-auto p-2.5">
        {cartLines.length ? (
          cartLines.map((line) => (
            <div className="grid gap-1.5 rounded-pos border border-pos-line bg-white p-2.5" key={line.id}>
              <div className="flex items-center justify-between gap-2">
                <strong className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">{line.name}</strong>
                <strong className="font-black text-pos-primary">{formatCompactVnd(line.total)}</strong>
              </div>
              {line.optionText && (
                <div className="flex items-center justify-between gap-2 text-xs text-pos-muted">
                  <span>{line.optionText}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <button className="grid h-7 w-7 place-items-center rounded-[7px] border border-pos-line bg-pos-surface" onClick={() => onAdjustQuantity(line.id, -1)}>
                    <Minus size={14} />
                  </button>
                  <span className="min-w-[22px] text-center text-sm font-extrabold">{line.quantity}</span>
                  <button className="grid h-7 w-7 place-items-center rounded-[7px] border border-pos-line bg-pos-surface" onClick={() => onAdjustQuantity(line.id, 1)}>
                    <Plus size={14} />
                  </button>
                </span>
                <button
                  className={clsx(
                    "cursor-pointer rounded-[6px] border bg-transparent px-2 py-0.5 text-[11px] font-semibold",
                    noteOpenId === line.id
                      ? "border-pos-primary text-pos-primary"
                      : "border-pos-line text-pos-muted",
                  )}
                  onClick={() => onToggleNote(line.id)}
                >
                  Ghi chú
                </button>
              </div>
              {noteOpenId === line.id && (
                <TextField
                  size="small"
                  placeholder="VD: ít đá, không đường..."
                  value={noteFor(line.id)}
                  onChange={(event) => onUpdateNote(line.id, event.target.value)}
                  fullWidth
                  autoFocus
                />
              )}
              {noteFor(line.id) && noteOpenId !== line.id && (
                <div className="py-0.5 text-[11px] italic text-pos-muted">📝 {noteFor(line.id)}</div>
              )}
            </div>
          ))
        ) : (
          <p className="m-0 p-2 text-center text-[13px] text-pos-muted">Chọn món từ menu để tạo đơn.</p>
        )}
      </div>
      <footer className="sticky bottom-0 z-[2] grid gap-2 border-t border-pos-line bg-white p-2.5">
        {showPaymentHint && (
          <p className="m-0 rounded-[6px] border border-[#fde68a] bg-[#fffbeb] px-2.5 py-1.5 text-xs font-semibold text-pos-warning">Gửi đơn để lưu thay đổi trước khi thanh toán.</p>
        )}
        <div className="flex justify-between gap-2">
          <span>Tạm tính</span>
          <strong>{formatVnd(total)}</strong>
        </div>
        <div className="flex justify-between gap-2 text-xl font-black">
          <span>Tổng</span>
          <strong>{formatVnd(total)}</strong>
        </div>
        <Button
          variant="contained"
          fullWidth
          data-testid="submit-order-button-footer"
          disabled={primaryDisabled}
          title={primaryActionTitle}
          onClick={onPrimaryAction}
        >
          {primaryActionLabel}
        </Button>
      </footer>
    </aside>
  );
}
