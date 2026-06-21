
import type { ISeedRepo } from "@/ports";
import { markBlankSeeded, seedDemoData } from "./seedBundle";
import type { SupabaseAnyClient } from "./repoShared";

export class SupabaseSeedRepo implements ISeedRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async seedDemo(storeId: string): Promise<void> {
    await seedDemoData(this.client, storeId);
  }

  async retrySeedDemo(storeId: string): Promise<void> {
    await seedDemoData(this.client, storeId);
  }

  async seedBlank(storeId: string): Promise<void> {
    await markBlankSeeded(this.client, storeId);
  }
}
