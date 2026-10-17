import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { permissionFingerprint } from "../../scripts/permission-preflight-core.mjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cleanupIdentityFixture, db, env, setupIdentityFixture, STORE_IDS } from "./permissionIdentityFixture";

let originalPublication: string[] = [];
const realtimeAuth = new WeakMap<SupabaseClient, Promise<void>>();
const replicationReady = { config: { broadcast: { replication_ready: true } } } as unknown as Parameters<SupabaseClient['channel']>[1];

export async function setupPermissionSignalsFixture(): Promise<void> {
  await setupIdentityFixture(true);
  originalPublication = (await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by tablename")).rows.map(row => row.tablename);
  await db.query(readFileSync("supabase/candidate/permission-signals.sql", "utf8"));
}

export async function cleanupPermissionSignalsFixture(): Promise<void> {
  try {
    await db.query("drop trigger if exists permission_catalog_signal on public.permission_catalog_state");
    for (const [table, trigger] of [
      ["orders", "permission_signal_orders"], ["payments", "permission_signal_payments"], ["tables", "permission_signal_tables"],
      ["categories", "permission_signal_categories"], ["menu_items", "permission_signal_menu_items"],
      ["option_groups", "permission_signal_option_groups"], ["option_values", "permission_signal_option_values"],
      ["floor_areas", "permission_signal_floor_areas"], ["floor_decor_items", "permission_signal_floor_decor"],
      ["store_settings", "permission_signal_store_settings"],
    ]) await db.query(`drop trigger if exists ${trigger} on public.${table}`);
    await db.query("drop function if exists private.emit_permission_catalog_signal(); drop function if exists private.emit_store_change_signal()");
    await db.query("drop policy if exists store_change_signals_same_store on public.store_change_signals");
    await db.query("drop table if exists public.permission_catalog_signals");
    const current = (await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'")).rows.map(row => row.tablename);
    for (const table of current) await db.query(`alter publication supabase_realtime drop table public.${table}`);
    for (const table of originalPublication) await db.query(`alter publication supabase_realtime add table public.${table}`);
  } finally {
    await cleanupIdentityFixture();
  }
}

export function realtimeClient(jwt: string): SupabaseClient {
  const client = createClient(env.api, env.anonKey, {
    accessToken: async () => jwt,
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  realtimeAuth.set(client, client.realtime.setAuth(jwt));
  return client;
}

export async function waitForSubscribed(client: SupabaseClient, storeId: string, received: unknown[]): Promise<() => Promise<void>> {
  await realtimeAuth.get(client);
  const channel = client.channel(`t10-${storeId}-${crypto.randomUUID()}`, replicationReady)
    .on("postgres_changes", { event: "*", schema: "public", table: "store_change_signals", filter: `store_id=eq.${storeId}` }, payload => received.push(payload.new))
    .on("postgres_changes", { event: "*", schema: "public", table: "permission_catalog_signals" }, payload => received.push(payload.new));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("REALTIME_SUBSCRIBE_TIMEOUT")), 10_000);
    channel.subscribe(status => {
      if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timer); reject(new Error(`REALTIME_${status}`)); }
    });
  });
  return async () => { await client.removeChannel(channel); };
}

export async function waitFor(check: () => boolean, timeout = 5_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  throw new Error("REALTIME_EVENT_TIMEOUT");
}

// JOIN acknowledgement does not prove that a freshly started tenant's WAL
// reader is delivering yet. Probe only synthetic signal metadata; the tested
// category mutation is emitted once after both clients receive one same pulse.
export async function waitForSignalDelivery(received: unknown[], peerReceived: unknown[]): Promise<void> {
  const startedAt = Date.now(), ids = new Set<string>();
  const has = (rows: unknown[], id: string) => rows.some(row => (row as { event_id?: string }).event_id === id);
  let pulses = 0;
  while (Date.now() - startedAt < 15_000) {
    const id = randomUUID(); ids.add(id); pulses++;
    await db.query(`insert into public.store_change_signals(store_id,topic,revision,event_id,target_id)
      values($1,'permission',1,$2,null) on conflict(store_id,topic) do update
      set revision=public.store_change_signals.revision+1,event_id=excluded.event_id,target_id=null`, [STORE_IDS[0], id]);
    await new Promise(resolve => setTimeout(resolve, 100));
    if ([...ids].some(value => has(received, value) && has(peerReceived, value))) {
      if (process.env.PERM_SIGNAL_READINESS_FILE) writeFileSync(process.env.PERM_SIGNAL_READINESS_FILE,
        JSON.stringify({ valid: true, sourceFingerprint: permissionFingerprint(), pulses,
          elapsedMs: Date.now() - startedAt, samePulseDeliveredToBoth: true, businessMutationRetried: false }, null, 2) + '\n',
        { mode: 0o600, flag: 'wx' });
      return;
    }
  }
  throw new Error('REALTIME_DELIVERY_NOT_READY');
}

export { db, env, STORE_IDS };
