import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";
import pg from "pg";
import { pinExpiryEnvironment, assertPinExpiryTarget } from "./permissionPinExpiryEnvironment.ts";
import { installPinExpiryClock } from "./permissionPinExpiryClock.ts";
import { beginPinRaceOwnerBarrier, waitForPinRaceGraph } from "./permissionPinRaceLocks.ts";
import { capturePinAckCredentialBaseline, capturePinAckSnapshot } from "./permissionPinAckObserver.ts";

const env = pinExpiryEnvironment();
const TEMP_PIN = "123456";
const NEW_PIN = "384729";
const NOTICE = "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.";
const FINANCIAL = /(?:payment|receipt|print|write_operation)/;
const PROTECTED = new Set(["permission_get_authority", "permission_get_revision", "permission_get_initial_seed_status",
  "permission_begin_initial_seed", "permission_run_initial_seed_stage", "permission_get_menu_catalog",
  "permission_get_floor_workspace", "permission_get_settings_admin", "permission_admin_list"]);
function fail(code: string): never { throw new Error(`PIN_EXPIRY_${code}`); }
const phase = (code: string) => test.info().annotations.push({ type: "pin-expiry-phase", description: `PIN_EXPIRY_PHASE_${code}` });
const uuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const token = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
type Identity = { storeId: string; ownerId: string };
type Start = { kind: "required_pin_change" | null; error: string | null; token: string | null;
  revision: number | null; ttlMs: number | null };
type Completion = { p_request: { requestId: string; expectedRevision: number; newPin: string } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>, code: string, ms = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`PIN_EXPIRY_${code}`)), ms);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
async function jsonObject(response: { json(): Promise<unknown> }): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = await response.json(); } catch { return fail("RESPONSE_JSON_INVALID"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("RESPONSE_SHAPE_INVALID");
  return value as Record<string, unknown>;
}
function parseStart(value: Record<string, unknown>): Start {
  if (value.ok === false) {
    const code = (value.error as Record<string, unknown> | undefined)?.code;
    if (typeof code !== "string" || !/^[A-Z_]+$/.test(code)) fail("LOGIN_ERROR_INVALID");
    return { kind: null, error: code, token: null, revision: null, ttlMs: null };
  }
  if (value.ok !== true || value.kind !== "required_pin_change" || !token(value.token)
    || !Number.isSafeInteger(value.employeeRevision) || !uuid(value.storeId) || !uuid(value.employeeId)
    || typeof value.issuedAt !== "string" || typeof value.expiresAt !== "string" || "authority" in value)
    fail("RESTRICTED_LOGIN_INVALID");
  return { kind: "required_pin_change", error: null, token: value.token as string,
    revision: value.employeeRevision as number,
    ttlMs: Date.parse(value.expiresAt as string) - Date.parse(value.issuedAt as string) };
}

async function createStore(page: Page): Promise<Identity> {
  let identity: Identity | undefined;
  let routeFailed = false;
  await page.route("**/rest/v1/rpc/permission_bootstrap_store", async route => {
    try {
      const response = await route.fetch({ timeout: 20_000 });
      const value = await jsonObject(response);
      const data = value.data as Record<string, unknown> | undefined;
      if (!response.ok() || value.ok !== true || !uuid(data?.storeId) || !uuid(data?.ownerId)
        || data?.seedRequested !== false) fail("BOOTSTRAP_INVALID");
      identity = { storeId: data.storeId, ownerId: data.ownerId };
      await route.fulfill({ response });
    } catch { routeFailed = true; await route.abort("failed").catch(() => undefined); }
  });
  await page.goto("/");
  await expect(page.getByTestId("landing-screen")).toBeVisible();
  await page.getByTestId("go-create-store").click();
  await page.getByTestId("store-name-input").fill("G2c Expiry Wait");
  await expect(page.getByTestId("seed-demo-checkbox")).not.toBeChecked();
  await page.getByTestId("key-loss-acknowledgement").check();
  await page.getByTestId("create-store-button").click();
  await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 20_000 });
  if (!identity || routeFailed) fail("BOOTSTRAP_UNOBSERVED");
  await page.getByTestId("acknowledge-store-key").click();
  await expect(page.getByTestId("passcode-screen")).toBeVisible();
  return identity;
}
async function enterPin(page: Page, ownerId: string, pin: string) {
  await page.getByTestId(`employee-${ownerId}`).click();
  for (const digit of pin) await page.getByTestId(`pin-${digit}`).click();
  await page.getByTestId("unlock-button").click();
}
async function rpc(name: string, bearer: string, body: Record<string, unknown>, employeeToken?: string) {
  try {
    const response = await fetch(`${env.api}/rest/v1/rpc/${name}`, { method: "POST", headers: {
      apikey: env.anonKey, authorization: bearer, "x-pos-permission-contract": "2",
      "Content-Type": "application/json", ...(employeeToken ? { "x-pos-employee-token": employeeToken } : {}),
    }, body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) fail("DIRECT_RPC_HTTP_FAILED");
    return await jsonObject(response);
  } catch { return fail("DIRECT_RPC_FAILED"); }
}
async function installPendingK(db: pg.Client, identity: Identity) {
  const operationId = randomUUID();
  const payload = { schemaVersion: 1, kind: "pay_order", orderId: randomUUID(), paymentId: randomUUID(),
    expectedVersion: 0, method: "cash", receivedAmount: 50000 };
  try {
    const result = await db.query(`with fixed as (select private.write_clock() at_time)
      insert into public.write_operations
      (store_id,operation_id,schema_version,kind,required_permission,payload,registered_at,expires_at,initiated_by_employee_id)
      select $1::uuid,$2::uuid,1,'pay_order','payment.take',$3::jsonb,fixed.at_time,fixed.at_time+interval '24 hours',$4::uuid from fixed
      returning status`, [identity.storeId, operationId, JSON.stringify(payload), identity.ownerId]);
    if (result.rowCount !== 1 || result.rows[0].status !== "pending") fail("PENDING_K_INVALID");
  } catch { return fail("PENDING_K_INVALID"); }
  return operationId;
}
async function assertPendingKAndBlankBusiness(db: pg.Client, identity: Identity, operationId: string) {
  try {
    const row = (await db.query(`select
      (select count(*)::int from public.write_operations w where w.store_id=$1::uuid and w.operation_id=$2::uuid
        and w.status='pending' and w.result is null and w.error is null and w.decided_at is null) pending,
      (select count(*)::int from public.orders o where o.store_id=$1::uuid) orders,
      (select count(*)::int from public.order_items i where i.store_id=$1::uuid) items,
      (select count(*)::int from public.order_events e where e.store_id=$1::uuid) events,
      (select count(*)::int from public.payments p where p.store_id=$1::uuid) payments`,
      [identity.storeId, operationId])).rows[0];
    if (!row || row.pending !== 1 || row.orders !== 0 || row.items !== 0 || row.events !== 0
      || row.payments !== 0) fail("PENDING_K_OR_BUSINESS_CHANGED");
  } catch { fail("PENDING_K_OR_BUSINESS_CHANGED"); }
}

// Only the boolean result escapes this closure. Exact row contents, tokens,
// credential hashes and fingerprints are never attached to an assertion diff.
async function noEffectsBaseline(db: pg.Client, storeId: string, ownerId: string) {
  const tables = [
    ["owner", "public.employees", "store_id=$1::uuid and id=$2::uuid"],
    ["sessions", "private.employee_sessions", "store_id=$1::uuid and employee_id=$2::uuid"],
    ["audit", "public.employee_admin_audit", "store_id=$1::uuid"],
    ["receipts", "private.employee_admin_requests", "store_id=$1::uuid"],
    ["signals", "public.store_change_signals", "store_id=$1::uuid"],
    ["pending_k", "public.write_operations", "store_id=$1::uuid"],
    ["orders", "public.orders", "store_id=$1::uuid"],
    ["order_items", "public.order_items", "store_id=$1::uuid"],
    ["order_events", "public.order_events", "store_id=$1::uuid"],
    ["payments", "public.payments", "store_id=$1::uuid"],
  ] as const;
  async function read() {
    const output: string[] = [];
    for (const [, table, where] of tables) {
      // Table names are a fixed source allowlist; values stay in bind parameters.
      const result = await db.query(`select encode(extensions.digest(convert_to(coalesce((select
        jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text
        from ${table} x where ${where}), 'null'), 'UTF8'), 'sha256'), 'hex') fingerprint`,
      where.includes("$2") ? [storeId, ownerId] : [storeId]);
      if (result.rows.length !== 1 || typeof result.rows[0].fingerprint !== "string") fail("NO_EFFECTS_READ_INVALID");
      output.push(result.rows[0].fingerprint);
    }
    return output;
  }
  let original: string[];
  try { original = await read(); } catch { return fail("NO_EFFECTS_BASELINE_FAILED"); }
  return async () => {
    try {
      const current = await read();
      if (current.length !== original.length || current.some((value, i) => value !== original[i])) fail("NO_EFFECTS_CHANGED");
    } catch { fail("NO_EFFECTS_CHANGED"); }
  };
}

async function sessionValidity(db: pg.Client, identity: Identity, employeeToken: string) {
  try {
    const row = (await db.query(`select count(*)::int total,
      count(*) filter(where s.revoked_at is null)::int unrevoked,
      count(*) filter(where s.revoked_at is not null)::int revoked,
      count(*) filter(where s.expires_at<=private.write_clock() and s.revoked_at is null)::int expired,
      count(*) filter(where s.expires_at>private.write_clock() and s.revoked_at is null)::int valid,
      coalesce(bool_and(s.purpose='required_pin_change'),false) restricted
      from private.employee_sessions s where s.store_id=$1::uuid and s.employee_id=$2::uuid
        and s.token_hash=extensions.digest(convert_to($3::text,'UTF8'),'sha256')`,
      [identity.storeId, identity.ownerId, employeeToken])).rows[0];
    if (!row || !["total", "unrevoked", "revoked", "expired", "valid"].every(key =>
      Number.isSafeInteger(row[key])) || typeof row.restricted !== "boolean") fail("SESSION_PROJECTION_INVALID");
    return row as { total: number; unrevoked: number; revoked: number; expired: number; valid: number; restricted: boolean };
  } catch { return fail("SESSION_PROJECTION_FAILED"); }
}

class CompletionGate {
  private seen = deferred<Completion | null>();
  private forwarded = deferred<"DENIED" | "FAILED">();
  private settled = deferred<boolean>();
  private go = deferred<void>();
  private ack = deferred<void>();
  private request: Completion | null = null;
  private count = 0;
  private closed = false;
  constructor(private page: Page, private employeeToken: string, private revision: number) {}
  async install() {
    await this.page.route("**/rest/v1/rpc/permission_complete_required_pin_change", async (route: Route) => {
      this.count += 1;
      let failed = false;
      try {
        if (this.count !== 1) fail("UI_COMPLETION_REPLAYED");
        const body = route.request().postDataJSON() as Completion;
        const header = await route.request().headerValue("x-pos-employee-token");
        if (!uuid(body?.p_request?.requestId) || body.p_request.expectedRevision !== this.revision
          || body.p_request.newPin !== NEW_PIN || header !== this.employeeToken) fail("COMPLETION_REQUEST_INVALID");
        this.request = body;
        this.seen.resolve(body);
        await this.go.promise;
        const response = await route.fetch({ timeout: 50_000 });
        const value = await jsonObject(response);
        if (!response.ok() || value.ok !== false
          || (value.error as Record<string, unknown> | undefined)?.code !== "EMPLOYEE_SESSION_REQUIRED")
          fail("COMPLETION_RESPONSE_INVALID");
        this.forwarded.resolve("DENIED");
        await this.ack.promise;
        await route.fulfill({ response });
      } catch {
        failed = true;
        this.seen.resolve(null);
        this.forwarded.resolve("FAILED");
        await route.abort("failed").catch(() => undefined);
      } finally { this.settled.resolve(!failed); }
    });
  }
  async waitSeen() { if (!await bounded(this.seen.promise, "COMPLETION_NOT_INTERCEPTED")) fail("COMPLETION_CAPTURE_FAILED"); }
  forward() { this.go.resolve(); }
  async waitDenied() { if (await bounded(this.forwarded.promise, "COMPLETION_RESPONSE_TIMEOUT", 55_000) !== "DENIED")
    fail("COMPLETION_RESPONSE_FAILED"); }
  releaseAck() { this.ack.resolve(); }
  body() { if (!this.request) fail("COMPLETION_REQUEST_MISSING"); return this.request; }
  uiCount() { return this.count; }
  async cleanup() {
    if (this.closed) return;
    this.closed = true;
    this.go.resolve(); this.ack.resolve();
    if (this.count > 0 && (!await bounded(this.settled.promise, "ROUTE_SETTLEMENT_TIMEOUT", 55_000)
      || this.count !== 1)) fail("ROUTE_SETTLEMENT_FAILED");
  }
}

async function noProtected(page: Page, rpcNames: string[], formAllowed = false) {
  await expect(page.getByTestId("floor-view")).toHaveCount(0);
  await expect(page.getByTestId("receipt-preview")).toHaveCount(0);
  if (!formAllowed) await expect(page.getByTestId("required-pin-change-screen")).toHaveCount(0);
  for (const id of ["nav-employees", "nav-menu-editor", "nav-floor-editor", "nav-report", "nav-settings"])
    await expect(page.getByTestId(id)).toHaveCount(0);
  if (rpcNames.some(name => PROTECTED.has(name) || FINANCIAL.test(name))) fail("PROTECTED_OR_FINANCIAL_RPC_SEEN");
  if (await page.evaluate(() => (window as Window & { __pinExpiryPrintCalls?: number }).__pinExpiryPrintCalls) !== 0)
    fail("PRINT_CALLED");
}

test("TC-PIN-08 exact DB expiry while one UI completion waits on owner row", async ({ page }) => {
  test.setTimeout(120_000);
  let db: pg.Client | undefined;
  let controllerDb: pg.Client | undefined;
  let observerDb: pg.Client | undefined;
  let clock: Awaited<ReturnType<typeof installPinExpiryClock>> | undefined;
  let barrier: Awaited<ReturnType<typeof beginPinRaceOwnerBarrier>> | undefined;
  let gate: CompletionGate | undefined;
  let primaryFailure: unknown;
  try {
    phase("PREFLIGHT");
    db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
    controllerDb = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 90_000 });
    observerDb = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
    await db.connect(); await controllerDb.connect(); await observerDb.connect();
    await assertPinExpiryTarget(db, env);
    clock = await installPinExpiryClock(db);
    const installedProof = await clock.proof();
    if (!installedProof.installed || installedProof.restored || !installedProof.liveMatches)
      fail("CLOCK_INSTALL_PROOF_FAILED");
    await page.clock.setFixedTime(new Date(clock.t0Iso));
    if (await page.evaluate(() => new Date().toISOString()) !== clock.t0Iso)
      fail("BROWSER_T0_CLOCK_INVALID");
    await page.addInitScript(() => {
      let calls = 0;
      window.print = () => { calls += 1; };
      Object.defineProperty(window, "__pinExpiryPrintCalls", { get: () => calls });
    });
    const rpcNames: string[] = [];
    page.on("request", request => {
      const name = request.url().match(/\/rest\/v1\/rpc\/([^?]+)/)?.[1];
      if (name) rpcNames.push(name);
    });
    const identity = await createStore(page);
    const pendingK = await installPendingK(db, identity);
    const starts: Start[] = [];
    let bearer: string | null = null;
    let loginRouteFailed = false;
    await page.route("**/rest/v1/rpc/permission_start_session", async route => {
      try {
        const header = await route.request().headerValue("authorization");
        if (!header || !/^Bearer [A-Za-z0-9._-]+$/.test(header)) fail("BEARER_INVALID");
        bearer ??= header;
        const response = await route.fetch({ timeout: 20_000 });
        if (!response.ok()) fail("LOGIN_HTTP_FAILED");
        starts.push(parseStart(await jsonObject(response)));
        await route.fulfill({ response });
      } catch { loginRouteFailed = true; await route.abort("failed").catch(() => undefined); }
    });
    phase("RESTRICTED_LOGIN");
    await enterPin(page, identity.ownerId, TEMP_PIN);
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    await expect(page.getByTestId("complete-required-pin")).toBeEnabled({ timeout: 10_000 });
    const start = starts.at(-1);
    if (loginRouteFailed || start?.kind !== "required_pin_change" || start.ttlMs !== 300_000
      || !start.token || start.revision === null || !bearer) fail("RESTRICTED_PROOF_INVALID");
    const oldToken = start.token;
    const oldRevision = start.revision;
    const credential = await capturePinAckCredentialBaseline(db, identity.storeId, identity.ownerId);
    const unchanged = await noEffectsBaseline(db, identity.storeId, identity.ownerId);
    await assertPendingKAndBlankBusiness(db, identity, pendingK);
    const initialSession = await sessionValidity(db, identity, oldToken);
    if (initialSession.total !== 1 || initialSession.unrevoked !== 1 || initialSession.revoked !== 0
      || initialSession.expired !== 0 || initialSession.valid !== 1 || !initialSession.restricted)
      fail("INITIAL_SESSION_INVALID");
    await noProtected(page, rpcNames, true);
    rpcNames.length = 0;
    gate = new CompletionGate(page, oldToken, oldRevision);
    await gate.install();
    barrier = await beginPinRaceOwnerBarrier(controllerDb, identity.storeId, identity.ownerId);
    await page.getByTestId("required-new-pin").fill(NEW_PIN);
    await page.getByTestId("required-confirm-pin").fill(NEW_PIN);
    await page.getByTestId("complete-required-pin").click();
    await gate.waitSeen();
    gate.forward();
    const beforeGraph = await waitForPinRaceGraph(observerDb, { storeId: identity.storeId,
      ownerId: identity.ownerId, expectedRevision: oldRevision, controllerPid: barrier.controllerPid,
      phase: "winner", deadlineMs: 15_000 });
    if (beforeGraph.holderCount !== 1 || beforeGraph.waiterCount !== 0) fail("PRE_EXPIRY_WAIT_INVALID");
    phase("DB_WAIT_WHILE_VALID");
    const request = gate.body();
    const before = await capturePinAckSnapshot(db, { storeId: identity.storeId, ownerId: identity.ownerId,
      requestId: request.p_request.requestId, tempPin: TEMP_PIN, newPin: NEW_PIN,
      oldTokens: [oldToken], baseline: credential });
    if (!before.credentialHashMatchesBaseline || !before.credentialMatchesTemporary || before.credentialMatchesNew
      || !before.requiresPinChange || before.revision !== oldRevision || before.sessionTotal !== 1
      || before.sessionActive !== 1 || before.sessionRevoked !== 0 || before.auditCount !== 0
      || before.requestCount !== 0 || before.signalCount !== 0) fail("PRE_EXPIRY_STATE_INVALID");
    await unchanged();
    await assertPendingKAndBlankBusiness(db, identity, pendingK);
    const expiry = await clock.advanceToSessionExpiry(identity.storeId, identity.ownerId);
    const advancedProof = await clock.proof();
    if (!advancedProof.installed || advancedProof.restored || !advancedProof.liveMatches)
      fail("CLOCK_ADVANCE_PROOF_FAILED");
    if (Date.parse(expiry.expiresAtIso) - Date.parse(expiry.issuedAtIso) !== 300_000
      || Date.parse(clock.t0Iso) >= Date.parse(expiry.expiresAtIso)
      || Date.parse(await clock.read()) !== Date.parse(expiry.expiresAtIso)) fail("CLOCK_BOUNDARY_INVALID");
    const afterGraph = await waitForPinRaceGraph(observerDb, { storeId: identity.storeId,
      ownerId: identity.ownerId, expectedRevision: oldRevision, controllerPid: barrier.controllerPid,
      phase: "winner", deadlineMs: 15_000 });
    if (afterGraph.winnerPid !== beforeGraph.winnerPid || afterGraph.holderCount !== 1
      || afterGraph.waiterCount !== 0) fail("WAIT_PID_CHANGED");
    const expired = await sessionValidity(db, identity, oldToken);
    if (expired.total !== 1 || expired.unrevoked !== 1 || expired.revoked !== 0
      || expired.expired !== 1 || expired.valid !== 0 || !expired.restricted) fail("EXPIRED_CLASSIFICATION_INVALID");
    const during = await capturePinAckSnapshot(db, { storeId: identity.storeId, ownerId: identity.ownerId,
      requestId: request.p_request.requestId, tempPin: TEMP_PIN, newPin: NEW_PIN,
      oldTokens: [oldToken], baseline: credential });
    if (JSON.stringify(during) !== JSON.stringify(before)) fail("DURING_WAIT_STATE_CHANGED");
    await unchanged();
    await assertPendingKAndBlankBusiness(db, identity, pendingK);
    phase("EXACT_EXPIRY_STILL_WAITING");
    await barrier.release(); barrier = undefined;
    await gate.waitDenied();
    const after = await capturePinAckSnapshot(db, { storeId: identity.storeId, ownerId: identity.ownerId,
      requestId: request.p_request.requestId, tempPin: TEMP_PIN, newPin: NEW_PIN,
      oldTokens: [oldToken], baseline: credential });
    if (JSON.stringify(after) !== JSON.stringify(before)) fail("DENIAL_SIDE_EFFECT_SEEN");
    await unchanged();
    await assertPendingKAndBlankBusiness(db, identity, pendingK);
    phase("SERVER_DENIAL_ACK_HELD");
    if (await page.evaluate(() => new Date().toISOString()) !== clock.t0Iso)
      fail("BROWSER_CLOCK_MOVED_WITH_DB");
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    await expect(page.getByTestId("complete-required-pin")).toBeDisabled();
    await expect(page.getByTestId("complete-required-pin")).toHaveText("Đang đổi PIN...");
    await expect(page.getByTestId("passcode-screen")).toHaveCount(0);
    await expect(page.getByTestId("session-notice")).toHaveCount(0);
    await noProtected(page, rpcNames, true);
    gate.releaseAck();
    await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("session-notice")).toHaveText(NOTICE);
    await noProtected(page, rpcNames);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.context().setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await page.context().setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await page.evaluate(async () => { await new Promise<void>(r => requestAnimationFrame(() => r()));
      await new Promise<void>(r => requestAnimationFrame(() => r())); });
    if (gate.uiCount() !== 1) fail("COMPLETION_REPLAYED");
    await noProtected(page, rpcNames);
    phase("UI_SERVER_RESPONSE_CONFIRMED");
    const replay = await rpc("permission_complete_required_pin_change", bearer, request, oldToken);
    if (replay.ok !== false || (replay.error as Record<string, unknown> | undefined)?.code !== "EMPLOYEE_SESSION_REQUIRED")
      fail("OLD_TOKEN_REPLAY_NOT_DENIED");
    const checked = await rpc("permission_check_required_pin_session", bearer, {}, oldToken);
    if (checked.ok !== false || (checked.error as Record<string, unknown> | undefined)?.code !== "EMPLOYEE_SESSION_REQUIRED")
      fail("OLD_TOKEN_CHECK_NOT_DENIED");
    await unchanged();
    await assertPendingKAndBlankBusiness(db, identity, pendingK);
    phase("OLD_TOKEN_DENIED");
    await page.clock.setFixedTime(new Date(expiry.expiresAtIso));
    if (await page.evaluate(() => new Date().toISOString()) !== expiry.expiresAtIso)
      fail("BROWSER_T1_CLOCK_INVALID");
    await enterPin(page, identity.ownerId, NEW_PIN);
    await expect(page.getByText("PIN không đúng. Vui lòng thử lại.", { exact: true })).toBeVisible();
    if (starts.at(-1)?.error !== "INVALID_PIN") fail("NEW_PIN_NOT_REJECTED");
    await enterPin(page, identity.ownerId, TEMP_PIN);
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    const fresh = starts.at(-1);
    if (loginRouteFailed || fresh?.kind !== "required_pin_change" || fresh.ttlMs !== 300_000
      || !fresh.token || fresh.token === oldToken || fresh.revision !== oldRevision) fail("FRESH_RESTRICTED_INVALID");
    const oldAfterFresh = await sessionValidity(db, identity, oldToken);
    const newSession = await sessionValidity(db, identity, fresh.token);
    if (oldAfterFresh.expired !== 1 || oldAfterFresh.revoked !== 0 || oldAfterFresh.unrevoked !== 1
      || newSession.total !== 1 || newSession.valid !== 1 || newSession.expired !== 0
      || newSession.revoked !== 0 || !newSession.restricted) fail("FRESH_SESSION_GRAPH_INVALID");
    const afterFresh = await capturePinAckSnapshot(db, { storeId: identity.storeId, ownerId: identity.ownerId,
      requestId: request.p_request.requestId, tempPin: TEMP_PIN, newPin: NEW_PIN,
      oldTokens: [oldToken], baseline: credential });
    if (!afterFresh.credentialHashMatchesBaseline || !afterFresh.credentialMatchesTemporary
      || afterFresh.credentialMatchesNew || !afterFresh.requiresPinChange || afterFresh.revision !== oldRevision
      || afterFresh.sessionTotal !== before.sessionTotal + 1 || afterFresh.sessionActive !== before.sessionActive + 1
      || afterFresh.sessionRevoked !== 0 || afterFresh.auditCount !== 0 || afterFresh.requestCount !== 0
      || afterFresh.signalCount !== 0 || afterFresh.signalRevision !== before.signalRevision)
      fail("FRESH_LOGIN_EFFECTS_INVALID");
    await assertPendingKAndBlankBusiness(db, identity, pendingK);
    await noProtected(page, rpcNames, true);
    if (gate.uiCount() !== 1) fail("COMPLETION_REPLAYED_AFTER_LOGIN");
    phase("FRESH_RESTRICTED_LOGIN");
  } catch (error) {
    primaryFailure = error instanceof Error && /^PIN_EXPIRY_[A-Z_]+$/.test(error.message)
      ? error : new Error("PIN_EXPIRY_CASE_FAILED");
  }
  finally {
    let cleanupFailed = false;
    if (barrier) { try { await barrier.rollback(); } catch { cleanupFailed = true; } }
    if (gate) { try { await gate.cleanup(); } catch { cleanupFailed = true; } }
    try { await page.context().close(); } catch { cleanupFailed = true; }
    if (clock) {
      try {
        await clock.restore();
        const restoredProof = await clock.proof();
        if (!restoredProof.installed || !restoredProof.restored || !restoredProof.liveMatches)
          cleanupFailed = true;
      } catch { cleanupFailed = true; }
    }
    for (const client of [db, controllerDb, observerDb]) if (client) {
      try { await client.end(); } catch { cleanupFailed = true; }
    }
    if (cleanupFailed) primaryFailure = new Error("PIN_EXPIRY_CLEANUP_FAILED");
  }
  if (primaryFailure) throw primaryFailure;
});
