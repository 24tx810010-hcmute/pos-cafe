import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { observeCandidateStage } from "./permissionStageObservation";
import {
  actor,
  cleanupFinancialFixture,
  connection,
  db,
  EMPLOYEE_IDS as E,
  resetFinancialFixture,
  rpc,
  setupFinancialFixture,
  STORE_IDS as S,
} from "./permissionFinancialFixture";

const PIN = "384729";
const affectedFunctionNames = [
  "permission_changes_failure", "permission_changes_checkpoint", "permission_changes_valid_uuid_array",
  "permission_changes_valid_set", "permission_changes_text", "permission_changes_int", "permission_changes_bool",
  "permission_floor_asset", "permission_menu_valid", "permission_lock_changes", "apply_menu_changes",
  "permission_floor_valid", "apply_floor_changes", "update_store_settings", "clear_demo_data",
  "permission_seed_uuid", "permission_initial_seed_status_json", "permission_seed_employee_insert",
  "permission_seed_menu_insert", "permission_seed_floor_insert", "permission_get_initial_seed_status",
  "permission_begin_initial_seed", "permission_run_initial_seed_stage", "seed_demo_employee", "seed_demo_menu",
  "seed_demo_floor",
];
let originalFunctions: Array<{ signature: string; definition: string }> = [];
let originalAcl: Array<{ signature: string; role: string; privilege: string }> = [];
let installedSignatures: string[] = [];

const quoteRole = (value: string) => value === "PUBLIC" ? "public" : `"${value.replaceAll('"', '""')}"`;

beforeAll(async () => {
  await setupFinancialFixture();
  originalFunctions = (await db.query(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname=any($1::text[]) order by n.nspname,p.oid`, [affectedFunctionNames])).rows;
  originalAcl = (await db.query(`select p.oid::regprocedure::text signature,
    case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end role,a.privilege_type privilege
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where n.nspname in ('public','private') and p.proname=any($1::text[])
      and (a.grantee=0 or pg_get_userbyid(a.grantee) in ('anon','authenticated','service_role'))`, [affectedFunctionNames])).rows;
  await db.query(readFileSync("supabase/candidate/permission-changes.sql", "utf8"));
  await db.query(readFileSync("supabase/candidate/permission-seed.sql", "utf8"));
  installedSignatures = (await db.query(`select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname=any($1::text[]) order by (n.nspname='private'),p.oid`, [affectedFunctionNames])).rows.map(row => row.signature);
  await observeCandidateStage(db);
});

afterEach(resetFinancialFixture);
afterAll(async () => {
  try {
    const original = new Set(originalFunctions.map(row => row.signature));
    for (const signature of installedSignatures) if (!original.has(signature)) await db.query(`drop function if exists ${signature}`);
    for (const row of originalFunctions) await db.query(row.definition);
    for (const row of originalFunctions) {
      await db.query(`revoke all on function ${row.signature} from public,anon,authenticated,service_role`);
      for (const grant of originalAcl.filter(item => item.signature === row.signature))
        await db.query(`grant ${grant.privilege} on function ${row.signature} to ${quoteRole(grant.role)}`);
    }
  } finally {
    await cleanupFinancialFixture();
  }
});

async function start(employeeId: string) {
  const result = await rpc("permission_start_session", { p_employee_id: employeeId, p_pin: PIN });
  expect(result.ok).toBe(true);
  return result.token as string;
}

async function waitBlockedBy(waiterPid: number, blockerPid: number) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const blockers = (await db.query("select pg_blocking_pids($1)::int[] blockers", [waiterPid])).rows[0].blockers as number[];
    if (blockers.includes(blockerPid)) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error("TC44_EXPECTED_DATABASE_BLOCKER_NOT_OBSERVED");
}

async function expectSharedAdvisoryEdge(waiterPid: number, blockerPid: number) {
  const rows = (await db.query(`select waiter.mode waiter_mode,holder.mode holder_mode
    from pg_locks waiter join pg_locks holder
      on holder.locktype=waiter.locktype and holder.database is not distinct from waiter.database
      and holder.classid is not distinct from waiter.classid and holder.objid is not distinct from waiter.objid
      and holder.objsubid is not distinct from waiter.objsubid
    where waiter.pid=$1 and holder.pid=$2 and waiter.locktype='advisory'
      and not waiter.granted and holder.granted`, [waiterPid, blockerPid])).rows;
  expect(rows.length).toBeGreaterThan(0);
}

async function hasEmployeeRowLock(pid: number) {
  return (await db.query(`select exists(select 1 from pg_locks where pid=$1 and relation='public.employees'::regclass
    and mode in ('RowShareLock','RowExclusiveLock','ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock') and granted) locked`, [pid])).rows[0].locked as boolean;
}

async function hasSessionRowLock(pid: number) {
  return (await db.query(`select exists(select 1 from pg_locks where pid=$1 and relation='private.employee_sessions'::regclass
    and mode='RowShareLock' and granted) locked`, [pid])).rows[0].locked as boolean;
}

async function hasSharedAdvisoryLock(pid: number) {
  return (await db.query("select exists(select 1 from pg_locks where pid=$1 and locktype='advisory' and mode='ShareLock' and granted) locked", [pid])).rows[0].locked as boolean;
}

async function openOrder() {
  const rows = (await db.query(`select o.id,o.lock_version::int version,o.total::int total,i.menu_item_id,m.price::int price
    from public.orders o join public.order_items i on i.store_id=o.store_id and i.order_id=o.id
    join public.menu_items m on m.store_id=i.store_id and m.id=i.menu_item_id
    where o.store_id=$1 and o.status='open' order by o.id,i.id`, [S[0]])).rows;
  expect(new Set(rows.map(row => row.id)).size).toBe(1);
  return rows[0];
}

async function createClearTargets() {
  const initiatorId = "f1000000-0000-4000-8000-000000000001";
  const otherId = "01000000-0000-4000-8000-000000000044";
  const categoryId = "44000000-0000-4000-8000-000000000044";
  await db.query(`insert into public.employees(id,store_id,name,role,passcode_hash,is_active,seed_key,permission_revision,permission_overrides,pin_change_required)
    values($1,$3,'TC44 initiator','cashier',extensions.crypt($4,extensions.gen_salt('bf')),true,'demo.tc44.initiator',0,null,false),
          ($2,$3,'TC44 other target','cashier',extensions.crypt($4,extensions.gen_salt('bf')),true,'demo.tc44.other',0,null,false)`,
  [initiatorId, otherId, S[0], PIN]);
  await db.query("insert into public.categories(id,store_id,name,seed_key) values($1,$2,'TC44 demo category','demo.tc44.category')", [categoryId, S[0]]);
  return { initiatorId, otherId, categoryId };
}

async function prepareSeedWorkflow() {
  await db.query("delete from private.initial_seed_workflows where store_id=$1", [S[0]]);
  await db.query(`insert into private.initial_seed_workflows(workflow_id,store_id,requested,template_version,status,workflow_revision,auto_claimed_at,run_generation,created_at,updated_at)
    values(private.permission_seed_uuid($1,'tc44.workflow'),$1,true,1,'in_progress',1,private.write_clock(),1,private.write_clock(),private.write_clock())`, [S[0]]);
  await db.query(`insert into private.initial_seed_stages(workflow_id,stage,stage_id)
    select private.permission_seed_uuid($1,'tc44.workflow'),stage,private.permission_seed_uuid($1,'tc44.stage.'||stage)
    from unnest(array['employee','menu','floor']) stage`, [S[0]]);
}

async function credentialHashes() {
  return (await db.query(`select id,encode(extensions.digest(passcode_hash,'sha256'),'hex') hash
    from public.employees where store_id=$1 order by id`, [S[0]])).rows;
}

async function installAuditGate(key: bigint) {
  await db.query(`create or replace function private.permission_tc44_gate() returns trigger language plpgsql set search_path=pg_catalog as
    $$begin if new.kind in ('clear_demo_data','initial_seed_employee') then perform pg_advisory_xact_lock(${key}::bigint); end if; return new; end$$`);
  await db.query("create trigger permission_tc44_gate before insert on public.employee_admin_audit for each row execute function private.permission_tc44_gate()");
}

async function removeAuditGate() {
  await db.query("drop trigger if exists permission_tc44_gate on public.employee_admin_audit");
  await db.query("drop function if exists private.permission_tc44_gate()");
}

type BulkKind = "clear" | "seed";
type RaceOrder = "financial_first" | "bulk_first";

for (const bulkKind of ["clear", "seed"] as const) for (const raceOrder of ["financial_first", "bulk_first"] as const) {
  test(`TC-PERM-44/runtime bulk=${bulkKind}/order=${raceOrder} observes pos-write before identity locks`, async () => {
    const order = await openOrder();
    const clearRequestId = randomUUID();
    const clearTargets = bulkKind === "clear" ? await createClearTargets() : undefined;
    const initiatorId = clearTargets?.initiatorId ?? E[2];
    if (bulkKind === "seed") {
      await db.query("update public.employees set permission_overrides=$2 where id=$1", [initiatorId, { grants: ["payment.take"], denies: [] }]);
      await prepareSeedWorkflow();
    }
    const initiatorToken = await start(initiatorId);
    const payload = { schemaVersion: 1, kind: "pay_order", orderId: order.id, paymentId: randomUUID(),
      expectedVersion: order.version, method: "cash", receivedAmount: order.total };
    const operationId = randomUUID();
    expect((await rpc("register_write_operation", { p_operation_id: operationId, p_payload: payload }, initiatorToken)).operation.status).toBe("pending");
    await db.query("update public.employees set is_active=false where id=$1", [initiatorId]);
    const managerToken = await start(E[1]);
    const ownerToken = await start(E[0]);
    const credentialsBefore = await credentialHashes();
    const ownerBefore = (await db.query("select encode(extensions.digest(to_jsonb(e)::text,'sha256'),'hex') row_hash from public.employees e where id=$1", [E[0]])).rows[0].row_hash;
    const clearRowsBefore = clearTargets ? (await db.query(`select
      (select jsonb_agg(encode(extensions.digest(to_jsonb(e)::text,'sha256'),'hex') order by e.id) from public.employees e where e.id=any($1::uuid[])) employees,
      (select encode(extensions.digest(to_jsonb(c)::text,'sha256'),'hex') from public.categories c where c.id=$2) category`,
    [[clearTargets.initiatorId, clearTargets.otherId], clearTargets.categoryId])).rows[0] : undefined;

    const financial = await connection(), bulk = await connection();
    let businessBlocker: Awaited<ReturnType<typeof connection>> | undefined;
    let gate: Awaited<ReturnType<typeof connection>> | undefined;
    let gateInstalled = false;
    let financialResult: any, bulkResult: any;
    try {
      await financial.query("begin"); await actor(financial, managerToken, S[0]);
      await bulk.query("begin"); await actor(bulk, ownerToken, S[0]);
      const financialPid = Number((await financial.query("select pg_backend_pid() pid")).rows[0].pid);
      const bulkPid = Number((await bulk.query("select pg_backend_pid() pid")).rows[0].pid);
      const runFinancial = () => financial.query("select public.execute_write_operation($1,$2) result", [operationId, payload]);
      const runBulk = () => bulkKind === "clear"
        ? bulk.query("select public.clear_demo_data($1,$2) result", [clearRequestId, true])
        : bulk.query("select public.permission_run_initial_seed_stage($1) result", [{ runGeneration: 1, stage: "employee" }]);

      if (raceOrder === "financial_first") {
        businessBlocker = await connection(); await businessBlocker.query("begin");
        const blockerPid = Number((await businessBlocker.query("select pg_backend_pid() pid")).rows[0].pid);
        await businessBlocker.query("select 1 from public.orders where store_id=$1 and id=$2 for update", [S[0], order.id]);
        const financialPromise = runFinancial();
        await waitBlockedBy(financialPid, blockerPid);
        const bulkPromise = runBulk();
        await waitBlockedBy(bulkPid, financialPid);
        await expectSharedAdvisoryEdge(bulkPid, financialPid);
        expect(await hasEmployeeRowLock(bulkPid)).toBe(false);
        expect(await hasSessionRowLock(bulkPid)).toBe(false);
        expect(await hasSharedAdvisoryLock(bulkPid)).toBe(false);
        await businessBlocker.query("commit"); await businessBlocker.end(); businessBlocker = undefined;
        financialResult = (await financialPromise).rows[0].result; await financial.query("commit");
        bulkResult = (await bulkPromise).rows[0].result; await bulk.query("commit");
      } else {
        const gateKey = BigInt("202629280044");
        await installAuditGate(gateKey); gateInstalled = true;
        gate = await connection(); await gate.query("begin");
        const gatePid = Number((await gate.query("select pg_backend_pid() pid")).rows[0].pid);
        await gate.query("select pg_advisory_xact_lock($1::bigint)", [gateKey.toString()]);
        const bulkPromise = runBulk();
        await waitBlockedBy(bulkPid, gatePid);
        expect(await hasEmployeeRowLock(bulkPid)).toBe(true);
        expect(await hasSessionRowLock(bulkPid)).toBe(true);
        expect(await hasSharedAdvisoryLock(bulkPid)).toBe(true);
        const financialPromise = runFinancial();
        await waitBlockedBy(financialPid, bulkPid);
        await expectSharedAdvisoryEdge(financialPid, bulkPid);
        await gate.query("commit"); await gate.end(); gate = undefined;
        bulkResult = (await bulkPromise).rows[0].result; await bulk.query("commit");
        financialResult = (await financialPromise).rows[0].result; await financial.query("commit");
      }
    } finally {
      if (businessBlocker) { await businessBlocker.query("rollback"); await businessBlocker.end(); }
      if (gate) { await gate.query("rollback"); await gate.end(); }
      await financial.query("rollback"); await bulk.query("rollback");
      await financial.end(); await bulk.end();
      if (gateInstalled) await removeAuditGate();
    }

    expect(financialResult.operation).toMatchObject({ status: "applied", initiatedByEmployeeId: initiatorId, executedByEmployeeId: E[1] });
    const operation = (await db.query("select payload,result,status,initiated_by_employee_id,executed_by_employee_id from public.write_operations where store_id=$1 and operation_id=$2", [S[0], operationId])).rows[0];
    expect(operation).toMatchObject({ payload, result: financialResult.operation.result, status: "applied",
      initiated_by_employee_id: initiatorId, executed_by_employee_id: E[1] });
    const event = (await db.query(`select e.initiated_by,e.executed_by,(i.id is not null) initiator_exists,(x.id is not null) executor_exists
      from public.order_events e left join public.employees i on i.store_id=e.store_id and i.id=e.initiated_by
      left join public.employees x on x.store_id=e.store_id and x.id=e.executed_by
      where e.store_id=$1 and e.operation_id=$2`, [S[0], operationId])).rows[0];
    expect(event).toEqual({ initiated_by: initiatorId, executed_by: E[1], initiator_exists: true, executor_exists: true });
    expect((await db.query("select encode(extensions.digest(to_jsonb(e)::text,'sha256'),'hex') row_hash from public.employees e where id=$1", [E[0]])).rows[0].row_hash).toEqual(ownerBefore);
    expect(await credentialHashes()).toEqual(credentialsBefore.concat(bulkKind === "seed" ? (await db.query(`select id,encode(extensions.digest(passcode_hash,'sha256'),'hex') hash
      from public.employees where store_id=$1 and seed_key='demo.employee.demo-emp-cashier'`, [S[0]])).rows : []).sort((a, b) => a.id.localeCompare(b.id)));

    if (bulkKind === "clear") {
      expect(bulkResult).toMatchObject(raceOrder === "financial_first"
        ? { ok: true, outcome: "applied", data: null }
        : { ok: false, error: { code: "OPEN_ORDERS_BLOCK_CLEAR_DEMO" } });
      const expectedOutcome = raceOrder === "financial_first" ? "applied" : "denied";
      const expectedAuditCount = raceOrder === "financial_first" ? 1 : 2;
      expect((await db.query("select bool_and(outcome=$2) ok,count(*)::int n from public.employee_admin_audit where request_id=$1", [clearRequestId, expectedOutcome])).rows[0])
        .toMatchObject({ ok: true, n: expectedAuditCount });
      if (raceOrder === "bulk_first") {
        const after = (await db.query(`select
          (select jsonb_agg(encode(extensions.digest(to_jsonb(e)::text,'sha256'),'hex') order by e.id) from public.employees e where e.id=any($1::uuid[])) employees,
          (select encode(extensions.digest(to_jsonb(c)::text,'sha256'),'hex') from public.categories c where c.id=$2) category`,
        [[clearTargets!.initiatorId, clearTargets!.otherId], clearTargets!.categoryId])).rows[0];
        expect(after).toEqual(clearRowsBefore);
      } else {
        expect((await db.query("select deleted_at is not null deleted from public.categories where id=$1", [clearTargets!.categoryId])).rows[0].deleted).toBe(true);
        expect((await db.query("select bool_and(not is_active) inactive from public.employees where id=any($1::uuid[])", [[clearTargets!.initiatorId, clearTargets!.otherId]])).rows[0].inactive).toBe(true);
      }
    } else {
      expect(bulkResult).toMatchObject({ ok: true, data: { status: "in_progress", runGeneration: 1 } });
      const seeded = (await db.query("select role,is_active,seed_key,passcode_hash=extensions.crypt('111111',passcode_hash) pin_ok from public.employees where store_id=$1 and seed_key='demo.employee.demo-emp-cashier'", [S[0]])).rows[0];
      expect(seeded).toEqual({ role: "cashier", is_active: true, seed_key: "demo.employee.demo-emp-cashier", pin_ok: true });
      expect((await db.query("select count(*)::int n from public.employee_admin_audit where kind='initial_seed_employee' and outcome='applied'", [])).rows[0].n).toBe(1);
    }
  }, 30_000);
}
