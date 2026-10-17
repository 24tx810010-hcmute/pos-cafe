import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { assertPinRaceTarget, pinRaceEnvironment } from "./permissionPinRaceEnvironment.ts";
import { beginPinRaceOwnerBarrier, waitForPinRaceGraph } from "./permissionPinRaceLocks.ts";
import { capturePinAckCredentialBaseline, capturePinAckSnapshot, type PinAckCredentialBaseline,
  type PinAckObservation } from "./permissionPinAckObserver.ts";

const env = pinRaceEnvironment();
const TEMP_PIN = "123456";
const PIN_A = "384729";
const PIN_B = "927416";
const WIN_NOTICE = "Đã đổi PIN. Vui lòng đăng nhập bằng PIN mới.";
const LOSE_NOTICE = "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.";
const PROTECTED = new Set([
  "permission_get_authority", "permission_get_revision", "permission_get_initial_seed_status",
  "permission_begin_initial_seed", "permission_run_initial_seed_stage", "permission_get_menu_catalog",
  "permission_get_floor_workspace", "permission_get_settings_admin", "permission_admin_list",
  "register_write_operation", "execute_write_operation", "get_write_operation", "list_write_operations",
  "cancel_write_operation", "authorize_initial_receipt_print", "prepare_receipt_reprint",
]);
const FINANCIAL = /(?:payment|receipt|print|write_operation)/;
function fail(code: string): never { throw new Error(`PIN_RACE_${code}`); }
const mark = (code: string) => test.info().annotations.push({ type: "pin-race-phase", description: `PIN_RACE_PHASE_${code}` });
const uuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const token = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

type Identity = { storeId: string; ownerId: string };
type Start = { kind: "required_pin_change" | "normal" | null; errorCode: string | null;
  token: string | null; ttlMs: number | null; revision: number | null;
  authority: { storeId: string; employeeId: string; employeeRevision: number } | null };
type Device = { page: Page; rpcNames: string[]; starts: Start[]; bearer: string | null; restrictedToken: string | null };
type RequestBody = { p_request: { requestId: string; expectedRevision: number; newPin: string } };
type Captured = { body: RequestBody; token: string };
type RouteOutcome = { code: "APPLIED" | "SESSION_REQUIRED" | "ROUTE_FAILED" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

async function bounded<T>(promise: Promise<T>, code: string, ms = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`PIN_RACE_${code}`)), ms);
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
    if (typeof code !== "string" || !/^[A-Z_]+$/.test(code)) fail("LOGIN_ERROR_SHAPE_INVALID");
    return { kind: null, errorCode: code, token: null, ttlMs: null, revision: null, authority: null };
  }
  if (value.ok !== true || !["required_pin_change", "normal"].includes(String(value.kind)) || !token(value.token)
    || typeof value.issuedAt !== "string" || typeof value.expiresAt !== "string") fail("LOGIN_SHAPE_INVALID");
  const ttlMs = Date.parse(value.expiresAt as string) - Date.parse(value.issuedAt as string);
  if (!Number.isFinite(ttlMs)) fail("LOGIN_TTL_INVALID");
  const kind = value.kind as Start["kind"];
  if (kind === "required_pin_change") {
    if (!Number.isSafeInteger(value.employeeRevision) || !uuid(value.storeId) || !uuid(value.employeeId)
      || "authority" in value) fail("RESTRICTED_SHAPE_INVALID");
    return { kind, errorCode: null, token: value.token as string, ttlMs,
      revision: value.employeeRevision as number, authority: null };
  }
  const bundle = value.authority as Record<string, unknown> | undefined;
  const snapshot = bundle?.snapshot as Record<string, unknown> | undefined;
  const catalog = bundle?.catalog as Record<string, unknown> | undefined;
  if (!uuid(snapshot?.storeId) || !uuid(snapshot?.employeeId) || snapshot?.role !== "owner"
    || snapshot?.active !== true || !Number.isSafeInteger(snapshot?.employeeRevision)
    || !Number.isSafeInteger(snapshot?.catalogRevision) || catalog?.revision !== snapshot.catalogRevision)
    fail("NORMAL_AUTHORITY_INVALID");
  return { kind, errorCode: null, token: value.token as string, ttlMs, revision: null,
    authority: { storeId: snapshot.storeId, employeeId: snapshot.employeeId,
      employeeRevision: snapshot.employeeRevision as number } };
}

async function createStore(page: Page, label: "A" | "B"): Promise<{ identity: Identity; storeKey: string }> {
  let identity: Identity | undefined;
  await page.route("**/rest/v1/rpc/permission_bootstrap_store", async route => {
    try {
      const response = await route.fetch({ timeout: 20_000 });
      const value = await jsonObject(response);
      const data = value.data as Record<string, unknown> | undefined;
      if (!response.ok() || value.ok !== true || !uuid(data?.storeId) || !uuid(data?.ownerId)
        || data?.seedRequested !== false) fail("BOOTSTRAP_INVALID");
      identity = { storeId: data.storeId, ownerId: data.ownerId };
      await route.fulfill({ response });
    } catch { await route.abort("failed").catch(() => undefined); }
  });
  await page.goto("/");
  await expect(page.getByTestId("landing-screen")).toBeVisible();
  await page.getByTestId("go-create-store").click();
  await page.getByTestId("store-name-input").fill(`G2b Race ${label}`);
  await expect(page.getByTestId("seed-demo-checkbox")).not.toBeChecked();
  await page.getByTestId("key-loss-acknowledgement").check();
  await page.getByTestId("create-store-button").click();
  await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 20_000 });
  if (!identity) fail("BOOTSTRAP_UNOBSERVED");
  const storeKey = (await page.getByTestId("result-store-key").textContent())?.trim() ?? "";
  if (!/^\d{4,}-[A-Z0-9]+$/.test(storeKey)) fail("STORE_KEY_SHAPE_INVALID");
  await page.getByTestId("acknowledge-store-key").click();
  await expect(page.getByTestId("passcode-screen")).toBeVisible();
  return { identity, storeKey };
}

async function pairDevice(page: Page, storeKey: string) {
  await page.goto("/");
  await expect(page.getByTestId("landing-screen")).toBeVisible();
  await page.getByTestId("go-store-pairing").click();
  await page.getByTestId("store-key-input").fill(storeKey);
  await page.getByTestId("go-passcode").click();
  await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
}

async function enterPin(page: Page, ownerId: string, pin: string) {
  await page.getByTestId(`employee-${ownerId}`).click();
  for (const digit of pin) await page.getByTestId(`pin-${digit}`).click();
  await page.getByTestId("unlock-button").click();
}

async function newDevice(browser: Browser): Promise<Device> {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:5180", viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const device: Device = { page, rpcNames: [], starts: [], bearer: null, restrictedToken: null };
  await page.addInitScript(() => {
    let calls = 0;
    window.print = () => { calls += 1; };
    Object.defineProperty(window, "__pinRacePrintCalls", { get: () => calls });
  });
  page.on("request", request => {
    const match = request.url().match(/\/rest\/v1\/rpc\/([^?]+)/);
    if (match) device.rpcNames.push(match[1]);
  });
  await page.route("**/rest/v1/rpc/permission_start_session", async route => {
    try {
      const bearer = await route.request().headerValue("authorization");
      if (!bearer || !/^Bearer [A-Za-z0-9._-]+$/.test(bearer)) fail("BEARER_INVALID");
      device.bearer ??= bearer;
      const response = await route.fetch({ timeout: 20_000 });
      if (!response.ok()) fail("LOGIN_HTTP_FAILED");
      const start = parseStart(await jsonObject(response));
      device.starts.push(start);
      if (start.kind === "required_pin_change") device.restrictedToken = start.token;
      await route.fulfill({ response });
    } catch { await route.abort("failed").catch(() => undefined); }
  });
  return device;
}

async function prepareRestricted(device: Device, identity: Identity) {
  await enterPin(device.page, identity.ownerId, TEMP_PIN);
  await expect(device.page.getByTestId("required-pin-change-screen")).toBeVisible();
  await expect(device.page.getByTestId("complete-required-pin")).toBeEnabled({ timeout: 10_000 });
  const start = device.starts.at(-1);
  if (start?.kind !== "required_pin_change" || start.ttlMs !== 300_000 || !start.token
    || !device.bearer || start.revision === null) fail("RESTRICTED_LOGIN_INVALID");
}

class CompletionGate {
  private readonly seen = deferred<Captured | null>();
  private readonly forwarded = deferred<RouteOutcome>();
  private readonly settled = deferred<"SETTLED" | "FAILED">();
  private readonly go = deferred<void>();
  private readonly ack = deferred<void>();
  private capture: Captured | null = null;
  private count = 0;
  private closed = false;
  constructor(private readonly device: Device, private readonly expectedPin: string,
    private readonly expectedRevision: number) {}
  async install() {
    await this.device.page.route("**/rest/v1/rpc/permission_complete_required_pin_change", async route => {
      this.count += 1;
      let routeFailed = false;
      try {
        if (this.count !== 1) fail("UI_COMPLETION_REPLAYED");
        const body = route.request().postDataJSON() as RequestBody;
        const employeeToken = await route.request().headerValue("x-pos-employee-token");
        if (!employeeToken || !uuid(body?.p_request?.requestId) || body.p_request.expectedRevision !== this.expectedRevision
          || body.p_request.newPin !== this.expectedPin || employeeToken !== this.device.restrictedToken)
          fail("COMPLETION_REQUEST_INVALID");
        this.capture = { body, token: employeeToken };
        this.seen.resolve(this.capture);
        await this.go.promise;
        const response = await route.fetch({ timeout: 75_000 });
        const value = await jsonObject(response);
        const data = value.data as Record<string, unknown> | undefined;
        const code: RouteOutcome["code"] = response.ok() && value.ok === true && value.outcome === "applied"
          && data?.credentialChanged === true && data.pinChangeRequired === false
          && data.employeeRevision === this.expectedRevision + 1 ? "APPLIED"
          : response.ok() && value.ok === false
            && (value.error as Record<string, unknown> | undefined)?.code === "EMPLOYEE_SESSION_REQUIRED"
            ? "SESSION_REQUIRED" : "ROUTE_FAILED";
        this.forwarded.resolve({ code });
        await this.ack.promise;
        await route.fulfill({ response });
      } catch {
        routeFailed = true;
        this.seen.resolve(null);
        this.forwarded.resolve({ code: "ROUTE_FAILED" });
        await route.abort("failed").catch(() => undefined);
      } finally {
        this.settled.resolve(routeFailed ? "FAILED" : "SETTLED");
      }
    });
  }
  request() { return this.capture; }
  async waitSeen() { const value = await bounded(this.seen.promise, "COMPLETION_NOT_INTERCEPTED");
    if (!value) fail("COMPLETION_CAPTURE_FAILED"); return value; }
  forward() { this.go.resolve(); }
  async waitForwarded(expected: RouteOutcome["code"]) {
    const result = await bounded(this.forwarded.promise, "COMPLETION_RESPONSE_TIMEOUT", 80_000);
    if (result.code !== expected) fail("COMPLETION_RESPONSE_INVALID");
  }
  releaseAck() { this.ack.resolve(); }
  async cleanup() {
    if (this.closed) return;
    this.closed = true;
    this.go.resolve(); this.ack.resolve();
    if (this.count > 0) {
      const outcome = await bounded(this.settled.promise, "CLEANUP_ROUTE_TIMEOUT", 80_000);
      if (outcome !== "SETTLED" || this.count !== 1) fail("CLEANUP_ROUTE_FAILED");
    }
  }
  uiCount() { return this.count; }
}

async function submit(device: Device, pin: string) {
  await device.page.getByTestId("required-new-pin").fill(pin);
  await device.page.getByTestId("required-confirm-pin").fill(pin);
  await expect(device.page.getByTestId("complete-required-pin")).toBeEnabled();
  await device.page.getByTestId("complete-required-pin").click();
}

async function rpc(name: string, bearer: string, body: Record<string, unknown>, employeeToken?: string) {
  try {
    const response = await fetch(`${env.api}/rest/v1/rpc/${name}`, { method: "POST", headers: {
      apikey: env.anonKey, authorization: bearer, "x-pos-permission-contract": "2",
      "Content-Type": "application/json", ...(employeeToken ? { "x-pos-employee-token": employeeToken } : {}),
    }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
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
    if (result.rowCount !== 1 || result.rows[0].status !== "pending") fail("PENDING_K_FIXTURE_FAILED");
    return operationId;
  } catch { return fail("PENDING_K_FIXTURE_FAILED"); }
}

async function assertPendingK(db: pg.Client, identity: Identity, operationId: string) {
  try {
    const row = (await db.query(`select
      (select count(*)::int from public.write_operations w where w.store_id=$1::uuid and w.operation_id=$2::uuid
        and w.status='pending' and w.result is null and w.error is null and w.decided_at is null) pending,
      (select count(*)::int from public.order_events e where e.store_id=$1::uuid) events,
      (select count(*)::int from public.orders o where o.store_id=$1::uuid) orders,
      (select count(*)::int from public.payments p where p.store_id=$1::uuid) payments`,
      [identity.storeId, operationId])).rows[0];
    expect(row).toEqual({ pending: 1, events: 0, orders: 0, payments: 0 });
  } catch { fail("PENDING_K_CHANGED"); }
}

async function snapshot(db: pg.Client, identity: Identity, credentialBaseline: PinAckCredentialBaseline,
  requestId: string, newPin: string, oldTokens: string[]) {
  return capturePinAckSnapshot(db, { storeId: identity.storeId, ownerId: identity.ownerId,
    requestId, tempPin: TEMP_PIN, newPin, oldTokens, baseline: credentialBaseline });
}

async function assertTotals(db: pg.Client, identity: Identity, winnerRequest: string, loserRequest: string,
  expected: { audits: number; receipts: number; signalEventWinner: boolean; signalEventLoser: boolean }) {
  try {
    const row = (await db.query(`select
      (select count(*)::int from public.employee_admin_audit a where a.store_id=$1::uuid
        and a.kind='complete_required_pin_change') audits,
      (select count(*)::int from private.employee_admin_requests r where r.store_id=$1::uuid
        and r.kind='complete_required_pin_change') receipts,
      (select exists(select 1 from public.store_change_signals s where s.store_id=$1::uuid
        and s.topic='permission' and s.event_id=$2::uuid and s.target_id=$4::uuid)) signal_event_winner,
      (select exists(select 1 from public.store_change_signals s where s.store_id=$1::uuid
        and s.topic='permission' and s.event_id=$3::uuid)) signal_event_loser`,
      [identity.storeId, winnerRequest, loserRequest, identity.ownerId])).rows[0];
    expect(row).toEqual({ audits: expected.audits, receipts: expected.receipts,
      signal_event_winner: expected.signalEventWinner, signal_event_loser: expected.signalEventLoser });
  } catch { fail("EFFECT_TOTALS_INVALID"); }
}

async function assertNoProtected(device: Device, forcedAllowed = false) {
  await expect(device.page.getByTestId("floor-view")).toHaveCount(0);
  await expect(device.page.getByTestId("receipt-preview")).toHaveCount(0);
  if (!forcedAllowed) await expect(device.page.getByTestId("required-pin-change-screen")).toHaveCount(0);
  for (const id of ["nav-employees", "nav-menu-editor", "nav-floor-editor", "nav-report", "nav-settings"])
    await expect(device.page.getByTestId(id)).toHaveCount(0);
  expect(device.rpcNames.some(name => PROTECTED.has(name) || FINANCIAL.test(name))).toBe(false);
  expect(await device.page.evaluate(() => (window as Window & { __pinRacePrintCalls?: number }).__pinRacePrintCalls)).toBe(0);
}

async function assertNoAutomaticFinancial(device: Device) {
  await device.page.evaluate(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
  expect(device.rpcNames.some(name => FINANCIAL.test(name))).toBe(false);
  expect(await device.page.evaluate(() => (window as Window & { __pinRacePrintCalls?: number }).__pinRacePrintCalls)).toBe(0);
}

async function assertNotice(device: Device, notice: string, gate: CompletionGate) {
  await expect(device.page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
  await expect(device.page.getByTestId("session-notice")).toHaveText(notice);
  await assertNoProtected(device);
  await device.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await device.page.context().setOffline(true);
  await expect.poll(() => device.page.evaluate(() => navigator.onLine)).toBe(false);
  await device.page.context().setOffline(false);
  await expect.poll(() => device.page.evaluate(() => navigator.onLine)).toBe(true);
  await device.page.evaluate(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
  await assertNoProtected(device);
  expect(gate.uiCount()).toBe(1);
}

async function assertNormalLogin(device: Device, identity: Identity, baseline: PinAckObservation,
  loserPin: string, winnerPin: string) {
  await enterPin(device.page, identity.ownerId, TEMP_PIN);
  await expect(device.page.getByText("PIN không đúng. Vui lòng thử lại.", { exact: true })).toBeVisible();
  expect(device.starts.at(-1)?.errorCode).toBe("INVALID_PIN");
  await enterPin(device.page, identity.ownerId, loserPin);
  await expect(device.page.getByText("PIN không đúng. Vui lòng thử lại.", { exact: true })).toBeVisible();
  expect(device.starts.at(-1)?.errorCode).toBe("INVALID_PIN");
  await assertNoProtected(device);
  await enterPin(device.page, identity.ownerId, winnerPin);
  await expect(device.page.getByTestId("permission-verification-gate")).toHaveCount(0, { timeout: 15_000 });
  await expect(device.page.getByTestId("floor-view")).toBeVisible({ timeout: 15_000 });
  const start = device.starts.at(-1);
  expect(start?.kind).toBe("normal");
  expect(start?.ttlMs).toBe(43_200_000);
  expect(start?.authority?.storeId === identity.storeId).toBe(true);
  expect(start?.authority?.employeeId === identity.ownerId).toBe(true);
  expect(start?.authority?.employeeRevision).toBe(baseline.revision + 1);
  await assertNoAutomaticFinancial(device);
}

async function runOrdering(browser: Browser, db: pg.Client, controllerDb: pg.Client,
  observerDb: pg.Client, winnerLabel: "A" | "B") {
  let a: Device | undefined;
  let b: Device | undefined;
  let winnerGate: CompletionGate | undefined;
  let loserGate: CompletionGate | undefined;
  let barrier: Awaited<ReturnType<typeof beginPinRaceOwnerBarrier>> | undefined;
  let primaryFailure: unknown;
  try {
    a = await newDevice(browser);
    b = await newDevice(browser);
    mark("CREATE_STORE");
    const { identity, storeKey } = await createStore(a.page, winnerLabel);
    await pairDevice(b.page, storeKey);
    const pendingK = await installPendingK(db, identity);
    mark("TWO_RESTRICTED_CONTEXTS");
    await prepareRestricted(a, identity);
    await prepareRestricted(b, identity);
    if (!a.restrictedToken || !b.restrictedToken || a.restrictedToken === b.restrictedToken
      || a.starts.at(-1)?.revision !== b.starts.at(-1)?.revision) fail("TWO_SESSIONS_INVALID");
    const revision = a.starts.at(-1)?.revision;
    if (revision === null || revision === undefined) fail("BASELINE_REVISION_INVALID");
    const oldTokens = [a.restrictedToken, b.restrictedToken];
    const credentialBaseline = await capturePinAckCredentialBaseline(db, identity.storeId, identity.ownerId);
    const baseline = await snapshot(db, identity, credentialBaseline, randomUUID(), PIN_A, oldTokens);
    expect(baseline.credentialHashMatchesBaseline).toBe(true);
    expect(baseline.credentialMatchesTemporary).toBe(true);
    expect(baseline.credentialMatchesNew).toBe(false);
    expect(baseline.requiresPinChange).toBe(true);
    expect(baseline.revision).toBe(revision);
    expect(baseline.sessionTotal).toBe(2);
    expect(baseline.sessionActive).toBe(2);
    expect(baseline.observedOldTokens).toBe(2);
    expect(baseline.unrevokedOldTokens).toBe(2);
    await assertPendingK(db, identity, pendingK);
    // Clear only monitored requests after setup; both devices are proof-ready.
    a.rpcNames.length = 0; b.rpcNames.length = 0;
    await assertNoProtected(a, true);
    await assertNoProtected(b, true);
    const winner = winnerLabel === "A" ? a : b;
    const loser = winnerLabel === "A" ? b : a;
    const winnerPin = winnerLabel === "A" ? PIN_A : PIN_B;
    const loserPin = winnerLabel === "A" ? PIN_B : PIN_A;
    winnerGate = new CompletionGate(winner, winnerPin, revision);
    loserGate = new CompletionGate(loser, loserPin, revision);
    await winnerGate.install(); await loserGate.install();
    await submit(a, PIN_A); await submit(b, PIN_B);
    const winnerCaptured = await winnerGate.waitSeen();
    const loserCaptured = await loserGate.waitSeen();
    expect(winnerCaptured.body.p_request.requestId === loserCaptured.body.p_request.requestId).toBe(false);
    mark("BOTH_UI_REQUESTS_CAPTURED");
    barrier = await beginPinRaceOwnerBarrier(controllerDb, identity.storeId, identity.ownerId);
    winnerGate.forward();
    const winnerGraph = await waitForPinRaceGraph(observerDb, { storeId: identity.storeId,
      ownerId: identity.ownerId, expectedRevision: revision,
      controllerPid: barrier.controllerPid, phase: "winner", deadlineMs: 15_000 });
    expect(winnerGraph.holderCount).toBe(1);
    expect(winnerGraph.waiterCount).toBe(0);
    expect(winnerGraph.winnerBlockedByController).toBe(true);
    mark("WINNER_DB_WAIT_CONFIRMED");
    loserGate.forward();
    const bothGraph = await waitForPinRaceGraph(observerDb, { storeId: identity.storeId,
      ownerId: identity.ownerId, expectedRevision: revision,
      controllerPid: barrier.controllerPid, phase: "both",
      expectedWinnerPid: winnerGraph.winnerPid, deadlineMs: 15_000 });
    expect(bothGraph.holderCount).toBe(1);
    expect(bothGraph.waiterCount).toBe(1);
    expect(bothGraph.loserBlockedByWinner).toBe(true);
    mark("BOTH_DB_WAITS_CONFIRMED");
    const preWinner = await snapshot(db, identity, credentialBaseline, winnerCaptured.body.p_request.requestId,
      winnerPin, oldTokens);
    const preLoser = await snapshot(db, identity, credentialBaseline, loserCaptured.body.p_request.requestId,
      loserPin, oldTokens);
    expect(preWinner).toEqual({ ...baseline, credentialMatchesNew: false });
    expect(preLoser).toEqual({ ...baseline, credentialMatchesNew: false });
    await assertTotals(db, identity, winnerCaptured.body.p_request.requestId,
      loserCaptured.body.p_request.requestId,
      { audits: 0, receipts: 0, signalEventWinner: false, signalEventLoser: false });
    await assertPendingK(db, identity, pendingK);
    mark("PRE_RELEASE_MVCC_UNCHANGED");
    await barrier.release(); barrier = undefined;
    await winnerGate.waitForwarded("APPLIED");
    const afterWinner = await snapshot(db, identity, credentialBaseline,
      winnerCaptured.body.p_request.requestId, winnerPin, oldTokens);
    expect(afterWinner.credentialHashMatchesBaseline).toBe(false);
    expect(afterWinner.credentialMatchesTemporary).toBe(false);
    expect(afterWinner.credentialMatchesNew).toBe(true);
    expect(afterWinner.requiresPinChange).toBe(false);
    expect(afterWinner.revision).toBe(baseline.revision + 1);
    expect(afterWinner.sessionTotal).toBe(baseline.sessionTotal);
    expect(afterWinner.sessionActive).toBe(0);
    expect(afterWinner.sessionRevoked).toBe(2);
    expect(afterWinner.observedOldTokens).toBe(2);
    expect(afterWinner.unrevokedOldTokens).toBe(0);
    expect(afterWinner.auditCount).toBe(1);
    expect(afterWinner.auditAppliedCount).toBe(1);
    expect(afterWinner.signalCount).toBe(1);
    expect(afterWinner.signalRevision).toBe(baseline.signalRevision + 1);
    expect(afterWinner.signalTargetMatches).toBe(true);
    expect(afterWinner.requestCount).toBe(1);
    expect(afterWinner.requestAppliedCount).toBe(1);
    await loserGate.waitForwarded("SESSION_REQUIRED");
    const afterLoser = await snapshot(db, identity, credentialBaseline,
      loserCaptured.body.p_request.requestId, loserPin, oldTokens);
    expect(afterLoser.credentialHashMatchesBaseline).toBe(false);
    expect(afterLoser.credentialMatchesTemporary).toBe(false);
    expect(afterLoser.credentialMatchesNew).toBe(false);
    expect(afterLoser.requiresPinChange).toBe(false);
    expect(afterLoser.revision).toBe(afterWinner.revision);
    expect(afterLoser.sessionTotal).toBe(afterWinner.sessionTotal);
    expect(afterLoser.sessionActive).toBe(0);
    expect(afterLoser.sessionRevoked).toBe(afterWinner.sessionRevoked);
    expect(afterLoser.observedOldTokens).toBe(2);
    expect(afterLoser.unrevokedOldTokens).toBe(0);
    expect(afterLoser.auditCount).toBe(0);
    expect(afterLoser.auditAppliedCount).toBe(0);
    expect(afterLoser.requestCount).toBe(0);
    expect(afterLoser.requestAppliedCount).toBe(0);
    expect(afterLoser.signalCount).toBe(0);
    expect(afterLoser.signalRevision).toBe(afterWinner.signalRevision);
    expect(afterLoser.signalTargetMatches).toBe(false);
    await assertTotals(db, identity, winnerCaptured.body.p_request.requestId,
      loserCaptured.body.p_request.requestId,
      { audits: 1, receipts: 1, signalEventWinner: true, signalEventLoser: false });
    await assertPendingK(db, identity, pendingK);
    mark("COMMIT_AND_LOSER_DENIAL_CONFIRMED");
    loserGate.releaseAck();
    await assertNotice(loser, LOSE_NOTICE, loserGate);
    // Winner ACK remains held while the loser has already returned to login.
    await expect(winner.page.getByTestId("required-pin-change-screen")).toBeVisible();
    await expect(winner.page.getByTestId("passcode-screen")).toHaveCount(0);
    winnerGate.releaseAck();
    await assertNotice(winner, WIN_NOTICE, winnerGate);
    mark("UI_ACK_ORDER_CONFIRMED");
    for (const device of [a, b]) {
      const gate = device === winner ? winnerGate : loserGate;
      const original = gate.request();
      if (!original || !device.bearer) fail("REPLAY_INPUT_MISSING");
      const replay = await rpc("permission_complete_required_pin_change", device.bearer,
        original.body, original.token);
      if (replay.ok !== false || (replay.error as Record<string, unknown> | undefined)?.code !== "EMPLOYEE_SESSION_REQUIRED")
        fail("OLD_TOKEN_REPLAY_NOT_DENIED");
    }
    const afterReplay = await snapshot(db, identity, credentialBaseline,
      winnerCaptured.body.p_request.requestId, winnerPin, oldTokens);
    expect(afterReplay).toEqual(afterWinner);
    await assertTotals(db, identity, winnerCaptured.body.p_request.requestId,
      loserCaptured.body.p_request.requestId,
      { audits: 1, receipts: 1, signalEventWinner: true, signalEventLoser: false });
    await assertPendingK(db, identity, pendingK);
    mark("OLD_TOKENS_DENIED");
    await assertNormalLogin(a, identity, baseline, loserPin, winnerPin);
    await assertNormalLogin(b, identity, baseline, loserPin, winnerPin);
    await assertPendingK(db, identity, pendingK);
    expect(winnerGate.uiCount()).toBe(1);
    expect(loserGate.uiCount()).toBe(1);
    mark("TWO_FRESH_AUTHORITIES_VERIFIED");
  } catch { primaryFailure = new Error("PIN_RACE_CASE_FAILED"); }
  finally {
    let cleanupFailed = false;
    if (barrier) { try { await barrier.rollback(); } catch { cleanupFailed = true; } }
    for (const gate of [winnerGate, loserGate]) if (gate) {
      try { gate.releaseAck(); gate.forward(); await gate.cleanup(); } catch { cleanupFailed = true; }
    }
    for (const device of [a, b]) if (device) {
      try { await device.page.context().close(); } catch { cleanupFailed = true; }
    }
    if (cleanupFailed) primaryFailure = new Error("PIN_RACE_CLEANUP_FAILED");
  }
  if (primaryFailure) throw primaryFailure;
}

test.describe.serial("G2b TC-PIN-08 two real device completion orderings", () => {
  let db: pg.Client;
  let controllerDb: pg.Client;
  let observerDb: pg.Client;
  test.beforeEach(async () => {
    try {
      db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
      controllerDb = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 90_000 });
      observerDb = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
      await db.connect(); await controllerDb.connect(); await observerDb.connect();
      await assertPinRaceTarget(db, env);
    } catch { await Promise.allSettled([db?.end(), controllerDb?.end(), observerDb?.end()]); fail("PREFLIGHT_FAILED"); }
  });
  test.afterEach(async () => {
    const results = await Promise.allSettled([db?.end(), controllerDb?.end(), observerDb?.end()]);
    if (results.some(result => result.status === "rejected")) fail("DB_CLEANUP_FAILED");
  });
  test("A wins, B loses after both REST requests enter PostgreSQL", async ({ browser }) => {
    await runOrdering(browser, db, controllerDb, observerDb, "A");
  });
  test("B wins, A loses after both REST requests enter PostgreSQL", async ({ browser }) => {
    await runOrdering(browser, db, controllerDb, observerDb, "B");
  });
});
