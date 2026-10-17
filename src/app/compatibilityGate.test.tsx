import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { OperationView, SplitWritePayload } from "@/domain";
import type { AppPorts, IWriteOperationRepo } from "@/ports";
import { writeError } from "@/core/writeErrors";
import { getWriteCoordinator } from "@/features/pos/writeOperationFlow";
import { PortsContext } from "@/features/shared/portsContext";
import { App, CompatibilityUpdateGate } from "./App";
import { notifyUiError } from "./appErrors";
import { useAppStore } from "./useAppStore";
import { WriteLifecycle } from "./WriteLifecycle";
import { createCompatibilityQueryClient } from "./AppProviders";
import { requireCompatibilityUpdate } from "./compatibilityGate";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { createCandidateRuntimeFixture } from "@/test/candidateRuntimeFixture";
import { createEmptyMenuChanges, saveMenuForAdmin } from "@/features/admin/adminFlow";
import { createStoreForSession } from "@/features/session/sessionFlow";

const sessionQuery = vi.hoisted(() => ({ error: null as unknown, hook: vi.fn() }));

vi.mock("@/features/session", () => ({ useStoreSessionQuery: () => { sessionQuery.hook(); return { data: undefined, error: sessionQuery.error }; } }));
vi.mock("./PermissionLifecycle", () => ({ PermissionLifecycle: () => <div data-testid="authority" /> }));
vi.mock("./screens/LandingScreen", () => ({ LandingScreen: () => <div data-testid="landing" /> }));
vi.mock("./screens/StorePairingScreen", () => ({ StorePairingScreen: () => null }));
vi.mock("./screens/CreateStoreScreen", () => ({ CreateStoreScreen: () => null }));
vi.mock("./screens/PasscodeScreen", () => ({ PasscodeScreen: () => null }));
vi.mock("./screens/RotateGuidance", () => ({ RotateGuidance: () => null }));
vi.mock("./shell/AppShell", () => ({ AppShell: () => <div data-testid="protected-shell" /> }));
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { error: vi.fn() }) }));

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const payload: SplitWritePayload = { schemaVersion: 1, kind: "pay_order_items", orderId: id(1), paymentId: id(2), expectedVersion: 1,
  method: "cash", receivedAmount: 10_000, newOrderId: id(3), lines: [{ orderItemId: id(4), quantity: 1, splitItemId: id(5) }] };
const pending = (key: string): OperationView => ({ operationId: key, schemaVersion: 1, kind: payload.kind, action: null, status: "pending",
  payload, registeredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), initiatedByEmployeeId: id(6),
  decidedAt: null, executedByEmployeeId: null, cancelledByEmployeeId: null, result: null, error: null, replayCount: "0" });

afterEach(() => { cleanup(); sessionQuery.error = null; sessionQuery.hook.mockClear();
  usePermissionSession.setState({ compatibilityBlocked: false });
  useAppStore.setState({ updateRequired: false, currentEmployee: null }); vi.restoreAllMocks(); });

test("a pre-latched update gate mounts no startup query and inhibits the coordinator immediately", async () => {
  const repo = {
    capabilities: vi.fn(), register: vi.fn(), execute: vi.fn(), executeForInitialReceipt: vi.fn(), get: vi.fn(), list: vi.fn(), cancel: vi.fn(),
  } as unknown as IWriteOperationRepo;
  const client = new QueryClient();
  useAppStore.setState({ updateRequired: true }); sessionQuery.hook.mockClear();
  render(<PortsContext.Provider value={{ write: repo } as AppPorts}><QueryClientProvider client={client}><WriteLifecycle /><App /></QueryClientProvider></PortsContext.Provider>);
  expect(screen.getByTestId("compatibility-update-gate")).toBeVisible();
  expect(sessionQuery.hook).not.toHaveBeenCalled();
  await expect(getWriteCoordinator(repo).begin(payload)).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED" });
  expect(repo.capabilities).not.toHaveBeenCalled(); expect(repo.register).not.toHaveBeenCalled();
});

test("a gate raised while admin authority is pending prevents the later admin write", async () => {
  const candidate = await createCandidateRuntimeFixture();
  const realAuthority = candidate.ports.permission!.authority.getAuthority.bind(candidate.ports.permission!.authority);
  let release!: (value: Awaited<ReturnType<typeof realAuthority>>) => void;
  vi.spyOn(candidate.ports.permission!.authority, "getAuthority").mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const save = vi.spyOn(candidate.ports.permission!.changes, "saveMenuChanges");
  const pendingSave = saveMenuForAdmin(candidate.ports, { actor: candidate.actor, changes: createEmptyMenuChanges() });
  await waitFor(() => expect(release).toBeDefined());
  act(() => { notifyUiError(writeError("WRITE_PROTOCOL_UNSUPPORTED")); });
  release(await realAuthority());
  await expect(pendingSave).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED" });
  expect(save).not.toHaveBeenCalled();
});

test("an update latch queued as authority resolves wins before the admin side-effect boundary", async () => {
  const candidate = await createCandidateRuntimeFixture();
  const realAuthority = candidate.ports.permission!.authority.getAuthority.bind(candidate.ports.permission!.authority);
  let release!: (value: Awaited<ReturnType<typeof realAuthority>>) => void;
  vi.spyOn(candidate.ports.permission!.authority, "getAuthority").mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const save = vi.spyOn(candidate.ports.permission!.changes, "saveMenuChanges");
  const pendingSave = saveMenuForAdmin(candidate.ports, { actor: candidate.actor, changes: createEmptyMenuChanges() });
  await waitFor(() => expect(release).toBeDefined());
  release(await realAuthority());
  queueMicrotask(() => requireCompatibilityUpdate(writeError("WRITE_PROTOCOL_UNSUPPORTED")));
  await expect(pendingSave).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED" });
  expect(save).not.toHaveBeenCalled();
});

test("a completed create-store response preserves its one-time Store Key without a gated follow-up read", async () => {
  let release!: (value: { storeId: string; storeNo: number; storeKey: string }) => void;
  const auth = { createStore: vi.fn(() => new Promise(resolve => { release = resolve; })), getStoreSession: vi.fn() };
  const action = createStoreForSession({ auth } as unknown as AppPorts, { displayName: "Demo" });
  await waitFor(() => expect(release).toBeDefined());
  act(() => { requireCompatibilityUpdate(writeError("WRITE_PROTOCOL_UNSUPPORTED")); });
  release({ storeId: id(20), storeNo: 20, storeKey: "0020-ABCDEF" });
  await expect(action).resolves.toEqual({ store: { storeId: id(20), storeNo: 20, storeKey: "0020-ABCDEF" }, session: { storeId: id(20), storeNo: 20 } });
  expect(auth.getStoreSession).not.toHaveBeenCalled();
});

test("startup and global query/mutation errors independently latch the update gate", async () => {
  sessionQuery.error = writeError("WRITE_PROTOCOL_UNSUPPORTED");
  render(<App />);
  expect(await screen.findByTestId("compatibility-update-gate")).toBeVisible();
  cleanup(); useAppStore.setState({ updateRequired: false }); sessionQuery.error = null;

  const queryClient = createCompatibilityQueryClient();
  await expect(queryClient.fetchQuery({ queryKey: ["startup"], queryFn: async () => { throw writeError("WRITE_PROTOCOL_UNSUPPORTED"); } })).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED" });
  render(<App />);
  expect(await screen.findByTestId("compatibility-update-gate")).toBeVisible();
  cleanup(); useAppStore.setState({ updateRequired: false });

  await expect(queryClient.getMutationCache().build(queryClient, { mutationFn: async () => { throw writeError("WRITE_PROTOCOL_UNSUPPORTED"); } }).execute(undefined)).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED" });
  render(<App />);
  expect(await screen.findByTestId("compatibility-update-gate")).toBeVisible();
  queryClient.clear();
});

test("late authority success and session begin cannot clear the compatibility latch", async () => {
  const candidate = await createCandidateRuntimeFixture();
  const store = usePermissionSession.getState();
  act(() => { notifyUiError(writeError("WRITE_PROTOCOL_UNSUPPORTED")); });
  expect(usePermissionSession.getState()).toMatchObject({ compatibilityBlocked: true, status: "unavailable" });
  act(() => {
    store.setStatus("verified");
    store.apply(candidate.session.authority);
    store.begin(candidate.session);
  });
  expect(usePermissionSession.getState()).toMatchObject({ compatibilityBlocked: true, status: "unavailable" });
});

test("a capabilities mismatch stops before registration and retains no local K", async () => {
  const repo = {
    capabilities: vi.fn(async () => { throw writeError("WRITE_PROTOCOL_UNSUPPORTED"); }), register: vi.fn(), execute: vi.fn(),
    executeForInitialReceipt: vi.fn(), get: vi.fn(), list: vi.fn(), cancel: vi.fn(),
  } as unknown as IWriteOperationRepo;
  const coordinator = getWriteCoordinator(repo);
  await expect(coordinator.begin(payload)).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED" });
  expect(coordinator.snapshot()).toBeNull();
  expect(repo.register).not.toHaveBeenCalled(); expect(repo.execute).not.toHaveBeenCalled();
});

test("a protocol mismatch latches the update UI, reload action, and suspends an in-flight K without replay", async () => {
  let release!: (value: OperationView) => void;
  const repo: IWriteOperationRepo = {
    capabilities: vi.fn(async () => ({ writeProtocolVersion: 1, maxPayloadBytes: 262144, pendingTtlSeconds: 86400 })),
    register: vi.fn(() => new Promise(resolve => { release = resolve; })), execute: vi.fn(), executeForInitialReceipt: vi.fn(),
    get: vi.fn(), list: vi.fn(), cancel: vi.fn(),
  } as IWriteOperationRepo;
  const ports = { write: repo } as AppPorts;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><WriteLifecycle /><App /></QueryClientProvider></PortsContext.Provider>);
  const coordinator = getWriteCoordinator(repo);
  const inFlight = coordinator.begin(payload).catch(() => undefined);
  await waitFor(() => expect(repo.register).toHaveBeenCalledOnce());
  const operationId = coordinator.snapshot()!.operationId;

  act(() => { notifyUiError(writeError("WRITE_PROTOCOL_UNSUPPORTED")); });
  expect(await screen.findByTestId("compatibility-update-gate")).toHaveTextContent("Phiên bản ứng dụng chưa tương thích. Vui lòng tải phiên bản mới trước khi tiếp tục.");
  expect(screen.queryByTestId("landing")).not.toBeInTheDocument();
  expect(coordinator.snapshot()).toMatchObject({ operationId, status: "unknown", payload });
  expect(coordinator.snapshot()?.payload).toEqual(payload);
  await expect(coordinator.begin({ ...payload, paymentId: id(9) })).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED" });
  expect(repo.register).toHaveBeenCalledOnce();
  expect(repo.cancel).not.toHaveBeenCalled(); expect(repo.get).not.toHaveBeenCalled(); expect(repo.execute).not.toHaveBeenCalled();

  cleanup();
  const reload = vi.fn();
  render(<CompatibilityUpdateGate reload={reload} />);
  fireEvent.click(screen.getByRole("button", { name: "Tải lại ứng dụng" }));
  expect(reload).toHaveBeenCalledOnce();
  release(pending(operationId));
  await inFlight;
  expect(repo.execute).not.toHaveBeenCalled();
});
