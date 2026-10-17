import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import { SupabaseRealtimePort } from "../../src/adapters/supabase/realtimePort";
import pg from "pg";
import { createOwnerRecoveryServer, createPgRecoveryExecutor, verifyPgRecoveryRole } from "../../scripts/owner-recovery-operator-core.mjs";
import { assertNoCanaryLeaks, readCanaryArtifactFiles, type CanaryCapture, type CanarySink } from "../contracts/permissionCanaryOracle.ts";
import { assertCanaryScenarioMatrix, type CanaryScenario, type CanaryScenarioCapture } from "../contracts/permissionCanaryScenarioMatrix.ts";
import { assertPinOnboardTarget, pinOnboardEnvironment, pinOnboardLocalServiceKey } from "./permissionPinOnboardEnvironment.ts";
import { ownerPinProtectedRoutes } from "../contracts/ownerPinProtectedRoutes";

const TEMP_PIN = "123456";
const NEW_PIN = "654321";
const CREATE_NAME = "Cà phê Owner PIN E2E";
const CREATE_ADDRESS = "12 Nguyễn Huệ";
const STAGES = ["employee", "menu", "floor"] as const;
type Stage = (typeof STAGES)[number];
type DropPoint = "reserve" | "signup" | "bootstrap" | null;

type FixtureState = {
  db: pg.Client;
  originalSequence: { last_value: string; is_called: boolean };
  storeNo?: number;
  storeId?: string;
  foreignAuth?: { id: string; email: string };
  reservationRequestIds: string[];
  tc15MenuFaultInstalled?: boolean;
  pendingK?: string;
  tc03StorageObject?: string;
  additionalStores?: Array<{ storeId: string; storeNo: number }>;
};

type TransportCapture = {
  counts: { reserve: number; signup: number; passwordSignIn: number; bootstrap: number };
  reserveRequestIds: string[];
  signupEmails: string[];
  bootstrapRequests: Record<string, unknown>[];
  signupCredentialStable: boolean;
  passwordSignInCredentialMatchesSignup: boolean;
  signupSecret?: string;
};

const env = pinOnboardEnvironment();
let fixture: FixtureState | undefined;
let tc18Realtime: { client: SupabaseClient; channel: RealtimeChannel } | undefined;
const tc18RuntimeReports: CanaryScenarioCapture[] = [];
// Same replication readiness gate as SupabaseRealtimePort: JOIN alone can
// acknowledge before a freshly restarted tenant's WAL reader is delivering.
const tc18ReplicationReady = { config: { broadcast: { replication_ready: true } } } as unknown as Parameters<SupabaseClient["channel"]>[1];
const tc18ArtifactDirectory = process.env.PIN_CANARY_ARTIFACT_DIR ?? "artifacts/permission-pin-tc18-private";

function registerTc18Canaries(scenario: CanaryScenario | "operator", canaries: string[]) {
  // Control input lives outside runner output. The wrapper consumes and removes
  // it after child exit; it must never be a published artifact or reporter body.
  const path = process.env.PIN_CANARY_CONTROL_FILE;
  if (!path) throw new Error("PIN_CANARY_WRAPPER_REQUIRED");
  try { appendFileSync(path, JSON.stringify({ scenario, canaries }) + '\n'); }
  catch { throw new Error("PIN_CANARY_CONTROL_WRITE_FAILED"); }
}

async function waitForTc18Delivery(db: pg.Client, storeId: string, received: string[], phase: "complete" | "recovery") {
  const started = Date.now(), pulses = new Set<string>();
  while (Date.now() - started < 15_000) {
    const id = randomUUID();
    pulses.add(id);
    // Readiness metadata only. The credential operation below is never retried
    // to warm the transport; the owned fixture cleanup removes these signals.
    await db.query(`insert into public.store_change_signals(store_id,topic,revision,event_id,target_id)
      values($1,'permission',1,$2,null) on conflict(store_id,topic) do update
      set revision=public.store_change_signals.revision+1,event_id=excluded.event_id,target_id=null`, [storeId, id]);
    await new Promise(resolve => setTimeout(resolve, 100));
    if ([...pulses].some(pulse => received.some(frame => frame.includes(pulse)))) {
      mkdirSync(tc18ArtifactDirectory, { recursive: true });
      writeFileSync(join(tc18ArtifactDirectory, `${phase}-realtime-readiness.json`), JSON.stringify({
        status: "PASS", directClientDelivery: true, pulses: pulses.size, elapsedMs: Date.now() - started,
        credentialOperationRetried: false,
      }) + '\n');
      return;
    }
  }
  throw new Error("PIN_CANARY_REALTIME_DELIVERY_NOT_READY");
}

async function captureTc18Scenario(page: Page, scenario: CanaryScenario, canaries: string[], input: {
  realtime: string[]; console: string[]; telemetry: string[]; urls: string[]; messages?: unknown[];
}) {
  registerTc18Canaries(scenario, canaries);
  const state = fixture!;
  const db = state.db;
  const audit = (await db.query("select to_jsonb(a) row from public.employee_admin_audit a order by request_id")).rows;
  const registry = [
    ...(await db.query("select to_jsonb(r) row from private.employee_admin_requests r order by request_id")).rows,
    ...(await db.query("select to_jsonb(b) row from private.bootstrap_requests b order by request_id")).rows,
    ...(await db.query("select to_jsonb(w) row from private.initial_seed_workflows w order by workflow_id")).rows,
    ...(await db.query("select to_jsonb(s) row from private.initial_seed_stages s order by workflow_id,stage")).rows,
  ];
  const signals = (await db.query("select to_jsonb(s) row from public.store_change_signals s order by topic")).rows;
  const browserStorage = await page.evaluate(async () => {
    const databases: unknown[] = [];
    for (const entry of await indexedDB.databases()) {
      if (!entry.name) continue;
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(entry.name!);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const stores: unknown[] = [];
        for (const name of database.objectStoreNames) {
          const values = await new Promise<unknown[]>((resolve, reject) => {
            const rows: unknown[] = [];
            const request = database.transaction(name, "readonly").objectStore(name).openCursor();
            request.onsuccess = () => { const cursor = request.result;
              if (!cursor) { resolve(rows); return; }
              rows.push([cursor.key, cursor.value]); cursor.continue(); };
            request.onerror = () => reject(request.error);
          });
          stores.push([name, values]);
        }
        databases.push([entry.name, stores]);
      } finally { database.close(); }
    }
    return { local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie, databases };
  });
  const screenshot = await page.screenshot({ mask: [page.locator('input[type="password"]')], maskColor: '#000000' });
  const text = await page.locator("body").innerText();
  mkdirSync(tc18ArtifactDirectory, { recursive: true });
  const stem = scenario.replace(':', '-');
  const screenshotPath = join(tc18ArtifactDirectory, `${stem}.png`);
  const metadataPath = join(tc18ArtifactDirectory, `${stem}.json`);
  writeFileSync(screenshotPath, screenshot);
  const safeArtifact = JSON.stringify({ scenario, source: 'runtime', sinkCount: 11,
    rowCounts: { audit: audit.length, registry: registry.length, signals: signals.length } });
  writeFileSync(metadataPath, safeArtifact + '\n');
  const report: CanaryScenarioCapture = { scenario, canaries, sinks: {
    audit: { captured: true, data: audit },
    registry: { captured: true, data: registry },
    signal: { captured: true, data: signals },
    realtime: { captured: true, data: [...input.realtime] },
    browserStorage: { captured: true, data: browserStorage },
    url: { captured: true, data: [page.url(), ...input.urls] },
    console: { captured: true, data: [...input.console] },
    telemetry: { captured: true, data: [...input.telemetry] },
    artifact: { captured: true, data: readCanaryArtifactFiles([screenshotPath, metadataPath]) },
    errorMessage: { captured: true, data: [text, ...(input.messages ?? [])] },
    screenshotText: { captured: true, data: { text, pixels: screenshot } },
  } };
  tc18RuntimeReports.push(report);
  expect(assertNoCanaryLeaks({ canaries, requiredSinks: ["audit", "registry", "signal", "realtime",
    "browserStorage", "url", "console", "telemetry", "artifact", "errorMessage", "screenshotText"],
  observations: report.sinks as Partial<Record<CanarySink, CanaryCapture>> }).checkedSinkCount).toBe(11);
}

async function assertFixtureBinding(db: pg.Client, lock = false) {
  await assertPinOnboardTarget(db, env);
  if (lock) await db.query("select marker from private.pin_onboard_test_environment where singleton for update");
}

async function resolveOwnedStore(state: FixtureState) {
  if (state.storeId || state.storeNo === undefined) return;
  const rows = (await state.db.query(`select u.id,u.email from auth.users u
    where u.email=$1`, [`store${state.storeNo}@store.pos.local`])).rows;
  if (rows.length > 1) throw new Error("OWNER_PIN_AUTH_IDENTITY_AMBIGUOUS");
  state.storeId = rows[0]?.id;
}

async function cleanupForeignAuth(state: FixtureState) {
  const owned = state.foreignAuth;
  if (!owned) return;
  const { db } = state;
  await db.query("begin");
  try {
    const marker = (await db.query(`select marker,project from private.pin_onboard_test_environment
      where singleton for update`)).rows;
    if (marker.length !== 1 || marker[0].marker !== env.marker || marker[0].project !== env.project)
      throw new Error("OWNER_PIN_FOREIGN_AUTH_TARGET_REFUSED");
    const identity = (await db.query(`select u.email,
      (select count(*)::int from public.stores where id=u.id) stores
      from auth.users u where u.id=$1`, [owned.id])).rows;
    if (identity.length !== 1 || identity[0].email !== owned.email || identity[0].stores !== 0)
      throw new Error("OWNER_PIN_FOREIGN_AUTH_SCOPE_REFUSED");
    const removed = await db.query("delete from auth.users where id=$1 returning id", [owned.id]);
    if (removed.rowCount !== 1) throw new Error("OWNER_PIN_FOREIGN_AUTH_CLEANUP_FAILED");
    await db.query("commit");
    state.foreignAuth = undefined;
  } catch (error) {
    await db.query("rollback").catch(() => undefined);
    throw error;
  }
}

test.beforeEach(async () => {
  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 60_000 });
  await db.connect();
  try {
    await assertFixtureBinding(db);
    const stores = (await db.query("select id from public.stores order by id")).rows.map(row => row.id);
    const users = (await db.query("select id from auth.users order by id")).rows.map(row => row.id);
    if (stores.length !== 0) throw new Error("OWNER_PIN_FIXTURE_NOT_CLEAN");
    if (users.length !== 0) throw new Error("OWNER_PIN_AUTH_FIXTURE_NOT_CLEAN");
    const originalSequence = (await db.query("select last_value::text,is_called from public.store_no_seq")).rows[0];
    fixture = { db, originalSequence, reservationRequestIds: [] };
  } catch (error) {
    await db.end();
    throw error;
  }


});

test.afterEach(async ({ page }) => {
  if (tc18Realtime) {
    const { client, channel } = tc18Realtime;
    tc18Realtime = undefined;
    await client.removeChannel(channel);
  }
  await page.close();
  const state = fixture;
  fixture = undefined;
  if (!state) return;
  const { db } = state;
  try {
    if (state.tc15MenuFaultInstalled) {
      await assertFixtureBinding(db);
      await db.query("drop trigger if exists tc15_seed_menu_fault on public.categories");
      await db.query("drop function if exists private.tc15_seed_menu_fault()");
      state.tc15MenuFaultInstalled = false;
    }
    await cleanupForeignAuth(state);
    await resolveOwnedStore(state);
    await db.query("begin");
    await assertFixtureBinding(db, true);
    if (state.storeId) {
      const expectedEmail = state.storeNo === undefined ? null : `store${state.storeNo}@store.pos.local`;
      const ownedAuth = (await db.query("select id,email from auth.users where id=$1", [state.storeId])).rows;
      if (ownedAuth.length !== 1 || ownedAuth[0].email !== expectedEmail) throw new Error("OWNER_PIN_AUTH_IDENTITY_MISMATCH");
      const actualStores = (await db.query("select id from public.stores order by id")).rows.map(row => row.id).sort();
      const allowedStores = [state.storeId, ...(state.additionalStores ?? []).map(store => store.storeId)].sort();
      if (JSON.stringify(actualStores) !== JSON.stringify(allowedStores)) throw new Error("OWNER_PIN_FIXTURE_SCOPE_CHANGED");
      if (state.pendingK) {
        const trigger = (await db.query(`select tgenabled from pg_trigger where tgrelid='public.write_operations'::regclass
          and tgname='write_operations_immutable' and not tgisinternal`)).rows;
        if (trigger.length !== 1 || trigger[0].tgenabled !== "O") throw new Error("OWNER_PIN_PENDING_K_TRIGGER_REFUSED");
        await db.query("alter table public.write_operations disable trigger write_operations_immutable");
        const operation = await db.query(`delete from public.write_operations
          where store_id=$1 and operation_id=$2 and status='pending' and result is null and decided_at is null
          returning operation_id`, [state.storeId, state.pendingK]);
        if (operation.rowCount !== 1) throw new Error("OWNER_PIN_PENDING_K_SCOPE_CHANGED");
        await db.query("alter table public.write_operations enable trigger write_operations_immutable");
      }
      if (state.tc03StorageObject) {
        const key = pinOnboardLocalServiceKey(env);
        const removed = await fetch(`${env.api}/storage/v1/object/menu-item-images/${state.tc03StorageObject}`, {
          method: "DELETE", headers: { apikey: key, authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000),
        }).catch(() => { throw new Error("OWNER_PIN_TC03_STORAGE_CLEANUP_TRANSPORT"); });
        if (!removed.ok) throw new Error("OWNER_PIN_TC03_STORAGE_CLEANUP_DENIED");
        const residual = (await db.query(`select count(*)::int n from storage.objects
          where bucket_id='menu-item-images' and name=$1`, [state.tc03StorageObject])).rows[0].n;
        if (residual !== 0) throw new Error("OWNER_PIN_TC03_STORAGE_CLEANUP_RETAINED");
      }
      await db.query("delete from private.initial_receipt_print_grants where store_id=$1", [state.storeId]);
      await db.query("delete from private.menu_image_assets where store_id=$1", [state.storeId]);
      await db.query("delete from private.menu_image_uploads where store_id=$1", [state.storeId]);
      await db.query("delete from private.employee_sessions where store_id=$1", [state.storeId]);
      await db.query("delete from private.employee_admin_requests where store_id=$1", [state.storeId]);
      await db.query("delete from private.bootstrap_requests where store_id=$1", [state.storeId]);
      await db.query("delete from public.employee_admin_audit where store_id=$1", [state.storeId]);
      const removed = await db.query("delete from auth.users where id=$1 returning id", [state.storeId]);
      if (removed.rowCount !== 1) throw new Error("OWNER_PIN_AUTH_CLEANUP_FAILED");
      // Cascading deletes emit invalidation hints; remove those only after the
      // owned Auth/store graph has gone.
      await db.query("delete from public.store_change_signals where store_id=$1", [state.storeId]);
    }
    for (const store of state.additionalStores ?? []) {
      const ownedAuth = (await db.query("select id,email from auth.users where id=$1", [store.storeId])).rows;
      if (ownedAuth.length !== 1 || ownedAuth[0].email !== `store${store.storeNo}@store.pos.local`)
        throw new Error("OWNER_PIN_ADDITIONAL_AUTH_SCOPE_CHANGED");
      await db.query("delete from private.initial_receipt_print_grants where store_id=$1", [store.storeId]);
      await db.query("delete from private.menu_image_assets where store_id=$1", [store.storeId]);
      await db.query("delete from private.menu_image_uploads where store_id=$1", [store.storeId]);
      await db.query("delete from private.employee_sessions where store_id=$1", [store.storeId]);
      await db.query("delete from private.employee_admin_requests where store_id=$1", [store.storeId]);
      await db.query("delete from private.bootstrap_requests where store_id=$1", [store.storeId]);
      await db.query("delete from public.employee_admin_audit where store_id=$1", [store.storeId]);
      if ((await db.query("delete from auth.users where id=$1 returning id", [store.storeId])).rowCount !== 1)
        throw new Error("OWNER_PIN_ADDITIONAL_AUTH_CLEANUP_FAILED");
      await db.query("delete from public.store_change_signals where store_id=$1", [store.storeId]);
      await db.query("delete from private.store_no_reservations where store_no=$1", [store.storeNo]);
    }
    if (state.storeNo !== undefined) await db.query("delete from private.store_no_reservations where store_no=$1", [state.storeNo]);
    for (const requestId of state.reservationRequestIds) {
      await db.query("delete from private.store_no_reservations where request_id=$1", [requestId]);
    }
    await db.query("select setval('public.store_no_seq',$1::bigint,$2::boolean)", [state.originalSequence.last_value, state.originalSequence.is_called]);
    const remainingStores = (await db.query("select id from public.stores order by id")).rows.map(row => row.id);
    const remainingUsers = (await db.query("select id from auth.users order by id")).rows.map(row => row.id);
    if (remainingStores.length !== 0 || remainingUsers.length !== 0) throw new Error("OWNER_PIN_FIXTURE_RESTORE_FAILED");
    await db.query("commit");
  } catch (error) {
    await db.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await db.end();
  }
});

async function installCreateTransport(page: Page, drop: DropPoint = null, timing: "before" | "after" = "after",
  tamperBootstrap?: "ownerId" | "storeNo",
  holdReserve?: { onRequest: () => void; wait: Promise<void> }, expectedBootstrapFault?: string,
  onBootstrapApplied?: () => Promise<void>) {
  const state = fixture!;
  const capture: TransportCapture = {
    counts: { reserve: 0, signup: 0, passwordSignIn: 0, bootstrap: 0 },
    reserveRequestIds: [], signupEmails: [], bootstrapRequests: [], signupCredentialStable: true,
    passwordSignInCredentialMatchesSignup: true,
  };
  let dropped = false;
  let firstSignupCredential: { email: string; password: string } | undefined;

  await page.route("**/rest/v1/rpc/permission_reserve_store_no", async route => {
    capture.counts.reserve += 1;
    const request = route.request().postDataJSON() as { p_create_attempt_id: string };
    capture.reserveRequestIds.push(request.p_create_attempt_id);
    state.reservationRequestIds.push(request.p_create_attempt_id);
    if (holdReserve) { holdReserve.onRequest(); await holdReserve.wait; }
    if (drop === "reserve" && timing === "before" && !dropped) { dropped = true; await route.abort("failed"); return; }
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const body = await response.json() as { data?: { storeNo?: number } };
    if (!Number.isInteger(body.data?.storeNo)) throw new Error("OWNER_PIN_RESERVATION_RESPONSE_INVALID");
    state.storeNo = body.data!.storeNo;
    if (drop === "reserve" && !dropped) { dropped = true; await route.abort("failed"); return; }
    await route.fulfill({ response });
  });

  await page.route("**/auth/v1/signup", async route => {
    capture.counts.signup += 1;
    const body = route.request().postDataJSON() as { email?: string; password?: string };
    if (typeof body.email !== "string" || typeof body.password !== "string") throw new Error("OWNER_PIN_SIGNUP_REQUEST_INVALID");
    capture.signupEmails.push(body.email);
    if (firstSignupCredential) capture.signupCredentialStable &&= firstSignupCredential.email === body.email && firstSignupCredential.password === body.password;
    else { firstSignupCredential = { email: body.email, password: body.password }; capture.signupSecret = body.password; }
    if (drop === "signup" && timing === "before" && !dropped) { dropped = true; await route.abort("failed"); return; }
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    if (drop === "signup" && !dropped) { dropped = true; await route.abort("failed"); return; }
    await route.fulfill({ response });
  });

  await page.route(/\/auth\/v1\/token\?grant_type=password(?:&|$)/, async route => {
    capture.counts.passwordSignIn += 1;
    const body = route.request().postDataJSON() as { email?: string; password?: string };
    capture.passwordSignInCredentialMatchesSignup &&= !!firstSignupCredential
      && body.email === firstSignupCredential.email && body.password === firstSignupCredential.password;
    await route.continue();
  });

  await page.route("**/rest/v1/rpc/permission_bootstrap_store", async route => {
    capture.counts.bootstrap += 1;
    const body = route.request().postDataJSON() as { p_request: Record<string, unknown> };
    capture.bootstrapRequests.push(body.p_request);
    if (drop === "bootstrap" && timing === "before" && !dropped) { dropped = true; await route.abort("failed"); return; }
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const result = await response.json() as { data?: { storeId?: string; storeNo?: number }; error?: { code?: string }; outcome?: string };
    if (expectedBootstrapFault && result.error?.code === expectedBootstrapFault) {
      await route.fulfill({ response });
      return;
    }
    if (typeof result.data?.storeId !== "string" || !Number.isInteger(result.data.storeNo)) {
      throw new Error("OWNER_PIN_BOOTSTRAP_RESPONSE_INVALID");
    }
    state.storeId = result.data.storeId;
    state.storeNo = result.data.storeNo;
    if (result.outcome === "applied" && onBootstrapApplied) await onBootstrapApplied();
    if (drop === "bootstrap" && !dropped) { dropped = true; await route.abort("failed"); return; }
    if (tamperBootstrap) {
      const changed = { ...result, data: { ...result.data,
        [tamperBootstrap]: tamperBootstrap === "storeNo" ? Number(result.data.storeNo) + 1 : "30000000-0000-4000-8000-000000000003" } };
      await route.fulfill({ response, body: JSON.stringify(changed) });
      return;
    }
    await route.fulfill({ response });
  });

  return capture;
}

async function openCreate(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("landing-screen")).toBeVisible();
  await page.getByTestId("go-create-store").click();
  await expect(page.getByTestId("create-store-screen")).toBeVisible();
}

async function submitCreate(page: Page, seedDemo = true) {
  await page.getByTestId("store-name-input").fill(`  ${CREATE_NAME}  `);
  await page.getByLabel("Địa chỉ (tuỳ chọn)").fill(`  ${CREATE_ADDRESS}  `);
  if (seedDemo) await page.getByTestId("seed-demo-checkbox").check();
  await page.getByTestId("key-loss-acknowledgement").check();
  await page.getByTestId("create-store-button").click();
}

async function expectPendingCreateFrozen(page: Page) {
  await expect(page.getByText("Chưa xác nhận được việc tạo quán. Giữ trang này và thử lại để tiếp tục cùng yêu cầu.", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("create-store-button")).toHaveText("Thử lại tạo quán");
  await expect(page.getByTestId("store-name-input")).toBeDisabled();
  await expect(page.getByLabel("Địa chỉ (tuỳ chọn)")).toBeDisabled();
  await expect(page.getByTestId("seed-demo-checkbox")).toBeDisabled();
  await expect(page.getByTestId("store-name-input")).toHaveValue(CREATE_NAME);
  await expect(page.getByLabel("Địa chỉ (tuỳ chọn)")).toHaveValue(CREATE_ADDRESS);
}

async function expectSingleBootstrapStore() {
  const state = fixture!;
  await resolveOwnedStore(state);
  if (!state.storeId || state.storeNo === undefined) throw new Error("OWNER_PIN_STORE_NOT_RESOLVED");
  const snapshot = (await state.db.query(`select
    (select count(*)::int from public.stores where id=$1 and store_no=$2) stores,
    (select count(*)::int from public.store_settings where store_id=$1) settings,
    (select count(*)::int from public.employees where store_id=$1 and role='owner') owners,
    (select count(*)::int from private.initial_seed_workflows where store_id=$1) workflows,
    (select count(*)::int from private.bootstrap_requests where store_id=$1) bootstraps,
    (select count(*)::int from private.store_no_reservations where store_no=$2) reservations,
    (select count(*)::int from auth.users where id=$1) auth_users`, [state.storeId, state.storeNo])).rows[0];
  expect(snapshot).toEqual({ stores: 1, settings: 1, owners: 1, workflows: 1, bootstraps: 1, reservations: 1, auth_users: 1 });
}

function watchStoreKeyExposure(page: Page) {
  const consoleText: string[] = [];
  const requestUrls: string[] = [];
  page.on("console", message => { consoleText.push(message.text()); });
  page.on("pageerror", error => { consoleText.push(error.message); });
  page.on("request", request => { requestUrls.push(request.url()); });
  return async (key: string) => {
    const probes = [key, key.slice(key.indexOf("-") + 1)];
    expect(probes.every(value => value.length > 0)).toBe(true);
    expect(consoleText.some(value => probes.some(probe => value.includes(probe)))).toBe(false);
    expect(requestUrls.some(value => probes.some(probe => value.includes(probe)))).toBe(false);
    expect(probes.some(probe => page.url().includes(probe))).toBe(false);
    const persisted = await page.evaluate(async values => {
      const contains = (text: string) => values.some(value => text.includes(value));
      const storageText = JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie });
      if (contains(storageText)) return true;
      for (const entry of await indexedDB.databases()) {
        if (!entry.name) continue;
        if (contains(entry.name)) return true;
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(entry.name!);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          for (const name of db.objectStoreNames) {
            if (contains(name)) return true;
            const leaked = await new Promise<boolean>((resolve, reject) => {
              const request = db.transaction(name, "readonly").objectStore(name).openCursor();
              request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) { resolve(false); return; }
                try {
                  if (contains(JSON.stringify({ key: cursor.key, value: cursor.value }))) { resolve(true); return; }
                } catch (error) { reject(error); return; }
                cursor.continue();
              };
              request.onerror = () => reject(request.error);
            });
            if (leaked) return true;
          }
        } finally { db.close(); }
      }
      return false;
    }, probes);
    expect(persisted).toBe(false);
  };
}

async function acknowledgeAndReachRestricted(page: Page, rpcNames?: string[]) {
  await expect(page.getByTestId("create-store-result")).toBeVisible();
  await page.getByTestId("acknowledge-store-key").click();
  await expect(page.getByTestId("passcode-screen")).toBeVisible();
  if (rpcNames) rpcNames.length = 0;
  await page.locator('[data-testid^="employee-"]').first().click();
  for (const digit of TEMP_PIN) await page.getByTestId(`pin-${digit}`).click();
  await page.getByTestId("unlock-button").click();
  await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
  await expect(page.getByTestId("floor-view")).toHaveCount(0);
  for (const protectedId of ["nav-employees", "nav-menu-editor", "nav-floor-editor", "nav-report", "nav-settings"]) {
    await expect(page.getByTestId(protectedId)).toHaveCount(0);
  }
}

async function completeRequiredPin(page: Page) {
  await page.getByTestId("required-new-pin").fill(NEW_PIN);
  await page.getByTestId("required-confirm-pin").fill(NEW_PIN);
  await expect(page.getByTestId("complete-required-pin")).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId("complete-required-pin").click();
  await expect(page.getByTestId("passcode-screen")).toBeVisible();
  await expect(page.getByTestId("session-notice")).toHaveText("Đã đổi PIN. Vui lòng đăng nhập bằng PIN mới.");
}

async function loginWithNewPin(page: Page) {
  await page.locator('[data-testid^="employee-"]').first().click();
  for (const digit of NEW_PIN) await page.getByTestId(`pin-${digit}`).click();
  await page.getByTestId("unlock-button").click();
  await expect(page.getByTestId("floor-view")).toBeVisible({ timeout: 15_000 });
}

async function createAndChangePin(page: Page) {
  await installCreateTransport(page);
  await openCreate(page);
  await submitCreate(page);
  await expect(page.getByTestId("create-store-result")).toBeVisible();
  const storeKey = (await page.getByTestId("result-store-key").textContent()) ?? "";
  expect(storeKey.length).toBeGreaterThan(0);
  await acknowledgeAndReachRestricted(page);
  await completeRequiredPin(page);
  return storeKey;
}

async function pairSecondOwner(page: Page, storeKey: string) {
  await page.goto("/");
  await page.getByTestId("go-store-pairing").click();
  await page.getByTestId("store-key-input").fill(storeKey);
  await page.getByTestId("go-passcode").click();
  await expect(page.getByTestId("passcode-screen")).toBeVisible();
}

async function holdTc15StoreMutex() {
  const state = fixture!;
  if (!state.storeId) throw new Error("OWNER_PIN_STORE_ID_MISSING");
  const barrier = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 60_000 });
  await barrier.connect();
  try {
    await assertFixtureBinding(barrier);
    await barrier.query("begin");
    await barrier.query("select private.permission_store_mutex($1)", [state.storeId]);
    return barrier;
  } catch (error) {
    await barrier.query("rollback").catch(() => undefined);
    await barrier.end();
    throw error;
  }
}

async function holdTc15CatalogWrite() {
  const state = fixture!;
  if (!state.storeId) throw new Error("OWNER_PIN_STORE_ID_MISSING");
  const barrier = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 60_000 });
  await barrier.connect();
  try {
    await assertFixtureBinding(barrier);
    await barrier.query("begin");
    const pid = (await barrier.query("select pg_backend_pid() pid")).rows[0].pid as number;
    await barrier.query("select pg_advisory_xact_lock(hashtext($1::text||':catalog-write'))", [state.storeId]);
    return { barrier, pid };
  } catch (error) {
    await barrier.query("rollback").catch(() => undefined);
    await barrier.end();
    throw error;
  }
}

async function installTc15MenuFault() {
  const state = fixture!;
  await assertFixtureBinding(state.db);
  const existing = (await state.db.query(`select
    to_regprocedure('private.tc15_seed_menu_fault()') is not null function_exists,
    exists(select 1 from pg_trigger where tgname='tc15_seed_menu_fault') trigger_exists`)).rows[0];
  if (existing.function_exists || existing.trigger_exists) throw new Error("OWNER_PIN_TC15_FAULT_ALREADY_EXISTS");
  state.tc15MenuFaultInstalled = true;
  await state.db.query(`create function private.tc15_seed_menu_fault() returns trigger
    language plpgsql as $$ begin raise exception 'tc15 synthetic menu fault'; end $$`);
  await state.db.query(`create trigger tc15_seed_menu_fault before insert on public.categories
    for each row execute function private.tc15_seed_menu_fault()`);
}

async function removeTc15MenuFault() {
  const state = fixture!;
  if (!state.tc15MenuFaultInstalled) return;
  await assertFixtureBinding(state.db);
  await state.db.query("drop trigger tc15_seed_menu_fault on public.categories");
  await state.db.query("drop function private.tc15_seed_menu_fault()");
  state.tc15MenuFaultInstalled = false;
}

async function stageSnapshot() {
  const state = fixture!;
  if (!state.storeId) throw new Error("OWNER_PIN_STORE_ID_MISSING");
  const stages = (await state.db.query(`select s.stage,s.status
    from private.initial_seed_stages s join private.initial_seed_workflows w using(workflow_id)
    where w.store_id=$1 order by case s.stage when 'employee' then 1 when 'menu' then 2 else 3 end`, [state.storeId])).rows;
  const counts = (await state.db.query(`select
    (select count(*)::int from public.employees where store_id=$1 and seed_key is not null) employees,
    (select count(*)::int from public.categories where store_id=$1 and seed_key is not null) categories,
    (select count(*)::int from public.menu_items where store_id=$1 and seed_key is not null) menu_items,
    (select count(*)::int from public.option_groups where store_id=$1 and seed_key is not null) option_groups,
    (select count(*)::int from public.option_values where store_id=$1 and seed_key is not null) option_values,
    (select count(*)::int from public.menu_item_option_groups where store_id=$1 and seed_key is not null) menu_links,
    (select count(*)::int from public.floor_areas where store_id=$1 and seed_key is not null) areas,
    (select count(*)::int from public.tables where store_id=$1 and seed_key is not null) tables,
    (select count(*)::int from public.floor_decor_items where store_id=$1 and seed_key is not null) decor`, [state.storeId])).rows[0];
  return { stages, counts };
}

async function seedReadOnlySnapshot() {
  const state = fixture!;
  if (!state.storeId) throw new Error("OWNER_PIN_STORE_ID_MISSING");
  const { rows } = await state.db.query(`select
    (select to_jsonb(s) from public.stores s where s.id=$1) store,
    (select to_jsonb(s) from public.store_settings s where s.store_id=$1) settings,
    (select to_jsonb(w) from private.initial_seed_workflows w where w.store_id=$1) workflow,
    (select coalesce(jsonb_agg(to_jsonb(s) order by s.stage), '[]'::jsonb)
      from private.initial_seed_stages s join private.initial_seed_workflows w using(workflow_id)
      where w.store_id=$1) stages,
    (select coalesce(jsonb_agg(to_jsonb(e) order by e.id), '[]'::jsonb)
      from public.employees e where e.store_id=$1) employees,
    (select coalesce(jsonb_agg(to_jsonb(a) order by a.actor_type,a.actor_key,a.request_id,a.target_id), '[]'::jsonb)
      from public.employee_admin_audit a where a.store_id=$1) audit,
    (select coalesce(jsonb_agg(to_jsonb(s) order by s.topic), '[]'::jsonb)
      from public.store_change_signals s where s.store_id=$1) signals,
    (select coalesce(jsonb_agg(to_jsonb(r) order by r.actor_type,r.actor_key,r.request_id), '[]'::jsonb)
      from private.employee_admin_requests r where r.store_id=$1) registry,
    (select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb)
      from public.categories c where c.store_id=$1) categories,
    (select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]'::jsonb)
      from public.menu_items m where m.store_id=$1) menu_items,
    (select coalesce(jsonb_agg(to_jsonb(g) order by g.id), '[]'::jsonb)
      from public.option_groups g where g.store_id=$1) option_groups,
    (select coalesce(jsonb_agg(to_jsonb(v) order by v.id), '[]'::jsonb)
      from public.option_values v where v.store_id=$1) option_values,
    (select coalesce(jsonb_agg(to_jsonb(l) order by l.id), '[]'::jsonb)
      from public.menu_item_option_groups l where l.store_id=$1) menu_links,
    (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
      from public.floor_areas a where a.store_id=$1) areas,
    (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb)
      from public.tables t where t.store_id=$1) tables,
    (select coalesce(jsonb_agg(to_jsonb(d) order by d.id), '[]'::jsonb)
      from public.floor_decor_items d where d.store_id=$1) decor`, [state.storeId]);
  return JSON.stringify(rows[0]);
}

async function seedSessionSnapshot() {
  const state = fixture!;
  if (!state.storeId) throw new Error("OWNER_PIN_STORE_ID_MISSING");
  const { rows } = await state.db.query(`select coalesce(jsonb_agg(to_jsonb(s) order by s.token_hash), '[]'::jsonb) sessions
    from private.employee_sessions s where s.store_id=$1`, [state.storeId]);
  return JSON.stringify(rows[0].sessions);
}

async function setSeedStatusForTc13(status: "in_progress" | "needs_retry") {
  const state = fixture!;
  if (!state.storeId) throw new Error("OWNER_PIN_STORE_ID_MISSING");
  await assertFixtureBinding(state.db);
  const changed = await state.db.query(`update private.initial_seed_workflows
    set status=$2,auto_claimed_at=private.write_clock(),run_generation=1,workflow_revision=1,
      last_error_code=case when $2='needs_retry' then 'PERMISSION_UPDATE_UNAVAILABLE' else null end,
      updated_at=private.write_clock()
    where store_id=$1 and requested and status='pending' and auto_claimed_at is null
      and run_generation=0 and workflow_revision=0 returning workflow_id`, [state.storeId, status]);
  if (changed.rowCount !== 1) throw new Error("OWNER_PIN_TC13_STATUS_SETUP_REFUSED");
  const stages = await state.db.query(`select stage,status,receipt,committed_at from private.initial_seed_stages
    where workflow_id=$1 order by case stage when 'employee' then 1 when 'menu' then 2 else 3 end`,
    [changed.rows[0].workflow_id]);
  expect(stages.rows.map(row => row.stage)).toEqual(STAGES);
  expect(stages.rows.every(row => row.status === "pending" && row.receipt === null && row.committed_at === null)).toBe(true);
}

async function stageReplayEvidence(stage: Stage) {
  const state = fixture!;
  if (!state.storeId) throw new Error("OWNER_PIN_STORE_ID_MISSING");
  return (await state.db.query(`select s.stage_id,s.receipt,s.committed_at,w.workflow_revision::int workflow_revision,
    (select count(*)::int from public.employee_admin_audit where store_id=$1) audit_count,
    (select count(*)::int from public.store_change_signals where store_id=$1) signal_count,
    (select jsonb_agg(jsonb_build_object('topic',topic,'revision',revision,'event_id',event_id,'target_id',target_id)
      order by topic) from public.store_change_signals where store_id=$1) signals_snapshot,
    (select count(*)::int from public.employees where store_id=$1) employee_count,
    (select count(*)::int from public.menu_items where store_id=$1) menu_count,
    (select count(*)::int from public.tables where store_id=$1) table_count,
    (select permission_revision::int from public.employees where store_id=$1 and seed_key='demo.employee.demo-emp-cashier') cashier_revision,
    (select passcode_hash=extensions.crypt('246810',passcode_hash) from public.employees
      where store_id=$1 and seed_key='demo.employee.demo-emp-cashier') cashier_new_pin,
    (select passcode_hash=extensions.crypt('111111',passcode_hash) from public.employees
      where store_id=$1 and seed_key='demo.employee.demo-emp-cashier') cashier_old_pin,
    (select name from public.menu_items where store_id=$1 and seed_key='demo.menu_item.mi-ca-phe-sua') coffee_name,
    (select price::int from public.menu_items where store_id=$1 and seed_key='demo.menu_item.mi-ca-phe-sua') coffee_price,
    (select deleted_at is not null from public.menu_items where store_id=$1 and seed_key='demo.menu_item.mi-bac-xiu') menu_tombstoned,
    (select name from public.tables where store_id=$1 and seed_key='demo.table.tbl-b01') table_name,
    (select deleted_at is not null from public.tables where store_id=$1 and seed_key='demo.table.tbl-b02') table_tombstoned
    from private.initial_seed_stages s join private.initial_seed_workflows w using(workflow_id)
    where w.store_id=$1 and s.stage=$2`, [state.storeId, stage])).rows[0];
}

async function ownerIdentityEvidence() {
  const state = fixture!;
  if (!state.storeId) throw new Error("OWNER_PIN_STORE_ID_MISSING");
  return (await state.db.query(`select id,
    passcode_hash=extensions.crypt($2,passcode_hash) new_pin,
    passcode_hash=extensions.crypt($3,passcode_hash) old_pin,
    pin_change_required,
    (select count(*)::int from public.employees where store_id=$1 and role='owner') owner_count
    from public.employees where store_id=$1 and role='owner'`,
    [state.storeId, NEW_PIN, TEMP_PIN])).rows[0];
}

async function editCommittedStageThroughUi(page: Page, stage: Stage, mark: (phase: string) => void) {
  const state = fixture!;
  if (!state.storeId) throw new Error("OWNER_PIN_STORE_ID_MISSING");
  if (stage === "employee") {
    const cashierId = (await state.db.query(`select id from public.employees
      where store_id=$1 and seed_key='demo.employee.demo-emp-cashier'`, [state.storeId])).rows[0]?.id;
    if (!cashierId) throw new Error("OWNER_PIN_SEEDED_CASHIER_MISSING");
    mark("employee_open_nav");
    await page.getByTestId("nav-employees").click();
    mark("employee_open_row");
    await page.getByTestId(`employee-row-${cashierId}`).click();
    mark("employee_fill_pin");
    await page.getByTestId("employee-pin-input").fill("246810");
    await page.getByTestId("employee-confirm-pin-input").fill("246810");
    const saved = page.waitForResponse(response => response.url().includes("/rpc/permission_admin_reset_pin"));
    mark("employee_save");
    await page.getByTestId("save-employee-button").click();
    expect((await saved).ok()).toBe(true);
    mark("employee_close_drawer");
    await page.getByTestId("employees-close-button").click();
    const credential = (await state.db.query(`select
      passcode_hash=extensions.crypt('246810',passcode_hash) new_pin,
      passcode_hash=extensions.crypt('111111',passcode_hash) old_pin
      from public.employees where id=$1`, [cashierId])).rows[0];
    expect(credential).toEqual({ new_pin: true, old_pin: false });
  } else if (stage === "menu") {
    mark("menu_open_editor");
    await page.getByTestId("nav-menu-editor").click();
    await page.locator('[data-testid^="menu-edit-card-"]').filter({ hasText: "Cà phê sữa" }).click();
    await page.getByTestId("menu-item-name-input").fill("Cà phê sữa mới");
    await page.getByLabel("Giá (VND)").fill("31000");
    await page.locator('[data-testid^="menu-edit-card-"]').filter({ hasText: "Bạc xỉu" })
      .getByTitle("Xóa").click();
    const saved = page.waitForResponse(response => response.url().includes("/rpc/apply_menu_changes"));
    mark("menu_save");
    await page.getByTestId("save-menu-button").click();
    const menuResponse = await saved;
    const menuBody = await menuResponse.json();
    const sentItems = menuResponse.request().postDataJSON()?.p_changes?.menuItems;
    const errorCode = typeof menuBody?.error?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(menuBody.error.code)
      ? menuBody.error.code : "UNCLASSIFIED";
    console.info(JSON.stringify({ event: "PIN_ONBOARD_TC14_MENU_RPC", status: menuResponse.status(),
      envelopeOk: menuBody?.ok === true, errorCode: menuBody?.ok === true ? null : errorCode,
      updatedCount: Array.isArray(sentItems?.updated) ? sentItems.updated.length : null,
      deletedCount: Array.isArray(sentItems?.deleted) ? sentItems.deleted.length : null }));
    expect(menuResponse.ok()).toBe(true);
    if (menuBody?.ok !== true) throw new Error(`OWNER_PIN_MENU_RPC_${errorCode}`);
    expect(menuBody.data).toBeNull();
    mark("menu_close_editor");
    await page.getByRole("button", { name: "Thoát", exact: true }).click();
    const edited = (await state.db.query(`select
      (select name from public.menu_items where store_id=$1 and seed_key='demo.menu_item.mi-ca-phe-sua') name,
      (select price::int from public.menu_items where store_id=$1 and seed_key='demo.menu_item.mi-ca-phe-sua') price,
      (select deleted_at is not null from public.menu_items where store_id=$1 and seed_key='demo.menu_item.mi-bac-xiu') tombstoned,
      (select deleted_by_employee_id=(select id from public.employees where store_id=$1 and role='owner')
        from public.menu_items where store_id=$1 and seed_key='demo.menu_item.mi-bac-xiu') attributed`, [state.storeId])).rows[0];
    expect(edited).toEqual({ name: "Cà phê sữa mới", price: 31000, tombstoned: true, attributed: true });
  } else {
    mark("floor_open_editor");
    await page.getByTestId("nav-floor-editor").click();
    await page.locator('[data-testid^="fe-table-"]').filter({ hasText: "B01" }).click();
    await page.getByTestId("fe-table-name-input").fill("Sân 01");
    await page.locator('[data-testid^="fe-table-"]').filter({ hasText: "B02" }).click();
    await page.getByRole("button", { name: "Xoá bàn", exact: true }).click();
    const saved = page.waitForResponse(response => response.url().includes("/rpc/apply_floor_changes"));
    mark("floor_save");
    await page.getByTestId("save-floor-button").click();
    const floorResponse = await saved;
    const floorBody = await floorResponse.json();
    const errorCode = typeof floorBody?.error?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(floorBody.error.code)
      ? floorBody.error.code : "UNCLASSIFIED";
    expect(floorResponse.ok()).toBe(true);
    if (floorBody?.ok !== true) throw new Error(`OWNER_PIN_FLOOR_RPC_${errorCode}`);
    expect(floorBody.data).toBeNull();
    mark("floor_close_editor");
    await page.getByRole("button", { name: "Huỷ", exact: true }).click();
    const edited = (await state.db.query(`select
      (select name from public.tables where store_id=$1 and seed_key='demo.table.tbl-b01') name,
      (select deleted_at is not null from public.tables where store_id=$1 and seed_key='demo.table.tbl-b02') tombstoned,
      (select deleted_by_employee_id=(select id from public.employees where store_id=$1 and role='owner')
        from public.tables where store_id=$1 and seed_key='demo.table.tbl-b02') attributed`, [state.storeId])).rows[0];
    expect(edited).toEqual({ name: "Sân 01", tombstoned: true, attributed: true });
  }
}

async function replayCommittedStageThroughRest(page: Page, stage: Stage, employeeToken: string, generation: number) {
  const response = await page.evaluate(async ({ api, anonKey, employeeToken, stage, generation }) => {
    const session = Object.values(localStorage).map(value => {
      try { return JSON.parse(value); } catch { return null; }
    }).find(value => value?.access_token);
    if (!session?.access_token) throw new Error("OWNER_PIN_STORE_SESSION_MISSING");
    const response = await fetch(`${api}/rest/v1/rpc/permission_run_initial_seed_stage`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json", "x-pos-employee-token": employeeToken,
        "x-pos-permission-contract": "2" },
      body: JSON.stringify({ p_request: { stage, runGeneration: generation } }),
    });
    return { status: response.status, body: await response.json() };
  }, { api: env.api, anonKey: env.anonKey, employeeToken, stage, generation });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ ok: true });
}

test.describe.serial("owner PIN onboarding on an isolated candidate fixture", () => {
  test("PERM29 app invalidation receives metadata topics; join-only edit needs manual menu refresh", async ({ page }) => {
    test.setTimeout(240_000);
    const browserSignals: { topic: string; revision: number; at: number }[] = [];
    const browserReads: { name: string; at: number }[] = [];
    const browserReadResponses: { name: string; startedAt: number; at: number; status: number; authorized: boolean; ok: boolean }[] = [];
    const requestStartedAt = new WeakMap<object, number>();
    const systemStatuses: { extension: string; status: string; storeChannel: boolean; subscribed: boolean; ready: boolean }[] = [];
    let appJoined = 0;
    const frameCounts = { joined: 0, left: 0, postgresChanges: 0, close: 0, error: 0 };
    const joinDetails: { sent: { bindings: unknown[]; role: string; subMatches: boolean }[];
      authUpdates: { role: string; subMatches: boolean }[];
      received: { bindings: unknown[] }[] } = {
      sent: [], authUpdates: [], received: [],
    };
    const appJoinTokens: string[] = [];
    page.on("websocket", socket => {
      socket.on("framesent", frame => {
        let message: any;
        try { message = JSON.parse(String(frame.payload)); } catch { return; }
        const event = Array.isArray(message) ? message[3] : message.event;
        const payload = Array.isArray(message) ? message[4] : message.payload;
        if (event === "phx_leave") frameCounts.left += 1;
        if (event === "access_token") {
          let claims: any = {};
          try { claims = JSON.parse(Buffer.from(String(payload?.access_token ?? "").split(".")[1], "base64url").toString()); }
          catch { /* Only safe claim classification is recorded. */ }
          joinDetails.authUpdates.push({ role: typeof claims.role === "string" ? claims.role : "missing",
            subMatches: typeof claims.sub === "string" && claims.sub === fixture?.storeId });
        }
        if (event === "phx_join") {
          appJoinTokens.push(String(payload?.access_token ?? ""));
          let claims: any = {};
          try { claims = JSON.parse(Buffer.from(String(payload?.access_token ?? "").split(".")[1], "base64url").toString()); }
          catch { /* Only safe claim classification is recorded. */ }
          joinDetails.sent.push({
            bindings: (payload?.config?.postgres_changes ?? []).map((entry: any) => ({
              event: entry.event, schema: entry.schema, table: entry.table, filter: entry.filter ?? null,
            })),
            role: typeof claims.role === "string" ? claims.role : "missing",
            subMatches: typeof claims.sub === "string" && claims.sub === fixture?.storeId,
          });
        }
      });
      socket.on("framereceived", frame => {
        let message: any;
        try { message = JSON.parse(String(frame.payload)); } catch { return; }
        const event = Array.isArray(message) ? message[3] : message.event;
        const payload = Array.isArray(message) ? message[4] : message.payload;
        if (event === "system") systemStatuses.push({
          extension: String(payload?.extension ?? ""), status: String(payload?.status ?? ""),
          storeChannel: String(Array.isArray(message) ? message[2] : message.topic).includes("permission-store-"),
          subscribed: String(payload?.message ?? "").includes("Subscribed to PostgreSQL"),
          ready: String(payload?.message ?? "").includes("Replication connection established"),
        });
        if (event === "phx_reply" && payload?.status === "ok" && Array.isArray(payload.response?.postgres_changes)) {
          appJoined += 1; frameCounts.joined += 1;
          joinDetails.received.push({ bindings: payload.response.postgres_changes.map((entry: any) => ({
            event: entry.event, schema: entry.schema, table: entry.table, filter: entry.filter ?? null,
          })) });
        }
        if (event === "postgres_changes") frameCounts.postgresChanges += 1;
        if (event === "phx_error") frameCounts.error += 1;
        if (event === "phx_close") frameCounts.close += 1;
        const data = payload?.data;
        if (event === "postgres_changes" && data?.table === "store_change_signals"
          && typeof data.record?.topic === "string")
          browserSignals.push({ topic: data.record.topic, revision: Number(data.record.revision), at: Date.now() });
      });
    });
    page.on("request", request => {
      const name = /\/rpc\/(permission_get_floor_operational|permission_get_menu_admin)(?:\?|$)/.exec(request.url())?.[1];
      if (name) {
        const at = Date.now();
        requestStartedAt.set(request, at);
        browserReads.push({ name, at });
      }
    });
    page.on("response", async response => {
      const name = /\/rpc\/(permission_get_floor_operational|permission_get_menu_admin)(?:\?|$)/.exec(response.url())?.[1];
      if (!name) return;
      const requestHeaders = response.request().headers();
      let ok = false;
      try { ok = (await response.json())?.ok === true; } catch { /* A failed protected read is recorded as false. */ }
      browserReadResponses.push({ name, startedAt: requestStartedAt.get(response.request()) ?? 0,
        at: Date.now(), status: response.status(), authorized: !!requestHeaders["x-pos-employee-token"]
          && !!requestHeaders.authorization?.startsWith("Bearer ")
          && requestHeaders["x-pos-permission-contract"] === "2", ok });
    });
    await createAndChangePin(page);
    const menuRequest = page.waitForRequest(request => request.url().includes("/rpc/permission_get_floor_operational")
      && !!request.headers()["x-pos-employee-token"]);
    await loginWithNewPin(page);
    await expect.poll(async () => (await stageSnapshot()).stages.map(row => row.status), { timeout: 15_000 })
      .toEqual(["committed", "committed", "committed"]);
    const headers = (await menuRequest).headers();
    const jwt = headers.authorization?.replace(/^Bearer /, "");
    if (!jwt || !headers["x-pos-employee-token"]) throw new Error("PERM29_BROWSER_AUTH_MISSING");
    const state = fixture!;
    const db = state.db;
    const storeId = state.storeId!;
    try {
      await expect.poll(() => frameCounts.joined - frameCounts.left, { timeout: 15_000 }).toBeGreaterThan(0);
    } catch (error) {
      mkdirSync("artifacts/permission-close2-20261011", { recursive: true });
      writeFileSync("artifacts/permission-close2-20261011/perm29-active-channel-diagnostic-safe.json", JSON.stringify({
        frameCounts, joinDetails, systemStatuses, appJoined, appTokenMatches: appJoinTokens.map(token => token === jwt), ui: {
          floor: await page.getByTestId("floor-view").count(),
          passcode: await page.getByTestId("passcode-screen").count(),
          required: await page.getByTestId("required-pin-change-screen").count(),
          verificationGate: await page.getByTestId("permission-verification-gate").count(),
        }, browserReads: browserReads.map(read => read.name),
      }, null, 2));
      throw error;
    }
    const firstMenuRead = page.waitForResponse(response => response.url().includes("/rpc/permission_get_menu_admin"));
    await page.getByTestId("nav-menu-editor").click();
    expect((await firstMenuRead).ok()).toBe(true);
    await expect(page.getByTestId("menu-editor")).toBeVisible();
    const published = (await db.query(`select tablename from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' order by tablename`)).rows.map(row => row.tablename);
    expect(published).toEqual(["permission_catalog_signals", "store_change_signals"]);

    await expect.poll(() => systemStatuses.some(status => status.storeChannel && status.extension === "postgres_changes"
      && status.status === "ok" && status.subscribed), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => systemStatuses.some(status => status.storeChannel && status.extension === "system"
      && status.status === "ok" && status.ready), { timeout: 30_000 }).toBe(true);
    let firstMutation = true;
      const expectSignal = async (topic: "orders" | "floor" | "menu", mutate: () => Promise<unknown>) => {
        const readName = topic === "menu" ? "permission_get_menu_admin" : "permission_get_floor_operational";
        // The floor query polls every five seconds. Start just after a poll so
        // a new read within three seconds of the signal cannot be that poll.
        if (topic !== "menu") await page.waitForResponse(response => response.url().includes(`/rpc/${readName}`));
        const signalCount = browserSignals.length;
        const revision = (await db.query("select revision::text from public.store_change_signals where store_id=$1 and topic=$2",
          [storeId, topic])).rows[0]?.revision;
        await mutate();
        await expect.poll(async () => (await db.query("select revision::text from public.store_change_signals where store_id=$1 and topic=$2",
          [storeId, topic])).rows[0]?.revision).not.toBe(revision);
        try {
          await expect.poll(() => browserSignals.slice(signalCount).some(signal => signal.topic === topic
            && signal.revision > Number(revision ?? 0)), { timeout: firstMutation ? 60_000 : 15_000 }).toBe(true);
        } catch (error) {
          mkdirSync("artifacts/permission-close2-20261011", { recursive: true });
          writeFileSync("artifacts/permission-close2-20261011/perm29-frame-diagnostic-safe.json", JSON.stringify({
            topic, revisionBefore: revision, revisionAfter: (await db.query(
              "select revision::text from public.store_change_signals where store_id=$1 and topic=$2", [storeId, topic],
            )).rows[0]?.revision, frameCounts, appJoined, joinDetails, systemStatuses,
            appTokenMatches: appJoinTokens.map(token => token === jwt),
            browserSignals: browserSignals.map(signal => ({
              topic: signal.topic, revision: signal.revision,
            })),
            readNames: browserReads.map(read => read.name),
          }, null, 2));
          throw error;
        }
        const signalAt = browserSignals.slice(signalCount).find(signal => signal.topic === topic
          && signal.revision > Number(revision ?? 0))!.at;
        await expect.poll(() => browserReads.some(read => read.name === readName && read.at >= signalAt
          && read.at - signalAt < 3_000), { timeout: 5_000 }).toBe(true);
        await expect.poll(() => browserReadResponses.some(read => read.name === readName && read.startedAt >= signalAt
          && read.startedAt - signalAt < 3_000 && read.status === 200 && read.authorized && read.ok),
        { timeout: 5_000 }).toBe(true);
        firstMutation = false;
      };
      await expectSignal("menu", () => db.query("update public.categories set name=name where store_id=$1 and seed_key is not null", [storeId]));
      await expectSignal("floor", () => db.query("update public.floor_areas set name=name where store_id=$1 and seed_key is not null", [storeId]));
      await expectSignal("orders", () => db.query("update public.tables set name=name where store_id=$1 and seed_key is not null", [storeId]));

      const employeeId = (await db.query("select id from public.employees where store_id=$1 and role='owner'", [storeId])).rows[0].id;
      const orderId = randomUUID();
      await expectSignal("orders", () => db.query(`insert into public.orders
        (id,store_id,order_type,order_no,business_date,employee_id)
        values($1,$2,'takeaway',999,current_date,$3)`, [orderId, storeId, employeeId]));
      await expectSignal("orders", () => db.query(`insert into public.payments
        (id,store_id,order_id,employee_id,method,amount,received_amount,change_amount)
        values($1,$2,$3,$4,'cash',0,0,0)`, [randomUUID(), storeId, orderId, employeeId]));

      const pair = (await db.query(`select m.id menu_item_id,g.id option_group_id
        from public.menu_items m cross join public.option_groups g
        where m.store_id=$1 and g.store_id=$1 and m.deleted_at is null and g.deleted_at is null
          and not exists(select 1 from public.menu_item_option_groups l
            where l.store_id=$1 and l.menu_item_id=m.id and l.option_group_id=g.id and l.deleted_at is null)
        order by m.id,g.id limit 1`, [storeId])).rows[0];
      expect(pair).toBeDefined();
      const joinId = randomUUID();
      const beforeJoinRevision = (await db.query("select revision::text from public.store_change_signals where store_id=$1 and topic='menu'",
        [storeId])).rows[0].revision;
      const beforeJoinSignals = browserSignals.length;
      await db.query(`insert into public.menu_item_option_groups(id,store_id,menu_item_id,option_group_id)
        values($1,$2,$3,$4)`, [joinId, storeId, pair.menu_item_id, pair.option_group_id]);
      const afterJoinRevision = (await db.query("select revision::text from public.store_change_signals where store_id=$1 and topic='menu'",
        [storeId])).rows[0].revision;
      expect(afterJoinRevision).toBe(beforeJoinRevision);
      await page.waitForTimeout(500);
      expect(browserSignals).toHaveLength(beforeJoinSignals);

      // The documented join-only exception remains visible through an explicit protected read.
      const refreshed = await page.evaluate(async ({ api, auth, employeeToken, anonKey }) => {
        const response = await fetch(`${api}/rest/v1/rpc/permission_get_pos_menu`, {
          method: "POST", headers: { apikey: anonKey, Authorization: auth,
            "x-pos-employee-token": employeeToken, "x-pos-permission-contract": "2",
            "Content-Type": "application/json" }, body: "{}",
        });
        return { status: response.status, body: await response.json() };
      }, { api: env.api, auth: headers.authorization!, employeeToken: headers["x-pos-employee-token"], anonKey: env.anonKey });
      expect(refreshed.status).toBe(200);
      expect(refreshed.body).toMatchObject({ ok: true });
      expect(refreshed.body.data.menuItemOptionGroups).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: joinId, menuItemId: pair.menu_item_id, optionGroupId: pair.option_group_id }),
      ]));
    await page.close();
    const client = createClient(env.api, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await client.realtime.setAuth(jwt);
    const calls = { orders: 0, floor: 0, report: 0, menu: 0 };
    const stop = new SupabaseRealtimePort(client).startStoreInvalidation({
      storeId,
      invalidateOpenOrders: () => { calls.orders += 1; },
      invalidateFloorPlan: () => { calls.floor += 1; },
      invalidateReport: () => { calls.report += 1; },
      invalidateMenu: () => { calls.menu += 1; },
    });
    try {
      await expect.poll(() => Math.min(...Object.values(calls)), { timeout: 15_000 }).toBeGreaterThan(0);
      const expectInvalidation = async (topic: "orders" | "floor" | "menu", mutate: () => Promise<unknown>) => {
        const before = { ...calls };
        const revision = (await db.query("select revision::text from public.store_change_signals where store_id=$1 and topic=$2",
          [storeId, topic])).rows[0]?.revision;
        await mutate();
        await expect.poll(async () => (await db.query("select revision::text from public.store_change_signals where store_id=$1 and topic=$2",
          [storeId, topic])).rows[0]?.revision).not.toBe(revision);
        await expect.poll(() => topic === "orders" ? Math.min(calls.orders - before.orders,
          calls.floor - before.floor, calls.report - before.report)
          : calls[topic] - before[topic], { timeout: 15_000 }).toBeGreaterThan(0);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (topic === "menu") expect(calls).toMatchObject({ orders: before.orders, floor: before.floor, report: before.report });
        if (topic === "floor") expect(calls).toMatchObject({ orders: before.orders, report: before.report, menu: before.menu });
        if (topic === "orders") expect(calls.menu).toBe(before.menu);
      };
      await expectInvalidation("menu", () => db.query("update public.categories set name=name where store_id=$1 and seed_key is not null", [storeId]));
      await expectInvalidation("floor", () => db.query("update public.floor_areas set name=name where store_id=$1 and seed_key is not null", [storeId]));
      await expectInvalidation("orders", () => db.query("update public.tables set name=name where store_id=$1 and seed_key is not null", [storeId]));
    } finally {
      stop();
      await client.removeAllChannels();
    }
  });

  test("TC-PIN-01 blank bootstrap yields only restricted Auth/REST session and safe denials", async ({ page }) => {
    const state = fixture!;
    const capture = await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page, false);
    await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 20_000 });
    await expectSingleBootstrapStore();
    expect(capture.counts).toEqual({ reserve: 1, signup: 1, passwordSignIn: 0, bootstrap: 1 });
    const initial = (await state.db.query(`select e.id,e.pin_change_required,e.permission_revision::int revision,
      w.requested,w.status,(select count(*)::int from private.initial_seed_stages s where s.workflow_id=w.workflow_id) stages,
      (select count(*)::int from private.employee_sessions s where s.store_id=e.store_id) sessions
      from public.employees e join private.initial_seed_workflows w on w.store_id=e.store_id
      where e.store_id=$1 and e.role='owner'`, [state.storeId])).rows;
    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({ pin_change_required: true, revision: 0,
      requested: false, status: "skipped", stages: 0, sessions: 0 });
    const withoutSqlAuth = (await state.db.query(
      "select public.permission_start_session($1,$2) result", [initial[0].id, TEMP_PIN],
    )).rows[0].result;
    expect(withoutSqlAuth).toMatchObject({ error: { code: "AUTH_REQUIRED" } });
    expect(withoutSqlAuth).not.toHaveProperty("token");

    let authHeaders: Record<string, string> | undefined;
    let browserLogin: Record<string, unknown> | undefined;
    page.on("response", async response => {
      if (!response.url().includes("/rpc/permission_start_session")) return;
      const headers = response.request().headers();
      if (headers.authorization && headers.apikey) authHeaders = {
        authorization: headers.authorization, apikey: headers.apikey,
        "x-pos-permission-contract": "2", "content-type": "application/json",
      };
      browserLogin = await response.json() as Record<string, unknown>;
    });
    await acknowledgeAndReachRestricted(page);
    await expect.poll(() => browserLogin !== undefined).toBe(true);
    expect(authHeaders).toBeDefined();
    const login = browserLogin!;
    expect(Object.keys(login).sort()).toEqual([
      "employeeId", "employeeRevision", "expiresAt", "issuedAt", "kind", "name", "ok",
      "pinChangeRequired", "storeId", "token",
    ]);
    expect(login).toMatchObject({ ok: true, kind: "required_pin_change", pinChangeRequired: true,
      storeId: state.storeId, employeeId: initial[0].id, employeeRevision: 0 });
    expect(typeof login.token).toBe("string");
    expect((login.token as string).length).toBeGreaterThan(20);
    expect(Date.parse(login.expiresAt as string) - Date.parse(login.issuedAt as string)).toBe(300_000);
    expect(JSON.stringify(login)).not.toContain("authority");
    expect(JSON.stringify(login)).not.toContain("permissions");

    const wrong = await page.request.post(`${env.api}/rest/v1/rpc/permission_start_session`, {
      headers: authHeaders!, data: { p_employee_id: initial[0].id, p_pin: "999999" },
    });
    expect(wrong.status()).toBe(200);
    expect(await wrong.json()).toMatchObject({ error: { code: "INVALID_PIN" } });
    const anonymous = await page.request.post(`${env.api}/rest/v1/rpc/permission_start_session`, {
      headers: { apikey: env.anonKey, authorization: `Bearer ${env.anonKey}`,
        "x-pos-permission-contract": "2", "content-type": "application/json" },
      data: { p_employee_id: initial[0].id, p_pin: TEMP_PIN },
    });
    const anonymousBody = await anonymous.json() as Record<string, unknown>;
    expect(anonymous.status()).toBe(401);
    expect(anonymousBody.code).toBe("42501");
    expect(anonymousBody).not.toHaveProperty("token");
    expect(anonymousBody).not.toHaveProperty("authority");
    expect((await state.db.query(`select count(*)::int n from private.employee_sessions
      where store_id=$1`, [state.storeId])).rows[0].n).toBe(1);
  });

  test("TC-PIN-02 restricted proof, network failure, reload and revoked gate", async ({ page }) => {
    test.setTimeout(120_000);
    const state = fixture!;
    const protectedNames = new Set(["permission_get_authority", "permission_get_revision",
      "permission_get_initial_seed_status", "permission_get_pos_menu", "permission_get_floor_operational",
      "permission_get_settings_admin", "permission_get_sales_report", "permission_admin_list"]);
    const protectedCalls: string[] = [];
    let completionCalls = 0;
    const proofs: Array<Record<string, unknown>> = [];
    page.on("request", request => {
      const name = request.url().match(/\/rest\/v1\/rpc\/([^?]+)/)?.[1];
      if (name && protectedNames.has(name)) protectedCalls.push(name);
      if (name === "permission_complete_required_pin_change") completionCalls += 1;
    });
    page.on("response", async response => {
      if (response.url().includes("/rpc/permission_check_required_pin_session") && response.ok())
        proofs.push(await response.json() as Record<string, unknown>);
    });
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page, false);
    await acknowledgeAndReachRestricted(page);
    await expect(page.getByTestId("complete-required-pin")).toBeEnabled();
    await page.evaluate(() => { window.dispatchEvent(new Event("blur")); window.dispatchEvent(new Event("offline")); });
    await expect(page.getByTestId("complete-required-pin")).toBeDisabled();
    await expect(page.getByTestId("app-shell")).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByTestId("complete-required-pin")).toBeEnabled();
    await page.getByTestId("required-new-pin").fill("384729");
    await page.getByTestId("required-confirm-pin").fill("384728");
    await page.getByTestId("complete-required-pin").click();
    await expect(page.getByText("Hai lần nhập PIN mới chưa khớp.", { exact: true })).toBeVisible();
    expect(completionCalls).toBe(0);
    const originalExpiry = (await state.db.query(`select expires_at::text expiry from private.employee_sessions
      where store_id=$1 and purpose='required_pin_change' order by issued_at limit 1`, [state.storeId])).rows[0].expiry;
    expect(proofs.length).toBeGreaterThan(0);
    for (const proof of proofs) {
      expect(Object.keys(proof).sort()).toEqual(["data", "ok"]);
      expect(proof).toMatchObject({ ok: true, data: { valid: true, purpose: "required_pin_change", employeeRevision: 0 } });
      expect(Object.keys(proof.data as object).sort()).toEqual(["employeeRevision", "expiresAt", "purpose", "valid"]);
      expect(JSON.stringify(proof)).not.toContain("authority");
    }
    for (const view of ["pos", "admin", "report", "print"]) {
      await page.evaluate(next => {
        history.pushState({}, "", `/?view=${next}#history`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, view);
      await expect(page).toHaveURL(new RegExp(`view=${view}`));
      await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
      await expect(page.getByTestId("floor-view")).toHaveCount(0);
      await page.evaluate(() => history.back());
      await expect(page).not.toHaveURL(new RegExp(`view=${view}`));
      await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    }
    await page.route("**/rest/v1/rpc/permission_check_required_pin_session", route => route.abort("failed"));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByText("Chưa kiểm tra được phiên. Vui lòng thử lại khi có kết nối.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("complete-required-pin")).toBeDisabled();
    await expect(page.getByTestId("floor-view")).toHaveCount(0);
    await page.unroute("**/rest/v1/rpc/permission_check_required_pin_session");
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByTestId("complete-required-pin")).toBeEnabled();
    expect((await state.db.query(`select expires_at::text=$2 unchanged from private.employee_sessions
      where store_id=$1 and purpose='required_pin_change' order by issued_at limit 1`, [state.storeId, originalExpiry])).rows[0].unchanged).toBe(true);
    expect(protectedCalls).toEqual([]);
    await page.reload();
    await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-testid^="employee-"]').first().click();
    for (const digit of TEMP_PIN) await page.getByTestId(`pin-${digit}`).click();
    await page.getByTestId("unlock-button").click();
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    await state.db.query("update private.employee_sessions set revoked_at=private.write_clock() where store_id=$1 and purpose='required_pin_change'", [state.storeId]);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
    await expect(page.getByTestId("session-notice")).toHaveText("Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.");
    expect(protectedCalls).toEqual([]);
    await page.locator('[data-testid^="employee-"]').first().click();
    for (const digit of TEMP_PIN) await page.getByTestId(`pin-${digit}`).click();
    await page.getByTestId("unlock-button").click();
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    await state.db.query(`with fixed as (select private.write_clock() at_time)
      update private.employee_sessions s set issued_at=fixed.at_time-interval '5 minutes',expires_at=fixed.at_time
      from fixed where s.store_id=$1 and s.purpose='required_pin_change' and s.revoked_at is null`, [state.storeId]);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
    await expect(page.getByTestId("session-notice")).toHaveText("Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.");
    expect(protectedCalls).toEqual([]);
  });

  test("TC-PIN-02 cached normal floor cannot render after owner recovery and restricted relogin", async ({ page }) => {
    test.setTimeout(150_000);
    const state = fixture!;
    await createAndChangePin(page);
    const loaded = new Set<string>();
    page.on("response", response => {
      const name = response.url().match(/\/rest\/v1\/rpc\/([^?]+)/)?.[1];
      if (name && ["permission_get_floor_operational", "permission_get_pos_menu"].includes(name) && response.ok())
        loaded.add(name);
    });
    await loginWithNewPin(page);
    await expect.poll(() => loaded.has("permission_get_floor_operational")).toBe(true);
    await expect(page.getByTestId("floor-view")).toBeVisible();
    const ownerId = (await state.db.query("select id from public.employees where store_id=$1 and role='owner'", [state.storeId])).rows[0].id;
    await state.db.query("begin");
    try {
      await assertFixtureBinding(state.db);
      const membership = (await state.db.query(`select m.grantor::regrole::text grantor,m.set_option,m.admin_option,m.inherit_option
        from pg_auth_members m where m.roleid='pos_owner_recovery'::regrole and m.member=current_user::regrole`)).rows;
      expect(membership).toEqual([{ grantor: "supabase_admin", set_option: false,
        admin_option: true, inherit_option: false }]);
      await state.db.query("grant pos_owner_recovery to postgres with set true");
      await state.db.query("set local role pos_owner_recovery");
      const recovered = (await state.db.query("select private.permission_recover_owner($1) result", [{
        requestId: randomUUID(), storeId: state.storeId, targetId: ownerId, operatorRef: "tc02-local",
        caseRef: "tc02-cache-recovery", proofRef: "tc02-cache-proof", newPin: "927416",
      }])).rows[0].result;
      expect(recovered).toMatchObject({ ok: true, outcome: "applied" });
      await state.db.query("reset role");
      await state.db.query("revoke pos_owner_recovery from postgres granted by postgres");
      expect((await state.db.query(`select m.grantor::regrole::text grantor,m.set_option,m.admin_option,m.inherit_option
        from pg_auth_members m where m.roleid='pos_owner_recovery'::regrole and m.member=current_user::regrole`)).rows)
        .toEqual(membership);
      await state.db.query("commit");
    } catch (error) {
      await state.db.query("rollback").catch(() => undefined);
      throw error;
    }
    await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
    await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("floor-view")).toHaveCount(0);
    await expect(page.getByTestId("app-shell")).toHaveCount(0);
    // TC-PIN-02 measures the restricted relogin. Normal-session polling and
    // seed invalidations before recovery commits are permitted reads.
    const protectedCalls: string[] = [];
    page.on("request", request => {
      const name = request.url().match(/\/rest\/v1\/rpc\/([^?]+)/)?.[1];
      if (name && ["permission_get_floor_operational", "permission_get_pos_menu", "permission_get_authority",
        "permission_get_settings_admin", "permission_get_sales_report", "permission_admin_list"].includes(name))
        protectedCalls.push(name);
    });
    await page.locator('[data-testid^="employee-"]').first().click();
    for (const digit of "927416") await page.getByTestId(`pin-${digit}`).click();
    await page.getByTestId("unlock-button").click();
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    await expect(page.getByTestId("floor-view")).toHaveCount(0);
    await expect(page.getByTestId("app-shell")).toHaveCount(0);
    await page.evaluate(() => { history.pushState({}, "", "/?view=report#history"); window.dispatchEvent(new PopStateEvent("popstate")); window.dispatchEvent(new Event("focus")); });
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    await expect(page.getByTestId("floor-view")).toHaveCount(0);
    await page.evaluate(() => history.back());
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    expect(protectedCalls).toEqual([]);
    expect((await state.db.query("select pin_change_required from public.employees where id=$1", [ownerId])).rows[0].pin_change_required).toBe(true);
  });

  test("TC-PIN-02 late S1 proof cannot change the S2 restricted generation", async ({ page }) => {
    test.setTimeout(150_000);
    const state = fixture!;
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page, false);
    await acknowledgeAndReachRestricted(page);
    await expect(page.getByTestId("complete-required-pin")).toBeEnabled();
    const s1 = { storeId: state.storeId!, storeNo: state.storeNo! };
    let releaseS1!: () => void, releaseS2!: () => void;
    let seenS1!: () => void, seenS2!: () => void;
    const waitS1 = new Promise<void>(resolve => { releaseS1 = resolve; });
    const waitS2 = new Promise<void>(resolve => { releaseS2 = resolve; });
    let settleS1!: () => void;
    const settledS1 = new Promise<void>(resolve => { settleS1 = resolve; });
    const requestedS1 = new Promise<void>(resolve => { seenS1 = resolve; });
    const requestedS2 = new Promise<void>(resolve => { seenS2 = resolve; });
    let heldS1 = false, heldS2 = false;
    await page.route("**/rest/v1/rpc/permission_check_required_pin_session", async route => {
      const bearer = route.request().headers().authorization?.replace(/^Bearer /, "");
      const sub = bearer ? (JSON.parse(Buffer.from(bearer.split(".")[1], "base64url").toString()) as { sub?: string }).sub : undefined;
      if (sub === s1.storeId) {
        if (!heldS1) { heldS1 = true; seenS1(); }
        await waitS1;
      } else if (sub === state.storeId && sub !== s1.storeId) {
        if (!heldS2) { heldS2 = true; seenS2(); }
        await waitS2;
      }
      try {
        const response = await route.fetch();
        await route.fulfill({ response });
      } finally {
        if (sub === s1.storeId) settleS1();
      }
    });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await requestedS1;
    await expect(page.getByTestId("complete-required-pin")).toBeDisabled();
    await page.getByRole("button", { name: "Đổi quán" }).click();
    await expect(page.getByTestId("landing-screen")).toBeVisible({ timeout: 20_000 });
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page, false);
    await expect(page.getByTestId("create-store-result")).toBeVisible();
    state.additionalStores = [s1];
    await acknowledgeAndReachRestricted(page);
    await requestedS2;
    expect(state.storeId).not.toBe(s1.storeId);
    await expect(page.getByTestId("complete-required-pin")).toBeDisabled();
    releaseS1();
    await settledS1;
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    await expect(page.getByTestId("complete-required-pin")).toBeDisabled();
    await expect(page.getByTestId("floor-view")).toHaveCount(0);
    releaseS2();
    await expect(page.getByTestId("complete-required-pin")).toBeEnabled();
    expect((await state.db.query(`select count(*)::int n from public.employees
      where store_id=$1 and role='owner' and pin_change_required=true`, [state.storeId])).rows[0].n).toBe(1);
  });

  test("TC-PIN-08 late S1 completion ACK cannot clear S2 restricted gate", async ({ page }) => {
    test.setTimeout(150_000);
    const state = fixture!;
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page, false);
    await acknowledgeAndReachRestricted(page);
    await expect(page.getByTestId("complete-required-pin")).toBeEnabled();
    const s1 = { storeId: state.storeId!, storeNo: state.storeNo! };
    let acknowledge!: () => void, committed!: () => void;
    const held = new Promise<void>(resolve => { acknowledge = resolve; });
    const backendCommitted = new Promise<void>(resolve => { committed = resolve; });
    let settleAck!: () => void;
    const settledAck = new Promise<void>(resolve => { settleAck = resolve; });
    await page.route("**/rest/v1/rpc/permission_complete_required_pin_change", async route => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      committed();
      await held;
      try { await route.fulfill({ response }); }
      finally { settleAck(); }
    });
    await page.getByTestId("required-new-pin").fill(NEW_PIN);
    await page.getByTestId("required-confirm-pin").fill(NEW_PIN);
    await page.getByTestId("complete-required-pin").click();
    await backendCommitted;
    expect((await state.db.query(`select pin_change_required=false completed from public.employees
      where store_id=$1 and role='owner'`, [s1.storeId])).rows[0].completed).toBe(true);
    await page.getByRole("button", { name: "Đổi quán" }).click();
    await expect(page.getByTestId("landing-screen")).toBeVisible({ timeout: 20_000 });
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page, false);
    await expect(page.getByTestId("create-store-result")).toBeVisible();
    state.additionalStores = [s1];
    await acknowledgeAndReachRestricted(page);
    await expect(page.getByTestId("complete-required-pin")).toBeEnabled();
    expect(state.storeId).not.toBe(s1.storeId);
    acknowledge();
    await settledAck;
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    await expect(page.getByTestId("complete-required-pin")).toBeEnabled();
    await expect(page.getByTestId("floor-view")).toHaveCount(0);
    expect((await state.db.query(`select pin_change_required required from public.employees
      where store_id=$1 and role='owner'`, [state.storeId])).rows[0].required).toBe(true);
  });

  test("TC-PIN-03 activated protected RPC inventory denies restricted and absent tokens without effects", async ({ page }) => {
    test.setTimeout(180_000);
    const state = fixture!;
    let authHeaders: Record<string, string> | undefined;
    let restrictedToken: string | undefined;
    page.on("response", async response => {
      if (!response.url().includes("/rpc/permission_start_session")) return;
      const headers = response.request().headers();
      if (headers.authorization && headers.apikey) authHeaders = {
        authorization: headers.authorization, apikey: headers.apikey,
        "x-pos-permission-contract": "2", "content-type": "application/json",
      };
      const body = await response.json() as { token?: string };
      if (body.token) restrictedToken = body.token;
    });
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page, false);
    await acknowledgeAndReachRestricted(page);
    expect(!!authHeaders && typeof restrictedToken === "string").toBe(true);
    const ownerId = (await state.db.query("select id from public.employees where store_id=$1 and role='owner'", [state.storeId])).rows[0].id as string;
    const routes = ownerPinProtectedRoutes(ownerId);
    const granted = (await state.db.query(`select p.oid::regprocedure::text signature,p.proargnames argnames
      from pg_proc p where p.pronamespace='public'::regnamespace
      and has_function_privilege('authenticated',p.oid,'EXECUTE') order by 1`)).rows as Array<{ signature: string; argnames: string[] | null }>;
    const actual = granted.map(row => row.signature.replace(/^public\./, ""));
    const nonBusiness = ["set_updated_at()", "permission_contract_probe()",
      "permission_contract_pre_request()", "permission_get_contract()", "permission_get_store_session()",
      "permission_list_roster()", "permission_start_session(uuid,text)", "permission_revoke_session()",
      "permission_check_required_pin_session()", "permission_complete_required_pin_change(jsonb)",
      "permission_reserve_store_no(uuid)", "permission_bootstrap_store(jsonb)"];
    expect(actual.sort()).toEqual([...routes.map(route => route.signature), ...nonBusiness].sort());
    const relationNames = (await state.db.query(`select n.nspname schema,c.relname name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
      where n.nspname in ('public','private') and c.relkind in ('r','p') and a.attname='store_id'
      and a.attnum>0 and not a.attisdropped order by 1,2`)).rows as Array<{ schema: string; name: string }>;
    const snapshot = async () => {
      const digest = createHash("sha256");
      for (const relation of relationNames) {
        const name = `"${relation.schema}"."${relation.name}"`;
        const row = (await state.db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text value
          from ${name} t where t.store_id=$1`, [state.storeId])).rows[0];
        digest.update(name).update(row.value);
      }
      return digest.digest("hex");
    };
    const before = await snapshot();
    await state.db.query("begin");
    try {
      await state.db.query("update public.employees set name=name||' tc03-negative-control' where id=$1", [ownerId]);
      expect(await snapshot()).not.toBe(before);
    } finally { await state.db.query("rollback"); }
    expect(await snapshot()).toBe(before);
    for (const route of routes) {
      const grant = granted.find(row => row.signature.replace(/^public\./, "") === route.signature);
      expect(grant).toBeDefined();
      expect(grant!.argnames?.length ?? 0).toBe(route.args.length);
      const name = route.signature.slice(0, route.signature.indexOf("("));
      const data = Object.fromEntries((grant!.argnames ?? []).map((arg, index) => [arg, route.args[index]]));
      for (const [label, token, expectedCode] of [
        ["restricted", restrictedToken, "PIN_CHANGE_REQUIRED"],
        ["missing", undefined, "EMPLOYEE_SESSION_REQUIRED"],
        ["invalid", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "EMPLOYEE_SESSION_REQUIRED"],
      ] as const) {
        const response = await page.request.post(`${env.api}/rest/v1/rpc/${name}`, {
          headers: { ...authHeaders!, ...(token ? { "x-pos-employee-token": token } : {}) }, data,
        });
        expect(response.status(), `${route.signature}:${label}:http`).toBe(200);
        const body = await response.json() as Record<string, any>;
        expect(body.error?.code, `${route.signature}:${label}:code`).toBe(expectedCode);
        expect(body, `${route.signature}:${label}:data`).not.toHaveProperty("data");
        expect(await snapshot(), `${route.signature}:${label}:effects`).toBe(before);
      }
    }
    expect(await snapshot()).toBe(before);
    const read = await page.request.get(`${env.api}/rest/v1/employees?select=id,name&store_id=eq.${state.storeId}`, {
      headers: { ...authHeaders!, "x-pos-employee-token": restrictedToken! },
    });
    const readBody = await read.json() as unknown;
    expect(read.status()).toBe(403);
    expect(Array.isArray(readBody) ? readBody : []).toEqual([]);
    expect(await snapshot()).toBe(before);
    const patch = await page.request.patch(`${env.api}/rest/v1/employees?id=eq.${ownerId}`, {
      headers: { ...authHeaders!, "x-pos-employee-token": restrictedToken!, Prefer: "return=representation" },
      data: { name: "TC03 bypass" },
    });
    const patchBody = await patch.json() as unknown;
    expect(patch.status()).toBe(403);
    expect(JSON.stringify(patchBody)).not.toContain(ownerId);
    expect(await snapshot()).toBe(before);
    await state.db.query("begin");
    try {
      await state.db.query("select set_config('request.jwt.claim.sub',$1,true)", [state.storeId]);
      await state.db.query("select set_config('request.headers',$1,true)", [JSON.stringify({
        "x-pos-permission-contract": "2", "x-pos-employee-token": restrictedToken,
      })]);
      await state.db.query("set local role authenticated");
      for (const sql of ["select id from public.employees where store_id=$1",
        "update public.employees set name='TC03 SQL bypass' where id=$1 returning id"]) {
        await state.db.query("savepoint tc03_direct");
        let code: string | undefined;
        try { await state.db.query(sql, [sql.startsWith("select") ? state.storeId : ownerId]); }
        catch (error) { code = (error as { code?: string }).code; }
        expect(code).toBe("42501");
        await state.db.query("rollback to savepoint tc03_direct");
        await state.db.query("release savepoint tc03_direct");
      }
    } finally { await state.db.query("rollback"); }
    expect(await snapshot()).toBe(before);
    const storagePath = `${env.api}/storage/v1/object/menu-item-images/${state.storeId}/tc03-restricted.png`;
    const storageHeaders = { ...authHeaders!, "x-pos-employee-token": restrictedToken!, "content-type": "image/png" };
    const upload = await page.request.post(storagePath, { headers: storageHeaders, data: Buffer.from([137, 80, 78, 71]) });
    const objectName = `${state.storeId}/tc03-restricted.png`;
    const key = pinOnboardLocalServiceKey(env);
    const serviceUpload = await page.request.post(storagePath, {
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "image/png" },
      data: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l6sAAAAASUVORK5CYII=", "base64"),
    });
    expect([200, 201]).toContain(serviceUpload.status());
    state.tc03StorageObject = objectName;
    const serviceHeaders = { apikey: key, authorization: `Bearer ${key}` };
    const serviceReadBefore = await page.request.get(storagePath, { headers: serviceHeaders });
    expect(serviceReadBefore.status()).toBe(200);
    const byteHashBefore = createHash("sha256").update(await serviceReadBefore.body()).digest("hex");
    const objectBefore = (await state.db.query(`select to_jsonb(o)::text value from storage.objects o
      where bucket_id='menu-item-images' and name=$1`, [objectName])).rows[0].value;
    const remove = await page.request.delete(storagePath, { headers: storageHeaders });
    const objectAfter = (await state.db.query(`select to_jsonb(o)::text value from storage.objects o
      where bucket_id='menu-item-images' and name=$1`, [objectName])).rows[0].value;
    expect(objectAfter).toBe(objectBefore);
    const serviceReadAfter = await page.request.get(storagePath, { headers: serviceHeaders });
    expect(serviceReadAfter.status()).toBe(200);
    expect(createHash("sha256").update(await serviceReadAfter.body()).digest("hex")).toBe(byteHashBefore);
    const storageCount = (await state.db.query(`select count(*)::int n from storage.objects
      where bucket_id='menu-item-images' and name=$1`, [objectName])).rows[0].n;
    const bucketCount = (await state.db.query("select count(*)::int n from storage.buckets where id='menu-item-images'")).rows[0].n;
    const storageCode = async (response: APIResponse) => {
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      return { status: response.status(), code: body.code ?? body.error ?? body.statusCode ?? null };
    };
    expect(await storageCode(upload)).toEqual({ status: 400, code: "AccessDenied" });
    expect(await storageCode(remove)).toEqual({ status: 400, code: "AccessDenied" });
    writeFileSync("artifacts/permission-close2-20261011/tc03-transport-observed.json", JSON.stringify({
      read: read.status(), patch: patch.status(), upload: await storageCode(upload), remove: await storageCode(remove),
      storageCount, bucketCount,
    }) + "\n");
    expect(storageCount).toBe(1);
    expect(await snapshot()).toBe(before);
    const revoke = await page.request.post(`${env.api}/rest/v1/rpc/permission_revoke_session`, {
      headers: { ...authHeaders!, "x-pos-employee-token": restrictedToken! }, data: {},
    });
    expect(revoke.status()).toBe(200);
    expect(await revoke.json()).toEqual({ ok: true });
    const revokedBaseline = await snapshot();
    for (const route of routes) {
      const grant = granted.find(row => row.signature.replace(/^public\./, "") === route.signature)!;
      const name = route.signature.slice(0, route.signature.indexOf("("));
      const data = Object.fromEntries((grant.argnames ?? []).map((arg, index) => [arg, route.args[index]]));
      const response = await page.request.post(`${env.api}/rest/v1/rpc/${name}`, {
        headers: { ...authHeaders!, "x-pos-employee-token": restrictedToken! }, data,
      });
      expect(response.status(), `${route.signature}:revoked:http`).toBe(200);
      const body = await response.json() as Record<string, any>;
      expect(body.error?.code, `${route.signature}:revoked:code`).toBe("EMPLOYEE_SESSION_REQUIRED");
      expect(body, `${route.signature}:revoked:data`).not.toHaveProperty("data");
      expect(await snapshot(), `${route.signature}:revoked:effects`).toBe(revokedBaseline);
    }
  });

  test("TC-PIN-03 every protected RPC denies a live token from another store", async ({ page }) => {
    test.setTimeout(150_000);
    const state = fixture!;
    let latestHeaders: Record<string, string> | undefined;
    let firstToken: string | undefined;
    page.on("response", async response => {
      if (!response.url().includes("/rpc/permission_start_session")) return;
      const headers = response.request().headers();
      if (headers.authorization && headers.apikey) latestHeaders = {
        authorization: headers.authorization, apikey: headers.apikey,
        "x-pos-permission-contract": "2", "content-type": "application/json",
      };
      const body = await response.json() as { token?: string };
      firstToken ??= body.token;
    });
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page, false);
    await acknowledgeAndReachRestricted(page);
    const s1 = { storeId: state.storeId!, storeNo: state.storeNo! };
    const s1Owner = (await state.db.query("select id from public.employees where store_id=$1 and role='owner'", [s1.storeId])).rows[0].id as string;
    expect(!!latestHeaders && typeof firstToken === "string").toBe(true);
    const secondTokenResponse = await page.request.post(`${env.api}/rest/v1/rpc/permission_start_session`, {
      headers: latestHeaders!, data: { p_employee_id: s1Owner, p_pin: TEMP_PIN },
    });
    expect(secondTokenResponse.status()).toBe(200);
    const s1Live = await secondTokenResponse.json() as { token?: string; kind?: string };
    expect(s1Live.kind).toBe("required_pin_change");
    expect(typeof s1Live.token).toBe("string");
    await page.getByRole("button", { name: "Đổi quán" }).click();
    await expect(page.getByTestId("landing-screen")).toBeVisible({ timeout: 20_000 });
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page, false);
    await expect(page.getByTestId("create-store-result")).toBeVisible();
    state.additionalStores = [s1];
    await acknowledgeAndReachRestricted(page);
    await expect(page.getByTestId("complete-required-pin")).toBeEnabled();
    expect(state.storeId).not.toBe(s1.storeId);
    const s2Owner = (await state.db.query("select id from public.employees where store_id=$1 and role='owner'", [state.storeId])).rows[0].id as string;
    const live = (await state.db.query(`select count(*)::int n from private.employee_sessions
      where store_id=$1 and employee_id=$2 and purpose='required_pin_change' and revoked_at is null`, [s1.storeId, s1Owner])).rows[0].n;
    expect(live).toBe(1);
    const relationNames = (await state.db.query(`select n.nspname schema,c.relname name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
      where n.nspname in ('public','private') and c.relkind in ('r','p') and a.attname='store_id'
      and a.attnum>0 and not a.attisdropped order by 1,2`)).rows as Array<{ schema: string; name: string }>;
    const snapshot = async () => {
      const digest = createHash("sha256");
      for (const relation of relationNames) for (const storeId of [s1.storeId, state.storeId!]) {
        const name = `"${relation.schema}"."${relation.name}"`;
        const row = (await state.db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text value
          from ${name} t where t.store_id=$1`, [storeId])).rows[0];
        digest.update(name).update(storeId).update(row.value);
      }
      return digest.digest("hex");
    };
    const before = await snapshot();
    const routes = ownerPinProtectedRoutes(s2Owner);
    const argnames = (await state.db.query(`select p.oid::regprocedure::text signature,p.proargnames args
      from pg_proc p where p.pronamespace='public'::regnamespace
      and has_function_privilege('authenticated',p.oid,'EXECUTE')`)).rows as Array<{ signature: string; args: string[] | null }>;
    for (const route of routes) {
      const arg = argnames.find(row => row.signature.replace(/^public\./, "") === route.signature);
      expect(arg).toBeDefined();
      const name = route.signature.slice(0, route.signature.indexOf("("));
      const data = Object.fromEntries((arg!.args ?? []).map((key, index) => [key, route.args[index]]));
      const response = await page.request.post(`${env.api}/rest/v1/rpc/${name}`, {
        headers: { ...latestHeaders!, "x-pos-employee-token": s1Live.token! }, data,
      });
      expect(response.status(), `${route.signature}:foreign:http`).toBe(200);
      const body = await response.json() as Record<string, any>;
      expect(body.error?.code, `${route.signature}:foreign:code`).toBe("EMPLOYEE_SESSION_REQUIRED");
      expect(body, `${route.signature}:foreign:data`).not.toHaveProperty("data");
      expect(await snapshot(), `${route.signature}:foreign:effects`).toBe(before);
    }
  });

  test("TC-PIN-06 completion revokes two restricted tokens and starts a 12h normal session", async ({ page }) => {
    test.setTimeout(120_000);
    const state = fixture!;
    const businessCalls: string[] = [];
    page.on("request", request => {
      const name = request.url().match(/\/rest\/v1\/rpc\/([^?]+)/)?.[1];
      if (name && /(?:execute_write_operation|payment|receipt|print)/.test(name)) businessCalls.push(name);
    });
    await page.addInitScript(() => {
      let calls = 0;
      window.print = () => { calls += 1; };
      Object.defineProperty(window, "__pinClosePrintCalls", { get: () => calls });
    });
    let authHeaders: Record<string, string> | undefined;
    let firstLogin: Record<string, unknown> | undefined;
    page.on("response", async response => {
      if (!response.url().includes("/rpc/permission_start_session")) return;
      const headers = response.request().headers();
      if (headers.authorization && headers.apikey) authHeaders = {
        authorization: headers.authorization, apikey: headers.apikey,
        "x-pos-permission-contract": "2", "content-type": "application/json",
      };
      firstLogin ??= await response.json() as Record<string, unknown>;
    });
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page, false);
    await acknowledgeAndReachRestricted(page);
    expect(!!authHeaders && typeof firstLogin?.token === "string").toBe(true);
    const ownerId = firstLogin!.employeeId as string;
    const pendingK = randomUUID();
    const pendingPayload = { schemaVersion: 1, kind: "pay_order", orderId: randomUUID(), paymentId: randomUUID(),
      expectedVersion: 0, method: "cash", receivedAmount: 50000 };
    const insertedK = await state.db.query(`with fixed as (select private.write_clock() at_time)
      insert into public.write_operations
      (store_id,operation_id,schema_version,kind,required_permission,payload,registered_at,expires_at,initiated_by_employee_id)
      select $1::uuid,$2::uuid,1,'pay_order','payment.take',$3::jsonb,fixed.at_time,
        fixed.at_time+interval '24 hours',$4::uuid from fixed returning status`,
      [state.storeId, pendingK, JSON.stringify(pendingPayload), ownerId]);
    expect(insertedK.rows.map(row => row.status)).toEqual(["pending"]);
    state.pendingK = pendingK;
    const rpc = async (name: string, data: object, token?: string) => {
      const response = await page.request.post(`${env.api}/rest/v1/rpc/${name}`, {
        headers: { ...authHeaders!, ...(token ? { "x-pos-employee-token": token } : {}) }, data,
      });
      expect(response.status()).toBe(200);
      return await response.json() as Record<string, any>;
    };
    const second = await rpc("permission_start_session", { p_employee_id: ownerId, p_pin: TEMP_PIN });
    expect(second.kind).toBe("required_pin_change");
    expect(typeof second.token).toBe("string");
    const before = (await state.db.query(`select
      (select count(*)::int from public.employee_admin_audit where store_id=$1) audit,
      (select count(*)::int from private.employee_admin_requests where store_id=$1) registry,
      (select coalesce(sum(revision),0)::int from public.store_change_signals where store_id=$1 and topic='permission') signal,
      (select count(*)::int from private.employee_sessions where store_id=$1 and purpose='required_pin_change' and revoked_at is null) restricted`, [state.storeId])).rows[0];
    expect(before.restricted).toBe(2);
    const request = { requestId: randomUUID(), expectedRevision: 0, newPin: "384729" };
    const completed = await rpc("permission_complete_required_pin_change", { p_request: request }, firstLogin!.token as string);
    expect(completed).toMatchObject({ ok: true, outcome: "applied", data: {
      credentialChanged: true, pinChangeRequired: false, employeeRevision: 1 } });
    const after = (await state.db.query(`select e.pin_change_required,e.permission_revision::int revision,
      (select count(*)::int from public.employee_admin_audit where store_id=$1) audit,
      (select count(*)::int from private.employee_admin_requests where store_id=$1) registry,
      (select coalesce(sum(revision),0)::int from public.store_change_signals where store_id=$1 and topic='permission') signal,
      (select count(*)::int from private.employee_sessions where store_id=$1 and purpose='required_pin_change' and revoked_at is null) live,
      (select count(*)::int from private.employee_sessions where store_id=$1 and purpose='required_pin_change' and revoked_at is not null) revoked
      from public.employees e where e.id=$2`, [state.storeId, ownerId])).rows[0];
    expect(after).toMatchObject({ pin_change_required: false, revision: 1,
      audit: before.audit + 1, registry: before.registry + 1, signal: before.signal + 1, live: 0, revoked: 2 });
    for (const token of [firstLogin!.token as string, second.token as string]) {
      for (const [name, data] of [["permission_check_required_pin_session", {}],
        ["permission_complete_required_pin_change", { p_request: request }],
        ["permission_get_authority", {}]] as const) {
        const denied = await rpc(name, data, token);
        expect(denied.error?.code).toBe("EMPLOYEE_SESSION_REQUIRED");
        expect(denied).not.toHaveProperty("authority");
      }
    }
    expect((await rpc("permission_start_session", { p_employee_id: ownerId, p_pin: TEMP_PIN })).error?.code).toBe("INVALID_PIN");
    const normal = await rpc("permission_start_session", { p_employee_id: ownerId, p_pin: "384729" });
    expect(normal).toMatchObject({ ok: true, kind: "normal", pinChangeRequired: false,
      authority: { snapshot: { storeId: state.storeId, employeeId: ownerId } } });
    expect(Date.parse(normal.expiresAt) - Date.parse(normal.issuedAt)).toBe(43_200_000);
    expect((await rpc("permission_get_authority", {}, normal.token)).ok).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
    await page.locator('[data-testid^="employee-"]').first().click();
    for (const digit of "384729") await page.getByTestId(`pin-${digit}`).click();
    await page.getByTestId("unlock-button").click();
    await expect(page.getByTestId("floor-view")).toBeVisible();
    expect(businessCalls).toEqual([]);
    expect(await page.evaluate(() => (window as typeof window & { __pinClosePrintCalls: number }).__pinClosePrintCalls)).toBe(0);
    const kState = (await state.db.query(`select
      (select count(*)::int from public.write_operations where store_id=$1 and operation_id=$2 and status='pending' and result is null and decided_at is null) pending,
      (select count(*)::int from public.order_events where store_id=$1 and operation_id=$2) events,
      (select count(*)::int from public.payments where store_id=$1) payments`, [state.storeId, pendingK])).rows[0];
    expect(kState).toEqual({ pending: 1, events: 0, payments: 0 });
  });

  for (const dropPoint of ["after", "before"] as const) {
    test(`TC-PIN-09 forced completion ACK loss ${dropPoint} execute requires login verification`, async ({ page }) => {
      test.setTimeout(120_000);
      const state = fixture!;
      let authHeaders: Record<string, string> | undefined;
      let restrictedToken: string | undefined;
      let completionCalls = 0;
      let committedBeforeDrop = false;
      page.on("response", async response => {
        if (!response.url().includes("/rpc/permission_start_session")) return;
        const headers = response.request().headers();
        if (headers.authorization && headers.apikey) authHeaders = {
          authorization: headers.authorization, apikey: headers.apikey,
          "x-pos-permission-contract": "2", "content-type": "application/json",
        };
        const body = await response.json() as { token?: string };
        if (body.token && !restrictedToken) restrictedToken = body.token;
      });
      await installCreateTransport(page);
      await openCreate(page);
      await submitCreate(page, false);
      await acknowledgeAndReachRestricted(page);
      expect(!!authHeaders && typeof restrictedToken === "string").toBe(true);
      const ownerId = (await state.db.query("select id from public.employees where store_id=$1 and role='owner'", [state.storeId])).rows[0].id as string;
      const before = (await state.db.query(`select passcode_hash,pin_change_required,permission_revision::int revision
        from public.employees where id=$1`, [ownerId])).rows[0];
      const rpcNames: string[] = [];
      page.on("request", request => {
        const name = request.url().match(/\/rest\/v1\/rpc\/([^?]+)/)?.[1];
        if (name) rpcNames.push(name);
      });
      await page.route("**/rest/v1/rpc/permission_complete_required_pin_change", async route => {
        completionCalls += 1;
        if (dropPoint === "before") { await route.abort("failed"); return; }
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        const body = await response.json() as Record<string, any>;
        expect(body).toMatchObject({ ok: true, outcome: "applied", data: { employeeRevision: 1 } });
        const observed = (await state.db.query(`select pin_change_required,permission_revision::int revision,
          passcode_hash=extensions.crypt($2,passcode_hash) new_pin
          from public.employees where id=$1`, [ownerId, "384729"])).rows[0];
        committedBeforeDrop = observed.pin_change_required === false && observed.revision === 1 && observed.new_pin === true;
        expect(committedBeforeDrop).toBe(true);
        await route.abort("failed");
      });
      await page.getByTestId("required-new-pin").fill("384729");
      await page.getByTestId("required-confirm-pin").fill("384729");
      await page.getByTestId("complete-required-pin").click();
      await expect(page.getByTestId("passcode-screen")).toBeVisible();
      await expect(page.getByTestId("session-notice")).toHaveText(
        "Chưa xác nhận được việc đổi PIN. Vui lòng đăng nhập lại bằng PIN mới; nếu chưa được, thử lại bằng PIN tạm.");
      expect(completionCalls).toBe(1);
      await page.evaluate(async () => {
        window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online"));
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      expect(completionCalls).toBe(1);
      const login = async (pin: string) => {
        const response = await page.request.post(`${env.api}/rest/v1/rpc/permission_start_session`, {
          headers: authHeaders!, data: { p_employee_id: ownerId, p_pin: pin },
        });
        expect(response.status()).toBe(200);
        return await response.json() as Record<string, any>;
      };
      const newPinLogin = await login("384729");
      const tempPinLogin = await login(TEMP_PIN);
      const after = (await state.db.query(`select pin_change_required,permission_revision::int revision,
        passcode_hash=$2 unchanged_hash,
        (select count(*)::int from public.employee_admin_audit where store_id=$3) audits,
        (select count(*)::int from private.employee_admin_requests where store_id=$3) registry
        from public.employees where id=$1`, [ownerId, before.passcode_hash, state.storeId])).rows[0];
      if (dropPoint === "after") {
        expect(committedBeforeDrop).toBe(true);
        expect(newPinLogin).toMatchObject({ ok: true, kind: "normal", pinChangeRequired: false });
        expect(tempPinLogin.error?.code).toBe("INVALID_PIN");
        expect(after).toMatchObject({ pin_change_required: false, revision: 1, unchanged_hash: false, audits: 1, registry: 1 });
        const replay = await page.request.post(`${env.api}/rest/v1/rpc/permission_complete_required_pin_change`, {
          headers: { ...authHeaders!, "x-pos-employee-token": restrictedToken! },
          data: { p_request: { requestId: randomUUID(), expectedRevision: 0, newPin: "384729" } },
        });
        expect((await replay.json()).error?.code).toBe("EMPLOYEE_SESSION_REQUIRED");
      } else {
        expect(committedBeforeDrop).toBe(false);
        expect(newPinLogin.error?.code).toBe("INVALID_PIN");
        expect(tempPinLogin).toMatchObject({ ok: true, kind: "required_pin_change", pinChangeRequired: true });
        expect(after).toMatchObject({ pin_change_required: true, revision: 0, unchanged_hash: true, audits: 0, registry: 0 });
      }
      expect(completionCalls).toBe(1);
      expect(rpcNames.some(name => /(?:execute_write_operation|payment|receipt|print)/.test(name))).toBe(false);
    });
  }

  test("TC-PIN-10 UI rejects invalid Unicode name and address before network", async ({ page }) => {
    const capture = await installCreateTransport(page);
    await openCreate(page);
    await page.getByTestId("key-loss-acknowledgement").check();
    for (const [name, address] of [
      ["", ""], [" \t\u00a0\u3000 ", ""], ["😀".repeat(121), ""], ["A", "😀".repeat(501)],
    ]) {
      await page.getByTestId("store-name-input").fill(name);
      await page.getByLabel("Địa chỉ (tuỳ chọn)").fill(address);
      await page.getByTestId("create-store-button").click();
      await expect(page.getByText("Tên quán phải có 1–120 ký tự, địa chỉ tối đa 500 ký tự và lựa chọn dữ liệu mẫu phải hợp lệ.")).toBeVisible();
      expect(capture.counts).toEqual({ reserve: 0, signup: 0, passwordSignIn: 0, bootstrap: 0 });
    }
    expect((await fixture!.db.query("select count(*)::int n from public.stores")).rows[0].n).toBe(0);
  });

  for (const boundary of [
    { label: "one code point and empty address without demo", name: "A", address: "", seed: false },
    { label: "120/500 Unicode code points with demo", name: "😀".repeat(120), address: "😀".repeat(500), seed: true },
  ]) {
    test(`TC-PIN-10 authenticated bootstrap accepts ${boundary.label}`, async ({ page }) => {
      const capture = await installCreateTransport(page);
      await openCreate(page);
      await page.getByTestId("store-name-input").fill(boundary.name);
      await page.getByLabel("Địa chỉ (tuỳ chọn)").fill(boundary.address);
      if (boundary.seed) await page.getByTestId("seed-demo-checkbox").check();
      await page.getByTestId("key-loss-acknowledgement").check();
      await page.getByTestId("create-store-button").click();
      await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 20_000 });
      await expectSingleBootstrapStore();
      const saved = (await fixture!.db.query(`select s.name,ss.address,w.requested,
        (select count(*)::int from private.initial_seed_stages where workflow_id=w.workflow_id) stage_count
        from public.stores s join public.store_settings ss on ss.store_id=s.id
        join private.initial_seed_workflows w on w.store_id=s.id where s.id=$1`, [fixture!.storeId])).rows[0];
      expect(saved).toEqual({ name: boundary.name, address: boundary.address,
        requested: boundary.seed, stage_count: boundary.seed ? 3 : 0 });
      expect(capture.bootstrapRequests).toHaveLength(1);
      expect(capture.bootstrapRequests[0]).toMatchObject({ displayName: boundary.name,
        address: boundary.address, seedDemo: boundary.seed });
    });
  }

  test("TC-PIN-10 direct authenticated RPC rejects malformed DTO atomically and replays canonical bootstrap", async ({ page }) => {
    const state = fixture!;
    let probed = false;
    const capture = await installCreateTransport(page);
    await page.route("**/rest/v1/rpc/permission_bootstrap_store", async route => {
      const original = route.request().postDataJSON() as { p_request: Record<string, unknown> };
      const valid = original.p_request;
      const invalid: Array<[string, Record<string, unknown>]> = [
        ["empty name", { ...valid, displayName: "" }],
        ["space name", { ...valid, displayName: " \t\u00a0\u3000 " }],
        ["name 121 code points", { ...valid, displayName: "😀".repeat(121) }],
        ["address 501 code points", { ...valid, address: "😀".repeat(501) }],
        ["seed string", { ...valid, seedDemo: "true" }],
        ["seed null", { ...valid, seedDemo: null }],
        ["seed missing", Object.fromEntries(Object.entries(valid).filter(([key]) => key !== "seedDemo"))],
        ["store zero", { ...valid, storeNo: 0 }],
        ["store negative", { ...valid, storeNo: -1 }],
        ["store fraction", { ...valid, storeNo: 1.5 }],
        ["store over int32", { ...valid, storeNo: 2_147_483_648 }],
        ["request zero UUID", { ...valid, requestId: "00000000-0000-0000-0000-000000000000" }],
        ["zero UUID", { ...valid, ownerId: "00000000-0000-0000-0000-000000000000" }],
        ["extra field", { ...valid, extra: true }],
      ];
      for (const [label, request] of invalid) {
        const response = await route.fetch({ postData: JSON.stringify({ p_request: request }) });
        expect(response.ok(), label).toBe(true);
        expect(await response.json(), label).toMatchObject({ error: { code: "INVALID_WRITE_REQUEST" } });
        const graph = (await state.db.query(`select
          (select count(*)::int from public.stores) stores,
          (select count(*)::int from public.store_settings) settings,
          (select count(*)::int from public.employees) employees,
          (select count(*)::int from private.initial_seed_workflows) workflows,
          (select count(*)::int from private.initial_seed_stages) stages,
          (select count(*)::int from private.bootstrap_requests) receipts`)).rows[0];
        expect(graph, label).toEqual({ stores: 0, settings: 0, employees: 0, workflows: 0, stages: 0, receipts: 0 });
      }
      const wrongTenantNumber = await route.fetch({ postData: JSON.stringify({ p_request: { ...valid, storeNo: Number(valid.storeNo) + 1 } }) });
      expect(await wrongTenantNumber.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
      const response = await route.fetch({ postData: JSON.stringify({ p_request: {
        ...valid, displayName: `  ${valid.displayName}  `, address: `  ${valid.address}  `,
      } }) });
      expect(response.ok()).toBe(true);
      const applied = await response.json();
      expect(applied).toMatchObject({ ok: true, outcome: "applied", data: {
        storeNo: valid.storeNo, ownerId: valid.ownerId, seedRequested: true,
      } });
      expect(Object.keys(applied).sort()).toEqual(["data", "ok", "outcome"]);
      expect(Object.keys(applied.data).sort()).toEqual(["ownerId", "seedRequested", "seedWorkflowId", "storeId", "storeNo"]);
      expect(JSON.stringify(applied)).not.toContain(TEMP_PIN);
      state.storeId = applied.data.storeId;
      state.storeNo = applied.data.storeNo;
      const same = await route.fetch();
      expect(await same.json()).toEqual({ ...applied, outcome: "replayed" });
      for (const altered of [
        { ...valid, displayName: `${valid.displayName} khác` },
        { ...valid, seedDemo: false },
        { ...valid, ownerId: randomUUID() },
      ]) {
        const conflict = await route.fetch({ postData: JSON.stringify({ p_request: altered }) });
        expect(await conflict.json()).toMatchObject({ error: { code: "BOOTSTRAP_CONFLICT" } });
      }
      const foreignEmail = `foreign-${randomUUID()}@store.pos.local`;
      const foreignSignup = await fetch(`${env.api}/auth/v1/signup`, {
        method: "POST", headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}`,
          "Content-Type": "application/json" },
        body: JSON.stringify({ email: foreignEmail, password: `${randomUUID()}${randomUUID()}` }),
        signal: AbortSignal.timeout(10_000),
      });
      expect(foreignSignup.ok).toBe(true);
      const foreignSession = await foreignSignup.json() as { user?: { id?: string }; access_token?: string };
      if (!foreignSession.user?.id) throw new Error("OWNER_PIN_FOREIGN_AUTH_ID_MISSING");
      state.foreignAuth = { id: foreignSession.user.id, email: foreignEmail };
      try {
        if (!foreignSession.access_token) throw new Error("OWNER_PIN_FOREIGN_AUTH_SESSION_MISSING");
        const foreignReplay = await fetch(`${env.api}/rest/v1/rpc/permission_bootstrap_store`, {
          method: "POST", headers: { apikey: env.anonKey, Authorization: `Bearer ${foreignSession.access_token}`,
            "Content-Type": "application/json", "x-pos-permission-contract": "2" },
          body: JSON.stringify({ p_request: valid }), signal: AbortSignal.timeout(10_000),
        });
        expect(foreignReplay.status).toBe(200);
        expect(await foreignReplay.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
      } finally { await cleanupForeignAuth(state); }
      const stored = (await state.db.query(`select s.id,s.store_no,s.name,ss.address,w.requested,w.workflow_id,
        (select count(*)::int from public.employees e where e.store_id=s.id and e.role='owner') owners,
        (select count(*)::int from private.bootstrap_requests b where b.store_id=s.id) receipts
        from public.stores s join public.store_settings ss on ss.store_id=s.id
        join private.initial_seed_workflows w on w.store_id=s.id where s.id=$1`, [state.storeId])).rows[0];
      expect(stored).toMatchObject({ id: state.storeId, store_no: state.storeNo,
        name: CREATE_NAME, address: CREATE_ADDRESS, requested: true, workflow_id: applied.data.seedWorkflowId,
        owners: 1, receipts: 1 });
      probed = true;
      await route.fulfill({ response });
    });
    await openCreate(page);
    await submitCreate(page);
    await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 20_000 });
    expect(probed).toBe(true);
    expect(capture.counts).toMatchObject({ reserve: 1, signup: 1 });
    await expectSingleBootstrapStore();
  });
  for (const storeNo of [1, 99_999_999, 100_000_000, 2_147_483_647]) {
    test(`TC-PIN-10 Store Key number ${storeNo} pairs through Auth/REST to the same store`, async ({ page }) => {
      const state = fixture!;
      await state.db.query("select setval('public.store_no_seq',$1::bigint,false)", [storeNo]);
      const capture = await installCreateTransport(page);
      await openCreate(page);
      await submitCreate(page, false);
      await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 15_000 });
      expect(state.storeNo).toBe(storeNo);
      const savedKey = (await page.getByTestId("result-store-key").textContent()) ?? "";
      expect(savedKey.split("-")[0]).toBe(String(storeNo).padStart(4, "0"));
      await page.getByTestId("acknowledge-store-key").click();
      await expect(page.getByTestId("passcode-screen")).toBeVisible();
      await page.getByText("← Đổi quán / Gỡ ghép", { exact: true }).click();
      await expect(page.getByTestId("landing-screen")).toBeVisible();
      await page.getByTestId("go-store-pairing").click();
      await page.getByTestId("store-key-input").fill(savedKey);
      const pairedSessionResponse = page.waitForResponse(response => response.url().includes("/rpc/permission_get_store_session"));
      await page.getByTestId("go-passcode").click();
      const pairedSession = await pairedSessionResponse;
      expect(pairedSession.ok()).toBe(true);
      expect(await pairedSession.json()).toMatchObject({ ok: true, data: { storeId: state.storeId, storeNo } });
      await expect(page.getByTestId("passcode-screen")).toBeVisible();
      expect(capture.counts).toMatchObject({ reserve: 1, signup: 1, bootstrap: 1 });
      await expectSingleBootstrapStore();
    });
  }

  test("TC-PIN-10 malformed Store Key is rejected before Auth and REST", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("go-store-pairing").click();
    const requests: string[] = [];
    page.on("request", request => {
      if (request.url().includes("/auth/v1/token") || request.url().includes("/rpc/permission_get_store_session"))
        requests.push("pair-network");
    });
    await page.getByTestId("store-key-input").fill("00000000001-X8F3QA");
    await page.getByTestId("go-passcode").click();
    await expect(page.getByText("Store Key không đúng định dạng.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("store-pairing-screen")).toBeVisible();
    expect(requests).toEqual([]);
  });

  test("TC-PIN-13 blank store skips demo stages after normal owner login", async ({ page }) => {
    const calls: string[] = [];
    let statusReads = 0;
    let normalHeaders: Record<string, string> | undefined;
    page.on("request", request => {
      const match = request.url().match(/\/rest\/v1\/rpc\/(permission_(?:begin|run)_initial_seed(?:_stage)?)/);
      if (match) calls.push(match[1]);
      if (request.url().includes("/rpc/permission_get_initial_seed_status")) {
        statusReads += 1;
        const headers = request.headers();
        if (headers["x-pos-employee-token"] && headers.authorization && headers.apikey) {
          normalHeaders = { authorization: headers.authorization, apikey: headers.apikey,
            "x-pos-employee-token": headers["x-pos-employee-token"],
            "x-pos-permission-contract": "2", "content-type": "application/json" };
        }
      }
    });
    const capture = await installCreateTransport(page);
    await openCreate(page);
    await page.getByTestId("store-name-input").fill(CREATE_NAME);
    await expect(page.getByTestId("create-store-button")).toBeDisabled();
    expect(capture.counts).toEqual({ reserve: 0, signup: 0, passwordSignIn: 0, bootstrap: 0 });
    await submitCreate(page, false);
    await acknowledgeAndReachRestricted(page);
    await completeRequiredPin(page);
    const beforeLogin = await seedReadOnlySnapshot();
    await loginWithNewPin(page);
    await expect.poll(() => statusReads).toBeGreaterThan(0);
    await expect(page.getByTestId("initial-seed-status")).toHaveCount(0);
    const snapshot = await stageSnapshot();
    expect(snapshot.stages).toEqual([]);
    expect(Object.values(snapshot.counts).every(count => count === 0)).toBe(true);
    expect(calls).toEqual([]);
    expect(await seedReadOnlySnapshot() === beforeLogin).toBe(true);
    expect(!!normalHeaders).toBe(true);
    const sessionsBeforeRead = await seedSessionSnapshot();
    const read = await page.request.post(`${env.api}/rest/v1/rpc/permission_get_initial_seed_status`,
      { headers: normalHeaders!, data: {} });
    expect(read.ok()).toBe(true);
    const body = await read.json() as { ok?: boolean; data?: { status?: string } };
    expect(body.ok).toBe(true);
    expect(body.data?.status).toBe("skipped");
    expect(await seedReadOnlySnapshot() === beforeLogin).toBe(true);
    expect(await seedSessionSnapshot() === sessionsBeforeRead).toBe(true);
    await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
    expect(await seedReadOnlySnapshot() === beforeLogin).toBe(true);
    await page.reload();
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
    const readsBeforeRelogin = statusReads;
    await loginWithNewPin(page);
    await expect.poll(() => statusReads).toBeGreaterThan(readsBeforeRelogin);
    expect(await seedReadOnlySnapshot() === beforeLogin).toBe(true);
    expect(calls).toEqual([]);
    await expectSingleBootstrapStore();
  });

  for (const field of ["ownerId", "storeNo"] as const) {
    test(`TC-PIN-11 bootstrap ${field} response mismatch never displays Store Key`, async ({ page }) => {
      const capture = await installCreateTransport(page, null, "after", field);
      await openCreate(page);
      await submitCreate(page);
      await expect(page.getByText("Thông tin tạo quán không khớp yêu cầu ban đầu. Đã dừng để tránh tạo trùng quán.",
        { exact: true }).first()).toBeVisible();
      await expect(page.getByTestId("create-store-result")).toHaveCount(0);
      await expect(page.getByTestId("result-store-key")).toHaveCount(0);
      expect(capture.counts).toMatchObject({ reserve: 1, signup: 1, bootstrap: 1 });
      await expectSingleBootstrapStore();
    });
  }

  test("TC-PIN-11 pending browser submit coalesces repeated clicks before reservation executes", async ({ page }) => {
    let releaseReserve!: () => void;
    let reserveStarted!: () => void;
    const wait = new Promise<void>(resolve => { releaseReserve = resolve; });
    const started = new Promise<void>(resolve => { reserveStarted = resolve; });
    const capture = await installCreateTransport(page, null, "after", undefined,
      { onRequest: reserveStarted, wait });
    await openCreate(page);
    await submitCreate(page);
    await started;
    try {
      await expect(page.getByTestId("create-store-button")).toBeDisabled();
      await expect(page.getByTestId("store-name-input")).toBeDisabled();
      await expect(page.getByLabel("Địa chỉ (tuỳ chọn)")).toBeDisabled();
      await expect(page.getByTestId("seed-demo-checkbox")).toBeDisabled();
      await expect(page.getByTestId("store-name-input")).toHaveValue(CREATE_NAME);
      await expect(page.getByLabel("Địa chỉ (tuỳ chọn)")).toHaveValue(CREATE_ADDRESS);
      await page.getByTestId("create-store-button").dispatchEvent("click");
      await page.getByTestId("create-store-button").dispatchEvent("click");
      expect(capture.counts).toEqual({ reserve: 1, signup: 0, passwordSignIn: 0, bootstrap: 0 });
      expect(new Set(capture.reserveRequestIds).size).toBe(1);
    } finally {
      releaseReserve();
    }
    await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 15_000 });
    expect(capture.counts).toEqual({ reserve: 1, signup: 1, passwordSignIn: 0, bootstrap: 1 });
    await expectSingleBootstrapStore();
  });

  for (const drop of ["reserve", "signup", "bootstrap"] as const) {
    test(`TC-PIN-11 ${drop} transport failure before execute retries one canonical create`, async ({ page }) => {
      const capture = await installCreateTransport(page, drop, "before");
      await openCreate(page);
      await submitCreate(page);
      const expectedMessage = drop === "signup"
        ? "Chưa xác nhận được tài khoản cửa hàng. Giữ trang này và thử lại."
        : "Chưa xác nhận được việc tạo quán. Giữ trang này và thử lại để tiếp tục cùng yêu cầu.";
      await expect(page.getByText(expectedMessage, { exact: true }).first()).toBeVisible();
      await expect(page.getByTestId("create-store-button")).toHaveText("Thử lại tạo quán");
      expect(capture.counts[drop]).toBe(1);
      await page.getByTestId("create-store-button").click();
      await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 15_000 });
      expect(capture.reserveRequestIds.length).toBeGreaterThanOrEqual(1);
      expect(new Set(capture.reserveRequestIds).size).toBe(1);
      expect(capture.signupCredentialStable).toBe(true);
      expect(capture.passwordSignInCredentialMatchesSignup).toBe(true);
      if (drop === "bootstrap") {
        expect(capture.bootstrapRequests).toHaveLength(2);
        expect(JSON.stringify(capture.bootstrapRequests[1]) === JSON.stringify(capture.bootstrapRequests[0])).toBe(true);
      }
      await expectSingleBootstrapStore();
    });
  }

  for (const drop of ["reserve", "bootstrap"] as const) {
    test(`TC-PIN-11 lost ${drop} ACK waits for explicit retry and reuses one canonical create`, async ({ page }) => {
      const capture = await installCreateTransport(page, drop);
      await openCreate(page);
      await submitCreate(page);
      await expectPendingCreateFrozen(page);
      await expect.poll(() => capture.counts[drop], { timeout: 1_000, intervals: [250, 250, 500] }).toBe(1);
      expect(capture.counts.signup).toBe(drop === "reserve" ? 0 : 1);
      expect(capture.counts.bootstrap).toBe(drop === "reserve" ? 0 : 1);
      await page.getByTestId("create-store-button").click();
      await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 15_000 });
      if (drop === "reserve") {
        expect(capture.reserveRequestIds).toHaveLength(2);
        expect(new Set(capture.reserveRequestIds).size).toBe(1);
      } else {
        expect(capture.bootstrapRequests).toHaveLength(2);
        expect(JSON.stringify(capture.bootstrapRequests[1]) === JSON.stringify(capture.bootstrapRequests[0])).toBe(true);
        expect(capture.counts.signup).toBe(1);
      }
      await expectSingleBootstrapStore();
    });
  }

  test("TC-PIN-11 lost signup ACK reconciles by sign-in and never submits signup twice", async ({ page }) => {
    const capture = await installCreateTransport(page, "signup");
    await openCreate(page);
    await submitCreate(page);
    await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 15_000 });
    expect(capture.counts.signup).toBe(1);
    expect(capture.counts.passwordSignIn).toBeGreaterThanOrEqual(1);
    expect(capture.passwordSignInCredentialMatchesSignup).toBe(true);
    expect(capture.signupEmails).toHaveLength(1);
    expect(capture.counts.reserve).toBe(1);
    expect(capture.counts.bootstrap).toBe(1);
    await expectSingleBootstrapStore();
  });

  test("TC-PIN-13 create to Key ACK stays restricted until changed PIN login, then seeds once (TC02/12)", async ({ page }) => {
    const rpcNames: string[] = [];
    let restrictedHeaders: Record<string, string> | undefined;
    let normalHeaders: Record<string, string> | undefined;
    let statusReads = 0;
    page.on("request", request => {
      const match = request.url().match(/\/rest\/v1\/rpc\/([^?]+)/);
      if (match) rpcNames.push(match[1]);
      if (match?.[1] === "permission_get_initial_seed_status") {
        statusReads += 1;
        const headers = request.headers();
        if (headers["x-pos-employee-token"] && headers.authorization && headers.apikey) {
          normalHeaders = { authorization: headers.authorization, apikey: headers.apikey,
            "x-pos-employee-token": headers["x-pos-employee-token"],
            "x-pos-permission-contract": "2", "content-type": "application/json" };
        }
      }
      if (match?.[1] === "permission_check_required_pin_session") {
        const headers = request.headers();
        if (headers["x-pos-employee-token"] && headers.authorization && headers.apikey) {
          restrictedHeaders = { authorization: headers.authorization, apikey: headers.apikey,
            "x-pos-employee-token": headers["x-pos-employee-token"],
            "x-pos-permission-contract": "2", "content-type": "application/json" };
        }
      }
    });
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page);
    await acknowledgeAndReachRestricted(page, rpcNames);
    const pending = (await fixture!.db.query(`select status,auto_claimed_at is null unclaimed,
      run_generation::int generation from private.initial_seed_workflows where store_id=$1`, [fixture!.storeId])).rows[0];
    expect(pending).toEqual({ status: "pending", unclaimed: true, generation: 0 });
    const pendingStages = (await fixture!.db.query(`select s.stage,s.stage_id,
      private.permission_stable_uuid($1,'initial-seed.v1.'||s.stage) expected_id
      from private.initial_seed_stages s join private.initial_seed_workflows w using(workflow_id)
      where w.store_id=$1 order by case s.stage when 'employee' then 1 when 'menu' then 2 else 3 end`,
      [fixture!.storeId])).rows;
    expect(pendingStages.map(row => row.stage)).toEqual(STAGES);
    expect(pendingStages.every(row => row.stage_id === row.expected_id)).toBe(true);
    const forbiddenBeforeNormal = new Set([
      "permission_get_authority", "permission_get_revision", "permission_get_initial_seed_status",
      "permission_begin_initial_seed", "permission_run_initial_seed_stage", "permission_get_menu_catalog",
      "permission_get_floor_workspace", "permission_get_settings_admin", "permission_admin_list",
    ]);
    expect(rpcNames.some(name => forbiddenBeforeNormal.has(name))).toBe(false);
    await expect.poll(() => !!restrictedHeaders).toBe(true);
    const restrictedSessions = (await fixture!.db.query(`select purpose from private.employee_sessions
      where store_id=$1 order by issued_at`, [fixture!.storeId])).rows;
    expect(restrictedSessions.length).toBeGreaterThan(0);
    expect(restrictedSessions.every(row => row.purpose === "required_pin_change")).toBe(true);
    const beforeRestrictedProbe = await seedReadOnlySnapshot();
    const sessionsBeforeRestrictedProbe = await seedSessionSnapshot();
    for (const name of ["permission_get_initial_seed_status", "permission_begin_initial_seed"]) {
      const response = await page.request.post(`${env.api}/rest/v1/rpc/${name}`, {
        headers: restrictedHeaders!, data: name === "permission_begin_initial_seed"
          ? { p_request: { mode: "initial", expectedWorkflowRevision: 0 } } : {},
      });
      expect(response.ok()).toBe(true);
      const body = await response.json() as { error?: { code?: string } };
      expect(body.error?.code).toBe("PIN_CHANGE_REQUIRED");
    }
    expect(await seedReadOnlySnapshot() === beforeRestrictedProbe).toBe(true);
    expect(await seedSessionSnapshot() === sessionsBeforeRestrictedProbe).toBe(true);
    await completeRequiredPin(page);
    const pendingBeforeRead = await seedReadOnlySnapshot();
    let pendingReadOnly = false;
    await page.route("**/rest/v1/rpc/permission_get_initial_seed_status", async route => {
      const sessionsBeforeStatus = !pendingReadOnly ? await seedSessionSnapshot() : undefined;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      const body = await response.json() as { ok?: boolean; data?: { status?: string; autoEligible?: boolean } };
      if (!pendingReadOnly) {
        expect(body).toMatchObject({ ok: true, data: { status: "pending", autoEligible: true } });
        expect(await seedReadOnlySnapshot() === pendingBeforeRead).toBe(true);
        expect(await seedSessionSnapshot() === sessionsBeforeStatus).toBe(true);
        pendingReadOnly = true;
      }
      await route.fulfill({ response });
    });
    const stages: Stage[] = [];
    page.on("response", response => {
      if (!response.url().includes("/rpc/permission_run_initial_seed_stage") || !response.ok()) return;
      const stage = response.request().postDataJSON()?.p_request?.stage as Stage;
      if (STAGES.includes(stage)) stages.push(stage);
    });
    await loginWithNewPin(page);
    await expect.poll(() => stages, { timeout: 15_000 }).toEqual(STAGES);
    expect(pendingReadOnly).toBe(true);
    await expect.poll(async () => (await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "committed", "committed"]);
    const workflow = (await fixture!.db.query(`select status,requested,auto_claimed_at is not null auto_claimed,
      run_generation::int generation from private.initial_seed_workflows where store_id=$1`, [fixture!.storeId])).rows[0];
    expect(workflow).toEqual({ status: "completed", requested: true, auto_claimed: true, generation: 1 });
    const receipts = (await fixture!.db.query(`select s.stage,s.stage_id,s.status,s.committed_at is not null committed,
      s.receipt is not null has_receipt from private.initial_seed_stages s
      join private.initial_seed_workflows w using(workflow_id) where w.store_id=$1
      order by case s.stage when 'employee' then 1 when 'menu' then 2 else 3 end`, [fixture!.storeId])).rows;
    expect(receipts.map(row => row.stage)).toEqual(STAGES);
    expect(receipts.map(row => row.stage_id)).toEqual(pendingStages.map(row => row.stage_id));
    expect(new Set(receipts.map(row => row.stage_id)).size).toBe(3);
    expect(receipts.every(row => row.status === "committed" && row.committed && row.has_receipt)).toBe(true);
    const snapshot = await stageSnapshot();
    expect(snapshot.counts).toEqual({ employees: 1, categories: 2, menu_items: 6, option_groups: 2, option_values: 4, menu_links: 3, areas: 1, tables: 4, decor: 7 });
    const completedBeforeRead = await seedReadOnlySnapshot();
    const ownerBeforeRead = await ownerIdentityEvidence();
    expect(ownerBeforeRead).toMatchObject({ new_pin: true, old_pin: false, pin_change_required: false, owner_count: 1 });
    const callsBeforeRead = rpcNames.filter(name => name === "permission_begin_initial_seed" || name === "permission_run_initial_seed_stage");
    expect(callsBeforeRead).toEqual(["permission_begin_initial_seed", ...STAGES.map(() => "permission_run_initial_seed_stage")]);
    expect(!!normalHeaders).toBe(true);
    for (let repeat = 0; repeat < 2; repeat += 1) {
      const sessionsBeforeRead = await seedSessionSnapshot();
      const response = await page.request.post(`${env.api}/rest/v1/rpc/permission_get_initial_seed_status`,
        { headers: normalHeaders!, data: {} });
      expect(response.ok()).toBe(true);
      const body = await response.json() as { ok?: boolean; data?: { status?: string } };
      expect(body.ok).toBe(true);
      expect(body.data?.status).toBe("completed");
      expect(await seedReadOnlySnapshot() === completedBeforeRead).toBe(true);
      expect(await seedSessionSnapshot() === sessionsBeforeRead).toBe(true);
    }
    await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
    expect(await seedReadOnlySnapshot() === completedBeforeRead).toBe(true);
    await page.reload();
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
    const readsBeforeRelogin = statusReads;
    await loginWithNewPin(page);
    await expect.poll(() => statusReads).toBeGreaterThan(readsBeforeRelogin);
    expect(await seedReadOnlySnapshot() === completedBeforeRead).toBe(true);
    expect(await ownerIdentityEvidence()).toEqual(ownerBeforeRead);
    expect(rpcNames.filter(name => name === "permission_begin_initial_seed" || name === "permission_run_initial_seed_stage")).toEqual(callsBeforeRead);
    await expectSingleBootstrapStore();
  });

  for (const seededStatus of ["in_progress", "needs_retry"] as const) {
    test(`TC-PIN-13 ${seededStatus} requires explicit retry across login, focus and reconnect`, async ({ page }) => {
      await createAndChangePin(page);
      await setSeedStatusForTc13(seededStatus);
      const beforeLogin = await seedReadOnlySnapshot();
      const ownerBefore = await ownerIdentityEvidence();
      expect(ownerBefore).toMatchObject({ new_pin: true, old_pin: false, pin_change_required: false, owner_count: 1 });
      const calls: string[] = [];
      let statusReads = 0;
      let normalHeaders: Record<string, string> | undefined;
      page.on("request", request => {
        const match = request.url().match(/\/rest\/v1\/rpc\/([^?]+)/);
        if (match?.[1] === "permission_begin_initial_seed" || match?.[1] === "permission_run_initial_seed_stage") calls.push(match[1]);
        if (match?.[1] === "permission_get_initial_seed_status") {
          statusReads += 1;
          const headers = request.headers();
          if (headers["x-pos-employee-token"] && headers.authorization && headers.apikey) {
            normalHeaders = { authorization: headers.authorization, apikey: headers.apikey,
              "x-pos-employee-token": headers["x-pos-employee-token"],
              "x-pos-permission-contract": "2", "content-type": "application/json" };
          }
        }
      });
      await loginWithNewPin(page);
      await expect(page.getByTestId("retry-initial-seed")).toBeVisible();
      await expect.poll(() => statusReads).toBeGreaterThan(0);
      expect(calls).toEqual([]);
      expect(await seedReadOnlySnapshot() === beforeLogin).toBe(true);
      expect(!!normalHeaders).toBe(true);
      for (let repeat = 0; repeat < 2; repeat += 1) {
        const sessionsBeforeRead = await seedSessionSnapshot();
        const response = await page.request.post(`${env.api}/rest/v1/rpc/permission_get_initial_seed_status`,
          { headers: normalHeaders!, data: {} });
        expect(response.ok()).toBe(true);
        const body = await response.json() as { ok?: boolean; data?: { status?: string } };
        expect(body.ok).toBe(true);
        expect(body.data?.status).toBe(seededStatus);
        expect(await seedReadOnlySnapshot() === beforeLogin).toBe(true);
        expect(await seedSessionSnapshot() === sessionsBeforeRead).toBe(true);
      }
      await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
      expect(await seedReadOnlySnapshot() === beforeLogin).toBe(true);
      expect(calls).toEqual([]);
      await page.reload();
      await expect(page.getByTestId("passcode-screen")).toBeVisible();
      const readsBeforeRelogin = statusReads;
      await loginWithNewPin(page);
      await expect(page.getByTestId("retry-initial-seed")).toBeVisible();
      await expect.poll(() => statusReads).toBeGreaterThan(readsBeforeRelogin);
      expect(await seedReadOnlySnapshot() === beforeLogin).toBe(true);
      expect(await ownerIdentityEvidence()).toEqual(ownerBefore);
      expect(calls).toEqual([]);
      const graph = await stageSnapshot();
      expect(graph.stages.map(row => row.status)).toEqual(["pending", "pending", "pending"]);
      expect(Object.values(graph.counts).every(count => count === 0)).toBe(true);
      await expectSingleBootstrapStore();
    });
  }

  test("TC-PIN-12 warning acknowledgement prevents all create network before consent", async ({ page }) => {
    const capture = await installCreateTransport(page);
    await openCreate(page);
    await page.getByTestId("store-name-input").fill(CREATE_NAME);
    await expect(page.getByTestId("create-store-button")).toBeDisabled();
    await page.getByTestId("store-name-input").press("Enter");
    await expect(page.getByText("Hãy xác nhận bạn đã hiểu cách lưu Store Key trước khi tạo quán.", { exact: true })).toBeVisible();
    expect(capture.counts).toEqual({ reserve: 0, signup: 0, passwordSignIn: 0, bootstrap: 0 });
    await expect(page.getByTestId("create-store-result")).toHaveCount(0);
  });

  test("TC-PIN-12 compatibility unmount keeps Key until ACK, then reloads compatible and clears it", async ({ page }) => {
    let bootstrapCommitted = false;
    let contractCompatible = false;
    const assertNoKeyExposure = watchStoreKeyExposure(page);
    await page.route("**/rest/v1/rpc/permission_get_contract", async route => {
      if (bootstrapCommitted && !contractCompatible) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ permissionContractVersion: 1, writeProtocolVersion: 1 }) });
        return;
      }
      await route.continue();
    });
    const capture = await installCreateTransport(page);
    await page.route("**/rest/v1/rpc/permission_bootstrap_store", async route => {
      capture.counts.bootstrap += 1;
      const body = route.request().postDataJSON() as { p_request: Record<string, unknown> };
      capture.bootstrapRequests.push(body.p_request);
      const response = await route.fetch();
      const result = await response.json() as { data?: { storeId?: string; storeNo?: number } };
      if (!response.ok() || typeof result.data?.storeId !== "string" || !Number.isInteger(result.data.storeNo)) throw new Error("OWNER_PIN_BOOTSTRAP_RESPONSE_INVALID");
      fixture!.storeId = result.data.storeId;
      fixture!.storeNo = result.data.storeNo;
      bootstrapCommitted = true;
      await route.fulfill({ response });
    });
    await openCreate(page);
    await submitCreate(page);
    await expect(page.getByTestId("compatibility-update-gate")).toBeVisible({ timeout: 15_000 });
    const resultKey = (await page.getByTestId("compatibility-store-key").textContent())?.replace(/^Store Key: /, "") ?? "";
    expect(resultKey.length > 0).toBe(true);
    expect(await page.getByTestId("compatibility-store-key").textContent() === `Store Key: ${resultKey}`).toBe(true);
    await expect(page.getByTestId("create-store-screen")).toHaveCount(0);
    await expect(page.getByTestId("floor-view")).toHaveCount(0);
    await expectSingleBootstrapStore();
    await assertNoKeyExposure(resultKey);
    contractCompatible = true;
    await page.getByRole("button", { name: "Tôi đã lưu Store Key." }).click();
    await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("compatibility-store-key")).toHaveCount(0);
    await expect(page.getByTestId("create-store-result")).toHaveCount(0);
    await assertNoKeyExposure(resultKey);
    expect(capture.counts).toMatchObject({ reserve: 1, signup: 1, bootstrap: 1 });
  });

  test("TC-PIN-12 hard reload loses the in-memory Key, does not recreate, and accepts the externally saved Key", async ({ page }) => {
    const assertNoKeyExposure = watchStoreKeyExposure(page);
    const capture = await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page);
    await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 15_000 });
    const savedKey = (await page.getByTestId("result-store-key").textContent()) ?? "";
    expect(savedKey.length > 0).toBe(true);
    const persistedBefore = await page.evaluate(key => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(key), savedKey);
    expect(persistedBefore).toBe(false);
    await assertNoKeyExposure(savedKey);
    await page.reload();
    await expect(page.getByTestId("reload-store-key-notice")).toContainText("Hệ thống không thể hiển thị lại Store Key chưa được lưu.");
    await expect(page.getByTestId("create-store-result")).toHaveCount(0);
    await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
    expect(page.url().includes(savedKey)).toBe(false);
    expect(await page.evaluate(key => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(key), savedKey)).toBe(false);
    await assertNoKeyExposure(savedKey);
    expect(capture.counts.reserve).toBe(1);
    expect(capture.counts.signup).toBe(1);
    expect(capture.counts.bootstrap).toBe(1);
    await page.getByText("← Đổi quán / Gỡ ghép", { exact: true }).click();
    await expect(page.getByTestId("landing-screen")).toBeVisible();
    await page.getByTestId("go-store-pairing").click();
    await page.getByTestId("store-key-input").fill(savedKey);
    await page.getByTestId("go-passcode").click();
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
    await page.locator('[data-testid^="employee-"]').first().click();
    for (const digit of TEMP_PIN) await page.getByTestId(`pin-${digit}`).click();
    await page.getByTestId("unlock-button").click();
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    await assertNoKeyExposure(savedKey);
    await expectSingleBootstrapStore();
  });

  test("TC-PIN-12 reload after explicit Key ACK keeps store pairing without credential persistence", async ({ page }) => {
    const assertNoKeyExposure = watchStoreKeyExposure(page);
    const capture = await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page);
    await expect(page.getByTestId("create-store-result")).toBeVisible();
    const savedKey = (await page.getByTestId("result-store-key").textContent()) ?? "";
    expect(savedKey.length > 0).toBe(true);
    await assertNoKeyExposure(savedKey);
    await page.getByTestId("acknowledge-store-key").click();
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("create-store-result")).toHaveCount(0);
    expect(page.url().includes(savedKey)).toBe(false);
    expect(await page.evaluate(key => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(key), savedKey)).toBe(false);
    await assertNoKeyExposure(savedKey);
    expect(capture.counts).toMatchObject({ reserve: 1, signup: 1, bootstrap: 1 });
    await expectSingleBootstrapStore();
  });

  test("TC-PIN-15 two browser owners race initial claim behind store mutex", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const storeKey = await createAndChangePin(page);
    const secondContext = await browser.newContext();
    let barrier: pg.Client | undefined;
    try {
      const second = await secondContext.newPage();
      await pairSecondOwner(second, storeKey);
      const requests: string[] = [];
      const outcomes: Array<{ acquired: boolean; generation: number }> = [];
      const stageCalls: Stage[] = [];
      let releaseStatus!: () => void;
      const statusGate = new Promise<void>(resolve => { releaseStatus = resolve; });
      let pendingReads = 0;
      for (const [index, ownerPage] of [page, second].entries()) {
        await ownerPage.route("**/rest/v1/rpc/permission_get_initial_seed_status", async route => {
          const response = await route.fetch();
          expect(response.ok()).toBe(true);
          const body = await response.json() as { ok?: boolean; data?: { status?: string } };
          if (pendingReads < 2) {
            expect(body).toMatchObject({ ok: true, data: { status: "pending" } });
            pendingReads += 1;
          }
          await statusGate;
          await route.fulfill({ response });
        });
        ownerPage.on("request", request => {
          if (!request.url().includes("/rpc/permission_run_initial_seed_stage")) return;
          stageCalls.push(request.postDataJSON()?.p_request?.stage as Stage);
        });
        await ownerPage.route("**/rest/v1/rpc/permission_begin_initial_seed", async route => {
          const payload = route.request().postDataJSON()?.p_request;
          expect(payload).toMatchObject({ mode: "initial", expectedWorkflowRevision: 0 });
          requests.push(String(index));
          const response = await route.fetch();
          expect(response.ok()).toBe(true);
          const body = await response.json() as { ok?: boolean; data?: { acquired?: boolean; runGeneration?: number } };
          expect(body.ok).toBe(true);
          outcomes.push({ acquired: body.data?.acquired === true, generation: body.data?.runGeneration ?? -1 });
          await route.fulfill({ response });
        });
      }
      const pendingBefore = await seedReadOnlySnapshot();
      const firstLogin = loginWithNewPin(page);
      const secondLogin = loginWithNewPin(second);
      await expect.poll(() => pendingReads, { timeout: 15_000 }).toBe(2);
      barrier = await holdTc15StoreMutex();
      releaseStatus();
      await expect.poll(() => requests.length, { timeout: 15_000 }).toBe(2);
      expect(outcomes).toEqual([]);
      expect(await seedReadOnlySnapshot() === pendingBefore).toBe(true);
      await barrier.query("commit");
      await Promise.all([firstLogin, secondLogin]);
      await expect.poll(async () => (await stageSnapshot()).stages.map(row => row.status), { timeout: 20_000 })
        .toEqual(["committed", "committed", "committed"]);
      expect(outcomes).toHaveLength(2);
      expect(outcomes.filter(row => row.acquired)).toEqual([{ acquired: true, generation: 1 }]);
      expect(outcomes.filter(row => !row.acquired)).toEqual([{ acquired: false, generation: 1 }]);
      expect(stageCalls).toEqual(STAGES);
      const workflow = (await fixture!.db.query(`select status,workflow_revision::int revision,
        run_generation::int generation,auto_claimed_at is not null claimed
        from private.initial_seed_workflows where store_id=$1`, [fixture!.storeId])).rows[0];
      expect(workflow).toEqual({ status: "completed", revision: 4, generation: 1, claimed: true });
      expect(await ownerIdentityEvidence()).toMatchObject({ new_pin: true, old_pin: false, pin_change_required: false, owner_count: 1 });
      await expectSingleBootstrapStore();
    } finally {
      if (barrier) { await barrier.query("rollback").catch(() => undefined); await barrier.end(); }
      await secondContext.close();
    }
  });

  test("TC-PIN-15 menu fault keeps cashier edit and two owners race explicit retry", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const startedAt = Date.now();
    const mark = (phase: string) => console.info(JSON.stringify({ event: "TC15_FAULT_PHASE", phase, elapsedMs: Date.now() - startedAt }));
    const storeKey = await createAndChangePin(page);
    mark("created");
    const secondContext = await browser.newContext();
    let barrier: pg.Client | undefined;
    let retryPromises: Promise<unknown>[] = [];
    try {
      await installTc15MenuFault();
      mark("fault_installed");
      await loginWithNewPin(page);
      await expect(page.getByTestId("retry-initial-seed")).toBeVisible({ timeout: 20_000 });
      mark("fault_observed");
      const failed = (await fixture!.db.query(`select status,last_error_code,
        workflow_revision::int revision,run_generation::int generation
        from private.initial_seed_workflows where store_id=$1`, [fixture!.storeId])).rows[0];
      expect(failed).toEqual({ status: "needs_retry", last_error_code: "PERMISSION_UPDATE_UNAVAILABLE", revision: 3, generation: 1 });
      expect((await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "pending", "pending"]);
      const failedGraph = await stageSnapshot();
      expect(failedGraph.counts).toEqual({ employees: 1, categories: 0, menu_items: 0, option_groups: 0,
        option_values: 0, menu_links: 0, areas: 0, tables: 0, decor: 0 });
      await editCommittedStageThroughUi(page, "employee", () => undefined);
      mark("cashier_edited");
      const edited = await stageReplayEvidence("employee");
      expect(edited.cashier_new_pin).toBe(true);
      expect(edited.cashier_old_pin).toBe(false);
      await removeTc15MenuFault();
      mark("fault_removed");

      const second = await secondContext.newPage();
      await pairSecondOwner(second, storeKey);
      await page.reload();
      await expect(page.getByTestId("passcode-screen")).toBeVisible();
      const calls: Stage[] = [];
      const requests: string[] = [];
      const outcomes: Array<{ httpStatus: number; acquired?: boolean; generation?: number; error?: string }> = [];
      for (const [index, ownerPage] of [page, second].entries()) {
        ownerPage.on("request", request => {
          if (request.url().includes("/rpc/permission_run_initial_seed_stage"))
            calls.push(request.postDataJSON()?.p_request?.stage as Stage);
        });
        await ownerPage.route("**/rest/v1/rpc/permission_begin_initial_seed", async route => {
          const payload = route.request().postDataJSON()?.p_request;
          expect(payload).toMatchObject({ mode: "retry", expectedWorkflowRevision: 3 });
          requests.push(String(index));
          console.info(JSON.stringify({ event: "TC15_RETRY_REQUEST", owner: index,
            mode: payload?.mode ?? null, revision: payload?.expectedWorkflowRevision ?? null }));
          const response = await route.fetch();
          const body = await response.json() as { data?: { acquired?: boolean; runGeneration?: number }; error?: { code?: string }; code?: string };
          outcomes.push({ httpStatus: response.status(), acquired: body.data?.acquired,
            generation: body.data?.runGeneration, error: body.error?.code ?? body.code });
          await route.fulfill({ response });
        });
      }
      await loginWithNewPin(page);
      await loginWithNewPin(second);
      mark("relogged_twice");
      await expect(page.getByTestId("retry-initial-seed")).toBeVisible();
      await expect(second.getByTestId("retry-initial-seed")).toBeVisible();
      await second.bringToFront();
      await page.mouse.move(0, 0);
      await second.mouse.move(0, 0);
      const hitTarget = async (ownerPage: Page) => ownerPage.evaluate(() => {
        const button = document.querySelector<HTMLElement>('[data-testid="retry-initial-seed"]');
        if (!button) return false;
        const rect = button.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return top === button || button.contains(top);
      });
      await expect.poll(() => hitTarget(page), { timeout: 30_000 }).toBe(true);
      await expect.poll(() => hitTarget(second), { timeout: 30_000 }).toBe(true);
      mark("retry_buttons_hittable");
      const beforeRetry = await seedReadOnlySnapshot();
      await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
      await second.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
      expect(await seedReadOnlySnapshot() === beforeRetry).toBe(true);
      expect(calls).toEqual([]);
      barrier = await holdTc15StoreMutex();
      mark("barrier_held");
      await expect(page.getByTestId("retry-initial-seed")).toBeEnabled();
      await expect(second.getByTestId("retry-initial-seed")).toBeEnabled();
      const firstRetry = page.getByTestId("retry-initial-seed").click({ timeout: 10_000 });
      const secondRetry = second.getByTestId("retry-initial-seed").click({ timeout: 10_000 });
      retryPromises = [firstRetry, secondRetry];
      await expect.poll(() => requests.length, { timeout: 15_000 }).toBe(2);
      mark("two_retry_requests");
      expect(outcomes).toEqual([]);
      expect(await seedReadOnlySnapshot() === beforeRetry).toBe(true);
      await barrier.query("commit");
      mark("barrier_released");
      await Promise.all([firstRetry, secondRetry]);
      mark("clicks_settled");
      console.info(JSON.stringify({ event: "TC15_RETRY_HTTP_SUMMARY", responses: outcomes }));
      await expect.poll(async () => (await stageSnapshot()).stages.map(row => row.status), { timeout: 20_000 })
        .toEqual(["committed", "committed", "committed"]);
      mark("stages_completed");
      expect(outcomes.every(row => row.httpStatus === 200)).toBe(true);
      expect(outcomes).toHaveLength(2);
      expect(outcomes.filter(row => row.acquired)).toEqual([{ httpStatus: 200, acquired: true, generation: 2, error: undefined }]);
      expect(outcomes.filter(row => row.error === "INITIAL_SEED_ATTEMPT_STALE")).toHaveLength(1);
      expect(calls).toEqual(["menu", "floor"]);
      const completed = (await fixture!.db.query(`select status,workflow_revision::int revision,
        run_generation::int generation,last_error_code from private.initial_seed_workflows where store_id=$1`,
        [fixture!.storeId])).rows[0];
      expect(completed).toEqual({ status: "completed", revision: 6, generation: 2, last_error_code: null });
      const preserved = await stageReplayEvidence("employee");
      expect({ stage_id: preserved.stage_id, receipt: preserved.receipt, committed_at: preserved.committed_at,
        cashier_revision: preserved.cashier_revision, cashier_new_pin: preserved.cashier_new_pin,
        cashier_old_pin: preserved.cashier_old_pin })
        .toEqual({ stage_id: edited.stage_id, receipt: edited.receipt, committed_at: edited.committed_at,
          cashier_revision: edited.cashier_revision, cashier_new_pin: edited.cashier_new_pin,
          cashier_old_pin: edited.cashier_old_pin });
      expect(await ownerIdentityEvidence()).toMatchObject({ new_pin: true, old_pin: false, pin_change_required: false, owner_count: 1 });
      await expectSingleBootstrapStore();
    } finally {
      if (barrier) { await barrier.query("rollback").catch(() => undefined); await barrier.end(); }
      await Promise.allSettled(retryPromises);
      await secondContext.close();
    }
  });

  test("TC-PIN-15 retry reclaim waits behind locked menu stage and returns stale", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const storeKey = await createAndChangePin(page);
    const secondContext = await browser.newContext();
    let catalog: { barrier: pg.Client; pid: number } | undefined;
    let secondRetry: Promise<APIResponse> | undefined;
    try {
      await installTc15MenuFault();
      await loginWithNewPin(page);
      await expect(page.getByTestId("retry-initial-seed")).toBeVisible({ timeout: 20_000 });
      expect((await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "pending", "pending"]);
      await editCommittedStageThroughUi(page, "employee", () => undefined);
      const edited = await stageReplayEvidence("employee");
      await removeTc15MenuFault();
      const second = await secondContext.newPage();
      await pairSecondOwner(second, storeKey);
      await page.reload();
      await expect(page.getByTestId("passcode-screen")).toBeVisible();
      let secondHeaders: Record<string, string> | undefined;
      let menuRequests = 0;
      let firstBegin = 0;
      page.on("request", request => {
        if (request.url().includes("/rpc/permission_begin_initial_seed")) firstBegin += 1;
        if (request.url().includes("/rpc/permission_run_initial_seed_stage")
          && request.postDataJSON()?.p_request?.stage === "menu") menuRequests += 1;
      });
      second.on("request", request => {
        if (!request.url().includes("/rpc/permission_get_initial_seed_status")) return;
        const headers = request.headers();
        if (headers["x-pos-employee-token"] && headers.authorization && headers.apikey) {
          secondHeaders = { authorization: headers.authorization, apikey: headers.apikey,
            "x-pos-employee-token": headers["x-pos-employee-token"],
            "x-pos-permission-contract": "2", "content-type": "application/json" };
        }
      });
      await loginWithNewPin(page);
      await loginWithNewPin(second);
      await expect(page.getByTestId("retry-initial-seed")).toBeVisible();
      await expect(second.getByTestId("retry-initial-seed")).toBeVisible();
      expect(!!secondHeaders).toBe(true);
      expect(firstBegin).toBe(0);
      const before = await seedReadOnlySnapshot();
      await page.mouse.move(0, 0);
      await expect.poll(async () => page.evaluate(() => {
        const button = document.querySelector<HTMLElement>('[data-testid="retry-initial-seed"]');
        if (!button) return false;
        const rect = button.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return top === button || button.contains(top);
      }), { timeout: 20_000 }).toBe(true);
      catalog = await holdTc15CatalogWrite();
      await page.getByTestId("retry-initial-seed").click();
      await expect.poll(() => menuRequests, { timeout: 15_000 }).toBe(1);
      expect(firstBegin).toBe(1);
      await expect.poll(async () => (await fixture!.db.query(`select count(*)::int n from pg_stat_activity
        where $1=any(pg_blocking_pids(pid)) and wait_event_type='Lock'`, [catalog!.pid])).rows[0].n,
      { timeout: 10_000 }).toBeGreaterThan(0);
      const duringStage = (await fixture!.db.query(`select status,workflow_revision::int revision,
        run_generation::int generation from private.initial_seed_workflows where store_id=$1`, [fixture!.storeId])).rows[0];
      expect(duringStage).toEqual({ status: "in_progress", revision: 4, generation: 2 });
      secondRetry = second.request.post(`${env.api}/rest/v1/rpc/permission_begin_initial_seed`, {
        headers: secondHeaders!, data: { p_request: { mode: "retry", expectedWorkflowRevision: 4 } },
        timeout: 30_000,
      });
      await expect.poll(async () => (await fixture!.db.query(`select count(*)::int n from pg_stat_activity
        where wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0`)).rows[0].n,
      { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
      expect((await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "pending", "pending"]);
      await catalog.barrier.query("commit");
      const retryResponse = await secondRetry;
      expect(retryResponse.ok()).toBe(true);
      const body = await retryResponse.json() as { error?: { code?: string } };
      expect(body.error?.code).toBe("INITIAL_SEED_ATTEMPT_STALE");
      await expect.poll(async () => (await stageSnapshot()).stages.map(row => row.status), { timeout: 20_000 })
        .toEqual(["committed", "committed", "committed"]);
      const completed = (await fixture!.db.query(`select status,workflow_revision::int revision,
        run_generation::int generation from private.initial_seed_workflows where store_id=$1`, [fixture!.storeId])).rows[0];
      expect(completed).toEqual({ status: "completed", revision: 6, generation: 2 });
      const preserved = await stageReplayEvidence("employee");
      expect({ stage_id: preserved.stage_id, receipt: preserved.receipt, committed_at: preserved.committed_at,
        cashier_revision: preserved.cashier_revision, cashier_new_pin: preserved.cashier_new_pin,
        cashier_old_pin: preserved.cashier_old_pin })
        .toEqual({ stage_id: edited.stage_id, receipt: edited.receipt, committed_at: edited.committed_at,
          cashier_revision: edited.cashier_revision, cashier_new_pin: edited.cashier_new_pin,
          cashier_old_pin: edited.cashier_old_pin });
      expect(before === await seedReadOnlySnapshot()).toBe(false);
      await expectSingleBootstrapStore();
    } finally {
      if (catalog) { await catalog.barrier.query("rollback").catch(() => undefined); await catalog.barrier.end(); }
      if (secondRetry) await Promise.allSettled([secondRetry]);
      await secondContext.close();
    }
  });

  for (const collisionStage of ["menu", "floor"] as const) {
    test(`TC-PIN-15 ${collisionStage} deterministic collision preserves row and rejects stale stage before retry`, async ({ page }) => {
      test.setTimeout(180_000);
      await createAndChangePin(page);
      const state = fixture!;
      const relation = collisionStage === "menu" ? "categories" : "floor_areas";
      const seedKey = collisionStage === "menu" ? "demo.category.cat-coffee" : "demo.area.area-ground";
      await assertFixtureBinding(state.db);
      const collisionId = (await state.db.query("select private.permission_seed_uuid($1,$2) id", [state.storeId, seedKey])).rows[0].id;
      const inserted = await state.db.query(`insert into public.${relation}(id,store_id,name,sort_order,seed_key)
        values($1,$2,'TC15 collision',99,null) returning id`, [collisionId, state.storeId]);
      expect(inserted.rowCount).toBe(1);
      const calls: Stage[] = [];
      let begins = 0;
      let normalHeaders: Record<string, string> | undefined;
      page.on("request", request => {
        if (request.url().includes("/rpc/permission_begin_initial_seed")) begins += 1;
        if (request.url().includes("/rpc/permission_run_initial_seed_stage"))
          calls.push(request.postDataJSON()?.p_request?.stage as Stage);
        if (request.url().includes("/rpc/permission_get_initial_seed_status")) {
          const headers = request.headers();
          if (headers["x-pos-employee-token"] && headers.authorization && headers.apikey) {
            normalHeaders = { authorization: headers.authorization, apikey: headers.apikey,
              "x-pos-employee-token": headers["x-pos-employee-token"],
              "x-pos-permission-contract": "2", "content-type": "application/json" };
          }
        }
      });
      let releaseStage: (() => void) | undefined;
      try {
        await loginWithNewPin(page);
        await expect(page.getByTestId("retry-initial-seed")).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId("initial-seed-status"))
          .toContainText("Dữ liệu hiện có trùng với dữ liệu mẫu. Đã dừng để giữ các thay đổi của quán.");
        const failed = (await state.db.query(`select status,last_error_code,run_generation::int generation,
          workflow_revision::int revision from private.initial_seed_workflows where store_id=$1`, [state.storeId])).rows[0];
        expect(failed).toEqual({ status: "needs_retry", last_error_code: "ENTITY_ID_CONFLICT", generation: 1,
          revision: collisionStage === "menu" ? 3 : 4 });
        if (collisionStage === "menu") {
          mkdirSync(tc18ArtifactDirectory, { recursive: true });
          writeFileSync(join(tc18ArtifactDirectory, "entity-context.png"), await page.screenshot());
        }
        const stages = (await stageSnapshot()).stages;
        expect(stages.map(row => row.status)).toEqual(collisionStage === "menu"
          ? ["committed", "pending", "pending"] : ["committed", "committed", "pending"]);
        const pendingStage = (await state.db.query(`select s.stage_id,s.status,s.receipt,s.committed_at
          from private.initial_seed_stages s join private.initial_seed_workflows w using(workflow_id)
          where w.store_id=$1 and s.stage=$2`, [state.storeId, collisionStage])).rows[0];
        expect(pendingStage).toMatchObject({ status: "pending", receipt: null, committed_at: null });
        expect((await state.db.query(`select name,seed_key from public.${relation} where id=$1`, [collisionId])).rows[0])
          .toEqual({ name: "TC15 collision", seed_key: null });
        const graph = (await stageSnapshot()).counts;
        if (collisionStage === "menu") expect(graph).toMatchObject({ employees: 1, categories: 0, menu_items: 0,
          option_groups: 0, option_values: 0, menu_links: 0, areas: 0, tables: 0, decor: 0 });
        else expect(graph).toMatchObject({ employees: 1, categories: 2, menu_items: 6, option_groups: 2,
          option_values: 4, menu_links: 3, areas: 0, tables: 0, decor: 0 });
        const snapshotBeforeReload = await seedReadOnlySnapshot();
        const callsBeforeReload = [...calls];
        const beginsBeforeReload = begins;
        await page.reload();
        await expect(page.getByTestId("passcode-screen")).toBeVisible();
        await loginWithNewPin(page);
        await expect(page.getByTestId("retry-initial-seed")).toBeVisible();
        expect(await seedReadOnlySnapshot() === snapshotBeforeReload).toBe(true);
        expect(calls).toEqual(callsBeforeReload);
        expect(begins).toBe(beginsBeforeReload);
        const deleted = await state.db.query(`delete from public.${relation}
          where id=$1 and store_id=$2 and name='TC15 collision' and seed_key is null returning id`,
          [collisionId, state.storeId]);
        expect(deleted.rowCount).toBe(1);
        expect(!!normalHeaders).toBe(true);
        let stageHeld = false;
        const gate = new Promise<void>(resolve => { releaseStage = resolve; });
        await page.route("**/rest/v1/rpc/permission_run_initial_seed_stage", async route => {
          const stage = route.request().postDataJSON()?.p_request?.stage as Stage;
          if (stage === collisionStage && !stageHeld) { stageHeld = true; await gate; }
          await route.continue();
        });
        await page.mouse.move(0, 0);
        const retry = page.getByTestId("retry-initial-seed");
        await expect(retry).toBeEnabled();
        await expect.poll(async () => page.evaluate(() => {
          const button = document.querySelector<HTMLElement>('[data-testid="retry-initial-seed"]');
          if (!button) return false;
          const rect = button.getBoundingClientRect();
          const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return top === button || button.contains(top);
        }), { timeout: 20_000 }).toBe(true);
        await retry.click();
        await expect.poll(() => stageHeld, { timeout: 15_000 }).toBe(true);
        const runGeneration = (await state.db.query(`select run_generation::int generation from private.initial_seed_workflows
          where store_id=$1`, [state.storeId])).rows[0].generation;
        expect(runGeneration).toBe(2);
        const beforeDenied = await seedReadOnlySnapshot();
        const deniedCalls: Array<{ stage: Stage; generation: number }> = [
          { stage: collisionStage, generation: 1 },
          ...(collisionStage === "menu" ? [{ stage: "floor" as Stage, generation: 2 }] : []),
        ];
        for (const denied of deniedCalls) {
          const response = await page.request.post(`${env.api}/rest/v1/rpc/permission_run_initial_seed_stage`, {
            headers: normalHeaders!, data: { p_request: { stage: denied.stage, runGeneration: denied.generation } },
          });
          expect(response.ok()).toBe(true);
          const body = await response.json() as { error?: { code?: string } };
          expect(body.error?.code).toBe("INITIAL_SEED_ATTEMPT_STALE");
          expect(await seedReadOnlySnapshot() === beforeDenied).toBe(true);
        }
        releaseStage?.();
        await expect.poll(async () => (await stageSnapshot()).stages.map(row => row.status), { timeout: 20_000 })
          .toEqual(["committed", "committed", "committed"]);
        const committedStage = (await state.db.query(`select s.stage_id,s.status,s.receipt,s.committed_at
          from private.initial_seed_stages s join private.initial_seed_workflows w using(workflow_id)
          where w.store_id=$1 and s.stage=$2`, [state.storeId, collisionStage])).rows[0];
        expect(committedStage.stage_id).toBe(pendingStage.stage_id);
        expect(committedStage).toMatchObject({ status: "committed",
          receipt: { stage: collisionStage, stageId: pendingStage.stage_id, runGeneration: 2 } });
        expect(committedStage.committed_at).not.toBeNull();
        expect(calls.slice(callsBeforeReload.length)).toEqual(collisionStage === "menu" ? ["menu", "floor"] : ["floor"]);
        expect((await state.db.query(`select count(*)::int n from public.${relation} where id=$1`, [collisionId])).rows[0].n).toBe(1);
        expect((await state.db.query(`select name,seed_key from public.${relation} where id=$1`, [collisionId])).rows[0].seed_key).toBe(seedKey);
        expect((await stageSnapshot()).counts).toEqual({ employees: 1, categories: 2, menu_items: 6,
          option_groups: 2, option_values: 4, menu_links: 3, areas: 1, tables: 4, decor: 7 });
        expect(await ownerIdentityEvidence()).toMatchObject({ new_pin: true, old_pin: false, pin_change_required: false, owner_count: 1 });
        await expectSingleBootstrapStore();
      } finally { releaseStage?.(); }
    });
  }

  test("TC-PIN-16 owner recovery between stages revokes runner and waits for explicit retry", async ({ page }) => {
    test.setTimeout(180_000);
    await createAndChangePin(page);
    const state = fixture!;
    const ownerId = (await state.db.query("select id from public.employees where store_id=$1 and role='owner'", [state.storeId])).rows[0].id;
    let oldHeaders: Record<string, string> | undefined;
    page.on("request", request => {
      if (!request.url().includes("/rpc/permission_get_initial_seed_status")) return;
      const headers = request.headers();
      if (headers["x-pos-employee-token"] && headers.authorization && headers.apikey) {
        oldHeaders = { authorization: headers.authorization, apikey: headers.apikey,
          "x-pos-employee-token": headers["x-pos-employee-token"],
          "x-pos-permission-contract": "2", "content-type": "application/json" };
      }
    });
    await installTc15MenuFault();
    await loginWithNewPin(page);
    await expect(page.getByTestId("retry-initial-seed")).toBeVisible({ timeout: 20_000 });
    expect(!!oldHeaders).toBe(true);
    expect((await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "pending", "pending"]);
    const employeeBefore = await stageReplayEvidence("employee");
    await removeTc15MenuFault();
    await assertFixtureBinding(state.db);
    await state.db.query("begin");
    try {
      const recoveryMembership = (await state.db.query(`select m.grantor::regrole::text grantor,
        m.set_option,m.admin_option,m.inherit_option
        from pg_auth_members m where m.roleid='pos_owner_recovery'::regrole
          and m.member=current_user::regrole`)).rows;
      expect(recoveryMembership).toEqual([{ grantor: "supabase_admin", set_option: false,
        admin_option: true, inherit_option: false }]);
      await state.db.query("grant pos_owner_recovery to postgres with set true");
      await state.db.query("set local role pos_owner_recovery");
      const recovered = (await state.db.query("select private.permission_recover_owner($1) result", [{
        requestId: randomUUID(), storeId: state.storeId, targetId: ownerId,
        operatorRef: "tc16-local", caseRef: "tc16-recovery-001", proofRef: "tc16-proof-001", newPin: "927416",
      }])).rows[0].result;
      expect(recovered).toMatchObject({ ok: true, outcome: "applied" });
      await state.db.query("reset role");
      await state.db.query("revoke pos_owner_recovery from postgres granted by postgres");
      expect((await state.db.query(`select m.grantor::regrole::text grantor,
        m.set_option,m.admin_option,m.inherit_option from pg_auth_members m
        where m.roleid='pos_owner_recovery'::regrole and m.member=current_user::regrole`)).rows)
        .toEqual(recoveryMembership);
      await state.db.query("commit");
    } catch (error) {
      await state.db.query("rollback").catch(() => undefined);
      throw error;
    }
    const afterRecovery = (await state.db.query(`select pin_change_required,
      passcode_hash=extensions.crypt('927416',passcode_hash) recovery_pin,
      passcode_hash=extensions.crypt($2,passcode_hash) previous_pin
      from public.employees where id=$1`, [ownerId, NEW_PIN])).rows[0];
    expect(afterRecovery).toEqual({ pin_change_required: true, recovery_pin: true, previous_pin: false });
    const recoverySnapshot = await seedReadOnlySnapshot();
    for (const name of ["permission_get_initial_seed_status", "permission_run_initial_seed_stage"]) {
      const response = await page.request.post(`${env.api}/rest/v1/rpc/${name}`, {
        headers: oldHeaders!, data: name === "permission_run_initial_seed_stage"
          ? { p_request: { stage: "menu", runGeneration: 1 } } : {},
      });
      expect(response.ok()).toBe(true);
      expect((await response.json()).error?.code).toBe("EMPLOYEE_SESSION_REQUIRED");
      expect(await seedReadOnlySnapshot()).toBe(recoverySnapshot);
    }
    expect((await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "pending", "pending"]);

    let restrictedHeaders: Record<string, string> | undefined;
    page.on("request", request => {
      if (!request.url().includes("/rpc/permission_check_required_pin_session")) return;
      const headers = request.headers();
      if (headers["x-pos-employee-token"] && headers.authorization && headers.apikey) {
        restrictedHeaders = { authorization: headers.authorization, apikey: headers.apikey,
          "x-pos-employee-token": headers["x-pos-employee-token"],
          "x-pos-permission-contract": "2", "content-type": "application/json" };
      }
    });
    await page.reload();
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
    await page.locator('[data-testid^="employee-"]').first().click();
    for (const digit of "927416") await page.getByTestId(`pin-${digit}`).click();
    await page.getByTestId("unlock-button").click();
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    await expect.poll(() => !!restrictedHeaders).toBe(true);
    const beforeRestricted = await seedReadOnlySnapshot();
    for (const name of ["permission_get_initial_seed_status", "permission_begin_initial_seed", "permission_run_initial_seed_stage"]) {
      const data = name === "permission_get_initial_seed_status" ? {}
        : { p_request: name === "permission_begin_initial_seed"
          ? { mode: "retry", expectedWorkflowRevision: 3 } : { stage: "menu", runGeneration: 1 } };
      const response = await page.request.post(`${env.api}/rest/v1/rpc/${name}`, { headers: restrictedHeaders!, data });
      expect(response.ok()).toBe(true);
      expect((await response.json()).error?.code).toBe("PIN_CHANGE_REQUIRED");
      expect(await seedReadOnlySnapshot()).toBe(beforeRestricted);
    }

    await page.getByTestId("required-new-pin").fill("765432");
    await page.getByTestId("required-confirm-pin").fill("765432");
    await page.getByTestId("complete-required-pin").click();
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
    const beforeNormalLogin = await seedReadOnlySnapshot();
    const beginStages: string[] = [];
    page.on("request", request => {
      if (request.url().includes("/rpc/permission_begin_initial_seed")) beginStages.push("begin");
      if (request.url().includes("/rpc/permission_run_initial_seed_stage")) beginStages.push("stage");
    });
    await page.locator('[data-testid^="employee-"]').first().click();
    for (const digit of "765432") await page.getByTestId(`pin-${digit}`).click();
    await page.getByTestId("unlock-button").click();
    await expect(page.getByTestId("floor-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("retry-initial-seed")).toBeVisible();
    await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
    expect(beginStages).toEqual([]);
    expect(await seedReadOnlySnapshot()).toBe(beforeNormalLogin);
    expect((await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "pending", "pending"]);
    await page.mouse.move(0, 0);
    await expect.poll(async () => page.evaluate(() => {
      const button = document.querySelector<HTMLElement>('[data-testid="retry-initial-seed"]');
      if (!button) return false;
      const rect = button.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return top === button || button.contains(top);
    }), { timeout: 20_000 }).toBe(true);
    await page.getByTestId("retry-initial-seed").click();
    await expect.poll(async () => (await stageSnapshot()).stages.map(row => row.status), { timeout: 20_000 })
      .toEqual(["committed", "committed", "committed"]);
    expect(beginStages).toEqual(["begin", "stage", "stage"]);
    const workflow = (await state.db.query(`select status,workflow_revision::int revision,run_generation::int generation
      from private.initial_seed_workflows where store_id=$1`, [state.storeId])).rows[0];
    expect(workflow).toEqual({ status: "completed", revision: 6, generation: 2 });
    const employeeAfter = await stageReplayEvidence("employee");
    expect({ stage_id: employeeAfter.stage_id, receipt: employeeAfter.receipt, committed_at: employeeAfter.committed_at })
      .toEqual({ stage_id: employeeBefore.stage_id, receipt: employeeBefore.receipt, committed_at: employeeBefore.committed_at });
    const ownerAfter = (await state.db.query(`select pin_change_required,
      passcode_hash=extensions.crypt('765432',passcode_hash) final_pin,
      passcode_hash=extensions.crypt('927416',passcode_hash) recovery_pin,
      passcode_hash=extensions.crypt($2,passcode_hash) previous_pin
      from public.employees where id=$1`, [ownerId, NEW_PIN])).rows[0];
    expect(ownerAfter).toEqual({ pin_change_required: false, final_pin: true, recovery_pin: false, previous_pin: false });
    await expectSingleBootstrapStore();
  });

  test("TC-PIN-16 all-override nonowners and foreign owner cannot mutate seed; legacy routes stay closed", async ({ page }) => {
    test.setTimeout(180_000);
    await createAndChangePin(page);
    const state = fixture!;
    let ownerHeaders: Record<string, string> | undefined;
    page.on("request", request => {
      if (!request.url().includes("/rpc/permission_get_initial_seed_status")) return;
      const headers = request.headers();
      if (headers["x-pos-employee-token"] && headers.authorization && headers.apikey) {
        ownerHeaders = { authorization: headers.authorization, apikey: headers.apikey,
          "x-pos-employee-token": headers["x-pos-employee-token"],
          "x-pos-permission-contract": "2", "content-type": "application/json" };
      }
    });
    await installTc15MenuFault();
    await loginWithNewPin(page);
    await expect(page.getByTestId("retry-initial-seed")).toBeVisible({ timeout: 20_000 });
    await removeTc15MenuFault();
    expect(!!ownerHeaders).toBe(true);
    expect((await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "pending", "pending"]);
    const grants = (await state.db.query("select code from public.permission_catalog where not owner_only order by code"))
      .rows.map(row => row.code as string);
    expect(grants).toHaveLength(14);
    const overrides = { grants, denies: [] as string[] };
    const cashierId = (await state.db.query(`select id from public.employees
      where store_id=$1 and seed_key='demo.employee.demo-emp-cashier'`, [state.storeId])).rows[0].id;
    const managerId = randomUUID();
    await assertFixtureBinding(state.db);
    expect((await state.db.query("update public.employees set permission_overrides=$2 where id=$1 returning id",
      [cashierId, overrides])).rowCount).toBe(1);
    expect((await state.db.query(`insert into public.employees(id,store_id,name,role,passcode_hash,permission_overrides)
      values($1,$2,'TC16 manager','manager',extensions.crypt('246810',extensions.gen_salt('bf')),$3) returning id`,
    [managerId, state.storeId, overrides])).rowCount).toBe(1);
    const effective = (await state.db.query(`select id,private.configured_employee_permissions(role,permission_overrides) permissions
      from public.employees where id=any($1::uuid[]) order by id`, [[cashierId, managerId]])).rows;
    expect(effective).toHaveLength(2);
    expect(effective.map(row => [...row.permissions].sort())).toEqual([grants, grants]);
    const storeHeaders = { authorization: ownerHeaders!.authorization, apikey: ownerHeaders!.apikey,
      "x-pos-permission-contract": "2", "content-type": "application/json" };
    const callers = [{ id: cashierId, pin: "111111" }, { id: managerId, pin: "246810" }];
    const beforeDenials = await seedReadOnlySnapshot();
    for (const caller of callers) {
      const login = await page.request.post(`${env.api}/rest/v1/rpc/permission_start_session`, {
        headers: storeHeaders, data: { p_employee_id: caller.id, p_pin: caller.pin },
      });
      expect(login.ok()).toBe(true);
      const session = await login.json() as { ok?: boolean; kind?: string; token?: string };
      expect(session).toMatchObject({ ok: true, kind: "normal" });
      expect(typeof session.token).toBe("string");
      const headers = { ...storeHeaders, "x-pos-employee-token": session.token! };
      const beforeCaller = await seedSessionSnapshot();
      for (const name of ["permission_get_initial_seed_status", "permission_begin_initial_seed", "permission_run_initial_seed_stage"]) {
        const data = name === "permission_get_initial_seed_status" ? {}
          : { p_request: name === "permission_begin_initial_seed"
            ? { mode: "retry", expectedWorkflowRevision: 3 } : { stage: "menu", runGeneration: 1 } };
        const response = await page.request.post(`${env.api}/rest/v1/rpc/${name}`, { headers, data });
        expect(response.ok()).toBe(true);
        expect((await response.json()).error?.code).toBe("FORBIDDEN");
        expect(await seedReadOnlySnapshot()).toBe(beforeDenials);
        expect(await seedSessionSnapshot()).toBe(beforeCaller);
      }
    }

    const legacySignatures = ["public.seed_demo_employee(uuid)", "public.seed_demo_menu()", "public.seed_demo_floor()"];
    for (const signature of legacySignatures) {
      expect((await state.db.query("select to_regprocedure($1) existing", [signature])).rows[0].existing).toBeNull();
      const name = signature.slice("public.".length, signature.indexOf("("));
      const response = await page.request.post(`${env.api}/rest/v1/rpc/${name}`, {
        headers: ownerHeaders!, data: name === "seed_demo_employee" ? { p_owner_id: cashierId } : {},
      });
      expect(response.status()).toBe(404);
      expect((await response.json()).code).toBe("PGRST202");
      expect(await seedReadOnlySnapshot()).toBe(beforeDenials);
    }

    const s1BeforeForeign = await seedReadOnlySnapshot();
    const s1SessionsBeforeForeign = await seedSessionSnapshot();
    const foreignStoreId = randomUUID();
    const foreignOwnerId = randomUUID();
    const foreignStoreNo = 2_000_000_000 + Math.floor(Math.random() * 1_000_000);
    const sqlActor = async (storeId: string, token?: string) => {
      await state.db.query("select set_config('request.jwt.claims',$1,true),set_config('request.headers',$2,true)", [
        JSON.stringify({ sub: storeId, role: "authenticated" }), JSON.stringify({ "x-pos-employee-token": token ?? "" }),
      ]);
    };
    const sqlCall = async (name: string, pRequest?: object) => {
      const result = await state.db.query(pRequest === undefined
        ? `select public.${name}() result` : `select public.${name}($1) result`, pRequest === undefined ? [] : [pRequest]);
      return result.rows[0].result as { ok?: boolean; error?: { code?: string }; data?: any; token?: string; kind?: string };
    };
    await assertFixtureBinding(state.db);
    await state.db.query("begin");
    try {
      await state.db.query("insert into auth.users(id,email) values($1,$2)",
        [foreignStoreId, `store${foreignStoreNo}@store.pos.local`]);
      await sqlActor(foreignStoreId);
      const boot = await sqlCall("permission_bootstrap_store", { requestId: randomUUID(), ownerId: foreignOwnerId,
        storeNo: foreignStoreNo, displayName: "A", address: "", seedDemo: false });
      expect(boot).toMatchObject({ ok: true, data: { storeId: foreignStoreId, ownerId: foreignOwnerId,
        storeNo: foreignStoreNo, seedRequested: false } });
      const restricted = (await state.db.query("select public.permission_start_session($1,$2) result",
        [foreignOwnerId, TEMP_PIN])).rows[0].result as { ok?: boolean; kind?: string; token?: string };
      expect(restricted).toMatchObject({ ok: true, kind: "required_pin_change" });
      await sqlActor(foreignStoreId, restricted.token);
      expect(await sqlCall("permission_complete_required_pin_change", {
        requestId: randomUUID(), expectedRevision: 0, newPin: NEW_PIN,
      })).toMatchObject({ ok: true });
      await sqlActor(foreignStoreId);
      const normal = (await state.db.query("select public.permission_start_session($1,$2) result",
        [foreignOwnerId, NEW_PIN])).rows[0].result as { ok?: boolean; kind?: string; token?: string };
      expect(normal).toMatchObject({ ok: true, kind: "normal" });
      await sqlActor(foreignStoreId, normal.token);
      expect(await sqlCall("permission_get_initial_seed_status")).toMatchObject({ ok: true,
        data: { status: "skipped", stages: [] } });
      expect(await sqlCall("permission_begin_initial_seed", { mode: "initial", expectedWorkflowRevision: 0 }))
        .toMatchObject({ ok: true, data: { acquired: false, status: "skipped" } });
      expect((await sqlCall("permission_run_initial_seed_stage", { stage: "employee", runGeneration: 0 })).error?.code)
        .toBe("INITIAL_SEED_ATTEMPT_STALE");
      expect((await sqlCall("permission_begin_initial_seed", { mode: "retry", expectedWorkflowRevision: 3,
        storeId: state.storeId })).error?.code).toBe("INVALID_WRITE_REQUEST");
      await sqlActor(state.storeId!, normal.token);
      for (const [name, request] of [["permission_get_initial_seed_status", undefined],
        ["permission_begin_initial_seed", { mode: "retry", expectedWorkflowRevision: 3 }],
        ["permission_run_initial_seed_stage", { stage: "menu", runGeneration: 1 }]] as const) {
        expect((await sqlCall(name, request)).error?.code).toBe("EMPLOYEE_SESSION_REQUIRED");
      }
      expect(await seedReadOnlySnapshot()).toBe(s1BeforeForeign);
      expect(await seedSessionSnapshot()).toBe(s1SessionsBeforeForeign);
    } finally {
      await state.db.query("rollback").catch(() => undefined);
    }
    expect(await seedReadOnlySnapshot()).toBe(s1BeforeForeign);
    expect(await seedSessionSnapshot()).toBe(s1SessionsBeforeForeign);
    await expectSingleBootstrapStore();
  });

  test("TC-PIN-17 normal owner PIN and cashier administration preserve sessions and role ceiling", async ({ page }) => {
    test.setTimeout(180_000);
    await createAndChangePin(page);
    const state = fixture!;
    let capturedHeaders: Record<string, string> | undefined;
    page.on("request", request => {
      if (!request.url().includes("/rpc/permission_get_initial_seed_status")) return;
      const headers = request.headers();
      if (headers.authorization && headers.apikey && headers["x-pos-employee-token"]) {
        capturedHeaders = { authorization: headers.authorization, apikey: headers.apikey,
          "x-pos-permission-contract": "2", "content-type": "application/json" };
      }
    });
    await loginWithNewPin(page);
    expect(!!capturedHeaders).toBe(true);
    const storeHeaders = capturedHeaders!;
    const ownerId = (await state.db.query("select id from public.employees where store_id=$1 and role='owner'", [state.storeId])).rows[0]?.id;
    expect(typeof ownerId).toBe("string");
    const request = async (name: string, data: object, token?: string, marker = "2") => {
      const response = await page.request.post(`${env.api}/rest/v1/rpc/${name}`, {
        headers: { ...storeHeaders, "x-pos-permission-contract": marker,
          ...(token ? { "x-pos-employee-token": token } : {}) }, data,
      });
      return { status: response.status(), body: await response.json() as any };
    };
    const login = async (employeeId: string, pin: string) =>
      request("permission_start_session", { p_employee_id: employeeId, p_pin: pin });
    const ownerInitial = await login(ownerId, NEW_PIN);
    expect(ownerInitial).toMatchObject({ status: 200, body: { ok: true, kind: "normal", pinChangeRequired: false } });
    const toBaseline = await request("permission_change_own_pin", { p_request: {
      requestId: randomUUID(), expectedRevision: 1, currentPin: NEW_PIN, newPin: "384729",
    } }, ownerInitial.body.token);
    expect(toBaseline).toMatchObject({ status: 200, body: { ok: true, outcome: "applied",
      data: { credentialChanged: true, pinChangeRequired: false, employeeRevision: 2 } } });
    const normal = await login(ownerId, "384729");
    expect(normal).toMatchObject({ status: 200, body: { ok: true, kind: "normal", pinChangeRequired: false } });
    const ownerState = async () => (await state.db.query(`select e.passcode_hash,
      e.permission_revision::int revision,e.pin_change_required,
      (select coalesce(jsonb_agg(to_jsonb(s) order by s.token_hash),'[]'::jsonb) from private.employee_sessions s where s.employee_id=e.id) sessions,
      (select count(*)::int from public.employee_admin_audit a where a.store_id=e.store_id) audits,
      (select coalesce(jsonb_agg(to_jsonb(s) order by s.topic),'[]'::jsonb) from public.store_change_signals s where s.store_id=e.store_id) signals
      from public.employees e where e.id=$1`, [ownerId])).rows[0];
    const before = await ownerState();
    const noop = await request("permission_change_own_pin", { p_request: {
      requestId: randomUUID(), expectedRevision: 2, currentPin: "384729", newPin: "384729",
    } }, normal.body.token);
    expect(noop).toMatchObject({ status: 200, body: { ok: true, outcome: "noop",
      data: { credentialChanged: false, pinChangeRequired: false, employeeRevision: 2 } } });
    const afterNoop = await ownerState();
    expect(afterNoop.passcode_hash === before.passcode_hash).toBe(true);
    expect(afterNoop.sessions).toEqual(before.sessions);
    expect(afterNoop.signals).toEqual(before.signals);
    expect(afterNoop.revision).toBe(2);
    expect(afterNoop.audits).toBe(before.audits + 1);
    expect((await request("permission_get_authority", {}, normal.body.token)).body.ok).toBe(true);
    const wrong = await request("permission_change_own_pin", { p_request: {
      requestId: randomUUID(), expectedRevision: 2, currentPin: "384728", newPin: "927416",
    } }, normal.body.token);
    expect(wrong).toMatchObject({ status: 200, body: { error: { code: "INVALID_PIN" } } });
    const afterWrong = await ownerState();
    expect(afterWrong.passcode_hash === before.passcode_hash).toBe(true);
    expect(afterWrong.sessions).toEqual(before.sessions);
    expect(afterWrong.signals).toEqual(before.signals);
    expect(afterWrong.revision).toBe(2);
    expect(afterWrong.audits).toBe(afterNoop.audits + 1);
    const changed = await request("permission_change_own_pin", { p_request: {
      requestId: randomUUID(), expectedRevision: 2, currentPin: "384729", newPin: "927416",
    } }, normal.body.token);
    expect(changed).toMatchObject({ status: 200, body: { ok: true, outcome: "applied",
      data: { credentialChanged: true, pinChangeRequired: false, employeeRevision: 3 } } });
    expect((await request("permission_get_authority", {}, normal.body.token)).body.error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
    expect((await login(ownerId, "384729")).body.error.code).toBe("INVALID_PIN");
    const ownerCurrent = await login(ownerId, "927416");
    expect(ownerCurrent).toMatchObject({ status: 200, body: { ok: true, kind: "normal", pinChangeRequired: false } });
    const afterChange = await ownerState();
    expect(afterChange.passcode_hash === before.passcode_hash).toBe(false);
    expect(afterChange.revision).toBe(3);
    expect(afterChange.pin_change_required).toBe(false);
    expect(afterChange.audits).toBe(afterWrong.audits + 1);

    const catalog = (await state.db.query("select code from public.permission_catalog order by code")).rows.map(row => row.code);
    const expectedCatalog = ["floor.view", "order.create", "order.update", "order.voidOpen", "payment.take",
      "orderHistory.view", "order.voidPaid", "menu.manage", "floor.manage", "employee.manage",
      "employee.permission.edit", "report.view", "settings.manage", "data.clearDemo", "receipt.reprint"].sort();
    const expectedCashier = ["floor.view", "order.create", "order.update", "order.voidOpen", "payment.take",
      "orderHistory.view", "receipt.reprint"].sort();
    expect(catalog).toEqual(expectedCatalog);
    const cashierId = randomUUID();
    const catalogRevision = (await state.db.query("select revision::int from public.permission_catalog_state where singleton")).rows[0].revision;
    const created = await request("permission_admin_create", { p_request: {
      requestId: randomUUID(), id: cashierId, name: "TC17 cashier", role: "cashier", pin: "111111",
      expectedCatalogRevision: catalogRevision,
    } }, ownerCurrent.body.token);
    expect(created).toMatchObject({ status: 200, body: { ok: true, outcome: "applied",
      data: { id: cashierId, role: "cashier", permissionRevision: 0, overrides: null } } });
    const cashierBefore = await login(cashierId, "111111");
    expect(cashierBefore).toMatchObject({ status: 200, body: { ok: true, kind: "normal", pinChangeRequired: false } });
    const cashierRow = async () => (await state.db.query(`select role,pin_change_required,permission_revision::int revision,
      private.configured_employee_permissions(role,permission_overrides) permissions
      from public.employees where id=$1`, [cashierId])).rows[0];
    expect(await cashierRow()).toMatchObject({ role: "cashier", pin_change_required: false, revision: 0 });
    expect(cashierBefore.body.authority.snapshot.permissions).toEqual(expectedCashier);
    expect((await cashierRow()).permissions).toEqual(expectedCashier);
    for (const marker of ["1", "0"]) {
      const incompatibleWrite = await request("permission_admin_reset_pin", { p_request: {
        requestId: randomUUID(), targetId: cashierId, expectedRevision: 0, newPin: "927416",
      } }, ownerCurrent.body.token, marker);
      expect(incompatibleWrite).toMatchObject({ status: 426, body: { code: "WRITE_PROTOCOL_UNSUPPORTED" } });
      expect(await cashierRow()).toMatchObject({ role: "cashier", pin_change_required: false, revision: 0 });
      expect((await login(cashierId, "111111")).body.kind).toBe("normal");
    }
    const reset = await request("permission_admin_reset_pin", { p_request: {
      requestId: randomUUID(), targetId: cashierId, expectedRevision: 0, newPin: "927416",
    } }, ownerCurrent.body.token);
    expect(reset).toMatchObject({ status: 200, body: { ok: true, outcome: "applied",
      data: { id: cashierId, permissionRevision: 1 } } });
    expect((await request("permission_get_authority", {}, cashierBefore.body.token)).body.error.code).toBe("EMPLOYEE_SESSION_REQUIRED");
    expect((await login(cashierId, "111111")).body.error.code).toBe("INVALID_PIN");
    const cashierCurrent = await login(cashierId, "927416");
    expect(cashierCurrent).toMatchObject({ status: 200, body: { ok: true, kind: "normal", pinChangeRequired: false } });
    expect(await cashierRow()).toMatchObject({ role: "cashier", pin_change_required: false, revision: 1 });
    expect(cashierCurrent.body.authority.snapshot.permissions).toEqual(expectedCashier);
    expect((await cashierRow()).permissions).toEqual(expectedCashier);

    // A manager with a smaller configured ceiling cannot reset a cashier whose
    // owner-granted permission lies outside that ceiling.
    const grant = await request("permission_admin_update", { p_request: {
      requestId: randomUUID(), targetId: cashierId, expectedRevision: 1,
      expectedCatalogRevision: catalogRevision,
      patch: { overrides: { grants: ["report.view"], denies: [] } },
    } }, ownerCurrent.body.token);
    expect(grant).toMatchObject({ status: 200, body: { ok: true, outcome: "applied",
      data: { id: cashierId, permissionRevision: 2 } } });
    const managerId = randomUUID();
    await assertFixtureBinding(state.db);
    const inserted = await state.db.query(`insert into public.employees(id,store_id,name,role,passcode_hash,permission_overrides)
      values($1,$2,'TC17 limited manager','manager',extensions.crypt('246810',extensions.gen_salt('bf')),$3)
      returning id`, [managerId, state.storeId, { grants: [], denies: ["report.view"] }]);
    expect(inserted.rowCount).toBe(1);
    const manager = await login(managerId, "246810");
    expect(manager).toMatchObject({ status: 200, body: { ok: true, kind: "normal", pinChangeRequired: false } });
    expect(manager.body.authority.snapshot.permissions).not.toContain("report.view");
    const cashierHashBeforeDenial = (await state.db.query("select passcode_hash from public.employees where id=$1", [cashierId])).rows[0].passcode_hash;
    const deniedReset = await request("permission_admin_reset_pin", { p_request: {
      requestId: randomUUID(), targetId: cashierId, expectedRevision: 2, newPin: "111111",
    } }, manager.body.token);
    expect(deniedReset).toMatchObject({ status: 200, body: { error: { code: "PERMISSION_CEILING_EXCEEDED" } } });
    const afterDenial = (await state.db.query("select passcode_hash,permission_revision::int revision,pin_change_required from public.employees where id=$1", [cashierId])).rows[0];
    expect(afterDenial.passcode_hash === cashierHashBeforeDenial).toBe(true);
    expect(afterDenial).toMatchObject({ revision: 2, pin_change_required: false });
    expect((await login(cashierId, "111111")).body.error.code).toBe("INVALID_PIN");
    expect((await login(cashierId, "927416")).body.kind).toBe("normal");

    for (const marker of ["1", "0"]) {
      const incompatible = await request("permission_get_authority", {}, ownerCurrent.body.token, marker);
      expect(incompatible).toMatchObject({ status: 426, body: { code: "WRITE_PROTOCOL_UNSUPPORTED" } });
    }
    expect((await request("permission_get_authority", {}, ownerCurrent.body.token)).body.ok).toBe(true);
    // Old server gate state must reject both preparation and activation SQL,
    // then rollback without changing the active contract version.
    for (const path of ["supabase/candidate/permission-compatibility-prepare.sql",
      "supabase/candidate/permission-compatibility-activate.sql"]) {
      await state.db.query("begin");
      try {
        await state.db.query("alter table private.permission_contract_gate drop constraint permission_contract_gate_contract_version_check");
        await state.db.query("update private.permission_contract_gate set contract_version=1 where singleton");
        await expect(state.db.query(readFileSync(path, "utf8"))).rejects.toMatchObject({ message: "PERMISSION_CONTRACT_VERSION_MISMATCH" });
      } finally {
        await state.db.query("rollback");
      }
      expect((await state.db.query("select contract_version::int from private.permission_contract_gate where singleton")).rows[0].contract_version).toBe(2);
    }
    await expectSingleBootstrapStore();
  });

  for (const droppedStage of STAGES) {
    test(`TC-PIN-14 lost ${droppedStage} ACK preserves allowed-route edit through second-device retry and direct replay`, async ({ page, browser }) => {
      test.setTimeout(180_000);
      const startedAt = Date.now();
      const mark = (phase: string) => console.info(JSON.stringify({ event: "PIN_ONBOARD_TC14_PHASE", stage: droppedStage, phase, elapsedMs: Date.now() - startedAt }));
      mark("create_start");
      const storeKey = await createAndChangePin(page);
      mark("create_complete");
      const ownerBefore = await ownerIdentityEvidence();
      expect(ownerBefore).toMatchObject({ new_pin: true, old_pin: false, pin_change_required: false, owner_count: 1 });
      const calls: Stage[] = [];
      let statusReads = 0;
      let dropped = false;
      page.on("request", request => {
        if (request.url().includes("/rpc/permission_get_initial_seed_status")) statusReads += 1;
      });
      await page.route("**/rest/v1/rpc/permission_run_initial_seed_stage", async route => {
        const stage = route.request().postDataJSON()?.p_request?.stage as Stage;
        calls.push(stage);
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        if (stage === droppedStage && !dropped) { dropped = true; await route.abort("failed"); return; }
        await route.fulfill({ response });
      });
      await loginWithNewPin(page);
      mark("first_login_complete");
      await expect.poll(() => dropped).toBe(true);
      await expect.poll(() => statusReads, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
      const droppedIndex = STAGES.indexOf(droppedStage);
      expect(calls).toEqual(STAGES.slice(0, droppedIndex + 1));
      if (droppedStage === "floor") await expect(page.getByTestId("initial-seed-status")).toHaveCount(0);
      else await expect(page.getByTestId("retry-initial-seed")).toBeVisible();
      const afterLoss = await stageSnapshot();
      expect(afterLoss.stages.map(row => row.status)).toEqual(STAGES.map((_, index) => index <= droppedIndex ? "committed" : "pending"));
      const committedCounts = structuredClone(afterLoss.counts);
      const beforeEdit = await stageReplayEvidence(droppedStage);
      expect(beforeEdit.receipt).toMatchObject({ stage: droppedStage, runGeneration: 1 });

      mark("edit_start");
      await editCommittedStageThroughUi(page, droppedStage, mark);
      mark("edit_complete");
      const afterEdit = await stageReplayEvidence(droppedStage);
      expect(afterEdit.stage_id).toBe(beforeEdit.stage_id);
      expect(afterEdit.receipt).toEqual(beforeEdit.receipt);
      expect(afterEdit.committed_at).toEqual(beforeEdit.committed_at);

      await page.unroute("**/rest/v1/rpc/permission_run_initial_seed_stage");
      const statusReadsBeforeReload = statusReads;
      mark("first_reload_start");
      await page.reload();
      await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
      const resumedCalls: Stage[] = [];
      let resumedBeginCalls = 0;
      page.on("request", request => {
        if (request.url().includes("/rpc/permission_begin_initial_seed")) resumedBeginCalls += 1;
        if (!request.url().includes("/rpc/permission_run_initial_seed_stage")) return;
        resumedCalls.push(request.postDataJSON()?.p_request?.stage as Stage);
      });
      await loginWithNewPin(page);
      mark("first_reload_login_complete");
      if (droppedStage === "floor") await expect(page.getByTestId("initial-seed-status")).toHaveCount(0);
      else await expect(page.getByTestId("retry-initial-seed")).toBeVisible();
      expect(statusReads).toBeGreaterThan(statusReadsBeforeReload);
      expect(resumedCalls).toEqual([]);
      expect(resumedBeginCalls).toBe(0);
      expect((await stageSnapshot()).counts).toEqual(committedCounts);
      expect(await stageReplayEvidence(droppedStage)).toEqual(afterEdit);

      mark("second_context_start");
      const secondContext = await browser.newContext();
      try {
        const second = await secondContext.newPage();
        let employeeToken = "";
        const secondCalls: Stage[] = [];
        let secondBeginCalls = 0;
        let secondStatusReads = 0;
        second.on("request", request => {
          if (request.url().includes("/rpc/permission_begin_initial_seed")) secondBeginCalls += 1;
          if (request.url().includes("/rpc/permission_get_initial_seed_status")) secondStatusReads += 1;
          if (request.url().includes("/rpc/permission_run_initial_seed_stage"))
            secondCalls.push(request.postDataJSON()?.p_request?.stage as Stage);
          const value = request.headers()["x-pos-employee-token"];
          if (value) employeeToken = value;
        });
        await second.goto("/");
        await second.getByTestId("go-store-pairing").click();
        await second.getByTestId("store-key-input").fill(storeKey);
        await second.getByTestId("go-passcode").click();
        await expect(second.getByTestId("passcode-screen")).toBeVisible();
        await loginWithNewPin(second);
        mark("second_login_complete");
        await expect.poll(() => employeeToken.length).toBeGreaterThan(0);
        expect(secondStatusReads).toBeGreaterThan(0);
        expect(secondCalls).toEqual([]);
        expect(secondBeginCalls).toBe(0);
        expect(await stageReplayEvidence(droppedStage)).toEqual(afterEdit);
        if (droppedStage === "floor") {
          await expect(second.getByTestId("retry-initial-seed")).toHaveCount(0);
        } else {
          await expect(second.getByTestId("retry-initial-seed")).toBeVisible();
          await second.getByTestId("retry-initial-seed").click();
          mark("second_retry_clicked");
          await expect.poll(async () => (await stageSnapshot()).stages.map(row => row.status), { timeout: 15_000 })
            .toEqual(["committed", "committed", "committed"]);
          expect(secondCalls).toEqual(STAGES.slice(droppedIndex + 1));
        }
        const beforeReplay = await stageReplayEvidence(droppedStage);
        mark("replay_evidence_ready");
        expect(beforeReplay.stage_id).toBe(beforeEdit.stage_id);
        expect(beforeReplay.receipt).toEqual(beforeEdit.receipt);
        const generation = (await fixture!.db.query(`select run_generation::int generation
          from private.initial_seed_workflows where store_id=$1`, [fixture!.storeId])).rows[0].generation;
        await replayCommittedStageThroughRest(second, droppedStage, employeeToken, generation);
        mark("direct_replay_complete");
        expect(await stageReplayEvidence(droppedStage)).toEqual(beforeReplay);
      } finally { mark("second_context_close"); await secondContext.close(); }
      mark("second_context_closed");
      const completed = await stageSnapshot();
      expect(completed.counts).toEqual({ employees: 1, categories: 2, menu_items: 6, option_groups: 2, option_values: 4, menu_links: 3, areas: 1, tables: 4, decor: 7 });
      expect(await ownerIdentityEvidence()).toEqual(ownerBefore);
      const edited = await stageReplayEvidence(droppedStage);
      if (droppedStage === "employee") {
        expect(edited.cashier_revision).toBeGreaterThan(beforeEdit.cashier_revision);
        expect({ new_pin: edited.cashier_new_pin, old_pin: edited.cashier_old_pin })
          .toEqual({ new_pin: true, old_pin: false });
      }
      if (droppedStage === "menu") expect({ name: edited.coffee_name, price: edited.coffee_price })
        .toEqual({ name: "Cà phê sữa mới", price: 31000 });
      if (droppedStage === "menu") expect(edited.menu_tombstoned).toBe(true);
      if (droppedStage === "floor") {
        expect(edited.table_name).toBe("Sân 01");
        expect(edited.table_tombstoned).toBe(true);
      }
    });
  }
  test("TC-PIN-18 runtime canary: completion denial, commit and revoked replay do not leak", async ({ page }) => {
    test.setTimeout(180_000);
    const consoleRows: string[] = [];
    const telemetryRows: string[] = [];
    const urls: string[] = [];
    const realtimeFrames: string[] = [];
    const completionCalls: Array<{ request: any; headers: Record<string, string> }> = [];
    page.on("console", message => { consoleRows.push(message.text()); });
    page.on("pageerror", error => { telemetryRows.push(error.message); });
    page.on("requestfailed", request => { telemetryRows.push(request.failure()?.errorText ?? ""); });
    page.on("request", request => {
      urls.push(request.url());
      if (request.url().includes("/rpc/permission_complete_required_pin_change"))
        completionCalls.push({ request: request.postDataJSON()?.p_request, headers: request.headers() });
    });
    page.on("websocket", socket => { socket.on("framereceived", frame => { realtimeFrames.push(String(frame.payload)); }); });

    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page);
    await expect(page.getByTestId("create-store-result")).toBeVisible();
    const key = (await page.getByTestId("result-store-key").textContent()) ?? "";
    if (!key) throw new Error("PIN_CANARY_KEY_MISSING");
    const sessionResponse = page.waitForResponse(response => response.url().includes("/rpc/permission_start_session"));
    const proofRequest = page.waitForRequest(request => request.url().includes("/rpc/permission_check_required_pin_session"));
    await acknowledgeAndReachRestricted(page);
    const session = await (await sessionResponse).json() as { token?: string };
    const jwt = (await proofRequest).headers().authorization?.replace(/^Bearer /, "");
    if (!session.token) throw new Error("PIN_CANARY_TOKEN_MISSING");
    if (!jwt) throw new Error("PIN_CANARY_AUTH_MISSING");
    const canaryPin = String(randomInt(100000, 999999));
    if ([TEMP_PIN, NEW_PIN].includes(canaryPin)) throw new Error("PIN_CANARY_COLLISION");
    const state = fixture!;
    const owner = (await state.db.query("select id,passcode_hash from public.employees where store_id=$1 and role='owner'", [state.storeId])).rows[0];
    expect(owner).toBeDefined();
    const realtimeClient = createClient(env.api, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await realtimeClient.realtime.setAuth(jwt);
    const directFrames: string[] = [];
    const channel = realtimeClient.channel(`tc18-${randomUUID()}`, tc18ReplicationReady)
      .on("postgres_changes", { event: "*", schema: "public", table: "store_change_signals",
        filter: `store_id=eq.${state.storeId}` }, payload => {
          const frame = JSON.stringify(payload); directFrames.push(frame); realtimeFrames.push(frame);
        });
    tc18Realtime = { client: realtimeClient, channel };
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("PIN_CANARY_REALTIME_SUBSCRIBE_TIMEOUT")), 15_000);
      channel.subscribe(status => {
        if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearTimeout(timer); reject(new Error("PIN_CANARY_REALTIME_SUBSCRIBE_FAILED"));
        }
      });
    });

    await waitForTc18Delivery(state.db, state.storeId!, directFrames, "complete");
    await page.getByTestId("required-new-pin").fill(TEMP_PIN);
    await page.getByTestId("required-confirm-pin").fill(TEMP_PIN);
    await page.getByTestId("complete-required-pin").click();
    await expect(page.getByText("PIN mới phải khác PIN tạm đang dùng.", { exact: true })).toBeVisible();
    expect(completionCalls).toHaveLength(1);
    const denialId = completionCalls[0].request?.requestId;
    const denied = (await state.db.query(`select actor_type,actor_key,request_id,target_id,kind,outcome,reason,
      credential_changed,before_snapshot,actual_after from public.employee_admin_audit
      where store_id=$1 and request_id=$2`, [state.storeId, denialId])).rows[0];
    expect(denied).toMatchObject({ actor_type: "employee", actor_key: owner.id, request_id: denialId,
      target_id: owner.id, kind: "complete_required_pin_change", outcome: "denied",
      reason: "PIN_REUSE_NOT_ALLOWED", credential_changed: false });
    expect(denied.actual_after).toEqual(denied.before_snapshot);
    const deniedRegistry = (await state.db.query(`select payload_mac,mac_key_version,terminal_outcome
      from private.employee_admin_requests where store_id=$1 and request_id=$2`, [state.storeId, denialId])).rows[0];
    expect(deniedRegistry.payload_mac).toHaveLength(32);
    expect(deniedRegistry.mac_key_version).toBeGreaterThan(0);
    expect(deniedRegistry.terminal_outcome).toMatchObject({ error: { code: "PIN_REUSE_NOT_ALLOWED" } });
    await captureTc18Scenario(page, "complete:denial", [TEMP_PIN, canaryPin, key, session.token, owner.passcode_hash],
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls, messages: [deniedRegistry.terminal_outcome] });

    await page.getByTestId("required-new-pin").fill(canaryPin);
    await page.getByTestId("required-confirm-pin").fill(canaryPin);
    await expect(page.getByTestId("required-new-pin")).toHaveAttribute("type", "password");
    await expect(page.getByTestId("required-confirm-pin")).toHaveAttribute("type", "password");
    const screenshot = await page.screenshot({ mask: [page.getByTestId("required-new-pin"), page.getByTestId("required-confirm-pin")] });
    expect(screenshot.length).toBeGreaterThan(100);
    mkdirSync(tc18ArtifactDirectory, { recursive: true });
    writeFileSync(join(tc18ArtifactDirectory, "masked-completion.png"), screenshot);
    await page.getByTestId("complete-required-pin").click();
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
    await expect(page.getByTestId("session-notice")).toHaveText("Đã đổi PIN. Vui lòng đăng nhập bằng PIN mới.");
    expect(completionCalls).toHaveLength(2);
    const appliedId = completionCalls[1].request?.requestId;
    const hash = (await state.db.query("select passcode_hash from public.employees where id=$1", [owner.id])).rows[0].passcode_hash as string;
    expect(hash).not.toBe(owner.passcode_hash);
    expect((await state.db.query("select passcode_hash=extensions.crypt($2,passcode_hash) matches from public.employees where id=$1",
      [owner.id, canaryPin])).rows[0].matches).toBe(true);
    const applied = (await state.db.query(`select actor_type,actor_key,request_id,target_id,kind,outcome,reason,
      credential_changed,before_snapshot,actual_after from public.employee_admin_audit
      where store_id=$1 and request_id=$2`, [state.storeId, appliedId])).rows[0];
    expect(applied).toMatchObject({ actor_type: "employee", actor_key: owner.id, request_id: appliedId,
      target_id: owner.id, kind: "complete_required_pin_change", outcome: "applied",
      reason: null, credential_changed: true });
    expect(applied.before_snapshot.pinChangeRequired).toBe(true);
    expect(applied.actual_after.pinChangeRequired).toBe(false);
    const stored = (await state.db.query(`select to_jsonb(r) row from private.employee_admin_requests r
      where store_id=$1 and request_id=$2`, [state.storeId, appliedId])).rows[0].row;
    expect(Buffer.from(stored.payload_mac.slice(2), "hex")).toHaveLength(32);
    expect(stored.terminal_outcome).toMatchObject({ ok: true, outcome: "applied",
      data: { credentialChanged: true, pinChangeRequired: false } });
    const signal = (await state.db.query(`select topic,event_id,target_id,revision::int revision
      from public.store_change_signals where store_id=$1 and topic='permission'`, [state.storeId])).rows[0];
    expect(signal).toMatchObject({ topic: "permission", event_id: appliedId, target_id: owner.id });
    await expect.poll(() => realtimeFrames.some(frame => frame.includes(appliedId)), { timeout: 15_000 }).toBe(true);
    await captureTc18Scenario(page, "complete:success", [canaryPin, key, session.token, hash],
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls, messages: [stored.terminal_outcome] });

    const headers = completionCalls[1].headers;
    const replay = await page.request.post(`${env.api}/rest/v1/rpc/permission_complete_required_pin_change`, {
      headers: { apikey: headers.apikey, authorization: headers.authorization,
        "x-pos-employee-token": session.token, "x-pos-permission-contract": "2", "content-type": "application/json" },
      data: { p_request: completionCalls[1].request },
    });
    expect(replay.ok()).toBe(true);
    expect((await replay.json()).error?.code).toBe("EMPLOYEE_SESSION_REQUIRED");
    expect((await state.db.query("select count(*)::int n from public.employee_admin_audit where store_id=$1", [state.storeId])).rows[0].n).toBe(2);
    await captureTc18Scenario(page, "complete:replay", [canaryPin, key, session.token, hash],
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });

    const browserStorage = await page.evaluate(async () => {
      const databases: unknown[] = [];
      for (const entry of await indexedDB.databases()) {
        if (!entry.name) continue;
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(entry.name!);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          const stores: unknown[] = [];
          for (const name of db.objectStoreNames) {
            const values = await new Promise<unknown[]>((resolve, reject) => {
              const rows: unknown[] = [];
              const request = db.transaction(name, "readonly").objectStore(name).openCursor();
              request.onsuccess = () => { const cursor = request.result;
                if (!cursor) { resolve(rows); return; }
                rows.push([cursor.key, cursor.value]); cursor.continue(); };
              request.onerror = () => reject(request.error);
            });
            stores.push([name, values]);
          }
          databases.push([entry.name, stores]);
        } finally { db.close(); }
      }
      return { local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie, databases };
    });
    const sinks: CanarySink[] = ["audit", "registry", "signal", "realtime", "browserStorage", "url",
      "console", "telemetry", "errorMessage", "screenshotText"];
    const observations = {
      audit: { captured: true as const, data: (await state.db.query("select to_jsonb(a) row from public.employee_admin_audit a where store_id=$1", [state.storeId])).rows },
      registry: { captured: true as const, data: (await state.db.query("select to_jsonb(r) row from private.employee_admin_requests r where store_id=$1", [state.storeId])).rows },
      signal: { captured: true as const, data: (await state.db.query("select to_jsonb(s) row from public.store_change_signals s where store_id=$1", [state.storeId])).rows },
      realtime: { captured: true as const, data: realtimeFrames },
      browserStorage: { captured: true as const, data: browserStorage },
      url: { captured: true as const, data: [page.url(), ...urls] },
      console: { captured: true as const, data: consoleRows },
      telemetry: { captured: true as const, data: telemetryRows },
      errorMessage: { captured: true as const, data: await page.locator("body").innerText() },
      screenshotText: { captured: true as const, data: await page.locator("body").innerText() },
    };
    expect(assertNoCanaryLeaks({ canaries: [canaryPin, key, session.token, hash], requiredSinks: sinks, observations })
      .checkedSinkCount).toBe(sinks.length);
    await expectSingleBootstrapStore();
  });

  test("TC-PIN-18 runtime canary: recovery role denial, fault, commit and replay keep secret projections clean", async ({ page }) => {
    test.setTimeout(180_000);
    const realtimeFrames: string[] = [];
    const telemetryRows: string[] = [];
    const consoleRows: string[] = [];
    const urls: string[] = [];
    page.on("console", message => { consoleRows.push(message.text()); });
    page.on("request", request => { urls.push(request.url()); });
    page.on("websocket", socket => { socket.on("framereceived", frame => { realtimeFrames.push(String(frame.payload)); }); });
    page.on("pageerror", error => { telemetryRows.push(error.message); });
    const key = await createAndChangePin(page);
    const state = fixture!;
    const owner = (await state.db.query("select id,passcode_hash from public.employees where store_id=$1 and role='owner'", [state.storeId])).rows[0];
    expect(owner).toBeDefined();
    const normalRequest = page.waitForRequest(request => request.url().includes("/rpc/permission_get_initial_seed_status"));
    await loginWithNewPin(page);
    const jwt = (await normalRequest).headers().authorization?.replace(/^Bearer /, "");
    if (!jwt) throw new Error("PIN_CANARY_AUTH_MISSING");
    await expect.poll(async () => (await state.db.query(
      "select status from private.initial_seed_workflows where store_id=$1", [state.storeId])).rows[0]?.status,
    { timeout: 20_000 }).toBe("completed");
    await expect.poll(() => realtimeFrames.some(frame => {
      try { const value = JSON.parse(frame); return (Array.isArray(value) ? value[3] : value.event) === "system"; }
      catch { return false; }
    }), { timeout: 15_000 }).toBe(true);
    const realtimeClient = createClient(env.api, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await realtimeClient.realtime.setAuth(jwt);
    const directFrames: string[] = [];
    const channel = realtimeClient.channel(`tc18-recovery-${randomUUID()}`, tc18ReplicationReady)
      .on("postgres_changes", { event: "*", schema: "public", table: "store_change_signals",
        filter: `store_id=eq.${state.storeId}` }, payload => {
          const frame = JSON.stringify(payload); directFrames.push(frame); realtimeFrames.push(frame);
        });
    tc18Realtime = { client: realtimeClient, channel };
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("PIN_CANARY_REALTIME_SUBSCRIBE_TIMEOUT")), 15_000);
      channel.subscribe(status => {
        if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearTimeout(timer); reject(new Error("PIN_CANARY_REALTIME_SUBSCRIBE_FAILED"));
        }
      });
    });
    await waitForTc18Delivery(state.db, state.storeId!, directFrames, "recovery");
    const pin = String(randomInt(100000, 999999));
    if ([TEMP_PIN, NEW_PIN].includes(pin)) throw new Error("PIN_CANARY_COLLISION");
    const request = { requestId: randomUUID(), storeId: state.storeId, targetId: owner.id,
      operatorRef: "tc18-local", caseRef: "tc18-case", proofRef: "tc18-proof", newPin: pin };
    const before = (await state.db.query("select count(*)::int n from public.employee_admin_audit where store_id=$1", [state.storeId])).rows[0].n;
    const denied = (await state.db.query("select private.permission_recover_owner($1) result", [request])).rows[0].result;
    expect(denied.error?.code).toBe("FORBIDDEN");
    expect((await state.db.query("select count(*)::int n from public.employee_admin_audit where store_id=$1", [state.storeId])).rows[0].n).toBe(before);
    await captureTc18Scenario(page, "recovery:denial", [pin, key, owner.passcode_hash],
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls, messages: [denied] });
    const membership = (await state.db.query(`select m.grantor::regrole::text grantor,m.set_option,m.admin_option,m.inherit_option
      from pg_auth_members m where m.roleid='pos_owner_recovery'::regrole and m.member=current_user::regrole`)).rows;
    expect(membership).toEqual([{ grantor: "supabase_admin", set_option: false, admin_option: true, inherit_option: false }]);
    const recover = async (input: object) => {
      await assertFixtureBinding(state.db);
      await state.db.query("begin");
      try {
        await state.db.query("grant pos_owner_recovery to postgres with set true");
        await state.db.query("set local role pos_owner_recovery");
        const result = (await state.db.query("select private.permission_recover_owner($1) result", [input])).rows[0].result;
        await state.db.query("reset role");
        await state.db.query("revoke pos_owner_recovery from postgres granted by postgres");
        await state.db.query("commit");
        return result;
      } catch (error) {
        await state.db.query("rollback").catch(() => undefined);
        throw error;
      }
    };
    let faultInstalled = false;
    let faultResult: any;
    try {
      await state.db.query(`create function private.tc18_recovery_audit_fault() returns trigger
        language plpgsql as $$ begin raise exception 'TC18_INJECTED_AUDIT_FAULT'; end $$`);
      await state.db.query(`create trigger tc18_recovery_audit_fault before insert on public.employee_admin_audit
        for each row execute function private.tc18_recovery_audit_fault()`);
      faultInstalled = true;
      faultResult = await recover(request);
      expect(faultResult.error?.code).toBe("PERMISSION_UPDATE_UNAVAILABLE");
      expect((await state.db.query("select count(*)::int n from public.employee_admin_audit where store_id=$1", [state.storeId])).rows[0].n).toBe(before);
      await captureTc18Scenario(page, "recovery:fault", [pin, key, owner.passcode_hash],
        { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls, messages: [faultResult] });
    } finally {
      if (faultInstalled) await state.db.query("drop trigger tc18_recovery_audit_fault on public.employee_admin_audit");
      await state.db.query("drop function if exists private.tc18_recovery_audit_fault()");
    }
    const applied = await recover(request);
    expect(applied).toMatchObject({ ok: true, outcome: "applied",
      data: { credentialChanged: true, pinChangeRequired: true } });
    await expect.poll(() => realtimeFrames.some(frame => frame.includes(request.requestId)), { timeout: 15_000 }).toBe(true);
    const appliedHash = (await state.db.query("select passcode_hash from public.employees where id=$1", [owner.id])).rows[0].passcode_hash;
    await captureTc18Scenario(page, "recovery:success", [pin, key, owner.passcode_hash, appliedHash],
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls, messages: [applied] });
    const replayed = await recover(request);
    expect(replayed).toMatchObject({ ok: true, outcome: "replayed" });
    await captureTc18Scenario(page, "recovery:replay", [pin, key, owner.passcode_hash, appliedHash],
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls, messages: [replayed] });
    const changed = (await state.db.query(`select passcode_hash,pin_change_required,permission_revision::int revision,
      passcode_hash=extensions.crypt($2,passcode_hash) matches from public.employees where id=$1`, [owner.id, pin])).rows[0];
    expect(changed).toMatchObject({ pin_change_required: true, matches: true, revision: 2 });
    expect(changed.passcode_hash).not.toBe(owner.passcode_hash);
    const audit = (await state.db.query(`select actor_type,actor_key,request_id,target_id,kind,outcome,reason,
      credential_changed,operator_case_ref,operator_proof_ref,actual_after
      from public.employee_admin_audit where store_id=$1 and request_id=$2`, [state.storeId, request.requestId])).rows[0];
    expect(audit).toMatchObject({ actor_type: "operator", actor_key: request.operatorRef,
      request_id: request.requestId, target_id: owner.id, kind: "owner_recovery", outcome: "applied",
      reason: null, credential_changed: true, operator_case_ref: request.caseRef,
      operator_proof_ref: request.proofRef });
    expect(audit.actual_after.pinChangeRequired).toBe(true);
    const registry = (await state.db.query(`select payload_mac,mac_key_version,terminal_outcome
      from private.employee_admin_requests where store_id=$1 and request_id=$2`, [state.storeId, request.requestId])).rows[0];
    expect(registry.payload_mac).toHaveLength(32);
    expect(registry.mac_key_version).toBeGreaterThan(0);
    expect(registry.terminal_outcome).toMatchObject({ ok: true, outcome: "applied" });
    const signal = (await state.db.query("select event_id,target_id from public.store_change_signals where store_id=$1 and topic='permission'", [state.storeId])).rows[0];
    expect(signal).toEqual({ event_id: request.requestId, target_id: owner.id });
    await expect.poll(() => realtimeFrames.some(frame => frame.includes(request.requestId)), { timeout: 15_000 }).toBe(true);
    expect((await state.db.query(`select count(*)::int n from public.employee_admin_audit
      where store_id=$1 and request_id=$2`, [state.storeId, request.requestId])).rows[0].n).toBe(1);
    expect((await state.db.query(`select m.grantor::regrole::text grantor,m.set_option,m.admin_option,m.inherit_option
      from pg_auth_members m where m.roleid='pos_owner_recovery'::regrole and m.member=current_user::regrole`)).rows).toEqual(membership);
    const observations = {
      audit: { captured: true as const, data: (await state.db.query("select to_jsonb(a) row from public.employee_admin_audit a where store_id=$1", [state.storeId])).rows },
      registry: { captured: true as const, data: (await state.db.query("select to_jsonb(r) row from private.employee_admin_requests r where store_id=$1", [state.storeId])).rows },
      signal: { captured: true as const, data: (await state.db.query("select to_jsonb(s) row from public.store_change_signals s where store_id=$1", [state.storeId])).rows },
      realtime: { captured: true as const, data: realtimeFrames },
      telemetry: { captured: true as const, data: telemetryRows },
      errorMessage: { captured: true as const, data: [denied, faultResult, applied, replayed] },
    };
    const sinks: CanarySink[] = ["audit", "registry", "signal", "realtime", "telemetry", "errorMessage"];
    expect(assertNoCanaryLeaks({ canaries: [pin, key, owner.passcode_hash, changed.passcode_hash],
      requiredSinks: sinks, observations }).checkedSinkCount).toBe(sinks.length);
    const lostPin = String(randomInt(100000, 999999));
    if ([TEMP_PIN, NEW_PIN, pin].includes(lostPin)) throw new Error("PIN_CANARY_COLLISION");
    const lostRequest = { ...request, requestId: randomUUID(), caseRef: "tc18-lost-ack", newPin: lostPin };
    let procedureInstalled = false;
    let roleGranted = false;
    const caller = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000,
      statement_timeout: 30_000, application_name: 'tc18-recovery-ack-drop' });
    caller.on('error', () => { /* Intentional transport cut; never serialize driver diagnostics. */ });
    let callerPid: number | undefined;
    try {
      await assertFixtureBinding(state.db);
      await state.db.query("grant pos_owner_recovery to postgres with set true");
      roleGranted = true;
      await state.db.query(`create procedure private.tc18_recover_commit_delay(p_request jsonb)
        language plpgsql as $$ declare response jsonb; begin
          response:=private.permission_recover_owner(p_request);
          if response->>'ok' is distinct from 'true' then raise exception 'TC18_RECOVERY_NOT_APPLIED'; end if;
          commit;
          perform pg_sleep(10);
        end $$`);
      procedureInstalled = true;
      await state.db.query("grant execute on procedure private.tc18_recover_commit_delay(jsonb) to pos_owner_recovery");
      await caller.connect();
      callerPid = (await caller.query("select pg_backend_pid() pid")).rows[0].pid;
      await caller.query("set role pos_owner_recovery");
      let premature: string | null = null;
      const pendingAck = caller.query("call private.tc18_recover_commit_delay($1)", [lostRequest])
        .then(() => "ACK_DELIVERED", (error: { code?: string }) => {
          premature = /^[0-9A-Z]{5}$/.test(error?.code ?? '') ? error.code! : 'OPAQUE';
          return "ACK_DROPPED";
        });
      await expect.poll(async () => (await state.db.query(`select count(*)::int n
        from public.employee_admin_audit where store_id=$1 and request_id=$2`,
        [state.storeId, lostRequest.requestId])).rows[0].n || (premature ? -1 : 0), { timeout: 15_000 }).toBe(1);
      (caller as any).connection.stream.destroy();
      expect(await pendingAck).toBe("ACK_DROPPED");
      expect(await recover(lostRequest)).toMatchObject({ ok: true, outcome: "replayed" });
      const lostHash = (await state.db.query("select passcode_hash from public.employees where id=$1", [owner.id])).rows[0].passcode_hash;
      await captureTc18Scenario(page, "recovery:lostAck", [pin, lostPin, key, owner.passcode_hash, lostHash],
        { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
    } finally {
      await caller.end().catch(() => undefined);
      if (callerPid) {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const active = (await state.db.query(`select count(*)::int n from pg_stat_activity
            where pid=$1 and application_name='tc18-recovery-ack-drop'`, [callerPid])).rows[0].n;
          if (active === 0) break;
          if (attempt === 39) await state.db.query(`select pg_terminate_backend(pid) from pg_stat_activity
            where pid=$1 and application_name='tc18-recovery-ack-drop'`, [callerPid]);
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
      if (procedureInstalled) await state.db.query("drop procedure if exists private.tc18_recover_commit_delay(jsonb)");
      if (roleGranted) await state.db.query("revoke pos_owner_recovery from postgres granted by postgres");
    }
    const final = (await state.db.query(`select passcode_hash,pin_change_required,permission_revision::int revision,
      passcode_hash=extensions.crypt($2,passcode_hash) matches from public.employees where id=$1`, [owner.id, lostPin])).rows[0];
    expect(final).toMatchObject({ pin_change_required: true, revision: 3, matches: true });
    expect((await state.db.query(`select count(*)::int n from public.employee_admin_audit
      where store_id=$1 and request_id=$2`, [state.storeId, lostRequest.requestId])).rows[0].n).toBe(1);
    const finalObservations = {
      audit: { captured: true as const, data: (await state.db.query("select to_jsonb(a) row from public.employee_admin_audit a where store_id=$1", [state.storeId])).rows },
      registry: { captured: true as const, data: (await state.db.query("select to_jsonb(r) row from private.employee_admin_requests r where store_id=$1", [state.storeId])).rows },
      signal: { captured: true as const, data: (await state.db.query("select to_jsonb(s) row from public.store_change_signals s where store_id=$1", [state.storeId])).rows },
      realtime: { captured: true as const, data: realtimeFrames },
      telemetry: { captured: true as const, data: telemetryRows },
      errorMessage: { captured: true as const, data: await page.locator("body").innerText() },
    };
    await expect.poll(() => realtimeFrames.some(frame => frame.includes(lostRequest.requestId)), { timeout: 15_000 }).toBe(true);
    expect(assertNoCanaryLeaks({ canaries: [pin, lostPin, key, owner.passcode_hash, final.passcode_hash],
      requiredSinks: sinks, observations: finalObservations }).checkedSinkCount).toBe(sinks.length);
    await expectSingleBootstrapStore();
  });

  test("TC-PIN-18 runtime canary: bootstrap denial, fault, lost ACK and replay keep Key out of sinks", async ({ page }) => {
    test.setTimeout(180_000);
    const consoleRows: string[] = [];
    const telemetryRows: string[] = [];
    const urls: string[] = [];
    const realtimeFrames: string[] = [];
    let bootstrapHeaders: Record<string, string> | undefined;
    page.on("console", message => { consoleRows.push(message.text()); });
    page.on("pageerror", error => { telemetryRows.push(error.message); });
    page.on("requestfailed", request => { telemetryRows.push(request.failure()?.errorText ?? ""); });
    page.on("request", request => {
      urls.push(request.url());
      if (request.url().includes("/rpc/permission_bootstrap_store")) bootstrapHeaders = request.headers();
    });
    page.on("websocket", socket => { socket.on("framereceived", frame => { realtimeFrames.push(String(frame.payload)); }); });
    const state = fixture!;
    await assertFixtureBinding(state.db);
    await state.db.query(`create function private.tc18_bootstrap_fault() returns trigger
      language plpgsql as $$ begin raise exception 'TC18_INJECTED_BOOTSTRAP_FAULT'; end $$`);
    await state.db.query(`create trigger tc18_bootstrap_fault before insert on public.store_settings
      for each row execute function private.tc18_bootstrap_fault()`);
    let faultInstalled = true;
    try {
      const capture = await installCreateTransport(page, "bootstrap", "after", undefined, undefined,
        "PERMISSION_UPDATE_UNAVAILABLE", async () => {
          await captureTc18Scenario(page, "bootstrap:success", [capture.signupSecret!],
            { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
        });
      let denialProbed = false;
      await page.route("**/rest/v1/rpc/permission_bootstrap_store", async route => {
        if (!denialProbed) {
          denialProbed = true;
          const valid = route.request().postDataJSON() as { p_request: Record<string, unknown> };
          const denied = await route.fetch({ postData: JSON.stringify({ p_request: { ...valid.p_request, displayName: "" } }) });
          expect(denied.ok()).toBe(true);
          expect((await denied.json()).error?.code).toBe("INVALID_WRITE_REQUEST");
          expect((await state.db.query("select count(*)::int n from private.bootstrap_requests")).rows[0].n).toBe(0);
          await captureTc18Scenario(page, "bootstrap:denial", [capture.signupSecret!],
            { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
        }
        await route.fallback();
      });
      await openCreate(page);
      await submitCreate(page);
      await expectPendingCreateFrozen(page);
      expect(denialProbed).toBe(true);
      expect(capture.counts.bootstrap).toBe(1);
      expect((await state.db.query("select count(*)::int n from public.stores")).rows[0].n).toBe(0);
      expect((await state.db.query("select count(*)::int n from private.bootstrap_requests")).rows[0].n).toBe(0);
      await captureTc18Scenario(page, "bootstrap:fault", [capture.signupSecret!],
        { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
      await state.db.query("drop trigger tc18_bootstrap_fault on public.store_settings");
      await state.db.query("drop function private.tc18_bootstrap_fault()");
      faultInstalled = false;
      await page.getByTestId("create-store-button").click();
      await expectPendingCreateFrozen(page);
      expect(capture.counts.bootstrap).toBe(2);
      await expectSingleBootstrapStore();
      await captureTc18Scenario(page, "bootstrap:lostAck", [capture.signupSecret!],
        { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
      await page.getByTestId("create-store-button").click();
      await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 15_000 });
      expect(capture.counts.bootstrap).toBe(3);
      expect(capture.bootstrapRequests).toHaveLength(3);
      expect(capture.bootstrapRequests[0]).toEqual(capture.bootstrapRequests[1]);
      expect(capture.bootstrapRequests[1]).toEqual(capture.bootstrapRequests[2]);
      const key = (await page.getByTestId("result-store-key").textContent()) ?? "";
      if (!key) throw new Error("PIN_CANARY_KEY_MISSING");
      const receipt = (await state.db.query(`select to_jsonb(b) row from private.bootstrap_requests b
        where store_id=$1`, [state.storeId])).rows;
      expect(receipt).toHaveLength(1);
      expect(receipt[0].row.outcome).toMatchObject({ ok: true, outcome: "applied",
        data: { storeId: state.storeId, storeNo: state.storeNo } });
      expect(receipt[0].row.canonical_input).toMatchObject({ seedDemo: true,
        displayName: CREATE_NAME, address: CREATE_ADDRESS });
      await page.getByTestId("acknowledge-store-key").click();
      await expect(page.getByTestId("passcode-screen")).toBeVisible();
      await expect(page.getByTestId("result-store-key")).toHaveCount(0);
      expect(!!bootstrapHeaders).toBe(true);
      const directReplay = await page.request.post(`${env.api}/rest/v1/rpc/permission_bootstrap_store`, {
        headers: { apikey: bootstrapHeaders!.apikey, authorization: bootstrapHeaders!.authorization,
          "x-pos-permission-contract": "2", "content-type": "application/json" },
        data: { p_request: capture.bootstrapRequests[2] },
      });
      expect(directReplay.ok()).toBe(true);
      expect((await directReplay.json()).outcome).toBe("replayed");
      urls.push(`${env.api}/rest/v1/rpc/permission_bootstrap_store`);
      await captureTc18Scenario(page, "bootstrap:replay", [capture.signupSecret!, key],
        { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
      const browserStorage = await page.evaluate(async () => {
        const databases: unknown[] = [];
        for (const entry of await indexedDB.databases()) {
          if (!entry.name) continue;
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(entry.name!);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          try {
            const stores: unknown[] = [];
            for (const name of db.objectStoreNames) {
              const values = await new Promise<unknown[]>((resolve, reject) => {
                const rows: unknown[] = [];
                const request = db.transaction(name, "readonly").objectStore(name).openCursor();
                request.onsuccess = () => { const cursor = request.result;
                  if (!cursor) { resolve(rows); return; }
                  rows.push([cursor.key, cursor.value]); cursor.continue(); };
                request.onerror = () => reject(request.error);
              });
              stores.push([name, values]);
            }
            databases.push([entry.name, stores]);
          } finally { db.close(); }
        }
        return { local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie, databases };
      });
      const observations = {
        audit: { captured: true as const, data: (await state.db.query("select to_jsonb(a) row from public.employee_admin_audit a where store_id=$1", [state.storeId])).rows },
        registry: { captured: true as const, data: receipt },
        signal: { captured: true as const, data: (await state.db.query("select to_jsonb(s) row from public.store_change_signals s where store_id=$1", [state.storeId])).rows },
        realtime: { captured: true as const, data: realtimeFrames },
        browserStorage: { captured: true as const, data: browserStorage },
        url: { captured: true as const, data: [page.url(), ...urls] },
        console: { captured: true as const, data: consoleRows },
        telemetry: { captured: true as const, data: telemetryRows },
        errorMessage: { captured: true as const, data: await page.locator("body").innerText() },
        screenshotText: { captured: true as const, data: await page.locator("body").innerText() },
      };
      const sinks: CanarySink[] = ["audit", "registry", "signal", "realtime", "browserStorage", "url",
        "console", "telemetry", "errorMessage", "screenshotText"];
      expect(assertNoCanaryLeaks({ canaries: [key], requiredSinks: sinks, observations }).checkedSinkCount)
        .toBe(sinks.length);
      await expectSingleBootstrapStore();
    } finally {
      if (faultInstalled) {
        await state.db.query("drop trigger if exists tc18_bootstrap_fault on public.store_settings");
        await state.db.query("drop function if exists private.tc18_bootstrap_fault()");
      }
    }
  });

  test("TC-PIN-18 runtime canary: seed fault, denial, lost ACK and committed replay keep receipts clean", async ({ page }) => {
    test.setTimeout(180_000);
    const consoleRows: string[] = [];
    const telemetryRows: string[] = [];
    const urls: string[] = [];
    const realtimeFrames: string[] = [];
    let ownerHeaders: Record<string, string> | undefined;
    page.on("console", message => { consoleRows.push(message.text()); });
    page.on("pageerror", error => { telemetryRows.push(error.message); });
    page.on("requestfailed", request => { telemetryRows.push(request.failure()?.errorText ?? ""); });
    page.on("request", request => {
      urls.push(request.url());
      if (request.url().includes("/rpc/permission_get_initial_seed_status")) {
        const headers = request.headers();
        if (headers["x-pos-employee-token"] && headers.authorization && headers.apikey)
          ownerHeaders = { authorization: headers.authorization, apikey: headers.apikey,
            "x-pos-employee-token": headers["x-pos-employee-token"],
            "x-pos-permission-contract": "2", "content-type": "application/json" };
      }
    });
    page.on("websocket", socket => { socket.on("framereceived", frame => { realtimeFrames.push(String(frame.payload)); }); });
    const key = await createAndChangePin(page);
    const state = fixture!;
    const ownerHash = (await state.db.query("select passcode_hash from public.employees where store_id=$1 and role='owner'", [state.storeId])).rows[0].passcode_hash;
    await installTc15MenuFault();
    await loginWithNewPin(page);
    await expect(page.getByTestId("retry-initial-seed")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Chưa hoàn tất dữ liệu mẫu. Bạn vẫn có thể vào quán hoặc chọn thử lại.", { exact: true }).first()).toBeVisible();
    expect((await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "pending", "pending"]);
    expect(!!ownerHeaders).toBe(true);
    const statusAfterFault = (await state.db.query("select status,last_error_code from private.initial_seed_workflows where store_id=$1", [state.storeId])).rows[0];
    expect(statusAfterFault).toEqual({ status: "needs_retry", last_error_code: "PERMISSION_UPDATE_UNAVAILABLE" });
    const seedCanaries = [NEW_PIN, key, ownerHeaders!["x-pos-employee-token"], ownerHash];
    await captureTc18Scenario(page, "seed:fault", seedCanaries,
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
    const denial = await page.request.post(`${env.api}/rest/v1/rpc/permission_run_initial_seed_stage`, {
      headers: ownerHeaders!, data: { p_request: { stage: "menu", runGeneration: 0 } },
    });
    expect(denial.ok()).toBe(true);
    expect((await denial.json()).error?.code).toBe("INITIAL_SEED_ATTEMPT_STALE");
    expect((await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "pending", "pending"]);
    await captureTc18Scenario(page, "seed:denial", seedCanaries,
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
    await removeTc15MenuFault();
    let dropped = false;
    await page.route("**/rest/v1/rpc/permission_run_initial_seed_stage", async route => {
      const stage = route.request().postDataJSON()?.p_request?.stage;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      if (stage === "menu" && !dropped) {
        expect((await response.json()).ok).toBe(true);
        dropped = true;
        await route.abort("failed");
        return;
      }
      await route.fulfill({ response });
    });
    await page.getByTestId("retry-initial-seed").click();
    await expect.poll(() => dropped).toBe(true);
    await expect(page.getByTestId("retry-initial-seed")).toBeVisible({ timeout: 20_000 });
    expect((await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "committed", "pending"]);
    const menuBeforeReplay = await stageReplayEvidence("menu");
    expect(menuBeforeReplay.receipt).toMatchObject({ stage: "menu", runGeneration: 2 });
    await captureTc18Scenario(page, "seed:lostAck", seedCanaries,
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
    await page.unroute("**/rest/v1/rpc/permission_run_initial_seed_stage");
    await page.getByTestId("retry-initial-seed").click();
    await expect.poll(async () => (await stageSnapshot()).stages.map(row => row.status), { timeout: 20_000 })
      .toEqual(["committed", "committed", "committed"]);
    const menuAtComplete = await stageReplayEvidence("menu");
    expect({ stage_id: menuAtComplete.stage_id, receipt: menuAtComplete.receipt, committed_at: menuAtComplete.committed_at })
      .toEqual({ stage_id: menuBeforeReplay.stage_id, receipt: menuBeforeReplay.receipt,
        committed_at: menuBeforeReplay.committed_at });
    await captureTc18Scenario(page, "seed:success", seedCanaries,
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
    const generation = (await state.db.query("select run_generation::int generation from private.initial_seed_workflows where store_id=$1", [state.storeId])).rows[0].generation;
    await replayCommittedStageThroughRest(page, "menu", ownerHeaders!["x-pos-employee-token"], generation);
    expect(await stageReplayEvidence("menu")).toEqual(menuAtComplete);
    await captureTc18Scenario(page, "seed:replay", seedCanaries,
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
    const graph = await stageSnapshot();
    expect(graph.counts).toEqual({ employees: 1, categories: 2, menu_items: 6, option_groups: 2,
      option_values: 4, menu_links: 3, areas: 1, tables: 4, decor: 7 });
    const workflow = (await state.db.query("select status,last_error_code from private.initial_seed_workflows where store_id=$1", [state.storeId])).rows[0];
    expect(workflow).toEqual({ status: "completed", last_error_code: null });
    const receiptRows = (await state.db.query(`select to_jsonb(w) row from private.initial_seed_workflows w where store_id=$1
      union all select to_jsonb(s) row from private.initial_seed_stages s
      join private.initial_seed_workflows w using(workflow_id) where w.store_id=$1`, [state.storeId])).rows;
    expect(receiptRows).toHaveLength(4);
    const browserStorage = await page.evaluate(async () => {
      const databases: unknown[] = [];
      for (const entry of await indexedDB.databases()) {
        if (!entry.name) continue;
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(entry.name!);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          const stores: unknown[] = [];
          for (const name of db.objectStoreNames) {
            const values = await new Promise<unknown[]>((resolve, reject) => {
              const rows: unknown[] = [];
              const request = db.transaction(name, "readonly").objectStore(name).openCursor();
              request.onsuccess = () => { const cursor = request.result;
                if (!cursor) { resolve(rows); return; }
                rows.push([cursor.key, cursor.value]); cursor.continue(); };
              request.onerror = () => reject(request.error);
            });
            stores.push([name, values]);
          }
          databases.push([entry.name, stores]);
        } finally { db.close(); }
      }
      return { local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie, databases };
    });
    const observations = {
      audit: { captured: true as const, data: (await state.db.query("select to_jsonb(a) row from public.employee_admin_audit a where store_id=$1", [state.storeId])).rows },
      registry: { captured: true as const, data: receiptRows },
      signal: { captured: true as const, data: (await state.db.query("select to_jsonb(s) row from public.store_change_signals s where store_id=$1", [state.storeId])).rows },
      realtime: { captured: true as const, data: realtimeFrames },
      browserStorage: { captured: true as const, data: browserStorage },
      url: { captured: true as const, data: [page.url(), ...urls] },
      console: { captured: true as const, data: consoleRows },
      telemetry: { captured: true as const, data: telemetryRows },
      errorMessage: { captured: true as const, data: await page.locator("body").innerText() },
      screenshotText: { captured: true as const, data: await page.locator("body").innerText() },
    };
    const sinks: CanarySink[] = ["audit", "registry", "signal", "realtime", "browserStorage", "url",
      "console", "telemetry", "errorMessage", "screenshotText"];
    expect(assertNoCanaryLeaks({ canaries: [NEW_PIN, key, ownerHeaders!["x-pos-employee-token"], ownerHash],
      requiredSinks: sinks, observations }).checkedSinkCount).toBe(sinks.length);
    await expectSingleBootstrapStore();
  });

  test("TC-PIN-18 runtime canary: completion audit fault rolls back, then lost ACK requires new PIN login", async ({ page }) => {
    test.setTimeout(180_000);
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page);
    await expect(page.getByTestId("create-store-result")).toBeVisible();
    const key = (await page.getByTestId("result-store-key").textContent()) ?? "";
    if (!key) throw new Error("PIN_CANARY_KEY_MISSING");
    await acknowledgeAndReachRestricted(page);
    const state = fixture!;
    const owner = (await state.db.query("select id,passcode_hash from public.employees where store_id=$1 and role='owner'", [state.storeId])).rows[0];
    const canaryPin = String(randomInt(100000, 999999));
    if ([TEMP_PIN, NEW_PIN].includes(canaryPin)) throw new Error("PIN_CANARY_COLLISION");
    const requests: Array<{ payload: any; headers: Record<string, string> }> = [];
    const consoleRows: string[] = [];
    const telemetryRows: string[] = [];
    const urls: string[] = [];
    const realtimeFrames: string[] = [];
    page.on("request", request => {
      urls.push(request.url());
      if (request.url().includes("/rpc/permission_complete_required_pin_change"))
        requests.push({ payload: request.postDataJSON()?.p_request, headers: request.headers() });
    });
    page.on("console", message => { consoleRows.push(message.text()); });
    page.on("pageerror", error => { telemetryRows.push(error.message); });
    page.on("requestfailed", request => { telemetryRows.push(request.failure()?.errorText ?? ""); });
    page.on("websocket", socket => { socket.on("framereceived", frame => { realtimeFrames.push(String(frame.payload)); }); });
    let faultInstalled = false;
    try {
      await state.db.query(`create function private.tc18_completion_audit_fault() returns trigger
        language plpgsql as $$ begin raise exception 'TC18_INJECTED_COMPLETION_FAULT'; end $$`);
      await state.db.query(`create trigger tc18_completion_audit_fault before insert on public.employee_admin_audit
        for each row execute function private.tc18_completion_audit_fault()`);
      faultInstalled = true;
      await page.getByTestId("required-new-pin").fill(canaryPin);
      await page.getByTestId("required-confirm-pin").fill(canaryPin);
      await page.getByTestId("complete-required-pin").click();
      await expect(page.getByTestId("passcode-screen")).toBeVisible();
      await expect(page.getByTestId("session-notice")).toHaveText(
        "Chưa xác nhận được việc đổi PIN. Vui lòng đăng nhập lại bằng PIN mới; nếu chưa được, thử lại bằng PIN tạm.");
      expect(requests).toHaveLength(1);
      expect((await state.db.query("select count(*)::int n from public.employee_admin_audit where store_id=$1", [state.storeId])).rows[0].n).toBe(0);
      expect((await state.db.query("select passcode_hash,pin_change_required from public.employees where id=$1", [owner.id])).rows[0])
        .toEqual({ passcode_hash: owner.passcode_hash, pin_change_required: true });
      await captureTc18Scenario(page, "complete:fault", [canaryPin, key, owner.passcode_hash,
        requests[0].headers["x-pos-employee-token"]],
      { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
      await state.db.query("drop trigger tc18_completion_audit_fault on public.employee_admin_audit");
      await state.db.query("drop function private.tc18_completion_audit_fault()");
      faultInstalled = false;
    } finally {
      if (faultInstalled) {
        await state.db.query("drop trigger if exists tc18_completion_audit_fault on public.employee_admin_audit");
        await state.db.query("drop function if exists private.tc18_completion_audit_fault()");
      }
    }
    await page.locator('[data-testid^="employee-"]').first().click();
    for (const digit of TEMP_PIN) await page.getByTestId(`pin-${digit}`).click();
    await page.getByTestId("unlock-button").click();
    await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    let dropped = false;
    await page.route("**/rest/v1/rpc/permission_complete_required_pin_change", async route => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      expect((await response.json()).ok).toBe(true);
      if (!dropped) { dropped = true; await route.abort("failed"); return; }
      await route.fulfill({ response });
    });
    await page.getByTestId("required-new-pin").fill(canaryPin);
    await page.getByTestId("required-confirm-pin").fill(canaryPin);
    await page.getByTestId("complete-required-pin").click();
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
    await expect(page.getByTestId("session-notice")).toHaveText(
      "Chưa xác nhận được việc đổi PIN. Vui lòng đăng nhập lại bằng PIN mới; nếu chưa được, thử lại bằng PIN tạm.");
    expect(dropped).toBe(true);
    expect(requests).toHaveLength(2);
    const committedHash = (await state.db.query("select passcode_hash from public.employees where id=$1", [owner.id])).rows[0].passcode_hash;
    await captureTc18Scenario(page, "complete:lostAck", [canaryPin, key, owner.passcode_hash,
      committedHash, requests[1].headers["x-pos-employee-token"]],
    { realtime: realtimeFrames, console: consoleRows, telemetry: telemetryRows, urls });
    await page.locator('[data-testid^="employee-"]').first().click();
    for (const digit of canaryPin) await page.getByTestId(`pin-${digit}`).click();
    await page.getByTestId("unlock-button").click();
    await expect(page.getByTestId("floor-view")).toBeVisible({ timeout: 15_000 });
    const changed = (await state.db.query("select passcode_hash,pin_change_required,passcode_hash=extensions.crypt($2,passcode_hash) matches from public.employees where id=$1", [owner.id, canaryPin])).rows[0];
    expect(changed).toMatchObject({ pin_change_required: false, matches: true });
    expect(changed.passcode_hash).not.toBe(owner.passcode_hash);
    const audit = (await state.db.query("select request_id,outcome,credential_changed,actual_after from public.employee_admin_audit where store_id=$1", [state.storeId])).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ request_id: requests[1].payload.requestId, outcome: "applied", credential_changed: true });
    expect(audit[0].actual_after.pinChangeRequired).toBe(false);
    const registry = (await state.db.query("select payload_mac,terminal_outcome from private.employee_admin_requests where store_id=$1", [state.storeId])).rows;
    expect(registry).toHaveLength(1);
    expect(registry[0].payload_mac).toHaveLength(32);
    expect(registry[0].terminal_outcome).toMatchObject({ ok: true, outcome: "applied" });
    const sinks: CanarySink[] = ["audit", "registry", "signal", "realtime", "url", "console", "telemetry", "errorMessage"];
    const observations = {
      audit: { captured: true as const, data: audit },
      registry: { captured: true as const, data: registry },
      signal: { captured: true as const, data: (await state.db.query("select to_jsonb(s) row from public.store_change_signals s where store_id=$1", [state.storeId])).rows },
      realtime: { captured: true as const, data: realtimeFrames },
      url: { captured: true as const, data: [page.url(), ...urls] },
      console: { captured: true as const, data: consoleRows },
      telemetry: { captured: true as const, data: telemetryRows },
      errorMessage: { captured: true as const, data: await page.locator("body").innerText() },
    };
    expect(assertNoCanaryLeaks({ canaries: [canaryPin, key, changed.passcode_hash], requiredSinks: sinks, observations })
      .checkedSinkCount).toBe(sinks.length);
    await expectSingleBootstrapStore();
  });

  test("TC-PIN-18 operator-only recovery UI applies through the dedicated PostgreSQL role without leaking PIN", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const key = await createAndChangePin(page);
    const state = fixture!;
    await assertFixtureBinding(state.db);
    const owner = (await state.db.query("select id,passcode_hash from public.employees where store_id=$1 and role='owner'", [state.storeId])).rows[0];
    const grantor = (await state.db.query(`select m.grantor::regrole::text grantor from pg_auth_members m
      where m.roleid='pos_owner_recovery'::regrole and m.member='postgres'::regrole`)).rows;
    expect(grantor).toEqual([{ grantor: "supabase_admin" }]);
    await expect(verifyPgRecoveryRole(env.dsn)).rejects.toThrow("OWNER_RECOVERY_ROLE_UNAVAILABLE");
    let pin = String(randomInt(100000, 999999));
    while ([TEMP_PIN, NEW_PIN].includes(pin)) pin = String(randomInt(100000, 999999));
    const launchCode = randomUUID() + randomUUID();
    const consoleRows: string[] = [];
    const telemetryRows: string[] = [];
    const urls: string[] = [];
    const responses: string[] = [];
    let addedGrant = false;
    let operatorContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    let operatorServer: ReturnType<typeof createOwnerRecoveryServer>["server"] | undefined;
    try {
      await state.db.query("grant pos_owner_recovery to postgres with set true");
      addedGrant = true;
      await verifyPgRecoveryRole(env.dsn);
      const app = createOwnerRecoveryServer({ launchCode,
        recover: createPgRecoveryExecutor(env.dsn, new URL(env.dsn).hostname), port: 0 });
      operatorServer = app.server;
      const address = await app.listen();
      operatorContext = await browser.newContext();
      const operatorPage = await operatorContext.newPage();
      operatorPage.on("console", message => { consoleRows.push(message.text()); });
      operatorPage.on("pageerror", error => { telemetryRows.push(error.message); });
      operatorPage.on("request", request => { urls.push(request.url()); });
      operatorPage.on("response", async response => {
        if (response.url().endsWith("/api/recover")) responses.push(await response.text().catch(() => ""));
      });
      await operatorPage.goto(`http://127.0.0.1:${address.port}/`);
      await operatorPage.getByLabel("Mã mở phiên").fill(launchCode);
      await operatorPage.getByRole("button", { name: "Mở phiên 10 phút" }).click();
      await expect(operatorPage.getByText("PHIÊN OPERATOR · 10 PHÚT")).toBeVisible();
      await operatorPage.getByLabel("Store ID đã xác minh").fill(state.storeId!);
      await operatorPage.getByLabel("Owner ID đã xác minh").fill(owner.id);
      await operatorPage.getByLabel("Mã operator").fill("tc18-operator-local");
      await operatorPage.getByLabel("Mã hồ sơ hỗ trợ").fill("tc18-operator-case");
      await operatorPage.getByLabel("Mã bằng chứng xác minh").fill("tc18-operator-proof");
      await operatorPage.getByLabel("PIN tạm mới · đúng 6 chữ số").fill(pin);
      await operatorPage.getByLabel(/Tôi đã đối chiếu hồ sơ/).check();
      const requestId = await operatorPage.getByLabel("Mã yêu cầu").inputValue();
      await operatorPage.getByRole("button", { name: "Phát hành PIN tạm" }).click();
      await expect(operatorPage.getByText(/Đã phát hành PIN tạm/)).toBeVisible();
      expect((await state.db.query(`select actor_type,actor_key,request_id,operator_case_ref,operator_proof_ref
        from public.employee_admin_audit where store_id=$1 and request_id=$2`, [state.storeId, requestId])).rows[0])
        .toMatchObject({ actor_type: "operator", actor_key: "tc18-operator-local", request_id: requestId,
          operator_case_ref: "tc18-operator-case", operator_proof_ref: "tc18-operator-proof" });
      const changed = (await state.db.query("select passcode_hash,pin_change_required from public.employees where id=$1", [owner.id])).rows[0];
      expect(changed.pin_change_required).toBe(true);
      expect(changed.passcode_hash).not.toBe(owner.passcode_hash);
      const screenshot = await operatorPage.screenshot({ mask: [operatorPage.locator('input[type="password"]')], maskColor: '#000000' });
      const visibleText = await operatorPage.locator("body").innerText();
      const browserStorage = await operatorPage.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage },
        cookie: document.cookie, databases: [] }));
      const audit = (await state.db.query("select to_jsonb(a) row from public.employee_admin_audit a where store_id=$1", [state.storeId])).rows;
      const registry = (await state.db.query("select to_jsonb(r) row from private.employee_admin_requests r where store_id=$1", [state.storeId])).rows;
      const signal = (await state.db.query("select to_jsonb(s) row from public.store_change_signals s where store_id=$1", [state.storeId])).rows;
      const operatorCanaries = [pin, key, launchCode, owner.passcode_hash, changed.passcode_hash, env.dsn];
      registerTc18Canaries("operator", operatorCanaries);
      mkdirSync(tc18ArtifactDirectory, { recursive: true });
      const operatorScreenshot = join(tc18ArtifactDirectory, "operator.png");
      const operatorResponses = join(tc18ArtifactDirectory, "operator.json");
      writeFileSync(operatorScreenshot, screenshot);
      writeFileSync(operatorResponses, JSON.stringify({ responses }) + '\n');
      expect(assertNoCanaryLeaks({ canaries: operatorCanaries,
        requiredSinks: ["audit", "registry", "signal", "browserStorage", "url", "console", "telemetry",
          "artifact", "errorMessage", "screenshotText"], observations: {
          audit: { captured: true, data: audit }, registry: { captured: true, data: registry },
          signal: { captured: true, data: signal }, browserStorage: { captured: true, data: browserStorage },
          url: { captured: true, data: [operatorPage.url(), ...urls] },
          console: { captured: true, data: consoleRows }, telemetry: { captured: true, data: telemetryRows },
          artifact: { captured: true, data: readCanaryArtifactFiles([operatorScreenshot, operatorResponses]) },
          errorMessage: { captured: true, data: visibleText },
          screenshotText: { captured: true, data: { text: visibleText, pixels: screenshot } },
        } }).checkedSinkCount).toBe(10);
      await operatorPage.getByRole("button", { name: "Đã bàn giao PIN · xóa khỏi trang" }).click();
      expect(await operatorPage.getByLabel("PIN tạm mới · đúng 6 chữ số").inputValue()).toBe("");
      await page.locator('[data-testid^="employee-"]').first().click();
      for (const digit of pin) await page.getByTestId(`pin-${digit}`).click();
      await page.getByTestId("unlock-button").click();
      await expect(page.getByTestId("required-pin-change-screen")).toBeVisible();
    } finally {
      if (operatorContext) await operatorContext.close();
      if (operatorServer) await new Promise<void>(resolve => operatorServer!.close(() => resolve()));
      if (addedGrant) await state.db.query("revoke pos_owner_recovery from postgres granted by postgres");
    }
    expect((await state.db.query(`select m.grantor::regrole::text grantor from pg_auth_members m
      where m.roleid='pos_owner_recovery'::regrole and m.member='postgres'::regrole`)).rows)
      .toEqual([{ grantor: "supabase_admin" }]);
  });

  test("TC-PIN-18 matrix requires all runtime scenario captures and all eleven sinks", async () => {
    expect(assertCanaryScenarioMatrix(tc18RuntimeReports)).toMatchObject({
      scenarioCount: 20, captureCount: 220, notApplicableCount: 0,
    });
  });
});
