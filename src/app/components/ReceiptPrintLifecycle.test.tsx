import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import toast from "react-hot-toast";
import { AppError } from "@/core/appError";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import { PortsContext } from "@/features/shared/portsContext";
import { ReceiptPreviewPopup } from "./ReceiptPreview";
import { useAppStore, type ReceiptPreview } from "../useAppStore";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); vi.restoreAllMocks();
  useAppStore.setState({ currentEmployee: null, drawer: null, receiptPreview: null });
});
function fixture() {
  const state = createSeededMockState(); state.session = { storeId: state.settings.storeId, storeNo: 1 };
  const ports = createMockPorts(state); const employee = state.employees[0];
  const preview: ReceiptPreview = { variant: "receipt", orderId: state.orders[0].id,
    doc: { orderNo: 7, orderType: "takeaway", tableName: null, total: 80000, receivedAmount: 100000, changeAmount: 20000,
      paidAt: "2026-09-10T00:00:00Z", lines: [{ name: "Cà phê", quantity: 2, unitPrice: 40000, options: ["Q × 2"] }] } };
  useAppStore.setState({ currentEmployee: employee, drawer: "orderHistory", receiptPreview: preview });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  let resolve!: () => void; let reject!: (error: unknown) => void;
  const receipt = vi.spyOn(ports.order, "getReceipt").mockImplementation(() => new Promise((done, fail) => {
    resolve = () => done({ receipt: { schemaVersion: 1, orderId: state.orders[0].id, paymentId: crypto.randomUUID(),
      orderNo: 7, businessDate: "2026-09-10", storeName: "Quán", address: "", footer: "", tableName: null,
      paidAt: "2026-09-10T00:00:00Z", employeeName: employee.name, lines: [], total: 80000, receivedAmount: 100000, changeAmount: 20000 }, legacyMetadata: true }); reject = fail;
  }));
  const print = vi.fn(); const append = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
    const result = append(node);
    if (node instanceof HTMLIFrameElement && node.contentWindow) {
      vi.spyOn(node.contentWindow, "print").mockImplementation(print);
      vi.spyOn(node.contentWindow, "focus").mockImplementation(() => {});
    }
    return result;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const view = render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><ReceiptPreviewPopup /></QueryClientProvider></PortsContext.Provider>);
  vi.useFakeTimers();
  return { view, preview, employee, receipt, print, resolve: () => resolve(), reject: (error: unknown) => reject(error) };
}

for (const stage of ["read", "timer"] as const) for (const transition of ["offline", "close_reopen", "lock", "same_employee", "unmount"] as const) {
  test(`TC-IDEM-051/core/print=${stage}/transition=${transition} invalidates the old print before its side effect`, async () => {
    const f = fixture(); fireEvent.click(screen.getByTestId("receipt-print-button")); expect(f.receipt).toHaveBeenCalledTimes(1);
    if (stage === "timer") { await act(async () => f.resolve()); expect(document.querySelectorAll("iframe")).toHaveLength(1); }
    act(() => {
      if (transition === "offline") {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false); window.dispatchEvent(new Event("offline"));
        // Coming back online never revives a request that was invalidated.
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(true); window.dispatchEvent(new Event("online"));
      } else if (transition === "close_reopen") {
        useAppStore.getState().closeReceiptPreview(); useAppStore.getState().openReceiptPreview(f.preview);
      } else if (transition === "lock") useAppStore.getState().setCurrentEmployee(null);
      else if (transition === "same_employee") useAppStore.getState().setCurrentEmployee(f.employee);
      else f.view.unmount();
    });
    if (stage === "read") await act(async () => f.resolve());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(f.print).not.toHaveBeenCalled(); expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });
}
test("TC-IDEM-051/core/print=positive a current authorized click prints exactly once", async () => {
  const f = fixture(); expect(f.print).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("receipt-print-button")); await act(async () => f.resolve());
  await act(async () => { await vi.advanceTimersByTimeAsync(199); }); expect(f.print).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); }); expect(f.print).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(800); }); expect(document.querySelectorAll("iframe")).toHaveLength(0);
});
test("TC-IDEM-051/core/print=late_error a denial from a closed preview does not notify its replacement", async () => {
  const f = fixture(); const error = vi.spyOn(toast, "error");
  fireEvent.click(screen.getByTestId("receipt-print-button"));
  act(() => useAppStore.getState().closeReceiptPreview());
  await act(async () => f.reject(new AppError("FORBIDDEN", "Không có quyền")));
  expect(error).not.toHaveBeenCalled(); expect(f.print).not.toHaveBeenCalled();
});
