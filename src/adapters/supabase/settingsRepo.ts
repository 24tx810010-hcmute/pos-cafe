
import type { ISettingsRepo } from "@/ports";
import type { StoreSettings, StoreSettingsUpdate } from "@/domain";
import { requireData, throwIfError } from "./errors";
import { mapSettings, type Row } from "./mappers";
import { requireStoreId, stripUndefined, type SupabaseAnyClient } from "./repoShared";

export class SupabaseSettingsRepo implements ISettingsRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async getSettings(): Promise<StoreSettings> {
    const storeId = await requireStoreId(this.client);
    const { data, error } = await this.client
      .from("store_settings")
      .select("store_id,display_name,address,currency,timezone,bill_footer")
      .eq("store_id", storeId)
      .single();
    return mapSettings(requireData<Row>(data as Row | null, error, "NOT_FOUND"));
  }

  async updateSettings(input: StoreSettingsUpdate): Promise<StoreSettings> {
    const storeId = await requireStoreId(this.client);
    const { data, error } = await this.client
      .from("store_settings")
      .update(
        stripUndefined({
          display_name: input.displayName,
          address: input.address,
          bill_footer: input.billFooter,
          timezone: input.timezone,
        }),
      )
      .eq("store_id", storeId)
      .select("store_id,display_name,address,currency,timezone,bill_footer")
      .single();
    return mapSettings(requireData<Row>(data as Row | null, error, "NOT_FOUND"));
  }

  async clearDemoData(employeeId: string): Promise<void> {
    const { error } = await this.client.rpc("clear_demo_data", { p_employee_id: employeeId });
    throwIfError(error);
  }
}
