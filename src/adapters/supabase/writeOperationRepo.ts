import type { BusinessError, OperationView, WriteCapabilities, WriteOperationFilter, WriteOperationPage, WritePayloadV1 } from "@/domain";
import type { IWriteOperationRepo } from "@/ports";
import { AppError } from "@/core/appError";
import { writeError } from "@/core/writeErrors";
import { isWriteUuid, validateWritePayload } from "@/core/writePayload";
import { mapSupabaseError } from "./errors";
import type { SupabaseAnyClient } from "./repoShared";

type Envelope<T> = { ok: true; operation: T } | { ok: false; error: BusinessError };
export class SupabaseWriteOperationRepo implements IWriteOperationRepo {
  constructor(private readonly client: SupabaseAnyClient) {}
  async capabilities(): Promise<WriteCapabilities> {
    const { data, error } = await this.client.rpc("get_write_capabilities");
    if (error) throw mapSupabaseError(error, "WRITE_PROTOCOL_UNSUPPORTED");
    if (data?.ok === false) throw new AppError(data.error.code, data.error.message, data.error.details);
    if (data?.writeProtocolVersion !== 1 || data?.maxPayloadBytes !== 262144 || data?.pendingTtlSeconds !== 86400) throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
    return data as WriteCapabilities;
  }
  private async operation(name: string, operationId: string, payload?: WritePayloadV1): Promise<OperationView> {
    if (!isWriteUuid(operationId)) throw writeError("INVALID_WRITE_REQUEST");
    if (payload !== undefined) validateWritePayload(payload);
    const args = { p_operation_id: operationId, ...(payload === undefined ? {} : { p_payload: payload }) };
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw mapSupabaseError(error, "WRITE_TEMPORARILY_UNAVAILABLE");
    const envelope = data as Envelope<OperationView> | null;
    if (!envelope || typeof envelope.ok !== "boolean") throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
    if (!envelope.ok) throw new AppError(envelope.error.code, envelope.error.message, envelope.error.details);
    if (envelope.operation?.schemaVersion !== 1 || typeof envelope.operation.operationId !== "string" || envelope.operation.operationId.toLowerCase() !== operationId.toLowerCase()) throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
    return envelope.operation;
  }
  register(id: string, payload: WritePayloadV1): Promise<OperationView> { return this.operation("register_write_operation", id, payload); }
  execute(id: string, payload: WritePayloadV1): Promise<OperationView> { return this.operation("execute_write_operation", id, payload); }
  get(id: string): Promise<OperationView> { return this.operation("get_write_operation", id); }
  cancel(id: string): Promise<OperationView> { return this.operation("cancel_write_operation", id); }
  async list(filter: WriteOperationFilter = {}): Promise<WriteOperationPage> {
    const { data, error } = await this.client.rpc("list_write_operations", {
      p_order_id: filter.orderId ?? null, p_kinds: filter.kinds ?? null, p_statuses: filter.statuses ?? null,
      p_registered_from: filter.registeredFrom ?? null, p_registered_to: filter.registeredTo ?? null,
      p_cursor: filter.cursor ?? null, p_limit: filter.limit ?? 50,
    });
    if (error) throw mapSupabaseError(error, "WRITE_TEMPORARILY_UNAVAILABLE");
    if (data?.ok === false) throw new AppError(data.error.code, data.error.message, data.error.details);
    if (data?.ok !== true || !Array.isArray(data.page?.items)) throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
    return data.page as WriteOperationPage;
  }
}
