import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/core/appError";
import type { InitialSeedStatus, NormalPermissionSession } from "@/domain/permissions";
import type { AppPorts } from "@/ports";
import { PortsContext } from "@/features/shared/portsContext";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { useAppStore } from "./useAppStore";
import { InitialSeedLifecycle } from "./InitialSeedLifecycle";

const receipts = (committed: string[] = []) => (["employee", "menu", "floor"] as const).map((stage, index) => ({
  stage, stageId: `stage-${index}`, status: committed.includes(stage) ? "committed" as const : "pending" as const,
  committedAt: committed.includes(stage) ? "2026-09-22T00:00:00.000Z" : null,
}));
const status = (state: InitialSeedStatus["status"], committed: string[] = [], revision = 0): InitialSeedStatus => ({
  workflowId: "workflow-1", status: state, workflowRevision: revision, autoEligible: state === "pending",
  runGeneration: state === "pending" ? 0 : 1, lastErrorCode: null, stages: receipts(committed),
});
const normalSession = { kind: "normal", pinChangeRequired: false, issuedAt: "2026-09-22T00:00:00.000Z", expiresAt: "2026-09-22T12:00:00.000Z",
  authority: { catalog: { contractVersion: 1, revision: 1, roles: [], permissions: [], defaults: [] },
    snapshot: { storeId: "store-1", employeeId: "owner-1", role: "owner", active: true, employeeRevision: 1, catalogRevision: 1,
      permissions: [], sources: [] } } } as NormalPermissionSession;

const setup = (initial: InitialSeedStatus) => {
  let current = initial;
  const initialSeed = {
    getStatus: vi.fn(async () => current),
    begin: vi.fn(async () => ({ acquired: true, runGeneration: 7, workflowRevision: current.workflowRevision + 1 })),
    runStage: vi.fn(async ({ stage }: { stage: "employee" | "menu" | "floor" }) => {
      const committed = current.stages.filter(item => item.status === "committed").map(item => item.stage);
      if (!committed.includes(stage)) committed.push(stage);
      current = status(committed.length === 3 ? "completed" : "in_progress", committed, current.workflowRevision + 1);
      return current;
    }),
  };
  return { ports: { permission: { initialSeed } } as unknown as AppPorts, initialSeed };
};

beforeEach(() => {
  usePermissionSession.setState({ compatibilityBlocked: false, session: null, requiredPinSession: null,
    bundle: null, status: "unverified", generation: 0 });
  usePermissionSession.getState().begin(normalSession);
  useAppStore.setState({ currentEmployee: { id: "owner-1", name: "Chủ quán" }, sessionNotice: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("initial seed lifecycle", () => {
  it("reads status, claims the first eligible pending workflow once and runs stages sequentially", async () => {
    const { ports, initialSeed } = setup(status("pending"));
    render(<PortsContext.Provider value={ports}><InitialSeedLifecycle /></PortsContext.Provider>);
    await waitFor(() => expect(initialSeed.runStage).toHaveBeenCalledTimes(3));
    expect(initialSeed.getStatus).toHaveBeenCalled();
    expect(initialSeed.begin).toHaveBeenCalledOnce();
    expect(initialSeed.begin).toHaveBeenCalledWith({ mode: "initial", expectedWorkflowRevision: 0 });
    expect(initialSeed.runStage.mock.calls.map(([request]) => request.stage)).toEqual(["employee", "menu", "floor"]);
    await waitFor(() => expect(screen.queryByTestId("initial-seed-status")).not.toBeInTheDocument());
  });

  it("shows read-only interrupted status and waits for an explicit retry", async () => {
    const interrupted = status("needs_retry", ["employee"], 4);
    const { ports, initialSeed } = setup(interrupted);
    render(<PortsContext.Provider value={ports}><InitialSeedLifecycle /></PortsContext.Provider>);
    expect(await screen.findByTestId("retry-initial-seed")).toBeVisible();
    expect(initialSeed.begin).not.toHaveBeenCalled();
    expect(initialSeed.runStage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("retry-initial-seed"));
    await waitFor(() => expect(initialSeed.runStage).toHaveBeenCalledTimes(2));
    expect(initialSeed.begin).toHaveBeenCalledWith({ mode: "retry", expectedWorkflowRevision: 4 });
    expect(initialSeed.runStage.mock.calls.map(([request]) => request.stage)).toEqual(["menu", "floor"]);
  });

  it("does not claim from a stale status callback after logout", async () => {
    const { ports, initialSeed } = setup(status("pending"));
    let release!: (value: InitialSeedStatus) => void;
    initialSeed.getStatus.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    render(<PortsContext.Provider value={ports}><InitialSeedLifecycle /></PortsContext.Provider>);
    await waitFor(() => expect(initialSeed.getStatus).toHaveBeenCalledOnce());
    act(() => usePermissionSession.getState().clear());
    await act(async () => release(status("pending")));
    expect(initialSeed.begin).not.toHaveBeenCalled();
    expect(initialSeed.runStage).not.toHaveBeenCalled();
  });

  it("recovers an initial status-read failure without writing until a second explicit action", async () => {
    const pending = status("pending");
    const { ports, initialSeed } = setup(pending);
    initialSeed.getStatus.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(pending);
    render(<PortsContext.Provider value={ports}><InitialSeedLifecycle /></PortsContext.Provider>);
    expect(await screen.findByTestId("refresh-initial-seed-status")).toBeVisible();
    expect(initialSeed.begin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("refresh-initial-seed-status"));
    expect(await screen.findByTestId("retry-initial-seed")).toBeVisible();
    expect(initialSeed.getStatus).toHaveBeenCalledTimes(2);
    expect(initialSeed.begin).not.toHaveBeenCalled();
    expect(initialSeed.runStage).not.toHaveBeenCalled();
  });

  it("shows the exact conflict notice and requires an explicit retry when a seed ID already exists", async () => {
    const { ports, initialSeed } = setup(status("pending"));
    initialSeed.runStage.mockRejectedValueOnce(new AppError("ENTITY_ID_CONFLICT", "collision"));
    render(<PortsContext.Provider value={ports}><InitialSeedLifecycle /></PortsContext.Provider>);
    expect(await screen.findByText("Dữ liệu hiện có trùng với dữ liệu mẫu. Đã dừng để giữ các thay đổi của quán.")).toBeVisible();
    expect(screen.getByTestId("retry-initial-seed")).toBeVisible();
    expect(initialSeed.runStage).toHaveBeenCalledTimes(1);
  });
});
