import { beforeEach, describe, expect, it } from "vitest";
import { demoMenuCatalog } from "@/seed/demoSeedData";
import { createMockPermissionState } from "./permissionState";
import { createMockPermissionRuntime } from "./permissionRuntime";
import { mockPermissionPinMatches, mockPermissionSetPin } from "./permissionIdentityRepo";

const requestId = "85000000-0000-4000-8000-000000000001";

describe("mock durable initial seed workflow", () => {
  let state: ReturnType<typeof createMockPermissionState>;
  let runtime: ReturnType<typeof createMockPermissionRuntime>;

  beforeEach(() => {
    state = createMockPermissionState();
    state.now = () => Date.UTC(2026, 8, 22, 10, 0, 0);
    runtime = createMockPermissionRuntime(state);
  });

  async function createAndEnter(seedDemo = true) {
    await runtime.auth.createStore({ displayName: "Quán mới", address: "", seedDemo });
    const owner = state.employees[0];
    const restricted = await runtime.session.startSession(owner.id, "123456");
    if (restricted.kind !== "required_pin_change") throw new Error("new owner must be restricted");
    await runtime.session.completeRequiredPinChange({
      requestId,
      expectedRevision: restricted.employeeRevision,
      newPin: "384729",
    });
    const normal = await runtime.session.startSession(owner.id, "384729");
    if (normal.kind !== "normal") throw new Error("changed owner must receive a normal session");
    return owner;
  }

  it("keeps status reads side-effect free and blank workflows permanently skipped", async () => {
    await createAndEnter(false);
    const before = structuredClone(state.business);
    const first = await runtime.initialSeed.getStatus();
    expect(first).toMatchObject({ status: "skipped", autoEligible: false, stages: [] });
    first.workflowRevision = 99;
    expect((await runtime.initialSeed.getStatus()).workflowRevision).toBe(0);
    await runtime.seed.seedDemo(state.storeId);
    expect(state.business).toEqual(before);
  });

  it("recovers lost stage acknowledgements from receipts without resetting edited data", async () => {
    await createAndEnter(true);
    const pristine = structuredClone(state.business);
    const status = await runtime.initialSeed.getStatus();
    expect(status).toMatchObject({ status: "pending", autoEligible: true, workflowRevision: 0 });
    expect(state.business).toEqual(pristine);
    const claim = await runtime.initialSeed.begin({ mode: "initial", expectedWorkflowRevision: status.workflowRevision });
    expect(claim).toEqual({ acquired: true, runGeneration: 1, workflowRevision: 1 });

    // The first response is deliberately ignored to model a committed stage whose ACK was lost.
    await runtime.initialSeed.runStage({ runGeneration: claim.runGeneration, stage: "employee" });
    const cashier = state.employees.find(employee => employee.role === "cashier")!;
    mockPermissionSetPin(state, cashier.id, "246810");
    const afterReplay = await runtime.initialSeed.runStage({ runGeneration: claim.runGeneration, stage: "employee" });
    expect(afterReplay.stages[0]).toMatchObject({ stage: "employee", status: "committed" });
    expect(mockPermissionPinMatches(state, cashier.id, "246810")).toBe(true);
    expect(mockPermissionPinMatches(state, cashier.id, "111111")).toBe(false);
  });

  it("marks insert collisions for explicit retry, rejects stale generations, and preserves completed-stage edits", async () => {
    await createAndEnter(true);
    const pending = await runtime.initialSeed.getStatus();
    const initial = await runtime.initialSeed.begin({ mode: "initial", expectedWorkflowRevision: pending.workflowRevision });
    await runtime.initialSeed.runStage({ runGeneration: initial.runGeneration, stage: "employee" });
    const cashier = state.employees.find(employee => employee.role === "cashier")!;
    mockPermissionSetPin(state, cashier.id, "246810");

    state.business.menu.categories.push(structuredClone(demoMenuCatalog.categories[0]));
    await expect(runtime.initialSeed.runStage({ runGeneration: initial.runGeneration, stage: "menu" }))
      .rejects.toMatchObject({ code: "ENTITY_ID_CONFLICT" });
    const failed = await runtime.initialSeed.getStatus();
    expect(failed).toMatchObject({ status: "needs_retry", workflowRevision: 3, lastErrorCode: "ENTITY_ID_CONFLICT" });
    expect(state.business.menu.categories).toHaveLength(1);
    expect(state.business.menu.menuItems).toHaveLength(0);

    state.business.menu.categories = [];
    const retry = await runtime.initialSeed.begin({ mode: "retry", expectedWorkflowRevision: failed.workflowRevision });
    expect(retry).toEqual({ acquired: true, runGeneration: 2, workflowRevision: 4 });
    await expect(runtime.initialSeed.runStage({ runGeneration: initial.runGeneration, stage: "menu" }))
      .rejects.toMatchObject({ code: "INITIAL_SEED_ATTEMPT_STALE" });
    await runtime.initialSeed.runStage({ runGeneration: retry.runGeneration, stage: "employee" });
    expect(mockPermissionPinMatches(state, cashier.id, "246810")).toBe(true);

    await runtime.initialSeed.runStage({ runGeneration: retry.runGeneration, stage: "menu" });
    const coffee = state.business.menu.menuItems.find(item => item.id === demoMenuCatalog.menuItems[0].id)!;
    coffee.name = "Cà phê đã sửa";
    coffee.price = 31_000;
    await runtime.initialSeed.runStage({ runGeneration: retry.runGeneration, stage: "floor" });
    const table = state.business.floorPlan.tables[0];
    table.name = "Sân 01";

    const completed = await runtime.initialSeed.runStage({ runGeneration: retry.runGeneration, stage: "menu" });
    await runtime.initialSeed.runStage({ runGeneration: retry.runGeneration, stage: "floor" });
    expect(completed.status).toBe("completed");
    expect(coffee).toMatchObject({ name: "Cà phê đã sửa", price: 31_000 });
    expect(table.name).toBe("Sân 01");
    expect(mockPermissionPinMatches(state, cashier.id, "246810")).toBe(true);
    expect(completed.stages.every(stage => stage.status === "committed")).toBe(true);
  });

  it("allows exactly one automatic claim and never auto-resumes an interrupted workflow", async () => {
    await createAndEnter(true);
    const pending = await runtime.initialSeed.getStatus();
    const first = await runtime.initialSeed.begin({ mode: "initial", expectedWorkflowRevision: pending.workflowRevision });
    const second = await runtime.initialSeed.begin({ mode: "initial", expectedWorkflowRevision: pending.workflowRevision });
    expect(first.acquired).toBe(true);
    expect(second).toEqual({ acquired: false, runGeneration: first.runGeneration, workflowRevision: first.workflowRevision });
    const before = structuredClone(state.business);
    await runtime.seed.seedDemo(state.storeId);
    expect(state.business).toEqual(before);
    expect((await runtime.initialSeed.getStatus()).status).toBe("in_progress");
  });
});
