import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { AppPorts } from "@/ports";
import { writeError } from "@/core/writeErrors";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { PortsContext } from "@/features/shared/portsContext";
import { App } from "./App";
import { requireCompatibilityUpdate } from "./compatibilityGate";
import { useAppStore } from "./useAppStore";

vi.mock("./PermissionLifecycle", () => ({ PermissionLifecycle: () => null }));
vi.mock("./screens/LandingScreen", () => ({ LandingScreen: () => null }));
vi.mock("./screens/StorePairingScreen", () => ({ StorePairingScreen: () => null }));
vi.mock("./screens/PasscodeScreen", () => ({ PasscodeScreen: () => null }));
vi.mock("./screens/RotateGuidance", () => ({ RotateGuidance: () => null }));
vi.mock("./shell/AppShell", () => ({ AppShell: () => null }));
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

afterEach(() => {
  cleanup(); usePermissionSession.setState({ compatibilityBlocked: false });
  useAppStore.setState({ updateRequired: false, createdStoreResult: null, pendingStoreCreationInput: null, screen: "landing", currentEmployee: null });
  vi.restoreAllMocks();
});

test("a create-store completion keeps its one-time credentials visible above a compatibility gate", async () => {
  let release!: (value: { storeId: string; storeNo: number; storeKey: string; adminPin: string; seedStatus: string; canRetrySeed: boolean }) => void;
  const auth = {
    getStoreSession: vi.fn(async () => null),
    createStore: vi.fn(() => new Promise(resolve => { release = resolve; })),
    acknowledgeCreatedStore: vi.fn(),
  };
  useAppStore.setState({ screen: "createStore" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<PortsContext.Provider value={{ auth } as unknown as AppPorts}><QueryClientProvider client={client}><App /></QueryClientProvider></PortsContext.Provider>);
  fireEvent.change(await screen.findByTestId("store-name-input"), { target: { value: "Quán mới" } });
  fireEvent.click(screen.getByTestId("key-loss-acknowledgement"));
  fireEvent.click(screen.getByTestId("create-store-button"));
  await waitFor(() => expect(release).toBeDefined());
  act(() => { requireCompatibilityUpdate(writeError("WRITE_PROTOCOL_UNSUPPORTED")); });
  await act(async () => release({ storeId: crypto.randomUUID(), storeNo: 21, storeKey: "0021-ABCDEF", adminPin: "123456", seedStatus: "ready", canRetrySeed: false }));
  expect(await screen.findByTestId("compatibility-created-store-result")).toBeVisible();
  expect(screen.getByTestId("compatibility-store-key")).toHaveTextContent("0021-ABCDEF");
  expect(screen.getByTestId("compatibility-admin-pin")).toHaveTextContent("123456");
  expect(auth.getStoreSession).toHaveBeenCalledTimes(1);
});

test("normal acknowledgement clears one-time credentials before the PIN screen", async () => {
  const auth = { getStoreSession: vi.fn(async () => null), acknowledgeCreatedStore: vi.fn(), createStore: vi.fn(async () => ({
    storeId: crypto.randomUUID(), storeNo: 22, storeKey: "0022-ABCDEF", adminPin: "123456", seedStatus: "failed", canRetrySeed: true,
  })) };
  useAppStore.setState({ screen: "createStore" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<PortsContext.Provider value={{ auth } as unknown as AppPorts}><QueryClientProvider client={client}><App /></QueryClientProvider></PortsContext.Provider>);
  fireEvent.change(await screen.findByTestId("store-name-input"), { target: { value: "Quán mới" } });
  fireEvent.click(screen.getByTestId("key-loss-acknowledgement"));
  fireEvent.click(screen.getByTestId("create-store-button"));
  await screen.findByTestId("create-store-result");
  fireEvent.click(screen.getByRole("button", { name: "Tôi đã lưu Store Key." }));
  expect(useAppStore.getState().createdStoreResult).toBeNull();
  expect(auth.acknowledgeCreatedStore).toHaveBeenCalledOnce();
});

test("a completed result cannot leave before the explicit Store Key acknowledgement", async () => {
  const auth = { getStoreSession: vi.fn(async () => null), acknowledgeCreatedStore: vi.fn() };
  useAppStore.setState({ screen: "createStore", createdStoreResult: {
    storeKey: "0024-ABCDEF", adminPin: "123456", seedStatus: "ready", canRetrySeed: false,
  } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<PortsContext.Provider value={{ auth } as unknown as AppPorts}><QueryClientProvider client={client}><App /></QueryClientProvider></PortsContext.Provider>);
  await screen.findByTestId("create-store-result");
  expect(screen.getByRole("button", { name: "Quay lại" })).toBeDisabled();
  expect(useAppStore.getState().createdStoreResult).not.toBeNull();
  expect(auth.acknowledgeCreatedStore).not.toHaveBeenCalled();
});

test("credentials survive when the compatibility latch rejects the post-create session read", async () => {
  let rejectSession!: (error: unknown) => void;
  const auth = {
    getStoreSession: vi.fn()
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSession = reject; })),
    createStore: vi.fn(async () => ({ storeId: crypto.randomUUID(), storeNo: 23, storeKey: "0023-ABCDEF",
      adminPin: "123456", seedStatus: "ready", canRetrySeed: false })),
    acknowledgeCreatedStore: vi.fn(),
  };
  useAppStore.setState({ screen: "createStore" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<PortsContext.Provider value={{ auth } as unknown as AppPorts}><QueryClientProvider client={client}><App /></QueryClientProvider></PortsContext.Provider>);
  fireEvent.change(await screen.findByTestId("store-name-input"), { target: { value: "Quán mới" } });
  fireEvent.click(screen.getByTestId("key-loss-acknowledgement"));
  fireEvent.click(screen.getByTestId("create-store-button"));
  await waitFor(() => expect(rejectSession).toBeDefined());
  act(() => { requireCompatibilityUpdate(writeError("WRITE_PROTOCOL_UNSUPPORTED")); rejectSession(writeError("WRITE_PROTOCOL_UNSUPPORTED")); });
  expect(await screen.findByTestId("compatibility-created-store-result")).toHaveTextContent("0023-ABCDEF");
});

test("a completed Store Key result remounts after the create screen was removed", async () => {
  let release!: (value: { storeId: string; storeNo: number; storeKey: string; adminPin: string; seedStatus: string; canRetrySeed: boolean }) => void;
  const auth = { getStoreSession: vi.fn(async () => null), acknowledgeCreatedStore: vi.fn(),
    createStore: vi.fn(() => new Promise(resolve => { release = resolve; })) };
  useAppStore.setState({ screen: "createStore" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<PortsContext.Provider value={{ auth } as unknown as AppPorts}><QueryClientProvider client={client}><App /></QueryClientProvider></PortsContext.Provider>);
  fireEvent.change(await screen.findByTestId("store-name-input"), { target: { value: "Quán mới" } });
  fireEvent.click(screen.getByTestId("key-loss-acknowledgement"));
  fireEvent.click(screen.getByTestId("create-store-button"));
  await waitFor(() => expect(release).toBeDefined());
  act(() => useAppStore.getState().setScreen("landing"));
  await act(async () => release({ storeId: crypto.randomUUID(), storeNo: 25, storeKey: "0025-ABCDEF",
    adminPin: "123456", seedStatus: "pending", canRetrySeed: false }));
  expect(await screen.findByTestId("create-store-result")).toHaveTextContent("0025-ABCDEF");
  expect(useAppStore.getState().screen).toBe("landing");
});

test("a failed create keeps canonical input frozen across unmount and retries the same request", async () => {
  const auth = { getStoreSession: vi.fn(async () => null), acknowledgeCreatedStore: vi.fn(),
    createStore: vi.fn().mockRejectedValueOnce(new Error("lost acknowledgement")).mockResolvedValueOnce({
      storeId: crypto.randomUUID(), storeNo: 26, storeKey: "0026-ABCDEF", adminPin: "123456", seedStatus: "pending", canRetrySeed: false,
    }) };
  useAppStore.setState({ screen: "createStore" });
  const renderScreen = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(<PortsContext.Provider value={{ auth } as unknown as AppPorts}><QueryClientProvider client={client}><App /></QueryClientProvider></PortsContext.Provider>);
  };
  const first = renderScreen();
  fireEvent.change(await screen.findByTestId("store-name-input"), { target: { value: "  Quán Mây  " } });
  fireEvent.click(screen.getByTestId("seed-demo-checkbox"));
  fireEvent.click(screen.getByTestId("key-loss-acknowledgement"));
  fireEvent.click(screen.getByTestId("create-store-button"));
  await waitFor(() => expect(auth.createStore).toHaveBeenCalledOnce());
  await waitFor(() => expect(useAppStore.getState().pendingStoreCreationInput).toEqual({ displayName: "Quán Mây", address: undefined, seedDemo: true }));
  first.unmount();

  renderScreen();
  expect(await screen.findByTestId("store-name-input")).toHaveValue("Quán Mây");
  expect(screen.getByTestId("store-name-input")).toBeDisabled();
  expect(screen.getByTestId("seed-demo-checkbox")).toBeChecked();
  fireEvent.click(screen.getByTestId("create-store-button"));
  await screen.findByTestId("create-store-result");
  expect(auth.createStore).toHaveBeenCalledTimes(2);
  expect(auth.createStore.mock.calls[1][0]).toEqual(auth.createStore.mock.calls[0][0]);
  expect(useAppStore.getState().pendingStoreCreationInput).not.toBeNull();
});
