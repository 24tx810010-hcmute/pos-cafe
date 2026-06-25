import clsx from "clsx";
import { Button } from "@mui/material";
import { Check, Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import type { MenuItem, SubmitOrderDraftOption } from "@/domain";
import { formatVnd } from "@/core/money";
import { validateModifierSelection, type ModifierSelection } from "@/core/orderDraft";
import type { ItemModifierGroup } from "@/features/pos";
import { PortalPopup } from "../../components/PortalPopup";

interface ModifierPickerPopupProps {
  menuItem: MenuItem;
  groups: ItemModifierGroup[];
  onConfirm: (options: SubmitOrderDraftOption[]) => void;
  onClose: () => void;
}

// Popup chọn tuỳ chọn (modifier) khi gọi một món có nhóm tuỳ chọn.
// - Nhóm chọn-1: chọn tối đa 1 giá trị (số lượng luôn 1).
// - Nhóm chọn-nhiều: tick nhiều giá trị, mỗi giá trị có số lượng riêng (mặc định 1).
export function ModifierPickerPopup({ menuItem, groups, onConfirm, onClose }: ModifierPickerPopupProps) {
  // optionValueId -> số lượng (>=1 nghĩa là đang chọn).
  const [selected, setSelected] = useState<Record<string, number>>({});

  const groupOf = (optionValueId: string): string | undefined => {
    for (const { values } of groups) {
      const value = values.find((candidate) => candidate.id === optionValueId);
      if (value) return value.optionGroupId;
    }
    return undefined;
  };

  const toggleSingle = (groupId: string, valueId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      const wasSelected = (next[valueId] ?? 0) > 0;
      // Bỏ mọi giá trị khác cùng nhóm (chọn-1).
      const group = groups.find((g) => g.group.id === groupId);
      group?.values.forEach((value) => delete next[value.id]);
      if (!wasSelected) next[valueId] = 1;
      return next;
    });
  };

  const toggleMulti = (valueId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if ((next[valueId] ?? 0) > 0) delete next[valueId];
      else next[valueId] = 1;
      return next;
    });
  };

  const adjustQuantity = (valueId: string, delta: number) => {
    setSelected((prev) => {
      const current = prev[valueId] ?? 0;
      if (current === 0) return prev;
      return { ...prev, [valueId]: Math.max(1, current + delta) };
    });
  };

  const selections: ModifierSelection[] = Object.entries(selected)
    .filter(([, quantity]) => quantity > 0)
    .map(([optionValueId, quantity]) => ({ optionValueId, quantity, optionGroupId: groupOf(optionValueId) ?? "" }));

  const valid = validateModifierSelection(
    groups.map((g) => g.group),
    selections,
  );

  const optionsTotal = groups.reduce(
    (sum, { values }) =>
      sum + values.reduce((groupSum, value) => groupSum + value.priceDelta * (selected[value.id] ?? 0), 0),
    0,
  );
  const lineTotal = menuItem.price + optionsTotal;

  const handleConfirm = () => {
    if (!valid) return;
    const options: SubmitOrderDraftOption[] = selections.map((selection) => ({
      id: crypto.randomUUID(),
      optionValueId: selection.optionValueId,
      quantity: selection.quantity,
    }));
    onConfirm(options);
  };

  return (
    <PortalPopup placement="Centered" viewport="workspace" overlayClassName="bg-slate-900/50" onOutsideClick={onClose}>
      <div
        className="grid max-h-[86vh] w-[min(460px,92vw)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-pos bg-pos-surface shadow-[0_20px_60px_rgb(0_0_0_/_25%)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-pos-line px-4 py-3">
          <div className="min-w-0">
            <h3 className="m-0 truncate text-base font-black">{menuItem.name}</h3>
            <span className="text-xs font-bold text-pos-muted">{formatVnd(menuItem.price)}</span>
          </div>
          <button
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-pos-muted transition-colors hover:bg-pos-surface2 hover:text-pos-ink"
            title="Đóng"
            data-testid="modifier-picker-close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid content-start gap-3.5 overflow-auto p-4">
          {groups.map(({ group, values }) => (
            <div key={group.id} className="grid gap-1.5">
              <div className="flex items-center gap-1.5">
                <strong className="text-[13px]">{group.name}</strong>
                <span className="rounded-full bg-pos-surface2 px-1.5 py-px text-[10px] font-bold text-pos-muted">
                  {group.selectType === "single" ? "Chọn 1" : "Chọn nhiều"}
                </span>
                {group.isRequired && (
                  <span className="rounded-full bg-pos-primarySoft px-1.5 py-px text-[10px] font-bold text-pos-primary">Bắt buộc</span>
                )}
              </div>
              <div className="grid gap-1.5">
                {values.length === 0 ? (
                  <p className="m-0 text-xs text-pos-muted">Chưa có lựa chọn.</p>
                ) : (
                  values.map((value) => {
                    const quantity = selected[value.id] ?? 0;
                    const picked = quantity > 0;
                    return (
                      <div
                        key={value.id}
                        className={clsx(
                          "flex items-center gap-2 rounded-[8px] border px-2.5 py-2 transition-colors",
                          picked ? "border-pos-primaryLine bg-pos-primarySoft" : "border-pos-line bg-pos-surface",
                        )}
                      >
                        <button
                          className="flex min-w-0 flex-[1_1_auto] items-center gap-2 text-left"
                          data-testid={`modifier-value-${value.id}`}
                          onClick={() =>
                            group.selectType === "single" ? toggleSingle(group.id, value.id) : toggleMulti(value.id)
                          }
                        >
                          <span
                            className={clsx(
                              "grid h-5 w-5 shrink-0 place-items-center border text-white",
                              group.selectType === "single" ? "rounded-full" : "rounded-[5px]",
                              picked ? "border-pos-primary bg-pos-primary" : "border-pos-line bg-pos-surface",
                            )}
                          >
                            {picked && <Check size={13} />}
                          </span>
                          <span className="truncate text-[13px] font-semibold">{value.name}</span>
                          {value.priceDelta > 0 && (
                            <span className="ml-auto shrink-0 text-xs font-bold text-pos-muted">+{formatVnd(value.priceDelta)}</span>
                          )}
                        </button>
                        {group.selectType === "multi" && picked && (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              className="grid h-7 w-7 place-items-center rounded-[6px] border border-pos-line bg-pos-surface text-pos-ink transition-colors hover:border-pos-primary hover:text-pos-primary"
                              title="Giảm"
                              data-testid={`modifier-qty-dec-${value.id}`}
                              onClick={() => adjustQuantity(value.id, -1)}
                            >
                              <Minus size={13} />
                            </button>
                            <span className="min-w-[18px] text-center text-sm font-black" data-testid={`modifier-qty-${value.id}`}>
                              {quantity}
                            </span>
                            <button
                              className="grid h-7 w-7 place-items-center rounded-[6px] border border-pos-line bg-pos-surface text-pos-ink transition-colors hover:border-pos-primary hover:text-pos-primary"
                              title="Tăng"
                              data-testid={`modifier-qty-inc-${value.id}`}
                              onClick={() => adjustQuantity(value.id, 1)}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2.5 border-t border-pos-line px-4 py-3">
          <div className="grid">
            <span className="text-[11px] font-bold text-pos-muted">Tạm tính</span>
            <span className="text-base font-black text-pos-primary">{formatVnd(lineTotal)}</span>
          </div>
          <Button variant="contained" disabled={!valid} data-testid="modifier-confirm" onClick={handleConfirm}>
            Thêm vào đơn
          </Button>
        </div>
      </div>
    </PortalPopup>
  );
}
