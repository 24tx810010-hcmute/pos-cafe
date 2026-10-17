
import type { AppPorts, LegacyAppPorts } from "@/ports";
import { BrowserPrintPort } from "../browser/printPort";
import { SupabaseEmployeeRepo } from "./employeeRepo";
import { SupabaseFloorPlanRepo } from "./floorPlanRepo";
import { SupabaseMenuRepo } from "./menuRepo";
import { SupabaseMenuImagePort } from "./menuImagePort";
import { SupabaseOrderRepo } from "./orderRepo";
import { SupabasePaymentRepo } from "./paymentRepo";
import { SupabaseRealtimePort } from "./realtimePort";
import { SupabaseReportRepo } from "./reportRepo";
import { SupabaseSettingsRepo } from "./settingsRepo";
import type { SupabaseAnyClient } from "./repoShared";
import { createSupabasePermissionRuntime } from "./newPermissionRuntime";
import { SupabaseWriteOperationRepo } from "./writeOperationRepo";

export const createSupabasePorts = (client: SupabaseAnyClient, supabaseUrl = ""): AppPorts => {
  const runtime = createSupabasePermissionRuntime(client, supabaseUrl);
  const seed = runtime.seed;

  return {
    permission: runtime.permission,
    write: runtime.write,
    auth: runtime.auth,
    seed,
    print: new BrowserPrintPort(),
  };
};

/** Isolated compatibility factory for phase-27/B adapter contract tests. */
export const createSupabaseLegacyPorts = (client: SupabaseAnyClient): LegacyAppPorts => {
  const runtime = createSupabasePermissionRuntime(client);
  return {
    write: new SupabaseWriteOperationRepo(client),
    auth: runtime.auth,
    employee: new SupabaseEmployeeRepo(client),
    menu: new SupabaseMenuRepo(client),
    menuImages: new SupabaseMenuImagePort(client),
    floorPlan: new SupabaseFloorPlanRepo(client),
    order: new SupabaseOrderRepo(client),
    payment: new SupabasePaymentRepo(client),
    report: new SupabaseReportRepo(client),
    settings: new SupabaseSettingsRepo(client),
    seed: runtime.seed,
    print: new BrowserPrintPort(),
    realtime: new SupabaseRealtimePort(client),
  };
};
