import { readFileSync } from "node:fs";
import { cleanupReadFixture, db, resetReadFixture, rpc, setupReadFixture } from "./permissionReadFixture";
export * from "./permissionReadFixture";

let staged=false;
export async function setupPrintFixture(){
  await setupReadFixture();
  await db.query(readFileSync("supabase/candidate/permission-print.sql","utf8"));
  staged=true;
  await db.query("notify pgrst,'reload schema'");
  // Wait for schema visibility using requests without an employee token. They
  // cannot authorize a print or mutate a grant; tested mutations are never retried.
  for(let attempt=0;attempt<50;attempt++){
    const results=await Promise.all([
      rpc("authorize_initial_receipt_print",{p_grant_id:null,p_print_request_id:null}),
      rpc("prepare_receipt_reprint",{p_order_id:null}),
    ]);
    if(results.every(result=>result.ok===false&&result.error?.code==="EMPLOYEE_SESSION_REQUIRED"))return;
    if(results.some(result=>result.code!=="PGRST202"&&!(result.ok===false&&result.error?.code==="EMPLOYEE_SESSION_REQUIRED")))
      throw new Error("PRINT_API_READINESS_UNEXPECTED_RESPONSE");
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error("PRINT_API_NOT_READY");
}
export async function resetPrintFixture(){if(!staged)return;await db.query("alter table private.initial_receipt_print_grants disable trigger user; delete from private.initial_receipt_print_grants; alter table private.initial_receipt_print_grants enable trigger user");await resetReadFixture();}
export async function cleanupPrintFixture(){try{if(staged){await resetPrintFixture();await db.query(`drop function public.authorize_initial_receipt_print(uuid,uuid),public.prepare_receipt_reprint(uuid),private.permission_create_initial_receipt_print_grant(uuid,uuid,uuid,uuid,uuid,timestamptz);drop table private.initial_receipt_print_grants;drop function private.initial_receipt_print_grant_immutable()`);}}finally{await cleanupReadFixture();}}
