import { create } from "zustand";
import type {
  AuthorityBundle, NormalPermissionSession, PermissionCode, PermissionSession, RequiredPinSession,
} from "@/domain/permissions";
import type { PermissionLifecycleStatus } from "@/core/permissionLifecycle";
import { hasCatalogPermission } from "@/core/permissionAuthority";
import { AppError } from "@/core/appError";
import { writeError } from "@/core/writeErrors";
import type { AppPorts } from "@/ports";
import type { QueryClient } from "@tanstack/react-query";

type SessionState = {
  compatibilityBlocked: boolean;
  session: NormalPermissionSession | null;
  requiredPinSession: RequiredPinSession | null;
  bundle: AuthorityBundle | null;
  status: PermissionLifecycleStatus;
  generation: number;
  begin(session: PermissionSession): void;
  beginRequiredPinChange(session: RequiredPinSession): void;
  clearRequiredPinChange(): void;
  clear(): void;
  apply(bundle: AuthorityBundle): void;
  setStatus(status: PermissionLifecycleStatus): void;
  blockCompatibility(): void;
};

/** Credential-free, memory-only view. Identity generation never changes for a permission refresh. */
export const usePermissionSession = create<SessionState>((set) => ({
  session: null, requiredPinSession: null, bundle: null, status: "unverified", generation: 0, compatibilityBlocked: false,
  begin: session => {
    if (session.kind !== "normal" || session.pinChangeRequired !== false) {
      throw new AppError("PIN_CHANGE_REQUIRED", "Bạn cần đổi PIN tạm trước khi sử dụng quán.");
    }
    set(state => state.compatibilityBlocked ? state
      : { session, requiredPinSession: null, bundle: session.authority, status: "verified", generation: state.generation + 1 });
  },
  beginRequiredPinChange: session => set(state => state.compatibilityBlocked ? state : ({
    session: null, requiredPinSession: session, bundle: null, status: "unverified", generation: state.generation + 1,
  })),
  clearRequiredPinChange: () => set(state => ({
    requiredPinSession: null, bundle: null, status: "unverified", generation: state.generation + 1,
  })),
  clear: () => set(state => ({ session: null, requiredPinSession: null, bundle: null, status: "unverified", generation: state.generation + 1 })),
  apply: bundle => set(state => state.compatibilityBlocked || !state.session || state.requiredPinSession ? state : { bundle }),
  setStatus: status => set(state => state.compatibilityBlocked || !state.session || state.requiredPinSession ? state : { status }),
  blockCompatibility: () => set(state => ({ compatibilityBlocked: true, session: null, requiredPinSession: null,
    bundle: null, status: "unavailable", generation: state.generation + 1 })),
}));

export function assertCompatibilityCurrent(): void {
  if (usePermissionSession.getState().compatibilityBlocked) throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
}
export const isCompatibilityBlocked = (): boolean => usePermissionSession.getState().compatibilityBlocked;

export function sessionHasPermission(code: PermissionCode, state = usePermissionSession.getState()): boolean {
  return state.session?.kind === "normal" && state.session.pinChangeRequired === false && !state.requiredPinSession
    && state.status === "verified" && !!state.bundle
    && hasCatalogPermission(state.bundle.catalog, { status: "verified", snapshot: state.bundle.snapshot }, code);
}

export const usePermission = (code: PermissionCode) => usePermissionSession(state => sessionHasPermission(code, state));

export async function requireCurrentPermission(ports: AppPorts, actor: { id: string } | null, code: PermissionCode): Promise<void> {
  assertCompatibilityCurrent();
  if (!ports.permission) throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
  const bundle = await ports.permission.authority.getAuthority();
  assertCompatibilityCurrent();
  if (!actor || bundle.snapshot.employeeId !== actor.id
    || !hasCatalogPermission(bundle.catalog, { status: "verified", snapshot: bundle.snapshot }, code))
    throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
}

export const permissionQueryKey = (purpose: string, ...parts: unknown[]) => {
  const state = usePermissionSession.getState(), identity = state.bundle?.snapshot;
  return ["permission", identity?.storeId ?? null, identity?.employeeId ?? null, state.generation, purpose, ...parts] as const;
};

export const invalidatePermissionPurposes = (client: QueryClient, purposes: readonly string[]) =>
  client.invalidateQueries({ predicate: query => query.queryKey[0] === "permission" && purposes.includes(String(query.queryKey[4])) });

/** An old response must not refill a cache after logout, switching employees or losing its read capability. */
export async function permissionRead<T>(codes: readonly PermissionCode[], read: () => Promise<T>): Promise<T> {
  const before = usePermissionSession.getState();
  const allowed = () => {
    const now = usePermissionSession.getState();
    return now.generation === before.generation && now.status === "verified" && !!now.bundle
      && now.bundle.snapshot.employeeRevision === before.bundle?.snapshot.employeeRevision
      && now.bundle.snapshot.catalogRevision === before.bundle?.snapshot.catalogRevision
      && (codes.length === 0 || codes.some(code => sessionHasPermission(code, now)));
  };
  if (!allowed()) throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  const data = await read();
  if (!allowed()) throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  return data;
}
