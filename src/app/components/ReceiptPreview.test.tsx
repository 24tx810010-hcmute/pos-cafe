import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderDetail, ReceiptSnapshot } from "@/domain";
import { receiptToPrint } from "@/features/pos/orderFlow";
import { ReceiptDocument, receiptFromOrderDetail, ticketFromOrderDetail } from "./ReceiptPreview";

const snapshot: ReceiptSnapshot = { schemaVersion: 1, orderId: "00000000-0000-4000-8000-000000000001", paymentId: "00000000-0000-4000-8000-000000000002",
  orderNo: 7, businessDate: "2026-09-10", storeName: "Quán lúc thu tiền", address: "Địa chỉ cũ", footer: "Lời chào đã lưu", tableName: "Bàn A", paidAt: "2026-09-10T09:00:00.000Z", employeeName: "Thu ngân B",
  lines: [{ orderItemId: "00000000-0000-4000-8000-000000000003", menuItemId: "00000000-0000-4000-8000-000000000004", name: "Cà phê cũ", quantity: 2, baseUnitPrice: 30_000,
    options: [{ optionValueId: "00000000-0000-4000-8000-000000000005", name: "Q cũ", priceDelta: 5_000, quantity: 2 }], unitTotal: 40_000, lineTotal: 80_000, note: "ít đá" }], total: 80_000, receivedAmount: 100_000, changeAmount: 20_000 };
afterEach(cleanup);

describe("immutable receipt rendering", () => {
  it("TC-IDEM-050/core prints 2 × 40000 from the original option quantity and original metadata", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const doc = receiptToPrint(snapshot, "dine_in");
    expect(doc.lines).toEqual([{ name: "Cà phê cũ", quantity: 2, unitPrice: 40_000, options: ["Q cũ × 2", "Ghi chú: ít đá"] }]);
    render(<ReceiptDocument variant="receipt" doc={doc} store={{ name: "Quán đã đổi", address: "Địa chỉ mới", footer: "Lời chào mới" }} />);
    const paper = screen.getByTestId("receipt-document");
    expect(paper).toHaveAttribute("data-total", "80000");
    expect(paper).toHaveAttribute("data-received-amount", "100000");
    expect(paper).toHaveAttribute("data-change-amount", "20000");
    expect(paper).toHaveTextContent("2 × 40.000");
    expect(paper).toHaveTextContent("Q cũ × 2");
    expect(paper).toHaveTextContent("Quán lúc thu tiền");
    expect(paper).toHaveTextContent("Thu ngân B");
    expect(paper).not.toHaveTextContent("Quán đã đổi");
    expect(print).not.toHaveBeenCalled();
    print.mockRestore();
  });
  it("split receipt renders exactly the paid one-item portion", () => {
    const split = { ...snapshot, lines: [{ ...snapshot.lines[0], quantity: 1, lineTotal: 40_000 }], total: 40_000, receivedAmount: 50_000, changeAmount: 10_000 };
    render(<ReceiptDocument variant="receipt" doc={receiptToPrint(split, "dine_in")} store={{ name: "", address: "", footer: "" }} />);
    expect(screen.getByTestId("receipt-document")).toHaveAttribute("data-total", "40000");
    expect(screen.getByTestId("receipt-document")).toHaveAttribute("data-change-amount", "10000");
    expect(screen.getByTestId("receipt-document")).toHaveTextContent("1 × 40.000");
  });
  it("history builder refuses paid-history receipts when the current order is void or open", () => {
    const order = { id: snapshot.orderId, orderNo: 7, orderType: "dine_in", tableId: null, status: "void", total: 80_000,
      receiptSnapshot: snapshot, payment: { receivedAmount: 100_000, changeAmount: 20_000, paidAt: snapshot.paidAt }, items: [] } as unknown as OrderDetail;
    expect(receiptFromOrderDetail(order, null)).toBeNull();
    expect(receiptFromOrderDetail({ ...order, status: "open" }, null)).toBeNull();
    expect(receiptFromOrderDetail({ ...order, status: "paid" }, null)?.snapshot).toEqual(snapshot);
  });
  it("provisional and legacy calculations also multiply option quantity", () => {
    const order = { orderNo: 7, orderType: "takeaway", total: 80_000, items: [{ id: "old", menuItemId: "A", itemName: "Cà phê", quantity: 2, unitPrice: 30_000, options: [{ id: "Q", optionValueId: "Q", optionName: "Q", priceDelta: 5_000, quantity: 2 }] }] } as OrderDetail;
    expect(ticketFromOrderDetail(order, null).lines).toEqual([{ name: "Cà phê", quantity: 2, unitPrice: 40_000, options: ["Q × 2"] }]);
  });
});
