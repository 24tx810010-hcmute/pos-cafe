import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const admin: Employee = { id: "6b7bd350-7db2-4160-8471-cca2668c070d", name: "Quản lý", role: "admin", isActive: true };

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

const renderEmployeesDrawer = async () => {
  const state = createSeededMockState();
  state.session = { storeId: "e572ea5f-9adf-493c-8d84-dca3cd86e1eb", storeNo: 1 };
  const ports = createMockPorts(state);
  await ports.employee.startSession("6b7bd350-7db2-4160-8471-cca2668c070d", state.pins["6b7bd350-7db2-4160-8471-cca2668c070d"]);
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
  it("keeps the employee directory and editor in a primary-accent split layout", async () => {
    const user = userEvent.setup();
    await renderEmployeesDrawer();

    const splitLayout = await screen.findByTestId("employees-split-layout");
    const cashierRow = await screen.findByTestId("employee-row-22828322-623b-42e7-8a28-a2bdf367c364");

    expect(splitLayout).toHaveClass(
      "grid-cols-[clamp(132px,26%,286px)_minmax(0,1fr)]",
    );
    expect(screen.getByTestId("employee-list-pane")).toBeInTheDocument();
    expect(screen.getByTestId("employee-detail-pane")).toBeInTheDocument();
    expect(screen.queryByText(/Mở khoá:/i)).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("employee-detail-header")).getByTestId(
        "save-employee-button",
      ),
    ).toBeInTheDocument();

    await user.click(cashierRow);
    expect(cashierRow).toHaveClass("bg-pos-primary", "text-white");
  });

  it("creates employees through admin mutations and stores the new PIN", async () => {
    const user = userEvent.setup();
    const { ports, state } = await renderEmployeesDrawer();

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
    expect(await screen.findByTestId(`employee-row-${created?.id}`)).toHaveTextContent(
      "Nhân viên mới",
    );
  });

  it("deactivates employees through admin mutations without hiding them from admin list", async () => {
    const user = userEvent.setup();
    const { state } = await renderEmployeesDrawer();

    await user.click(await screen.findByTestId("employee-row-22828322-623b-42e7-8a28-a2bdf367c364"));
    await user.click(screen.getByTestId("employee-active-toggle"));
    await user.click(screen.getByTestId("save-employee-button"));

    await waitFor(() => {
      expect(state.employees.find((employee) => employee.id === "22828322-623b-42e7-8a28-a2bdf367c364")?.isActive).toBe(false);
    });
    const row = await screen.findByTestId("employee-row-22828322-623b-42e7-8a28-a2bdf367c364");

    expect(within(row).getByText(/Tạm khoá/)).toBeInTheDocument();
  });

  it("resets employee PIN from the detail form", async () => {
    const user = userEvent.setup();
    const { ports } = await renderEmployeesDrawer();

    await user.click(await screen.findByTestId("employee-row-22828322-623b-42e7-8a28-a2bdf367c364"));
    await user.type(screen.getByTestId("employee-pin-input"), "444444");
    await user.type(screen.getByTestId("employee-confirm-pin-input"), "444444");
    await user.click(screen.getByTestId("save-employee-button"));

    await waitFor(async () => {
      await expect(ports.employee.verifyPin("22828322-623b-42e7-8a28-a2bdf367c364", "444444")).resolves.toMatchObject({
        id: "22828322-623b-42e7-8a28-a2bdf367c364",
      });
    });
    await expect(ports.employee.verifyPin("22828322-623b-42e7-8a28-a2bdf367c364", "111111")).rejects.toMatchObject({
      code: "INVALID_PIN",
    });
  });

  it("edits effective permissions and clears redundant overrides", async () => {
    const user = userEvent.setup();
    const { state } = await renderEmployeesDrawer();

    await user.click(await screen.findByTestId("employee-row-22828322-623b-42e7-8a28-a2bdf367c364"));
    const paymentPermission = screen.getByTestId("employee-permission-payment.take");
    expect(paymentPermission).toBeChecked();
    expect(screen.getByTestId("employee-permission-order.voidPaid")).not.toBeChecked();

    await user.click(paymentPermission);
    await user.click(screen.getByTestId("save-employee-button"));
    await waitFor(() => {
      expect(state.employees.find((employee) => employee.id === "22828322-623b-42e7-8a28-a2bdf367c364")?.permissionOverrides).toEqual({
        grants: [],
        denies: ["payment.take"],
      });
    });

    await waitFor(() => expect(screen.getByTestId("save-employee-button")).toBeEnabled());
    await user.click(screen.getByTestId("employee-permission-payment.take"));
    await user.click(screen.getByTestId("save-employee-button"));
    await waitFor(() => {
      expect(state.employees.find((employee) => employee.id === "22828322-623b-42e7-8a28-a2bdf367c364")?.permissionOverrides).toBeUndefined();
    });
  });

  it("resets permission checkboxes to the selected role defaults", async () => {
    const user = userEvent.setup();
    await renderEmployeesDrawer();

    await user.click(await screen.findByTestId("employee-row-22828322-623b-42e7-8a28-a2bdf367c364"));
    await user.click(screen.getByTestId("employee-permission-payment.take"));
    expect(screen.getByTestId("employee-permission-order.create")).toBeChecked();
    expect(screen.queryByRole("option", { name: "Bếp" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("employee-row-b1885ef9-c9c0-4a02-8757-875a44e8c814")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByTestId("employee-role-select"), "admin");
    for (const code of ["order.create", "order.update", "order.voidOpen", "payment.take", "order.voidPaid"]) {
      expect(screen.getByTestId(`employee-permission-${code}`)).toBeChecked();
    }
  });

  it("warns on self-edit and blocks demoting the final active admin", async () => {
    const user = userEvent.setup();
    const { ports, state } = await renderEmployeesDrawer();
    const updateSpy = vi.spyOn(ports.employee, "updateEmployee");

    await user.click(await screen.findByTestId("employee-row-6b7bd350-7db2-4160-8471-cca2668c070d"));
    expect(screen.getByTestId("employee-self-permission-warning")).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId("employee-role-select"), "cashier");
    await user.click(screen.getByTestId("save-employee-button"));

    await waitFor(() => expect(state.employees.find((employee) => employee.id === "6b7bd350-7db2-4160-8471-cca2668c070d")?.role).toBe("admin"));
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
