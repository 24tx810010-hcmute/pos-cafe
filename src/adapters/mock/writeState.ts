import type { Employee, OperationView, OrderItemSnapshot, WritePayloadV1 } from "@/domain";
import { hasPermission } from "@/core/guards";
import { writePermission } from "@/core/writePayload";
import { writeError } from "@/core/writeErrors";
import type { MockState } from "./mockState";

export type MockEmployeeCredential = { token: string | null };
export type MockWriteState = {
  operations: Record<string, OperationView>;
  sessions: Record<string, { storeId: string; employeeId: string; expiresAt: number; revoked: boolean }>;
  events: { operationId: string; sourceOrderId: string; resultOrderId: string | null; paymentId: string | null; initiatedBy: string; executedBy: string; occurredAt: string; beforeVersion: number | null; afterVersion: number }[];
  removedItems: { orderId: string; item: OrderItemSnapshot }[];
  now: () => number;
  // Unit tests only: no claim these seams exercise PostgreSQL locks or rollback.
  fault?: (stage: "after_business" | "before_commit") => void;
  beforeCheckpoint?: () => void;
};
const stores = new WeakMap<MockState, MockWriteState>();
export const mockWriteState = (state: MockState): MockWriteState => {
  let writes = stores.get(state);
  if (!writes) { writes = { operations: {}, sessions: {}, events: [], removedItems: [], now: () => Date.now() }; stores.set(state, writes); }
  return writes;
};
export const mockActor = (state: MockState, credential: MockEmployeeCredential, payload?: WritePayloadV1): Employee => {
  if (!state.session) throw writeError("AUTH_REQUIRED");
  const writes = mockWriteState(state);
  const session = credential.token ? writes.sessions[credential.token] : null;
  const employee = state.employees.find(e => e.id === session?.employeeId);
  if (!session || session.storeId !== state.session.storeId || session.revoked || writes.now() >= session.expiresAt || !employee?.isActive) throw writeError("EMPLOYEE_SESSION_REQUIRED");
  if (payload && !hasPermission(employee, writePermission(payload))) throw writeError("FORBIDDEN");
  return employee;
};
