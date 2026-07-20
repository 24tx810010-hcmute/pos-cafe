import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const admin: Employee = { id: "emp-admin", name: "Quản lý", role: "admin", isActive: true };

const resetAppStoreForEmployeesDrawer = () => {
  useAppStore.setState({
    screen: "passcode",
    currentEmployee: admin,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: "employees",
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
  });
};

const renderEmployeesDrawer = () => {
  const state = createSeededMockState();
  state.session = { storeId: "store-demo-001", storeNo: 1 };
  const ports = createMockPorts(state);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  resetAppStoreForEmployeesDrawer();
  render(
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </PortsContext.Provider>,
  );

  return { ports, state };
};

afterEach(() => {
  cleanup();
  useAppStore.setState({
    screen: "landing",
    currentEmployee: null,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: null,
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
  });
});

describe("EmployeesDrawer", () => {
  it("creates employees through admin mutations and stores the new PIN", async () => {
    const user = userEvent.setup();
    const { ports, state } = renderEmployeesDrawer();

    await screen.findByTestId("employees-drawer");
    await user.click(screen.getByTestId("add-employee-button"));
    await user.type(screen.getByTestId("employee-name-input"), "Nhân viên mới");
    await user.type(screen.getByTestId("employee-pin-input"), "333333");
    await user.type(screen.getByTestId("employee-confirm-pin-input"), "333333");
    await user.click(screen.getByTestId("save-employee-button"));

    await waitFor(() => {
      expect(state.employees).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "Nhân viên mới", role: "cashier" })]),
      );
    });
    const created = state.employees.find((employee) => employee.name === "Nhân viên mới");

    expect(created?.id).toMatch(/^[0-9a-f-]{36}$/i);
    await expect(ports.employee.verifyPin(created?.id ?? "", "333333")).resolves.toMatchObject({
      name: "Nhân viên mới",
    });
    expect(await screen.findByText("Nhân viên mới")).toBeInTheDocument();
  });

  it("deactivates employees through admin mutations without hiding them from admin list", async () => {
    const user = userEvent.setup();
    const { state } = renderEmployeesDrawer();

    await user.click(await screen.findByTestId("employee-row-emp-cashier-1"));
    await user.click(screen.getByTestId("employee-inactive-button"));
    await user.click(screen.getByTestId("save-employee-button"));

    await waitFor(() => {
      expect(state.employees.find((employee) => employee.id === "emp-cashier-1")?.isActive).toBe(false);
    });
    const row = await screen.findByTestId("employee-row-emp-cashier-1");

    expect(within(row).getByText(/Tạm khoá/)).toBeInTheDocument();
  });

  it("resets employee PIN from the detail form", async () => {
    const user = userEvent.setup();
    const { ports } = renderEmployeesDrawer();

    await user.click(await screen.findByTestId("employee-row-emp-cashier-1"));
    await user.type(screen.getByTestId("employee-pin-input"), "444444");
    await user.type(screen.getByTestId("employee-confirm-pin-input"), "444444");
    await user.click(screen.getByTestId("save-employee-button"));

    await waitFor(async () => {
      await expect(ports.employee.verifyPin("emp-cashier-1", "444444")).resolves.toMatchObject({
        id: "emp-cashier-1",
      });
    });
    await expect(ports.employee.verifyPin("emp-cashier-1", "111111")).rejects.toMatchObject({
      code: "INVALID_PIN",
    });
  });

  it("edits effective permissions and clears redundant overrides", async () => {
    const user = userEvent.setup();
    const { state } = renderEmployeesDrawer();

    await user.click(await screen.findByTestId("employee-row-emp-cashier-1"));
    const paymentPermission = screen.getByTestId("employee-permission-payment.take");
    expect(paymentPermission).toBeChecked();
    expect(screen.getByTestId("employee-permission-order.voidPaid")).not.toBeChecked();

    await user.click(paymentPermission);
    await user.click(screen.getByTestId("save-employee-button"));
    await waitFor(() => {
      expect(state.employees.find((employee) => employee.id === "emp-cashier-1")?.permissionOverrides).toEqual({
        grants: [],
        denies: ["payment.take"],
      });
    });

    await waitFor(() => expect(screen.getByTestId("save-employee-button")).toBeEnabled());
    await user.click(screen.getByTestId("employee-permission-payment.take"));
    await user.click(screen.getByTestId("save-employee-button"));
    await waitFor(() => {
      expect(state.employees.find((employee) => employee.id === "emp-cashier-1")?.permissionOverrides).toBeUndefined();
    });
  });

  it("resets permission checkboxes to the selected role defaults", async () => {
    const user = userEvent.setup();
    renderEmployeesDrawer();

    await user.click(await screen.findByTestId("employee-row-emp-cashier-1"));
    await user.click(screen.getByTestId("employee-permission-payment.take"));
    expect(screen.getByTestId("employee-permission-order.create")).toBeChecked();

    await user.click(screen.getByTestId("employee-role-kitchen"));
    for (const code of ["order.create", "order.update", "order.voidOpen", "payment.take", "order.voidPaid"]) {
      expect(screen.getByTestId(`employee-permission-${code}`)).not.toBeChecked();
    }

    await user.click(screen.getByTestId("employee-role-admin"));
    for (const code of ["order.create", "order.update", "order.voidOpen", "payment.take", "order.voidPaid"]) {
      expect(screen.getByTestId(`employee-permission-${code}`)).toBeChecked();
    }
  });

  it("warns on self-edit and blocks demoting the final active admin", async () => {
    const user = userEvent.setup();
    const { ports, state } = renderEmployeesDrawer();
    const updateSpy = vi.spyOn(ports.employee, "updateEmployee");

    await user.click(await screen.findByTestId("employee-row-emp-admin"));
    expect(screen.getByTestId("employee-self-permission-warning")).toBeInTheDocument();

    await user.click(screen.getByTestId("employee-role-cashier"));
    await user.click(screen.getByTestId("save-employee-button"));

    await waitFor(() => expect(state.employees.find((employee) => employee.id === "emp-admin")?.role).toBe("admin"));
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
