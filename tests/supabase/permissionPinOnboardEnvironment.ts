import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { Client } from "pg";
import { migrationChecksums } from "../contracts/observerPreflight.ts";
// @ts-expect-error Activation bundle is existing JavaScript without a declaration file.
import { ACTIVATION_SQL_ORDER } from "../../scripts/permission-activation-bundle.mjs";

const PROJECT = "pos-cafe-perm-s31-onboard-20261013";
const ROOT = `/var/tmp/${PROJECT}`;
const CLI = "/var/tmp/pos-cafe-perm-s31-t04-20261013/bin/supabase";
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const fail = (code: string): never => { throw new Error(code); };

function command(args: string[]): string {
  try {
    return execFileSync(process.platform === "win32" ? "wsl" : args[0],
      process.platform === "win32" ? ["-d", "Ubuntu-24.04", "--", ...args] : args.slice(1),
      { encoding: "utf8", timeout: 30_000, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch { return fail("PIN_ONBOARD_RUNTIME_COMMAND_FAILED"); }
}

export function pinOnboardEnvironment() {
  const path = process.env.PIN_ONBOARD_ENV_FILE;
  if (!path || [".env", ".env.local"].includes(basename(path))) fail("PIN_ONBOARD_EXPLICIT_ENV_REQUIRED");
  let contents: string;
  try { contents = readFileSync(path!, "utf8"); } catch { return fail("PIN_ONBOARD_ENV_UNREADABLE"); }
  const entries = Object.fromEntries(contents.split(/\r?\n/).map(line => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
    .filter((entry): entry is RegExpMatchArray => !!entry).map(entry => [entry[1], entry[2]]));
  const keys = ["PIN_ONBOARD_PROFILE", "PIN_ONBOARD_PROJECT", "PIN_ONBOARD_MARKER", "PIN_ONBOARD_API_URL",
    "PIN_ONBOARD_OBSERVER_DSN", "PIN_ONBOARD_ANON_KEY", "PIN_ONBOARD_VITE_PORT"];
  if (JSON.stringify(Object.keys(entries).sort()) !== JSON.stringify([...keys].sort())
    || entries.PIN_ONBOARD_PROFILE !== "local-pin-onboard-v1" || entries.PIN_ONBOARD_PROJECT !== PROJECT
    || !/^pos-cafe-perm-pin-onboard-[a-f0-9]{40}$/.test(entries.PIN_ONBOARD_MARKER)) fail("PIN_ONBOARD_PROFILE_MISMATCH");
  let api: URL, dsn: URL, claims: Record<string, unknown>;
  try {
    api = new URL(entries.PIN_ONBOARD_API_URL); dsn = new URL(entries.PIN_ONBOARD_OBSERVER_DSN);
    claims = JSON.parse(Buffer.from(entries.PIN_ONBOARD_ANON_KEY.split(".")[1], "base64url").toString());
  } catch { return fail("PIN_ONBOARD_ENV_INVALID"); }
  if (api.origin !== "http://127.0.0.1:62921" || api.pathname !== "/" || api.search || api.hash
    || dsn.protocol !== "postgresql:" || dsn.hostname !== "127.0.0.1" || dsn.port !== "62922"
    || dsn.pathname !== "/postgres" || dsn.search || dsn.hash || claims.role !== "anon"
    || entries.PIN_ONBOARD_VITE_PORT !== "5189") fail("PIN_ONBOARD_ENDPOINT_REFUSED");
  return { api: api.origin, dsn: dsn.href, marker: entries.PIN_ONBOARD_MARKER,
    anonKey: entries.PIN_ONBOARD_ANON_KEY, project: PROJECT };
}

export function pinOnboardLocalServiceKey(env = pinOnboardEnvironment()): string {
  let status: Record<string, string>;
  try { status = JSON.parse(command([CLI, "status", "--workdir", `${ROOT}/stack`, "-o", "json"])); }
  catch { return fail("PIN_ONBOARD_SERVICE_STATUS_REFUSED"); }
  if (new URL(status.API_URL).origin !== env.api || new URL(status.DB_URL).href !== env.dsn)
    fail("PIN_ONBOARD_SERVICE_ENDPOINT_REFUSED");
  const key = status.SERVICE_ROLE_KEY;
  if (typeof key !== "string" || key.split(".").length !== 3) fail("PIN_ONBOARD_SERVICE_KEY_REFUSED");
  let claims: Record<string, unknown>;
  try { claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()); }
  catch { return fail("PIN_ONBOARD_SERVICE_KEY_REFUSED"); }
  if (claims.role !== "service_role") fail("PIN_ONBOARD_SERVICE_KEY_REFUSED");
  return key;
}

export async function assertPinOnboardTarget(db: Client, env = pinOnboardEnvironment()) {
  const config = command(["cat", `${ROOT}/stack/supabase/config.toml`]);
  const expected = readFileSync("tests/permissions/runtime/onboarding.toml", "utf8");
  if (sha(config.replaceAll("\r\n", "\n").trim()) !== sha(expected.replaceAll("\r\n", "\n").trim())
    || command([CLI, "--version"]).trim() !== "2.117.0") fail("PIN_ONBOARD_RUNTIME_CONFIG_REFUSED");
  const names = ["db", "auth", "rest", "kong", "storage", "realtime", "edge_runtime", "studio", "pg_meta", "inbucket", "vector", "analytics"];
  let containers: any[];
  try { containers = JSON.parse(command(["docker", "inspect", ...names.map(name => `supabase_${name}_${PROJECT}`)])); }
  catch { return fail("PIN_ONBOARD_CONTAINERS_REFUSED"); }
  if (containers.length !== names.length) fail("PIN_ONBOARD_CONTAINERS_REFUSED");
  for (const container of containers) {
    if (container.Config.Labels?.["com.supabase.cli.project"] !== PROJECT || !container.State.Running
      || (container.State.Health && container.State.Health.Status !== "healthy")) fail("PIN_ONBOARD_SERVICE_REFUSED");
    for (const bindings of Object.values(container.NetworkSettings.Ports ?? {}) as any[]) for (const binding of bindings ?? [])
      if (!["127.0.0.1", "::1"].includes(binding.HostIp)) fail("PIN_ONBOARD_NONLOCAL_PORT_REFUSED");
  }
  if (!containers[0].Mounts.some((mount: any) => mount.Type === "volume" && mount.Name === `supabase_db_${PROJECT}`))
    fail("PIN_ONBOARD_VOLUME_REFUSED");
  const network = JSON.parse(command(["docker", "network", "inspect", `supabase_network_${PROJECT}`]));
  if (network.length !== 1 || network[0].Options?.["com.docker.network.bridge.host_binding_ipv4"] !== "127.0.0.1")
    fail("PIN_ONBOARD_NETWORK_REFUSED");
  const rows = (await db.query(`select current_database() db,marker,project,migration_checksums,activation_hash
    from private.pin_onboard_test_environment where singleton`)).rows;
  const checksums = migrationChecksums(process.cwd(), 16);
  const activationHash = sha(JSON.stringify(ACTIVATION_SQL_ORDER.map((path: string) => [path, sha(readFileSync(path))])));
  const saved = rows[0]?.migration_checksums as Record<string, string> | undefined;
  if (rows.length !== 1 || rows[0].db !== "postgres" || rows[0].marker !== env.marker || rows[0].project !== PROJECT
    || !saved || Object.keys(saved).length !== Object.keys(checksums).length
    || Object.entries(checksums).some(([name, hash]) => saved[name] !== hash) || rows[0].activation_hash !== activationHash)
    fail("PIN_ONBOARD_MARKER_REFUSED");
  const gate = (await db.query("select strict,contract_version from private.permission_contract_gate where singleton")).rows;
  if (gate.length !== 1 || !gate[0].strict || gate[0].contract_version !== 2) fail("PIN_ONBOARD_CONTRACT_REFUSED");
  const graph = (await db.query(`select s.id,s.store_no,s.name,u.email,
    (select count(*)::int from public.employees e where e.store_id=s.id and e.role='owner') owners,
    (select count(*)::int from private.initial_seed_workflows w where w.store_id=s.id) workflows
    from public.stores s left join auth.users u on u.id=s.id order by s.id`)).rows;
  const userCount = (await db.query("select count(*)::int n from auth.users")).rows[0].n;
  const allowedNames = new Set(["Cà phê Owner PIN E2E", "A", "😀".repeat(120)]);
  if (graph.length > 20 || userCount !== graph.length || graph.some(row => !allowedNames.has(row.name)
    || row.email !== `store${row.store_no}@store.pos.local` || row.owners !== 1 || row.workflows !== 1))
    fail("PIN_ONBOARD_OWNED_GRAPH_REFUSED");
  const response = await fetch(`${env.api}/rest/v1/rpc/permission_pin_onboard_fixture_identity`, {
    method: "POST", headers: { apikey: env.anonKey, "Content-Type": "application/json", "x-pos-permission-contract": "2" },
    body: "{}", signal: AbortSignal.timeout(10_000),
  }).catch(() => fail("PIN_ONBOARD_API_BINDING_REFUSED"));
  let result: any;
  try { result = await response.json(); } catch { return fail("PIN_ONBOARD_API_BINDING_REFUSED"); }
  if (!response.ok || result?.marker !== env.marker || result?.project !== PROJECT || result?.database !== "postgres"
    || response.headers.get("x-pos-permission-hook") !== "strict") fail("PIN_ONBOARD_API_BINDING_REFUSED");
}
