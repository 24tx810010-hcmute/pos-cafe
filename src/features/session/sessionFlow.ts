import { AppError } from "@/core/appError";
import { writeError } from "@/core/writeErrors";
import type { CreateStoreInput, CreateStoreResult, StoreSession } from "@/domain";
import type { PermissionSession } from "@/domain/permissions";
import type { AppPorts } from "@/ports";
import { assertCompatibilityCurrent, isCompatibilityBlocked } from "@/features/shared/permissionSession";

export type StoreSessionBootstrap =
  | {
      status: "paired";
      session: StoreSession;
    }
  | {
      status: "unpaired";
      session: null;
    };

export type CreateStoreFlowResult = {
  store: CreateStoreResult;
  session: StoreSession;
};

const requirePairedSession = (session: StoreSession | null): StoreSession => {
  if (!session) {
    throw new AppError("AUTH_REQUIRED", "Phiên cửa hàng không hợp lệ.");
  }

  return session;
};

export const loadStoreSession = async (ports: AppPorts): Promise<StoreSessionBootstrap> => {
  assertCompatibilityCurrent();
  const session = await ports.auth.getStoreSession();

  if (!session) {
    return { status: "unpaired", session: null };
  }

  return { status: "paired", session };
};

export const pairStoreForSession = async (ports: AppPorts, storeKey: string): Promise<StoreSession> => {
  assertCompatibilityCurrent();
  await ports.auth.pairStore(storeKey);
  return requirePairedSession(await ports.auth.getStoreSession());
};

export const createStoreForSession = async (
  ports: AppPorts,
  input: CreateStoreInput,
  onStoreCreated?: (store: CreateStoreResult) => void,
): Promise<CreateStoreFlowResult> => {
  assertCompatibilityCurrent();
  const store = await ports.auth.createStore(input);
  onStoreCreated?.(store);
  const fallback = {
    storeId: store.storeId,
    storeNo: store.storeNo,
  };
  const session = isCompatibilityBlocked() ? fallback : (await ports.auth.getStoreSession()) ?? fallback;

  return { store, session };
};

export const retrySeedForSession = async (ports: AppPorts, session: StoreSession): Promise<void> => {
  assertCompatibilityCurrent();
  await ports.seed.retrySeedDemo(session.storeId);
};

export const verifyEmployeeForSession = async (
  ports: AppPorts,
  employeeId: string,
  pin: string,
): Promise<PermissionSession> => {
  assertCompatibilityCurrent();
  if (!/^[0-9]{6}$/.test(pin)) throw new AppError("INVALID_PIN", "PIN không đúng. Vui lòng thử lại.");
  if (!ports.permission) throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
  return ports.permission.session.startSession(employeeId, pin);
};

export const unpairStoreSession = async (ports: AppPorts): Promise<void> => {
  assertCompatibilityCurrent();
  await ports.auth.unpairStore();
};
