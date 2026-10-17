import type { BusinessError, OperationView, WriteCapabilities, WriteOperationFilter, WriteOperationPage, WritePayloadV1 } from "@/domain";
import type { InitialReceiptExecutionResult, IWriteOperationRepo } from "@/ports";
import { AppError } from "@/core/appError";
import { writeError } from "@/core/writeErrors";
import { isWriteUuid, validateWritePayload } from "@/core/writePayload";
import { mapSupabaseError } from "./errors";
import type { SupabaseAnyClient } from "./repoShared";

type Envelope<T> = { ok: true; operation: T } | { ok: false; error: BusinessError };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class SupabaseWriteOperationRepo implements IWriteOperationRepo {
  constructor(private readonly client: SupabaseAnyClient, private readonly permissionContractRequired = false) {}
  async capabilities(): Promise<WriteCapabilities> {
    const { data, error } = await this.client.rpc("get_write_capabilities");
    if (error) throw mapSupabaseError(error, "WRITE_PROTOCOL_UNSUPPORTED");
    if (data?.ok === false) throw new AppError(data.error.code, data.error.message, data.error.details);
    if (data?.writeProtocolVersion !== 1 || data?.maxPayloadBytes !== 262144 || data?.pendingTtlSeconds !== 86400) throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
    if (this.permissionContractRequired && data.permissionContractVersion !== 2) throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
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
  async executeForInitialReceipt(id: string, payload: WritePayloadV1, input: { grantId: string }): Promise<InitialReceiptExecutionResult> {
    if (!isWriteUuid(id) || !UUID.test(input.grantId)) throw writeError("INVALID_WRITE_REQUEST");
    validateWritePayload(payload);
    if (payload.kind !== "pay_order" && payload.kind !== "pay_order_items") throw writeError("INVALID_WRITE_REQUEST");
    const grantId=input.grantId.toLowerCase();
    const {data,error}=await this.client.rpc("execute_write_operation",{p_operation_id:id,p_payload:payload,p_print_grant_id:grantId});
    if(error)throw mapSupabaseError(error,"WRITE_TEMPORARILY_UNAVAILABLE");
    const envelope=data as (Envelope<OperationView>&{initialReceiptPrintGrant?:unknown})|null;
    if(!envelope||typeof envelope.ok!=="boolean")throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
    if(!envelope.ok)throw new AppError(envelope.error.code,envelope.error.message,envelope.error.details);
    const operation=envelope.operation;
    if(operation?.schemaVersion!==1||typeof operation.operationId!=="string"||operation.operationId.toLowerCase()!==id.toLowerCase())throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
    if(envelope.initialReceiptPrintGrant===undefined)return{operation};
    const grant=envelope.initialReceiptPrintGrant as Record<string,unknown>;
    if(!grant||Object.keys(grant).some(key=>!['grantId','orderId'].includes(key))||typeof grant.grantId!=="string"||grant.grantId.toLowerCase()!==grantId||typeof grant.orderId!=="string"||!UUID.test(grant.orderId))throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
    return{operation,initialReceiptPrintGrant:{grantId,orderId:grant.orderId.toLowerCase()}};
  }
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
