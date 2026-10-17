import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import {
  beginPinRaceOwnerBarrier, evaluatePinRaceGraph, waitForPinRaceGraph,
  type PinRaceLockRow,
} from "./permissionPinRaceLocks.ts";

const STORE = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";
const CONTROLLER = 100;
const WINNER = 101;
const LOSER = 102;
const OBSERVER = 103;

function row(pid: number | null, overrides: Partial<PinRaceLockRow> = {}): PinRaceLockRow {
  return {
    observer_pid: OBSERVER, owner_state_unchanged: true, pid, granted: true, mode: "ExclusiveLock",
    row_wait: true, advisory_wait: false, blockers: [CONTROLLER],
    owner_relation_lock_seen: true, ...overrides,
  };
}
const winner = () => row(WINNER);
const loser = () => row(LOSER, {
  granted: false, row_wait: false, advisory_wait: true,
  blockers: [WINNER], owner_relation_lock_seen: false,
});

describe("PIN race lock predicate", () => {
  it("accepts the exact controller -> winner -> loser wait chain", () => {
    expect(evaluatePinRaceGraph([winner()], { phase: "winner", controllerPid: CONTROLLER }))
      .toMatchObject({ winnerPid: WINNER, loserPid: null, holderCount: 1, waiterCount: 0 });
    expect(evaluatePinRaceGraph([winner(), loser()], {
      phase: "both", controllerPid: CONTROLLER, expectedWinnerPid: WINNER,
    })).toMatchObject({ winnerPid: WINNER, loserPid: LOSER, holderCount: 1,
      waiterCount: 1, winnerBlockedByController: true, loserBlockedByWinner: true });
  });

  it("rejects weaker evidence, including a late loser or a swapped holder", () => {
    const both = { phase: "both" as const, controllerPid: CONTROLLER, expectedWinnerPid: WINNER };
    expect(evaluatePinRaceGraph([winner()], both)).toBeNull();
    expect(evaluatePinRaceGraph([winner(), loser()], {
      ...both, expectedWinnerPid: LOSER,
    })).toBeNull();
    expect(evaluatePinRaceGraph([winner(), loser(), row(103, { granted: false })], both)).toBeNull();
    expect(evaluatePinRaceGraph([winner(), loser(), row(104)], both)).toBeNull();
    expect(evaluatePinRaceGraph([winner(), loser()], { phase: "winner", controllerPid: CONTROLLER })).toBeNull();
    expect(evaluatePinRaceGraph([winner(), loser()], { ...both, controllerPid: 999 })).toBeNull();
    expect(evaluatePinRaceGraph([winner(), loser()], { ...both, expectedWinnerPid: WINNER + 1 })).toBeNull();
    expect(evaluatePinRaceGraph([winner(), loser()], both)).not.toBeNull();
  });

  it("requires the row and advisory wait edges, exact blocker identity, and unchanged owner", () => {
    const both = { phase: "both" as const, controllerPid: CONTROLLER, expectedWinnerPid: WINNER };
    expect(evaluatePinRaceGraph([winner(), loser()], both)).not.toBeNull();
    expect(evaluatePinRaceGraph([row(WINNER, { row_wait: false }), loser()], both)).toBeNull();
    expect(evaluatePinRaceGraph([row(WINNER, { owner_relation_lock_seen: false }), loser()], both)).toBeNull();
    expect(evaluatePinRaceGraph([row(WINNER, { blockers: [CONTROLLER, 999] }), loser()], both)).toBeNull();
    expect(evaluatePinRaceGraph([winner(), row(LOSER, { granted: false, advisory_wait: false, blockers: [WINNER] })], both)).toBeNull();
    expect(evaluatePinRaceGraph([winner(), row(LOSER, { granted: false, advisory_wait: true, blockers: [999] })], both)).toBeNull();
    expect(() => evaluatePinRaceGraph([row(WINNER, { owner_state_unchanged: false })], {
      phase: "winner", controllerPid: CONTROLLER,
    })).toThrowError("PIN_RACE_OWNER_CHANGED_BEFORE_RELEASE");
    expect(() => evaluatePinRaceGraph([row(WINNER, { observer_pid: CONTROLLER })], {
      phase: "winner", controllerPid: CONTROLLER,
    })).toThrowError("PIN_RACE_OBSERVER_NOT_INDEPENDENT");
  });

  it("rejects malformed lock data with finite errors", () => {
    const input = { phase: "winner" as const, controllerPid: CONTROLLER };
    expect(() => evaluatePinRaceGraph([], input)).toThrowError("PIN_RACE_LOCK_SAMPLE_INVALID");
    expect(() => evaluatePinRaceGraph([row(WINNER, { blockers: ["secret"] })], input))
      .toThrowError("PIN_RACE_LOCK_SAMPLE_INVALID");
    expect(() => evaluatePinRaceGraph([winner(), winner()], input))
      .toThrowError("PIN_RACE_LOCK_SAMPLE_INVALID");
  });
});

describe("PIN race lock orchestration", () => {
  it("requires two stable samples and never queries activity text", async () => {
    const samples = [[row(null)], [winner()], [winner()]];
    const sql: string[] = [];
    const observer = { query: async (statement: string) => {
      sql.push(statement);
      return { rows: samples.shift() ?? [winner()] };
    } } as unknown as Client;
    const graph = await waitForPinRaceGraph(observer, {
      storeId: STORE, ownerId: OWNER, expectedRevision: 0, controllerPid: CONTROLLER,
      phase: "winner", deadlineMs: 300, pollMs: 1,
    });
    expect(graph.winnerPid).toBe(WINNER);
    expect(sql).toHaveLength(3);
    expect(sql.every(statement => !/a\.query|pg_stat_activity\.query|request.body|token_hash|passcode_hash/i.test(statement)))
      .toBe(true);
    expect(sql[0]).toContain("l.classid=k.classid and l.objid=k.objid and l.objsubid=1");
    expect(sql[0]).toContain("l.database=k.database");
  });

  it("times out when the second request never enters the database", async () => {
    const observer = { query: async () => ({ rows: [winner()] }) } as unknown as Client;
    await expect(waitForPinRaceGraph(observer, {
      storeId: STORE, ownerId: OWNER, expectedRevision: 0, controllerPid: CONTROLLER,
      phase: "both", expectedWinnerPid: WINNER, deadlineMs: 4, pollMs: 1,
    })).rejects.toThrowError("PIN_RACE_BOTH_WAIT_TIMEOUT");
  });

  it("redacts observer and controller driver failures", async () => {
    const observer = { query: async () => { throw new Error("secret SQL/credential diagnostic"); } } as unknown as Client;
    await expect(waitForPinRaceGraph(observer, {
      storeId: STORE, ownerId: OWNER, expectedRevision: 0, controllerPid: CONTROLLER,
      phase: "winner", deadlineMs: 100, pollMs: 1,
    })).rejects.toThrowError("PIN_RACE_LOCK_QUERY_FAILED");
    const controller = { query: async () => { throw new Error("secret SQL/credential diagnostic"); } } as unknown as Client;
    await expect(beginPinRaceOwnerBarrier(controller, STORE, OWNER))
      .rejects.toThrowError("PIN_RACE_CONTROLLER_LOCK_FAILED");
  });

  it("rolls back a failed owner lock and a failed release", async () => {
    const statements: string[] = [];
    const absent = { query: async (statement: string) => {
      statements.push(statement);
      return { rows: [] };
    } } as unknown as Client;
    await expect(beginPinRaceOwnerBarrier(absent, STORE, OWNER))
      .rejects.toThrowError("PIN_RACE_CONTROLLER_OWNER_MISMATCH");
    expect(statements).toEqual(["begin", expect.stringContaining("for update"), "rollback"]);

    const releaseStatements: string[] = [];
    const failedCommit = { query: async (statement: string) => {
      releaseStatements.push(statement);
      if (statement === "commit") throw new Error("sensitive driver error");
      return { rows: [{ pid: CONTROLLER }] };
    } } as unknown as Client;
    const barrier = await beginPinRaceOwnerBarrier(failedCommit, STORE, OWNER);
    await expect(barrier.release()).rejects.toThrowError("PIN_RACE_CONTROLLER_COMMIT_FAILED");
    expect(releaseStatements[releaseStatements.length - 2]).toBe("commit");
    expect(releaseStatements[releaseStatements.length - 1]).toBe("rollback");
    await barrier.rollback();
    expect(releaseStatements[releaseStatements.length - 1]).toBe("rollback");
  });
});
