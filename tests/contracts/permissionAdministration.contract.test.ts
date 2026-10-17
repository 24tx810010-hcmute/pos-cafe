import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { observeCandidateStage } from "./permissionStageObservation";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SupabasePermissionAdminRepo } from "../../src/adapters/supabase/permissionAdminRepo";
import { SupabasePermissionIdentityRepo } from "../../src/adapters/supabase/permissionIdentityRepo";
import { permissionFingerprint } from "../../scripts/permission-preflight-core.mjs";
import {
  actor,
  cleanupIdentityFixture,
  connection,
  db,
  EMPLOYEE_IDS as E,
  env,
  fixtureEvidence,
  resetIdentityFixture,
  rpc,
  setupIdentityFixture,
  STORE_IDS as S,
  waitBlocked,
} from "./permissionIdentityFixture";

const PIN = "384729";
const NEXT_PIN = "927416";
const source = permissionFingerprint();
const controls: Record<string, unknown> = {};

beforeAll(async () => {
  await setupIdentityFixture(true);
  await observeCandidateStage(db);
  controls.runtime = { apiOrigin: new URL(env.api).origin };
});
afterEach(resetIdentityFixture);
afterAll(async () => {
  try {
    await cleanupIdentityFixture();
  } finally {
    if (process.env.PERM_ADMIN_EVIDENCE_FILE) {
      writeFileSync(process.env.PERM_ADMIN_EVIDENCE_FILE, JSON.stringify({
        sourceFingerprint: source,
        sourceAfter: permissionFingerprint(),
        fixtureEvidence,
        controls,
      }, null, 2));
    }
  }
});

const start = (id = E[0], pin = PIN) => rpc("permission_start_session", { p_employee_id: id, p_pin: pin });
const admin = (name: string, token: string, request?: object) =>
  rpc(name, request === undefined ? {} : { p_request: request }, token);
const get = (token: string, id: string) => rpc("permission_admin_get", { p_target_id: id }, token);
const list = (token: string) => rpc("permission_admin_list", {}, token);
const audit = (token: string, filter: object = {}) => rpc("permission_admin_audit", { p_filter: filter }, token);
const catalogRevision = async () => Number((await db.query("select revision from public.permission_catalog_state where singleton")).rows[0].revision);
const createRequest = async (patch: Record<string, unknown> = {}) => ({
  requestId: randomUUID(), id: randomUUID(), name: "Mai", role: "cashier", pin: NEXT_PIN,
  expectedCatalogRevision: await catalogRevision(), ...patch,
});
const updateRequest = async (targetId: string, patch: object, expectedRevision = 0, extra: Record<string, unknown> = {}) => ({
  requestId: randomUUID(), targetId, expectedRevision, expectedCatalogRevision: await catalogRevision(), patch, ...extra,
});
const resetRequest = (targetId: string, expectedRevision = 0, newPin = NEXT_PIN, extra: Record<string, unknown> = {}) => ({
  requestId: randomUUID(), targetId, expectedRevision, newPin, ...extra,
});

async function employeeState(id: string) {
  return (await db.query(`select e.id,e.store_id,e.name,e.role,e.is_active,e.permission_overrides,e.permission_revision::int revision,
    e.passcode_hash,count(s.*)::int sessions,count(s.*) filter(where s.revoked_at is not null)::int revoked
    from public.employees e left join private.employee_sessions s on s.employee_id=e.id where e.id=$1 group by e.id`, [id])).rows[0];
}
async function evidenceCounts(requestId?: string) {
  const where = requestId ? " where request_id=$1" : "";
  const args = requestId ? [requestId] : [];
  return {
    audit: Number((await db.query(`select count(*) n from public.employee_admin_audit${where}`, args)).rows[0].n),
    registry: Number((await db.query(`select count(*) n from private.employee_admin_requests${where}`, args)).rows[0].n),
    signal: Number((await db.query("select count(*) n from public.store_change_signals")).rows[0].n),
  };
}
async function auditRows(requestId?: string) {
  const where = requestId ? "where request_id=$1" : "";
  return (await db.query(`select * from public.employee_admin_audit ${where} order by occurred_at,request_id`, requestId ? [requestId] : [])).rows;
}
async function setOverrides(id: string, grants: string[] = [], denies: string[] = [], revision = 0) {
  await db.query("update public.employees set permission_overrides=$2,permission_revision=$3 where id=$1", [id, { grants, denies }, revision]);
}
async function sqlRejected(statement: string, token?: string) {
  const client = await connection();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await actor(client, token);
    let sqlState = "";
    try { await client.query(statement); } catch (error) { sqlState = (error as { code?: string }).code ?? ""; }
    expect(sqlState).toBe("42501");
  } finally {
    await client.query("rollback");
    await client.end();
  }
}
async function sqlCall(client: Awaited<ReturnType<typeof connection>>, token: string, storeId: string, name: string, args: unknown[]) {
  await client.query("begin");
  await actor(client, token, storeId);
  try {
    const placeholders = args.map((_, index) => `$${index + 1}`).join(",");
    const result = (await client.query(`select public.${name}(${placeholders}) r`, args)).rows[0].r;
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
async function startInStore(storeId: string, employeeId: string, pin = PIN) {
  const client = await connection();
  try { return await sqlCall(client, "", storeId, "permission_start_session", [employeeId, pin]); }
  finally { await client.end(); }
}

test("TC-PERM-05/18/24 T05 admin reads use manage-or-permission-edit and raw administration surfaces stay closed", async () => {
  const owner = await start(), manager = await start(E[1]), cashier = await start(E[2]);
  expect((await list(owner.token)).data).toHaveLength(3);
  expect((await list(manager.token)).data).toHaveLength(3);
  expect((await list(cashier.token)).error.code).toBe("FORBIDDEN");
  expect((await admin("permission_admin_update", cashier.token, await updateRequest(E[1], {}))).error.code).toBe("FORBIDDEN");
  expect((await admin("permission_admin_update", manager.token, await updateRequest(E[2], {}))).outcome).toBe("noop");
  await setOverrides(E[2], ["employee.permission.edit"], ["report.view"]);
  const editor = await start(E[2]);
  const rows = await list(editor.token);
  expect(rows.ok).toBe(true);
  expect(rows.data.find((row: { id: string }) => row.id === E[0]).role).toBe("owner");
  expect((await audit(editor.token)).ok).toBe(true);
  expect((await get(editor.token, E[3])).error.code).toBe("NOT_FOUND");
  expect((await audit(manager.token)).error.code).toBe("FORBIDDEN");
  for (const role of ["anon", "authenticated", "service_role"]) {
    const privileges = (await db.query(`select has_any_column_privilege($1,'public.employees','SELECT') can_select,
      has_any_column_privilege($1,'public.employees','UPDATE') can_update`, [role])).rows[0];
    expect(privileges).toEqual({ can_select: false, can_update: false });
  }
  await sqlRejected("select name from public.employees", owner.token);
  await sqlRejected(`update public.employees set name='bypass' where id='${E[2]}'`, owner.token);
  await sqlRejected(`update public.employees set name=name where id='${E[2]}'`);
  await sqlRejected("delete from public.employee_admin_audit");
  const privateReadable = (await db.query("select has_schema_privilege('authenticated','private','usage') and has_table_privilege('authenticated','private.employee_admin_requests','select') ok")).rows[0].ok;
  expect(privateReadable).toBe(false);
  expect(fixtureEvidence.adminAclNegativeControl).toBe(true);
  controls.readWithoutCeiling = true;
});

test("TC-PERM-05 T05 create commits one revision-zero employee/audit and exact replay is inert", async () => {
  const owner = await start(), request = await createRequest();
  const first = await admin("permission_admin_create", owner.token, request);
  expect(first).toMatchObject({ ok: true, outcome: "applied", data: { id: request.id, role: "cashier", isActive: true, permissionRevision: 0, overrides: null } });
  const row = await employeeState(request.id as string);
  expect(row.role).toBe("cashier");
  const rows = await auditRows(request.requestId as string);
  expect(rows).toHaveLength(1);
  expect(rows[0].before_snapshot).toBeNull();
  expect(rows[0].actual_after.permissionRevision).toBe(0);
  const serialized = JSON.stringify({ first, rows });
  expect(serialized.includes(request.pin as string) || serialized.includes(row.passcode_hash)).toBe(false);
  const replay = await admin("permission_admin_create", owner.token, request);
  expect(replay).toMatchObject({ ok: true, outcome: "replayed", data: { id: request.id, permissionRevision: 0 } });
  expect(await evidenceCounts(request.requestId as string)).toEqual({ audit: 1, registry: 1, signal: 1 });
});

test.each([
  ["owner", "OWNER_PROTECTED"], ["kitchen", "INVALID_EMPLOYEE_REQUEST"],
  ["accountant", "INVALID_EMPLOYEE_REQUEST"], ["custom", "INVALID_EMPLOYEE_REQUEST"],
])("TC-PERM-05/14/19 T05 create rejects role variant %s", async (role, code) => {
  const owner = await start(), request = await createRequest({ role });
  expect((await admin("permission_admin_create", owner.token, request)).error.code).toBe(code);
  expect((await db.query("select count(*)::int n from public.employees where id=$1", [request.id])).rows[0].n).toBe(0);
});

test("TC-PERM-05/22 T05 create collisions hide foreign targets and audit same-store existing state", async () => {
  const owner = await start();
  const local = await createRequest({ id: E[2] });
  expect((await admin("permission_admin_create", owner.token, local)).error.code).toBe("INVALID_EMPLOYEE_REQUEST");
  const localAudit = await auditRows(local.requestId as string);
  expect(localAudit).toHaveLength(1);
  expect(localAudit[0].before_snapshot).toBeNull();
  expect(localAudit[0].actual_after.id).toBe(E[2]);
  const foreign = await createRequest({ id: E[4] });
  expect((await admin("permission_admin_create", owner.token, foreign)).error.code).toBe("NOT_FOUND");
  expect(await auditRows(foreign.requestId as string)).toHaveLength(0);
});

test("TC-PERM-06 T05 a real role change resets old overrides and may apply an explicit new override atomically", async () => {
  await setOverrides(E[2], ["report.view"], ["payment.take"], 7);
  const owner = await start();
  const plain = await updateRequest(E[2], { role: "waiter" }, 7);
  const changed = await admin("permission_admin_update", owner.token, plain);
  expect(changed).toMatchObject({ ok: true, outcome: "applied", data: { role: "waiter", overrides: null, permissionRevision: 8 } });
  expect(changed.data.effective).toEqual(["floor.view", "order.create", "order.update"]);
  expect((await evidenceCounts(plain.requestId)).signal).toBe(1);

  await resetIdentityFixture();
  await setOverrides(E[2], ["report.view"], ["payment.take"], 7);
  const owner2 = await start();
  const composed = await updateRequest(E[2], { role: "waiter", overrides: { grants: ["report.view"], denies: [] } }, 7);
  const result = await admin("permission_admin_update", owner2.token, composed);
  expect(result).toMatchObject({ ok: true, outcome: "applied", data: { role: "waiter", permissionRevision: 8 } });
  expect(result.data.overrides).toEqual({ grants: ["report.view"], denies: [] });
  expect(result.data.effective).toContain("report.view");
});

test("TC-PERM-08 T05 disable/re-enable revokes old sessions, preserves configuration, and OCC denial is audited", async () => {
  const owner = await start(), firstTarget = await start(E[2]), secondTarget = await start(E[2]);
  const before = await employeeState(E[2]);
  const disable = await updateRequest(E[2], { isActive: false });
  expect((await admin("permission_admin_update", owner.token, disable)).outcome).toBe("applied");
  expect((await rpc("permission_get_authority", {}, firstTarget.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  expect((await rpc("permission_get_authority", {}, secondTarget.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  const enable = await updateRequest(E[2], { isActive: true }, 1);
  expect((await admin("permission_admin_update", owner.token, enable)).outcome).toBe("applied");
  expect((await rpc("permission_get_authority", {}, firstTarget.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  expect((await start(E[2])).ok).toBe(true);
  const after = await employeeState(E[2]);
  expect(after.role).toBe(before.role);
  expect(after.permission_overrides).toEqual(before.permission_overrides);
  const stale = await updateRequest(E[2], { isActive: false }, 1);
  expect((await admin("permission_admin_update", owner.token, stale)).error.code).toBe("EMPLOYEE_VERSION_CONFLICT");
  expect((await auditRows(stale.requestId))[0].outcome).toBe("denied");
  expect((await employeeState(E[2])).is_active).toBe(true);
});

test("TC-PERM-09 T05 reset changes credentials once, revokes old sessions, and same-credential reset is noop", async () => {
  const manager = await start(E[1]), a = await start(E[2]), b = await start(E[2]);
  const request = resetRequest(E[2]);
  const applied = await admin("permission_admin_reset_pin", manager.token, request);
  expect(applied).toMatchObject({ ok: true, outcome: "applied", data: { permissionRevision: 1 } });
  expect((await rpc("permission_get_authority", {}, a.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  expect((await rpc("permission_get_authority", {}, b.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  expect((await start(E[2])).error.code).toBe("INVALID_PIN");
  const current = await start(E[2], NEXT_PIN);
  const beforeReplay = await employeeState(E[2]);
  expect((await admin("permission_admin_reset_pin", manager.token, request)).outcome).toBe("replayed");
  const afterReplay = await employeeState(E[2]);
  expect(beforeReplay.passcode_hash === afterReplay.passcode_hash).toBe(true);
  expect((await rpc("permission_get_authority", {}, current.token)).ok).toBe(true);
  const changedSecret = { ...request, newPin: "111111" };
  expect((await admin("permission_admin_reset_pin", manager.token, changedSecret)).error.code).toBe("ADMIN_REQUEST_REUSED");
  const same = resetRequest(E[2], 1, NEXT_PIN);
  expect((await admin("permission_admin_reset_pin", manager.token, same)).outcome).toBe("noop");
  const afterNoop = await employeeState(E[2]);
  expect(afterReplay.passcode_hash === afterNoop.passcode_hash).toBe(true);
  expect(afterNoop.revision).toBe(1);
  expect((await rpc("permission_get_authority", {}, current.token)).ok).toBe(true);
  const stale = resetRequest(E[2], 0, "111111");
  expect((await admin("permission_admin_reset_pin", manager.token, stale)).error.code).toBe("EMPLOYEE_VERSION_CONFLICT");
  expect((await rpc("permission_get_authority", {}, current.token)).ok).toBe(true);
});

test("TC-PERM-14 T05 owner and self guards cover every administration mutation while self-name remains allowed", async () => {
  await setOverrides(E[1], ["employee.permission.edit", "settings.manage"], []);
  const manager = await start(E[1]), owner = await start();
  for (const patch of [{ name: "Other" }, { role: "cashier" }, { overrides: null }, { isActive: false }]) {
    const request = await updateRequest(E[0], patch);
    expect((await admin("permission_admin_update", manager.token, request)).error.code).toBe("OWNER_PROTECTED");
  }
  expect((await admin("permission_admin_reset_pin", manager.token, resetRequest(E[0]))).error.code).toBe("OWNER_PROTECTED");
  expect((await admin("permission_admin_update", manager.token, await updateRequest(E[1], { role: "cashier" }))).error.code).toBe("SELF_PERMISSION_EDIT_FORBIDDEN");
  expect((await admin("permission_admin_update", manager.token, await updateRequest(E[1], { overrides: null }))).error.code).toBe("SELF_PERMISSION_EDIT_FORBIDDEN");
  expect((await admin("permission_admin_update", manager.token, await updateRequest(E[1], { isActive: false }))).error.code).toBe("SELF_DISABLE_FORBIDDEN");
  expect((await admin("permission_admin_reset_pin", manager.token, resetRequest(E[1]))).error.code).toBe("FORBIDDEN");
  expect((await admin("permission_admin_update", manager.token, await updateRequest(E[1], { name: "Quản lý A" }))).outcome).toBe("applied");
  expect((await admin("permission_admin_update", owner.token, await updateRequest(E[0], { role: "manager" }))).error.code).toBe("SELF_PERMISSION_EDIT_FORBIDDEN");
  expect((await admin("permission_admin_update", owner.token, await updateRequest(E[0], { isActive: false }))).error.code).toBe("SELF_DISABLE_FORBIDDEN");
  expect((await db.query("select count(*)::int n from public.employees where store_id=$1 and role='owner' and is_active", [S[0]])).rows[0].n).toBe(1);
});

test.each(["role", "reset", "unlock"])("TC-PERM-15/17 T05 before ceiling includes inactive configured rights for %s", async variant => {
  await setOverrides(E[1], ["employee.permission.edit"], ["report.view"]);
  await setOverrides(E[2], ["report.view"], []);
  if (variant === "unlock") await db.query("update public.employees set is_active=false where id=$1", [E[2]]);
  const manager = await start(E[1]);
  const request = variant === "reset"
    ? resetRequest(E[2])
    : await updateRequest(E[2], variant === "unlock" ? { isActive: true } : { role: "waiter" });
  const endpoint = variant === "reset" ? "permission_admin_reset_pin" : "permission_admin_update";
  const before = await employeeState(E[2]);
  const result = await admin(endpoint, manager.token, request);
  expect(result.error.code).toBe("PERMISSION_CEILING_EXCEEDED");
  expect(result.error.details.missingPermissions).toEqual(["report.view"]);
  const after = await employeeState(E[2]);
  expect(JSON.stringify({ ...before, passcode_hash: undefined }) === JSON.stringify({ ...after, passcode_hash: undefined })).toBe(true);
  expect(before.passcode_hash === after.passcode_hash).toBe(true);
  const row = (await auditRows(request.requestId))[0];
  expect(row.outcome).toBe("denied");
  expect(row.details.missingPermissions).toEqual(["report.view"]);
  expect(row.actual_after).toEqual(row.before_snapshot);
});

test.each(["override", "role", "create"])("TC-PERM-16 T05 after ceiling blocks privilege growth through %s while owner remains exempt", async variant => {
  await setOverrides(E[1], ["employee.permission.edit"], ["order.voidPaid"]);
  const manager = await start(E[1]);
  const request = variant === "create"
    ? await createRequest({ role: "manager" })
    : await updateRequest(E[2], variant === "role" ? { role: "manager" } : { overrides: { grants: ["order.voidPaid"], denies: [] } });
  const endpoint = variant === "create" ? "permission_admin_create" : "permission_admin_update";
  const denied = await admin(endpoint, manager.token, request);
  expect(denied.error.code).toBe("PERMISSION_CEILING_EXCEEDED");
  expect(denied.error.details.missingPermissions).toContain("order.voidPaid");
  const owner = await start();
  const positive = variant === "create"
    ? await createRequest({ role: "manager" })
    : await updateRequest(E[2], variant === "role" ? { role: "manager" } : { overrides: { grants: ["order.voidPaid"], denies: [] } });
  expect((await admin(endpoint, owner.token, positive)).outcome).toBe("applied");
});

test("TC-PERM-18 T05 field authority rejects mixed requests atomically and distinguishes implicit from explicit override reset", async () => {
  await db.query("update public.employees set role='waiter' where id=$1", [E[1]]);
  await setOverrides(E[2], ["employee.permission.edit"], []);
  const editor = await start(E[2]);
  const permissionOnly = await updateRequest(E[1], { overrides: { grants: ["order.voidOpen"], denies: [] } });
  expect((await admin("permission_admin_update", editor.token, permissionOnly)).outcome).toBe("applied");
  const mixed = await updateRequest(E[1], { name: "Changed", overrides: null }, 1);
  expect((await admin("permission_admin_update", editor.token, mixed)).error.code).toBe("FORBIDDEN");
  expect((await admin("permission_admin_reset_pin", editor.token, resetRequest(E[1], 1))).error.code).toBe("FORBIDDEN");
  expect((await employeeState(E[1])).name).not.toBe("Changed");

  await resetIdentityFixture();
  const manager = await start(E[1]);
  expect((await admin("permission_admin_update", manager.token, await updateRequest(E[2], { role: "waiter" }))).outcome).toBe("applied");
  expect((await admin("permission_admin_update", manager.token, await updateRequest(E[2], { overrides: null }, 1))).error.code).toBe("FORBIDDEN");
});

test.each([
  ["empty name", { name: " " }], ["long name", { name: "😀".repeat(121) }],
  ["unsupported role", { role: "kitchen" }], ["null role", { role: null }],
])("TC-PERM-19 T05 update validates bypass input variant %s", async (_label, patch) => {
  const owner = await start();
  expect((await admin("permission_admin_update", owner.token, await updateRequest(E[2], patch))).error.code).toBe("INVALID_EMPLOYEE_REQUEST");
  expect((await employeeState(E[2])).revision).toBe(0);
});

test("TC-PERM-19 T05 Unicode name boundary counts code points", async () => {
  const owner = await start();
  expect((await admin("permission_admin_update", owner.token, await updateRequest(E[2], { name: "😀".repeat(120) }))).outcome).toBe("applied");
  const request = await updateRequest(E[2], { name: "😀".repeat(121) }, 1);
  expect((await admin("permission_admin_update", owner.token, request)).error.code).toBe("INVALID_EMPLOYEE_REQUEST");
});

test.each([["short", "12345"], ["long", "1234567"], ["non-ASCII", "１２３４５６"]])("TC-PERM-09/19 T05 reset rejects malformed credential variant %s", async (_label, newPin) => {
  const owner = await start(), before = await employeeState(E[2]);
  const result = await admin("permission_admin_reset_pin", owner.token, resetRequest(E[2], 0, newPin));
  expect(result.error.code).toBe("INVALID_EMPLOYEE_REQUEST");
  const after = await employeeState(E[2]);
  expect(before.passcode_hash === after.passcode_hash).toBe(true);
  expect(after.revision).toBe(0);
});

test("TC-PERM-20 T05 OCC, empty patch, same-role and explicit reset have distinct outcomes", async () => {
  await setOverrides(E[2], [], ["payment.take"], 8);
  const owner = await start();
  const stale = await updateRequest(E[2], { name: "Stale" }, 7);
  expect((await admin("permission_admin_update", owner.token, stale)).error.code).toBe("EMPLOYEE_VERSION_CONFLICT");
  const sameRole = await updateRequest(E[2], { role: "cashier" }, 8);
  expect((await admin("permission_admin_update", owner.token, sameRole)).outcome).toBe("noop");
  expect((await employeeState(E[2])).permission_overrides).toEqual({ grants: [], denies: ["payment.take"] });
  const empty = await updateRequest(E[2], {}, 8);
  expect((await admin("permission_admin_update", owner.token, empty)).outcome).toBe("noop");
  const reset = await updateRequest(E[2], { overrides: null }, 8);
  expect((await admin("permission_admin_update", owner.token, reset)).outcome).toBe("applied");
  expect((await employeeState(E[2])).revision).toBe(9);
  expect((await evidenceCounts(reset.requestId)).signal).toBe(1);
});

test("TC-PERM-20/23 T05 catalog-stale requests do not normalize, while a terminal replay returns its historical result", async () => {
  await setOverrides(E[2], [], ["payment.take"], 8);
  const owner = await start(), revision = await catalogRevision();
  const applied = await updateRequest(E[2], { role: "waiter" }, 8, { expectedCatalogRevision: revision });
  expect((await admin("permission_admin_update", owner.token, applied)).outcome).toBe("applied");
  const label = (await db.query("select label_vi from public.permission_catalog where code='report.view'")).rows[0].label_vi;
  try {
    await db.query("update public.permission_catalog set label_vi=label_vi||'!' where code='report.view'");
    const replay = await admin("permission_admin_update", owner.token, applied);
    expect(replay).toMatchObject({ ok: true, outcome: "replayed", data: { role: "waiter", permissionRevision: 9, overrides: null } });
    await resetIdentityFixture();
    await setOverrides(E[2], [], ["payment.take"], 8);
    const owner2 = await start();
    const stale = await updateRequest(E[2], { role: "waiter" }, 8, { expectedCatalogRevision: revision });
    expect((await admin("permission_admin_update", owner2.token, stale)).error.code).toBe("PERMISSION_CATALOG_STALE");
    const row = await employeeState(E[2]);
    expect(row.role).toBe("cashier");
    expect(row.permission_overrides).toEqual({ grants: [], denies: ["payment.take"] });
  } finally {
    await db.query("update public.permission_catalog set label_vi=$1 where code='report.view'", [label]);
  }
});

test.each(["public.employee_admin_audit", "public.store_change_signals", "private.employee_admin_requests"])("TC-PERM-08/09/21 T05 fault in %s rolls back all effects", async table => {
  const owner = await start(), targetSession = await start(E[2]);
  const before = await employeeState(E[2]);
  await db.query(`create function private.identity_test_fault() returns trigger language plpgsql as $$ begin raise exception 'synthetic fault'; end $$;
    create trigger identity_test_fault before insert or update on ${table} for each row execute function private.identity_test_fault()`);
  const result = await admin("permission_admin_reset_pin", owner.token, resetRequest(E[2]));
  expect(result.error.code).toBe("PERMISSION_UPDATE_UNAVAILABLE");
  const after = await employeeState(E[2]);
  expect(before.passcode_hash === after.passcode_hash).toBe(true);
  expect(after.revision).toBe(before.revision);
  expect(after.revoked).toBe(before.revoked);
  expect((await rpc("permission_get_authority", {}, targetSession.token)).ok).toBe(true);
  expect(await evidenceCounts()).toEqual({ audit: 0, registry: 0, signal: 0 });
});

test("TC-PERM-22 T05 verified business denial is durable but invalid sessions and hidden targets leave no audit", async () => {
  await setOverrides(E[1], [], ["report.view"]);
  await setOverrides(E[2], ["report.view"], []);
  const manager = await start(E[1]);
  const denied = resetRequest(E[2]);
  const before = await employeeState(E[2]);
  const result = await admin("permission_admin_reset_pin", manager.token, denied);
  expect(result.error.code).toBe("PERMISSION_CEILING_EXCEEDED");
  const rows = await auditRows(denied.requestId);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ outcome: "denied", reason: "PERMISSION_CEILING_EXCEEDED", credential_changed: false });
  expect(rows[0].details.missingPermissions).toEqual(["report.view"]);
  const after = await employeeState(E[2]);
  expect(before.passcode_hash === after.passcode_hash).toBe(true);
  expect(after.revision).toBe(before.revision);
  const foreign = await updateRequest(E[4], { name: "Hidden" });
  expect((await admin("permission_admin_update", manager.token, foreign)).error.code).toBe("NOT_FOUND");
  expect(await auditRows(foreign.requestId)).toHaveLength(0);
  const unknown = await updateRequest(randomUUID(), { name: "Hidden" });
  expect((await admin("permission_admin_update", manager.token, unknown)).error.code).toBe("NOT_FOUND");
  expect(await auditRows(unknown.requestId)).toHaveLength(0);
  const invalid = await updateRequest(E[2], { name: "Nope" });
  expect((await admin("permission_admin_update", "x".repeat(43), invalid)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  expect(await auditRows(invalid.requestId)).toHaveLength(0);
});

test.each(["forbidden", "owner", "self", "occ"])("TC-PERM-14/18/20/22 T05 denied %s records a valid proposed snapshot", async variant => {
  let token: string;
  let targetId: string;
  let patch: Record<string, unknown>;
  let expectedRevision = 0;
  let code: string;
  if (variant === "forbidden") {
    await setOverrides(E[2], ["employee.permission.edit"], []);
    await db.query("update public.employees set role='waiter' where id=$1", [E[1]]);
    token = (await start(E[2])).token;
    targetId = E[1]; patch = { name: "Đề nghị hợp lệ" }; code = "FORBIDDEN";
  } else if (variant === "owner") {
    token = (await start(E[1])).token;
    targetId = E[0]; patch = { name: "Tên chủ được đề nghị" }; code = "OWNER_PROTECTED";
  } else if (variant === "self") {
    await setOverrides(E[1], ["employee.permission.edit"], []);
    token = (await start(E[1])).token;
    targetId = E[1]; patch = { role: "cashier" }; code = "SELF_PERMISSION_EDIT_FORBIDDEN";
  } else {
    await db.query("update public.employees set permission_revision=1 where id=$1", [E[2]]);
    token = (await start()).token;
    targetId = E[2]; patch = { name: "Phiên bản đề nghị" }; expectedRevision = 0; code = "EMPLOYEE_VERSION_CONFLICT";
  }
  const request = await updateRequest(targetId, patch, expectedRevision);
  const response = await admin("permission_admin_update", token, request);
  expect(response.error.code).toBe(code!);
  const row = (await auditRows(request.requestId))[0];
  expect(row.outcome).toBe("denied");
  expect(row.reason).toBe(code!);
  expect(row.proposed_after).not.toBeNull();
  if (patch.name) expect(row.proposed_after.name).toBe(patch.name);
  if (patch.role) expect(row.proposed_after.role).toBe(patch.role);
  expect(row.actual_after).toEqual(row.before_snapshot);
});

test.each(["catalog-stale", "baseline-deny", "owner-only", "unknown-code"])("TC-PERM-20/22 T05 %s denial never audits an unnormalized patch", async variant => {
  const owner = await start(), revision = await catalogRevision();
  const overrides = variant === "baseline-deny"
    ? { grants: [], denies: ["floor.view"] }
    : variant === "owner-only"
      ? { grants: ["data.clearDemo"], denies: [] }
      : variant === "unknown-code"
        ? { grants: ["unknown.permission"], denies: [] }
        : { grants: ["report.view"], denies: [] };
  const request = await updateRequest(E[2], { overrides }, 0, {
    expectedCatalogRevision: variant === "catalog-stale" ? revision + 1 : revision,
  });
  const expected = variant === "catalog-stale" ? "PERMISSION_CATALOG_STALE"
    : variant === "baseline-deny" ? "PERMISSION_BASELINE_REQUIRED"
      : variant === "owner-only" ? "OWNER_ONLY_PERMISSION" : "INVALID_EMPLOYEE_REQUEST";
  expect((await admin("permission_admin_update", owner.token, request)).error.code).toBe(expected);
  const row = (await auditRows(request.requestId))[0];
  expect(row.reason).toBe(expected);
  expect(row.proposed_after).toBeNull();
  expect(row.actual_after).toEqual(row.before_snapshot);
  expect(JSON.stringify(row).includes("unknown.permission")).toBe(false);
});

test("TC-PERM-23 T05 canonical JSON is key-order independent and explicit null differs from missing", async () => {
  const owner = await start();
  const request = await updateRequest(E[2], { name: "Thu ngân A" });
  expect((await admin("permission_admin_update", owner.token, request)).outcome).toBe("applied");
  const reordered = {
    patch: { name: "Thu ngân A" }, expectedCatalogRevision: request.expectedCatalogRevision,
    expectedRevision: request.expectedRevision, targetId: request.targetId, requestId: request.requestId,
  };
  expect((await admin("permission_admin_update", owner.token, reordered)).outcome).toBe("replayed");
  expect(await auditRows(request.requestId)).toHaveLength(1);
  const missing = await updateRequest(E[2], { name: "Thu ngân A" }, 1);
  expect((await admin("permission_admin_update", owner.token, missing)).outcome).toBe("noop");
  const explicitNull = { ...missing, patch: { name: "Thu ngân A", overrides: null } };
  expect((await admin("permission_admin_update", owner.token, explicitNull)).error.code).toBe("ADMIN_REQUEST_REUSED");
  controls.canonicalJsonKeyOrder = true;
  controls.explicitNullDistinct = true;
});

test("TC-PERM-23 T05 replay rechecks current authority and private registry contains only a MAC", async () => {
  const manager = await start(E[1]);
  const request = await updateRequest(E[2], { name: "Thu ngân B" });
  const first = await admin("permission_admin_update", manager.token, request);
  expect(first.outcome).toBe("applied");
  const registry = (await db.query("select octet_length(payload_mac) mac_length,mac_key_version,terminal_outcome from private.employee_admin_requests where request_id=$1", [request.requestId])).rows[0];
  expect(registry.mac_length).toBe(32);
  const serialized = JSON.stringify(registry);
  expect(serialized.includes(PIN) || serialized.includes(NEXT_PIN)).toBe(false);
  const owner = await start();
  const revoke = await updateRequest(E[1], { overrides: { grants: [], denies: ["employee.manage", "employee.permission.edit"] } });
  expect((await admin("permission_admin_update", owner.token, revoke)).outcome).toBe("applied");
  expect((await admin("permission_admin_update", manager.token, request)).error.code).toBe("FORBIDDEN");
  expect(await auditRows(request.requestId)).toHaveLength(1);
  await sqlRejected("select * from private.employee_admin_requests");
  await sqlRejected("select * from private.permission_request_mac_keys");
  controls.privateMacOnly = true;
});

test("TC-PERM-23 T05 one actor cannot reuse a request ID across self-PIN and administration kinds", async () => {
  const owner = await start(), requestId = randomUUID();
  const self = { requestId, expectedRevision: 0, currentPin: PIN, newPin: PIN };
  expect((await rpc("permission_change_own_pin", { p_request: self }, owner.token)).outcome).toBe("noop");
  const crossKind = await updateRequest(E[0], { name: "Không được áp" }, 0, { requestId });
  expect((await admin("permission_admin_update", owner.token, crossKind)).error.code).toBe("ADMIN_REQUEST_REUSED");
  const rows = await auditRows(requestId);
  expect(rows).toHaveLength(1);
  expect(rows[0].kind).toBe("self_pin");
  expect((await employeeState(E[0])).name).not.toBe("Không được áp");
});

test("TC-PERM-23 T05 create/update/reset share one request-ID namespace per actor", async () => {
  const owner = await start(), requestId = randomUUID();
  const created = await createRequest({ requestId });
  expect((await admin("permission_admin_create", owner.token, created)).outcome).toBe("applied");
  const update = await updateRequest(E[2], { name: "Không được áp" }, 0, { requestId });
  expect((await admin("permission_admin_update", owner.token, update)).error.code).toBe("ADMIN_REQUEST_REUSED");
  const reset = resetRequest(E[2], 0, NEXT_PIN, { requestId });
  expect((await admin("permission_admin_reset_pin", owner.token, reset)).error.code).toBe("ADMIN_REQUEST_REUSED");
  expect(await auditRows(requestId)).toHaveLength(1);
  expect((await employeeState(E[2])).name).not.toBe("Không được áp");
  expect((await evidenceCounts(requestId)).registry).toBe(1);
});

test("TC-PERM-23 T05 replay uses its immutable historical MAC key after append-only rotation", async () => {
  const owner = await start(), client = await connection();
  const keyCount = Number((await db.query("select count(*) n from private.permission_request_mac_keys")).rows[0].n);
  try {
    await client.query("begin");
    await actor(client, owner.token);
    const first = await updateRequest(E[2], { name: "Khóa cũ" });
    expect((await client.query("select public.permission_admin_update($1) r", [first])).rows[0].r.outcome).toBe("applied");
    const oldVersion = Number((await client.query("select mac_key_version from private.employee_admin_requests where request_id=$1", [first.requestId])).rows[0].mac_key_version);
    const rotatedVersion = oldVersion + 1;
    await client.query("insert into private.permission_request_mac_keys(key_version,secret_bytes) values($1,extensions.gen_random_bytes(32))", [rotatedVersion]);
    expect((await client.query("select public.permission_admin_update($1) r", [first])).rows[0].r.outcome).toBe("replayed");
    const second = await updateRequest(E[2], { name: "Khóa mới" }, 1);
    expect((await client.query("select public.permission_admin_update($1) r", [second])).rows[0].r.outcome).toBe("applied");
    expect(Number((await client.query("select mac_key_version from private.employee_admin_requests where request_id=$1", [second.requestId])).rows[0].mac_key_version)).toBe(rotatedVersion);
    await client.query("savepoint immutable_key");
    let immutable = false;
    try { await client.query("update private.permission_request_mac_keys set secret_bytes=extensions.gen_random_bytes(32) where key_version=$1", [oldVersion]); }
    catch { immutable = true; await client.query("rollback to savepoint immutable_key"); }
    expect(immutable).toBe(true);
    controls.rotatedMacReplay = true;
  } finally {
    await client.query("rollback");
    await client.end();
  }
  expect(Number((await db.query("select count(*) n from private.permission_request_mac_keys")).rows[0].n)).toBe(keyCount);
});

test("TC-PERM-24 T05 audit read includes T04 actor kinds, filters, and keyset pages without duplicates", async () => {
  const owner = await start();
  const selfRequest = { requestId: randomUUID(), expectedRevision: 0, currentPin: PIN, newPin: PIN };
  expect((await rpc("permission_change_own_pin", { p_request: selfRequest }, owner.token)).outcome).toBe("noop");
  await db.query("begin");
  await db.query("set local role pos_owner_recovery");
  const recoveryRequest = { requestId: randomUUID(), storeId: S[0], targetId: E[0], operatorRef: "op-test", caseRef: "case-test-001", proofRef: "synthetic-reviewed-record", newPin: NEXT_PIN };
  const recovered = (await db.query("select private.permission_recover_owner($1) r", [recoveryRequest])).rows[0].r;
  await db.query("commit");
  await db.query("reset role");
  expect(recovered.outcome).toBe("applied");
  const restrictedOwner = await start(E[0], NEXT_PIN);
  expect(restrictedOwner).toMatchObject({ kind: "required_pin_change", pinChangeRequired: true });
  const completedPin = "765432";
  const completionRequest = { requestId: randomUUID(), expectedRevision: restrictedOwner.employeeRevision, newPin: completedPin };
  expect(await rpc("permission_complete_required_pin_change", { p_request: completionRequest }, restrictedOwner.token)).toMatchObject({
    ok: true, outcome: "applied", data: { pinChangeRequired: false, employeeRevision: restrictedOwner.employeeRevision + 1 },
  });
  expect((await admin("permission_admin_list", restrictedOwner.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  const currentOwner = await start(E[0], completedPin);
  expect(currentOwner).toMatchObject({ kind: "normal", pinChangeRequired: false });
  const update = await updateRequest(E[2], { name: "Audited" });
  expect((await admin("permission_admin_update", currentOwner.token, update)).outcome).toBe("applied");
  const denied = await updateRequest(E[2], { name: "Stale" }, 0);
  expect((await admin("permission_admin_update", currentOwner.token, denied)).error.code).toBe("EMPLOYEE_VERSION_CONFLICT");
  const seen: string[] = [];
  let cursor: string | null = null;
  do {
    const page = await audit(currentOwner.token, { limit: 1, ...(cursor ? { cursor } : {}) });
    expect(page.ok).toBe(true);
    seen.push(...page.data.rows.map((row: { auditKey: string }) => row.auditKey));
    cursor = page.data.nextCursor;
  } while (cursor);
  expect(new Set(seen).size).toBe(seen.length);
  expect(seen.length).toBe(5);
  const all = await audit(currentOwner.token, { limit: 100 });
  expect(new Set(all.data.rows.map((row: { actorType: string }) => row.actorType))).toEqual(new Set(["employee", "operator"]));
  expect(all.data.rows).toEqual(expect.arrayContaining([expect.objectContaining({
    requestId: completionRequest.requestId, actorType: "employee", targetId: E[0],
    kind: "complete_required_pin_change", outcome: "applied",
  })]));
  await setOverrides(E[2], ["employee.permission.edit"], []);
  const editor = await start(E[2]);
  const editorRows = (await audit(editor.token, { limit: 100 })).data.rows;
  expect(editorRows.some((row: { actorType: string; targetId: string }) => row.actorType === "operator" && row.targetId === E[0])).toBe(true);
  expect(editorRows.some((row: { actorType: string; targetId: string }) => row.actorType === "employee" && row.targetId === E[0])).toBe(true);
  expect((await audit(currentOwner.token, { outcome: "noop", limit: 50 })).data.rows.every((row: { outcome: string }) => row.outcome === "noop")).toBe(true);
  expect((await audit(currentOwner.token, { outcome: "denied", limit: 50 })).data.rows.every((row: { outcome: string }) => row.outcome === "denied")).toBe(true);
  expect((await audit(currentOwner.token, { targetId: E[2], limit: 50 })).data.rows.every((row: { targetId: string }) => row.targetId === E[2])).toBe(true);
  expect((await audit(currentOwner.token, { limit: 0 })).error.code).toBe("INVALID_EMPLOYEE_REQUEST");
  expect((await audit(currentOwner.token, { limit: 101 })).error.code).toBe("INVALID_EMPLOYEE_REQUEST");
  expect((await audit(currentOwner.token, { cursor: "invalid", limit: 1 })).error.code).toBe("INVALID_EMPLOYEE_REQUEST");
  const firstPage = await audit(currentOwner.token, { limit: 1 });
  const validCursor = firstPage.data.nextCursor as string;
  const tamperedCursor = validCursor.slice(0, -1) + (validCursor.endsWith("A") ? "B" : "A");
  expect((await audit(currentOwner.token, { cursor: tamperedCursor, limit: 1 })).error.code).toBe("INVALID_EMPLOYEE_REQUEST");
  expect((await audit(currentOwner.token, { limit: 1, cursor: firstPage.data.nextCursor, outcome: "denied" })).error.code).toBe("INVALID_EMPLOYEE_REQUEST");
  expect(JSON.stringify(all).includes(PIN) || JSON.stringify(all).includes(NEXT_PIN) || JSON.stringify(all).includes(completedPin)).toBe(false);
});

test("TC-PERM-24 T05 an audit cursor is store-bound and a revoked session cannot continue paging", async () => {
  const owner1 = await start();
  const r1 = await updateRequest(E[2], { name: "A1" });
  const r2 = await updateRequest(E[2], { name: "A2" }, 1);
  expect((await admin("permission_admin_update", owner1.token, r1)).outcome).toBe("applied");
  expect((await admin("permission_admin_update", owner1.token, r2)).outcome).toBe("applied");
  const page1 = await audit(owner1.token, { limit: 1 });
  expect(page1.data.nextCursor).not.toBeNull();
  await rpc("permission_revoke_session", {}, owner1.token);
  expect((await audit(owner1.token, { limit: 1, cursor: page1.data.nextCursor })).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");

  const owner2 = await startInStore(S[1], E[3]);
  const manager2 = await startInStore(S[1], E[4]);
  const c1 = await connection();
  try {
    const rev = await catalogRevision();
    for (const [name, expectedRevision] of [["B1", 0], ["B2", 1]] as const) {
      const request = { requestId: randomUUID(), targetId: E[4], expectedRevision, expectedCatalogRevision: rev, patch: { name } };
      expect((await sqlCall(c1, owner2.token, S[1], "permission_admin_update", [request])).outcome).toBe("applied");
    }
    const store2Page = await sqlCall(c1, owner2.token, S[1], "permission_admin_audit", [{ limit: 1 }]);
    expect(store2Page.data.nextCursor).not.toBeNull();
    const owner1b = await start();
    expect((await audit(owner1b.token, { limit: 1, cursor: store2Page.data.nextCursor })).error.code).toBe("INVALID_EMPLOYEE_REQUEST");
    expect(manager2.ok).toBe(true);
  } finally { await c1.end(); }
});

test("TC-PERM-23/24 T05 audit paging rechecks permission rights without revoking the actor session", async () => {
  await setOverrides(E[1], ["employee.permission.edit"], []);
  const manager = await start(E[1]), owner = await start();
  const first = await updateRequest(E[2], { name: "Trang một" });
  const second = await updateRequest(E[2], { name: "Trang hai" }, 1);
  expect((await admin("permission_admin_update", manager.token, first)).outcome).toBe("applied");
  expect((await admin("permission_admin_update", manager.token, second)).outcome).toBe("applied");
  const page = await audit(manager.token, { limit: 1 });
  expect(page.ok).toBe(true);
  expect(page.data.nextCursor).not.toBeNull();
  const revoke = await updateRequest(E[1], { overrides: null });
  expect((await admin("permission_admin_update", owner.token, revoke)).outcome).toBe("applied");
  expect((await rpc("permission_get_authority", {}, manager.token)).ok).toBe(true);
  expect((await audit(manager.token, { limit: 1, cursor: page.data.nextCursor })).error.code).toBe("FORBIDDEN");
  expect((await audit(manager.token, { limit: 1 })).error.code).toBe("FORBIDDEN");
  controls.auditCurrentPermission = true;
});

test("TC-PERM-24 T05 keyset pagination is total when audit timestamps tie at microsecond precision", async () => {
  const originalClock = (await db.query("select pg_get_functiondef('private.write_clock()'::regprocedure) d")).rows[0].d;
  try {
    await db.query("create table private.permission_admin_clock(moment timestamptz not null); insert into private.permission_admin_clock values('2026-09-16T03:04:05.123456Z')");
    await db.query("create or replace function private.write_clock() returns timestamptz language sql volatile set search_path=pg_catalog as $$select moment from private.permission_admin_clock$$");
    const owner = await start();
    for (const [name, expectedRevision] of [["Tie A", 0], ["Tie B", 1], ["Tie C", 2]] as const) {
      expect((await admin("permission_admin_update", owner.token, await updateRequest(E[2], { name }, expectedRevision))).outcome).toBe("applied");
    }
    expect(Number((await db.query("select count(distinct occurred_at)::int n from public.employee_admin_audit")).rows[0].n)).toBe(1);
    const keys: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await audit(owner.token, { limit: 1, ...(cursor ? { cursor } : {}) });
      expect(page.ok).toBe(true);
      keys.push(...page.data.rows.map((row: { auditKey: string }) => row.auditKey));
      cursor = page.data.nextCursor;
    } while (cursor);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    controls.auditTimestampTie = true;
  } finally {
    await db.query(originalClock);
    await db.query("drop table if exists private.permission_admin_clock");
  }
});

test("TC-PERM-24 T05 audit adapter maps a backend read failure to the exact refresh-unavailable code", async () => {
  const original = (await db.query("select pg_get_functiondef('public.permission_admin_audit(jsonb)'::regprocedure) d")).rows[0].d;
  const client = createClient(env.api, env.anonKey!, {
    global: { headers: { Authorization: "Bearer " + env.storeJwt } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const identityRepo = new SupabasePermissionIdentityRepo(client);
  const adminRepo = new SupabasePermissionAdminRepo(client);
  try {
    await identityRepo.startSession(E[0], PIN);
    await db.query(`create or replace function public.permission_admin_audit(p_filter jsonb default '{}'::jsonb) returns jsonb
      language plpgsql volatile security definer set search_path=pg_catalog as $$begin raise exception 'synthetic unavailable'; end$$`);
    let code = "";
    try { await adminRepo.listAudit(); } catch (error) { code = (error as { code?: string }).code ?? ""; }
    expect(code).toBe("PERMISSION_REFRESH_UNAVAILABLE");
    controls.auditUnavailableMapping = true;
  } finally {
    await db.query(original);
  }
});

test("TC-PERM-24 T05 app roles cannot mutate retained audit rows", async () => {
  const owner = await start();
  const request = await updateRequest(E[2], { name: "Retained" });
  expect((await admin("permission_admin_update", owner.token, request)).outcome).toBe("applied");
  const before = (await db.query("select md5(to_jsonb(a)::text) h from public.employee_admin_audit a where request_id=$1", [request.requestId])).rows[0].h;
  await sqlRejected("insert into public.employee_admin_audit select * from public.employee_admin_audit limit 1");
  await sqlRejected("update public.employee_admin_audit set reason='tampered'");
  await sqlRejected("delete from public.employee_admin_audit");
  const after = (await db.query("select md5(to_jsonb(a)::text) h from public.employee_admin_audit a where request_id=$1", [request.requestId])).rows[0].h;
  expect(after).toBe(before);
});

test("TC-PERM-42 T05 an actor expiring while queued at the catalog checkpoint cannot mutate or audit", async () => {
  const originalClock = (await db.query("select pg_get_functiondef('private.write_clock()'::regprocedure) d")).rows[0].d;
  const blocker = await connection(), requester = await connection();
  try {
    await db.query("create table private.permission_admin_clock(moment timestamptz not null); insert into private.permission_admin_clock values('2026-09-16T00:00:00Z')");
    await db.query("create or replace function private.write_clock() returns timestamptz language sql volatile set search_path=pg_catalog as $$select moment from private.permission_admin_clock$$");
    const owner = await start();
    const request = await updateRequest(E[2], { name: "Không được ghi" });
    delete (request as { expectedCatalogRevision?: number }).expectedCatalogRevision;
    await blocker.query("begin");
    await blocker.query("select pg_advisory_xact_lock(hashtextextended('permission-catalog',0))");
    await requester.query("begin"); await actor(requester, owner.token);
    const pid = (await requester.query("select pg_backend_pid() p")).rows[0].p;
    const pending = requester.query("select public.permission_admin_update($1) r", [request]);
    await waitBlocked(pid);
    await db.query("update private.permission_admin_clock set moment='2026-09-16T12:00:01Z'");
    await blocker.query("commit");
    const result = (await pending).rows[0].r;
    await requester.query("commit");
    expect(result.error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
    expect((await employeeState(E[2])).name).not.toBe("Không được ghi");
    expect(await auditRows(request.requestId)).toHaveLength(0);
    expect((await evidenceCounts(request.requestId)).registry).toBe(0);
    controls.expiredAtCatalogCheckpoint = true;
  } finally {
    await blocker.query("rollback"); await requester.query("rollback");
    await blocker.end(); await requester.end();
    await db.query(originalClock);
    await db.query("drop table if exists private.permission_admin_clock");
  }
});

test("TC-PERM-42 T05 an administration action lost while queued becomes a durable denial with no target effect", async () => {
  const owner = await start(), manager = await start(E[1]);
  const revoker = await connection(), requester = await connection();
  try {
    await revoker.query("begin"); await actor(revoker, owner.token);
    const revoke = await updateRequest(E[1], { overrides: { grants: [], denies: ["employee.manage"] } });
    expect((await revoker.query("select public.permission_admin_update($1) r", [revoke])).rows[0].r.outcome).toBe("applied");
    await requester.query("begin"); await actor(requester, manager.token);
    const pid = (await requester.query("select pg_backend_pid() p")).rows[0].p;
    const request = await updateRequest(E[2], { name: "Không được ghi" });
    delete (request as { expectedCatalogRevision?: number }).expectedCatalogRevision;
    const before = await employeeState(E[2]);
    const pending = requester.query("select public.permission_admin_update($1) r", [request]);
    await waitBlocked(pid);
    await revoker.query("commit");
    const result = (await pending).rows[0].r;
    await requester.query("commit");
    expect(result.error.code).toBe("FORBIDDEN");
    const after = await employeeState(E[2]);
    expect(after.name).toBe(before.name);
    expect(after.revision).toBe(before.revision);
    const rows = await auditRows(request.requestId);
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe("denied");
    expect(rows[0].reason).toBe("FORBIDDEN");
    controls.lostActionAtMutex = true;
  } finally {
    await revoker.query("rollback"); await requester.query("rollback");
    await revoker.end(); await requester.end();
  }
});

test("TC-PERM-42 T05 two opposite manager updates and a catalog writer serialize without stale authority", async () => {
  await setOverrides(E[1], ["employee.permission.edit"], [], 7);
  await db.query("update public.employees set role='manager',permission_overrides=$2,permission_revision=7 where id=$1", [E[2], { grants: ["employee.permission.edit"], denies: [] }]);
  const manager1 = await start(E[1]), manager2 = await start(E[2]);
  const blocker = await connection(), left = await connection(), right = await connection(), catalog = await connection();
  const originalLabel = (await db.query("select label_vi from public.permission_catalog where code='report.view'")).rows[0].label_vi;
  try {
    await blocker.query("begin");
    await blocker.query("select pg_advisory_xact_lock(hashtextextended('store-authority:'||$1,0))", [S[0]]);
    await left.query("begin"); await actor(left, manager1.token); const leftPid = (await left.query("select pg_backend_pid() p")).rows[0].p;
    await right.query("begin"); await actor(right, manager2.token); const rightPid = (await right.query("select pg_backend_pid() p")).rows[0].p;
    const leftRequest = await updateRequest(E[2], { name: "Quản lý B" }, 7);
    const rightRequest = await updateRequest(E[1], { name: "Quản lý A" }, 7);
    delete (leftRequest as { expectedCatalogRevision?: number }).expectedCatalogRevision;
    delete (rightRequest as { expectedCatalogRevision?: number }).expectedCatalogRevision;
    const leftPending = left.query("select public.permission_admin_update($1) r", [leftRequest]);
    await waitBlocked(leftPid);
    const rightPending = right.query("select public.permission_admin_update($1) r", [rightRequest]);
    await waitBlocked(rightPid);

    await catalog.query("begin");
    await catalog.query("update public.permission_catalog set label_vi=label_vi||'!' where code='report.view'");
    await blocker.query("commit");
    await waitBlocked(leftPid);
    await catalog.query("commit");
    const leftResult = await leftPending;
    await left.query("commit");
    const rightResult = await rightPending;
    await right.query("commit");
    expect(leftResult.rows[0].r.outcome).toBe("applied");
    expect(rightResult.rows[0].r.outcome).toBe("applied");
    expect((await employeeState(E[1])).name).toBe("Quản lý A");
    expect((await employeeState(E[2])).name).toBe("Quản lý B");
    expect((await employeeState(E[1])).revision).toBe(8);
    expect((await employeeState(E[2])).revision).toBe(8);
    expect(await auditRows(leftRequest.requestId)).toHaveLength(1);
    expect(await auditRows(rightRequest.requestId)).toHaveLength(1);
    controls.concurrencyBarrier = "store-authority + catalog writer + pg_blocking_pids";
  } finally {
    await blocker.query("rollback"); await left.query("rollback"); await right.query("rollback"); await catalog.query("rollback");
    await Promise.all([blocker.end(), left.end(), right.end(), catalog.end()]);
    await db.query("update public.permission_catalog set label_vi=$1 where code='report.view'", [originalLabel]);
  }
});

test("TC-PERM-43 T05 session start and administrative reset linearize in both orders", async () => {
  const manager = await start(E[1]);
  const starter = await connection(), resetter = await connection();
  try {
    await starter.query("begin"); await actor(starter);
    const started = (await starter.query("select public.permission_start_session($1,$2) r", [E[2], PIN])).rows[0].r;
    expect(started.ok).toBe(true);
    await resetter.query("begin"); await actor(resetter, manager.token);
    const resetterPid = (await resetter.query("select pg_backend_pid() p")).rows[0].p;
    const request = resetRequest(E[2]);
    const pendingReset = resetter.query("select public.permission_admin_reset_pin($1) r", [request]);
    await waitBlocked(resetterPid);
    await starter.query("commit");
    expect((await pendingReset).rows[0].r.outcome).toBe("applied");
    await resetter.query("commit");
    expect((await rpc("permission_get_authority", {}, started.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  } finally {
    await starter.query("rollback"); await resetter.query("rollback");
    await starter.end(); await resetter.end();
  }

  await resetIdentityFixture();
  const manager2 = await start(E[1]);
  const resetFirst = await connection(), oldStart = await connection(), newStart = await connection();
  try {
    await resetFirst.query("begin"); await actor(resetFirst, manager2.token);
    const result = (await resetFirst.query("select public.permission_admin_reset_pin($1) r", [resetRequest(E[2])])).rows[0].r;
    expect(result.outcome).toBe("applied");
    await oldStart.query("begin"); await actor(oldStart); const oldPid = (await oldStart.query("select pg_backend_pid() p")).rows[0].p;
    await newStart.query("begin"); await actor(newStart); const newPid = (await newStart.query("select pg_backend_pid() p")).rows[0].p;
    const oldPending = oldStart.query("select public.permission_start_session($1,$2) r", [E[2], PIN]);
    await waitBlocked(oldPid);
    const newPending = newStart.query("select public.permission_start_session($1,$2) r", [E[2], NEXT_PIN]);
    await waitBlocked(newPid);
    await resetFirst.query("commit");
    const oldResult = (await oldPending).rows[0].r;
    await oldStart.query("commit");
    const newResult = (await newPending).rows[0].r;
    await newStart.query("commit");
    expect(oldResult.error.code).toBe("INVALID_PIN");
    expect(newResult.ok).toBe(true);
    controls.resetStartBarriers = true;
  } finally {
    await resetFirst.query("rollback"); await oldStart.query("rollback"); await newStart.query("rollback");
    await resetFirst.end(); await oldStart.end(); await newStart.end();
  }
});
