import type { Client } from "pg";

type QueryClient = Pick<Client, "query">;

export type PinRacePhase = "winner" | "both";
export type PinRaceWaitInput = {
  storeId: string;
  ownerId: string;
  expectedRevision: number;
  controllerPid: number;
  phase: PinRacePhase;
  expectedWinnerPid?: number;
  deadlineMs?: number;
  pollMs?: number;
};

export type PinRaceGraph = {
  winnerPid: number;
  loserPid: number | null;
  holderCount: number;
  waiterCount: number;
  winnerBlockedByController: true;
  loserBlockedByWinner: boolean;
  ownerRelationLockSeen: true;
  ownerStateUnchanged: true;
};

export type PinRaceOwnerBarrier = {
  readonly controllerPid: number;
  release(): Promise<void>;
  rollback(): Promise<void>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (code: string): never => { throw new Error(code); };
const positivePid = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function validateIds(storeId: string, ownerId: string) {
  if (!UUID.test(storeId) || !UUID.test(ownerId)) fail("PIN_RACE_LOCK_INPUT_INVALID");
}

// The controller holds only the target owner row. It must never acquire the
// store advisory mutex: the designated REST request has to acquire that mutex
// first and then wait on this row, proving its ordering independently of timers.
export async function beginPinRaceOwnerBarrier(
  controller: QueryClient, storeId: string, ownerId: string,
): Promise<PinRaceOwnerBarrier> {
  validateIds(storeId, ownerId);
  let begun = false;
  let active = false;
  let controllerPid: number;
  try {
    await controller.query("begin");
    begun = true;
    const result = await controller.query(
      `select pg_backend_pid() pid from public.employees
       where store_id=$1::uuid and id=$2::uuid and role='owner' for update`,
      [storeId, ownerId],
    );
    if (result.rows.length !== 1 || !positivePid(result.rows[0].pid)) {
      fail("PIN_RACE_CONTROLLER_OWNER_MISMATCH");
    }
    controllerPid = result.rows[0].pid;
    active = true;
  } catch (error) {
    if (begun) {
      try { await controller.query("rollback"); }
      catch { fail("PIN_RACE_CONTROLLER_ROLLBACK_FAILED"); }
    }
    if (error instanceof Error && error.message.startsWith("PIN_RACE_")) throw error;
    fail("PIN_RACE_CONTROLLER_LOCK_FAILED");
  }
  return {
    controllerPid: controllerPid!,
    async release() {
      if (!active) return;
      try { await controller.query("commit"); active = false; }
      catch {
        try { await controller.query("rollback"); active = false; }
        catch { fail("PIN_RACE_CONTROLLER_ROLLBACK_FAILED"); }
        fail("PIN_RACE_CONTROLLER_COMMIT_FAILED");
      }
    },
    async rollback() {
      if (!active) return;
      try { await controller.query("rollback"); active = false; }
      catch { fail("PIN_RACE_CONTROLLER_ROLLBACK_FAILED"); }
    },
  };
}

// PostgreSQL represents the bigint advisory key as two unsigned OIDs with
// objsubid=1. The database OID is part of the identity. The SELECT deliberately
// excludes pg_stat_activity.query, request bodies, headers, and credentials.
const GRAPH_SQL = `
with expected_key as (
  select d.oid database,
    ((hashtextextended('store-authority:' || $1::uuid::text, 0) >> 32) & 4294967295)::oid classid,
    (hashtextextended('store-authority:' || $1::uuid::text, 0) & 4294967295)::oid objid
  from pg_database d where d.datname=current_database()
)
select
  pg_backend_pid() observer_pid,
  exists(select 1 from public.employees e
    where e.store_id=$1::uuid and e.id=$2::uuid and e.role='owner'
      and e.pin_change_required and e.permission_revision=$3::bigint) owner_state_unchanged,
  l.pid, l.granted, l.mode,
  coalesce(a.wait_event_type='Lock' and a.wait_event in ('transactionid','tuple'),false) row_wait,
  coalesce(a.wait_event_type='Lock' and a.wait_event='advisory',false) advisory_wait,
  case when l.pid is null then null else pg_blocking_pids(l.pid) end blockers,
  case when l.pid is null then false else exists (
    select 1 from pg_locks relation_lock
    where relation_lock.pid=l.pid and relation_lock.locktype='relation'
      and relation_lock.relation='public.employees'::regclass
      and relation_lock.mode='RowShareLock' and relation_lock.granted
  ) end owner_relation_lock_seen
from expected_key k
left join pg_locks l on l.locktype='advisory' and l.database=k.database
  and l.classid=k.classid and l.objid=k.objid and l.objsubid=1
left join pg_stat_activity a on a.pid=l.pid`;

export type PinRaceLockRow = {
  observer_pid: unknown;
  owner_state_unchanged: unknown;
  pid: unknown;
  granted: unknown;
  mode: unknown;
  row_wait: unknown;
  advisory_wait: unknown;
  blockers: unknown;
  owner_relation_lock_seen: unknown;
};

function parseLockRows(rows: PinRaceLockRow[]): { observerPid: number; ownerStateUnchanged: boolean; locks: Array<{
  pid: number; granted: boolean; mode: string; rowWait: boolean; advisoryWait: boolean;
  blockers: number[]; ownerRelationLockSeen: boolean;
}> } {
  if (rows.length === 0 || rows.some(row => !positivePid(row.observer_pid)
    || typeof row.owner_state_unchanged !== "boolean")) {
    fail("PIN_RACE_LOCK_SAMPLE_INVALID");
  }
  const observerPid = rows[0].observer_pid as number;
  const ownerStateUnchanged = rows[0].owner_state_unchanged as boolean;
  if (rows.some(row => row.observer_pid !== observerPid
    || row.owner_state_unchanged !== ownerStateUnchanged)) {
    fail("PIN_RACE_LOCK_SAMPLE_INVALID");
  }
  const locks = rows.filter(row => row.pid !== null).map(row => {
    if (!positivePid(row.pid) || typeof row.granted !== "boolean" || typeof row.mode !== "string"
      || typeof row.row_wait !== "boolean" || typeof row.advisory_wait !== "boolean"
      || !Array.isArray(row.blockers) || !row.blockers.every(positivePid)
      || typeof row.owner_relation_lock_seen !== "boolean") fail("PIN_RACE_LOCK_SAMPLE_INVALID");
    return { pid: row.pid as number, granted: row.granted as boolean, mode: row.mode as string,
      rowWait: row.row_wait as boolean, advisoryWait: row.advisory_wait as boolean,
      blockers: row.blockers as number[], ownerRelationLockSeen: row.owner_relation_lock_seen as boolean };
  });
  if (rows.some(row => row.pid === null) && (rows.length !== 1 || locks.length !== 0)) {
    fail("PIN_RACE_LOCK_SAMPLE_INVALID");
  }
  if (new Set(locks.map(lock => lock.pid)).size !== locks.length) fail("PIN_RACE_LOCK_SAMPLE_INVALID");
  return { observerPid, ownerStateUnchanged, locks };
}

// Pure predicate for focused negative controls. Both phases require exactly
// one holder; the second phase additionally requires a *different* backend
// waiting for this same advisory key, blocked by that holder.
export function evaluatePinRaceGraph(rows: PinRaceLockRow[], input: Pick<PinRaceWaitInput,
  "phase" | "controllerPid" | "expectedWinnerPid">): PinRaceGraph | null {
  const sample = parseLockRows(rows);
  if (sample.observerPid === input.controllerPid) fail("PIN_RACE_OBSERVER_NOT_INDEPENDENT");
  if (!sample.ownerStateUnchanged) fail("PIN_RACE_OWNER_CHANGED_BEFORE_RELEASE");
  const holders = sample.locks.filter(lock => lock.granted && lock.mode === "ExclusiveLock");
  const waiters = sample.locks.filter(lock => !lock.granted && lock.mode === "ExclusiveLock");
  if (holders.length !== 1 || waiters.length !== (input.phase === "both" ? 1 : 0)
    || sample.locks.length !== holders.length + waiters.length) return null;
  const winner = holders[0];
  if (winner.pid === input.controllerPid
    || input.expectedWinnerPid !== undefined && input.phase === "both" && winner.pid !== input.expectedWinnerPid
    || !winner.rowWait || !winner.ownerRelationLockSeen
    || winner.blockers.length !== 1 || winner.blockers[0] !== input.controllerPid) return null;
  const loser = waiters[0];
  if (input.phase === "both" && (!loser || loser.pid === winner.pid || loser.pid === input.controllerPid
    || !loser.advisoryWait || loser.blockers.length !== 1 || loser.blockers[0] !== winner.pid)) return null;
  return {
    winnerPid: winner.pid,
    loserPid: loser?.pid ?? null,
    holderCount: 1,
    waiterCount: waiters.length,
    winnerBlockedByController: true,
    loserBlockedByWinner: input.phase === "both",
    ownerRelationLockSeen: true,
    ownerStateUnchanged: true,
  };
}

export async function waitForPinRaceGraph(observer: QueryClient, input: PinRaceWaitInput): Promise<PinRaceGraph> {
  validateIds(input.storeId, input.ownerId);
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
    || !positivePid(input.controllerPid) || !["winner", "both"].includes(input.phase)
    || input.phase === "both" && !positivePid(input.expectedWinnerPid)
    || input.phase === "winner" && input.expectedWinnerPid !== undefined) fail("PIN_RACE_LOCK_INPUT_INVALID");
  const deadlineMs = input.deadlineMs ?? 20_000;
  const pollMs = input.pollMs ?? 25;
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 60_000
    || !Number.isSafeInteger(pollMs) || pollMs < 1 || pollMs > 1000) fail("PIN_RACE_LOCK_INPUT_INVALID");
  const deadline = Date.now() + deadlineMs;
  let prior: PinRaceGraph | null = null;
  while (Date.now() < deadline) {
    let rows: PinRaceLockRow[] = [];
    try { rows = (await observer.query(GRAPH_SQL, [input.storeId, input.ownerId, input.expectedRevision])).rows; }
    catch { fail("PIN_RACE_LOCK_QUERY_FAILED"); }
    const graph = evaluatePinRaceGraph(rows, input);
    if (graph && prior && graph.winnerPid === prior.winnerPid && graph.loserPid === prior.loserPid) return graph;
    prior = graph;
    await new Promise(resolve => setTimeout(resolve, Math.min(pollMs, Math.max(0, deadline - Date.now()))));
  }
  throw new Error(input.phase === "winner" ? "PIN_RACE_WINNER_WAIT_TIMEOUT" : "PIN_RACE_BOTH_WAIT_TIMEOUT");
}
