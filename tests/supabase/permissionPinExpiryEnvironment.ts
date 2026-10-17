import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { Client } from "pg";
import { migrationChecksums } from "../contracts/observerPreflight.ts";
import { assertPinExpiryProductionClock } from "./permissionPinExpiryClock.ts";
// @ts-expect-error The existing activation bundle is JavaScript without a declaration file.
import { ACTIVATION_SQL_ORDER } from "../../scripts/permission-activation-bundle.mjs";

const PROJECT = "pos-cafe-perm-g2c-20261009";
const ROOT = `/var/tmp/${PROJECT}`;
const CLI = "/var/tmp/pos-cafe-perm-s31-t04-20261013/bin/supabase";
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const fail = (code: string): never => { throw new Error(code); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function command(args: string[]): string {
  try {
    return execFileSync(process.platform === "win32" ? "wsl" : args[0],
      process.platform === "win32" ? ["--", ...args] : args.slice(1),
      { encoding: "utf8", timeout: 30_000, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch { return fail("PIN_EXPIRY_RUNTIME_COMMAND_FAILED"); }
}

export function pinExpiryEnvironment() {
  const path = process.env.PIN_EXPIRY_ENV_FILE;
  if (!path || [".env", ".env.local"].includes(basename(path))) fail("PIN_EXPIRY_EXPLICIT_ENV_REQUIRED");
  let contents: string;
  try { contents = readFileSync(path!, "utf8"); } catch { return fail("PIN_EXPIRY_ENV_UNREADABLE"); }
  const entries = Object.fromEntries(contents.split(/\r?\n/).map(line => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)).filter((entry): entry is RegExpMatchArray => !!entry).map(entry => [entry[1], entry[2]]));
  const keys = ["PIN_EXPIRY_PROFILE", "PIN_EXPIRY_PROJECT", "PIN_EXPIRY_MARKER", "PIN_EXPIRY_API_URL", "PIN_EXPIRY_OBSERVER_DSN", "PIN_EXPIRY_ANON_KEY", "PIN_EXPIRY_VITE_PORT"];
  if (!same(Object.keys(entries).sort(), [...keys].sort()) || entries.PIN_EXPIRY_PROFILE !== "local-g2c-v1"
    || entries.PIN_EXPIRY_PROJECT !== PROJECT || !/^pos-cafe-perm-g2c-[a-f0-9]{40}$/.test(entries.PIN_EXPIRY_MARKER))
    fail("PIN_EXPIRY_PROFILE_MISMATCH");
  let api: URL, dsn: URL, claims: Record<string, unknown>;
  try {
    api = new URL(entries.PIN_EXPIRY_API_URL); dsn = new URL(entries.PIN_EXPIRY_OBSERVER_DSN);
    claims = JSON.parse(Buffer.from(entries.PIN_EXPIRY_ANON_KEY.split(".")[1], "base64url").toString());
  } catch { return fail("PIN_EXPIRY_ENV_INVALID"); }
  if (api.origin !== "http://127.0.0.1:59721" || api.pathname !== "/" || api.search || api.hash
    || dsn.protocol !== "postgresql:" || dsn.hostname !== "127.0.0.1" || dsn.port !== "59722"
    || dsn.pathname !== "/postgres" || dsn.search || dsn.hash || claims.role !== "anon"
    || entries.PIN_EXPIRY_VITE_PORT !== "5181") fail("PIN_EXPIRY_ENDPOINT_REFUSED");
  return { api: api.origin, dsn: dsn.href, marker: entries.PIN_EXPIRY_MARKER,
    anonKey: entries.PIN_EXPIRY_ANON_KEY, project: PROJECT };
}

export async function assertPinExpiryTarget(db: Client, env = pinExpiryEnvironment()) {
  const config = command(["cat", `${ROOT}/stack/supabase/config.toml`]);
  const expected = readFileSync("tests/permissions/runtime/identity.toml", "utf8")
    .replaceAll("pos-cafe-perm-s31-t04-20261013", PROJECT).replaceAll("6242", "5972")
    .replace("inspector_port = 8084", "inspector_port = 8087");
  if (sha(config.replaceAll("\r\n", "\n").trim()) !== sha(expected.replaceAll("\r\n", "\n").trim())
    || command([CLI, "--version"]).trim() !== "2.117.0") fail("PIN_EXPIRY_RUNTIME_CONFIG_REFUSED");
  const names = ["db", "auth", "rest", "kong", "storage", "realtime", "edge_runtime", "studio", "pg_meta", "inbucket", "vector", "analytics"];
  let containers: any[];
  try { containers = JSON.parse(command(["docker", "inspect", ...names.map(name => `supabase_${name}_${PROJECT}`)])); }
  catch { return fail("PIN_EXPIRY_CONTAINERS_REFUSED"); }
  if (containers.length !== names.length) fail("PIN_EXPIRY_CONTAINERS_REFUSED");
  const peer = JSON.parse(command(["docker", "inspect", ...names.map(name => `supabase_${name}_pos-cafe-perm-g2b-20261009`)]));
  if (peer.length !== names.length || containers.some((container, index) =>
    container.Image !== peer[index].Image || container.Config.Image !== peer[index].Config.Image))
    fail("PIN_EXPIRY_IMAGE_REFUSED");
  for (const container of containers) {
    if (container.Config.Labels?.["com.supabase.cli.project"] !== PROJECT || !container.State.Running
      || (container.State.Health && container.State.Health.Status !== "healthy")) fail("PIN_EXPIRY_SERVICE_REFUSED");
    for (const bindings of Object.values(container.NetworkSettings.Ports ?? {}) as any[]) for (const binding of bindings ?? [])
      if (!["127.0.0.1", "::1"].includes(binding.HostIp)) fail("PIN_EXPIRY_NONLOCAL_PORT_REFUSED");
  }
  if (!containers[0].Mounts.some((mount: any) => mount.Type === "volume" && mount.Name === `supabase_db_${PROJECT}`))
    fail("PIN_EXPIRY_VOLUME_REFUSED");
  const network = JSON.parse(command(["docker", "network", "inspect", `supabase_network_${PROJECT}`]));
  if (network.length !== 1 || network[0].Options?.["com.docker.network.bridge.host_binding_ipv4"] !== "127.0.0.1")
    fail("PIN_EXPIRY_NETWORK_REFUSED");
  const marker = (await db.query("select current_database() db,marker,project,migration_checksums,activation_hash,catalog_hash from private.pin_expiry_test_environment where singleton")).rows;
  const checksums = migrationChecksums(process.cwd(), 16);
  const activationHash = sha(JSON.stringify(ACTIVATION_SQL_ORDER.map((path: string) => [path, sha(readFileSync(path))])));
  const recordedChecksums = marker[0]?.migration_checksums as Record<string, string> | undefined;
  const migrationsMatch = !!recordedChecksums && Object.keys(recordedChecksums).length === Object.keys(checksums).length
    && Object.entries(checksums).every(([name, hash]) => recordedChecksums[name] === hash);
  if (marker.length !== 1 || marker[0].db !== "postgres" || marker[0].marker !== env.marker || marker[0].project !== PROJECT
    || !migrationsMatch || marker[0].activation_hash !== activationHash)
    fail("PIN_EXPIRY_MARKER_REFUSED");
  const functionCatalog = (await db.query(`select n.nspname,p.proname,p.oid,to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('private','public') order by n.nspname,p.proname,p.oid`)).rows;
  if (marker[0].catalog_hash !== sha(JSON.stringify(functionCatalog)))
    fail("PIN_EXPIRY_CATALOG_REFUSED");
  const gate = (await db.query("select strict,contract_version from private.permission_contract_gate where singleton")).rows;
  if (gate.length !== 1 || !gate[0].strict || gate[0].contract_version !== 2) fail("PIN_EXPIRY_CONTRACT_REFUSED");
  await assertPinExpiryProductionClock(db);
  const graph = (await db.query(`select s.id,s.store_no,s.name,u.email,
    (select count(*)::int from public.employees e where e.store_id=s.id and e.role='owner') owners,
    (select count(*)::int from private.initial_seed_workflows w where w.store_id=s.id and w.requested=false and w.status='skipped') workflows
    from public.stores s left join auth.users u on u.id=s.id order by s.id`)).rows;
  const userCount = (await db.query("select count(*)::int n from auth.users")).rows[0].n;
  if (graph.length > 1 || userCount !== graph.length || graph.some(row => row.name !== "G2c Expiry Wait"
    || row.email !== `store${row.store_no}@store.pos.local` || row.owners !== 1 || row.workflows !== 1))
    fail("PIN_EXPIRY_OWNED_GRAPH_REFUSED");
  const response = await fetch(`${env.api}/rest/v1/rpc/permission_pin_expiry_fixture_identity`, {
    method: "POST", headers: { apikey: env.anonKey, "Content-Type": "application/json", "x-pos-permission-contract": "2" },
    body: "{}", signal: AbortSignal.timeout(10_000),
  }).catch(() => fail("PIN_EXPIRY_API_BINDING_REFUSED"));
  let result: any;
  try { result = await response.json(); } catch { return fail("PIN_EXPIRY_API_BINDING_REFUSED"); }
  if (!response.ok || result?.marker !== env.marker || result?.project !== PROJECT || result?.database !== "postgres"
    || response.headers.get("x-pos-permission-hook") !== "strict") fail("PIN_EXPIRY_API_BINDING_REFUSED");
}
