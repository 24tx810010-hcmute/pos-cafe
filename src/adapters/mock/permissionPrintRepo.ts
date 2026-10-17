import type { ReceiptSnapshot } from "@/domain";
import { AppError } from "@/core/appError";
import type { InitialReceiptPrintAuthorization, IPermissionPrintRepo, PreparedReceiptReprint } from "@/ports/permissionPrint";
import { clone, type MockState } from "./mockState";
import { mockWriteState } from "./writeState";
import { isWriteUuid } from "@/core/writePayload";

export type MockInitialReceiptGrantRecord = { grantId:string; storeId:string; operationId:string; orderId:string; employeeId:string; session:object };
export class MockPermissionPrintRegistry {
  readonly grants=new Map<string,MockInitialReceiptGrantRecord>();
  record(value:MockInitialReceiptGrantRecord):void { this.grants.set(value.grantId,value); }
}
type RuntimeContext={state:MockState;storeId():string;employeeId():string;session():object;require(permission:"payment.take"|"receipt.reprint"|"orderHistory.view"):void};

export class MockPermissionPrintRepo implements IPermissionPrintRepo {
  constructor(private readonly registry=new MockPermissionPrintRegistry(),private readonly runtime?:RuntimeContext,private readonly receipts=new Map<string,ReceiptSnapshot>()) {}
  async authorizeInitialReceiptPrint(grantId:string,printRequestId:string):Promise<InitialReceiptPrintAuthorization> {
    if(!isWriteUuid(grantId)||!isWriteUuid(printRequestId))throw new AppError("INVALID_WRITE_REQUEST","Yêu cầu in không hợp lệ.");
    grantId=grantId.toLowerCase();printRequestId=printRequestId.toLowerCase();
    const grant=this.registry.grants.get(grantId);if(!grant)throw new AppError("FORBIDDEN","Phiếu in ban đầu không còn hợp lệ.");
    if(!this.runtime)return {authorized:true,grantId,printRequestId};
    this.runtime.require("payment.take");
    const operation=Object.values(mockWriteState(this.runtime.state).operations).find(value=>value.operationId===grant.operationId);
    const order=this.runtime.state.orders.find(value=>value.id===grant.orderId);
    if(grant.storeId!==this.runtime.storeId()||grant.employeeId!==this.runtime.employeeId()||grant.session!==this.runtime.session()
      ||operation?.status!=="applied"||(operation.kind!=="pay_order"&&operation.kind!=="pay_order_items"))
      throw new AppError("FORBIDDEN","Phiếu in ban đầu không còn hợp lệ.");
    if(order?.status!=="paid"||!order.receiptSnapshot)throw new AppError("RECEIPT_UNAVAILABLE","Không tìm thấy hóa đơn.");
    return {authorized:true,grantId,printRequestId};
  }
  async prepareReceiptReprint(orderId:string):Promise<PreparedReceiptReprint> {
    if(!isWriteUuid(orderId))throw new AppError("INVALID_WRITE_REQUEST","Yêu cầu in không hợp lệ.");
    if(!this.runtime){const value=this.receipts.get(orderId);if(!value)throw new AppError("RECEIPT_UNAVAILABLE","Không tìm thấy hóa đơn.");return {receipt:clone(value),legacyMetadata:false};}
    this.runtime.require("receipt.reprint");
    let readable=true;try{this.runtime.require("payment.take");}catch{try{this.runtime.require("orderHistory.view");}catch{readable=false;}}
    if(!readable)throw new AppError("FORBIDDEN","Bạn không có quyền xem hóa đơn.");
    const order=this.runtime.state.orders.find(value=>value.id===orderId);
    if(!order?.receiptSnapshot||order.status!=="paid")throw new AppError("RECEIPT_UNAVAILABLE","Không tìm thấy hóa đơn.");
    return {receipt:clone(order.receiptSnapshot),legacyMetadata:false};
  }
}
