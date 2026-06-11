import { AppError } from "@/core/appError";
import type { CreateStoreInput, CreateStoreResult, Employee, StoreSession } from "@/domain";
import type { AppPorts } from "@/ports";

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
  const session = await ports.auth.getStoreSession();

  if (!session) {
    return { status: "unpaired", session: null };
  }

  return { status: "paired", session };
};

export const pairStoreForSession = async (ports: AppPorts, storeKey: string): Promise<StoreSession> => {
  await ports.auth.pairStore(storeKey);
  return requirePairedSession(await ports.auth.getStoreSession());
};

export const createStoreForSession = async (
  ports: AppPorts,
  input: CreateStoreInput,
): Promise<CreateStoreFlowResult> => {
  const store = await ports.auth.createStore(input);
  const session = (await ports.auth.getStoreSession()) ?? {
    storeId: store.storeId,
    storeNo: store.storeNo,
  };

  return { store, session };
};

export const retrySeedForSession = async (ports: AppPorts, session: StoreSession): Promise<void> => {
  await ports.seed.retrySeedDemo(session.storeId);
};

export const verifyEmployeeForSession = async (
  ports: AppPorts,
  employeeId: string,
  pin: string,
): Promise<Employee> => ports.employee.verifyPin(employeeId, pin);

export const unpairStoreSession = async (ports: AppPorts): Promise<void> => {
  await ports.auth.unpairStore();
};
