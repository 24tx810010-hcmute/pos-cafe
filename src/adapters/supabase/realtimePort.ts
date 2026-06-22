
import type { IRealtimePort, RealtimeInvalidationInput } from "@/ports";
import type { SupabaseAnyClient } from "./repoShared";

export class SupabaseRealtimePort implements IRealtimePort {
  constructor(private readonly client: SupabaseAnyClient) {}

  startStoreInvalidation(input: RealtimeInvalidationInput): () => void {
    const channel = this.client.channel(`store-${input.storeId}-invalidation`);
    const filter = `store_id=eq.${input.storeId}`;

    for (const table of ["orders", "payments", "tables"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, () => {
        input.invalidateOpenOrders();
        input.invalidateFloorPlan();
        input.invalidateReport();
      });
    }

    for (const table of ["categories", "menu_items", "option_groups", "option_values"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, () => {
        input.invalidateMenu();
      });
    }

    for (const table of ["floor_areas", "floor_decor_items"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, () => {
        input.invalidateFloorPlan();
      });
    }

    channel.subscribe();

    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
