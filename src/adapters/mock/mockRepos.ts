import type { AppPorts } from "@/ports";
import { MockAuthRepo } from "./authRepo";
import { MockEmployeeRepo } from "./employeeRepo";
import { MockFloorPlanRepo } from "./floorPlanRepo";
import { MockMenuRepo } from "./menuRepo";
import { MockMenuImagePort } from "./menuImagePort";
import { MockOrderRepo } from "./orderRepo";
import { MockPaymentRepo } from "./paymentRepo";
import { MockPrintPort } from "./printPort";
import { MockRealtimePort } from "./realtimePort";
import { MockReportRepo } from "./reportRepo";
import { MockSeedRepo } from "./seedRepo";
import { MockSettingsRepo } from "./settingsRepo";
import { createMockState, type MockState } from "./mockState";
import { MockWriteOperationRepo } from "./writeOperationRepo";

export { createMockState, createSeededMockState } from "./mockState";
export type { MockState } from "./mockState";

export const createMockPorts = (state: MockState = createMockState()): AppPorts => {
  const credential = { token: null as string | null };
  return ({
  write: new MockWriteOperationRepo(state, credential),
  auth: new MockAuthRepo(state, credential),
  employee: new MockEmployeeRepo(state, credential),
  menu: new MockMenuRepo(state),
  menuImages: new MockMenuImagePort(),
  floorPlan: new MockFloorPlanRepo(state),
  order: new MockOrderRepo(state, credential),
  payment: new MockPaymentRepo(state),
  report: new MockReportRepo(state),
  settings: new MockSettingsRepo(state),
  seed: new MockSeedRepo(state),
  print: new MockPrintPort(state),
  realtime: new MockRealtimePort(),
});
};
