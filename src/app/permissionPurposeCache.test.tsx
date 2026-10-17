import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { createCandidateRuntimeFixture, activateCandidateUi } from "@/test/candidateRuntimeFixture";
import { PortsContext } from "@/features/shared/portsContext";
import { permissionQueryKey } from "@/features/shared/permissionSession";
import type { PermissionCode } from "@/domain/permissions";
import { PermissionLifecycle } from "./PermissionLifecycle";
import { MockPermissionSignalPort } from "@/adapters/mock/permissionSignalPort";

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe("TC-PERM-59 purpose cache purge matrix", () => {
  it("invalidates protected menu and floor caches after Realtime reconnect", async () => {
    const fixture = await createCandidateRuntimeFixture({ role: "owner" }); activateCandidateUi(fixture);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
    const menuKey = permissionQueryKey("pos-menu");
    const floorKey = permissionQueryKey("floor");
    client.setQueryData(menuKey, { revision: 1 });
    client.setQueryData(floorKey, { revision: 1 });
    render(<PortsContext.Provider value={fixture.ports}><QueryClientProvider client={client}><PermissionLifecycle /></QueryClientProvider></PortsContext.Provider>);
    act(() => (fixture.runtime.signals as MockPermissionSignalPort).reconnect());
    await waitFor(() => {
      expect(client.getQueryState(menuKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(floorKey)?.isInvalidated).toBe(true);
    });
  });
  it.each([
    [["order.create", "order.update"], ["pos-menu"], ["floor", "history"]],
    [["order.update", "order.voidOpen", "payment.take"], ["open-order"], ["floor", "history"]],
    [["orderHistory.view"], ["history", "history-detail"], ["report", "floor"]],
    [["report.view"], ["report", "report-orders"], ["history", "floor"]],
    [["employee.manage", "employee.permission.edit"], ["employees"], ["menu-admin", "floor"]],
    [["menu.manage"], ["menu-admin"], ["pos-menu", "floor"]],
    [["floor.manage"], ["floor-admin"], ["floor", "menu-admin"]],
    [["settings.manage"], ["settings"], ["display", "report"]],
  ] as const)("revoking %s removes only purposes that no longer have an allowed permission", async (lost, removed, retained) => {
    const fixture = await createCandidateRuntimeFixture({ role: "owner" }); activateCandidateUi(fixture);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
    for (const purpose of [...removed, ...retained]) client.setQueryData(permissionQueryKey(purpose), { purpose });
    render(<PortsContext.Provider value={fixture.ports}><QueryClientProvider client={client}><PermissionLifecycle /></QueryClientProvider></PortsContext.Provider>);
    fixture.owner.overrides = { grants: [], denies: [...lost] as PermissionCode[] }; fixture.owner.permissionRevision++;
    act(() => fixture.runtime.signals.emitStore({ storeId: fixture.state.storeId, topic: "permission", revision: fixture.owner.permissionRevision,
      eventId: crypto.randomUUID(), targetId: fixture.owner.id }));
    await waitFor(() => removed.forEach(purpose => expect(client.getQueryData(permissionQueryKey(purpose))).toBeUndefined()));
    for (const purpose of retained) expect(client.getQueryData(permissionQueryKey(purpose))).toEqual({ purpose });
  });
});
