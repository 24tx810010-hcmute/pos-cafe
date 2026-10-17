import { describe, expect, it, vi } from "vitest";
import { SupabaseSeedRepo } from "./seedRepo";
import { employeeCredential } from "./employeeCredential";
import type { InitialSeedStage, InitialSeedStatus } from "@/domain/permissions";
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  const state: InitialSeedStatus = { workflowId: id(1), status: "pending", workflowRevision: 0, runGeneration: 0,
    autoEligible: true, lastErrorCode: null, stages: (["employee", "menu", "floor"] as InitialSeedStage[]).map((stage, i) => ({
      stage, stageId: id(i + 2), status: "pending", committedAt: null,
    })) };
  const mutations: string[] = [];
  let failStage: InitialSeedStage | null = null;
  const rpc = vi.fn((name: string, args?: any) => ({ setHeader: vi.fn(async (_header: string, token: string) => {
    expect(token).toBe("candidate-token");
    if (name === "permission_get_initial_seed_status") return { data: { ok: true, data: structuredClone(state) }, error: null };
    if (name === "permission_begin_initial_seed") {
      mutations.push(args.p_request.mode);
      state.autoEligible = false; state.status = "in_progress"; state.workflowRevision++; state.runGeneration++;
      return { data: { ok: true, data: { acquired: true, runGeneration: state.runGeneration, workflowRevision: state.workflowRevision } }, error: null };
    }
    if (name === "permission_run_initial_seed_stage") {
      const stage = args.p_request.stage as InitialSeedStage; mutations.push(stage);
      if (failStage === stage) {
        state.status = "needs_retry"; state.lastErrorCode = "ENTITY_ID_CONFLICT";
        return { data: { ok: false, error: { code: "ENTITY_ID_CONFLICT" } }, error: null };
      }
      const receipt = state.stages.find(s => s.stage === stage)!;
      receipt.status = "committed"; receipt.committedAt = "2026-09-22T00:00:00.000Z"; state.workflowRevision++;
      if (state.stages.every(s => s.status === "committed")) state.status = "completed";
      return { data: { ok: true, data: structuredClone(state) }, error: null };
    }
    throw new Error("Legacy seed RPC must remain closed");
  }) }));
  const client = { rpc } as never; employeeCredential(client).token = "candidate-token";
  return { state, client, rpc, mutations, fail: (stage: InitialSeedStage | null) => { failStage = stage; }, repo: new SupabaseSeedRepo(client) };
}

describe("durable initial seed adapter", () => {
  it("reads status without any mutation and runs only after the initial claim", async () => {
    const f = fixture(); await f.repo.getStatus(); expect(f.mutations).toEqual([]);
    await f.repo.seedDemo(id(10)); expect(f.mutations).toEqual(["initial", "employee", "menu", "floor"]);
    await f.repo.seedDemo(id(10)); expect(f.mutations).toHaveLength(4);
  });
  it("a new adapter does not automatically resume a interrupted workflow; explicit retry skips committed employee", async () => {
    const f = fixture(); f.fail("menu");
    await expect(f.repo.seedDemo(id(10))).rejects.toMatchObject({ code: "ENTITY_ID_CONFLICT" });
    expect(f.mutations).toEqual(["initial", "employee", "menu"]);
    const resumed = new SupabaseSeedRepo(f.client); await resumed.seedDemo(id(10));
    expect(f.mutations).toHaveLength(3);
    f.fail(null); await resumed.retrySeedDemo(id(10));
    expect(f.mutations).toEqual(["initial", "employee", "menu", "retry", "menu", "floor"]);
  });
  it("does not begin or write for a skipped blank workflow", async () => {
    const f = fixture(); f.state.status = "skipped"; f.state.autoEligible = false; f.state.stages = [];
    await f.repo.seedDemo(id(10)); await f.repo.retrySeedDemo(id(10)); expect(f.mutations).toEqual([]);
  });
  it("discards status from an old session before attempting a claim", async () => {
    const f = fixture(); let release!: (value: unknown) => void;
    f.rpc.mockImplementationOnce(() => ({ setHeader: () => new Promise(resolve => { release = resolve; }) }) as never);
    const operation = f.repo.seedDemo(id(10)); employeeCredential(f.client).generation++;
    release({ data: { ok: true, data: f.state }, error: null });
    await expect(operation).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" }); expect(f.mutations).toEqual([]);
  });
  it("keeps sanitized whitelist state and rejects unexpected server progress", async () => {
    const f = fixture(); f.state.lastErrorCode = "raw database secret";
    const error = await f.repo.getStatus().catch(value => value);
    expect(error).toMatchObject({ code: "PERMISSION_UPDATE_UNAVAILABLE", cause: undefined });
    expect(error.message).not.toContain("secret");
  });
});
