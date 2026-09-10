
import type { IAuthRepo, ISeedRepo } from "@/ports";
import type { CreateStoreInput, CreateStoreResult, StoreSession } from "@/domain";
import { AppError } from "@/core/appError";
import { deterministicUuid } from "./deterministicId";
import { requireData, throwIfError } from "./errors";
import type { Row } from "./mappers";
import { formatStoreKey, generateStoreSecret, parseStoreKey, storeEmailForNo } from "./storeKey";
import type { SupabaseAnyClient } from "./repoShared";
import { SupabaseEmployeeRepo } from "./employeeRepo";
import { clearEmployeeCredential } from "./employeeCredential";
import { writeError } from "@/core/writeErrors";

const selectStoreSessionFields = "id,store_no";

export class SupabaseAuthRepo implements IAuthRepo {
  constructor(
    private readonly client: SupabaseAnyClient,
    private readonly seed: ISeedRepo,
  ) {}

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

  async createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
    const { data: nextStoreNo, error: nextStoreNoError } = await this.client.rpc("get_next_store_no");
    const storeNo = requireData<number>(nextStoreNo as number | null, nextStoreNoError);
    const secret = generateStoreSecret();
    const storeKey = formatStoreKey(storeNo, secret);
    const email = storeEmailForNo(storeNo);
    const { data: signUpData, error: signUpError } = await this.client.auth.signUp({
      email,
      password: secret,
    });
    throwIfError(signUpError, "AUTH_REQUIRED");

    const storeId = signUpData.user?.id;

    if (!storeId || !signUpData.session) {
      throw new AppError("AUTH_REQUIRED", "Supabase Auth phải tắt email confirmation cho Store Key.");
    }

    const displayName = input.displayName?.trim() || "POS Demo";
    const address = input.address?.trim() ?? "";
    const adminPin = "123456";
    const adminId = await deterministicUuid(storeId, "admin.primary");
    const { data: bootstrapData, error: bootstrapError } = await this.client.rpc("bootstrap_store", {
      p_admin_id: adminId, p_store_no: storeNo, p_display_name: displayName, p_address: address,
    });
    throwIfError(bootstrapError);
    if (bootstrapData?.ok === false) throw writeError(bootstrapData.error.code);
    const employee = new SupabaseEmployeeRepo(this.client);

    let seedStatus: CreateStoreResult["seedStatus"] = "seeded";
    let canRetrySeed = false;

    try {
      await employee.startSession(adminId, adminPin);
      if (input.seedDemo) await this.seed.seedDemo(storeId);
      else await this.seed.seedBlank(storeId);
    } catch {
      // Bootstrap succeeded: preserve the only returned Store Key even if seed failed.
      seedStatus = "failed";
      canRetrySeed = Boolean(input.seedDemo);
    } finally {
      // Memory clears before sending revoke. A lost ACK does not undo store creation
      // and the UI does not claim that the server session was revoked.
      await employee.revokeSession().catch(() => undefined);
    }

    return {
      storeId,
      storeNo,
      storeKey,
      adminPin,
      seedStatus,
      canRetrySeed,
    };
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

    const { data, error } = await this.client
      .from("stores")
      .select(selectStoreSessionFields)
      .eq("id", storeId)
      .maybeSingle();
    throwIfError(error, "AUTH_REQUIRED");

    if (!data) {
      return null;
    }

    const row = data as Row;
    return {
      storeId: String(row.id),
      storeNo: Number(row.store_no),
    };
  }
}
