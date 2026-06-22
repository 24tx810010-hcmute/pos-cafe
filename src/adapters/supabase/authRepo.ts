
import type { IAuthRepo, ISeedRepo } from "@/ports";
import type { CreateStoreInput, CreateStoreResult, StoreSession } from "@/domain";
import { AppError } from "@/core/appError";
import { deterministicUuid } from "./deterministicId";
import { requireData, throwIfError } from "./errors";
import type { Row } from "./mappers";
import { formatStoreKey, generateStoreSecret, parseStoreKey, storeEmailForNo } from "./storeKey";
import { hashPin, insertRows, upsertRows, type SupabaseAnyClient } from "./repoShared";

const selectStoreSessionFields = "id,store_no";

export class SupabaseAuthRepo implements IAuthRepo {
  constructor(
    private readonly client: SupabaseAnyClient,
    private readonly seed: ISeedRepo,
  ) {}

  async pairStore(storeKey: string): Promise<void> {
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
    const adminPin = "123456";
    const adminId = await deterministicUuid(storeId, "admin.primary");
    const adminHash = await hashPin(this.client, adminPin);

    await insertRows(this.client, "stores", [
      {
        id: storeId,
        store_no: storeNo,
        name: displayName,
        email: null,
        seed_status: "pending",
      },
    ]);
    await insertRows(this.client, "store_settings", [
      {
        store_id: storeId,
        display_name: displayName,
        address: "",
        currency: "VND",
        timezone: "Asia/Saigon",
        bill_footer: "",
      },
    ]);
    await upsertRows(this.client, "employees", [
      {
        id: adminId,
        store_id: storeId,
        name: "Quản lý",
        role: "admin",
        passcode_hash: adminHash,
        is_active: true,
        seed_key: null,
      },
    ]);

    let seedStatus: CreateStoreResult["seedStatus"] = "seeded";
    let canRetrySeed = false;

    try {
      await this.seed.seedDemo(storeId);
    } catch {
      seedStatus = "failed";
      canRetrySeed = true;
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
