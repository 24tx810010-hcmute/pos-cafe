import { describe,expect,it } from "vitest";
import type { WritePayloadV1 } from "@/domain";
import { createMockPermissionState } from "./permissionState";
import { createMockPermissionRuntime } from "./permissionRuntime";

const uuid=(n:number)=>`90000000-0000-4000-8000-${String(n).padStart(12,"0")}`;

describe("permission print mock runtime integration",()=>{
  it("binds first-payment grant to K, actor and exact session while rechecking live rights and paid state",async()=>{
    const state=createMockPermissionState({demoCredentials:true}),ports=createMockPermissionRuntime(state);
    const cashier=state.employees.find(value=>value.role==="cashier")!;
    await ports.session.startSession(cashier.id,"111111");
    const order=state.business.orders.find(value=>value.status==="open"&&value.total>0)!;
    const payload:WritePayloadV1={schemaVersion:1,kind:"pay_order",orderId:order.id,paymentId:uuid(2),method:"cash",expectedVersion:order.lockVersion,receivedAmount:order.total};
    await ports.write.register(uuid(1),payload);
    const executed=await ports.write.executeForInitialReceipt(uuid(1),payload,{grantId:uuid(3)});
    expect(executed.initialReceiptPrintGrant).toEqual({grantId:uuid(3),orderId:order.id});
    await expect(ports.print.authorizeInitialReceiptPrint(uuid(3),uuid(4))).resolves.toMatchObject({authorized:true});
    await expect(ports.print.authorizeInitialReceiptPrint(uuid(3),uuid(5))).resolves.toMatchObject({authorized:true});
    state.business.orders.find(value=>value.id===order.id)!.status="void";
    await expect(ports.print.authorizeInitialReceiptPrint(uuid(3),uuid(9))).rejects.toMatchObject({code:"RECEIPT_UNAVAILABLE"});
    state.business.orders.find(value=>value.id===order.id)!.status="paid";

    cashier.overrides={grants:[],denies:["payment.take"]};cashier.permissionRevision++;
    await expect(ports.print.authorizeInitialReceiptPrint(uuid(3),uuid(6))).rejects.toMatchObject({code:"FORBIDDEN"});
    cashier.overrides=null;cashier.permissionRevision++;
    await expect(ports.print.authorizeInitialReceiptPrint(uuid(3),uuid(7))).resolves.toMatchObject({authorized:true});

    await ports.session.startSession(cashier.id,"111111");
    await expect(ports.print.authorizeInitialReceiptPrint(uuid(3),uuid(8))).rejects.toMatchObject({code:"FORBIDDEN"});
    await expect(ports.print.prepareReceiptReprint(order.id)).resolves.toMatchObject({receipt:{orderId:order.id},legacyMetadata:false});
    state.business.orders.find(value=>value.id===order.id)!.status="void";
    await expect(ports.print.prepareReceiptReprint(order.id)).rejects.toMatchObject({code:"RECEIPT_UNAVAILABLE"});
  });
});
