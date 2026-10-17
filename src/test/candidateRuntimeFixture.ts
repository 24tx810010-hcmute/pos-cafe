import { createMockPermissionRuntime, createMockPermissionState, createMockPorts } from "@/adapters/mock";
import type { AppPorts } from "@/ports";
import type { PermissionOverrides, PermissionRole } from "@/domain/permissions";
import { useAppStore } from "@/app/useAppStore";

/** Test-only composition mirroring production while exposing business state for assertions. */
export async function createCandidateRuntimeFixture(options: { demoCredentials?: boolean; role?: PermissionRole; overrides?: PermissionOverrides } = {}) {
  const state = createMockPermissionState({ demoCredentials: options.demoCredentials });
  const runtime = createMockPermissionRuntime(state);
  const legacyPorts = createMockPorts(state.business);
  const ports: AppPorts = {
    permission: {
      authority: runtime.authority, employeeAdmin: runtime.employeeAdmin, read: runtime.read,
      session: runtime.session, changes: runtime.changes, signals: runtime.signals,
      initialSeed: runtime.initialSeed,
      menuImages: runtime.menuImages, print: runtime.print,
    },
    write: runtime.write, auth: runtime.auth, seed: runtime.seed, print: runtime.legacyPrint,
  };
  const employee = state.employees.find(candidate => candidate.role === (options.role ?? "owner"))!;
  if (options.overrides) employee.overrides = options.overrides;
  const pin = options.demoCredentials ? (employee.role === "owner" ? "123456" : employee.role === "cashier" ? "111111" : "384729") : "384729";
  const session = await runtime.session.startSession(employee.id, pin);
  if (session.kind !== "normal") throw new Error("Established candidate fixture requires a normal employee session");
  const actor = { id: employee.id, name: employee.name };
  return { state, business: state.business, runtime, ports, legacyPorts, actor, owner: employee, pin, session,
    rosterEmployee: { id: employee.id, name: employee.name } };
}

export function activateCandidateUi(fixture: Awaited<ReturnType<typeof createCandidateRuntimeFixture>>): void {
  useAppStore.getState().startEmployeeSession(fixture.rosterEmployee, fixture.session);
}
