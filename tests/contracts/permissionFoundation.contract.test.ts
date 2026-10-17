import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import { parseBridgeEnvironment, assertBridgeFixture, STORE_IDS } from "../../scripts/permission-bridge-runtime.mjs";
import { digest, permissionFingerprint } from "../../scripts/permission-preflight-core.mjs";
import { collectInventory } from "../../scripts/permission-inventory.mjs";
import { captureExecutionProfile } from "../../scripts/permission-execution-evidence.mjs";
import { createMockPermissionCatalog } from "../../src/adapters/mock/permissionState";
import { configuredPermissions, normalizePermissionOverrides } from "../../src/core/permissionOverrides";
import { createAuthoritySnapshot } from "../../src/core/permissionAuthority";
import type { PermissionCatalog, PermissionOverrides, PermissionRole } from "../../src/domain/permissions";

const env = parseBridgeEnvironment();
const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
let applied = false, originalHelper = "";
const evidence: Record<string, unknown> = { schemaVersion: 1, sourceFingerprint: permissionFingerprint(), comparisons: 0, runtime: null };
beforeAll(async () => {
  await db.connect(); evidence.runtime = await assertBridgeFixture(db, env);
  originalHelper = (await db.query("select pg_get_functiondef('public.has_employee_permission(public.employee_role,jsonb,text)'::regprocedure) definition")).rows[0].definition;
  await db.query(readFileSync("supabase/migrations/017_permission_catalog_bridge.sql", "utf8")); applied = true;
  const runtime = await assertBridgeFixture(db, env, "bridge");
  evidence.executionProfile = await captureExecutionProfile({ profile: "bridge", stage: "foundation-database", executionKind: "service",
    configId: "supabase-bridge-v1", appliedArtifacts: [{ id: "017_permission_catalog_bridge.sql", path: "supabase/migrations/017_permission_catalog_bridge.sql" }],
    observer: { observe: async () => { const inventory = await collectInventory(db); return {
      backend: { reference: runtime.project, host: "127.0.0.1", port: 63422, database: "postgres", engine: `supabase-cli-${runtime.cli}` },
      fixtureIds: [...STORE_IDS],
      markerProof: digest(env.marker), catalogHash: inventory.catalogHash, schemaHash: inventory.catalogHash,
      apiBinding: { verified: true, baseUrl: env.api, projectRef: runtime.project },
    }; } } });
});
afterEach(async () => { await db.query("rollback"); });
afterAll(async () => {
  try {
    await db.query("rollback");
    if (applied) {
      await db.query(readFileSync("scripts/sql/permission-t02-revert.sql", "utf8"));
      await db.query(originalHelper);
      await assertBridgeFixture(db, env);
      evidence.reverted = true;
    }
  } finally {
    evidence.sourceAfter = permissionFingerprint();
    if (process.env.PERM_FOUNDATION_EVIDENCE_FILE) writeFileSync(process.env.PERM_FOUNDATION_EVIDENCE_FILE, JSON.stringify(evidence, null, 2));
    await db.end();
  }
});
async function catalogFromSql(): Promise<PermissionCatalog> {
  const roles = (await db.query('select code,label_vi "labelVi",enabled,selectable from public.permission_roles order by code')).rows;
  const permissions = (await db.query('select code,label_vi "labelVi",module,owner_only "ownerOnly",baseline from public.permission_catalog order by code')).rows;
  const defaults = (await db.query('select role_code "roleCode",permission_code "permissionCode" from public.role_permission_defaults order by role_code,permission_code')).rows;
  const revision = Number((await db.query("select revision from public.permission_catalog_state where singleton")).rows[0].revision);
  return { contractVersion: 1, roles, permissions, defaults, revision };
}
const canonical = (catalog: PermissionCatalog) => ({ ...catalog,
  roles: [...catalog.roles].sort((a, b) => a.code.localeCompare(b.code)),
  permissions: [...catalog.permissions].sort((a, b) => a.code.localeCompare(b.code)),
  defaults: [...catalog.defaults].sort((a, b) => (a.roleCode + a.permissionCode).localeCompare(b.roleCode + b.permissionCode)),
});
test("TC-PERM-01/T03 SQL catalog and shared mock fixture have identical rows", async () => {
  expect(canonical(await catalogFromSql())).toEqual(canonical(createMockPermissionCatalog()));
});
test("TC-PERM-01/04/T03 core and SQL agree on 1280 override profiles across five roles", async () => {
  const catalog = await catalogFromSql();
  const codes = ["order.create", "payment.take", "report.view", "receipt.reprint"] as const;
  let count = 0;
  for (const role of catalog.roles.map(r => r.code)) {
    for (let mask = 0; mask < 256; mask++) {
      const overrides: PermissionOverrides = {
        grants: codes.filter((_, i) => (mask >> (2 * i)) & 1),
        denies: codes.filter((_, i) => (mask >> (2 * i)) & 2),
      };
      const sql = (await db.query("select private.normalize_permission_overrides($1,$2::jsonb) normalized,private.configured_employee_permissions($1,$2::jsonb) permissions", [role, JSON.stringify(overrides)])).rows[0];
      expect(normalizePermissionOverrides(catalog, role, overrides)).toEqual(sql.normalized);
      expect(configuredPermissions(catalog, role, overrides).permissions).toEqual(sql.permissions);
      count++;
    }
  }
  expect(count).toBe(1280); evidence.comparisons = count;
});
test("TC-PERM-04/T03 SQL and core reject the same malformed and forbidden overrides", async () => {
  const catalog = await catalogFromSql();
  const cases: [PermissionRole, unknown, string][] = [
    ["cashier", {}, "INVALID_EMPLOYEE_REQUEST"], ["cashier", { grants: [], denies: [], extra: true }, "INVALID_EMPLOYEE_REQUEST"],
    ["cashier", { grants: "report.view", denies: [] }, "INVALID_EMPLOYEE_REQUEST"],
    ["cashier", { grants: [1], denies: [] }, "INVALID_EMPLOYEE_REQUEST"],
    ["cashier", { grants: ["data.wipe"], denies: [] }, "INVALID_EMPLOYEE_REQUEST"],
    ["cashier", { grants: Array(101).fill("report.view"), denies: [] }, "INVALID_EMPLOYEE_REQUEST"],
    ["cashier", { grants: [], denies: Array(101).fill("payment.take") }, "INVALID_EMPLOYEE_REQUEST"],
    ["cashier", { grants: [], denies: ["floor.view"] }, "PERMISSION_BASELINE_REQUIRED"],
    ["manager", { grants: ["data.clearDemo"], denies: ["data.clearDemo"] }, "OWNER_ONLY_PERMISSION"],
  ];
  for (const [role, input, code] of cases) {
    expect(() => normalizePermissionOverrides(catalog, role, input)).toThrow(expect.objectContaining({ code }));
    await expect(db.query("select private.normalize_permission_overrides($1,$2::jsonb)", [role, JSON.stringify(input)])).rejects.toMatchObject({ message: code });
  }
  evidence.rejectedComparisons = cases.length;
});
test("TC-PERM-03/T03 a SQL default update changes core authority at the new catalog revision", async () => {
  const before = await catalogFromSql();
  await db.query("begin");
  await db.query("delete from public.role_permission_defaults where role_code='cashier' and permission_code='payment.take'");
  await db.query("insert into public.role_permission_defaults values('cashier','report.view')");
  const catalog = await catalogFromSql();
  expect(catalog.revision).toBe(before.revision + 1);
  const snapshot = createAuthoritySnapshot(catalog, {
    id: "30000000-0000-4000-8000-000000000011", storeId: "30000000-0000-4000-8000-000000000001",
    name: "Synthetic", role: "cashier", isActive: true, permissionRevision: 0, overrides: null,
  }, true);
  const sql = (await db.query("select private.configured_employee_permissions('cashier',null) permissions")).rows[0].permissions;
  expect(snapshot.permissions).toEqual(sql); expect(snapshot.permissions).not.toContain("payment.take");
  expect(snapshot.permissions).toContain("report.view"); expect(snapshot.catalogRevision).toBe(catalog.revision);
});
