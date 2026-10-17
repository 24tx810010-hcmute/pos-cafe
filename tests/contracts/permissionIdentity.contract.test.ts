import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { observeCandidateStage } from "./permissionStageObservation";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SupabasePermissionIdentityRepo } from "../../src/adapters/supabase/permissionIdentityRepo";
import { employeeCredential } from "../../src/adapters/supabase/employeeCredential";
import { createAuthoritySnapshot } from "../../src/core/permissionAuthority";
import { permissionFingerprint } from "../../scripts/permission-preflight-core.mjs";
import { actor, cleanupIdentityFixture, connection, db, EMPLOYEE_IDS as E, env, fixtureEvidence, resetIdentityFixture, rpc, setupIdentityFixture, STORE_IDS as S, waitBlocked } from "./permissionIdentityFixture";

const source = permissionFingerprint();
beforeAll(async () => { await setupIdentityFixture(); await observeCandidateStage(db); });
afterEach(resetIdentityFixture);
afterAll(async () => {
  try { await cleanupIdentityFixture(); }
  finally { if (process.env.PERM_IDENTITY_EVIDENCE_FILE) writeFileSync(process.env.PERM_IDENTITY_EVIDENCE_FILE,
    JSON.stringify({ ...fixtureEvidence, sourceFingerprint: source, sourceAfter: permissionFingerprint() }, null, 2)); }
});
const start = (id = E[0], pin = "384729") => rpc("permission_start_session", { p_employee_id: id, p_pin: pin });
const own = (patch: object = {}) => ({ requestId: randomUUID(), expectedRevision: 0, currentPin: "384729", newPin: "927416", ...patch });
const recover = (patch: object = {}) => ({ requestId: randomUUID(), storeId: S[0], targetId: E[0], operatorRef: "op-test", caseRef: "case-test-001", proofRef: "synthetic-reviewed-record", newPin: "927416", ...patch });
async function recovery(p: object, c = db) {
  await c.query("set local role pos_owner_recovery");
  try { return (await c.query("select private.permission_recover_owner($1) r", [p])).rows[0].r; }
  finally { await c.query("reset role"); }
}
async function current(token: string) { return rpc("permission_get_authority", {}, token); }
async function identityState() {
  const r = (await db.query(`select e.permission_revision::int revision, e.passcode_hash, count(s.*)::int sessions,
    count(s.*) filter(where revoked_at is not null)::int revoked from public.employees e left join private.employee_sessions s on s.employee_id=e.id
    where e.id=$1 group by e.id`, [E[0]])).rows[0];
  return r;
}
async function counts() {
  return (await db.query(`select (select count(*)::int from public.employee_admin_audit) audit,
   (select count(*)::int from private.employee_admin_requests) registry,(select count(*)::int from public.store_change_signals) signal`)).rows[0];
}
test("TC-PERM-02/20 T04 real Auth REST login returns catalog authority matching core and minimal roster", async () => {
  const s = await start(); expect(s.ok).toBe(true); expect(typeof s.token === "string" && s.token.length === 43).toBe(true);
  expect(Date.parse(s.expiresAt) - Date.parse(s.issuedAt)).toBe(43200000);
  const e = (await db.query("select id,store_id,name,role,is_active,permission_revision from public.employees where id=$1", [E[0]])).rows[0];
  expect(s.authority.snapshot).toEqual(createAuthoritySnapshot(s.authority.catalog, { id: e.id, storeId: e.store_id, name: e.name, role: e.role, isActive: e.is_active, permissionRevision: Number(e.permission_revision), overrides: null }, true));
  const roster = await rpc("permission_list_roster"); expect(roster.data).toHaveLength(3);
  expect(roster.data.every((e: object) => Object.keys(e).sort().join() === "id,name")).toBe(true);
  expect((await current(s.token)).data).toEqual(s.authority);
  const rev = await rpc("permission_get_revision", {}, s.token); expect(rev.data.employeeRevision).toBe(0); expect(Object.keys(rev.data).sort()).toEqual(["catalogRevision", "employeeRevision", "serverTime"]);
});
test.each([["empty", ""], ["short", "12345"], ["long", "1234567"], ["unicode", "１２３４５６"], ["space", " 384729"], ["incorrect", "384728"]])("TC-PERM-20 T04 login rejects malformed or wrong PIN variant %s", async (_label, pin) => {
  expect((await start(E[0], pin)).error.code).toBe("INVALID_PIN"); expect((await identityState()).sessions).toBe(0);
});
test("TC-PERM-08/28 T04 inactive disabled foreign and forged identities cannot start or authorize", async () => {
  await db.query("update public.employees set is_active=false where id=$1", [E[2]]); expect((await start(E[2])).error.code).toBe("INVALID_PIN");
  await db.query("update public.employees set is_active=true,role='kitchen' where id=$1", [E[2]]); expect((await start(E[2])).error.code).toBe("EMPLOYEE_ROLE_UNAVAILABLE");
  expect((await start(E[3])).error.code).toBe("INVALID_PIN");
  expect((await current("x".repeat(43))).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  const s = await start(); await db.query("begin"); await actor(db, s.token, S[1]);
  expect((await db.query("select public.permission_get_authority() r")).rows[0].r.error.code).toBe("EMPLOYEE_SESSION_REQUIRED"); await db.query("rollback");
  const forged = await rpc("permission_start_session", { p_employee_id: E[0], p_pin: "384729", actorId: E[0], permissions: ["report.view"] }); expect(forged.code).toBe("PGRST202");
  await db.query("begin"); await db.query("select set_config('request.jwt.claims','{}',true)");
  expect((await db.query("select public.permission_get_authority() r")).rows[0].r.error.code).toBe("AUTH_REQUIRED");
});
test("TC-PERM-08/09 T04 prelocked PIN and deactivation revoke all sessions while role changes preserve them", async () => {
  const a = await start(E[2]), b = await start(E[2]);
  await db.query("begin"); await db.query("select private.permission_identity_lock($1,$2,true)", [S[0], E[2]]);
  await db.query("update public.employees set role='waiter' where id=$1", [E[2]]); await db.query("commit");
  expect((await current(a.token)).data.snapshot.role).toBe("waiter");
  await db.query("begin"); await db.query("select private.permission_identity_lock($1,$2,true)", [S[0], E[2]]);
  await db.query("update public.employees set is_active=false where id=$1", [E[2]]); await db.query("commit");
  expect((await current(a.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED"); expect((await current(b.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  await db.query("update public.employees set is_active=true where id=$1", [E[2]]); expect((await current(a.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED"); expect((await start(E[2])).ok).toBe(true);
});
test("TC-PERM-10 T04 self PIN is atomic audited and replay never revokes a new session", async () => {
  const a = await start(), b = await start(), p = own();
  const r = await rpc("permission_change_own_pin", { p_request: p }, a.token); expect(r).toMatchObject({ ok: true, outcome: "applied", data: { employeeRevision: 1, credentialChanged: true } });
  expect((await current(a.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED"); expect((await current(b.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED"); expect((await start()).error.code).toBe("INVALID_PIN");
  const next = await start(E[0], "927416"), before = await identityState();
  expect((await rpc("permission_change_own_pin", { p_request: p }, next.token)).outcome).toBe("replayed");
  expect(JSON.stringify(before) === JSON.stringify(await identityState())).toBe(true);
  expect(next).toMatchObject({ kind: "normal", pinChangeRequired: false });
  expect((await current(next.token)).ok).toBe(true);
  expect(await counts()).toEqual({ audit: 1, registry: 1, signal: 1 });
  const audit = (await db.query("select to_jsonb(a) a from public.employee_admin_audit a")).rows[0].a;
  expect(audit.outcome).toBe("applied"); expect(audit.actor_type).toBe("employee"); expect(audit.actual_after.permissionRevision).toBe(1);
  expect(JSON.stringify(audit).includes(p.currentPin) || JSON.stringify(audit).includes(p.newPin) || JSON.stringify(audit).includes(next.token)).toBe(false);
});
test.each([
  ["wrong current", { currentPin: "384728" }, "INVALID_PIN"], ["revision", { expectedRevision: 1 }, "EMPLOYEE_VERSION_CONFLICT"],
  ["short PIN", { newPin: "12345" }, "INVALID_EMPLOYEE_REQUEST"], ["null PIN", { newPin: null }, "INVALID_EMPLOYEE_REQUEST"],
])("TC-PERM-10 T04 verified denial persists audit without identity effects: %s", async (_name, patch, code) => {
  const s = await start(), p = own(patch as object), before = await identityState();
  expect((await rpc("permission_change_own_pin", { p_request: p }, s.token)).error.code).toBe(code);
  expect(JSON.stringify(before) === JSON.stringify(await identityState())).toBe(true);
  expect(await counts()).toEqual({ audit: 1, registry: 1, signal: 0 });
  expect((await rpc("permission_change_own_pin", { p_request: p }, s.token)).error.code).toBe(code); expect((await counts()).audit).toBe(1);
  expect((await rpc("permission_change_own_pin", { p_request: { ...p, newPin: "111111" } }, s.token)).error.code).toBe("ADMIN_REQUEST_REUSED");
});
test("TC-PERM-10 T04 same PIN is noop and unverified session cannot write an audit", async () => {
  const s = await start(), before = await identityState(), p = own({ newPin: "384729" });
  expect((await rpc("permission_change_own_pin", { p_request: p }, s.token)).outcome).toBe("noop");
  expect(JSON.stringify(before) === JSON.stringify(await identityState())).toBe(true); expect(await counts()).toEqual({ audit: 1, registry: 1, signal: 0 });
  await rpc("permission_revoke_session", {}, s.token);
  expect((await rpc("permission_change_own_pin", { p_request: own() }, s.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED"); expect((await counts()).audit).toBe(1);
});
test.each([
  ["missing", { expectedRevision: undefined }], ["null", { expectedRevision: null }], ["text", { expectedRevision: "abc" }],
  ["negative", { expectedRevision: -1 }], ["fraction", { expectedRevision: 0.5 }], ["unsafe", { expectedRevision: 9007199254740992 }],
  ["zero uuid", { requestId: "00000000-0000-0000-0000-000000000000" }], ["forged target", { targetId: E[1] }],
])("TC-PERM-10/19 T04 rejects malformed self PIN envelope %s without fictitious audit", async (_label, patch) => {
  const s = await start(); expect((await rpc("permission_change_own_pin", { p_request: own(patch) }, s.token)).error.code).toBe("INVALID_EMPLOYEE_REQUEST");
  expect(await counts()).toEqual({ audit: 0, registry: 0, signal: 0 }); expect((await identityState()).revision).toBe(0);
});
test.each(["public.employee_admin_audit", "public.store_change_signals", "private.employee_admin_requests"])("TC-PERM-10/11 T04 failure in %s rolls back PIN sessions revision and all evidence", async table => {
  const s = await start(), before = await identityState();
  await db.query(`create function private.identity_test_fault() returns trigger language plpgsql as $$ begin raise exception 'synthetic fault'; end $$;
   create trigger identity_test_fault before insert on ${table} for each row execute function private.identity_test_fault()`);
  expect((await rpc("permission_change_own_pin", { p_request: own() }, s.token)).error.code).toBe("PERMISSION_UPDATE_UNAVAILABLE");
  expect(JSON.stringify(before) === JSON.stringify(await identityState())).toBe(true); expect(await counts()).toEqual({ audit: 0, registry: 0, signal: 0 });
  await db.query("begin"); expect((await recovery(recover())).error.code).toBe("PERMISSION_UPDATE_UNAVAILABLE"); await db.query("commit");
  expect(JSON.stringify(before) === JSON.stringify(await identityState())).toBe(true); expect(await counts()).toEqual({ audit: 0, registry: 0, signal: 0 });
});
test("TC-PERM-11/58 T04 operator recovery needs dedicated role and evidence and replays exactly once", async () => {
  const s = await start(), p = recover();
  expect((await db.query("select private.permission_recover_owner($1) r", [p])).rows[0].r.error.code).toBe("FORBIDDEN");
  for (const field of ["operatorRef", "caseRef", "proofRef"]) {
    await db.query("begin"); expect((await recovery({ ...p, [field]: "" })).error.code).toBe("OWNER_RECOVERY_REVIEW_REQUIRED"); await db.query("rollback");
  }
  await db.query("begin"); expect((await recovery({ ...p, targetId: E[2] })).error.code).toBe("OWNER_PROTECTED"); await db.query("rollback");
  await db.query("begin"); expect((await recovery({ ...p, targetId: E[3] })).error.code).toBe("NOT_FOUND"); await db.query("rollback");
  await db.query("begin"); expect((await recovery(p)).outcome).toBe("applied"); await db.query("commit");
  expect((await current(s.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
  const next = await start(E[0], "927416"), before = await identityState();
  await db.query("begin"); expect((await recovery(p)).outcome).toBe("replayed"); await db.query("commit");
  expect(JSON.stringify(before) === JSON.stringify(await identityState())).toBe(true);
  expect(next).toMatchObject({ kind: "required_pin_change", pinChangeRequired: true });
  expect((await current(next.token)).error.code).toBe("PIN_CHANGE_REQUIRED");
  expect((await rpc("permission_check_required_pin_session", {}, next.token)).data.valid).toBe(true);
  const a = (await db.query("select actor_type,actor_key,operator_case_ref,operator_proof_ref from public.employee_admin_audit")).rows;
  expect(a).toEqual([{ actor_type: "operator", actor_key: "op-test", operator_case_ref: "case-test-001", operator_proof_ref: "synthetic-reviewed-record" }]);
});
test("TC-PERM-14/58 T04 application and service_role have no recovery helper registry or identity DML privileges", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    expect((await db.query("select has_function_privilege($1,'private.permission_recover_owner(jsonb)','EXECUTE') or has_function_privilege($1,'private.permission_pin_change(uuid,public.employees,jsonb,text,text,text,text)','EXECUTE') exposed", [role])).rows[0].exposed).toBe(false);
    expect((await db.query("select has_table_privilege($1,'private.employee_admin_requests','SELECT') or has_table_privilege($1,'private.permission_request_mac_keys','SELECT') exposed", [role])).rows[0].exposed).toBe(false);
  }
  const owner = await start();
  const old = await rpc("reset_employee_pin", { p_employee_id: E[0], p_pin: "111111" }, owner.token); expect(["42501", "PGRST202"].includes(old.code)).toBe(true);
  const m = await start(E[1]); expect((await rpc("permission_change_own_pin", { p_request: own() }, m.token)).error.code).toBe("FORBIDDEN");
  await db.query("begin"); await actor(db, owner.token); await db.query("set local role authenticated");
  await expect(db.query("update public.employees set name='bypass' where id=$1", [E[0]])).rejects.toMatchObject({ code: "42501" });
});
test.each(["second", "inactive", "zero", "empty store"])("TC-PERM-14 T04 database owner invariant rejects %s owner state", async variant => {
  await db.query("begin");
  if (variant === "second") await expect(db.query("update public.employees set role='owner' where id=$1", [E[1]])).rejects.toMatchObject({ code: "23505" });
  if (variant === "inactive") await expect(db.query("update public.employees set is_active=false where id=$1", [E[0]])).rejects.toMatchObject({ code: "23514" });
  if (variant === "zero") { await db.query("update public.employees set role='manager' where id=$1", [E[0]]); await expect(db.query("set constraints all immediate")).rejects.toMatchObject({ code: "23514" }); }
  if (variant === "empty store") { const sid = randomUUID(); await db.query("insert into auth.users(id,email) values($1,'empty@example.test')", [sid]); await db.query("insert into public.stores(id,store_no,name) values($1,101,'synthetic')", [sid]); await expect(db.query("set constraints all immediate")).rejects.toMatchObject({ code: "23514" }); }
});
test("TC-PERM-43 T04 expired and revoked logout is idempotent and only affects the presented token", async () => {
  const a = await start(), b = await start();
  await db.query("update private.employee_sessions set issued_at=statement_timestamp()-interval '13 hours',expires_at=statement_timestamp()-interval '1 hour' where token_hash=extensions.digest(convert_to($1,'UTF8'),'sha256')", [a.token]);
  expect((await rpc("permission_revoke_session", {}, a.token)).ok).toBe(true);
  expect((await rpc("permission_revoke_session", {}, a.token)).ok).toBe(true); expect((await current(b.token)).ok).toBe(true);
  expect((await identityState()).revoked).toBe(1);
});
test.each(["start first", "reset first"])("TC-PERM-43 T04 concurrent issuance recovery barrier: %s", async order => {
  const first = await connection(), second = await connection();
  try {
    await first.query("begin"); await second.query("begin"); await actor(first); await actor(second);
    const pid = (await second.query("select pg_backend_pid() p")).rows[0].p;
    if (order === "start first") {
      const issued = (await first.query("select public.permission_start_session($1,'384729') r", [E[0]])).rows[0].r;
      const pending = recovery(recover(), second); await waitBlocked(pid); await first.query("commit"); expect((await pending).outcome).toBe("applied"); await second.query("commit");
      expect((await current(issued.token)).error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
    } else {
      expect((await recovery(recover(), first)).outcome).toBe("applied");
      const pending = second.query("select public.permission_start_session($1,'384729') r", [E[0]]); await waitBlocked(pid); await first.query("commit");
      expect((await pending).rows[0].r.error.code).toBe("INVALID_PIN"); await second.query("commit");
    }
    expect((await start(E[0], "927416")).ok).toBe(true);
  } finally { await first.query("rollback"); await second.query("rollback"); await first.end(); await second.end(); }
});
test("TC-PERM-28 T04 final authority rechecks expiry after catalog lock wait and negative control is detected", async () => {
  const originalClock = (await db.query("select pg_get_functiondef('private.write_clock()'::regprocedure) d")).rows[0].d;
  const originalCurrent = (await db.query("select pg_get_functiondef('private.permission_current_employee(boolean)'::regprocedure) d")).rows[0].d;
  await db.query("create table private.identity_clock(moment timestamptz); insert into private.identity_clock values('2026-09-16T00:00:00Z'); create or replace function private.write_clock() returns timestamptz language sql volatile set search_path=pg_catalog as $$select moment from private.identity_clock$$");
  const s = await start(), blocker = await connection(), reader = await connection();
  try {
    await blocker.query("begin"); await blocker.query("select pg_advisory_xact_lock(hashtextextended('permission-catalog',0))");
    await reader.query("begin"); await actor(reader, s.token); const pid = (await reader.query("select pg_backend_pid() p")).rows[0].p;
    const pending = reader.query("select public.permission_get_authority() r"); await waitBlocked(pid);
    await db.query("update private.identity_clock set moment='2026-09-16T12:00:01Z'"); await blocker.query("commit");
    expect((await pending).rows[0].r.error.code).toBe("EMPLOYEE_SESSION_REQUIRED"); await reader.query("rollback");
    const weakened = originalCurrent.replace("or s.expires_at<=private.write_clock()", ""); expect(weakened !== originalCurrent).toBe(true);
    await db.query(weakened); expect((await current(s.token)).ok).toBe(true); // The deny oracle would fail under this mutation.
    fixtureEvidence.expiryNegativeControlDetected = true;
  } finally {
    await blocker.query("rollback"); await reader.query("rollback"); await blocker.end(); await reader.end();
    await db.query(originalCurrent); await db.query(originalClock); await db.query("drop table private.identity_clock");
  }
});
test("TC-PERM-28/30 T04 authority reads catalog changes committed during lock wait", async () => {
  const s = await start(E[2]), writer = await connection(), reader = await connection();
  try {
    await writer.query("begin"); await writer.query("delete from public.role_permission_defaults where role_code='cashier' and permission_code='payment.take'");
    await reader.query("begin"); await actor(reader, s.token); const pid = (await reader.query("select pg_backend_pid() p")).rows[0].p;
    const pending = reader.query("select public.permission_get_authority() r"); await waitBlocked(pid); await writer.query("commit");
    const r = (await pending).rows[0].r; expect(r.ok).toBe(true);
    expect(r.data.snapshot.catalogRevision).toBe(s.authority.snapshot.catalogRevision + 1);
    expect(r.data.snapshot.permissions).not.toContain("payment.take");
    expect(r.data.catalog.revision).toBe(r.data.snapshot.catalogRevision); await reader.query("rollback");
  } finally {
    await writer.query("rollback"); await reader.query("rollback"); await writer.end(); await reader.end();
    await db.query("insert into public.role_permission_defaults values('cashier','payment.take') on conflict do nothing");
  }
});
test.each([1, 2147483647])("TC-PERM-52 T04 bootstrap accepts storeNo boundary %s with matching provisioning", async number => {
  const sid = randomUUID(); await db.query("begin");
  if (number === 1) await db.query("update public.stores set store_no=999 where store_no=1");
  await db.query("insert into auth.users(id,email) values($1,$2)", [sid, `store${number}@store.pos.local`]); await actor(db, undefined, sid);
  const p = { requestId: randomUUID(), ownerId: randomUUID(), storeNo: number, displayName: number === 1 ? "A" : "😀".repeat(120), address: number === 1 ? "" : "😀".repeat(500), seedDemo: false };
  expect((await db.query("select public.permission_bootstrap_store($1) r", [p])).rows[0].r.outcome).toBe("applied"); await db.query("set constraints all immediate");
});
test("TC-PERM-52 T04 bootstrap is atomic has strict bounds and retry cannot replace owner or PIN", async () => {
  const sid = "10000000-0000-4000-8000-000000000003", eid = "20000000-0000-4000-8000-000000000201";
  await db.query("begin"); await db.query("insert into auth.users(id,email) values($1,'store101@store.pos.local')", [sid]); await actor(db, undefined, sid);
  const p = { requestId: randomUUID(), ownerId: eid, storeNo: 101, displayName: " Cà phê An ", address: "", seedDemo: false };
  const call = async (p: object) => (await db.query("select public.permission_bootstrap_store($1) r", [p])).rows[0].r;
  for (const patch of [{ pin: "111111" }, { storeNo: 0 }, { storeNo: 2147483648 }, { storeNo: "101" }, { storeNo: null }, { displayName: " " }, { displayName: "\t\u00a0\u3000" }, { displayName: "😀".repeat(121) }, { address: "x".repeat(501) }, { ownerId: "00000000-0000-0000-0000-000000000000" }]) expect((await call({ ...p, ...patch })).error.code).toBe("INVALID_WRITE_REQUEST");
  expect((await call({ ...p, storeNo: 102 })).error.code).toBe("FORBIDDEN");
  expect((await call(p)).outcome).toBe("applied"); expect((await call(p)).outcome).toBe("replayed");
  expect((await call({ ...p, ownerId: randomUUID() })).error.code).toBe("BOOTSTRAP_CONFLICT");
  expect((await db.query("select role,is_active,passcode_hash=extensions.crypt('123456',passcode_hash) initial_pin from public.employees where store_id=$1", [sid])).rows).toEqual([{ role: "owner", is_active: true, initial_pin: true }]);
  expect(JSON.stringify(await call(p)).includes("123456")).toBe(false); await db.query("set constraints all immediate");
});
test("TC-PERM-52 T04 bootstrap owner insert failure rolls back store settings and registry", async () => {
  const sid = randomUUID(); await db.query("begin"); await db.query("insert into auth.users(id,email) values($1,'store101@store.pos.local')", [sid]); await actor(db, undefined, sid);
  await db.query("create function private.identity_test_fault() returns trigger language plpgsql as $$ begin raise exception 'synthetic fault'; end $$; create trigger identity_test_fault before insert on public.employees for each row execute function private.identity_test_fault()");
  const r = (await db.query("select public.permission_bootstrap_store($1) r", [{ requestId: randomUUID(), ownerId: randomUUID(), storeNo: 101, displayName: "Test", address: "", seedDemo: false }])).rows[0].r;
  expect(r.error.code).toBe("PERMISSION_UPDATE_UNAVAILABLE"); expect((await db.query("select count(*)::int n from public.stores where id=$1", [sid])).rows[0].n).toBe(0);
  expect((await db.query("select count(*)::int n from private.bootstrap_requests where store_id=$1", [sid])).rows[0].n).toBe(0);
});
test("TC-PERM-20 T04 Supabase adapter uses real REST and keeps credential out of returned state", async () => {
  const client = createClient(env.api, env.anonKey, { global: { headers: { Authorization: "Bearer " + env.storeJwt } }, auth: { persistSession: false, autoRefreshToken: false } });
  const repo = new SupabasePermissionIdentityRepo(client), session = await repo.startSession(E[0], "384729");
  expect(Object.keys(session).sort()).toEqual(["authority", "expiresAt", "issuedAt", "kind", "pinChangeRequired"]);
  expect((await repo.getAuthority()).snapshot.permissions).toHaveLength(15);
  const result = await repo.changeOwnPin(own()); expect(result.outcome).toBe("applied"); expect(employeeCredential(client).token === null).toBe(true);
  await repo.startSession(E[0], "927416"); await repo.revokeSession(); expect(employeeCredential(client).token === null).toBe(true);
});
