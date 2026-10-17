import { describe, expect, it, vi } from "vitest";
import { ReceiptPrintClick } from "./receiptPrintClick";

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
function setup() {
  let eligible = true;
  let mark!: () => boolean;
  const cancel = vi.fn(), authorize = vi.fn(async (_id: string) => {}), sent = vi.fn(), failed = vi.fn();
  const dispatch = vi.fn((_current: () => boolean, callback: () => boolean) => { mark = callback; return cancel; });
  const click = new ReceiptPrintClick({ eligible: () => eligible, authorize, dispatch, changed: vi.fn(), sent, failed });
  return { click, authorize, dispatch, cancel, sent, failed, mark: () => mark(), deny: () => { eligible = false; click.invalidate(); }, allow: () => { eligible = true; } };
}
describe("receipt click authorization", () => {
  it("coalesces clicks, marks dispatch once and authorizes a new click after browser Cancel", async () => {
    const s = setup(), ack = deferred(); s.authorize.mockReturnValueOnce(ack.promise);
    const first = s.click.click(); await s.click.click(); expect(s.authorize).toHaveBeenCalledTimes(1);
    ack.resolve(); await first; await s.click.click(); expect(s.dispatch).toHaveBeenCalledTimes(1);
    expect(s.mark()).toBe(true); expect(s.mark()).toBe(false); expect(s.sent).toHaveBeenCalledTimes(1);
    await s.click.click(); expect(s.authorize).toHaveBeenCalledTimes(2);
    expect(s.authorize.mock.calls[1][0]).not.toBe(s.authorize.mock.calls[0][0]);
  });
  it("keeps correlation ID on explicit retry after lost authorization ACK", async () => {
    const s = setup(); s.authorize.mockRejectedValueOnce(new Error("lost ACK"));
    await s.click.click(); expect(s.dispatch).not.toHaveBeenCalled();
    await s.click.click(); expect(s.authorize.mock.calls[1][0]).toBe(s.authorize.mock.calls[0][0]);
    expect(s.dispatch).toHaveBeenCalledTimes(1);
  });
  it("discards a late ACK across revoke/regrant and requires another deliberate click", async () => {
    const s = setup(), ack = deferred(); s.authorize.mockReturnValueOnce(ack.promise);
    const first = s.click.click(); s.deny(); s.allow(); ack.resolve(); await first;
    expect(s.dispatch).not.toHaveBeenCalled(); await s.click.click(); expect(s.dispatch).toHaveBeenCalledTimes(1);
    expect(s.authorize.mock.calls[1][0]).not.toBe(s.authorize.mock.calls[0][0]);
  });
  it("cancels a pending browser dispatch and never revives its callback", async () => {
    const s = setup(); await s.click.click(); s.deny(); s.allow();
    expect(s.cancel).toHaveBeenCalledTimes(1); expect(s.mark()).toBe(false); expect(s.sent).not.toHaveBeenCalled();
  });
});
