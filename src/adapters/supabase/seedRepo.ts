import type { ISeedRepo, IInitialSeedRepo } from "@/ports";
import type { InitialSeedStatus, InitialSeedBeginRequest, InitialSeedBeginResult, InitialSeedStage } from "@/domain/permissions";
import { AppError } from "@/core/appError";
import { permissionRevision, permissionUuid } from "@/core/permissionInputs";
import { employeeCredential } from "./employeeCredential";
import { mapSupabaseError } from "./errors";
import type { SupabaseAnyClient } from "./repoShared";

const stale = () => new AppError("EMPLOYEE_SESSION_REQUIRED", "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.");
const unavailable = () => new AppError("PERMISSION_UPDATE_UNAVAILABLE", "Chưa hoàn tất dữ liệu mẫu. Bạn vẫn có thể vào quán hoặc chọn thử lại.");
const stages: InitialSeedStage[] = ["employee", "menu", "floor"];
const errorCodes = new Set(["ENTITY_ID_CONFLICT", "INITIAL_SEED_ATTEMPT_STALE", "PERMISSION_UPDATE_UNAVAILABLE", "EMPLOYEE_SESSION_REQUIRED", "PIN_CHANGE_REQUIRED", "FORBIDDEN"]);

/** Every write uses a durable server workflow; a new adapter cannot restart committed stages. */
export class SupabaseSeedRepo implements ISeedRepo, IInitialSeedRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  private async call(name: string, args?: Record<string, unknown>) {
    const { token, generation } = employeeCredential(this.client);
    if (!token) throw stale();
    try {
      const { data, error } = await this.client.rpc(name, args).setHeader("x-pos-employee-token", token);
      if (generation !== employeeCredential(this.client).generation) throw stale();
      if (error || data?.ok !== true) {
        const mapped = mapSupabaseError(error ?? { message: data?.error?.code }, "PERMISSION_UPDATE_UNAVAILABLE");
        throw new AppError(mapped.code, mapped.message);
      }
      return data.data;
    } catch (error) {
      if (generation !== employeeCredential(this.client).generation) throw stale();
      if (error instanceof AppError && error.code !== "PERMISSION_UPDATE_UNAVAILABLE") throw error;
      throw unavailable();
    }
  }

  private status(data: any): InitialSeedStatus {
    try {
      if (!data || !["skipped", "pending", "in_progress", "needs_retry", "completed"].includes(data.status)
        || typeof data.autoEligible !== "boolean" || !Array.isArray(data.stages)
        || (data.lastErrorCode !== null && !errorCodes.has(data.lastErrorCode))) throw new Error();
      const value: InitialSeedStatus = {
        workflowId: permissionUuid(data.workflowId), status: data.status,
        workflowRevision: permissionRevision(data.workflowRevision), runGeneration: permissionRevision(data.runGeneration),
        autoEligible: data.autoEligible, lastErrorCode: data.lastErrorCode,
        stages: data.stages.map((stage: any) => {
          if (!stages.includes(stage.stage) || !["pending", "committed"].includes(stage.status)
            || (stage.status === "pending" ? stage.committedAt !== null : typeof stage.committedAt !== "string" || !Number.isFinite(Date.parse(stage.committedAt)))) throw new Error();
          return { stage: stage.stage, stageId: permissionUuid(stage.stageId), status: stage.status, committedAt: stage.committedAt };
        }),
      };
      if (value.status === "skipped" ? value.stages.length !== 0 : value.stages.length !== 3 || new Set(value.stages.map(s => s.stage)).size !== 3) throw new Error();
      if (value.autoEligible && value.status !== "pending") throw new Error();
      if (value.status === "completed" && value.stages.some(s => s.status !== "committed")) throw new Error();
      return value;
    } catch { throw unavailable(); }
  }

  async getStatus(): Promise<InitialSeedStatus> { return this.status(await this.call("permission_get_initial_seed_status")); }
  async begin(request: InitialSeedBeginRequest): Promise<InitialSeedBeginResult> {
    if (!request || !["initial", "retry"].includes(request.mode)
      || Object.keys(request).some(k => !["mode", "expectedWorkflowRevision"].includes(k))) throw unavailable();
    const p = { mode: request.mode, expectedWorkflowRevision: permissionRevision(request.expectedWorkflowRevision) };
    const data = await this.call("permission_begin_initial_seed", { p_request: p });
    if (typeof data?.acquired !== "boolean") throw unavailable();
    return { acquired: data.acquired, runGeneration: permissionRevision(data.runGeneration), workflowRevision: permissionRevision(data.workflowRevision) };
  }
  async runStage(request: { runGeneration: number; stage: InitialSeedStage }): Promise<InitialSeedStatus> {
    if (!request || !stages.includes(request.stage) || Object.keys(request).some(k => !["runGeneration", "stage"].includes(k))) throw unavailable();
    return this.status(await this.call("permission_run_initial_seed_stage", {
      p_request: { runGeneration: permissionRevision(request.runGeneration), stage: request.stage },
    }));
  }

  private async run(mode: "initial" | "retry"): Promise<void> {
    const generation = employeeCredential(this.client).generation;
    const current = () => { if (employeeCredential(this.client).generation !== generation) throw stale(); };
    const status = await this.getStatus();
    current();
    if (status.status === "completed" || status.status === "skipped" || (mode === "initial" && !status.autoEligible)) return;
    const claim = await this.begin({ mode, expectedWorkflowRevision: status.workflowRevision });
    current();
    if (!claim.acquired) return;
    for (const stage of stages) {
      current();
      if (status.stages.find(s => s.stage === stage)?.status === "committed") continue;
      await this.runStage({ runGeneration: claim.runGeneration, stage });
    }
  }
  seedDemo(_storeId: string): Promise<void> { return this.run("initial"); }
  retrySeedDemo(_storeId: string): Promise<void> { return this.run("retry"); }
  async seedBlank(): Promise<void> { /* Bootstrap atomically records a skipped workflow. */ }
}
