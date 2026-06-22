import type { IPrintPort } from "@/ports";
import type { PrintReceipt, PrintTicket } from "@/domain";
import type { MockState } from "./mockState";

export class MockPrintPort implements IPrintPort {
  constructor(private readonly state: MockState) {}

  async renderOrderTicket(ticket: PrintTicket): Promise<void> {
    this.state.lastTicket = ticket;
  }

  async renderReceipt(receipt: PrintReceipt): Promise<void> {
    this.state.lastReceipt = receipt;
  }
}
