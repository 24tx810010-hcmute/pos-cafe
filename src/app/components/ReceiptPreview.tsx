import { Printer, X } from "lucide-react";
import { forwardRef, useRef } from "react";
import type { CSSProperties } from "react";
import { formatVnd } from "@/core/money";
import type { OrderDetail, PrintReceipt, PrintTicket } from "@/domain";
import { useStoreSettingsQuery } from "@/features/admin";
import { PortalPopup } from "./PortalPopup";
import { useAppStore } from "../useAppStore";

// ---- Builders: domain order -> print doc -------------------------------------

const linesFromItems = (items: OrderDetail["items"]): PrintTicket["lines"] =>
  items.map((item) => {
    const optionDelta = item.options.reduce((sum, option) => sum + option.priceDelta, 0);
    return {
      name: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice + optionDelta,
      options: [
        ...item.options.map((option) => option.optionName),
        ...(item.note ? [`Ghi chú: ${item.note}`] : []),
      ],
    };
  });

export const ticketFromOrderDetail = (order: OrderDetail, tableName: string | null): PrintTicket => ({
  orderNo: order.orderNo,
  tableName,
  orderType: order.orderType,
  lines: linesFromItems(order.items),
  total: order.total,
});

export const receiptFromOrderDetail = (order: OrderDetail, tableName: string | null): PrintReceipt | null => {
  if (!order.payment) return null;
  return {
    ...ticketFromOrderDetail(order, tableName),
    receivedAmount: order.payment.receivedAmount,
    changeAmount: order.payment.changeAmount,
    paidAt: order.payment.paidAt,
  };
};

// ---- Print: isolate the receipt in a hidden iframe ---------------------------

const printDocElement = (element: HTMLElement) => {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const frameDoc = frame.contentWindow?.document;
  if (!frameDoc) {
    frame.remove();
    return;
  }
  frameDoc.open();
  frameDoc.write(
    `<!doctype html><html><head><meta charset="utf-8" /><title>In hoá đơn</title>` +
      `<style>@page{margin:0}body{margin:0}</style></head><body>${element.outerHTML}</body></html>`,
  );
  frameDoc.close();
  frame.contentWindow?.focus();
  window.setTimeout(() => {
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 800);
  }, 200);
};

// ---- Receipt document (80mm thermal, self-contained inline styles) -----------

const formatPlain = (amount: number): string => new Intl.NumberFormat("vi-VN").format(amount);

const formatDateTime = (iso: string | null): string => {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const PAPER_WIDTH = 302; // ~80mm @ 96dpi

const s = {
  paper: {
    width: PAPER_WIDTH,
    boxSizing: "border-box",
    background: "#ffffff",
    color: "#111418",
    fontFamily: '"Roboto Mono", ui-monospace, "Cascadia Mono", Consolas, monospace',
    fontSize: 12,
    lineHeight: 1.5,
    padding: "18px 18px 22px",
  } satisfies CSSProperties,
  center: { textAlign: "center" } as CSSProperties,
  storeName: { fontSize: 16, fontWeight: 700, letterSpacing: 0.3 } as CSSProperties,
  addr: { fontSize: 11, color: "#5b6470", marginTop: 2 } as CSSProperties,
  divider: { borderTop: "1px dashed #b5bcc6", margin: "10px 0" } as CSSProperties,
  title: { textAlign: "center", fontWeight: 700, fontSize: 13, letterSpacing: 1.5 } as CSSProperties,
  metaRow: { display: "flex", justifyContent: "space-between", gap: 8 } as CSSProperties,
  metaKey: { color: "#5b6470" } as CSSProperties,
  thead: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#5b6470",
    paddingBottom: 4,
    borderBottom: "1px solid #e3e8ef",
  } as CSSProperties,
  lineBlock: { marginTop: 9 } as CSSProperties,
  lineName: { fontWeight: 600 } as CSSProperties,
  lineOpt: { fontSize: 11, color: "#5b6470", marginTop: 1 } as CSSProperties,
  lineCalc: { display: "flex", justifyContent: "space-between", gap: 10, marginTop: 2, color: "#374151" } as CSSProperties,
  lineAmt: { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" } as CSSProperties,
  kitchenRow: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } as CSSProperties,
  kitchenQty: { fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" } as CSSProperties,
  totalRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 } as CSSProperties,
  totalLabel: { fontWeight: 700, fontSize: 13 } as CSSProperties,
  totalValue: { fontWeight: 700, fontSize: 18, fontVariantNumeric: "tabular-nums" } as CSSProperties,
  payRow: { display: "flex", justifyContent: "space-between", marginTop: 5 } as CSSProperties,
  footer: { textAlign: "center", marginTop: 4, color: "#374151" } as CSSProperties,
  stamp: { textAlign: "center", marginTop: 8, fontSize: 11, fontStyle: "italic", color: "#9aa3b0" } as CSSProperties,
};

type ReceiptStore = { name: string; address: string; footer: string };

type ReceiptDocumentProps = {
  variant: "ticket" | "kitchen" | "receipt";
  doc: PrintTicket | PrintReceipt;
  store: ReceiptStore;
};

const VARIANT_TITLE: Record<ReceiptDocumentProps["variant"], string> = {
  ticket: "PHIẾU TẠM TÍNH",
  kitchen: "PHIẾU GỬI BẾP",
  receipt: "HOÁ ĐƠN THANH TOÁN",
};

export const ReceiptDocument = forwardRef<HTMLDivElement, ReceiptDocumentProps>(({ variant, doc, store }, ref) => {
  const isReceipt = variant === "receipt";
  const isKitchen = variant === "kitchen";
  const receipt = isReceipt ? (doc as PrintReceipt) : null;
  const location = doc.orderType === "takeaway" ? "Mang đi" : doc.tableName ? `Bàn ${doc.tableName}` : "Tại bàn";

  return (
    <div ref={ref} style={s.paper}>
      <div style={s.center}>
        <div style={s.storeName}>{store.name}</div>
        {store.address ? <div style={s.addr}>{store.address}</div> : null}
      </div>

      <div style={s.divider} />
      <div style={s.title}>{VARIANT_TITLE[variant]}</div>
      <div style={{ ...s.divider, marginTop: 8 }} />

      <div style={s.metaRow}>
        <span style={s.metaKey}>Đơn</span>
        <span>#{doc.orderNo}</span>
      </div>
      <div style={s.metaRow}>
        <span style={s.metaKey}>Loại</span>
        <span>{location}</span>
      </div>
      <div style={s.metaRow}>
        <span style={s.metaKey}>{isReceipt ? "Thanh toán" : "Thời gian"}</span>
        <span>{formatDateTime(receipt?.paidAt ?? null)}</span>
      </div>

      <div style={{ ...s.divider, marginBottom: 6 }} />
      <div style={s.thead}>
        <span>Món</span>
        <span>{isKitchen ? "SL" : "Thành tiền"}</span>
      </div>

      {doc.lines.map((line, index) =>
        isKitchen ? (
          <div key={`${line.name}-${index}`} style={s.lineBlock}>
            <div style={s.kitchenRow}>
              <div style={s.lineName}>{line.name}</div>
              <div style={s.kitchenQty}>×{line.quantity}</div>
            </div>
            {line.options.length ? <div style={s.lineOpt}>{line.options.join(" · ")}</div> : null}
          </div>
        ) : (
          <div key={`${line.name}-${index}`} style={s.lineBlock}>
            <div style={s.lineName}>{line.name}</div>
            {line.options.length ? <div style={s.lineOpt}>{line.options.join(" · ")}</div> : null}
            <div style={s.lineCalc}>
              <span>
                {line.quantity} × {formatPlain(line.unitPrice)}
              </span>
              <span style={s.lineAmt}>{formatPlain(line.unitPrice * line.quantity)}</span>
            </div>
          </div>
        ),
      )}

      {isKitchen ? null : (
        <>
          <div style={s.divider} />
          <div style={s.totalRow}>
            <span style={s.totalLabel}>TỔNG CỘNG</span>
            <span style={s.totalValue}>{formatVnd(doc.total)}</span>
          </div>
        </>
      )}

      {receipt ? (
        <>
          <div style={{ ...s.divider, margin: "8px 0" }} />
          <div style={s.payRow}>
            <span style={s.metaKey}>Tiền mặt khách đưa</span>
            <span style={s.lineAmt}>{formatVnd(receipt.receivedAmount)}</span>
          </div>
          <div style={s.payRow}>
            <span style={s.metaKey}>Tiền thối lại</span>
            <span style={s.lineAmt}>{formatVnd(receipt.changeAmount)}</span>
          </div>
        </>
      ) : null}

      <div style={s.divider} />
      {isKitchen ? null : <div style={s.footer}>{store.footer}</div>}
      {isReceipt ? null : (
        <div style={s.stamp}>
          {isKitchen ? "(Phiếu gửi bếp — báo chế biến)" : "(Phiếu tạm tính — chưa thanh toán)"}
        </div>
      )}
    </div>
  );
});
ReceiptDocument.displayName = "ReceiptDocument";

// ---- Popup wrapper (in-app print simulation) ---------------------------------

export function ReceiptPreviewPopup() {
  const preview = useAppStore((state) => state.receiptPreview);
  const close = useAppStore((state) => state.closeReceiptPreview);
  const settings = useStoreSettingsQuery().data;
  const docRef = useRef<HTMLDivElement>(null);

  if (!preview) return null;

  const store: ReceiptStore = {
    name: settings?.displayName ?? "Cửa hàng",
    address: settings?.address ?? "",
    footer: settings?.billFooter || "Cảm ơn quý khách!",
  };

  return (
    <PortalPopup
      testId="receipt-preview"
      placement="Centered"
      overlayColor="rgba(15,23,42,0.45)"
      onOutsideClick={close}
      zIndex={60}
      contentClassName="flex max-h-[92vh] w-[360px] flex-col overflow-hidden rounded-pos bg-pos-surface shadow-2xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-pos-line px-4 py-3">
        <div className="text-sm font-extrabold text-pos-ink">
          {preview.variant === "receipt"
            ? "Hoá đơn thanh toán"
            : preview.variant === "kitchen"
              ? "Phiếu gửi bếp"
              : "Phiếu tạm tính"}
        </div>
        <button
          type="button"
          aria-label="Đóng"
          onClick={close}
          className="grid h-8 w-8 place-items-center rounded-[8px] border border-pos-line bg-white text-pos-muted hover:border-pos-primary hover:text-pos-primary"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[#eef2f6] p-4">
        <div className="mx-auto w-fit shadow-[0_8px_24px_-12px_rgba(15,23,42,0.4)]">
          <ReceiptDocument ref={docRef} variant={preview.variant} doc={preview.doc} store={store} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-pos-line px-4 py-3">
        <button
          type="button"
          onClick={close}
          className="inline-flex h-9 items-center rounded-[9px] border border-pos-line bg-white px-4 text-sm font-bold text-pos-ink hover:border-pos-primary"
        >
          Đóng
        </button>
        <button
          type="button"
          data-testid="receipt-print-button"
          onClick={() => docRef.current && printDocElement(docRef.current)}
          className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-pos-primary px-4 text-sm font-bold text-white hover:brightness-110"
        >
          <Printer size={15} /> In
        </button>
      </div>
    </PortalPopup>
  );
}
