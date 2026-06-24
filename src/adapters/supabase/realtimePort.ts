
import type { IRealtimePort, RealtimeInvalidationInput } from "@/ports";
import type { SupabaseAnyClient } from "./repoShared";

export class SupabaseRealtimePort implements IRealtimePort {
  constructor(private readonly client: SupabaseAnyClient) {}

  startStoreInvalidation(input: RealtimeInvalidationInput): () => void {
    const channel = this.client.channel(`store-${input.storeId}-invalidation`);
    const filter = `store_id=eq.${input.storeId}`;

    // Đồng bộ lại toàn bộ trạng thái phụ thuộc realtime của store.
    const resyncAll = () => {
      input.invalidateOpenOrders();
      input.invalidateFloorPlan();
      input.invalidateReport();
      input.invalidateMenu();
    };

    // order_items không được publish: submit_order_changes luôn bump
    // orders.lock_version nên một event trên `orders` đã đủ tín hiệu (tránh
    // double-refetch). orders | payments | tables -> open orders + floor +
    // report; order detail nằm dưới prefix ["orders"] nên cũng được refetch.
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

    // SUBSCRIBED bắn cả lần đầu lẫn mỗi lần tự reconnect/resubscribe sau khi
    // socket rớt. Resync ngay tại đó để máy tự lành khi mạng chập chờn, thay vì
    // phải chờ poll 5s — giữ sync giữa các máy nhanh kể cả khi realtime gián đoạn.
    // TODO(verify, Supabase): chưa kiểm chứng cross-device trực tiếp (mock realtime
    // là no-op). Mở 2 thiết bị cùng store thật + ngắt/khôi phục mạng để xác nhận
    // self-heal & độ trễ. Xem docs/implementation-log/phase-15-realtime-hardening.md.
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        resyncAll();
      }
    });

    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
