import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";
import pg from "pg";
import { assertPinAckTarget, pinAckEnvironment } from "./permissionPinAckEnvironment.ts";
import { capturePinAckCredentialBaseline, capturePinAckSnapshot,
  type PinAckCredentialBaseline, type PinAckObservation } from "./permissionPinAckObserver.ts";

const env = pinAckEnvironment();
const TEMP_PIN = "123456";
const NEW_PIN = "384729";
const LOST_ACK = "Chưa xác nhận được việc đổi PIN. Vui lòng đăng nhập lại bằng PIN mới; nếu chưa được, thử lại bằng PIN tạm.";
const PROTECTED_BEFORE_LOGIN = new Set([
  "permission_get_authority", "permission_get_revision", "permission_get_initial_seed_status",
  "permission_begin_initial_seed", "permission_run_initial_seed_stage", "permission_get_menu_catalog",
  "permission_get_floor_workspace", "permission_get_settings_admin", "permission_admin_list",
  "register_write_operation", "execute_write_operation", "get_write_operation", "list_write_operations",
  "cancel_write_operation", "authorize_initial_receipt_print", "prepare_receipt_reprint",
]);

type BootstrapIdentity = { storeId: string; ownerId: string };
type StartResult = { kind: string | null; errorCode: string | null; token: string | null; ttlMs: number | null;
  authority: { storeId: string; employeeId: string; employeeRevision: number } | null };
type CompleteRequest = { p_request: { requestId: string; expectedRevision: number; newPin: string } };
type CaseContext = {
  db: pg.Client;
  identity: BootstrapIdentity;
  pendingK: string;
  bearer: string;
  starts: StartResult[];
  uiToken: string;
  secondToken: string;
  rpcNames: string[];
  credentialBaseline: PinAckCredentialBaseline;
  baseline: PinAckObservation;
};

function fail(code: string): never { throw new Error(code); }
function phase(code: string) { test.info().annotations.push({ type: "pin-ack-phase", description: `PIN_ACK_PHASE_${code}` }); }
function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function token(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value); }

async function jsonResponse(response: { json(): Promise<unknown> }): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) fail("PIN_ACK_RESPONSE_SHAPE_INVALID");
    return value as Record<string, unknown>;
  } catch { return fail("PIN_ACK_RESPONSE_JSON_INVALID"); }
}

function parseStart(value: Record<string, unknown>): StartResult {
  if (value.ok === false) {
    const error = value.error as Record<string, unknown> | undefined;
    if (typeof error?.code !== "string" || !/^[A-Z_]+$/.test(error.code)) fail("PIN_ACK_LOGIN_ERROR_SHAPE_INVALID");
    return { kind: null, errorCode: error.code, token: null, ttlMs: null, authority: null };
  }
  if (value.ok !== true || !["required_pin_change", "normal"].includes(String(value.kind)) || !token(value.token)
    || typeof value.issuedAt !== "string" || typeof value.expiresAt !== "string") fail("PIN_ACK_LOGIN_RESPONSE_SHAPE_INVALID");
  const ttlMs = Date.parse(value.expiresAt as string) - Date.parse(value.issuedAt as string);
  if (!Number.isFinite(ttlMs)) fail("PIN_ACK_LOGIN_TTL_INVALID");
  let authority: StartResult["authority"] = null;
  if (value.kind === "normal") {
    const bundle = value.authority as Record<string, unknown> | undefined;
    const snapshot = bundle?.snapshot as Record<string, unknown> | undefined;
    const catalog = bundle?.catalog as Record<string, unknown> | undefined;
    if (!uuid(snapshot?.storeId) || !uuid(snapshot?.employeeId) || snapshot?.role !== "owner"
      || snapshot?.active !== true || typeof snapshot?.employeeRevision !== "number" || !Number.isSafeInteger(snapshot.employeeRevision)
      || typeof snapshot?.catalogRevision !== "number" || !Number.isSafeInteger(snapshot.catalogRevision)
      || catalog?.revision !== snapshot.catalogRevision)
      fail("PIN_ACK_INLINE_AUTHORITY_INVALID");
    authority = { storeId: snapshot.storeId, employeeId: snapshot.employeeId,
      employeeRevision: snapshot.employeeRevision as number };
  }
  return { kind: value.kind as string, errorCode: null, token: value.token as string, ttlMs, authority };
}

async function rpc(name: string, bearer: string, body: Record<string, unknown>, employeeToken?: string) {
  try {
    const response = await fetch(`${env.api}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: env.anonKey,
        authorization: bearer,
        "x-pos-permission-contract": "2",
        "Content-Type": "application/json",
        ...(employeeToken ? { "x-pos-employee-token": employeeToken } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) fail("PIN_ACK_DIRECT_RPC_HTTP_FAILED");
    return await jsonResponse(response);
  } catch { return fail("PIN_ACK_DIRECT_RPC_FAILED"); }
}

async function createStoreFromUi(page: Page, caseName: "A" | "B"): Promise<BootstrapIdentity> {
  const capture: { identity?: BootstrapIdentity } = {};
  await page.route("**/rest/v1/rpc/permission_bootstrap_store", async route => {
    const response = await route.fetch();
    if (!response.ok()) fail("PIN_ACK_BOOTSTRAP_HTTP_FAILED");
    const value = await jsonResponse(response);
    const data = value.data as Record<string, unknown> | undefined;
    if (value.ok !== true || !uuid(data?.storeId) || !uuid(data?.ownerId) || data?.seedRequested !== false)
      fail("PIN_ACK_BOOTSTRAP_SHAPE_INVALID");
    capture.identity = { storeId: data.storeId, ownerId: data.ownerId };
    await route.fulfill({ response });
  });
  await page.goto("/");
  await expect(page.getByTestId("landing-screen")).toBeVisible();
  await page.getByTestId("go-create-store").click();
  await expect(page.getByTestId("create-store-screen")).toBeVisible();
  await page.getByTestId("store-name-input").fill(`G2a ACK ${caseName}`);
  await expect(page.getByTestId("seed-demo-checkbox")).not.toBeChecked();
  await page.getByTestId("key-loss-acknowledgement").check();
  await page.getByTestId("create-store-button").click();
  await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 20_000 });
  if (!capture.identity) fail("PIN_ACK_BOOTSTRAP_NOT_OBSERVED");
  await page.getByTestId("acknowledge-store-key").click();
  await expect(page.getByTestId("passcode-screen")).toBeVisible();
  return capture.identity;
}

async function clickPin(page: Page, ownerId: string, pinValue: string) {
  await page.getByTestId(`employee-${ownerId}`).click();
  for (const digit of pinValue) await page.getByTestId(`pin-${digit}`).click();
  await page.getByTestId("unlock-button").click();
}

// A synthetic, schema-validated pending operation represents work left by an
// earlier normal session. A newly bootstrapped owner is already restricted and
// cannot register it through the current app path.
async function installPendingK(db: pg.Client, identity: BootstrapIdentity): Promise<string> {
  const operationId = randomUUID();
  const payload = { schemaVersion: 1, kind: "pay_order", orderId: randomUUID(), paymentId: randomUUID(),
    expectedVersion: 0, method: "cash", receivedAmount: 50000 };
  const result = await db.query(`with fixed as (select private.write_clock() at_time)
    insert into public.write_operations
    (store_id,operation_id,schema_version,kind,required_permission,payload,registered_at,expires_at,initiated_by_employee_id)
    select $1::uuid,$2::uuid,1,'pay_order','payment.take',$3::jsonb,fixed.at_time,fixed.at_time+interval '24 hours',$4::uuid from fixed
    returning status`, [identity.storeId, operationId, JSON.stringify(payload), identity.ownerId]);
  if (result.rowCount !== 1 || result.rows[0].status !== "pending") fail("PIN_ACK_PENDING_K_FIXTURE_FAILED");
  return operationId;
}

async function assertPendingKUnchanged(context: CaseContext) {
  const result = (await context.db.query(`select
    (select count(*)::int from public.write_operations w where w.store_id=$1::uuid and w.operation_id=$2::uuid
      and w.status='pending' and w.result is null and w.error is null and w.decided_at is null) pending,
    (select count(*)::int from public.order_events e where e.store_id=$1::uuid and e.operation_id=$2::uuid) events,
    (select count(*)::int from public.payments p where p.store_id=$1::uuid) payments`,
    [context.identity.storeId, context.pendingK])).rows[0];
  expect(result).toEqual({ pending: 1, events: 0, payments: 0 });
}

async function prepareCase(page: Page, db: pg.Client, caseName: "A" | "B"): Promise<CaseContext> {
  phase("CREATE_STORE");
  const rpcNames: string[] = [];
  page.on("request", request => {
    const match = request.url().match(/\/rest\/v1\/rpc\/([^?]+)/);
    if (match) rpcNames.push(match[1]);
  });
  await page.addInitScript(() => {
    let calls = 0;
    window.print = () => { calls += 1; };
    Object.defineProperty(window, "__pinAckPrintCalls", { get: () => calls });
  });
  const identity = await createStoreFromUi(page, caseName);
  const pendingK = await installPendingK(db, identity);
  phase("RESTRICTED_LOGIN");
  const starts: StartResult[] = [];
  const authCapture: { bearer?: string } = {};
  await page.route("**/rest/v1/rpc/permission_start_session", async route => {
    authCapture.bearer ??= (await route.request().headerValue("authorization")) ?? undefined;
    if (typeof authCapture.bearer !== "string" || !/^Bearer [A-Za-z0-9._-]+$/.test(authCapture.bearer))
      fail("PIN_ACK_STORE_BEARER_INVALID");
    const response = await route.fetch();
    if (!response.ok()) fail("PIN_ACK_LOGIN_HTTP_FAILED");
    starts.push(parseStart(await jsonResponse(response)));
    await route.fulfill({ response });
  });
  await clickPin(page, identity.ownerId, TEMP_PIN);
  await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
  await expect(page.getByTestId("complete-required-pin")).toBeEnabled({ timeout: 10_000 });
  const bearer = authCapture.bearer;
  if (!bearer || starts.length !== 1 || starts[0].kind !== "required_pin_change" || starts[0].ttlMs !== 300_000
    || !starts[0].token) fail("PIN_ACK_FIRST_RESTRICTED_LOGIN_INVALID");
  const uiToken = starts[0].token;
  const second = parseStart(await rpc("permission_start_session", bearer, { p_employee_id: identity.ownerId, p_pin: TEMP_PIN }));
  if (second.kind !== "required_pin_change" || second.ttlMs !== 300_000 || !second.token || second.token === uiToken)
    fail("PIN_ACK_SECOND_RESTRICTED_LOGIN_INVALID");
  const secondToken = second.token;
  const credentialBaseline = await capturePinAckCredentialBaseline(db, identity.storeId, identity.ownerId);
  const baseline = await capturePinAckSnapshot(db, {
    storeId: identity.storeId, ownerId: identity.ownerId, requestId: randomUUID(),
    tempPin: TEMP_PIN, newPin: NEW_PIN, oldTokens: [uiToken, secondToken], baseline: credentialBaseline,
  });
  expect(baseline.credentialHashMatchesBaseline).toBe(true);
  expect(baseline.credentialMatchesTemporary).toBe(true);
  expect(baseline.credentialMatchesNew).toBe(false);
  expect(baseline.requiresPinChange).toBe(true);
  expect(baseline.sessionTotal).toBe(2);
  expect(baseline.sessionActive).toBe(2);
  expect(baseline.observedOldTokens).toBe(2);
  expect(baseline.unrevokedOldTokens).toBe(2);
  expect(baseline.auditCount).toBe(0);
  expect(baseline.requestCount).toBe(0);
  expect(baseline.signalCount).toBe(0);
  await assertNoProtectedUi(page, rpcNames);
  phase("READY_TO_COMPLETE");
  rpcNames.length = 0;
  const context = { db, identity, pendingK, bearer, starts, uiToken, secondToken, rpcNames, credentialBaseline, baseline };
  await assertPendingKUnchanged(context);
  return context;
}

function snapshotFor(context: CaseContext, requestId: string) {
  return capturePinAckSnapshot(context.db, {
    storeId: context.identity.storeId, ownerId: context.identity.ownerId, requestId,
    tempPin: TEMP_PIN, newPin: NEW_PIN, oldTokens: [context.uiToken, context.secondToken],
    baseline: context.credentialBaseline,
  });
}

function assertCommitted(before: PinAckObservation, after: PinAckObservation) {
  expect(after.credentialHashMatchesBaseline).toBe(false);
  expect(after.credentialMatchesTemporary).toBe(false);
  expect(after.credentialMatchesNew).toBe(true);
  expect(after.requiresPinChange).toBe(false);
  expect(after.revision).toBe(before.revision + 1);
  expect(after.sessionTotal).toBe(before.sessionTotal);
  expect(after.sessionActive).toBe(0);
  expect(after.sessionRevoked).toBe(before.sessionTotal);
  expect(after.observedOldTokens).toBe(2);
  expect(after.unrevokedOldTokens).toBe(0);
  expect(after.auditCount).toBe(1);
  expect(after.auditAppliedCount).toBe(1);
  expect(after.signalCount).toBe(1);
  expect(after.signalRevision).toBe(before.signalRevision + 1);
  expect(after.signalTargetMatches).toBe(true);
  expect(after.requestCount).toBe(1);
  expect(after.requestAppliedCount).toBe(1);
}

async function assertNoProtectedUi(page: Page, rpcNames: string[]) {
  await expect(page.getByTestId("floor-view")).toHaveCount(0);
  await expect(page.getByTestId("receipt-preview")).toHaveCount(0);
  for (const id of ["nav-employees", "nav-menu-editor", "nav-floor-editor", "nav-report", "nav-settings"])
    await expect(page.getByTestId(id)).toHaveCount(0);
  expect(rpcNames.some(name => PROTECTED_BEFORE_LOGIN.has(name) || /(?:receipt|write_operation|payment|print)/.test(name))).toBe(false);
  const printCalls = await page.evaluate(() => (window as Window & { __pinAckPrintCalls?: number }).__pinAckPrintCalls);
  expect(printCalls).toBe(0);
}

async function assertNoAutomaticFinancialActivity(page: Page, rpcNames: string[]) {
  // The normal shell is now allowed to read its protected workspace. Cross a
  // mounted-effect barrier before checking that none of the pending-K, payment,
  // print, or receipt routes were invoked automatically after login.
  await page.evaluate(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
  const forbidden = new Set(["register_write_operation", "execute_write_operation", "get_write_operation",
    "list_write_operations", "cancel_write_operation", "authorize_initial_receipt_print", "prepare_receipt_reprint"]);
  expect(rpcNames.some(name => forbidden.has(name) || /(?:payment|receipt|print)/.test(name))).toBe(false);
  expect(await page.evaluate(() => (window as Window & { __pinAckPrintCalls?: number }).__pinAckPrintCalls)).toBe(0);
}

async function assertUncertainLogin(page: Page, rpcNames: string[], uiCompletionCount: () => number) {
  await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("session-notice")).toHaveText(LOST_ACK);
  await expect(page.getByTestId("required-pin-change-screen")).toHaveCount(0);
  await assertNoProtectedUi(page, rpcNames);
  // Exercise actual browser connectivity changes, then cross a deterministic
  // browser event-loop barrier. A fixed sleep alone cannot prove no replay.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.context().setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await page.evaluate(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
  await assertNoProtectedUi(page, rpcNames);
  expect(uiCompletionCount()).toBe(1);
}

async function installCompletionDrop(page: Page, context: CaseContext, when: "after-commit" | "before-execute") {
  let uiCompletionCount = 0;
  let captured: CompleteRequest | null = null;
  let atDrop: PinAckObservation | null = null;
  await page.route("**/rest/v1/rpc/permission_complete_required_pin_change", async (route: Route) => {
    uiCompletionCount += 1;
    if (uiCompletionCount !== 1) fail("PIN_ACK_UI_COMPLETION_REPLAYED");
    const body = route.request().postDataJSON() as CompleteRequest;
    if (!uuid(body?.p_request?.requestId) || body.p_request.expectedRevision !== context.baseline.revision
      || body.p_request.newPin !== NEW_PIN) fail("PIN_ACK_COMPLETION_REQUEST_INVALID");
    const header = await route.request().headerValue("x-pos-employee-token");
    if (header !== context.uiToken) fail("PIN_ACK_COMPLETION_TOKEN_MISMATCH");
    captured = body;
    if (when === "after-commit") {
      const response = await route.fetch();
      if (!response.ok()) fail("PIN_ACK_COMPLETION_HTTP_FAILED");
      const value = await jsonResponse(response);
      const data = value.data as Record<string, unknown> | undefined;
      if (value.ok !== true || value.outcome !== "applied" || data?.credentialChanged !== true
        || data?.pinChangeRequired !== false || data?.employeeRevision !== context.baseline.revision + 1)
        fail("PIN_ACK_COMPLETION_RESPONSE_INVALID");
      atDrop = await snapshotFor(context, body.p_request.requestId);
      assertCommitted(context.baseline, atDrop);
    } else {
      atDrop = await snapshotFor(context, body.p_request.requestId);
      expect(atDrop).toEqual(context.baseline);
    }
    await route.abort("failed");
  });
  return {
    uiCompletionCount: () => uiCompletionCount,
    request: () => captured,
    atDrop: () => atDrop,
  };
}

async function submitCompletion(page: Page) {
  await page.getByTestId("required-new-pin").fill(NEW_PIN);
  await page.getByTestId("required-confirm-pin").fill(NEW_PIN);
  await expect(page.getByTestId("complete-required-pin")).toBeEnabled();
  await page.getByTestId("complete-required-pin").click();
}

test.describe.serial("G2a forced completion lost ACK on isolated Auth/REST/browser", () => {
  let db: pg.Client;
  test.beforeEach(async () => {
    db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
    try {
      await db.connect();
      await assertPinAckTarget(db, env);
    } catch { await db.end().catch(() => undefined); fail("PIN_ACK_PREFLIGHT_FAILED"); }
  });
  test.afterEach(async () => { if (db) await db.end().catch(() => undefined); });

  test("TC-PIN-09 A drops completion ACK after independent observer proves commit", async ({ page }) => {
    phase("PREFLIGHT");
    const context = await prepareCase(page, db, "A");
    const drop = await installCompletionDrop(page, context, "after-commit");
    await submitCompletion(page);
    phase("AFTER_SUBMIT");
    await assertUncertainLogin(page, context.rpcNames, drop.uiCompletionCount);
    await assertPendingKUnchanged(context);
    phase("AFTER_UNCERTAIN_LOGIN");
    const original = drop.request();
    if (!original || !drop.atDrop()) fail("PIN_ACK_POSTCOMMIT_DROP_UNOBSERVED");
    const replay = await rpc("permission_complete_required_pin_change", context.bearer, original, context.uiToken);
    if (replay.ok !== false || (replay.error as Record<string, unknown> | undefined)?.code !== "EMPLOYEE_SESSION_REQUIRED")
      fail("PIN_ACK_OLD_TOKEN_REPLAY_NOT_DENIED");
    expect(await snapshotFor(context, original.p_request.requestId)).toEqual(drop.atDrop());
    await assertPendingKUnchanged(context);
    phase("AFTER_REPLAY_PROBE");
    expect(drop.uiCompletionCount()).toBe(1);
    await clickPin(page, context.identity.ownerId, TEMP_PIN);
    await expect(page.getByText("PIN không đúng. Vui lòng thử lại.", { exact: true })).toBeVisible();
    expect(context.starts.at(-1)?.errorCode).toBe("INVALID_PIN");
    await assertNoProtectedUi(page, context.rpcNames);
    phase("AFTER_TEMP_LOGIN");
    await clickPin(page, context.identity.ownerId, NEW_PIN);
    phase("AFTER_NEW_LOGIN");
    await expect(page.getByTestId("permission-verification-gate")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("floor-view")).toBeVisible({ timeout: 15_000 });
    expect(context.starts.at(-1)?.kind).toBe("normal");
    expect(context.starts.at(-1)?.ttlMs).toBe(43_200_000);
    expect(context.starts.at(-1)?.authority).toEqual({ storeId: context.identity.storeId,
      employeeId: context.identity.ownerId, employeeRevision: context.baseline.revision + 1 });
    await assertNoAutomaticFinancialActivity(page, context.rpcNames);
    await assertPendingKUnchanged(context);
    phase("AFTER_PROTECTED_SHELL");
    expect(drop.uiCompletionCount()).toBe(1);
  });

  test("TC-PIN-09 B drops completion before forward and keeps temporary PIN restricted", async ({ page }) => {
    phase("PREFLIGHT");
    const context = await prepareCase(page, db, "B");
    const drop = await installCompletionDrop(page, context, "before-execute");
    await submitCompletion(page);
    phase("AFTER_SUBMIT");
    await assertUncertainLogin(page, context.rpcNames, drop.uiCompletionCount);
    await assertPendingKUnchanged(context);
    phase("AFTER_UNCERTAIN_LOGIN");
    const original = drop.request();
    if (!original || !drop.atDrop()) fail("PIN_ACK_PREEXECUTE_DROP_UNOBSERVED");
    expect(await snapshotFor(context, original.p_request.requestId)).toEqual(context.baseline);
    phase("AFTER_PREEXECUTE_SNAPSHOT");
    await clickPin(page, context.identity.ownerId, NEW_PIN);
    await expect(page.getByText("PIN không đúng. Vui lòng thử lại.", { exact: true })).toBeVisible();
    expect(context.starts.at(-1)?.errorCode).toBe("INVALID_PIN");
    phase("AFTER_NEW_LOGIN_DENIAL");
    expect(await snapshotFor(context, original.p_request.requestId)).toEqual(context.baseline);
    await clickPin(page, context.identity.ownerId, TEMP_PIN);
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    phase("AFTER_TEMP_RESTRICTED_LOGIN");
    await expect(page.getByTestId("complete-required-pin")).toBeEnabled({ timeout: 10_000 });
    expect(context.starts.at(-1)?.kind).toBe("required_pin_change");
    expect(context.starts.at(-1)?.ttlMs).toBe(300_000);
    await assertNoProtectedUi(page, context.rpcNames);
    expect(drop.uiCompletionCount()).toBe(1);
    const afterLogin = await snapshotFor(context, original.p_request.requestId);
    expect(afterLogin.credentialMatchesTemporary).toBe(true);
    expect(afterLogin.credentialHashMatchesBaseline).toBe(true);
    expect(afterLogin.credentialMatchesNew).toBe(false);
    expect(afterLogin.requiresPinChange).toBe(true);
    expect(afterLogin.revision).toBe(context.baseline.revision);
    expect(afterLogin.sessionTotal).toBe(context.baseline.sessionTotal + 1);
    expect(afterLogin.sessionActive).toBe(context.baseline.sessionActive + 1);
    expect(afterLogin.auditCount).toBe(0);
    expect(afterLogin.requestCount).toBe(0);
    expect(afterLogin.signalRevision).toBe(context.baseline.signalRevision);
    await assertPendingKUnchanged(context);
  });
});
