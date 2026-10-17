
import type { IAuthRepo, ISeedRepo } from "@/ports";
import type { CreateStoreInput, CreateStoreResult, StoreSession } from "@/domain";
import { AppError } from "@/core/appError";
import { deterministicUuid } from "./deterministicId";
import { throwIfError } from "./errors";
import { formatStoreKey, generateStoreSecret, parseStoreKey, storeEmailForNo } from "./storeKey";
import type { SupabaseAnyClient } from "./repoShared";
import { SupabasePermissionIdentityRepo } from "./permissionIdentityRepo";
import { clearEmployeeCredential } from "./employeeCredential";
import { writeError } from "@/core/writeErrors";
import { permissionEmployeeName, permissionUuid } from "@/core/permissionInputs";

type CreateContext = {
  requestId: string; input: { displayName: string; address: string; seedDemo: boolean }; secret: string;
  storeNo?: number; storeId?: string; signupAttempted: boolean; result?: CreateStoreResult;
};
const createUnavailable = () => new AppError("PERMISSION_UPDATE_UNAVAILABLE", "Chưa xác nhận được việc tạo quán. Giữ trang này và thử lại để tiếp tục cùng yêu cầu.");
const createConflict = () => new AppError("BOOTSTRAP_CONFLICT", "Thông tin tạo quán không khớp yêu cầu ban đầu. Đã dừng để tránh tạo trùng quán.");

export class SupabaseAuthRepo implements IAuthRepo {
  private creation: CreateContext | null = null;
  private creating: Promise<CreateStoreResult> | null = null;
  constructor(
    private readonly client: SupabaseAnyClient,
    _seed?: ISeedRepo,
  ) {}

  private async requirePermissionContract(): Promise<void> {
    const { data, error } = await this.client.rpc("permission_get_contract");
    if (error || data?.permissionContractVersion !== 2 || data?.writeProtocolVersion !== 1) throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
  }

  async pairStore(storeKey: string): Promise<void> {
    clearEmployeeCredential(this.client);
    const parsed = parseStoreKey(storeKey);
    const { error } = await this.client.auth.signInWithPassword({
      email: storeEmailForNo(parsed.storeNo),
      password: parsed.secret,
    });
    throwIfError(error, "AUTH_REQUIRED");

    const session = await this.getStoreSession();

    if (!session || session.storeNo !== parsed.storeNo) {
      await this.client.auth.signOut();
      throw new AppError("AUTH_REQUIRED", "Store Key không đúng.");
    }
  }

  createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
    let canonical: CreateContext["input"];
    try {
      if (input.address !== undefined && typeof input.address !== "string") throw new Error();
      if (input.seedDemo !== undefined && typeof input.seedDemo !== "boolean") throw new Error();
      canonical = { displayName: permissionEmployeeName(input.displayName), address: input.address?.trim() ?? "", seedDemo: input.seedDemo ?? false };
      if ([...canonical.address].length > 500) throw new Error();
    } catch { return Promise.reject(new AppError("INVALID_WRITE_REQUEST", "Tên quán phải có 1–120 ký tự, địa chỉ tối đa 500 ký tự và lựa chọn dữ liệu mẫu phải hợp lệ.")); }
    if (this.creation && JSON.stringify(this.creation.input) !== JSON.stringify(canonical)) return Promise.reject(createConflict());
    // The instance belongs to runtime ports, outside every screen and compatibility gate.
    // Reserve the context before ANY network request; retries never generate a new identity.
    this.creation ??= { requestId: crypto.randomUUID(), input: canonical, secret: generateStoreSecret(), signupAttempted: false };
    if (this.creating) return this.creating;
    if (this.creation.result) return Promise.resolve({ ...this.creation.result });
    const context = this.creation;
    this.creating = this.runCreate(context).finally(() => { this.creating = null; });
    return this.creating;
  }

  private async runCreate(context: CreateContext): Promise<CreateStoreResult> {
    try {
      await this.requirePermissionContract();
      if (context.storeNo === undefined) {
        const { data, error } = await this.client.rpc("permission_reserve_store_no", { p_create_attempt_id: context.requestId });
        if (error || data?.ok !== true || !Number.isInteger(data.data?.storeNo)
          || data.data.storeNo < 1 || data.data.storeNo > 2147483647) throw createUnavailable();
        context.storeNo = data.data.storeNo;
      }
      const storeNo = context.storeNo!;
      const credentials = { email: storeEmailForNo(storeNo), password: context.secret };
      const confirm = (data: { user?: { id: string } | null; session?: { user: { id: string } } | null }): boolean => {
        if (!data.user?.id || data.session?.user.id !== data.user.id) return false;
        const id = permissionUuid(data.user.id);
        if (context.storeId && context.storeId !== id) throw createConflict();
        context.storeId = id; return true;
      };
      let confirmed = false;
      if (context.signupAttempted) {
        try { const response = await this.client.auth.signInWithPassword(credentials); confirmed = !response.error && confirm(response.data); }
        catch (error) { if (error instanceof AppError && error.code === "BOOTSTRAP_CONFLICT") throw error; }
      }
      if (!confirmed) {
        context.signupAttempted = true;
        try { const response = await this.client.auth.signUp(credentials); confirmed = !response.error && confirm(response.data); }
        catch (error) { if (error instanceof AppError && error.code === "BOOTSTRAP_CONFLICT") throw error; }
      }
      if (!confirmed) {
        try { const response = await this.client.auth.signInWithPassword(credentials); confirmed = !response.error && confirm(response.data); }
        catch (error) { if (error instanceof AppError && error.code === "BOOTSTRAP_CONFLICT") throw error; }
      }
      if (!confirmed || !context.storeId) throw new AppError("AUTH_REQUIRED", "Chưa xác nhận được tài khoản cửa hàng. Giữ trang này và thử lại.");
      const storeId = context.storeId;
      const ownerId = await deterministicUuid(storeId, "owner.primary");
      const requestId = await deterministicUuid(storeId, "permission.bootstrap.v1");
      const bootstrap = await new SupabasePermissionIdentityRepo(this.client).bootstrapStore({ requestId, ownerId, storeNo, ...context.input });
      if (bootstrap.storeId !== storeId || bootstrap.ownerId !== ownerId || bootstrap.storeNo !== storeNo || bootstrap.seedRequested !== context.input.seedDemo) throw createConflict();
      const result: CreateStoreResult = { storeId, storeNo, storeKey: formatStoreKey(storeNo, context.secret), adminPin: "123456",
        seedStatus: context.input.seedDemo ? "pending" : "seeded", canRetrySeed: false };
      context.result = result;
      return { ...result };
    } catch (error) {
      if (error instanceof AppError) throw new AppError(error.code, error.message);
      throw createUnavailable();
    }
  }

  acknowledgeCreatedStore(): void {
    if (this.creating || !this.creation?.result) return;
    this.creation.secret = ""; this.creation.result = undefined; this.creation = null;
  }

  async unpairStore(): Promise<void> {
    clearEmployeeCredential(this.client);
    const { error } = await this.client.auth.signOut();
    throwIfError(error, "AUTH_REQUIRED");
  }

  async getStoreSession(): Promise<StoreSession | null> {
    const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
    throwIfError(sessionError, "AUTH_REQUIRED");

    const storeId = sessionData.session?.user.id;

    if (!storeId) {
      return null;
    }

    await this.requirePermissionContract();
    const { data, error } = await this.client.rpc("permission_get_store_session");
    throwIfError(error, "AUTH_REQUIRED");
    if (!data || data.ok !== true || data.data?.storeId !== storeId || !Number.isInteger(data.data?.storeNo)) {
      return null;
    }
    return {
      storeId: data.data.storeId,
      storeNo: data.data.storeNo,
    };
  }
}
