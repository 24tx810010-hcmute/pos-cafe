import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createMockPorts, createMockState } from "@/adapters/mock";
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
  const state = createMockState();
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
});
