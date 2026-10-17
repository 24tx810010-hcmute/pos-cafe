
import type { IRealtimePort, RealtimeInvalidationInput } from "@/ports";
import type { SupabaseAnyClient } from "./repoShared";

type StoreSignal = { store_id?: unknown; topic?: unknown; revision?: unknown; event_id?: unknown };
let nextInvalidationSubscription = 0;
const replicationReady = { config: { broadcast: { replication_ready: true } } } as unknown as Parameters<SupabaseAnyClient["channel"]>[1];

const validRevision = (value: unknown) => {
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof number === "number" && Number.isSafeInteger(number) && number >= 0;
};

export class SupabaseRealtimePort implements IRealtimePort {
  constructor(private readonly client: SupabaseAnyClient) {}

  startStoreInvalidation(input: RealtimeInvalidationInput): () => void {
    const channel = this.client.channel(`store-${input.storeId}-invalidation-${++nextInvalidationSubscription}`, replicationReady);
    const filter = `store_id=eq.${input.storeId}`;
    let stopped = false;

    // Đồng bộ lại toàn bộ trạng thái phụ thuộc realtime của store.
    const resyncAll = () => {
      input.invalidateOpenOrders();
      input.invalidateFloorPlan();
      input.invalidateReport();
      input.invalidateMenu();
    };

    // Candidate publication exposes metadata only. Business writes bump a
    // store/topic revision; the client refetches through permission RPCs.
    channel.on("postgres_changes", { event: "*", schema: "public", table: "store_change_signals", filter }, (payload: { new?: StoreSignal }) => {
      const row = payload.new;
      if (stopped || row?.store_id !== input.storeId || !validRevision(row.revision)
        || typeof row.event_id !== "string") return;
      switch (row.topic) {
        case "orders":
          input.invalidateOpenOrders();
          input.invalidateFloorPlan();
          input.invalidateReport();
          break;
        case "menu": input.invalidateMenu(); break;
        case "floor": input.invalidateFloorPlan(); break;
        case "report": input.invalidateReport(); break;
        case "settings": resyncAll(); break;
      }
    });

    // SUBSCRIBED bắn cả lần đầu lẫn mỗi lần tự reconnect/resubscribe sau khi
    // socket rớt. Resync ngay tại đó để máy tự lành khi mạng chập chờn, thay vì
    // phải chờ poll 5s — giữ sync giữa các máy nhanh kể cả khi realtime gián đoạn.
    const connect = () => channel.subscribe((status: string) => {
      if (!stopped && status === "SUBSCRIBED") resyncAll();
    });
    void this.client.auth.getSession().then(async ({ data }: { data: { session?: { access_token?: string } | null } }) => {
      if (stopped) return;
      const token = data.session?.access_token;
      if (token) await this.client.realtime.setAuth(token);
      if (!stopped) connect();
    }).catch(() => { if (!stopped) connect(); });

    return () => {
      if (stopped) return;
      stopped = true;
      void this.client.removeChannel(channel);
    };
  }
}
