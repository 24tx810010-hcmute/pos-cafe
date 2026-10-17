import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import toast from "react-hot-toast";
import { createMockPermissionRuntime } from "@/adapters/mock/permissionRuntime";
import { createMockPermissionState } from "@/adapters/mock/permissionState";
import { createMockPorts } from "@/adapters/mock/mockRepos";
import { PortsContext } from "@/features/shared/portsContext";
import { usePermissionSession } from "@/features/shared/permissionSession";
import type { AppPorts } from "@/ports";
import { EmployeesStubDrawer } from "./EmployeesDrawer";
vi.mock("react-hot-toast",()=>({default:Object.assign(vi.fn(),{success:vi.fn(),error:vi.fn()})}));

async function setup() {
 const state=createMockPermissionState(),runtime=createMockPermissionRuntime(state),owner=state.employees.find(e=>e.role==="owner")!;
 const session=await runtime.session.startSession(owner.id,"384729");usePermissionSession.getState().begin(session);
 const ports={...createMockPorts(state.business),permission:{...runtime,signals:{subscribe:()=>()=>{}}}} as unknown as AppPorts;
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><EmployeesStubDrawer/></QueryClientProvider></PortsContext.Provider>);
 await screen.findByTestId(`employee-row-${owner.id}`); return {state,runtime,owner,client};
}

describe("T12 employees drawer candidate runtime",()=>{
 beforeEach(()=>{usePermissionSession.getState().clear();vi.clearAllMocks();});
 it("renders the authoritative candidate roster and permission source controls",async()=>{
  const state=createMockPermissionState(),permission=createMockPermissionRuntime(state),owner=state.employees.find(e=>e.role==="owner")!;
  const session=await permission.session.startSession(owner.id,"384729");usePermissionSession.getState().begin(session);
  const ports={...createMockPorts(state.business),permission:{...permission,signals:{subscribe:()=>()=>{}}}} as unknown as AppPorts;
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><EmployeesStubDrawer/></QueryClientProvider></PortsContext.Provider>);
  expect(await screen.findByTestId(`employee-row-${owner.id}`)).toHaveTextContent("Chủ quán");
  expect(await screen.findByTestId("permission-floor.view")).toBeDisabled();
 expect(screen.getByTestId("add-employee-button")).toBeEnabled();
 });
 it("TC-PERM-59 renders exact field validation and never calls create for invalid input",async()=>{
  const {runtime}=await setup();const create=vi.spyOn(runtime.employeeAdmin,"createEmployee");
  fireEvent.click(screen.getByTestId("add-employee-button"));
  fireEvent.change(await screen.findByTestId("employee-name-input"),{target:{value:""}});
  fireEvent.change(screen.getByTestId("employee-pin-input"),{target:{value:"１２３４５６"}});
  fireEvent.change(screen.getByTestId("employee-confirm-pin-input"),{target:{value:"123456"}});
  fireEvent.click(screen.getByTestId("save-employee-button"));
  expect(await screen.findByText("Tên nhân viên không được để trống.")).toBeVisible();
  expect(screen.getByText("PIN phải gồm đúng 6 chữ số.")).toBeVisible();
  expect(screen.getByText("Xác nhận PIN không khớp.")).toBeVisible();expect(create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByTestId("employee-name-input"),{target:{value:"😀".repeat(121)}});
  fireEvent.click(screen.getByTestId("save-employee-button"));
 expect(await screen.findByText("Tên nhân viên tối đa 120 ký tự.")).toBeVisible();expect(create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByTestId("employee-name-input"),{target:{value:"Nhân viên mới"}});
  fireEvent.change(screen.getByTestId("employee-pin-input"),{target:{value:"123456"}});fireEvent.change(screen.getByTestId("employee-confirm-pin-input"),{target:{value:"123456"}});
  fireEvent.click(screen.getByTestId("save-employee-button"));await waitFor(()=>expect(create).toHaveBeenCalledTimes(1));
  expect(toast.success).toHaveBeenCalledWith("Đã tạo nhân viên.");
 });
 it("TC-PERM-59 distinguishes no-op, applied update and reset-PIN outcomes with exact messages",async()=>{
  const {state,runtime}=await setup();const success=vi.mocked(toast.success);
  const update=vi.spyOn(runtime.employeeAdmin,"updateEmployee"),reset=vi.spyOn(runtime.employeeAdmin,"resetPin");
  await waitFor(()=>expect(screen.getByTestId("employee-name-input")).toHaveValue("Chủ quán"));
  const cashier=state.employees.find(e=>e.role==="cashier")!;fireEvent.click(screen.getByTestId(`employee-row-${cashier.id}`));
  await waitFor(()=>expect(screen.getByTestId("employee-name-input")).toHaveValue(cashier.name));
  fireEvent.click(screen.getByTestId("save-employee-button"));await waitFor(()=>expect(toast).toHaveBeenCalledWith("Không có thay đổi để lưu."));
  expect(update).not.toHaveBeenCalled();expect(reset).not.toHaveBeenCalled();
  fireEvent.change(screen.getByTestId("employee-name-input"),{target:{value:"Thu ngân mới"}});fireEvent.click(screen.getByTestId("save-employee-button"));
  await waitFor(()=>expect(success).toHaveBeenCalledWith("Đã lưu nhân viên."));
  expect(update).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByTestId("employee-pin-input"),{target:{value:"654321"}});fireEvent.change(screen.getByTestId("employee-confirm-pin-input"),{target:{value:"654321"}});fireEvent.click(screen.getByTestId("save-employee-button"));
  await waitFor(()=>expect(success).toHaveBeenCalledWith("Đã đặt lại PIN. Nhân viên cần đăng nhập lại."));
  expect(reset).toHaveBeenCalledTimes(1);
 });
 it("TC-PERM-59 distinguishes owner self-PIN no-op from applied and logs out only after applied",async()=>{
  const {runtime}=await setup();await waitFor(()=>expect(screen.getByTestId("employee-current-pin-input")).toBeVisible());
  const change=vi.spyOn(runtime.session,"changeOwnPin")
   .mockResolvedValueOnce({outcome:"noop",credentialChanged:false,employeeRevision:0})
   .mockResolvedValueOnce({outcome:"applied",credentialChanged:true,employeeRevision:1});
  const fill=(next:string)=>{fireEvent.change(screen.getByTestId("employee-current-pin-input"),{target:{value:"384729"}});fireEvent.change(screen.getByTestId("employee-pin-input"),{target:{value:next}});fireEvent.change(screen.getByTestId("employee-confirm-pin-input"),{target:{value:next}});};
  fill("384729");fireEvent.click(screen.getByTestId("save-employee-button"));
  await waitFor(()=>expect(toast).toHaveBeenCalledWith("PIN mới trùng PIN hiện tại; không có thay đổi."));
  expect(usePermissionSession.getState().session).not.toBeNull();
  fill("654321");fireEvent.click(screen.getByTestId("save-employee-button"));
  await waitFor(()=>expect(toast.success).toHaveBeenCalledWith("Đã đổi PIN. Vui lòng đăng nhập lại."));
  expect(change).toHaveBeenCalledTimes(2);expect(usePermissionSession.getState().session).toBeNull();
 });
});
