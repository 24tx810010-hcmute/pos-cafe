import { BrowserPrintPort } from "../browser/printPort";
import type { SupabaseAnyClient } from "./repoShared";
import { SupabaseAuthRepo } from "./authRepo";
import { SupabasePermissionAdminRepo } from "./permissionAdminRepo";
import { SupabasePermissionChangesRepo } from "./permissionChangesRepo";
import { SupabasePermissionIdentityRepo } from "./permissionIdentityRepo";
import { SupabasePermissionMenuImagePort } from "./permissionMenuImagePort";
import { SupabasePermissionPrintRepo } from "./permissionPrintRepo";
import { SupabasePermissionReadRepo } from "./permissionReadRepo";
import { SupabasePermissionSignalPort } from "./permissionSignalPort";
import { SupabaseSeedRepo } from "./seedRepo";
import { SupabaseWriteOperationRepo } from "./writeOperationRepo";

/** Candidate-only identity/read/change composition used by the production runtime. */
export function createSupabasePermissionRuntime(client: SupabaseAnyClient, supabaseUrl = "") {
  const identity = new SupabasePermissionIdentityRepo(client);
  const seed = new SupabaseSeedRepo(client);
  return {
    permission: {
      authority: identity,
      employeeAdmin: new SupabasePermissionAdminRepo(client),
      read: new SupabasePermissionReadRepo(client),
      session: identity,
      initialSeed: seed,
      changes: new SupabasePermissionChangesRepo(client),
      signals: new SupabasePermissionSignalPort(client),
      print: new SupabasePermissionPrintRepo(client),
      menuImages: new SupabasePermissionMenuImagePort(client, supabaseUrl),
    },
    write: new SupabaseWriteOperationRepo(client, true),
    auth: new SupabaseAuthRepo(client, seed),
    seed,
    print: new BrowserPrintPort(),
  };
}
