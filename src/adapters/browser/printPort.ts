
import type { IPrintPort } from "@/ports";
import type { PrintReceipt, PrintTicket } from "@/domain";

export class BrowserPrintPort implements IPrintPort {
  async renderOrderTicket(ticket: PrintTicket): Promise<void> {
    this.renderWindow("Phiếu tạm", this.ticketHtml(ticket));
  }

  async renderReceipt(receipt: PrintReceipt): Promise<void> {
    this.renderWindow("Hóa đơn", this.receiptHtml(receipt));
  }

  private renderWindow(title: string, body: string): void {
    const popup = globalThis.window?.open?.("", "_blank", "width=420,height=640");

    if (!popup) {
      return;
    }

    popup.document.write(`<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`);
    popup.document.close();
  }

  private ticketHtml(ticket: PrintTicket): string {
    return `
      <main style="font-family: sans-serif; padding: 16px;">
        <h1>${ticket.orderType === "takeaway" ? "Mang đi" : `Bàn ${ticket.tableName ?? ""}`}</h1>
        <h2>Đơn #${ticket.orderNo}</h2>
        ${ticket.lines
          .map(
            (line) =>
              `<p><strong>${line.quantity}x ${line.name}</strong><br/>${line.options.join(", ")}</p>`,
          )
          .join("")}
        <hr/>
        <strong>Tổng: ${ticket.total.toLocaleString("vi-VN")}đ</strong>
      </main>
    `;
  }

  private receiptHtml(receipt: PrintReceipt): string {
    return `
      ${this.ticketHtml(receipt)}
      <main style="font-family: sans-serif; padding: 0 16px 16px;">
        <p>Khách đưa: ${receipt.receivedAmount.toLocaleString("vi-VN")}đ</p>
        <p>Tiền thối: ${receipt.changeAmount.toLocaleString("vi-VN")}đ</p>
        <p>${receipt.paidAt}</p>
      </main>
    `;
  }
}
