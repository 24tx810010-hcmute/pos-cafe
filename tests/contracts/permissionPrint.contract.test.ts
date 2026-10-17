import { randomUUID } from "node:crypto";
import { afterAll,afterEach,beforeAll,expect,test } from "vitest";
import { observeCandidateStage } from "./permissionStageObservation";
import { cleanupPrintFixture,db,EMPLOYEE_IDS as E,resetPrintFixture,rpc,setupPrintFixture,STORE_IDS as S } from "./permissionPrintFixture";

beforeAll(async()=>{await setupPrintFixture();await observeCandidateStage(db);},120000);afterEach(resetPrintFixture);afterAll(cleanupPrintFixture,120000);
const start=(id=E[0])=>rpc("permission_start_session",{p_employee_id:id,p_pin:"384729"});
async function createAppliedGrant(token:string){
 const open=(await db.query(`select o.id,o.lock_version::int version,i.menu_item_id,m.price::int price from public.orders o join public.order_items i on i.order_id=o.id join public.menu_items m on m.id=i.menu_item_id where o.store_id=$1 and o.status='open' order by o.id limit 1`,[S[0]])).rows[0];
 const key=randomUUID(),grantId=randomUUID(),payload={schemaVersion:1,kind:"pay_order",orderId:open.id,paymentId:randomUUID(),expectedVersion:open.version,method:"cash",receivedAmount:100000};
 await rpc("register_write_operation",{p_operation_id:key,p_payload:payload},token);const execution=await rpc("execute_write_operation",{p_operation_id:key,p_payload:payload,p_print_grant_id:grantId},token);
 const operation=(await db.query("select * from public.write_operations where store_id=$1 and operation_id=$2",[S[0],key])).rows[0];
 return{key,grantId,orderId:open.id,grant:execution.initialReceiptPrintGrant,operationResult:operation.result};
}

test("TC-PERM-37 initial grant is private, session-bound and non-consuming",async()=>{
 const token=(await start()).token;const created=await createAppliedGrant(token);const pr1=randomUUID(),pr2=randomUUID();
 expect(created.grant).toEqual({grantId:created.grantId,orderId:created.orderId});
 expect((await rpc("authorize_initial_receipt_print",{p_grant_id:created.grantId,p_print_request_id:pr1},token)).data).toEqual({authorized:true,grantId:created.grantId,printRequestId:pr1});
 expect((await rpc("authorize_initial_receipt_print",{p_grant_id:created.grantId,p_print_request_id:pr2},token)).data).toEqual({authorized:true,grantId:created.grantId,printRequestId:pr2});
 expect(Number((await db.query("select count(*) n from private.initial_receipt_print_grants where grant_id=$1",[created.grantId])).rows[0].n)).toBe(1);
 const nextToken=(await start()).token;expect((await rpc("authorize_initial_receipt_print",{p_grant_id:created.grantId,p_print_request_id:randomUUID()},nextToken)).error.code).toBe("FORBIDDEN");
});

test("TC-PERM-37 replay/get never mint or expose another grant and R1 remains unchanged",async()=>{
 const token=(await start()).token;const created=await createAppliedGrant(token);
 const replay=await rpc("get_write_operation",{p_operation_id:created.key},token);expect(replay.operation.result).toEqual(created.operationResult);expect(JSON.stringify(replay)).not.toContain(created.grantId);
 expect(Number((await db.query("select count(*) n from private.initial_receipt_print_grants where operation_id=$1",[created.key])).rows[0].n)).toBe(1);
});

test("TC-PERM-38 reprint requires receipt.reprint plus a current read predicate",async()=>{
 const token=(await start()).token;const paid=(await db.query("select id from public.orders where store_id=$1 and status='paid' order by id limit 1",[S[0]])).rows[0].id;
 const allowed=await rpc("prepare_receipt_reprint",{p_order_id:paid},token);expect(allowed.ok).toBe(true);expect(allowed.data.receipt.orderId).toBe(paid);
 await db.query("update public.employees set permission_overrides=jsonb_build_object('grants','[]'::jsonb,'denies',jsonb_build_array('receipt.reprint')) where id=$1",[E[0]]);
 expect((await rpc("prepare_receipt_reprint",{p_order_id:paid},token)).error.code).toBe("FORBIDDEN");
});

test("TC-PERM-60 revoke payment.take or paid state blocks every later initial authorization",async()=>{
 const token=(await start()).token;const a=await createAppliedGrant(token);
 await db.query("update public.employees set permission_overrides=jsonb_build_object('grants','[]'::jsonb,'denies',jsonb_build_array('payment.take')) where id=$1",[E[0]]);
 expect((await rpc("authorize_initial_receipt_print",{p_grant_id:a.grantId,p_print_request_id:randomUUID()},token)).error.code).toBe("FORBIDDEN");
 await db.query("update public.employees set permission_overrides=null where id=$1",[E[0]]);
 await db.query("update public.orders set status='void' where id=$1",[a.orderId]);
 expect((await rpc("authorize_initial_receipt_print",{p_grant_id:a.grantId,p_print_request_id:randomUUID()},token)).error.code).toBe("RECEIPT_UNAVAILABLE");
});
