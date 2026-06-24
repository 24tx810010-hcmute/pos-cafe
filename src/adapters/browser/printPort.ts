import type { IPrintPort } from "@/ports";
import type { PrintReceipt, PrintTicket } from "@/domain";

/**
 * UI-only print phase: the receipt preview is rendered in-app via
 * `ReceiptPreviewPopup` (PortalPopup), driven from the order/payment result.
 *
 * This device port is intentionally a no-op — it is the seam where a real
 * ESC/POS / native print adapter plugs in later. It must NOT open a browser
 * window here (that produced a duplicate popup window on every submit/pay).
 */
export class BrowserPrintPort implements IPrintPort {
  async renderOrderTicket(_ticket: PrintTicket): Promise<void> {
    // no-op (preview handled in-app)
  }

  async renderReceipt(_receipt: PrintReceipt): Promise<void> {
    // no-op (preview handled in-app)
  }
}
