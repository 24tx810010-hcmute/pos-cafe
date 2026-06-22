import { Tooltip, useMediaQuery } from "@mui/material";
import clsx from "clsx";
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
  const compactRail = useMediaQuery("(max-width: 980px)");
  const btn = (
    <button
      aria-disabled={disabled}
      aria-label={label}
      className={clsx(
        "group flex min-h-11 w-full cursor-pointer items-center justify-start gap-3 rounded-[10px] border px-3 py-2 text-sm font-extrabold transition-colors max-[980px]:min-h-11 max-[980px]:justify-center max-[980px]:gap-0 max-[980px]:px-0",
        active
          ? "border-pos-primary bg-pos-primary text-white shadow-[0_10px_22px_rgb(15_118_110_/_22%)] hover:bg-pos-primary"
          : "border-transparent text-[#334155] hover:border-[#dbe4ef] hover:bg-white hover:text-pos-ink",
        disabled && "cursor-not-allowed opacity-35",
      )}
      onClick={disabled ? undefined : onClick}
    >
      <span
        className={clsx(
          "grid h-8 w-8 shrink-0 place-items-center rounded-[8px] transition-colors",
          active
            ? "bg-white/15 text-white"
            : "bg-[#e8eef3] text-[#475569] group-hover:bg-pos-primarySoft group-hover:text-pos-primary",
          disabled && "group-hover:bg-[#e8eef3] group-hover:text-[#475569]",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-[1.15] max-[980px]:sr-only">{label}</span>
    </button>
  );

  if (!disabled && !compactRail) {
    return btn;
  }

  return (
    <Tooltip title={disabled ? "Cần quyền quản lý" : label} placement="right" arrow enterDelay={500}>
      <span className="contents">{btn}</span>
    </Tooltip>
  );
}
