import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import {
  actor,
  cleanupIdentityFixture,
  db,
  EMPLOYEE_IDS as E,
  connection,
  resetIdentityFixture,
  setupIdentityFixture,
  STORE_IDS as S,
  waitBlocked,
} from "./permissionIdentityFixture";

beforeAll(async () => {
  await setupIdentityFixture();
  await db.query(readFileSync("supabase/candidate/permission-seed.sql", "utf8"));
});
afterAll(cleanupIdentityFixture);
afterEach(resetIdentityFixture);

async function call(name: string, args: unknown[] = []) {
  const placeholders = args.map((_, index) => `$${index + 1}`).join(",");
  return (await db.query(`select public.${name}(${placeholders}) result`, args)).rows[0].result;
}

async function issueSession(employeeId = E[0], pin = "384729", storeId = S[0]) {
  await db.query("begin");
  try {
    await actor(db, undefined, storeId);
    const result = await call("permission_start_session", [employeeId, pin]);
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

// Keep secret-bearing rows inside the transaction. Only comparison booleans and counts
// leave PostgreSQL, so failed assertions cannot print a credential or token hash.
async function capturePinDenialBaseline() {
  await db.query(`create temporary table pin_denial_baseline on commit drop as
    select e.passcode_hash, e.pin_change_required, e.permission_revision,
      (select coalesce(jsonb_agg(to_jsonb(s) order by s.token_hash), '[]'::jsonb)
       from private.employee_sessions s where s.employee_id=e.id) sessions,
      (select coalesce(jsonb_agg(to_jsonb(signal) order by signal.store_id, signal.topic), '[]'::jsonb)
       from public.store_change_signals signal) signals
    from public.employees e where e.id=$1`, [E[0]]);
}

async function pinDenialSnapshot() {
  return (await db.query(`select
      e.passcode_hash=b.passcode_hash hash_unchanged,
      e.pin_change_required=b.pin_change_required flag_unchanged,
      e.permission_revision=b.permission_revision revision_unchanged,
      (select coalesce(jsonb_agg(to_jsonb(s) order by s.token_hash), '[]'::jsonb)
       from private.employee_sessions s where s.employee_id=e.id)=b.sessions sessions_unchanged,
      (select coalesce(jsonb_agg(to_jsonb(signal) order by signal.store_id, signal.topic), '[]'::jsonb)
       from public.store_change_signals signal)=b.signals signals_unchanged,
      (select count(*)::int from public.employee_admin_audit) audit,
      (select count(*)::int from private.employee_admin_requests) registry
    from public.employees e cross join pg_temp.pin_denial_baseline b where e.id=$1`, [E[0]])).rows[0];
}

async function configureSeedWorkflow(storeId: string, status: "pending" | "in_progress" = "pending", generation = 0, revision = 0) {
  const workflowId = (await db.query("select workflow_id from private.initial_seed_workflows where store_id=$1", [storeId])).rows[0].workflow_id;
  await db.query("update private.initial_seed_workflows set requested=true,status=$2,auto_claimed_at=null,run_generation=$3,workflow_revision=$4,last_error_code=null where workflow_id=$1", [workflowId, status, generation, revision]);
  await db.query("delete from private.initial_seed_stages where workflow_id=$1", [workflowId]);
  for (const stage of ["employee", "menu", "floor"]) await db.query(
    "insert into private.initial_seed_stages(workflow_id,stage,stage_id) values($1,$2,private.permission_stable_uuid($3,'initial-seed.v1.'||$2))",
    [workflowId, stage, storeId],
  );
  return workflowId;
}

test("TC-PIN-01/03/06 restricted login, proof, completion, and normal relogin", async () => {
  await db.query("begin");
  try {
    await db.query("update public.employees set pin_change_required=true where id=$1", [E[0]]);
    await actor(db);
    const restricted = await call("permission_start_session", [E[0], "384729"]);
    expect(restricted).toMatchObject({ ok: true, kind: "required_pin_change", pinChangeRequired: true, employeeId: E[0] });
    expect(Date.parse(restricted.expiresAt) - Date.parse(restricted.issuedAt)).toBe(300_000);
    expect(restricted).not.toHaveProperty("authority");

    await actor(db, restricted.token);
    await expect(call("permission_get_authority")).resolves.toMatchObject({ error: { code: "PIN_CHANGE_REQUIRED" } });
    await expect(call("permission_get_revision")).resolves.toMatchObject({ error: { code: "PIN_CHANGE_REQUIRED" } });
    await expect(call("permission_change_own_pin", [{ requestId: randomUUID(), expectedRevision: 0, currentPin: "384729", newPin: "927416" }]))
      .resolves.toMatchObject({ error: { code: "PIN_CHANGE_REQUIRED" } });
    await expect(call("permission_get_initial_seed_status")).resolves.toMatchObject({ error: { code: "PIN_CHANGE_REQUIRED" } });
    await expect(call("permission_check_required_pin_session")).resolves.toMatchObject({
      ok: true,
      data: { valid: true, purpose: "required_pin_change", employeeRevision: 0 },
    });
    await db.query("update public.employees set permission_revision=1 where id=$1", [E[0]]);
    await expect(call("permission_check_required_pin_session")).resolves.toMatchObject({ error: { code: "EMPLOYEE_SESSION_REQUIRED" } });
    await db.query("update public.employees set permission_revision=0 where id=$1", [E[0]]);
    const requestId = randomUUID();
    const completed = await call("permission_complete_required_pin_change", [{ requestId, expectedRevision: 0, newPin: "927416" }]);
    expect(completed).toMatchObject({ outcome: "applied", data: { credentialChanged: true, pinChangeRequired: false, employeeRevision: 1 } });
    await expect(call("permission_complete_required_pin_change", [{ requestId, expectedRevision: 0, newPin: "927416" }]))
      .resolves.toMatchObject({ error: { code: "EMPLOYEE_SESSION_REQUIRED" } });
    await actor(db);
    await expect(call("permission_start_session", [E[0], "384729"])).resolves.toMatchObject({ error: { code: "INVALID_PIN" } });
    await expect(call("permission_start_session", [E[0], "927416"])).resolves.toMatchObject({ ok: true, kind: "normal", pinChangeRequired: false });
  } finally {
    await db.query("rollback");
  }
});

test("TC-PIN-04/09 denied completion is replayable only with the same secret MAC", async () => {
  await db.query("begin");
  try {
    await db.query("update public.employees set pin_change_required=true where id=$1", [E[0]]);
    await actor(db);
    const restricted = await call("permission_start_session", [E[0], "384729"]);
    expect(restricted).toMatchObject({ ok: true, kind: "required_pin_change" });
    await actor(db, restricted.token);
    await capturePinDenialBaseline();
    expect(await pinDenialSnapshot()).toEqual({ hash_unchanged: true, flag_unchanged: true, revision_unchanged: true, sessions_unchanged: true, signals_unchanged: true, audit: 0, registry: 0 });
    const requestId = randomUUID();
    const request = { requestId, expectedRevision: 0, newPin: "384729" };
    await expect(call("permission_complete_required_pin_change", [request])).resolves.toMatchObject({ error: { code: "PIN_REUSE_NOT_ALLOWED" } });
    expect(await pinDenialSnapshot()).toEqual({ hash_unchanged: true, flag_unchanged: true, revision_unchanged: true, sessions_unchanged: true, signals_unchanged: true, audit: 1, registry: 1 });
    await expect(call("permission_complete_required_pin_change", [request])).resolves.toMatchObject({ error: { code: "PIN_REUSE_NOT_ALLOWED" } });
    expect(await pinDenialSnapshot()).toEqual({ hash_unchanged: true, flag_unchanged: true, revision_unchanged: true, sessions_unchanged: true, signals_unchanged: true, audit: 1, registry: 1 });
    await expect(call("permission_complete_required_pin_change", [{ ...request, newPin: "927416" }]))
      .resolves.toMatchObject({ error: { code: "ADMIN_REQUEST_REUSED" } });
    expect(await pinDenialSnapshot()).toEqual({ hash_unchanged: true, flag_unchanged: true, revision_unchanged: true, sessions_unchanged: true, signals_unchanged: true, audit: 1, registry: 1 });
  } finally {
    await db.query("rollback");
  }
});

test("TC-PIN-04 forced endpoint rejects malformed payloads and accepts distinct weak six-digit PINs", async () => {
  await db.query("begin");
  try {
    await db.query("update public.employees set pin_change_required=true where id=$1", [E[0]]);
    await actor(db);
    const restricted = await call("permission_start_session", [E[0], "384729"]);
    expect(restricted).toMatchObject({ ok: true, kind: "required_pin_change" });
    await actor(db, restricted.token);
    await capturePinDenialBaseline();
    expect(await pinDenialSnapshot()).toEqual({ hash_unchanged: true, flag_unchanged: true, revision_unchanged: true, sessions_unchanged: true, signals_unchanged: true, audit: 0, registry: 0 });
    const valid = { requestId: randomUUID(), expectedRevision: 0, newPin: "927416" };
    const invalid: unknown[] = [
      null, {}, { ...valid, requestId: "00000000-0000-0000-0000-000000000000" },
      { expectedRevision: 0, newPin: "927416" },
      { ...valid, expectedRevision: -1 }, { ...valid, expectedRevision: 1.5 },
      { ...valid, expectedRevision: 9_007_199_254_740_992 },
      { ...valid, newPin: "" }, { ...valid, newPin: "12345" },
      { ...valid, newPin: "1234567" }, { ...valid, newPin: "１２３４５６" },
      { ...valid, newPin: "١٢٣٤٥٦" }, { ...valid, newPin: "123 45" },
      { ...valid, newPin: " 927416" }, { ...valid, newPin: 927416 },
      { ...valid, newPin: null }, { ...valid, targetId: E[0] },
    ];
    for (const [index, payload] of invalid.entries()) {
      const result = await call("permission_complete_required_pin_change", [payload]);
      expect(result.error?.code).toBe("INVALID_EMPLOYEE_REQUEST");
      expect(await pinDenialSnapshot(), `invalid payload variant ${index + 1}`).toEqual({
        hash_unchanged: true, flag_unchanged: true, revision_unchanged: true,
        sessions_unchanged: true, signals_unchanged: true, audit: 0, registry: 0,
      });
    }
    for (const weakPin of ["000000", "111111"]) {
      await db.query("savepoint weak_pin_variant");
      const accepted = await call("permission_complete_required_pin_change", [{ ...valid, requestId: randomUUID(), newPin: weakPin }]);
      expect(accepted).toMatchObject({ outcome: "applied", data: { credentialChanged: true, pinChangeRequired: false, employeeRevision: 1 } });
      const matches = (await db.query("select passcode_hash=extensions.crypt($2,passcode_hash) ok from public.employees where id=$1", [E[0], weakPin])).rows[0].ok;
      expect(matches).toBe(true);
      await db.query("rollback to savepoint weak_pin_variant");
      await db.query("release savepoint weak_pin_variant");
    }
  } finally {
    await db.query("rollback");
  }
});

test.each(["first", "second"] as const)("TC-PIN-08 two restricted sessions serialize with %s queued first", async order => {
  await db.query("update public.employees set pin_change_required=true where id=$1", [E[0]]);
  const firstSession = await issueSession();
  const secondSession = await issueSession();
  const barrier = await connection();
  const first = await connection();
  const second = await connection();
  try {
    await barrier.query("begin");
    await barrier.query("select private.permission_store_mutex($1)", [S[0]]);
    await first.query("begin"); await actor(first, firstSession.token);
    await second.query("begin"); await actor(second, secondSession.token);
    const firstPid = (await first.query("select pg_backend_pid() pid")).rows[0].pid;
    const secondPid = (await second.query("select pg_backend_pid() pid")).rows[0].pid;
    const firstRequest = { requestId: randomUUID(), expectedRevision: 0, newPin: "927416" };
    const secondRequest = { requestId: randomUUID(), expectedRevision: 0, newPin: "765432" };
    const enqueueFirst = () => first.query("select public.permission_complete_required_pin_change($1) result", [firstRequest]);
    const enqueueSecond = () => second.query("select public.permission_complete_required_pin_change($1) result", [secondRequest]);
    const winnerClient = order === "first" ? first : second;
    const loserClient = order === "first" ? second : first;
    const winnerPending = order === "first" ? enqueueFirst() : enqueueSecond();
    await waitBlocked(order === "first" ? firstPid : secondPid);
    const loserPending = order === "first" ? enqueueSecond() : enqueueFirst();
    await waitBlocked(order === "first" ? secondPid : firstPid);
    await barrier.query("commit");
    const winnerResult = (await winnerPending).rows[0].result;
    expect(winnerResult).toMatchObject({ ok: true, outcome: "applied", data: { employeeRevision: 1 } });
    await winnerClient.query("commit");
    const loserResult = (await loserPending).rows[0].result;
    expect(loserResult.error?.code).toBe("EMPLOYEE_SESSION_REQUIRED");
    await loserClient.query("commit");
    const winningPin = order === "first" ? "927416" : "765432";
    const losingPin = order === "first" ? "765432" : "927416";
    expect((await db.query(`select permission_revision::int revision,pin_change_required,
      passcode_hash=extensions.crypt($2,passcode_hash) winner,
      passcode_hash=extensions.crypt($3,passcode_hash) loser,
      (select count(*)::int from private.employee_sessions where employee_id=$1 and revoked_at is not null) revoked,
      (select count(*)::int from public.employee_admin_audit where request_id in ($4,$5)) audit,
      (select count(*)::int from private.employee_admin_requests where request_id in ($4,$5)) registry,
      (select revision::int from public.store_change_signals where store_id=$6 and topic='permission') signal_revision
      from public.employees where id=$1`, [E[0], winningPin, losingPin, firstRequest.requestId, secondRequest.requestId, S[0]])).rows[0])
      .toEqual({ revision: 1, pin_change_required: false, winner: true, loser: false,
        revoked: 2, audit: 1, registry: 1, signal_revision: 1 });
  } finally {
    await barrier.query("rollback").catch(() => undefined); await first.query("rollback").catch(() => undefined); await second.query("rollback").catch(() => undefined);
    await barrier.end(); await first.end(); await second.end();
  }
});

test.each(["recovery-first", "completion-first"])("TC-PIN-08 recovery/complete lock race %s has one ordered final state", async order => {
  await db.query("update public.employees set pin_change_required=true where id=$1", [E[0]]);
  const restricted = await issueSession();
  const complete = await connection();
  const recovery = await connection();
  const recoveryRequest = { requestId: randomUUID(), storeId: S[0], targetId: E[0], operatorRef: "op-test", caseRef: "case-test-001", proofRef: "proof-test-001", newPin: "765432" };
  try {
    if (order === "recovery-first") {
      await recovery.query("begin"); await recovery.query("set local role pos_owner_recovery");
      expect((await recovery.query("select private.permission_recover_owner($1) result", [recoveryRequest])).rows[0].result.outcome).toBe("applied");
      await recovery.query("reset role");
      await complete.query("begin"); await actor(complete, restricted.token);
      const pid = (await complete.query("select pg_backend_pid() pid")).rows[0].pid;
      const pending = complete.query("select public.permission_complete_required_pin_change($1) result", [{ requestId: randomUUID(), expectedRevision: 0, newPin: "927416" }]);
      await waitBlocked(pid); await recovery.query("commit");
      expect((await pending).rows[0].result.error.code).toBe("EMPLOYEE_SESSION_REQUIRED"); await complete.query("commit");
    } else {
      await complete.query("begin"); await actor(complete, restricted.token);
      expect((await complete.query("select public.permission_complete_required_pin_change($1) result", [{ requestId: randomUUID(), expectedRevision: 0, newPin: "927416" }])).rows[0].result.outcome).toBe("applied");
      await recovery.query("begin"); await recovery.query("set local role pos_owner_recovery");
      const pid = (await recovery.query("select pg_backend_pid() pid")).rows[0].pid;
      const pending = recovery.query("select private.permission_recover_owner($1) result", [recoveryRequest]);
      await waitBlocked(pid); await complete.query("commit");
      expect((await pending).rows[0].result.outcome).toBe("applied"); await recovery.query("reset role"); await recovery.query("commit");
    }
    const state = (await db.query("select permission_revision::int revision,pin_change_required,passcode_hash=extensions.crypt('765432',passcode_hash) recovery_pin from public.employees where id=$1", [E[0]])).rows[0];
    expect(state).toEqual({ revision: order === "recovery-first" ? 1 : 2, pin_change_required: true, recovery_pin: true });
  } finally {
    await complete.query("rollback").catch(() => undefined); await recovery.query("rollback").catch(() => undefined);
    await complete.end(); await recovery.end();
  }
});

test.each([
  { offset: "expiry-minus-1ms", moment: "2026-09-22T00:04:59.999Z", applied: true },
  { offset: "expiry", moment: "2026-09-22T00:05:00.000Z", applied: false },
  { offset: "expiry-plus-1ms", moment: "2026-09-22T00:05:00.001Z", applied: false },
])("TC-PIN-08 completion rechecks $offset after waiting for identity lock", async ({ moment, applied }) => {
  const originalClock = (await db.query("select pg_get_functiondef('private.write_clock()'::regprocedure) definition")).rows[0].definition;
  const barrier = await connection(); const runner = await connection();
  try {
    await db.query("create table private.owner_pin_complete_clock(moment timestamptz not null); insert into private.owner_pin_complete_clock values('2026-09-22T00:00:00Z'); create or replace function private.write_clock() returns timestamptz language sql volatile set search_path=pg_catalog as $$select moment from private.owner_pin_complete_clock$$");
    await db.query("update public.employees set pin_change_required=true where id=$1", [E[0]]);
    const restricted = await issueSession();
    await barrier.query("begin"); await barrier.query("select private.permission_store_mutex($1)", [S[0]]);
    await runner.query("begin"); await actor(runner, restricted.token);
    const pid = (await runner.query("select pg_backend_pid() pid")).rows[0].pid;
    const pending = runner.query("select public.permission_complete_required_pin_change($1) result", [{ requestId: randomUUID(), expectedRevision: 0, newPin: "927416" }]);
    await waitBlocked(pid);
    await db.query("update private.owner_pin_complete_clock set moment=$1", [moment]);
    await barrier.query("commit");
    const result = (await pending).rows[0].result;
    expect(applied ? result.outcome : result.error?.code).toBe(applied ? "applied" : "EMPLOYEE_SESSION_REQUIRED");
    await runner.query("commit");
    expect((await db.query("select pin_change_required,permission_revision::int revision from public.employees where id=$1", [E[0]])).rows[0])
      .toEqual({ pin_change_required: !applied, revision: applied ? 1 : 0 });
  } finally {
    await barrier.query("rollback").catch(() => undefined); await runner.query("rollback").catch(() => undefined);
    await barrier.end(); await runner.end(); await db.query(originalClock); await db.query("drop table if exists private.owner_pin_complete_clock");
  }
});

test("TC-PIN-08 stale expectedRevision is denied while restricted token remains valid", async () => {
  await db.query("begin");
  try {
    await db.query("update public.employees set pin_change_required=true where id=$1", [E[0]]);
    await actor(db);
    const restricted = await call("permission_start_session", [E[0], "384729"]);
    await actor(db, restricted.token);
    const deniedId = randomUUID();
    const denied = await call("permission_complete_required_pin_change", [{ requestId: deniedId, expectedRevision: 1, newPin: "927416" }]);
    expect(denied).toMatchObject({ error: { code: "EMPLOYEE_VERSION_CONFLICT" } });
    const afterDenied = (await db.query(`select pin_change_required,permission_revision::int revision,
      passcode_hash=extensions.crypt('384729',passcode_hash) old_pin,
      (select count(*)::int from private.employee_sessions where employee_id=$1 and revoked_at is null) live,
      (select count(*)::int from public.employee_admin_audit where request_id=$2) audit,
      (select count(*)::int from private.employee_admin_requests where request_id=$2) registry,
      (select count(*)::int from public.store_change_signals where store_id=$3 and topic='permission') signals
      from public.employees where id=$1`, [E[0], deniedId, S[0]])).rows[0];
    expect(afterDenied).toEqual({ pin_change_required: true, revision: 0, old_pin: true, live: 1, audit: 1, registry: 1, signals: 0 });
    await expect(call("permission_check_required_pin_session")).resolves.toMatchObject({ ok: true, data: { valid: true, employeeRevision: 0 } });
    const applied = await call("permission_complete_required_pin_change", [{ requestId: randomUUID(), expectedRevision: 0, newPin: "927416" }]);
    expect(applied).toMatchObject({ outcome: "applied", data: { employeeRevision: 1 } });
  } finally {
    await db.query("rollback");
  }
});

test.each(["public.employee_admin_audit", "public.store_change_signals", "private.employee_admin_requests"])(
  "TC-PIN-07 complete fault in %s rolls back credential, flag, revision, session and evidence",
  async table => {
    await db.query("begin");
    try {
      await db.query("update public.employees set pin_change_required=true where id=$1", [E[0]]);
      await actor(db);
      const restricted = await call("permission_start_session", [E[0], "384729"]);
      await actor(db, restricted.token);
      await db.query(`create function private.owner_pin_test_fault() returns trigger language plpgsql as $$ begin raise exception 'synthetic fault'; end $$;
        create trigger owner_pin_test_fault before insert on ${table} for each row execute function private.owner_pin_test_fault()`);
      await expect(call("permission_complete_required_pin_change", [{ requestId: randomUUID(), expectedRevision: 0, newPin: "927416" }]))
        .resolves.toMatchObject({ error: { code: "PERMISSION_UPDATE_UNAVAILABLE",
          message: "Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại." } });
      const state = (await db.query(`select pin_change_required,permission_revision::int revision,
        passcode_hash=extensions.crypt('384729',passcode_hash) pin_preserved,
        (select count(*)::int from private.employee_sessions where employee_id=$1 and revoked_at is null) live,
        (select count(*)::int from public.employee_admin_audit) audit,
        (select count(*)::int from public.store_change_signals) signal,
        (select count(*)::int from private.employee_admin_requests) registry from public.employees where id=$1`, [E[0]])).rows[0];
      expect(state).toEqual({ pin_change_required: true, revision: 0, pin_preserved: true, live: 1, audit: 0, signal: 0, registry: 0 });
      await db.query(`drop trigger owner_pin_test_fault on ${table}`);
      await db.query("drop function private.owner_pin_test_fault()");
      const retry = await call("permission_complete_required_pin_change", [{ requestId: randomUUID(), expectedRevision: 0, newPin: "927416" }]);
      expect(retry).toMatchObject({ ok: true, outcome: "applied", data: { employeeRevision: 1 } });
    } finally {
      await db.query("rollback");
    }
  },
);

test.each(["public.employee_admin_audit", "public.store_change_signals", "private.employee_admin_requests"])(
  "TC-PIN-07 recovery fault in %s rolls back forced state, credential, revision, sessions and evidence",
  async table => {
    await db.query("begin");
    try {
      await actor(db);
      const normal = await call("permission_start_session", [E[0], "384729"]);
      await db.query(`create function private.owner_recovery_test_fault() returns trigger language plpgsql as $$ begin raise exception 'synthetic fault'; end $$;
        create trigger owner_recovery_test_fault before insert on ${table} for each row execute function private.owner_recovery_test_fault()`);
      const request = { requestId: randomUUID(), storeId: S[0], targetId: E[0], operatorRef: "op-test", caseRef: "case-test-001", proofRef: "proof-test-001", newPin: "927416" };
      await db.query("set local role pos_owner_recovery");
      const result = (await db.query("select private.permission_recover_owner($1) result", [request])).rows[0].result;
      await db.query("reset role");
      expect(result).toMatchObject({ error: { code: "PERMISSION_UPDATE_UNAVAILABLE",
        message: "Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại." } });
      const state = (await db.query(`select pin_change_required,permission_revision::int revision,
        passcode_hash=extensions.crypt('384729',passcode_hash) pin_preserved,
        (select count(*)::int from private.employee_sessions where employee_id=$1 and revoked_at is null) live,
        (select count(*)::int from public.employee_admin_audit) audit,
        (select count(*)::int from public.store_change_signals) signal,
        (select count(*)::int from private.employee_admin_requests) registry from public.employees where id=$1`, [E[0]])).rows[0];
      expect(state).toEqual({ pin_change_required: false, revision: 0, pin_preserved: true, live: 1, audit: 0, signal: 0, registry: 0 });
      await actor(db, normal.token);
      await expect(call("permission_get_authority")).resolves.toMatchObject({ ok: true });
      await db.query(`drop trigger owner_recovery_test_fault on ${table}`);
      await db.query("drop function private.owner_recovery_test_fault()");
      await db.query("set local role pos_owner_recovery");
      const retry = (await db.query("select private.permission_recover_owner($1) result", [request])).rows[0].result;
      await db.query("reset role");
      expect(retry).toMatchObject({ ok: true, outcome: "applied", data: { employeeRevision: 1 } });
    } finally {
      await db.query("rollback");
    }
  },
);

test.each([
  ["public.employee_admin_audit", "insert"],
  ["public.store_change_signals", "insert"],
  ["private.initial_seed_stages", "update"],
] as const)("TC-PIN-07 employee seed fault at %s rolls back data/evidence/receipt and records retry", async (table, operation) => {
  await db.query("begin");
  try {
    await configureSeedWorkflow(S[0]);
    await actor(db);
    const normal = await call("permission_start_session", [E[0], "384729"]);
    await actor(db, normal.token);
    const begun = await call("permission_begin_initial_seed", [{ mode: "initial", expectedWorkflowRevision: 0 }]);
    expect(begun.data.runGeneration).toBe(1);
    await db.query(`create function private.owner_seed_test_fault() returns trigger language plpgsql as $$ begin raise exception 'synthetic fault'; end $$;
      create trigger owner_seed_test_fault before ${operation} on ${table} for each row execute function private.owner_seed_test_fault()`);
    await expect(call("permission_run_initial_seed_stage", [{ runGeneration: 1, stage: "employee" }]))
      .resolves.toMatchObject({ error: { code: "PERMISSION_UPDATE_UNAVAILABLE" } });
    expect((await db.query("select status,last_error_code from private.initial_seed_workflows where store_id=$1", [S[0]])).rows[0])
      .toEqual({ status: "needs_retry", last_error_code: "PERMISSION_UPDATE_UNAVAILABLE" });
    expect((await db.query("select s.status,s.receipt from private.initial_seed_stages s join private.initial_seed_workflows w using(workflow_id) where w.store_id=$1 and stage='employee'", [S[0]])).rows[0])
      .toEqual({ status: "pending", receipt: null });
    expect((await db.query("select count(*)::int count from public.employees where store_id=$1 and seed_key='demo.employee.demo-emp-cashier'", [S[0]])).rows[0].count).toBe(0);
    expect((await db.query("select (select count(*)::int from public.employee_admin_audit) audit,(select count(*)::int from public.store_change_signals) signal")).rows[0])
      .toEqual({ audit: 0, signal: 0 });
  } finally {
    await db.query("rollback");
  }
});

test.each(["menu", "floor"] as const)("TC-PIN-07 %s receipt fault preserves committed stages and edited data across retry", async stage => {
  await db.query("begin");
  try {
    await configureSeedWorkflow(S[0]);
    await actor(db);
    const normal = await call("permission_start_session", [E[0], "384729"]);
    await actor(db, normal.token);
    expect((await call("permission_begin_initial_seed", [{ mode: "initial", expectedWorkflowRevision: 0 }])).data.runGeneration).toBe(1);
    await call("permission_run_initial_seed_stage", [{ runGeneration: 1, stage: "employee" }]);
    if (stage === "floor") await call("permission_run_initial_seed_stage", [{ runGeneration: 1, stage: "menu" }]);
    const cashierId = (await db.query("select id from public.employees where store_id=$1 and seed_key='demo.employee.demo-emp-cashier'", [S[0]])).rows[0].id;
    await db.query("update public.employees set passcode_hash=extensions.crypt('246810',extensions.gen_salt('bf')) where id=$1", [cashierId]);
    if (stage === "floor") await db.query("update public.menu_items set name='Cà phê riêng',price=31000 where store_id=$1 and seed_key='demo.menu_item.mi-ca-phe-sua'", [S[0]]);
    const baseline = (await db.query(`select jsonb_build_object(
      'employees',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from public.employees e where store_id=$1),
      'menu',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) from public.menu_items m where store_id=$1),
      'tables',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.tables t where store_id=$1),
      'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.request_id),'[]'::jsonb) from public.employee_admin_audit a where store_id=$1),
      'signals',(select coalesce(jsonb_agg(to_jsonb(s) order by s.topic),'[]'::jsonb) from public.store_change_signals s where store_id=$1)
    )::text value`, [S[0]])).rows[0].value as string;
    await db.query(`create function private.owner_seed_receipt_fault() returns trigger language plpgsql as $$ begin raise exception 'synthetic fault'; end $$;
      create trigger owner_seed_receipt_fault before update on private.initial_seed_stages for each row
      when (new.stage='${stage}') execute function private.owner_seed_receipt_fault()`);
    await expect(call("permission_run_initial_seed_stage", [{ runGeneration: 1, stage }]))
      .resolves.toMatchObject({ error: { code: "PERMISSION_UPDATE_UNAVAILABLE" } });
    const after = (await db.query(`select jsonb_build_object(
      'employees',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from public.employees e where store_id=$1),
      'menu',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) from public.menu_items m where store_id=$1),
      'tables',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.tables t where store_id=$1),
      'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.request_id),'[]'::jsonb) from public.employee_admin_audit a where store_id=$1),
      'signals',(select coalesce(jsonb_agg(to_jsonb(s) order by s.topic),'[]'::jsonb) from public.store_change_signals s where store_id=$1)
    )::text value`, [S[0]])).rows[0].value as string;
    expect(after === baseline).toBe(true);
    const status = await call("permission_get_initial_seed_status");
    expect(status.data).toMatchObject({ status: "needs_retry", lastErrorCode: "PERMISSION_UPDATE_UNAVAILABLE" });
    expect(status.data.stages.find((item: { stage: string }) => item.stage === stage)).toMatchObject({ status: "pending" });
    await db.query("drop trigger owner_seed_receipt_fault on private.initial_seed_stages");
    await db.query("drop function private.owner_seed_receipt_fault()");
    const retried = await call("permission_begin_initial_seed", [{ mode: "retry", expectedWorkflowRevision: status.data.workflowRevision }]);
    expect(retried.data).toMatchObject({ acquired: true, runGeneration: 2 });
    await call("permission_run_initial_seed_stage", [{ runGeneration: 2, stage }]);
    if (stage === "menu") await call("permission_run_initial_seed_stage", [{ runGeneration: 2, stage: "floor" }]);
    expect((await db.query("select passcode_hash=extensions.crypt('246810',passcode_hash) preserved from public.employees where id=$1", [cashierId])).rows[0].preserved).toBe(true);
    if (stage === "floor") expect((await db.query("select name,price from public.menu_items where store_id=$1 and seed_key='demo.menu_item.mi-ca-phe-sua'", [S[0]])).rows[0])
      .toEqual({ name: "Cà phê riêng", price: 31000 });
  } finally { await db.query("rollback"); }
});

test("TC-PIN-17 normal owner same-PIN self change stays a no-op with its session valid", async () => {
  await db.query("begin");
  try {
    await actor(db);
    const normal = await call("permission_start_session", [E[0], "384729"]);
    await actor(db, normal.token);
    const result = await call("permission_change_own_pin", [{ requestId: randomUUID(), expectedRevision: 0, currentPin: "384729", newPin: "384729" }]);
    expect(result).toMatchObject({ outcome: "noop", data: { credentialChanged: false, pinChangeRequired: false, employeeRevision: 0 } });
    await expect(call("permission_get_authority")).resolves.toMatchObject({ ok: true });
  } finally {
    await db.query("rollback");
  }
});

test("TC-PIN-08 stage guard rechecks normal-session expiry after its final catalog-write wait", async () => {
  const originalClock = (await db.query("select pg_get_functiondef('private.write_clock()'::regprocedure) definition")).rows[0].definition;
  const blocker = await connection();
  const runner = await connection();
  try {
    await db.query("create table private.owner_pin_clock(moment timestamptz not null); insert into private.owner_pin_clock values('2026-09-22T00:00:00Z'); create or replace function private.write_clock() returns timestamptz language sql volatile set search_path=pg_catalog as $$select moment from private.owner_pin_clock$$");
    const workflowId = (await db.query("select workflow_id from private.initial_seed_workflows where store_id=$1", [S[0]])).rows[0].workflow_id;
    await db.query("update private.initial_seed_workflows set requested=true,status='in_progress',run_generation=1,workflow_revision=1 where workflow_id=$1", [workflowId]);
    for (const stage of ["employee", "menu", "floor"]) await db.query(
      "insert into private.initial_seed_stages(workflow_id,stage,stage_id) values($1,$2,private.permission_stable_uuid($3,'initial-seed.v1.'||$2))",
      [workflowId, stage, S[0]],
    );
    await db.query("begin");
    await actor(db);
    const normal = await call("permission_start_session", [E[0], "384729"]);
    await db.query("commit");
    await blocker.query("begin");
    await blocker.query("select pg_advisory_xact_lock(hashtext($1::text||':catalog-write'))", [S[0]]);
    await runner.query("begin");
    await actor(runner, normal.token);
    const pid = (await runner.query("select pg_backend_pid() pid")).rows[0].pid;
    const pending = runner.query("select public.permission_run_initial_seed_stage($1) result", [{ runGeneration: 1, stage: "employee" }]);
    await waitBlocked(pid);
    await db.query("update private.owner_pin_clock set moment='2026-09-22T12:00:00Z'");
    await blocker.query("commit");
    await expect(pending).resolves.toMatchObject({ rows: [{ result: { error: { code: "EMPLOYEE_SESSION_REQUIRED" } } }] });
    await runner.query("rollback");
    expect((await db.query("select status from private.initial_seed_stages where workflow_id=$1 and stage='employee'", [workflowId])).rows[0].status).toBe("pending");
    expect((await db.query("select status,last_error_code from private.initial_seed_workflows where workflow_id=$1", [workflowId])).rows[0])
      .toEqual({ status: "in_progress", last_error_code: null });
  } finally {
    await blocker.query("rollback").catch(() => undefined);
    await runner.query("rollback").catch(() => undefined);
    await blocker.end();
    await runner.end();
    await db.query(originalClock);
    await db.query("drop table if exists private.owner_pin_clock");
    await resetIdentityFixture();
  }
});

test("TC-PIN-15 two seed runners serialize initial claim and retry generation", async () => {
  await configureSeedWorkflow(S[0]);
  const firstSession = await issueSession(); const secondSession = await issueSession();
  const barrier = await connection(); const first = await connection(); const second = await connection();
  const race = async (mode: "initial" | "retry", expectedWorkflowRevision: number) => {
    await barrier.query("begin"); await barrier.query("select private.permission_store_mutex($1)", [S[0]]);
    await first.query("begin"); await actor(first, firstSession.token);
    await second.query("begin"); await actor(second, secondSession.token);
    const p1id = (await first.query("select pg_backend_pid() pid")).rows[0].pid;
    const p2id = (await second.query("select pg_backend_pid() pid")).rows[0].pid;
    const p1 = first.query("select public.permission_begin_initial_seed($1) result", [{ mode, expectedWorkflowRevision }])
      .then(query => ({ side: "first" as const, result: query.rows[0].result }));
    const p2 = second.query("select public.permission_begin_initial_seed($1) result", [{ mode, expectedWorkflowRevision }])
      .then(query => ({ side: "second" as const, result: query.rows[0].result }));
    await waitBlocked(p1id); await waitBlocked(p2id); await barrier.query("commit");
    const winner = await Promise.race([p1, p2]);
    await (winner.side === "first" ? first : second).query("commit");
    const loser = await (winner.side === "first" ? p2 : p1);
    await (loser.side === "first" ? first : second).query("commit");
    return [winner.result, loser.result];
  };
  try {
    const initial = await race("initial", 0);
    expect(initial.filter(result => result.data?.acquired === true)).toHaveLength(1);
    expect(initial.filter(result => result.data?.acquired === false)).toHaveLength(1);
    expect((await db.query("select workflow_revision::int revision,run_generation::int generation,status from private.initial_seed_workflows where store_id=$1", [S[0]])).rows[0])
      .toEqual({ revision: 1, generation: 1, status: "in_progress" });
    const retry = await race("retry", 1);
    expect(retry.filter(result => result.data?.acquired === true)).toHaveLength(1);
    expect(retry.filter(result => result.error?.code === "INITIAL_SEED_ATTEMPT_STALE")).toHaveLength(1);
    expect((await db.query("select workflow_revision::int revision,run_generation::int generation,status from private.initial_seed_workflows where store_id=$1", [S[0]])).rows[0])
      .toEqual({ revision: 2, generation: 2, status: "in_progress" });
  } finally {
    await barrier.query("rollback").catch(() => undefined); await first.query("rollback").catch(() => undefined); await second.query("rollback").catch(() => undefined);
    await barrier.end(); await first.end(); await second.end();
  }
});

test("TC-PIN-16 seed workflow denies nonowner and scopes a foreign owner to its own tenant", async () => {
  await configureSeedWorkflow(S[0]);
  const cashier = await issueSession(E[2], "384729", S[0]);
  await db.query("begin");
  try {
    await actor(db, cashier.token, S[0]);
    await expect(call("permission_get_initial_seed_status")).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
    await expect(call("permission_begin_initial_seed", [{ mode: "initial", expectedWorkflowRevision: 0 }]))
      .resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
    await expect(call("permission_run_initial_seed_stage", [{ runGeneration: 0, stage: "employee" }]))
      .resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  } finally {
    await db.query("rollback");
  }
  const foreignOwner = await issueSession(E[3], "384729", S[1]);
  await db.query("begin");
  try {
    await actor(db, foreignOwner.token, S[1]);
    await expect(call("permission_get_initial_seed_status")).resolves.toMatchObject({ ok: true, data: { status: "skipped", stages: [] } });
    await expect(call("permission_begin_initial_seed", [{ mode: "initial", expectedWorkflowRevision: 0 }]))
      .resolves.toMatchObject({ ok: true, data: { acquired: false, status: "skipped" } });
  } finally {
    await db.query("rollback");
  }
  expect((await db.query("select status,workflow_revision::int revision,run_generation::int generation from private.initial_seed_workflows where store_id=$1", [S[0]])).rows[0])
    .toEqual({ status: "pending", revision: 0, generation: 0 });
});

test("TC-PIN-16 owner recovery between seed stages revokes the runner and requires explicit retry after forced PIN", async () => {
  await db.query("begin");
  try {
    await configureSeedWorkflow(S[0]);
    await actor(db);
    const normal = await call("permission_start_session", [E[0], "384729"]);
    await actor(db, normal.token);
    expect((await call("permission_begin_initial_seed", [{ mode: "initial", expectedWorkflowRevision: 0 }])).data.runGeneration).toBe(1);
    await call("permission_run_initial_seed_stage", [{ runGeneration: 1, stage: "employee" }]);
    const cashierId = (await db.query("select id from public.employees where store_id=$1 and seed_key='demo.employee.demo-emp-cashier'", [S[0]])).rows[0].id;
    await db.query("update public.employees set passcode_hash=extensions.crypt('246810',extensions.gen_salt('bf')) where id=$1", [cashierId]);
    const recoveryRequest = { requestId: randomUUID(), storeId: S[0], targetId: E[0], operatorRef: "op-test", caseRef: "case-test-001", proofRef: "proof-test-001", newPin: "927416" };
    await db.query("set local role pos_owner_recovery");
    expect((await db.query("select private.permission_recover_owner($1) result", [recoveryRequest])).rows[0].result.outcome).toBe("applied");
    await db.query("reset role");
    await actor(db, normal.token);
    await expect(call("permission_run_initial_seed_stage", [{ runGeneration: 1, stage: "menu" }]))
      .resolves.toMatchObject({ error: { code: "EMPLOYEE_SESSION_REQUIRED" } });
    await actor(db);
    const restricted = await call("permission_start_session", [E[0], "927416"]);
    expect(restricted.kind).toBe("required_pin_change");
    await actor(db, restricted.token);
    await call("permission_complete_required_pin_change", [{ requestId: randomUUID(), expectedRevision: 1, newPin: "765432" }]);
    await actor(db);
    const resumed = await call("permission_start_session", [E[0], "765432"]);
    await actor(db, resumed.token);
    const status = await call("permission_get_initial_seed_status");
    expect(status.data).toMatchObject({ status: "in_progress", workflowRevision: 2, runGeneration: 1, autoEligible: false });
    await expect(call("permission_begin_initial_seed", [{ mode: "initial", expectedWorkflowRevision: 2 }]))
      .resolves.toMatchObject({ ok: true, data: { acquired: false, status: "in_progress" } });
    const retry = await call("permission_begin_initial_seed", [{ mode: "retry", expectedWorkflowRevision: 2 }]);
    expect(retry.data).toMatchObject({ acquired: true, runGeneration: 2, workflowRevision: 3 });
    await call("permission_run_initial_seed_stage", [{ runGeneration: 2, stage: "menu" }]);
    await call("permission_run_initial_seed_stage", [{ runGeneration: 2, stage: "floor" }]);
    expect((await db.query("select passcode_hash=extensions.crypt('246810',passcode_hash) preserved from public.employees where id=$1", [cashierId])).rows[0].preserved).toBe(true);
  } finally {
    await db.query("rollback");
  }
});

test("TC-PIN-05/09 all eight recovery transitions preserve credential policy and replay after real completion", async () => {
  for (const samePin of [false, true]) for (const required of [false, true]) for (const liveSessions of [0, 2]) {
    await db.query("begin");
    try {
      const currentPin = "384729";
      const recoveryPin = samePin ? currentPin : "927416";
      await db.query("update public.employees set passcode_hash=extensions.crypt($2,extensions.gen_salt('bf')),pin_change_required=$3,permission_revision=7 where id=$1", [E[0], currentPin, required]);
      for (let i = 0; i < liveSessions; i++) {
        await db.query(`insert into private.employee_sessions(token_hash,store_id,employee_id,issued_at,expires_at,purpose)
          select extensions.digest(extensions.gen_random_bytes(32),'sha256'),$1,$2,moment,moment+interval '12 hours','normal'
          from (select private.write_clock() moment) clock`, [S[0], E[0]]);
      }
      const originalHash = (await db.query("select passcode_hash from public.employees where id=$1", [E[0]])).rows[0].passcode_hash;
      const request = { requestId: randomUUID(), storeId: S[0], targetId: E[0], operatorRef: "op-test", caseRef: "case-test-001", proofRef: "proof-test-001", newPin: recoveryPin };
      await db.query("set local role pos_owner_recovery");
      const applied = (await db.query("select private.permission_recover_owner($1) result", [request])).rows[0].result;
      await db.query("reset role");
      expect(applied).toMatchObject({ outcome: "applied", data: { credentialChanged: !samePin, pinChangeRequired: true, employeeRevision: 8 } });
      const state = (await db.query(`select pin_change_required,permission_revision::int revision,
        passcode_hash=$2 hash_unchanged,passcode_hash=extensions.crypt($3,passcode_hash) pin_matches,
        (select count(*)::int from private.employee_sessions where employee_id=$1 and revoked_at is null) live,
        (select count(*)::int from public.employee_admin_audit where request_id=$4) audit,
        (select count(*)::int from private.employee_admin_requests where request_id=$4) registry,
        (select count(*)::int from public.store_change_signals where store_id=$5 and topic='permission' and event_id=$4) signal
        from public.employees where id=$1`, [E[0], originalHash, recoveryPin, request.requestId, S[0]])).rows[0];
      expect(state).toEqual({ pin_change_required: true, revision: 8, hash_unchanged: samePin, pin_matches: true, live: 0, audit: 1, registry: 1, signal: 1 });
      await actor(db);
      const restricted = await call("permission_start_session", [E[0], recoveryPin]);
      expect(restricted).toMatchObject({ ok: true, kind: "required_pin_change" });
      await actor(db, restricted.token);
      const completionId = randomUUID();
      const completed = await call("permission_complete_required_pin_change", [{ requestId: completionId, expectedRevision: 8, newPin: "765432" }]);
      expect(completed).toMatchObject({ outcome: "applied", data: { employeeRevision: 9, pinChangeRequired: false } });
      const beforeReplay = (await db.query(`select passcode_hash,pin_change_required,permission_revision::int revision,
        (select count(*)::int from private.employee_sessions where employee_id=$1) sessions,
        (select count(*)::int from public.employee_admin_audit where request_id in ($2,$3)) audit,
        (select count(*)::int from private.employee_admin_requests where request_id in ($2,$3)) registry,
        (select revision::int from public.store_change_signals where store_id=$4 and topic='permission') signal_revision
        from public.employees where id=$1`, [E[0], request.requestId, completionId, S[0]])).rows[0];
      await db.query("set local role pos_owner_recovery");
      const replayed = (await db.query("select private.permission_recover_owner($1) result", [request])).rows[0].result;
      await db.query("reset role");
      expect(replayed).toEqual({ ok: true, outcome: "replayed", data: { credentialChanged: !samePin, pinChangeRequired: true, employeeRevision: 8 } });
      const afterReplay = (await db.query(`select passcode_hash,pin_change_required,permission_revision::int revision,
        (select count(*)::int from private.employee_sessions where employee_id=$1) sessions,
        (select count(*)::int from public.employee_admin_audit where request_id in ($2,$3)) audit,
        (select count(*)::int from private.employee_admin_requests where request_id in ($2,$3)) registry,
        (select revision::int from public.store_change_signals where store_id=$4 and topic='permission') signal_revision
        from public.employees where id=$1`, [E[0], request.requestId, completionId, S[0]])).rows[0];
      const replayUnchanged = Object.keys(beforeReplay).every(key => beforeReplay[key] === afterReplay[key]);
      expect(replayUnchanged).toBe(true);
      expect({ flag: afterReplay.pin_change_required, revision: afterReplay.revision, audit: afterReplay.audit, registry: afterReplay.registry, signalRevision: afterReplay.signal_revision })
        .toEqual({ flag: false, revision: 9, audit: 2, registry: 2, signalRevision: 2 });
      await db.query("set local role pos_owner_recovery");
      const alteredPayload = (await db.query("select private.permission_recover_owner($1) result", [{ ...request, newPin: "111111" }])).rows[0].result;
      await db.query("reset role");
      expect(alteredPayload).toMatchObject({ error: { code: "ADMIN_REQUEST_REUSED" } });
      const unprivilegedReplay = (await db.query("select private.permission_recover_owner($1) result", [request])).rows[0].result;
      expect(unprivilegedReplay).toMatchObject({ error: { code: "FORBIDDEN" } });
      await db.query("set local role pos_owner_recovery");
      const foreignTenant = (await db.query("select private.permission_recover_owner($1) result", [{ ...request, storeId: S[1] }])).rows[0].result;
      await db.query("reset role");
      expect(foreignTenant).toMatchObject({ error: { code: "NOT_FOUND" } });
      const finalState = (await db.query(`select passcode_hash,pin_change_required,permission_revision::int revision,
        (select count(*)::int from private.employee_sessions where employee_id=$1) sessions,
        (select count(*)::int from public.employee_admin_audit where request_id in ($2,$3)) audit,
        (select count(*)::int from private.employee_admin_requests where request_id in ($2,$3)) registry,
        (select revision::int from public.store_change_signals where store_id=$4 and topic='permission') signal_revision
        from public.employees where id=$1`, [E[0], request.requestId, completionId, S[0]])).rows[0];
      expect(Object.keys(beforeReplay).every(key => beforeReplay[key] === finalState[key])).toBe(true);
    } finally {
      await db.query("rollback");
    }
  }
});

test("TC-PIN-05 recovery rejects refs, PIN and targets with an unchanged identity and evidence snapshot", async () => {
  await db.query("begin");
  try {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const grants = (await db.query(`select
        has_function_privilege($1,'private.permission_recover_owner(jsonb)','EXECUTE') helper,
        pg_has_role($1,'pos_owner_recovery','MEMBER') operator_member`, [role])).rows[0];
      expect(grants, role).toEqual({ helper: false, operator_member: false });
    }
    const snapshot = async () => (await db.query(`select jsonb_build_object(
      'employees',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from public.employees e),
      'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.token_hash),'[]'::jsonb) from private.employee_sessions s),
      'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.request_id),'[]'::jsonb) from public.employee_admin_audit a),
      'registry',(select coalesce(jsonb_agg(to_jsonb(r) order by r.request_id),'[]'::jsonb) from private.employee_admin_requests r),
      'signals',(select coalesce(jsonb_agg(to_jsonb(s) order by s.store_id,s.topic),'[]'::jsonb) from public.store_change_signals s)
    )::text value`)).rows[0].value as string;
    const base = { storeId: S[0], targetId: E[0], operatorRef: "op-test", caseRef: "case-test-001",
      proofRef: "proof-test-001", newPin: "927416" };
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ["operatorRef empty", { ...base, operatorRef: "" }, "OWNER_RECOVERY_REVIEW_REQUIRED"],
      ["caseRef whitespace", { ...base, caseRef: "   " }, "OWNER_RECOVERY_REVIEW_REQUIRED"],
      ["proofRef empty", { ...base, proofRef: "" }, "OWNER_RECOVERY_REVIEW_REQUIRED"],
      ["operatorRef 201", { ...base, operatorRef: "x".repeat(201) }, "OWNER_RECOVERY_REVIEW_REQUIRED"],
      ["caseRef 201", { ...base, caseRef: "x".repeat(201) }, "OWNER_RECOVERY_REVIEW_REQUIRED"],
      ["proofRef 201", { ...base, proofRef: "x".repeat(201) }, "OWNER_RECOVERY_REVIEW_REQUIRED"],
      ["missing proofRef", { ...base, proofRef: undefined }, "OWNER_RECOVERY_REVIEW_REQUIRED"],
      ["zero target UUID", { ...base, targetId: "00000000-0000-0000-0000-000000000000" }, "OWNER_RECOVERY_REVIEW_REQUIRED"],
      ["extra field", { ...base, extra: true }, "OWNER_RECOVERY_REVIEW_REQUIRED"],
      ["short PIN", { ...base, newPin: "12345" }, "INVALID_EMPLOYEE_REQUEST"],
      ["Unicode PIN", { ...base, newPin: "１２３４５６" }, "INVALID_EMPLOYEE_REQUEST"],
      ["missing target", { ...base, targetId: randomUUID() }, "NOT_FOUND"],
      ["nonowner target", { ...base, targetId: E[1] }, "OWNER_PROTECTED"],
      ["foreign store", { ...base, storeId: S[1] }, "NOT_FOUND"],
    ];
    for (const [label, payload, expectedCode] of cases) {
      const before = await snapshot();
      await db.query("set local role pos_owner_recovery");
      const result = (await db.query("select private.permission_recover_owner($1::jsonb) result", [
        { ...payload, requestId: randomUUID() },
      ])).rows[0].result;
      await db.query("reset role");
      expect(result.error?.code, label).toBe(expectedCode);
      expect(result).not.toHaveProperty("data");
      expect(await snapshot() === before, label).toBe(true);
    }
  } finally { await db.query("rollback"); }
});

test("TC-PIN-05 owner, manager, cashier and foreign owner tokens cannot assume operator recovery", async () => {
  await db.query("begin");
  try {
    const request = { requestId: randomUUID(), storeId: S[0], targetId: E[0], operatorRef: "op-test",
      caseRef: "case-test-001", proofRef: "proof-test-001", newPin: "927416" };
    for (const [label, employeeId, storeId] of [
      ["owner", E[0], S[0]], ["manager", E[1], S[0]], ["cashier", E[2], S[0]], ["foreign owner", E[3], S[1]],
    ] as const) {
      await actor(db, undefined, storeId);
      const session = await call("permission_start_session", [employeeId, "384729"]);
      expect(session.ok, label).toBe(true);
      await actor(db, session.token, storeId);
      const before = (await db.query(`select jsonb_build_object(
        'employees',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from public.employees e),
        'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.token_hash),'[]'::jsonb) from private.employee_sessions s),
        'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.request_id),'[]'::jsonb) from public.employee_admin_audit a),
        'registry',(select coalesce(jsonb_agg(to_jsonb(r) order by r.request_id),'[]'::jsonb) from private.employee_admin_requests r),
        'signals',(select coalesce(jsonb_agg(to_jsonb(s) order by s.store_id,s.topic),'[]'::jsonb) from public.store_change_signals s)
      )::text value`)).rows[0].value as string;
      const denied = (await db.query("select private.permission_recover_owner($1::jsonb) result", [request])).rows[0].result;
      expect(denied.error?.code, label).toBe("FORBIDDEN");
      const after = (await db.query(`select jsonb_build_object(
        'employees',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from public.employees e),
        'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.token_hash),'[]'::jsonb) from private.employee_sessions s),
        'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.request_id),'[]'::jsonb) from public.employee_admin_audit a),
        'registry',(select coalesce(jsonb_agg(to_jsonb(r) order by r.request_id),'[]'::jsonb) from private.employee_admin_requests r),
        'signals',(select coalesce(jsonb_agg(to_jsonb(s) order by s.store_id,s.topic),'[]'::jsonb) from public.store_change_signals s)
      )::text value`)).rows[0].value as string;
      expect(after === before, label).toBe(true);
    }
  } finally { await db.query("rollback"); }
});

test("TC-PIN-05 recovery defensively rejects an inactive owner in a rollback-only malformed fixture", async () => {
  await db.query("begin");
  try {
    // The production schema forbids an inactive owner. Relax only this transaction's
    // fixture constraints to exercise the recovery function's defensive branch.
    await db.query("alter table public.employees drop constraint employees_owner_active");
    await db.query("alter table public.employees disable trigger employees_owner_boundary");
    await db.query("update public.employees set is_active=false where id=$1", [E[0]]);
    const baseline = (await db.query(`select jsonb_build_object(
      'employee',(select to_jsonb(e) from public.employees e where id=$1),
      'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.token_hash),'[]'::jsonb) from private.employee_sessions s),
      'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.request_id),'[]'::jsonb) from public.employee_admin_audit a),
      'registry',(select coalesce(jsonb_agg(to_jsonb(r) order by r.request_id),'[]'::jsonb) from private.employee_admin_requests r),
      'signals',(select coalesce(jsonb_agg(to_jsonb(s) order by s.store_id,s.topic),'[]'::jsonb) from public.store_change_signals s)
    )::text value`, [E[0]])).rows[0].value as string;
    await db.query("set local role pos_owner_recovery");
    const result = (await db.query("select private.permission_recover_owner($1::jsonb) result", [{
      requestId: randomUUID(), storeId: S[0], targetId: E[0], operatorRef: "op-test",
      caseRef: "case-test-001", proofRef: "proof-test-001", newPin: "927416",
    }])).rows[0].result;
    await db.query("reset role");
    expect(result.error?.code).toBe("OWNER_PROTECTED");
    const after = (await db.query(`select jsonb_build_object(
      'employee',(select to_jsonb(e) from public.employees e where id=$1),
      'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.token_hash),'[]'::jsonb) from private.employee_sessions s),
      'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.request_id),'[]'::jsonb) from public.employee_admin_audit a),
      'registry',(select coalesce(jsonb_agg(to_jsonb(r) order by r.request_id),'[]'::jsonb) from private.employee_admin_requests r),
      'signals',(select coalesce(jsonb_agg(to_jsonb(s) order by s.store_id,s.topic),'[]'::jsonb) from public.store_change_signals s)
    )::text value`, [E[0]])).rows[0].value as string;
    expect(after === baseline).toBe(true);
  } finally { await db.query("rollback"); }
});

test("TC-PIN-10/13/14 bootstrap creates a forced owner and receipt-driven insert-only workflow", async () => {
  await db.query("begin");
  try {
    const sid = randomUUID();
    const ownerId = randomUUID();
    const storeNo = 1_800_000_000 + Math.floor(Math.random() * 100_000_000);
    await db.query("insert into auth.users(id,email) values($1,$2)", [sid, `store${storeNo}@store.pos.local`]);
    await actor(db, undefined, sid);
    const boot = await call("permission_bootstrap_store", [{ requestId: randomUUID(), ownerId, storeNo, displayName: " Cà phê Mây ", address: "", seedDemo: true }]);
    expect(boot).toMatchObject({ outcome: "applied", data: { storeId: sid, ownerId, storeNo, seedRequested: true } });
    const restricted = await call("permission_start_session", [ownerId, "123456"]);
    await actor(db, restricted.token, sid);
    await expect(call("permission_get_initial_seed_status")).resolves.toMatchObject({ error: { code: "PIN_CHANGE_REQUIRED" } });
    await call("permission_complete_required_pin_change", [{ requestId: randomUUID(), expectedRevision: 0, newPin: "654321" }]);
    await actor(db, undefined, sid);
    const normal = await call("permission_start_session", [ownerId, "654321"]);
    await actor(db, normal.token, sid);
    const initial = await call("permission_get_initial_seed_status");
    expect(initial.data).toMatchObject({ status: "pending", workflowRevision: 0, autoEligible: true, runGeneration: 0 });
    expect(initial.data.stages.map((stage: { stage: string }) => stage.stage)).toEqual(["employee", "menu", "floor"]);
    const begun = await call("permission_begin_initial_seed", [{ mode: "initial", expectedWorkflowRevision: 0 }]);
    expect(begun.data).toMatchObject({ acquired: true, status: "in_progress", runGeneration: 1, workflowRevision: 1 });
    await expect(call("permission_begin_initial_seed", [{ mode: "initial", expectedWorkflowRevision: 0 }]))
      .resolves.toMatchObject({ ok: true, data: { acquired: false, status: "in_progress", runGeneration: 1, workflowRevision: 1 } });
    const deterministicCashierId = (await db.query("select private.permission_seed_uuid($1,'demo.employee.demo-emp-cashier') id", [sid])).rows[0].id;
    await db.query("insert into public.employees(id,store_id,name,role,passcode_hash) values($1,$2,'Collision','cashier',extensions.crypt('111111',extensions.gen_salt('bf')))", [deterministicCashierId, sid]);
    await expect(call("permission_run_initial_seed_stage", [{ runGeneration: 1, stage: "employee" }]))
      .resolves.toMatchObject({ error: { code: "ENTITY_ID_CONFLICT" } });
    expect((await call("permission_get_initial_seed_status")).data).toMatchObject({ status: "needs_retry", workflowRevision: 2, runGeneration: 1 });
    await db.query("delete from public.employees where id=$1", [deterministicCashierId]);
    const retried = await call("permission_begin_initial_seed", [{ mode: "retry", expectedWorkflowRevision: 2 }]);
    expect(retried.data).toMatchObject({ acquired: true, status: "in_progress", runGeneration: 2, workflowRevision: 3 });
    await expect(call("permission_run_initial_seed_stage", [{ runGeneration: 1, stage: "employee" }]))
      .resolves.toMatchObject({ error: { code: "INITIAL_SEED_ATTEMPT_STALE" } });
    await call("permission_run_initial_seed_stage", [{ runGeneration: 2, stage: "employee" }]);
    const employee = await call("permission_get_initial_seed_status");
    expect(employee.data.stages[0]).toMatchObject({ stage: "employee", status: "committed" });
    const cashierId = (await db.query("select id from public.employees where store_id=$1 and seed_key='demo.employee.demo-emp-cashier'", [sid])).rows[0].id;
    await db.query("update public.employees set passcode_hash=extensions.crypt('246810',extensions.gen_salt('bf')) where id=$1", [cashierId]);
    await call("permission_run_initial_seed_stage", [{ runGeneration: 2, stage: "employee" }]);
    expect((await db.query("select passcode_hash=extensions.crypt('246810',passcode_hash) preserved from public.employees where id=$1", [cashierId])).rows[0].preserved).toBe(true);
    await call("permission_run_initial_seed_stage", [{ runGeneration: 2, stage: "menu" }]);
    const finished = await call("permission_run_initial_seed_stage", [{ runGeneration: 2, stage: "floor" }]);
    expect(finished.data).toMatchObject({ status: "completed", autoEligible: false, runGeneration: 2 });
    expect(finished.data.stages.every((stage: { status: string }) => stage.status === "committed")).toBe(true);
    await db.query("update public.menu_items set name='Cà phê riêng',price=31000,deleted_at=private.write_clock(),deleted_by_employee_id=$2 where store_id=$1 and seed_key='demo.menu_item.mi-ca-phe-sua'", [sid, ownerId]);
    await db.query("update public.tables set name='Sân 01',deleted_at=private.write_clock(),deleted_by_employee_id=$2 where store_id=$1 and seed_key='demo.table.tbl-b01'", [sid, ownerId]);
    await call("permission_run_initial_seed_stage", [{ runGeneration: 2, stage: "menu" }]);
    await call("permission_run_initial_seed_stage", [{ runGeneration: 2, stage: "floor" }]);
    expect((await db.query("select name,price,deleted_at is not null tombstoned from public.menu_items where store_id=$1 and seed_key='demo.menu_item.mi-ca-phe-sua'", [sid])).rows[0])
      .toEqual({ name: "Cà phê riêng", price: 31000, tombstoned: true });
    expect((await db.query("select name,deleted_at is not null tombstoned from public.tables where store_id=$1 and seed_key='demo.table.tbl-b01'", [sid])).rows[0])
      .toEqual({ name: "Sân 01", tombstoned: true });
  } finally {
    await db.query("rollback");
  }
});
