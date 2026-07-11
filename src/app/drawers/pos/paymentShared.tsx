import clsx from "clsx";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@mui/material";
import type { OrderDetail } from "@/domain";

export const keypadKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "00", "0"] as const;

export const paymentText = {
  amountHeader: "text-[12px] min-[1024px]:text-[15px] min-[1280px]:text-[16px]",
  body: "text-[13px] min-[1024px]:text-[15px] min-[1280px]:text-[16px]",
  emphasis: "text-[16px] min-[1024px]:text-[17px]",
  micro: "text-[12px] min-[1024px]:text-[13px] min-[1280px]:text-[14px]",
  secondary: "text-[12px] min-[1024px]:text-[14px] min-[1280px]:text-[15px]",
  strong: "text-[15px] min-[1024px]:text-[16px] min-[1280px]:text-[17px]",
} as const;

export const paymentButtonText = {
  body: "!text-[13px] min-[1024px]:!text-[15px] min-[1280px]:!text-[16px]",
  emphasis: "!text-[16px] min-[1024px]:!text-[17px]",
} as const;

export const paymentSummaryValueClass = clsx(
  "min-w-[118px] text-right font-black leading-tight text-pos-ink max-[900px]:min-w-[96px]",
  paymentText.strong,
);

export type PaymentMethodOption = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  active: boolean;
};

export const getOrderTypeLabel = (order?: OrderDetail | null) =>
  order?.orderType === "takeaway" ? "Mang đi" : "Tại bàn";

export const formatAmountInputValue = (rawDigits: string) => {
  const normalized = rawDigits.replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export function PaymentHeader({
  title,
  meta,
  onClose,
  action,
}: {
  title: string;
  meta?: string;
  onClose: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[900px]:min-h-[44px] max-[900px]:gap-1.5 max-[900px]:px-2 max-[900px]:py-1.5">
      <div className="grid min-w-0 flex-[1_1_260px] gap-1">
        <h2 className={clsx("m-0 truncate font-black leading-tight tracking-normal text-pos-ink", paymentText.emphasis)}>
          {title}
        </h2>
        {meta && <p className={clsx("m-0 truncate font-bold text-pos-muted", paymentText.micro)}>{meta}</p>}
      </div>
      <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2">
        <Button
          variant="outlined"
          onClick={onClose}
          className={clsx("!min-h-9 !whitespace-nowrap max-[900px]:!min-h-[30px] max-[900px]:!px-2.5", paymentButtonText.body)}
        >
          Quay lại
        </Button>
        {action}
      </div>
    </header>
  );
}

export function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-pos-line bg-[#fbfcfd] px-4 py-2.5 max-[900px]:min-h-[34px] max-[900px]:px-2.5 max-[900px]:py-1.5">
      <div className="min-w-0">
        <h3 className={clsx("m-0 truncate font-black leading-tight text-pos-ink", paymentText.strong)}>{title}</h3>
        <p className={clsx("m-0 mt-0.5 truncate font-bold text-pos-muted max-[900px]:hidden", paymentText.body)}>{subtitle}</p>
      </div>
    </div>
  );
}

export function PaymentState({ testId, icon, children }: { testId: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted"
      data-testid={testId}
    >
      {icon}
      {children}
    </div>
  );
}

export function QuickAmountButtons({
  total,
  receivedAmount,
  onSelect,
}: {
  total: number;
  receivedAmount: number;
  onSelect: (value: number) => void;
}) {
  const options = [
    { label: "Đúng tiền", value: total },
    { label: "+20k", value: total + 20000 },
    { label: "+50k", value: total + 50000 },
    { label: "200k", value: 200000 },
    { label: "500k", value: 500000 },
  ];

  return (
    <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-1.5 max-[900px]:gap-1">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          className={clsx(
            "min-h-[34px] rounded-[7px] border px-1 text-center font-black leading-[1.15] transition hover:border-pos-primary max-[900px]:min-h-[30px]",
            paymentText.body,
            receivedAmount === option.value
              ? "border-pos-primary bg-pos-primarySoft text-pos-primary"
              : "border-pos-line bg-white text-pos-ink",
          )}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SummaryRow({ label, value, valueTestId }: { label: string; value: string; valueTestId: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={clsx("font-black text-pos-muted", paymentText.secondary)}>{label}</span>
      <strong className={paymentSummaryValueClass} data-testid={valueTestId}>
        {value}
      </strong>
    </div>
  );
}
