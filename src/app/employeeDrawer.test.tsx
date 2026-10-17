import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PortsContext } from "@/features/shared/portsContext";
import { activateCandidateUi, createCandidateRuntimeFixture } from "@/test/candidateRuntimeFixture";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const OWNER_ID = "30000000-0000-4000-8000-000000000011";
const CASHIER_ID = "30000000-0000-4000-8000-000000000013";

const renderEmployeesDrawer = async () => {
  const fixture = await createCandidateRuntimeFixture();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  activateCandidateUi(fixture);
  useAppStore.setState({ drawer: "employees" });
  render(<PortsContext.Provider value={fixture.ports}><QueryClientProvider client={queryClient}><App /></QueryClientProvider></PortsContext.Provider>);
  await screen.findByTestId("employees-drawer");
  return fixture;
};

afterEach(() => {
  cleanup();
  useAppStore.setState({ screen: "landing", currentEmployee: null, drawer: null });
});

describe("EmployeesDrawer candidate employee administration", () => {
  it("keeps the employee directory and editor in a primary-accent split layout", async () => {
    const user = userEvent.setup();
    await renderEmployeesDrawer();
    const layout = screen.getByTestId("employees-split-layout");
    const cashier = await screen.findByTestId(`employee-row-${CASHIER_ID}`);
    expect(layout).toHaveClass("grid-cols-[clamp(132px,26%,286px)_minmax(0,1fr)]");
    expect(screen.getByTestId("employee-list-pane")).toBeInTheDocument();
    expect(screen.getByTestId("employee-detail-pane")).toBeInTheDocument();
    await user.click(cashier);
    expect(cashier).toHaveClass("bg-pos-primary", "text-white");
  });

  it("creates a selectable-role employee and stores its six-digit PIN", async () => {
    const user = userEvent.setup();
    const fixture = await renderEmployeesDrawer();
    await user.click(screen.getByTestId("add-employee-button"));
    expect([...(screen.getByTestId("employee-role-select") as HTMLSelectElement).options].map((x) => x.value))
      .toEqual(["manager", "cashier", "waiter"]);
    await user.type(screen.getByTestId("employee-name-input"), "Nhân viên mới");
    await user.type(screen.getByTestId("employee-pin-input"), "333333");
    await user.type(screen.getByTestId("employee-confirm-pin-input"), "333333");
    await user.click(screen.getByTestId("save-employee-button"));
    await waitFor(() => expect(fixture.state.employees.some((x) => x.name === "Nhân viên mới")).toBe(true));
    const created = fixture.state.employees.find((x) => x.name === "Nhân viên mới")!;
    expect(created).toMatchObject({ role: "cashier", isActive: true, overrides: null });
    await expect(fixture.runtime.session.startSession(created.id, "333333")).resolves.toMatchObject({ authority: { snapshot: { employeeId: created.id } } });
  });

  it("deactivates an employee without removing it from the administrative roster", async () => {
    const user = userEvent.setup();
    const fixture = await renderEmployeesDrawer();
    await user.click(await screen.findByTestId(`employee-row-${CASHIER_ID}`));
    await user.click(screen.getByTestId("employee-active-toggle"));
    await user.click(screen.getByTestId("save-employee-button"));
    await waitFor(() => expect(fixture.state.employees.find((x) => x.id === CASHIER_ID)?.isActive).toBe(false));
    expect(screen.getByTestId(`employee-row-${CASHIER_ID}`).querySelector(".lucide-lock")).toBeInTheDocument();
  });

  it("resets an employee PIN and invalidates the old credential", async () => {
    const user = userEvent.setup();
    const fixture = await renderEmployeesDrawer();
    await user.click(await screen.findByTestId(`employee-row-${CASHIER_ID}`));
    await user.type(screen.getByTestId("employee-pin-input"), "444444");
    await user.type(screen.getByTestId("employee-confirm-pin-input"), "444444");
    await user.click(screen.getByTestId("save-employee-button"));
    await waitFor(() => expect(screen.getByTestId("employee-pin-input")).toHaveValue(""));
    await expect(fixture.runtime.session.startSession(CASHIER_ID, "384729")).rejects.toMatchObject({ code: "INVALID_PIN" });
    await expect(fixture.runtime.session.startSession(CASHIER_ID, "444444")).resolves.toMatchObject({ authority: { snapshot: { employeeId: CASHIER_ID } } });
  });

  it("persists explicit denies and removes redundant overrides", async () => {
    const user = userEvent.setup();
    const fixture = await renderEmployeesDrawer();
    await user.click(await screen.findByTestId(`employee-row-${CASHIER_ID}`));
    const payment = screen.getByTestId("permission-payment.take");
    expect(payment).toBeChecked();
    await user.click(payment);
    await user.click(screen.getByTestId("save-employee-button"));
    await waitFor(() => expect(fixture.state.employees.find((x) => x.id === CASHIER_ID)?.overrides)
      .toEqual({ grants: [], denies: ["payment.take"] }));
    await user.click(screen.getByTestId("permission-payment.take"));
    await user.click(screen.getByTestId("save-employee-button"));
    await waitFor(() => expect(fixture.state.employees.find((x) => x.id === CASHIER_ID)?.overrides).toBeNull());
  });

  it("discards old overrides when changing role and uses the new role defaults", async () => {
    const fixture = await createCandidateRuntimeFixture();
    fixture.state.employees.find((x) => x.id === CASHIER_ID)!.overrides = { grants: [], denies: ["payment.take"] };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    activateCandidateUi(fixture);
    useAppStore.setState({ drawer: "employees" });
    render(<PortsContext.Provider value={fixture.ports}><QueryClientProvider client={client}><App /></QueryClientProvider></PortsContext.Provider>);
    const user = userEvent.setup();
    await user.click(await screen.findByTestId(`employee-row-${CASHIER_ID}`));
    await user.selectOptions(screen.getByTestId("employee-role-select"), "manager");
    await user.click(screen.getByTestId("save-employee-button"));
    await waitFor(() => expect(fixture.state.employees.find((x) => x.id === CASHIER_ID))
      .toMatchObject({ role: "manager", overrides: null }));
  });

  it("protects the owner from self role, override, and active-state edits", async () => {
    await renderEmployeesDrawer();
    await screen.findByTestId(`employee-row-${OWNER_ID}`);
    expect(screen.getByTestId("employee-role-select")).toBeDisabled();
    expect(screen.getByTestId("employee-role-select")).toHaveValue("owner");
    expect(screen.getByTestId("employee-active-toggle")).toBeDisabled();
    expect(screen.getByTestId("permission-report.view")).toBeDisabled();
    expect(screen.getByTestId("employee-current-pin-input")).toBeInTheDocument();
  });
});
