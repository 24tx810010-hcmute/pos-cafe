import { AppError, type AppErrorCode } from "@/core/appError";
import type { ReceiptSnapshot } from "@/domain";
import type { InitialReceiptPrintAuthorization, IPermissionPrintRepo, PreparedReceiptReprint } from "@/ports/permissionPrint";
import { employeeCredential } from "./employeeCredential";
import { mapSupabaseError } from "./errors";
import type { SupabaseAnyClient } from "./repoShared";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): Record<string, unknown> => {
  if (!isRecord(value) || Object.keys(value).some(key => !keys.includes(key))) throw unavailable(); return value;
};
const string = (value: unknown): string => { if (typeof value !== "string") throw unavailable(); return value; };
const integer = (value: unknown): number => { if (!Number.isSafeInteger(value) || (value as number) < 0) throw unavailable(); return value as number; };
const nullableString = (value: unknown): string | null => value === null ? null : string(value);
const unavailable = () => new AppError("PERMISSION_UPDATE_UNAVAILABLE", "Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại.");
const messages: Partial<Record<AppErrorCode, string>> = {
  AUTH_REQUIRED: "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.", EMPLOYEE_SESSION_REQUIRED: "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.", RECEIPT_UNAVAILABLE: "Không thể in hóa đơn này. Đơn chưa thanh toán hoặc đã bị hủy.",
  INVALID_WRITE_REQUEST: "Thông tin yêu cầu không hợp lệ.",
};
const receipt = (value: unknown): ReceiptSnapshot => {
  const row = exact(value, ["schemaVersion","orderId","paymentId","orderNo","businessDate","storeName","address","footer","tableName","paidAt","employeeName","lines","total","receivedAmount","changeAmount"]);
  if (row.schemaVersion !== 1 || !Array.isArray(row.lines)) throw unavailable();
  return {
    schemaVersion: 1, orderId: string(row.orderId), paymentId: string(row.paymentId), orderNo: integer(row.orderNo), businessDate: string(row.businessDate),
    storeName: string(row.storeName), address: string(row.address), footer: string(row.footer), tableName: nullableString(row.tableName), paidAt: string(row.paidAt), employeeName: string(row.employeeName),
    lines: row.lines.map(value => {
      const line = exact(value, ["orderItemId","menuItemId","name","quantity","baseUnitPrice","options","unitTotal","lineTotal","note"]);
      if (!Array.isArray(line.options)) throw unavailable();
      return { orderItemId: string(line.orderItemId), menuItemId: string(line.menuItemId), name: string(line.name), quantity: integer(line.quantity), baseUnitPrice: integer(line.baseUnitPrice),
        options: line.options.map(value => { const option = exact(value,["optionValueId","name","priceDelta","quantity"]); return { optionValueId:string(option.optionValueId),name:string(option.name),priceDelta:integer(option.priceDelta),quantity:integer(option.quantity) }; }),
        unitTotal: integer(line.unitTotal), lineTotal: integer(line.lineTotal), note: nullableString(line.note) };
    }), total: integer(row.total), receivedAmount: integer(row.receivedAmount), changeAmount: integer(row.changeAmount),
  };
};

export class SupabasePermissionPrintRepo implements IPermissionPrintRepo {
  constructor(private readonly client: SupabaseAnyClient) {}
  private uuid(value: string): string { if (!UUID.test(value)) throw new AppError("INVALID_WRITE_REQUEST", messages.INVALID_WRITE_REQUEST!); return value.toLowerCase(); }
  private async call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const credential = employeeCredential(this.client), generation = credential.generation;
    if (!credential.token) throw new AppError("EMPLOYEE_SESSION_REQUIRED", messages.EMPLOYEE_SESSION_REQUIRED!);
    let response: { data: unknown; error: unknown };
    try { response = await this.client.rpc(name, args).setHeader("x-pos-employee-token", credential.token); }
    catch (error) { if (generation !== employeeCredential(this.client).generation) throw new AppError("EMPLOYEE_SESSION_REQUIRED", messages.EMPLOYEE_SESSION_REQUIRED!); throw mapSupabaseError(error,"PERMISSION_UPDATE_UNAVAILABLE"); }
    if (generation !== employeeCredential(this.client).generation) throw new AppError("EMPLOYEE_SESSION_REQUIRED", messages.EMPLOYEE_SESSION_REQUIRED!);
    if (response.error) throw mapSupabaseError(response.error,"PERMISSION_UPDATE_UNAVAILABLE");
    const envelope = exact(response.data,["ok","data","error"]);
    if (envelope.ok === false) { const error=exact(envelope.error,["code","message","details"]); const code=string(error.code) as AppErrorCode; throw new AppError(code,messages[code]??unavailable().message,error.details); }
    if (envelope.ok !== true) throw unavailable();
    return exact(envelope.data, name === "authorize_initial_receipt_print" ? ["authorized","grantId","printRequestId"] : ["receipt","legacyMetadata"]);
  }
  async authorizeInitialReceiptPrint(grantId: string, printRequestId: string): Promise<InitialReceiptPrintAuthorization> {
    const grant=this.uuid(grantId), request=this.uuid(printRequestId);
    const data=await this.call("authorize_initial_receipt_print",{p_grant_id:grant,p_print_request_id:request});
    if (data.authorized!==true || string(data.grantId).toLowerCase()!==grant || string(data.printRequestId).toLowerCase()!==request) throw unavailable();
    return { authorized:true,grantId:grant,printRequestId:request };
  }
  async prepareReceiptReprint(orderId: string): Promise<PreparedReceiptReprint> {
    const data=await this.call("prepare_receipt_reprint",{p_order_id:this.uuid(orderId)});
    if (typeof data.legacyMetadata!=="boolean") throw unavailable(); return { receipt:receipt(data.receipt),legacyMetadata:data.legacyMetadata };
  }
}
