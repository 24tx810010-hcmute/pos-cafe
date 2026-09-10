import { afterEach, describe, expect, it, vi } from "vitest";
import type { MenuCatalog, OperationView, OrderDetail, SplitWritePayload, WritePayloadV1 } from "@/domain";
import type { IWriteOperationRepo } from "@/ports";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import { WriteOperationCoordinator } from "./writeOperationFlow";
import { addDraftMenuItem, adjustDraftQuantity, buildCartLines, buildPayableLines, fullSelection, getOrderPrimaryAction, isDraftChangedFromOrder, orderDetailToDraft, payOrderAndPrint, payOrderItemsAndPrint, voidPaidOrder } from "./orderFlow";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const payload = (): SplitWritePayload => ({ schemaVersion: 1, kind: "pay_order_items", orderId: id(1), paymentId: id(2),
  expectedVersion: 5, method: "cash", receivedAmount: 30_000, newOrderId: id(3), lines: [{ orderItemId: id(4), quantity: 1, splitItemId: id(5) }] });
const pending = (key = id(6), body: WritePayloadV1 = payload()): OperationView => ({ operationId: key, schemaVersion: 1,
  kind: body.kind, action: null, status: "pending", payload: structuredClone(body), registeredAt: "2026-09-10T00:00:00.000Z", expiresAt: "2026-09-11T00:00:00.000Z",
  initiatedByEmployeeId: id(7), decidedAt: null, executedByEmployeeId: null, cancelledByEmployeeId: null, result: null, error: null, replayCount: "0" });
const repository = () => {
  const repo: IWriteOperationRepo = {
    capabilities: vi.fn(async () => ({ writeProtocolVersion: 1, maxPayloadBytes: 262144, pendingTtlSeconds: 86400 } as const)),
    register: vi.fn(async (key, body) => pending(key, body)),
    execute: vi.fn(async (key, body) => ({ ...pending(key, body), status: "applied" as const })),
    get: vi.fn(async (key) => pending(key)), list: vi.fn(async () => ({ items: [], nextCursor: null, serverTime: "2026-09-10T00:00:00Z" })),
    cancel: vi.fn(async (key) => ({ ...pending(key), status: "cancelled" as const })),
  };
  return repo;
};
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let n = 0; n < 10; n++) await Promise.resolve(); };
afterEach(() => vi.useRealTimers());

describe("immutable online confirmation", () => {
  it.each(["pending", "applied"] as const)("manual retry of %s after lost ACK preserves K and original payload", async (status) => {
    const repo = repository(); const coordinator = new WriteOperationCoordinator(repo);
    vi.mocked(repo.execute).mockRejectedValueOnce(new Error("Response lost"));
    const input = payload();
    await expect(coordinator.begin(input)).rejects.toThrow("Response lost");
    const key = coordinator.snapshot()!.operationId;
    input.expectedVersion = 6; input.lines = []; input.receivedAmount = 120_000;
    vi.mocked(repo.get).mockResolvedValue({ ...pending(key), status });
    vi.mocked(repo.execute).mockResolvedValue({ ...pending(key), status: "applied", replayCount: "1" });
    const result = await coordinator.retryCurrent();
    expect(result).toMatchObject({ status: "applied", replayCount: "1" });
    expect(repo.register).toHaveBeenCalledTimes(1);
    expect(repo.get).toHaveBeenCalledExactlyOnceWith(key);
    expect(repo.execute).toHaveBeenNthCalledWith(2, key, payload());
    expect(coordinator.snapshot()?.status).toBe("settled");
  });

  it("TC-IDEM-044/core keeps the original split version and quantity while the visible order changes", async () => {
    const repo = repository();
    const gate = deferred<OperationView>();
    vi.mocked(repo.register).mockReturnValue(gate.promise);
    const coordinator = new WriteOperationCoordinator(repo);
    const input = payload();
    const result = coordinator.begin(input);
    await flush();
    const key = coordinator.snapshot()!.operationId;
    input.expectedVersion = 6;
    input.lines[0].quantity = 4;
    gate.resolve(pending(key));
    await result;
    expect(repo.execute).toHaveBeenCalledExactlyOnceWith(key, expect.objectContaining({ expectedVersion: 5, kind: "pay_order_items", lines: [{ orderItemId: id(4), quantity: 1, splitItemId: id(5) }] }));
    expect(repo.register).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(coordinator.snapshot()!.payload)).toBe(true);
  });

  it("TC-IDEM-045/core recovery of an original split cannot become a full payment when current selection is empty", async () => {
    const repo = repository();
    const coordinator = new WriteOperationCoordinator(repo);
    const stored = pending();
    await coordinator.resume(stored);
    expect(repo.get).toHaveBeenCalledExactlyOnceWith(id(6));
    expect(repo.register).not.toHaveBeenCalled();
    expect(repo.execute).toHaveBeenCalledExactlyOnceWith(id(6), { schemaVersion: 1, kind: "pay_order_items", orderId: id(1), paymentId: id(2), expectedVersion: 5,
      method: "cash", receivedAmount: 30_000, newOrderId: id(3), lines: [{ orderItemId: id(4), quantity: 1, splitItemId: id(5) }] });
  });

  it("TC-IDEM-053/core late register ACK never starts execute after 15 seconds", async () => {
    vi.useFakeTimers();
    const repo = repository();
    const gate = deferred<OperationView>();
    vi.mocked(repo.register).mockReturnValue(gate.promise);
    const coordinator = new WriteOperationCoordinator(repo);
    const result = coordinator.begin(payload()).catch((error) => error);
    await flush();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await result).toMatchObject({ code: "WRITE_RESULT_UNKNOWN" });
    expect(coordinator.snapshot()?.status).toBe("unknown");
    gate.resolve(pending());
    await flush();
    expect(repo.execute).not.toHaveBeenCalled();
    expect(repo.cancel).not.toHaveBeenCalled();
    await expect(coordinator.begin(payload())).rejects.toMatchObject({ code: "WRITE_RESULT_UNKNOWN" });
    expect(repo.register).toHaveBeenCalledTimes(1);
  });

  it.each(["close", "lock", "offline"])("late register ACK after %s cannot cross a cancelled UI generation", async (reason) => {
    const repo = repository();
    const gate = deferred<OperationView>();
    vi.mocked(repo.register).mockReturnValue(gate.promise);
    const coordinator = new WriteOperationCoordinator(repo);
    const result = coordinator.begin(payload()).catch((error) => error);
    await flush();
    if (reason === "offline") coordinator.suspend(); else coordinator.leave();
    gate.resolve(pending());
    expect(await result).toMatchObject({ code: "WRITE_RESULT_UNKNOWN" });
    expect(repo.execute).not.toHaveBeenCalled();
    expect(repo.cancel).not.toHaveBeenCalled();
  });

  it("TC-IDEM-054/core refuses offline confirmations without a write, outbox, or automatic reconnect work", async () => {
    const repo = repository(); let online = false;
    const coordinator = new WriteOperationCoordinator(repo, () => online);
    await expect(coordinator.begin(payload())).rejects.toMatchObject({ code: "WRITE_RESULT_UNKNOWN" });
    online = true;
    await flush();
    expect(repo.capabilities).not.toHaveBeenCalled();
    expect(repo.register).not.toHaveBeenCalled();
    expect(repo.execute).not.toHaveBeenCalled();
    expect(coordinator.snapshot()).toBeNull();
  });

  it("TC-IDEM-052/core late applied ACK does not turn unknown into UI success", async () => {
    vi.useFakeTimers();
    const repo = repository(); const gate = deferred<OperationView>();
    vi.mocked(repo.execute).mockReturnValue(gate.promise);
    const preview = vi.fn();
    const coordinator = new WriteOperationCoordinator(repo);
    const result = coordinator.begin(payload()).then(preview).catch((error) => error);
    await flush(); await vi.advanceTimersByTimeAsync(15_000);
    expect(await result).toMatchObject({ code: "WRITE_RESULT_UNKNOWN" });
    gate.resolve({ ...pending(), status: "applied" }); await flush();
    expect(preview).not.toHaveBeenCalled();
    expect(repo.execute).toHaveBeenCalledTimes(1);
    expect(coordinator.snapshot()?.status).toBe("unknown");
  });

  it("TC-IDEM-051/core reading a terminal receipt never executes again", async () => {
    const repo = repository(); const done: OperationView = { ...pending(), status: "applied", replayCount: "3" };
    vi.mocked(repo.get).mockResolvedValue(done);
    const coordinator = new WriteOperationCoordinator(repo);
    expect(await coordinator.resume(done)).toEqual(done);
    expect(repo.execute).not.toHaveBeenCalled();
    expect(repo.register).not.toHaveBeenCalled();
  });

  it("TC-IDEM-058/core unknown cancel never reports cancelled or implicitly registers", async () => {
    const repo = repository();
    vi.mocked(repo.cancel).mockRejectedValue(new Error("Server chưa tìm thấy thao tác này."));
    const coordinator = new WriteOperationCoordinator(repo);
    await expect(coordinator.cancel(pending())).rejects.toThrow("Server chưa tìm thấy");
    expect(coordinator.snapshot()?.status).toBe("unknown");
    expect(repo.register).not.toHaveBeenCalled();
  });
});

const menu: MenuCatalog = { categories: [], optionGroups: [], menuItemOptionGroups: [], optionValues: [], menuItems: [{ id: id(20), categoryId: id(21), name: "Cà phê mới", price: 40_000, isAvailable: true, imageAssetKey: null, sortOrder: 1 }] };
const order = (): OrderDetail => ({ id: id(1), orderNo: 7, orderType: "dine_in", tableId: id(22), status: "open", lockVersion: 5, businessDate: "2026-09-10", total: 60_000,
  paidAt: null, payment: null, voidedAt: null, voidedByEmployeeId: null, voidReasonCode: null, voidReasonNote: null,
  items: [{ id: id(4), menuItemId: id(20), itemName: "Cà phê cũ", quantity: 2, unitPrice: 30_000, note: "ít đá", options: [] }] });

describe("server-priced portions in the draft", () => {
  it("TC-IDEM-026/core plus leaves the old 2 × 30k line and adds a distinct 1 × 40k portion", () => {
    const current = order();
    const draft = adjustDraftQuantity(orderDetailToDraft(current), id(4), 1, menu);
    expect(draft[0]).toMatchObject({ id: id(4), sourceItemId: id(4), quantity: 2, quotedBasePrice: 30_000, snapshotName: "Cà phê cũ" });
    expect(draft[1]).toMatchObject({ menuItemId: id(20), quantity: 1, quotedBasePrice: 40_000, snapshotName: "Cà phê mới" });
    expect(draft[1].id).not.toBe(id(4));
    expect(draft[1].sourceItemId).toBeUndefined();
    expect(buildCartLines(menu, draft).map((line) => [line.name, line.quantity, line.total])).toEqual([["Cà phê cũ", 2, 60_000], ["Cà phê mới", 1, 40_000]]);
  });

  it("TC-IDEM-027/core swapping notes on different price sources stays dirty and cannot go directly to payment", () => {
    const current = order(); current.total = 65_000;
    current.items[0].quantity = 1;
    current.items.push({ ...current.items[0], id: id(24), quantity: 1, unitPrice: 35_000, note: null });
    const draft = orderDetailToDraft(current).map((item, index) => ({ ...item, note: index ? "ít đá" : null }));
    expect(isDraftChangedFromOrder(current, draft)).toBe(true);
    expect(getOrderPrimaryAction(current, draft)).toBe("submit");
    expect(draft.map((item) => [item.sourceItemId, item.quotedBasePrice, item.note])).toEqual([[id(4), 30_000, null], [id(24), 35_000, "ít đá"]]);
  });

  it("TC-IDEM-028/core deleting a retained row preserves its source marker with quantity zero", () => {
    const draft = adjustDraftQuantity(orderDetailToDraft(order()), id(4), -2, menu);
    expect(draft).toHaveLength(1);
    expect(draft[0]).toMatchObject({ sourceItemId: id(4), sourceQuantity: 2, quantity: 0, quotedBasePrice: 30_000 });
    expect(buildCartLines(menu, draft)).toEqual([]);
  });

  it("TC-IDEM-031/core equal totals with different components remain separate new portions", () => {
    const first = addDraftMenuItem([], { id: id(20), price: 30_000, name: "Cà phê" }, [{ id: id(30), optionValueId: id(31), quantity: 1, quotedPriceDelta: 5_000 }]);
    const both = addDraftMenuItem(first, { id: id(20), price: 35_000, name: "Cà phê" });
    expect(both).toHaveLength(2);
    expect(buildCartLines(menu, both).map((line) => line.total)).toEqual([35_000, 35_000]);
    expect(both[0].id).not.toBe(both[1].id);
  });
});

const flowFixture = async () => {
  const state = createSeededMockState();
  state.session = { storeId: state.settings.storeId, storeNo: 1 };
  const actor = state.employees.find((employee) => employee.role === "admin")!;
  const ports = createMockPorts(state);
  await ports.employee.startSession(actor.id, state.pins[actor.id]);
  return { state, actor, ports };
};

describe("payment and void confirmation boundaries", () => {
  it("TC-IDEM-042/core resolves full selection to pay_order before registration", async () => {
    const { state, actor, ports } = await flowFixture();
    const source = state.orders.find((candidate) => candidate.status === "open")!;
    const register = vi.spyOn(ports.write, "register");
    const execute = vi.spyOn(ports.write, "execute");
    const legacyFull = vi.spyOn(ports.payment, "payOrder");
    const legacySplit = vi.spyOn(ports.payment, "payOrderItems");
    const paid = await payOrderItemsAndPrint(ports, { actor, order: source, selection: fullSelection(buildPayableLines(source)), receivedAmount: source.total });
    expect(paid).toMatchObject({ mode: "full", status: "paid", changeAmount: 0 });
    expect(register).toHaveBeenCalledTimes(1);
    const [key, body] = register.mock.calls[0];
    expect(body.kind).toBe("pay_order");
    expect(body).not.toHaveProperty("newOrderId");
    expect(body).not.toHaveProperty("lines");
    expect(execute).toHaveBeenCalledExactlyOnceWith(key, body);
    expect(legacyFull).not.toHaveBeenCalled();
    expect(legacySplit).not.toHaveBeenCalled();
  });
  it.each(["absent", "null", "empty", "spaces", "nonblank"] as const)("TC-IDEM-079/core/reason_other=%s", async (variant) => {
    const { state, actor, ports } = await flowFixture();
    const paid = state.orders.find((candidate) => candidate.status === "paid")!;
    const register = vi.spyOn(ports.write, "register");
    const reason = variant === "absent" ? {} : { reasonNote: variant === "null" ? null : variant === "empty" ? "" : variant === "spaces" ? "   " : "Nhập nhầm" };
    const call = voidPaidOrder(ports, { actor, order: paid, reasonCode: "other", ...reason });
    if (variant === "nonblank") {
      expect(await call).toMatchObject({ orderId: paid.id, status: "void", lockVersion: 3 });
      expect(register).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ reason: "other", reasonNote: "Nhập nhầm" }));
    } else {
      await expect(call).rejects.toMatchObject({ code: "VOID_REASON_REQUIRED", message: "Vui lòng chọn lý do hủy và nhập ghi chú nếu chọn lý do khác." });
      expect(register).not.toHaveBeenCalled();
      expect(paid.status).toBe("paid");
    }
  });

  it("TC-IDEM-092/core checks low/exact cash, empty/zero selection and a free line in a positive payment", async () => {
    for (const variant of ["low", "exact", "zero_order", "zero_selection", "mixed_full", "empty"] as const) {
      const { state, actor, ports } = await flowFixture();
      const source = state.orders.find((candidate) => candidate.status === "open")!;
      source.items = [{ ...source.items[0], id: id(60), quantity: 5, unitPrice: 30_000, options: [] }];
      source.total = 150_000;
      if (variant === "zero_order") { source.items[0].quantity = 1; source.items[0].unitPrice = 0; source.total = 0; }
      if (variant === "zero_selection" || variant === "mixed_full") {
        source.items[0].quantity = 1; source.items[0].unitPrice = 0;
        source.items.push({ ...source.items[0], id: id(61), quantity: 1, unitPrice: 20_000 }); source.total = 20_000;
      }
      const register = vi.spyOn(ports.write, "register");
      const beforePayments = state.orders.filter((candidate) => candidate.payment).length;
      const selection = variant === "empty" ? {} : variant === "mixed_full" ? { [id(60)]: 1, [id(61)]: 1 } : { [id(60)]: 1 };
      const call = variant === "zero_order" ? payOrderAndPrint(ports, { actor, order: source, receivedAmount: 0 })
        : payOrderItemsAndPrint(ports, { actor, order: source, receivedAmount: variant === "low" ? 29_999 : variant === "mixed_full" ? 20_000 : 30_000, selection });
      if (variant === "exact" || variant === "mixed_full") {
        expect(await call).toMatchObject({ status: "paid", total: variant === "exact" ? 30_000 : 20_000, changeAmount: 0 });
        expect(register).toHaveBeenCalledTimes(1);
        expect(state.orders.filter((candidate) => candidate.payment)).toHaveLength(beforePayments + 1);
      } else {
        await expect(call).rejects.toMatchObject({ code: variant === "low" ? "PAYMENT_AMOUNT_TOO_LOW" : "INVALID_ORDER_ITEMS" });
        expect(register).not.toHaveBeenCalled();
        expect(state.orders.filter((candidate) => candidate.payment)).toHaveLength(beforePayments);
      }
    }
  });
});
