import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { InitialSeedStatus, NormalPermissionSession } from "@/domain/permissions";
import type { AppPorts } from "@/ports";
import { PortsContext } from "@/features/shared/portsContext";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { useAppStore } from "./useAppStore";
import { InitialSeedLifecycle } from "./InitialSeedLifecycle";

const session = { kind: "normal", pinChangeRequired: false, issuedAt: "2026-10-09T00:00:00.000Z", expiresAt: "2026-10-09T12:00:00.000Z",
  authority: { catalog: { contractVersion: 1, revision: 1, roles: [], permissions: [], defaults: [] },
    snapshot: { storeId: "store-1", employeeId: "owner-1", role: "owner", active: true, employeeRevision: 1,
      catalogRevision: 1, permissions: [], sources: [] } } } as NormalPermissionSession;

beforeEach(() => {
  usePermissionSession.setState({ compatibilityBlocked: false, session: null, requiredPinSession: null,
    bundle: null, status: "unverified", generation: 0 });
  usePermissionSession.getState().begin(session);
  useAppStore.setState({ currentEmployee: { id: "owner-1", name: "Chủ quán" }, sessionNotice: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(["in_progress", "needs_retry", "completed", "skipped"] as const)(
  "TC-PIN-13 status %s is read-only on mount, focus and reconnect", async state => {
    const status: InitialSeedStatus = {
      workflowId: "workflow-1", status: state, workflowRevision: 4, autoEligible: false,
      runGeneration: 1, lastErrorCode: null,
      stages: (["employee", "menu", "floor"] as const).map((stage, index) => ({ stage, stageId: `stage-${index}`,
        status: state === "completed" ? "committed" : "pending", committedAt: state === "completed" ? "2026-10-09T00:00:00.000Z" : null })),
    };
    const initialSeed = { getStatus: vi.fn(async () => status), begin: vi.fn(), runStage: vi.fn() };
    const ports = { permission: { initialSeed } } as unknown as AppPorts;
    render(<PortsContext.Provider value={ports}><InitialSeedLifecycle /></PortsContext.Provider>);
    await waitFor(() => expect(initialSeed.getStatus).toHaveBeenCalledOnce());
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    await Promise.resolve();
    expect(initialSeed.begin).not.toHaveBeenCalled();
    expect(initialSeed.runStage).not.toHaveBeenCalled();
    if (state === "completed" || state === "skipped") expect(screen.queryByTestId("initial-seed-status")).not.toBeInTheDocument();
    else expect(await screen.findByTestId("retry-initial-seed")).toBeVisible();
  },
);
