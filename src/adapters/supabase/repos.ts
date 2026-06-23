
import type { AppPorts } from "@/ports";
import { BrowserPrintPort } from "../browser/printPort";
import { SupabaseAuthRepo } from "./authRepo";
import { SupabaseEmployeeRepo } from "./employeeRepo";
import { SupabaseFloorPlanRepo } from "./floorPlanRepo";
import { SupabaseMenuRepo } from "./menuRepo";
import { SupabaseMenuImagePort } from "./menuImagePort";
import { SupabaseOrderRepo } from "./orderRepo";
import { SupabasePaymentRepo } from "./paymentRepo";
import { SupabaseRealtimePort } from "./realtimePort";
import { SupabaseReportRepo } from "./reportRepo";
import { SupabaseSeedRepo } from "./seedRepo";
import { SupabaseSettingsRepo } from "./settingsRepo";
import type { SupabaseAnyClient } from "./repoShared";

export const createSupabasePorts = (client: SupabaseAnyClient): AppPorts => {
  const seed = new SupabaseSeedRepo(client);

  return {
    auth: new SupabaseAuthRepo(client, seed),
    employee: new SupabaseEmployeeRepo(client),
    menu: new SupabaseMenuRepo(client),
    menuImages: new SupabaseMenuImagePort(client),
    floorPlan: new SupabaseFloorPlanRepo(client),
    order: new SupabaseOrderRepo(client),
    payment: new SupabasePaymentRepo(client),
    report: new SupabaseReportRepo(client),
    settings: new SupabaseSettingsRepo(client),
    seed,
    print: new BrowserPrintPort(),
    realtime: new SupabaseRealtimePort(client),
  };
};
