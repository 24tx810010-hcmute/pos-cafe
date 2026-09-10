import { describe, expect, it, vi } from "vitest";
import type { WritePayloadV1 } from "@/domain";
import { SupabaseWriteOperationRepo } from "./writeOperationRepo";
import { SupabaseEmployeeRepo } from "./employeeRepo";
import { employeeCredential } from "./employeeCredential";
import { createSupabaseBrowserClient } from "./client";
import type { SupabaseAnyClient } from "./repoShared";
import { hasPermission } from "@/core/guards";

const id = "00000000-0000-4000-8000-000000000101";
const payload: WritePayloadV1 = {schemaVersion:1,kind:"pay_order",orderId:id,paymentId:"00000000-0000-4000-8000-000000000301",expectedVersion:5,method:"cash",receivedAmount:150000};
describe("Supabase write transport contract",()=>{
  it.each([{}, { grants: ["payment.take"] }, { denies: ["payment.take"] }])("normalizes RPC employee overrides %j before the UI checks permissions", async (overrides) => {
    const data = { ok: true, token: "a".repeat(43), issuedAt: "2026-09-10T00:00:00Z", expiresAt: "2026-09-10T12:00:00Z", employee: { id, name: "Quản lý", role: "admin", isActive: true, permissionOverrides: overrides } };
    const client = { rpc: vi.fn().mockResolvedValue({ data, error: null }) } as unknown as SupabaseAnyClient;
    const employee = (await new SupabaseEmployeeRepo(client).startSession(id, "123456")).employee;
    expect(hasPermission(employee, "order.create")).toBe(true);
    expect(hasPermission(employee, "payment.take")).toBe(!("denies" in overrides));
    expect(employee.permissionOverrides?.grants ?? []).toEqual("grants" in overrides ? ["payment.take"] : []);
    expect(employee.permissionOverrides?.denies ?? []).toEqual("denies" in overrides ? ["payment.take"] : []);
  });
  for(const endpoint of ["register","execute"] as const)for(const variant of ["missing","null","wrong_type","positive"])it(`TC-IDEM-074/core/field=${endpoint}.operationId/variant=${variant}`,async()=>{
    const rpc=vi.fn().mockResolvedValue({data:{ok:true,operation:{operationId:id,schemaVersion:1,status:"pending"}},error:null});const repo=new SupabaseWriteOperationRepo({rpc} as unknown as SupabaseAnyClient);
    const operationId=({missing:undefined,null:null,wrong_type:12,positive:id} as Record<string,unknown>)[variant] as string;
    if(variant==="positive"){expect((await repo[endpoint](operationId,payload)).operationId).toBe(id);expect(rpc).toHaveBeenCalledTimes(1);}
    else {await expect(repo[endpoint](operationId,payload)).rejects.toMatchObject({code:"INVALID_WRITE_REQUEST"});expect(rpc).not.toHaveBeenCalled();}
  });
  it("TC-IDEM-084/core rejects missing or unsupported capability",async()=>{
    for(const data of [null,{writeProtocolVersion:0},{writeProtocolVersion:1,maxPayloadBytes:1,pendingTtlSeconds:86400}]){
      const client={rpc:vi.fn().mockResolvedValue({data,error:null})} as unknown as SupabaseAnyClient;
      await expect(new SupabaseWriteOperationRepo(client).capabilities()).rejects.toMatchObject({code:"WRITE_PROTOCOL_UNSUPPORTED"});
    }
  });
  it("TC-IDEM-090/core sends only frozen operation payload, never employee or credentials",async()=>{
    const operation={operationId:id,schemaVersion:1,status:"pending",payload};
    const rpc=vi.fn().mockResolvedValue({data:{ok:true,operation},error:null});const client={rpc} as unknown as SupabaseAnyClient;
    const repo=new SupabaseWriteOperationRepo(client);await repo.register(id,payload);await repo.execute(id,payload);
    expect(rpc.mock.calls).toEqual([["register_write_operation",{p_operation_id:id,p_payload:payload}],["execute_write_operation",{p_operation_id:id,p_payload:payload}]]);
  });
  it("terminal rejected is data; envelope auth error rejects without carrying request secrets",async()=>{
    const client={rpc:vi.fn().mockResolvedValue({data:{ok:true,operation:{operationId:id,schemaVersion:1,status:"rejected",error:{code:"PRICE_CHANGED"}}},error:null})} as unknown as SupabaseAnyClient;
    expect((await new SupabaseWriteOperationRepo(client).execute(id,payload)).status).toBe("rejected");
    vi.mocked(client.rpc).mockResolvedValueOnce({data:{ok:false,error:{code:"EMPLOYEE_SESSION_REQUIRED",message:"Phiên nhân viên đã hết hiệu lực. Vui lòng nhập lại PIN.",details:null}},error:null} as never);
    await expect(new SupabaseWriteOperationRepo(client).get(id)).rejects.toMatchObject({code:"EMPLOYEE_SESSION_REQUIRED"});
  });
  it("clear memory credential synchronously on revoke, captures token only for revoke request",async()=>{
    const setHeader=vi.fn().mockResolvedValue({error:null});const client={rpc:vi.fn(()=>({setHeader}))} as unknown as SupabaseAnyClient;
    employeeCredential(client).token="a".repeat(43);
    const pending=new SupabaseEmployeeRepo(client).revokeSession();
    expect(employeeCredential(client).token).toBeNull();await pending;
    expect(setHeader).toHaveBeenCalledWith("x-pos-employee-token","a".repeat(43));
  });
  it("late start response after lock never restores credential",async()=>{
    let release!:(value:unknown)=>void;const client={rpc:vi.fn(()=>new Promise(resolve=>{release=resolve;}))} as unknown as SupabaseAnyClient;
    const repo=new SupabaseEmployeeRepo(client);const pending=repo.startSession(id,"123456");await repo.revokeSession();
    release({data:{ok:true,employee:{id},token:"a".repeat(43),expiresAt:"2026-09-10T12:00:00Z"},error:null});
    await expect(pending).rejects.toMatchObject({code:"EMPLOYEE_SESSION_REQUIRED"});expect(employeeCredential(client).token).toBeNull();
  });
  it("missing Supabase configuration does not fall back to mock",()=>{expect(()=>createSupabaseBrowserClient({url:"",anonKey:""})).toThrow();});
});
