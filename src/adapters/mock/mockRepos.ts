import type { AppPorts } from "@/ports";
import { MockAuthRepo } from "./authRepo";
import { MockEmployeeRepo } from "./employeeRepo";
import { MockFloorPlanRepo } from "./floorPlanRepo";
import { MockMenuRepo } from "./menuRepo";
import { MockOrderRepo } from "./orderRepo";
import { MockPaymentRepo } from "./paymentRepo";
import { MockPrintPort } from "./printPort";
import { MockRealtimePort } from "./realtimePort";
import { MockReportRepo } from "./reportRepo";
import { MockSeedRepo } from "./seedRepo";
import { MockSettingsRepo } from "./settingsRepo";
import { createMockState, type MockState } from "./mockState";

export { createMockState } from "./mockState";
export type { MockState } from "./mockState";

export const createMockPorts = (state: MockState = createMockState()): AppPorts => ({
  auth: new MockAuthRepo(state),
  employee: new MockEmployeeRepo(state),
  menu: new MockMenuRepo(state),
  floorPlan: new MockFloorPlanRepo(state),
  order: new MockOrderRepo(state),
  payment: new MockPaymentRepo(state),
  report: new MockReportRepo(state),
  settings: new MockSettingsRepo(state),
  seed: new MockSeedRepo(),
  print: new MockPrintPort(state),
  realtime: new MockRealtimePort(),
});
