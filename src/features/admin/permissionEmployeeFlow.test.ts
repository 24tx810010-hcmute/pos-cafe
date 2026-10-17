import { describe, expect, it } from "vitest";
import { createMockPermissionCatalog } from "@/adapters/mock/permissionState";
import { actorCoversTarget, defaultPermissionSelection, formForEmployee, overridesFromSelection, permissionSourceLabel, validateEmployeeForm } from "./permissionEmployeeFlow";
import type { EmployeeAdminView } from "@/domain/permissions";

describe("T12 permission employee form",()=>{
 const catalog=createMockPermissionCatalog();
 const employee:EmployeeAdminView={id:"70000000-0000-4000-8000-000000000001",name:"Mai",role:"cashier",isActive:true,permissionRevision:2,overrides:{grants:["report.view"],denies:["payment.take"]},effective:["floor.view","order.create","order.update","order.voidOpen","report.view"],sources:catalog.permissions.map(p=>({permission:p.code,effective:p.code==="report.view",sources:p.code==="report.view"?["grant"]:[]}))};
 it("preserves existing effective rights until permission controls are explicitly changed",()=>{const form=formForEmployee(catalog,employee);expect(form.permissionsTouched).toBe(false);expect(form.permissions["report.view"]).toBe(true);expect(permissionSourceLabel(employee,"report.view")).toBe("Được cấp riêng");});
 it("derives normalized grants and denies against the selected role",()=>{const selection=defaultPermissionSelection(catalog,"cashier");selection["report.view"]=true;selection["payment.take"]=false;expect(overridesFromSelection(catalog,"cashier",selection)).toEqual({grants:["report.view"],denies:["payment.take"]});});
 it("validates Unicode name bounds and exact PIN confirmation",()=>{const form=formForEmployee(catalog,employee);form.name="";form.newPin="12345";form.confirmPin="123456";expect(validateEmployeeForm(form,false)).toEqual({name:"Tên nhân viên không được để trống.",pin:"PIN phải gồm đúng 6 chữ số.",confirmPin:"Xác nhận PIN không khớp."});form.name="😀".repeat(121);expect(validateEmployeeForm(form,false).name).toBe("Tên nhân viên tối đa 120 ký tự.");});
 it("checks the complete target rights set for the before ceiling",()=>{expect(actorCoversTarget(["floor.view","report.view"],employee)).toBe(false);expect(actorCoversTarget(employee.effective,employee)).toBe(true);});
});
