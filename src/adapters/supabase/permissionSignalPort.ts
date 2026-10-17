import type { PermissionCatalogSignal, PermissionSignal } from "@/domain/permissions";
import type { IPermissionSignalPort } from "@/ports/permissions";
import type { SupabaseAnyClient } from "./repoShared";

const STORE_TOPICS = new Set<PermissionSignal["topic"]>([
  "permission", "menu", "floor", "orders", "report", "settings",
]);
let nextSignalSubscription = 0;
// Realtime's join acknowledgement precedes replication readiness on a cold
// backend. Request the protocol's explicit readiness event for these channels.
const replicationReady = { config: { broadcast: { replication_ready: true } } } as unknown as Parameters<SupabaseAnyClient["channel"]>[1];

type RealtimePayload = { new?: unknown };

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const revisionNumber = (value: unknown): number | null => {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

const decodeStoreSignal = (payload: RealtimePayload, expectedStoreId: string): PermissionSignal | null => {
  const row = record(payload.new);
  const revision = row ? revisionNumber(row.revision) : null;
  if (!row || row.store_id !== expectedStoreId || typeof row.topic !== "string"
    || !STORE_TOPICS.has(row.topic as PermissionSignal["topic"])
    || revision === null || typeof row.event_id !== "string") return null;
  if (row.target_id !== null && row.target_id !== undefined && typeof row.target_id !== "string") return null;
  return {
    storeId: expectedStoreId,
    topic: row.topic as PermissionSignal["topic"],
    revision,
    eventId: row.event_id,
    ...(typeof row.target_id === "string" ? { targetId: row.target_id } : {}),
  };
};

const decodeCatalogSignal = (payload: RealtimePayload): PermissionCatalogSignal | null => {
  const row = record(payload.new);
  const revision = row ? revisionNumber(row.revision) : null;
  if (!row || revision === null || typeof row.event_id !== "string") return null;
  return { revision, eventId: row.event_id };
};

export class SupabasePermissionSignalPort implements IPermissionSignalPort {
  constructor(private readonly client: SupabaseAnyClient) {}

  subscribe(input: Parameters<IPermissionSignalPort["subscribe"]>[0]): () => void {
    let stopped = false;
    const channels: Array<ReturnType<SupabaseAnyClient["channel"]>> = [];
    // React StrictMode may tear down the first mount in the same task. Do not
    // register that transient channel with Realtime before its cleanup runs.
    const timer = setTimeout(() => {
      if (stopped) return;
      const subscription = ++nextSignalSubscription;
      const storeChannel = this.client.channel(`permission-store-${input.storeId}-${subscription}`, replicationReady);
      const catalogChannel = this.client.channel(`permission-catalog-${input.storeId}-${subscription}`, replicationReady);
      channels.push(storeChannel, catalogChannel);
      const subscribedOnce = { store: false, catalog: false };

      storeChannel.on("postgres_changes", {
        event: "*", schema: "public", table: "store_change_signals", filter: `store_id=eq.${input.storeId}`,
      }, (payload: RealtimePayload) => {
        if (stopped) return;
        const signal = decodeStoreSignal(payload, input.storeId);
        if (signal) input.onStoreSignal(signal);
      });
      catalogChannel.on("postgres_changes", {
        event: "*", schema: "public", table: "permission_catalog_signals",
      }, (payload: RealtimePayload) => {
        if (stopped) return;
        const signal = decodeCatalogSignal(payload);
        if (signal) input.onCatalogSignal(signal);
      });
      const connected = (kind: "store" | "catalog", status: string) => {
        if (stopped || status !== "SUBSCRIBED") return;
        if (subscribedOnce[kind]) input.onReconnect?.();
        subscribedOnce[kind] = true;
      };
      storeChannel.subscribe((status: string) => connected("store", status));
      catalogChannel.subscribe((status: string) => connected("catalog", status));
      // SupabaseClient synchronizes Realtime auth on SIGNED_IN/TOKEN_REFRESHED.
    }, 0);

    return () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      for (const channel of channels) void this.client.removeChannel(channel);
    };
  }
}
