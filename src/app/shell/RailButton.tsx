import clsx from "clsx";
import { Tooltip } from "@mui/material";
import { type ReactNode } from "react";

export function RailButton({
  active,
  icon,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const btn = (
    <button
      className={clsx(
        "grid min-h-[52px] cursor-pointer place-items-center gap-[3px] rounded-pos border-0 bg-transparent text-inherit transition-colors hover:bg-white/[0.06] max-[980px]:min-h-10 [&_span]:text-center [&_span]:text-[10px] [&_span]:leading-[1.1] [&_span]:tracking-[0.01em]",
        active &&
          "bg-[rgb(15_118_110_/_24%)] text-white shadow-[inset_3px_0_0_var(--primary)] hover:bg-[rgb(15_118_110_/_24%)]",
        disabled && "cursor-not-allowed opacity-35 hover:bg-transparent",
      )}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  if (disabled) {
    return (
      <Tooltip title="Cần quyền quản lý" placement="right" arrow>
        <span className="contents">{btn}</span>
      </Tooltip>
    );
  }
  return btn;
}
