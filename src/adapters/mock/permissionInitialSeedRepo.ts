import type {
  InitialSeedBeginRequest,
  InitialSeedBeginResult,
  InitialSeedStage,
  InitialSeedStatus,
} from "@/domain/permissions";
import type { IInitialSeedRepo, ISeedRepo } from "@/ports";
import { AppError } from "@/core/appError";
import { permissionError } from "@/core/permissionErrors";
import { permissionRevision } from "@/core/permissionInputs";
import { clone } from "./mockState";
import { requireMockNormalPermissionActor } from "./permissionIdentityRepo";
import {
  insertMockInitialSeedEmployee,
  insertMockInitialSeedFloor,
  insertMockInitialSeedMenu,
} from "./permissionSeedHelpers";
import type { MockPermissionState } from "./permissionState";

const stageOrder: InitialSeedStage[] = ["employee", "menu", "floor"];
const ids = {
  workflow: "80000000-0000-4000-8000-000000000101",
  employee: "80000000-0000-4000-8000-000000000102",
  menu: "80000000-0000-4000-8000-000000000103",
  floor: "80000000-0000-4000-8000-000000000104",
} as const;
const workflows = new WeakMap<MockPermissionState, InitialSeedStatus>();

const stale = () => permissionError("INITIAL_SEED_ATTEMPT_STALE");
const unavailable = () => permissionError("PERMISSION_UPDATE_UNAVAILABLE");

function completedFixture(state: MockPermissionState): InitialSeedStatus {
  const committedAt = new Date(state.now()).toISOString();
  return {
    workflowId: ids.workflow,
    status: "completed",
    workflowRevision: 4,
    autoEligible: false,
    runGeneration: 1,
    lastErrorCode: null,
    stages: stageOrder.map(stage => ({ stage, stageId: ids[stage], status: "committed", committedAt })),
  };
}

function workflow(state: MockPermissionState): InitialSeedStatus {
  let value = workflows.get(state);
  if (!value) {
    value = completedFixture(state);
    workflows.set(state, value);
  }
  return value;
}

export function initializeMockInitialSeed(state: MockPermissionState, requested: boolean): InitialSeedStatus {
  const value: InitialSeedStatus = requested
    ? {
        workflowId: ids.workflow,
        status: "pending",
        workflowRevision: 0,
        autoEligible: true,
        runGeneration: 0,
        lastErrorCode: null,
        stages: stageOrder.map(stage => ({ stage, stageId: ids[stage], status: "pending", committedAt: null })),
      }
    : {
        workflowId: ids.workflow,
        status: "skipped",
        workflowRevision: 0,
        autoEligible: false,
        runGeneration: 0,
        lastErrorCode: null,
        stages: [],
      };
  workflows.set(state, value);
  return clone(value);
}

function authorize(state: MockPermissionState): void {
  const actor = requireMockNormalPermissionActor(state);
  if (actor.role !== "owner") throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
}

function strictBegin(value: InitialSeedBeginRequest): InitialSeedBeginRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== 2
    || Object.keys(value).some(key => !["mode", "expectedWorkflowRevision"].includes(key))
    || !["initial", "retry"].includes(value.mode)) throw unavailable();
  return { mode: value.mode, expectedWorkflowRevision: permissionRevision(value.expectedWorkflowRevision) };
}

function strictStage(value: { runGeneration: number; stage: InitialSeedStage }) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== 2
    || Object.keys(value).some(key => !["runGeneration", "stage"].includes(key))
    || !stageOrder.includes(value.stage)) throw unavailable();
  return { runGeneration: permissionRevision(value.runGeneration), stage: value.stage };
}

export class MockInitialSeedRepo implements IInitialSeedRepo {
  constructor(private readonly state: MockPermissionState) {
    workflow(state);
  }

  async getStatus(): Promise<InitialSeedStatus> {
    authorize(this.state);
    return clone(workflow(this.state));
  }

  async begin(request: InitialSeedBeginRequest): Promise<InitialSeedBeginResult> {
    authorize(this.state);
    const parsed = strictBegin(request);
    const current = workflow(this.state);
    if (parsed.mode === "initial" && !(current.status === "pending" && current.autoEligible)) {
      return { acquired: false, runGeneration: current.runGeneration, workflowRevision: current.workflowRevision };
    }
    if (parsed.expectedWorkflowRevision !== current.workflowRevision) throw stale();
    if (parsed.mode === "retry" && current.status !== "in_progress" && current.status !== "needs_retry") throw stale();
    current.status = "in_progress";
    current.autoEligible = false;
    current.runGeneration += 1;
    current.workflowRevision += 1;
    current.lastErrorCode = null;
    return { acquired: true, runGeneration: current.runGeneration, workflowRevision: current.workflowRevision };
  }

  async runStage(request: { runGeneration: number; stage: InitialSeedStage }): Promise<InitialSeedStatus> {
    authorize(this.state);
    const parsed = strictStage(request);
    const current = workflow(this.state);
    if (parsed.runGeneration !== current.runGeneration) throw stale();
    const index = stageOrder.indexOf(parsed.stage);
    const receipt = current.stages.find(stage => stage.stage === parsed.stage);
    if (!receipt) throw stale();
    if (receipt.status === "committed") return clone(current);
    if (current.status !== "in_progress"
      || current.stages.slice(0, index).some(stage => stage.status !== "committed")
      || current.stages.slice(index + 1).some(stage => stage.status === "committed")) throw stale();

    try {
      if (parsed.stage === "employee") insertMockInitialSeedEmployee(this.state);
      else if (parsed.stage === "menu") insertMockInitialSeedMenu(this.state);
      else insertMockInitialSeedFloor(this.state);
    } catch (error) {
      current.status = "needs_retry";
      current.workflowRevision += 1;
      current.lastErrorCode = error instanceof AppError && error.code === "ENTITY_ID_CONFLICT"
        ? "ENTITY_ID_CONFLICT"
        : "PERMISSION_UPDATE_UNAVAILABLE";
      if (error instanceof AppError && error.code === "ENTITY_ID_CONFLICT") throw error;
      throw unavailable();
    }

    receipt.status = "committed";
    receipt.committedAt = new Date(this.state.now()).toISOString();
    current.workflowRevision += 1;
    current.lastErrorCode = null;
    current.status = parsed.stage === "floor" ? "completed" : "in_progress";
    return clone(current);
  }
}

/** Legacy seed facade delegates to the same durable workflow and never replays a committed stage. */
export class MockPermissionSeedRepo implements ISeedRepo {
  constructor(private readonly initial: MockInitialSeedRepo) {}

  private async run(mode: "initial" | "retry"): Promise<void> {
    const status = await this.initial.getStatus();
    if (status.status === "completed" || status.status === "skipped"
      || (mode === "initial" && !status.autoEligible)) return;
    const claim = await this.initial.begin({ mode, expectedWorkflowRevision: status.workflowRevision });
    if (!claim.acquired) return;
    for (const stage of stageOrder) {
      const current = await this.initial.getStatus();
      if (current.stages.find(receipt => receipt.stage === stage)?.status === "committed") continue;
      await this.initial.runStage({ runGeneration: claim.runGeneration, stage });
    }
  }

  seedDemo(_storeId: string): Promise<void> { return this.run("initial"); }
  retrySeedDemo(_storeId: string): Promise<void> { return this.run("retry"); }
  async seedBlank(_storeId: string): Promise<void> { /* Bootstrap recorded a skipped workflow. */ }
}
