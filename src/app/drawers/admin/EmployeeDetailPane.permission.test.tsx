import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { createMockPermissionCatalog } from "@/adapters/mock/permissionState";
import { formForEmployee } from "@/features/admin/permissionEmployeeFlow";
import type { EmployeeAdminView } from "@/domain/permissions";
import { EmployeeDetailPane } from "./EmployeeDetailPane";

const catalog=createMockPermissionCatalog();
const employee:EmployeeAdminView={id:"74000000-0000-4000-8000-000000000001",name:"Mai",role:"cashier",isActive:true,permissionRevision:0,overrides:null,effective:catalog.defaults.filter(d=>d.roleCode==="cashier").map(d=>d.permissionCode),sources:catalog.permissions.map(p=>({permission:p.code,effective:false,sources:p.code==="floor.view"?["default","baseline"]:[]}))};
const renderPane=(extra:Partial<Parameters<typeof EmployeeDetailPane>[0]>={})=>render(<EmployeeDetailPane selectedId={employee.id} selectedRecord={employee} actorId="actor" actorRole="manager" actorPermissions={catalog.permissions.map(p=>p.code)} catalog={catalog} form={formForEmployee(catalog,employee)} setForm={vi.fn()} errors={{}} setErrors={vi.fn()} nameInputRef={createRef()} saving={false} canManage={true} canEditPermissions={false} targetWithinCeiling={true} onSave={vi.fn()} {...extra}/>);

describe("T12 employee detail permission UI",()=>{
 it("TC-PERM-56 offers only manager/cashier/waiter and separates field management from permission editing",()=>{renderPane();const select=screen.getByTestId("employee-role-select") as HTMLSelectElement;expect([...select.options].map(o=>o.value)).toEqual(["manager","cashier","waiter"]);expect(screen.getByTestId("employee-name-input")).not.toBeDisabled();expect(screen.getByTestId("permission-report.view")).toBeDisabled();});
 it("locks self role, overrides and disable while keeping owner current-PIN flow explicit",()=>{const owner={...employee,role:"owner" as const,effective:catalog.permissions.map(p=>p.code)};renderPane({selectedRecord:owner,actorId:owner.id,actorRole:"owner",form:formForEmployee(catalog,owner),canEditPermissions:true});expect(screen.getByTestId("employee-role-select")).toBeDisabled();expect(screen.getByTestId("employee-active-toggle")).toBeDisabled();expect(screen.getByTestId("permission-report.view")).toBeDisabled();expect(screen.getByTestId("employee-current-pin-input")).toBeInTheDocument();});
 it("TC-PERM-56 shows the complete-before ceiling block and disables saving",()=>{renderPane({targetWithinCeiling:false});expect(screen.getByText(/quyền hiện tại của họ vượt quyền/)).toBeInTheDocument();expect(screen.getByTestId("save-employee-button")).toBeDisabled();});
 it("TC-PERM-56 renders exact role defaults and an explicit override source without granting unrelated actions",()=>{
  expect(Object.fromEntries(catalog.roles.filter(r=>r.code!=="kitchen").map(role=>[role.code,catalog.defaults.filter(d=>d.roleCode===role.code).length]))).toEqual({owner:15,manager:12,cashier:7,waiter:3});
  const overridden={...employee,overrides:{grants:["report.view" as const],denies:["payment.take" as const]},effective:[...employee.effective,"report.view" as const],
   sources:employee.sources.map(s=>s.permission==="report.view"?{...s,effective:true,sources:["grant" as const]}:s)};
  renderPane({selectedRecord:overridden,form:formForEmployee(catalog,overridden),canEditPermissions:true});
  expect(screen.getByTestId("permission-report.view")).toBeChecked();expect(screen.getByText("Được cấp riêng")).toBeVisible();
  expect(screen.getByTestId("permission-order.voidPaid")).not.toBeChecked();
 });
});
