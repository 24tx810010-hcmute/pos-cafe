import { describe,expect,it } from "vitest";
import { MockPermissionPrintRegistry, MockPermissionPrintRepo } from "./permissionPrintRepo";

describe("MockPermissionPrintRepo",()=>{
 it("does not consume an initial grant across distinct print request IDs",async()=>{
  const grant="70000000-0000-4000-8000-000000000001",registry=new MockPermissionPrintRegistry();
  registry.record({grantId:grant,storeId:"store",operationId:"operation",orderId:"order",employeeId:"employee",session:{}});
  const repo=new MockPermissionPrintRepo(registry);
  await expect(repo.authorizeInitialReceiptPrint(grant,"80000000-0000-4000-8000-000000000001")).resolves.toMatchObject({authorized:true});
  await expect(repo.authorizeInitialReceiptPrint(grant,"80000000-0000-4000-8000-000000000002")).resolves.toMatchObject({authorized:true});
 });
});
