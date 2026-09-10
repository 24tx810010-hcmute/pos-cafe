import { AppError } from "@/core/appError";
import { validateWritePayload } from "@/core/writePayload";
import type { OperationView, WritePayloadV1 } from "@/domain";
import type { IWriteOperationRepo } from "@/ports";

export type ActiveAttempt = {
  operationId: string;
  payload: WritePayloadV1;
  generation: number;
  startedAt: number;
  status: "registering" | "executing" | "unknown" | "settled";
  operation: OperationView | null;
};

export const unknownWrite = () => new AppError("WRITE_RESULT_UNKNOWN", "Chưa xác định kết quả trên server. Hãy tra cứu thao tác trước khi tiếp tục.");
const freeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/** One active confirmation, in memory only. No connectivity event invokes a write. */
export class WriteOperationCoordinator {
  private generation = 0;
  private attempt: ActiveAttempt | null = null;
  private listeners = new Set<() => void>();
  constructor(
    private readonly repo: IWriteOperationRepo,
    private readonly online: () => boolean = () => typeof navigator === "undefined" || navigator.onLine,
    private readonly timeoutMs = 15_000,
  ) {}
  snapshot = () => this.attempt;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(attempt: ActiveAttempt | null) { this.attempt = attempt; this.listeners.forEach((listener) => listener()); }
  private check(generation: number) {
    if (generation !== this.generation || !this.online() || this.attempt?.status === "unknown") throw unknownWrite();
  }
  /** Closing/locking makes late replies inert. It does not cancel the server operation. */
  leave() { this.generation += 1; this.update(null); }
  suspend() {
    this.generation += 1;
    if (this.attempt && this.attempt.status !== "settled") this.update({ ...this.attempt, status: "unknown" });
  }
  private async request<T>(work: () => Promise<T>, generation: number): Promise<T> {
    this.check(generation);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        work(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unknownWrite()), this.timeoutMs); }),
      ]);
      this.check(generation);
      return result;
    } finally { if (timer) clearTimeout(timer); }
  }
  async begin(payload: WritePayloadV1): Promise<{ operation: OperationView; initial: boolean }> {
    if (!this.online() || (this.attempt && this.attempt.status !== "settled")) throw unknownWrite();
    validateWritePayload(payload);
    const generation = ++this.generation;
    const operationId = crypto.randomUUID();
    const immutable = freeze(structuredClone(payload));
    this.update({ operationId, payload: immutable, generation, startedAt: Date.now(), status: "registering", operation: null });
    let registerStarted = false;
    try {
      const capabilities = await this.request(() => this.repo.capabilities(), generation);
      if (capabilities.writeProtocolVersion !== 1) throw new AppError("WRITE_PROTOCOL_UNSUPPORTED", "Phiên bản ứng dụng và server chưa tương thích. Tạm dừng ghi và tải lại ứng dụng.");
      const registered = await this.request(() => { registerStarted = true; return this.repo.register(operationId, immutable); }, generation);
      if (registered.status !== "pending") {
        this.update({ ...this.attempt!, status: "settled", operation: registered });
        return { operation: registered, initial: false };
      }
      this.update({ ...this.attempt!, status: "executing", operation: registered });
      const operation = await this.request(() => this.repo.execute(operationId, immutable), generation);
      this.update({ ...this.attempt!, status: operation.status === "pending" ? "unknown" : "settled", operation });
      return { operation, initial: operation.status === "applied" && operation.replayCount === "0" };
    } catch (error) {
      if (this.attempt?.generation === generation) this.update(registerStarted ? { ...this.attempt, status: "unknown" } : null);
      throw error;
    }
  }
  /** Explicit recovery uses only the exact server payload selected by the operator. */
  async retryCurrent(): Promise<OperationView> {
    const previous = this.attempt;
    if (!previous || previous.status !== "unknown" || !this.online()) throw unknownWrite();
    const generation = ++this.generation;
    this.update({ ...previous, generation, startedAt: Date.now(), status: "executing" });
    try {
      // Lookup first, then explicitly replay even a terminal result. Neither call
      // can register a missing K, rebuild a selection, or trigger receipt printing.
      await this.request(() => this.repo.get(previous.operationId), generation);
      const operation = await this.request(() => this.repo.execute(previous.operationId, previous.payload), generation);
      this.update({ ...this.attempt!, status: operation.status === "pending" ? "unknown" : "settled", operation });
      return operation;
    } catch (error) {
      if (this.attempt?.generation === generation) this.update({ ...this.attempt, status: "unknown" });
      throw error;
    }
  }

  /** Explicit recovery uses only the exact server payload selected by the operator. */
  async resume(stored: OperationView): Promise<OperationView> {
    if (!this.online()) throw unknownWrite();
    const generation = ++this.generation;
    const payload = freeze(structuredClone(stored.payload));
    this.update({ operationId: stored.operationId, payload, generation, startedAt: Date.now(), status: "executing", operation: stored });
    try {
      const current = await this.request(() => this.repo.get(stored.operationId), generation);
      const operation = current.status === "pending"
        ? await this.request(() => this.repo.execute(stored.operationId, payload), generation)
        : current;
      this.update({ ...this.attempt!, status: operation.status === "pending" ? "unknown" : "settled", operation });
      return operation;
    } catch (error) {
      if (this.attempt?.generation === generation) this.update({ ...this.attempt, status: "unknown" });
      throw error;
    }
  }
  async cancel(stored: OperationView): Promise<OperationView> {
    if (!this.online()) throw unknownWrite();
    const generation = ++this.generation;
    this.update({ operationId: stored.operationId, payload: freeze(structuredClone(stored.payload)), generation,
      startedAt: Date.now(), status: "executing", operation: stored });
    try {
      const operation = await this.request(() => this.repo.cancel(stored.operationId), generation);
      this.update({ ...this.attempt!, status: operation.status === "pending" ? "unknown" : "settled", operation });
      return operation;
    } catch (error) {
      if (this.attempt?.generation === generation) this.update({ ...this.attempt, status: "unknown" });
      throw error;
    }
  }
}

const coordinators = new WeakMap<IWriteOperationRepo, WriteOperationCoordinator>();
export const getWriteCoordinator = (repo: IWriteOperationRepo): WriteOperationCoordinator => {
  let coordinator = coordinators.get(repo);
  if (!coordinator) { coordinator = new WriteOperationCoordinator(repo); coordinators.set(repo, coordinator); }
  return coordinator;
};

export const appliedResult = (operation: OperationView) => {
  if (operation.status === "applied" && operation.result) return operation.result;
  if (operation.error) throw new AppError(operation.error.code, operation.error.message, operation.error.details);
  if (operation.status === "expired") throw new AppError("OPERATION_EXPIRED", "Lệnh đã hết hạn thực hiện. Đơn vẫn được giữ; hãy kiểm tra và xác nhận một thao tác mới.");
  if (operation.status === "cancelled") throw new AppError("OPERATION_CANCELLED", "Lệnh đã được hủy trước khi thực hiện.");
  throw unknownWrite();
};
