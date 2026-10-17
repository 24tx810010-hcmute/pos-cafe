import { describe, expect, it, vi } from "vitest";
import type { SupabaseAnyClient } from "./repoShared";
import { employeeCredential } from "./employeeCredential";
import { SupabasePermissionPrintRepo } from "./permissionPrintRepo";

const grant="70000000-0000-4000-8000-000000000001", request="80000000-0000-4000-8000-000000000001", order="30000000-0000-4000-8000-000000000001";
const sampleReceipt={schemaVersion:1,orderId:order,paymentId:"40000000-0000-4000-8000-000000000001",orderNo:1,businessDate:"2026-09-17",storeName:"POS",address:"A",footer:"F",tableName:null,paidAt:"2026-09-17T00:00:00.000Z",employeeName:"Lan",lines:[{orderItemId:"31000000-0000-4000-8000-000000000001",menuItemId:"30000000-0000-4000-8000-000000000101",name:"Cà phê",quantity:1,baseUnitPrice:40000,options:[],unitTotal:40000,lineTotal:40000,note:null}],total:40000,receivedAmount:50000,changeAmount:10000};
const fake=(data:unknown)=>{const setHeader=vi.fn().mockResolvedValue({data,error:null});const rpc=vi.fn(()=>({setHeader}));const client={rpc} as unknown as SupabaseAnyClient;employeeCredential(client).token="token";return{repo:new SupabasePermissionPrintRepo(client),rpc,setHeader,client};};

describe("SupabasePermissionPrintRepo",()=>{
 it("authorizes every print request read-only with exact correlation IDs",async()=>{
  const x=fake({ok:true,data:{authorized:true,grantId:grant,printRequestId:request}});
  await expect(x.repo.authorizeInitialReceiptPrint(grant,request)).resolves.toEqual({authorized:true,grantId:grant,printRequestId:request});
  expect(x.rpc).toHaveBeenCalledWith("authorize_initial_receipt_print",{p_grant_id:grant,p_print_request_id:request});
  expect(x.setHeader).toHaveBeenCalledWith("x-pos-employee-token","token");
 });
 it("maps reprint receipt without operation/K/R1 fields",async()=>{
  const x=fake({ok:true,data:{receipt:sampleReceipt,legacyMetadata:false}});
  await expect(x.repo.prepareReceiptReprint(order)).resolves.toEqual({receipt:sampleReceipt,legacyMetadata:false});
  expect(x.rpc).toHaveBeenCalledWith("prepare_receipt_reprint",{p_order_id:order});
 });
 it("rejects malformed IDs/responses and ignores a response from an old session generation",async()=>{
  const bad=fake({ok:true,data:{authorized:true,grantId:grant,printRequestId:request}});
  await expect(bad.repo.authorizeInitialReceiptPrint("bad",request)).rejects.toMatchObject({code:"INVALID_WRITE_REQUEST"});expect(bad.rpc).not.toHaveBeenCalled();
  const malformed=fake({ok:true,data:{authorized:true,grantId:grant,printRequestId:request,operation:{}}});
  await expect(malformed.repo.authorizeInitialReceiptPrint(grant,request)).rejects.toMatchObject({code:"PERMISSION_UPDATE_UNAVAILABLE"});
  let resolve!:(v:unknown)=>void;const setHeader=vi.fn(()=>new Promise(done=>{resolve=done;}));const rpc=vi.fn(()=>({setHeader}));const client={rpc} as unknown as SupabaseAnyClient;employeeCredential(client).token="old";const pending=new SupabasePermissionPrintRepo(client).authorizeInitialReceiptPrint(grant,request);employeeCredential(client).generation++;resolve({data:{ok:true,data:{authorized:true,grantId:grant,printRequestId:request}},error:null});await expect(pending).rejects.toMatchObject({code:"EMPLOYEE_SESSION_REQUIRED"});
 });
 it("preserves current permission/receipt denials",async()=>{
  const denied=fake({ok:false,error:{code:"FORBIDDEN",message:"ignored",details:null}});await expect(denied.repo.authorizeInitialReceiptPrint(grant,request)).rejects.toMatchObject({code:"FORBIDDEN"});
  const unavailable=fake({ok:false,error:{code:"RECEIPT_UNAVAILABLE",message:"ignored",details:null}});await expect(unavailable.repo.prepareReceiptReprint(order)).rejects.toMatchObject({code:"RECEIPT_UNAVAILABLE"});
 });
});

