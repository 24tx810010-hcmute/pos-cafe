import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { loadTestEnvironmentFile, migrationChecksums } from "../contracts/preflight.ts";
import { parseBridgeEnvironment, PROJECT, STORE_IDS } from "../../scripts/permission-identity-runtime.mjs";

export function candidateEnvironment() {
  const file = process.env.IDEM_ENV_FILE;
  if (!file || [".env", ".env.local"].includes(basename(file))) throw new Error("EXPLICIT_ISOLATED_FIXTURE_REQUIRED");
  const loaded: NodeJS.ProcessEnv = { IDEM_ENV_FILE: file };
  loadTestEnvironmentFile(loaded);
  const parsed = parseBridgeEnvironment(loaded);
  const controlPath = process.platform === "win32" && parsed.controlPath.startsWith("/var/tmp/")
    ? `\\\\wsl.localhost\\Ubuntu-24.04${parsed.controlPath.replaceAll("/", "\\")}` : parsed.controlPath;
  return { ...parsed, controlPath, fixtureFile: file };
}

type CandidateEnvironment = ReturnType<typeof candidateEnvironment>;

export async function assertActivatedCandidate(db: import('pg').Client, env: CandidateEnvironment) {
  const control = JSON.parse(readFileSync(env.controlPath, 'utf8'));
  if (control.project !== PROJECT || control.marker !== env.marker || JSON.stringify(control.storeIds) !== JSON.stringify(STORE_IDS))
    throw new Error('FIXTURE_CONTROL_MISMATCH');
  const fixture = (await db.query(`select current_database() as database,marker,engine,store_ids,migration_checksums
    from private.idempotency_test_environment where singleton`)).rows;
  const expected = migrationChecksums(process.cwd(), 16);
  const row = fixture[0];
  if (fixture.length !== 1 || row.database !== 'postgres' || row.marker !== env.marker || row.engine !== 'supabase-identity-v1'
    || JSON.stringify(row.store_ids) !== JSON.stringify(STORE_IDS) || Object.keys(row.migration_checksums ?? {}).length !== 16
    || Object.entries(expected).some(([name, hash]) => row.migration_checksums[name] !== hash))
    throw new Error('FIXTURE_IDENTITY_MISMATCH');
  const phase = (await db.query(`select to_regclass('public.permission_catalog') as catalog,
    to_regclass('public.permission_catalog_state') as catalog_state,
    to_regclass('public.permission_catalog_signals') as catalog_signals,
    to_regclass('private.permission_contract_gate') as contract_gate`)).rows[0];
  if (!phase || Object.values(phase).some(value => !value)) throw new Error('ACTIVATED_CANDIDATE_REQUIRED');
  const gate = (await db.query('select strict,contract_version from private.permission_contract_gate where singleton')).rows;
  if (gate.length !== 1 || gate[0].strict !== true || gate[0].contract_version !== 2) throw new Error('STRICT_CONTRACT_2_REQUIRED');
  const stores = (await db.query('select id from public.stores order by id')).rows.map(value => value.id);
  const users = (await db.query('select id from auth.users order by id')).rows.map(value => value.id);
  if (JSON.stringify(stores) !== JSON.stringify(STORE_IDS) || JSON.stringify(users) !== JSON.stringify(STORE_IDS))
    throw new Error('EXACT_SYNTHETIC_STORES_AUTH_REQUIRED');
}

type StoreSession = Record<string, unknown> & { access_token: string; refresh_token: string; expires_at: number };
const minimumLifetimeSeconds = 600;
const sessions = new Map<string, { pending?: Promise<StoreSession>; session?: StoreSession }>();

// One refresh per fixture at a time, including the simultaneous TC55 clients.
// Persist rotation before returning; neither credentials nor HTTP bodies appear
// in diagnostics. A ten-minute lifetime covers the complete four-minute run.
export async function refreshStoreSession(env: CandidateEnvironment = candidateEnvironment()): Promise<StoreSession> {
  const key = `${env.fixtureFile}|${env.controlPath}|${env.api}`;
  const entry = sessions.get(key) ?? {};
  sessions.set(key, entry);
  if (entry.pending) return entry.pending;
  if (entry.session && entry.session.expires_at - Date.now() / 1_000 >= minimumLifetimeSeconds) return entry.session;
  entry.pending = (async () => {
    try {
      const control = JSON.parse(readFileSync(env.controlPath, "utf8")) as { refreshToken?: string };
      if (!control.refreshToken) throw new Error("FIXTURE_REFRESH_TOKEN_REQUIRED");
      const response = await fetch(`${env.api}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST", headers: { apikey: env.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: control.refreshToken }), signal: AbortSignal.timeout(10_000),
      });
      const value = await response.json() as Record<string, unknown>;
      if (!response.ok || typeof value.access_token !== "string" || typeof value.refresh_token !== "string"
        || typeof value.expires_at !== "number" || value.expires_at - Date.now() / 1_000 < minimumLifetimeSeconds)
        throw new Error("FIXTURE_SESSION_REFRESH_FAILED");
      const session = value as StoreSession;
      writeFileSync(env.controlPath, JSON.stringify({ ...control, refreshToken: session.refresh_token }), { mode: 0o600 });
      const bridge = readFileSync(env.fixtureFile, "utf8");
      if (!/^PERM_STORE_JWT=.*$/m.test(bridge)) throw new Error("FIXTURE_SESSION_PERSIST_FAILED");
      writeFileSync(env.fixtureFile, bridge.replace(/^PERM_STORE_JWT=.*$/m, `PERM_STORE_JWT=${session.access_token}`), { mode: 0o600 });
      entry.session = session;
      return session;
    } catch (error) {
      const code = error instanceof Error && ["FIXTURE_REFRESH_TOKEN_REQUIRED", "FIXTURE_SESSION_REFRESH_FAILED", "FIXTURE_SESSION_PERSIST_FAILED"].includes(error.message)
        ? error.message : "FIXTURE_SESSION_REFRESH_FAILED";
      throw new Error(code);
    }
  })();
  try { return await entry.pending; } finally { entry.pending = undefined; }
}

export async function installStoreSession(page: import("@playwright/test").Page) {
  const session = await refreshStoreSession();
  await page.addInitScript(({ value }) => localStorage.setItem("sb-127-auth-token", value), { value: JSON.stringify(session) });
}
