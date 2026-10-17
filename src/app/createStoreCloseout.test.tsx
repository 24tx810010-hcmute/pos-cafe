import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AppPorts } from "@/ports";
import { PortsContext } from "@/features/shared/portsContext";
import { useAppStore } from "./useAppStore";
import { CreateStoreScreen } from "./screens/CreateStoreScreen";

vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function mount(createStore: (...args: any[]) => Promise<any>) {
  const auth = { createStore: vi.fn(createStore), getStoreSession: vi.fn(async () => null), acknowledgeCreatedStore: vi.fn() };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<PortsContext.Provider value={{ auth } as unknown as AppPorts}>
    <QueryClientProvider client={client}><CreateStoreScreen /></QueryClientProvider>
  </PortsContext.Provider>);
  return auth;
}

afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  useAppStore.setState({ createdStoreResult: null, pendingStoreCreationInput: null, screen: "landing" });
});

it("TC-PIN-12 warning acknowledgement gates creation before network", async () => {
  const auth = mount(async () => { throw new Error("unexpected create"); });
  fireEvent.change(screen.getByTestId("store-name-input"), { target: { value: "Cà phê Mây" } });
  expect(screen.getByTestId("create-store-button")).toBeDisabled();
  fireEvent.keyDown(screen.getByTestId("store-name-input"), { key: "Enter" });
  expect(await screen.findByText("Hãy xác nhận bạn đã hiểu cách lưu Store Key trước khi tạo quán.")).toBeVisible();
  expect(auth.createStore).not.toHaveBeenCalled();
  expect(useAppStore.getState().pendingStoreCreationInput).toBeNull();
});

it("TC-PIN-11 pending submit rejects a second click and locks the canonical payload", async () => {
  let release!: (value: any) => void;
  const auth = mount(() => new Promise(resolve => { release = resolve; }));
  fireEvent.change(screen.getByTestId("store-name-input"), { target: { value: "  Cà phê Mây  " } });
  fireEvent.change(screen.getByLabelText("Địa chỉ (tuỳ chọn)"), { target: { value: "  12 Nguyễn Huệ  " } });
  fireEvent.click(screen.getByTestId("seed-demo-checkbox"));
  fireEvent.click(screen.getByTestId("key-loss-acknowledgement"));
  fireEvent.click(screen.getByTestId("create-store-button"));
  await waitFor(() => expect(auth.createStore).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByTestId("create-store-button"));
  expect(auth.createStore).toHaveBeenCalledOnce();
  expect(auth.createStore.mock.calls[0][0]).toEqual({ displayName: "Cà phê Mây", address: "12 Nguyễn Huệ", seedDemo: true });
  expect(screen.getByTestId("store-name-input")).toBeDisabled();
  expect(screen.getByLabelText("Địa chỉ (tuỳ chọn)")).toBeDisabled();
  expect(screen.getByTestId("seed-demo-checkbox")).toBeDisabled();
  expect(screen.getByTestId("key-loss-acknowledgement")).toBeDisabled();
  release({ storeId: crypto.randomUUID(), storeNo: 27, storeKey: "0027-ABCDEF", adminPin: "123456",
    seedStatus: "pending", canRetrySeed: false });
  await screen.findByTestId("create-store-result");
});
