import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCandidateRuntimeFixture, activateCandidateUi } from "@/test/candidateRuntimeFixture";
import { PortsContext } from "@/features/shared/portsContext";
import { usePermissionSession, permissionQueryKey } from "@/features/shared/permissionSession";
import { MockPermissionSignalPort } from "@/adapters/mock/permissionSignalPort";
import type { PermissionOverrides } from "@/domain/permissions";
import { App } from "./App";
import { WriteLifecycle } from "./WriteLifecycle";
import { useAppStore } from "./useAppStore";
import toast from "react-hot-toast";
vi.mock("react-hot-toast",()=>({default:Object.assign(vi.fn(),{success:vi.fn(),error:vi.fn()})}));

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); useAppStore.getState().setCurrentEmployee(null); vi.restoreAllMocks(); vi.clearAllMocks(); });
async function setup(role: "manager" | "waiter" = "manager", overrides?: PermissionOverrides) {
  const fixture = await createCandidateRuntimeFixture({ role, overrides });
  activateCandidateUi(fixture);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<PortsContext.Provider value={fixture.ports}><QueryClientProvider client={client}><WriteLifecycle /><App /></QueryClientProvider></PortsContext.Provider>);
  await screen.findByTestId("floor-view");
  return { ...fixture, client };
}
const signal = (f: Awaited<ReturnType<typeof setup>>) => (f.runtime.signals as MockPermissionSignalPort).emitStore({ storeId: f.state.storeId, topic: "permission", revision: f.owner.permissionRevision, eventId: crypto.randomUUID() });

describe("permission UI lifecycle", () => {
  it("shows baseline floor but hides unavailable modules and rejects direct drawer opening", async () => {
    const f = await setup("waiter");
    expect(screen.queryByTestId("nav-report")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-employees")).not.toBeInTheDocument();
    const read = vi.spyOn(f.runtime.read, "getSalesReport");
    act(() => useAppStore.getState().openDrawer("report"));
    expect(screen.queryByTestId("report-drawer")).not.toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
  });
  it("gates portal content on focus while retaining an unchanged editor draft", async () => {
    const f = await setup();
    fireEvent.click(screen.getByTestId("nav-menu-editor"));
    fireEvent.click(await screen.findByTestId("add-item-button"));
    const input = await screen.findByTestId("menu-item-name-input");
    fireEvent.change(input, { target: { value: "Nháp còn quyền" } });
    const realRevision = f.runtime.authority.getRevision.bind(f.runtime.authority);
    let resolve!: (value: Awaited<ReturnType<typeof realRevision>>) => void;
    vi.spyOn(f.runtime.authority, "getRevision").mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(screen.getByTestId("permission-verification-gate")).toBeVisible();
    expect(input).not.toBeVisible();
    await act(async () => { resolve(await realRevision()); });
    await waitFor(() => expect(input).toBeVisible());
    expect(input).toHaveValue("Nháp còn quyền");
  });
  it("revocation closes the dirty affected editor, purges its cache, retains unrelated draft and session", async () => {
    const f = await setup();
    fireEvent.click(screen.getByTestId("nav-menu-editor"));
    fireEvent.click(await screen.findByTestId("add-item-button"));
    fireEvent.change(await screen.findByTestId("menu-item-name-input"), { target: { value: "Bỏ nháp menu" } });
    const generation = usePermissionSession.getState().generation;
    const sessionVersion = useAppStore.getState().employeeSessionVersion;
    const unrelated = [{ id: crypto.randomUUID(), menuItemId: f.business.menu.menuItems[0].id, quantity: 1, options: [] }];
    act(() => useAppStore.getState().setDraftItems(unrelated));
    const key = permissionQueryKey("menu-admin"); expect(f.client.getQueryData(key)).toBeDefined();
    f.owner.overrides = { grants: [], denies: ["menu.manage"] }; f.owner.permissionRevision++;
    act(() => signal(f));
    await waitFor(() => expect(screen.queryByTestId("menu-editor-drawer")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId("nav-menu-editor")).not.toBeInTheDocument());
    expect(toast).toHaveBeenCalledWith("Quyền của bạn đã thay đổi. Phần đang thao tác không còn được phép đã đóng; dữ liệu chưa lưu của phần đó đã được bỏ.");
    expect(f.client.getQueryData(key)).toBeUndefined();
    expect(useAppStore.getState().draftItems).toEqual(unrelated);
    expect(usePermissionSession.getState().generation).toBe(generation);
    expect(useAppStore.getState().employeeSessionVersion).toBe(sessionVersion);
  });
  it("closes a kitchen ticket when its source permission is revoked even if another order right remains", async () => {
    const f = await setup("waiter");
    act(() => useAppStore.getState().openReceiptPreview({ variant: "kitchen", requiredPermission: "order.create",
      doc: { orderNo: 1, orderType: "takeaway", tableName: null, lines: [], total: 0 } }));
    expect(await screen.findByTestId("receipt-preview")).toBeVisible();
    f.owner.overrides = { grants: [], denies: ["order.create"] }; f.owner.permissionRevision++;
    act(() => signal(f));
    await waitFor(() => expect(screen.queryByTestId("receipt-preview")).not.toBeInTheDocument());
    expect(usePermissionSession.getState().bundle?.snapshot.permissions).toContain("order.update");
  });
  it.each(["employee.manage", "employee.permission.edit"] as const)("discards only the employee draft group governed by revoked %s", async lost => {
    const f = await setup("manager", { grants: ["employee.permission.edit"], denies: [] });
    fireEvent.click(screen.getByTestId("nav-employees"));
    await screen.findByTestId("employee-name-input");
    const cashier = f.state.employees.find(employee => employee.role === "cashier")!;
    fireEvent.click(await screen.findByTestId(`employee-row-${cashier.id}`));
    await waitFor(() => expect(screen.getByTestId("employee-name-input")).toHaveValue(cashier.name));
    fireEvent.change(screen.getByTestId("employee-name-input"), { target: { value: "Tên đang sửa" } });
    fireEvent.click(screen.getByTestId("permission-payment.take"));
    f.owner.overrides = { grants: lost === "employee.manage" ? ["employee.permission.edit"] : [], denies: [lost] };
    f.owner.permissionRevision++; act(() => signal(f));
    await waitFor(() => expect(usePermissionSession.getState().bundle?.snapshot.permissions).not.toContain(lost));
    expect(screen.getByTestId("employees-drawer")).toBeVisible();
    if (lost === "employee.manage") {
      await waitFor(() => expect(screen.getByTestId("employee-name-input")).toHaveValue(cashier.name));
      expect(screen.getByTestId("employee-name-input")).toBeDisabled();
      expect(screen.getByTestId("permission-payment.take")).not.toBeChecked();
      expect(screen.getByTestId("permission-payment.take")).toBeEnabled();
    } else {
      expect(screen.getByTestId("employee-name-input")).toHaveValue("Tên đang sửa");
      expect(screen.getByTestId("employee-name-input")).toBeEnabled();
      await waitFor(() => expect(screen.getByTestId("permission-payment.take")).toBeChecked());
      expect(screen.getByTestId("permission-payment.take")).toBeDisabled();
    }
  });
  it("discards only the paid-void confirmation when its action is revoked, preserving readable history", async () => {
    const f = await setup();
    fireEvent.click(screen.getByTestId("nav-order-history"));
    const button = await screen.findByTestId("history-void-order");
    await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
    expect(await screen.findByTestId("history-void-confirm")).toBeVisible();
    f.owner.overrides = { grants: [], denies: ["order.voidPaid"] }; f.owner.permissionRevision++;
    act(() => signal(f));
    await waitFor(() => expect(screen.queryByTestId("history-void-confirm")).not.toBeInTheDocument());
    expect(screen.getByTestId("order-history-drawer")).toBeVisible();
    expect(screen.queryByTestId("history-void-order")).not.toBeInTheDocument();
    expect(f.business.orders.find(order => order.status === "paid")).toBeDefined();
  });
  it("refreshes the directory for another employee's permission signal without replacing an unchanged actor snapshot", async () => {
    const f = await setup();
    fireEvent.click(screen.getByTestId("nav-employees")); await screen.findByTestId("employee-name-input");
    const cashier = f.state.employees.find(employee => employee.role === "cashier")!;
    const read = vi.spyOn(f.runtime.employeeAdmin, "listEmployees");
    const before = usePermissionSession.getState().bundle;
    cashier.name = "Thu ngân đã đổi"; cashier.permissionRevision++;
    act(() => (f.runtime.signals as MockPermissionSignalPort).emitStore({ storeId: f.state.storeId, topic: "permission", revision: 99, eventId: crypto.randomUUID() }));
    await waitFor(() => expect(screen.getByTestId(`employee-row-${cashier.id}`)).toHaveTextContent("Thu ngân đã đổi"));
    expect(read).toHaveBeenCalledTimes(1); expect(usePermissionSession.getState().bundle).toBe(before);
  });
});
