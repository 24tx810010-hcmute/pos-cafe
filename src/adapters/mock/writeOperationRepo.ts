import type { OperationView, WriteCapabilities, WriteOperationFilter, WriteOperationPage, WritePayloadV1 } from "@/domain";
import type { IWriteOperationRepo } from "@/ports";
import { isAppError } from "@/core/appError";
import { hasPermission } from "@/core/guards";
import { isWriteUuid, jsonbText, sameWritePayload, validateWritePayload, writePermission } from "@/core/writePayload";
import { businessError, writeError } from "@/core/writeErrors";
import { clone, type MockState } from "./mockState";
import { applyMockWrite } from "./writeBusiness";
import { mockActor, mockWriteState, type MockEmployeeCredential } from "./writeState";

const queues = new WeakMap<MockState, Promise<void>>();
const serialized = async <T>(state: MockState, fn: () => T | Promise<T>): Promise<T> => {
  const previous = queues.get(state) ?? Promise.resolve();
  let release!: () => void;
  queues.set(state, new Promise<void>(resolve => { release = resolve; }));
  await previous;
  try { return await fn(); } finally { release(); }
};

export class MockWriteOperationRepo implements IWriteOperationRepo {
  constructor(private readonly state: MockState, private readonly credential: MockEmployeeCredential) {}
  async capabilities(): Promise<WriteCapabilities> {
    mockActor(this.state, this.credential);
    return { writeProtocolVersion: 1, maxPayloadBytes: 262144, pendingTtlSeconds: 86400 };
  }
  private key(id: string): string { return `${this.state.session!.storeId}:${id}`; }
  private lookup(id: string): OperationView {
    mockActor(this.state, this.credential);
    if (!isWriteUuid(id)) throw writeError("INVALID_WRITE_REQUEST");
    const op = mockWriteState(this.state).operations[this.key(id)];
    if (!op) throw writeError("OPERATION_NOT_FOUND");
    mockActor(this.state, this.credential, op.payload);
    return op;
  }
  private expire(op: OperationView): void {
    const now = mockWriteState(this.state).now();
    if (op.status === "pending" && now >= Date.parse(op.expiresAt)) {
      op.status = "expired"; op.decidedAt = new Date(now).toISOString(); op.error = businessError("OPERATION_EXPIRED");
    }
  }
  async register(id: string, payload: WritePayloadV1): Promise<OperationView> {
    return serialized(this.state, () => {
      const actor = mockActor(this.state, this.credential);
      if (!isWriteUuid(id)) throw writeError("INVALID_WRITE_REQUEST");
      validateWritePayload(payload);
      const writes = mockWriteState(this.state);
      const existing = writes.operations[this.key(id)];
      if (existing) {
        mockActor(this.state, this.credential, existing.payload);
        if (!sameWritePayload(existing.payload, payload)) throw writeError("IDEMPOTENCY_KEY_REUSED");
        this.expire(existing);
        return clone(existing);
      }
      mockActor(this.state, this.credential, payload);
      const now = writes.now();
      const op: OperationView = {
        operationId: id, schemaVersion: 1, kind: payload.kind, action: payload.kind === "submit_order_changes" ? payload.action : null,
        status: "pending", payload: clone(payload), registeredAt: new Date(now).toISOString(), expiresAt: new Date(now + 86400000).toISOString(),
        initiatedByEmployeeId: actor.id, decidedAt: null, executedByEmployeeId: null, cancelledByEmployeeId: null, result: null, error: null, replayCount: "0",
      };
      writes.operations[this.key(id)] = op;
      return clone(op);
    });
  }
  async execute(id: string, payload: WritePayloadV1): Promise<OperationView> {
    return serialized(this.state, () => {
      mockActor(this.state, this.credential);
      validateWritePayload(payload);
      const op = this.lookup(id);
      if (!sameWritePayload(op.payload, payload)) throw writeError("IDEMPOTENCY_KEY_REUSED");
      if (op.status !== "pending") {
        op.replayCount = (BigInt(op.replayCount) + 1n).toString();
        return clone(op);
      }
      const writes = mockWriteState(this.state);
      const actor = mockActor(this.state, this.credential, op.payload);
      const transaction = clone(this.state);
      const txWrites = { ...writes, removedItems: clone(writes.removedItems) };
      const beforeVersion = transaction.orders.find(o => o.id === payload.orderId)?.lockVersion ?? null;
      let result: ReturnType<typeof applyMockWrite> | null = null;
      let rejection: OperationView["error"] = null;
      try { result = applyMockWrite(transaction, txWrites, payload, actor, new Date(writes.now()).toISOString()); }
      catch (error) {
        const businessCodes = ["NOT_FOUND", "ORDER_VERSION_CONFLICT", "TABLE_OCCUPIED", "TABLE_NOT_FOUND", "ENTITY_ID_CONFLICT", "MENU_ITEM_UNAVAILABLE", "OPTION_VALUE_UNAVAILABLE", "INVALID_ORDER_ITEMS", "INVALID_WRITE_REQUEST", "PAYMENT_AMOUNT_TOO_LOW", "VOID_REASON_REQUIRED", "PRICE_CHANGED"];
        if (!isAppError(error) || !businessCodes.includes(error.code)) throw error;
        rejection = businessError(error.code as import("@/domain").WriteErrorCode, error.cause as Record<string, unknown> | null ?? null);
      }
      // Check real clock again after all validation and before touching shared state.
      writes.beforeCheckpoint?.();
      mockActor(this.state, this.credential, op.payload);
      this.expire(op);
      if (op.status !== "pending") return clone(op);
      if (rejection) {
        op.status = "rejected"; op.error = rejection; op.decidedAt = new Date(writes.now()).toISOString();
        return clone(op);
      }
      writes.fault?.("after_business");
      const r = result!;
      const resultOrder = r.kind === "pay_order_items" ? r.paidOrder : r.order;
      const event = { operationId: id, sourceOrderId: payload.orderId, resultOrderId: r.kind === "pay_order_items" ? r.paidOrder.id : resultOrder.id, paymentId: "payment" in r ? r.payment.id : null, initiatedBy: op.initiatedByEmployeeId, executedBy: actor.id, occurredAt: new Date(writes.now()).toISOString(), beforeVersion, afterVersion: r.kind === "pay_order_items" ? r.sourceOrder.lockVersion : resultOrder.lockVersion };
      writes.fault?.("before_commit");
      this.state.orders = transaction.orders; this.state.floorPlan = transaction.floorPlan;
      writes.removedItems = txWrites.removedItems; writes.events.push(event);
      op.result = clone(r); op.status = "applied"; op.executedByEmployeeId = actor.id; op.decidedAt = event.occurredAt;
      return clone(op);
    });
  }
  async get(id: string): Promise<OperationView> {
    return serialized(this.state, () => { const op = this.lookup(id); this.expire(op); return clone(op); });
  }
  async cancel(id: string): Promise<OperationView> {
    return serialized(this.state, () => {
      const op = this.lookup(id); this.expire(op);
      if (op.status === "pending") { op.status = "cancelled"; op.cancelledByEmployeeId = mockActor(this.state, this.credential, op.payload).id; op.decidedAt = new Date(mockWriteState(this.state).now()).toISOString(); op.error = businessError("OPERATION_CANCELLED"); }
      return clone(op);
    });
  }
  async list(filter: WriteOperationFilter = {}): Promise<WriteOperationPage> {
    return serialized(this.state, async () => {
      const actor = mockActor(this.state, this.credential);
      const writes = mockWriteState(this.state);
      const limit = filter.limit ?? 50;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || filter.orderId !== undefined && !isWriteUuid(filter.orderId) || (filter.cursor?.length ?? 0) > 512) throw writeError("INVALID_WRITE_REQUEST");
      if (filter.kinds?.some(k => !["submit_order_changes", "pay_order", "pay_order_items", "void_order"].includes(k)) || filter.statuses?.some(s => !["pending", "applied", "rejected", "cancelled", "expired"].includes(s))) throw writeError("INVALID_WRITE_REQUEST");
      if ([filter.registeredFrom, filter.registeredTo].some(t => t !== undefined && !Number.isFinite(Date.parse(t))) || filter.registeredFrom && filter.registeredTo && Date.parse(filter.registeredFrom) > Date.parse(filter.registeredTo)) throw writeError("INVALID_WRITE_REQUEST");
      const { cursor: _cursor, limit: _limit, ...criteria } = filter;
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jsonbText({ storeId: this.state.session!.storeId, ...criteria })));
      const binding = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,"0")).join("");
      mockActor(this.state, this.credential);
      let cursor: { binding: string; at: string; id: string } | null = null;
      if (filter.cursor) {
        try { cursor = JSON.parse(atob(filter.cursor)); } catch { throw writeError("INVALID_WRITE_REQUEST"); }
        if (!cursor || cursor.binding !== binding || !isWriteUuid(cursor.id) || !Number.isFinite(Date.parse(cursor.at))) throw writeError("INVALID_WRITE_REQUEST");
      }
      const items = Object.entries(writes.operations).filter(([key]) => key.startsWith(`${this.state.session!.storeId}:`)).map(([,op]) => op).filter(op => hasPermission(actor, writePermission(op.payload)));
      for (const op of items) this.expire(op);
      const sorted = items.filter(op => (!filter.orderId || op.payload.orderId === filter.orderId) && (!filter.kinds || filter.kinds.includes(op.kind)) && (!filter.statuses || filter.statuses.includes(op.status)) && (!filter.registeredFrom || Date.parse(op.registeredAt) >= Date.parse(filter.registeredFrom)) && (!filter.registeredTo || Date.parse(op.registeredAt) <= Date.parse(filter.registeredTo)) && (!cursor || op.registeredAt < cursor.at || op.registeredAt === cursor.at && op.operationId < cursor.id)).sort((a, b) => b.registeredAt.localeCompare(a.registeredAt) || b.operationId.localeCompare(a.operationId));
      const page = sorted.slice(0, limit); const last = page[page.length - 1];
      return { items: clone(page), nextCursor: sorted.length > limit ? btoa(JSON.stringify({ binding, at: last.registeredAt, id: last.operationId })) : null, serverTime: new Date(writes.now()).toISOString() };
    });
  }
}
