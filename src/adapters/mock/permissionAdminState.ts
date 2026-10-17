import type { EmployeeAuditEntry } from "@/domain/permissions";
import type { AppErrorCode } from "@/core/appError";
import type { MockPermissionState } from "./permissionState";

// Shared by staged identity/admin adapters, never part of application state or Realtime.
const audits = new WeakMap<MockPermissionState, EmployeeAuditEntry[]>();
export type MockPermissionRequestReservation = { kind: string; canonicalPayload: string };
const reservations = new WeakMap<MockPermissionState, Map<string, MockPermissionRequestReservation>>();
export type MockPermissionClearRecord = {
  canonicalPayload: string;
  outcome: "applied" | "noop";
  error?: { code: AppErrorCode; message: string; cause?: unknown };
};
const clearRecords = new WeakMap<MockPermissionState, Map<string, MockPermissionClearRecord>>();
const clearTails = new WeakMap<MockPermissionState, Promise<void>>();
export async function withMockPermissionClearLock<T>(state: MockPermissionState, action: () => Promise<T>): Promise<T> {
  const previous = clearTails.get(state) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.catch(() => undefined).then(() => current);
  clearTails.set(state, tail);
  await previous.catch(() => undefined);
  try {
    return await action();
  } finally {
    release();
    if (clearTails.get(state) === tail) void tail.then(() => { if (clearTails.get(state) === tail) clearTails.delete(state); });
  }
}
export function mockPermissionRequestReservations(state: MockPermissionState) {
  let registry = reservations.get(state);
  if (!registry) { registry = new Map(); reservations.set(state, registry); }
  return registry;
}
export function mockPermissionClearRecords(state: MockPermissionState) {
  let registry = clearRecords.get(state);
  if (!registry) { registry = new Map(); clearRecords.set(state, registry); }
  return registry;
}
export function mockPermissionAuditRows(state: MockPermissionState): EmployeeAuditEntry[] {
  let rows = audits.get(state);
  if (!rows) { rows = []; audits.set(state, rows); }
  return rows;
}
