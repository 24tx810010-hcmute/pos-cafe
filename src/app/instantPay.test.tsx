import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import { formatVnd } from "@/core/money";
import type { Employee } from "@/domain";
import { PortsContext } from "@/features/shared/portsContext";
import { App } from "./App";
import { useAppStore } from "./useAppStore";

const admin: Employee = { id: "6b7bd350-7db2-4160-8471-cca2668c070d", name: "Quản lý", role: "admin", isActive: true };

// toHaveTextContent chuẩn hoá NBSP của Intl thành khoảng trắng thường.
const vnd = (amount: number) => formatVnd(amount).replace(/ /g, " ");

// Mở thẳng drawer thanh toán của 7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c: Cà phê sữa ×2 (29k) + Bạc xỉu (32k) + Croissant (35k) = 125k.
const renderPaymentDrawer = async (employee: Employee = admin) => {
  const state = createSeededMockState();
  state.session = { storeId: "e572ea5f-9adf-493c-8d84-dca3cd86e1eb", storeNo: 1 };
  const ports = createMockPorts(state);
  await ports.employee.startSession(employee.id, state.pins[employee.id]);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  useAppStore.setState({
    screen: "passcode",
    currentEmployee: employee,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: "payment",
    orderContext: null,
    paymentOrderId: "7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c",
    draftItems: [],
  });

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

describe("Instant pay selection UI", () => {
  it("defaults to select-all and routes a full payment through payOrder", async () => {
    const user = userEvent.setup();
    const { ports } = await renderPaymentDrawer();
    const paySpy = vi.spyOn(ports.write, "execute");
    const payItemsSpy = vi.spyOn(ports.write, "register");

    await screen.findByText("Thanh toán · Đơn #24");
    const selectAll = await screen.findByTestId("pay-select-all");
    await waitFor(() => expect(selectAll).toBeChecked());
    expect(screen.getByTestId("payment-amount-due-value")).toHaveTextContent(vnd(125000));
    expect(screen.getByTestId("pay-button")).toHaveTextContent("Hoàn tất thanh toán");

    await waitFor(() => expect(screen.getByTestId("pay-button")).toBeEnabled());
    await user.click(screen.getByTestId("pay-button"));

    await waitFor(() => expect(paySpy).toHaveBeenCalledTimes(1));
    expect(payItemsSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ kind: "pay_order" }));
    await waitFor(() => expect(screen.queryByTestId("payment-drawer")).not.toBeInTheDocument());
  });

  it("pays a partial selection and keeps the drawer open on the remaining items", async () => {
    const user = userEvent.setup();
    const { ports } = await renderPaymentDrawer();
    const paySpy = vi.spyOn(ports.write, "execute");
    const payItemsSpy = vi.spyOn(ports.write, "register");

    await screen.findByText("Thanh toán · Đơn #24");
    const selectAll = await screen.findByTestId("pay-select-all");
    await waitFor(() => expect(selectAll).toBeChecked());

    // Bỏ "Chọn tất cả" -> chưa chọn gì, không thể thanh toán.
    await user.click(selectAll);
    expect(screen.getByTestId("pay-button")).toBeDisabled();
    expect(screen.getByTestId("payment-amount-due-value")).toHaveTextContent(vnd(0));

    // Tick dòng Cà phê sữa -> mặc định chọn 1; nút "+" tăng dần và xoay vòng khi chạm trần.
    await user.click(screen.getAllByTestId("pay-item-checkbox")[0]);
    expect(screen.getAllByTestId("pay-item-quantity")[0]).toHaveTextContent("1/2");
    expect(screen.getByTestId("payment-amount-due-value")).toHaveTextContent(vnd(29000));
    await user.click(screen.getAllByTestId("pay-item-plus")[0]);
    expect(screen.getAllByTestId("pay-item-quantity")[0]).toHaveTextContent("2/2");
    await user.click(screen.getAllByTestId("pay-item-plus")[0]);
    expect(screen.getAllByTestId("pay-item-quantity")[0]).toHaveTextContent("1/2");
    expect(screen.getByTestId("payment-amount-due-value")).toHaveTextContent(vnd(29000));
    expect(screen.getByTestId("pay-button")).toHaveTextContent("Thanh toán món đã chọn");

    await user.click(screen.getByTestId("pay-button-footer"));
    await waitFor(() => expect(payItemsSpy).toHaveBeenCalledTimes(1));
    expect(paySpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ kind: "pay_order_items" }));

    // Món được chọn đã TÁCH thành đơn #24 paid riêng; đơn gốc còn lại trên bàn,
    // drawer giữ nguyên và selection quay về "Chọn tất cả" phần còn lại (96k).
    expect(screen.getByTestId("payment-drawer")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("payment-amount-due-value")).toHaveTextContent(vnd(0)),
    );
    await waitFor(() =>
      expect(screen.getByTestId("payment-order-total-value")).toHaveTextContent(vnd(96000)),
    );
    await waitFor(() => expect(screen.getByTestId("pay-select-all")).not.toBeChecked());
    expect(screen.getAllByTestId("pay-item-line")).toHaveLength(3);
    // Đơn tách nhận đúng tham số: kế thừa cách chọn món và có newOrderId client cấp.
    expect(payItemsSpy.mock.calls[0][1]).toMatchObject({
      orderId: "7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c",
      lines: [expect.objectContaining({ orderItemId: "3c00b7a3-016f-45a3-8f96-664314c26b4a", quantity: 1 })],
    });
    expect((payItemsSpy.mock.calls[0][1] as import("@/domain").SplitWritePayload).newOrderId).toBeTruthy();
  });

  it("soft-gates both payment actions when the employee lacks payment.take", async () => {
    await renderPaymentDrawer({
      id: "22828322-623b-42e7-8a28-a2bdf367c364",
      name: "Thu ngân",
      role: "cashier",
      isActive: true,
      permissionOverrides: { grants: [], denies: ["payment.take"] },
    });

    await screen.findByText("Thanh toán · Đơn #24");
    for (const testId of ["pay-button", "pay-button-footer"]) {
      const button = screen.getByTestId(testId);
      await waitFor(() => expect(button).toBeDisabled());
      expect(button).toHaveAttribute("title", "Không có quyền thanh toán");
    }
  });
});
