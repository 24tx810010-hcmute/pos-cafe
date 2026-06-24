import type { ReactNode } from "react";
import type { OrderItemSnapshot, OrderStatus } from "@/domain";

export const statusLabel: Record<OrderStatus, string> = {
  paid: "Đã thanh toán",
  open: "Đang mở",
  void: "Đã hủy",
};

export const statusClass: Record<OrderStatus, string> = {
  paid: "bg-[#dcfce7] text-[#166534] border-[#bbf7d0]",
  open: "bg-[#fef9c3] text-[#854d0e] border-[#fde68a]",
  void: "bg-[#fee2e2] text-[#991b1b] border-[#fecaca]",
};

export const itemLineTotal = (item: OrderItemSnapshot): number => {
  const optionDelta = item.options.reduce((sum, option) => sum + option.priceDelta, 0);
  return (item.unitPrice + optionDelta) * item.quantity;
};

export const itemMeta = (item: OrderItemSnapshot): string => {
  const options = item.options.map((option) => option.optionName);
  const note = item.note ? [`ghi chú: ${item.note}`] : [];
  return [...options, ...note].join(" · ");
};

export const IconButton = ({
  children,
  disabled = false,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-pos-line bg-white text-pos-ink transition-[border-color,color,background] hover:border-pos-primary hover:bg-pos-primarySoft hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 max-[760px]:h-8 max-[760px]:w-8"
  >
    {children}
  </button>
);
