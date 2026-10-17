import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalogData from "@/seed/permissionCatalog.json";
import type { AuthorityBundle, PermissionCatalog, NormalPermissionSession } from "@/domain/permissions";
import { createAuthoritySnapshot } from "./permissionAuthority";
import { PermissionLifecycle } from "./permissionLifecycle";
import { AppError } from "./appError";

const bundle = (employeeRevision = 0): AuthorityBundle => {
  const catalog = structuredClone(catalogData) as PermissionCatalog;
  return { catalog, snapshot: createAuthoritySnapshot(catalog, {
    id: "30000000-0000-4000-8000-000000000011", storeId: "30000000-0000-4000-8000-000000000001",
    name: "Owner", role: "owner", isActive: true, permissionRevision: employeeRevision, overrides: null,
  }, true) };
};
const session = (): NormalPermissionSession => ({ kind: "normal", pinChangeRequired: false, authority: bundle(), issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 43_200_000).toISOString() });
function setup() {
  const input = { getRevision: vi.fn(async () => ({ employeeRevision: 0, catalogRevision: bundle().catalog.revision, serverTime: new Date().toISOString() })),
    getAuthority: vi.fn(async () => bundle()), apply: vi.fn(), status: vi.fn(), expired: vi.fn() };
  return { input, life: new PermissionLifecycle(input) };
}
describe("foreground authority lifecycle", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-17T10:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("reads only revisions every 30s and does not reapply a no-op snapshot", async () => {
    const { life, input } = setup(); life.start(session(), true);
    await vi.advanceTimersByTimeAsync(29_999); expect(input.getRevision).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(input.getRevision).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000); expect(input.getRevision).toHaveBeenCalledTimes(2);
    expect(input.getAuthority).not.toHaveBeenCalled(); expect(input.apply).toHaveBeenCalledTimes(1); life.stop();
  });
  it("reports an unsupported permission contract without expiring the employee identity", async () => {
    const { life, input } = setup();
    const unsupported = vi.fn();
    input.getRevision.mockRejectedValueOnce(new AppError("WRITE_PROTOCOL_UNSUPPORTED", "Ứng dụng cần được cập nhật trước khi tiếp tục."));
    const candidate = new PermissionLifecycle({ ...input, unsupported });
    candidate.start(session(), true);
    await candidate.refresh();
    expect(unsupported).toHaveBeenCalledOnce();
    expect(input.expired).not.toHaveBeenCalled();
    candidate.stop(); life.stop();
  });
  it("does not shift fallback cadence when a signal arrives", async () => {
    const { life, input } = setup(); life.start(session(), true);
    await vi.advanceTimersByTimeAsync(29_000); await life.refresh();
    await vi.advanceTimersByTimeAsync(1_000); expect(input.getRevision).toHaveBeenCalledTimes(2); life.stop();
  });
  it("restarts an older read on a committed signal without waiting for the old chain", async () => {
    const { life, input } = setup(); life.start(session(), true);
    input.getRevision.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ employeeRevision: 0, catalogRevision: bundle().catalog.revision, serverTime: new Date().toISOString() }), 4_000)));
    input.getRevision.mockResolvedValue({ employeeRevision: 1, catalogRevision: bundle().catalog.revision, serverTime: new Date().toISOString() });
    input.getAuthority.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(bundle(1)), 2_000)));
    void life.refresh(); await vi.advanceTimersByTimeAsync(1_000); void life.signal();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(input.apply).toHaveBeenLastCalledWith(bundle(1), bundle());
    await vi.advanceTimersByTimeAsync(2_000);
    expect(input.apply).toHaveBeenCalledTimes(2); expect(input.status).toHaveBeenLastCalledWith("verified"); life.stop();
  });
  it("fails closed at the original deadline under a continuous signal storm and recovers after it stops", async () => {
    const { life, input } = setup(); life.start(session(), true);
    input.getRevision.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ employeeRevision: 1, catalogRevision: bundle().catalog.revision, serverTime: new Date().toISOString() }), 4_000)));
    input.getAuthority.mockResolvedValue(bundle(1));
    void life.signal();
    for (let i = 0; i < 4; i++) { await vi.advanceTimersByTimeAsync(1_000); void life.signal(); }
    await vi.advanceTimersByTimeAsync(1_000);
    expect(input.status).toHaveBeenLastCalledWith("unavailable"); expect(input.apply).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 30; i++) { void life.signal(); await vi.advanceTimersByTimeAsync(1_000); }
    expect(input.status).toHaveBeenLastCalledWith("unavailable"); expect(input.apply).toHaveBeenCalledTimes(1);
    void life.signal(); await vi.advanceTimersByTimeAsync(4_000);
    expect(input.status).toHaveBeenLastCalledWith("verified"); expect(input.apply).toHaveBeenLastCalledWith(bundle(1), bundle());
    life.stop();
  });
  it("stops hidden polling and gates resume synchronously", async () => {
    const { life, input } = setup(); life.start(session(), true); life.hide();
    await vi.advanceTimersByTimeAsync(90_000); expect(input.getRevision).not.toHaveBeenCalled();
    const resumed = life.resume(); expect(input.status).toHaveBeenLastCalledWith("unverified");
    await resumed; expect(input.status).toHaveBeenLastCalledWith("verified"); life.stop();
  });
  it("rejects a pre-resume in-flight response and fetches fresh authority", async () => {
    const { life, input } = setup(); life.start(session(), true);
    let release!: (revision: Awaited<ReturnType<typeof input.getRevision>>) => void;
    input.getRevision.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const old = life.refresh(); life.hide(); await life.resume();
    release({ employeeRevision: 10, catalogRevision: bundle().catalog.revision, serverTime: new Date().toISOString() });
    await old; expect(input.getAuthority).not.toHaveBeenCalled(); expect(input.getRevision).toHaveBeenCalledTimes(2); life.stop();
  });
  it("bounds the whole revision + snapshot chain at 5s and discards late data", async () => {
    const { life, input } = setup(); life.start(session(), true);
    input.getRevision.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ employeeRevision: 1, catalogRevision: bundle().catalog.revision, serverTime: new Date().toISOString() }), 3_000)));
    input.getAuthority.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(bundle(1)), 3_000)));
    const read = life.refresh(); await vi.advanceTimersByTimeAsync(5_000); await read;
    expect(input.status).toHaveBeenLastCalledWith("unavailable"); expect(input.expired).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000); expect(input.apply).toHaveBeenCalledTimes(1); life.stop();
  });
  it("applies changed authority before allowing rendering", async () => {
    const { life, input } = setup(); life.start(session(), true);
    input.getRevision.mockResolvedValue({ employeeRevision: 1, catalogRevision: bundle().catalog.revision, serverTime: new Date().toISOString() });
    input.getAuthority.mockResolvedValue(bundle(1)); await life.resume();
    expect(input.apply).toHaveBeenLastCalledWith(bundle(1), bundle());
    expect(input.apply.mock.invocationCallOrder[input.apply.mock.invocationCallOrder.length - 1]).toBeLessThan(input.status.mock.invocationCallOrder[input.status.mock.invocationCallOrder.length - 1]); life.stop();
  });
  it("locks revoked sessions, including when hidden at expiry", async () => {
    const { life, input } = setup(); life.start(session(), true);
    input.getRevision.mockRejectedValue(new AppError("EMPLOYEE_SESSION_REQUIRED", "expired"));
    await life.refresh(); expect(input.expired).toHaveBeenCalledTimes(1);
    life.start(session(), false); await vi.advanceTimersByTimeAsync(43_200_000); expect(input.expired).toHaveBeenCalledTimes(2);
  });
  it("old generation cannot replace another login", async () => {
    const { life, input } = setup(); life.start(session(), true);
    let release!: (bundle: AuthorityBundle) => void;
    input.getRevision.mockResolvedValue({ employeeRevision: 1, catalogRevision: bundle().catalog.revision, serverTime: new Date().toISOString() });
    input.getAuthority.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const old = life.refresh(); await Promise.resolve(); life.stop(); life.start(session(), true);
    release(bundle(1)); await old; expect(input.apply).toHaveBeenCalledTimes(2); life.stop();
  });
});
