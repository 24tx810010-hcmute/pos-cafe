import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createMockPorts, createMockState } from "@/adapters/mock";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { useAppStore } from "../useAppStore";
import { FloorWorkspace } from "./FloorWorkspace";

const admin: Employee = { id: "emp-admin", name: "Quản lý", role: "admin", isActive: true };

const renderWorkspace = () => {
  const ports = createMockPorts(createMockState());
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  useAppStore.setState({
    screen: "passcode",
    currentEmployee: admin,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: null,
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
  });

  return render(
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={queryClient}>
        <FloorWorkspace />
      </QueryClientProvider>
    </PortsContext.Provider>,
  );
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

describe("FloorWorkspace", () => {
  it("keeps refresh near the floor controls without rendering the old top chrome", async () => {
    renderWorkspace();

    expect(await screen.findByTestId("floor-view")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sơ đồ bàn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo đơn nhanh" })).not.toBeInTheDocument();
    expect(screen.getByTestId("floor-refresh-button")).toHaveTextContent("Làm mới");
  });
});
