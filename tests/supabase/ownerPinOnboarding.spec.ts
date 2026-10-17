import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { STORE_IDS, runtimeProof } from "../../scripts/permission-identity-runtime.mjs";
import { candidateEnvironment } from "./permissionCandidateEnvironment.ts";

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
  reservationRequestIds: string[];
};

type TransportCapture = {
  counts: { reserve: number; signup: number; passwordSignIn: number; bootstrap: number };
  reserveRequestIds: string[];
  signupEmails: string[];
  bootstrapRequests: Record<string, unknown>[];
};

const env = candidateEnvironment();
let fixture: FixtureState | undefined;

async function assertFixtureBinding(db: pg.Client, lock = false) {
  runtimeProof();
  const marker = (await db.query(`select current_database() db,marker,engine,store_ids
    from private.idempotency_test_environment where singleton${lock ? " for update" : ""}`)).rows;
  if (marker.length !== 1 || marker[0].db !== "postgres" || marker[0].marker !== env.marker
    || marker[0].engine !== "supabase-identity-v1" || JSON.stringify(marker[0].store_ids) !== JSON.stringify(STORE_IDS)) {
    throw new Error("OWNER_PIN_FIXTURE_BINDING_MISMATCH");
  }
}

async function resolveOwnedStore(state: FixtureState) {
  if (state.storeId || state.storeNo === undefined) return;
  const rows = (await state.db.query(`select u.id,u.email from auth.users u
    where u.email=$1`, [`store${state.storeNo}@store.pos.local`])).rows;
  if (rows.length > 1) throw new Error("OWNER_PIN_AUTH_IDENTITY_AMBIGUOUS");
  state.storeId = rows[0]?.id;
}

test.beforeEach(async () => {
  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 60_000 });
  await db.connect();
  await assertFixtureBinding(db);
  const stores = (await db.query("select id from public.stores order by id")).rows.map(row => row.id);
  const users = (await db.query("select id from auth.users order by id")).rows.map(row => row.id);
  if (JSON.stringify(stores) !== JSON.stringify(STORE_IDS)) throw new Error("OWNER_PIN_FIXTURE_NOT_CLEAN");
  if (JSON.stringify(users) !== JSON.stringify(STORE_IDS)) throw new Error("OWNER_PIN_AUTH_FIXTURE_NOT_CLEAN");
  const originalSequence = (await db.query("select last_value::text,is_called from public.store_no_seq")).rows[0];
  fixture = { db, originalSequence, reservationRequestIds: [] };
});

test.afterEach(async ({ page }) => {
  await page.close();
  const state = fixture;
  fixture = undefined;
  if (!state) return;
  const { db } = state;
  try {
    await resolveOwnedStore(state);
    await db.query("begin");
    await assertFixtureBinding(db, true);
    if (state.storeId) {
      const expectedEmail = state.storeNo === undefined ? null : `store${state.storeNo}@store.pos.local`;
      const ownedAuth = (await db.query("select id,email from auth.users where id=$1", [state.storeId])).rows;
      if (ownedAuth.length !== 1 || ownedAuth[0].email !== expectedEmail) throw new Error("OWNER_PIN_AUTH_IDENTITY_MISMATCH");
      const actualStores = (await db.query("select id from public.stores order by id")).rows.map(row => row.id).sort();
      const storeWasBootstrapped = actualStores.includes(state.storeId);
      const allowedStores = storeWasBootstrapped ? [...STORE_IDS, state.storeId].sort() : [...STORE_IDS].sort();
      if (JSON.stringify(actualStores) !== JSON.stringify(allowedStores)) throw new Error("OWNER_PIN_FIXTURE_SCOPE_CHANGED");
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
    if (state.storeNo !== undefined) await db.query("delete from private.store_no_reservations where store_no=$1", [state.storeNo]);
    for (const requestId of state.reservationRequestIds) {
      await db.query("delete from private.store_no_reservations where request_id=$1", [requestId]);
    }
    await db.query("select setval('public.store_no_seq',$1::bigint,$2::boolean)", [state.originalSequence.last_value, state.originalSequence.is_called]);
    const remainingStores = (await db.query("select id from public.stores order by id")).rows.map(row => row.id);
    const remainingUsers = (await db.query("select id from auth.users order by id")).rows.map(row => row.id);
    if (JSON.stringify(remainingStores) !== JSON.stringify(STORE_IDS)
      || JSON.stringify(remainingUsers) !== JSON.stringify(STORE_IDS)) throw new Error("OWNER_PIN_FIXTURE_RESTORE_FAILED");
    await db.query("commit");
  } catch (error) {
    await db.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await db.end();
  }
});

async function installCreateTransport(page: Page, drop: DropPoint = null) {
  const state = fixture!;
  const capture: TransportCapture = {
    counts: { reserve: 0, signup: 0, passwordSignIn: 0, bootstrap: 0 },
    reserveRequestIds: [], signupEmails: [], bootstrapRequests: [],
  };
  let dropped = false;

  await page.route("**/rest/v1/rpc/permission_reserve_store_no", async route => {
    capture.counts.reserve += 1;
    const request = route.request().postDataJSON() as { p_create_attempt_id: string };
    capture.reserveRequestIds.push(request.p_create_attempt_id);
    state.reservationRequestIds.push(request.p_create_attempt_id);
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
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    if (drop === "signup" && !dropped) { dropped = true; await route.abort("failed"); return; }
    await route.fulfill({ response });
  });

  await page.route(/\/auth\/v1\/token\?grant_type=password(?:&|$)/, async route => {
    capture.counts.passwordSignIn += 1;
    await route.continue();
  });

  await page.route("**/rest/v1/rpc/permission_bootstrap_store", async route => {
    capture.counts.bootstrap += 1;
    const body = route.request().postDataJSON() as { p_request: Record<string, unknown> };
    capture.bootstrapRequests.push(body.p_request);
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const result = await response.json() as { data?: { storeId?: string; storeNo?: number } };
    if (typeof result.data?.storeId !== "string" || !Number.isInteger(result.data.storeNo)) {
      throw new Error("OWNER_PIN_BOOTSTRAP_RESPONSE_INVALID");
    }
    state.storeId = result.data.storeId;
    state.storeNo = result.data.storeNo;
    if (drop === "bootstrap" && !dropped) { dropped = true; await route.abort("failed"); return; }
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

async function submitCreate(page: Page) {
  await page.getByTestId("store-name-input").fill(`  ${CREATE_NAME}  `);
  await page.getByLabel("Địa chỉ (tuỳ chọn)").fill(`  ${CREATE_ADDRESS}  `);
  await page.getByTestId("seed-demo-checkbox").check();
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
    (select count(*)::int from auth.users where id=$1) auth_users`, [state.storeId, state.storeNo])).rows[0];
  expect(snapshot).toEqual({ stores: 1, settings: 1, owners: 1, workflows: 1, bootstraps: 1, auth_users: 1 });
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
  await acknowledgeAndReachRestricted(page);
  await completeRequiredPin(page);
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

test.describe.serial("owner PIN onboarding on an isolated candidate fixture", () => {
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
        expect(capture.bootstrapRequests[1]).toEqual(capture.bootstrapRequests[0]);
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
    expect(capture.signupEmails).toHaveLength(1);
    expect(capture.counts.reserve).toBe(1);
    expect(capture.counts.bootstrap).toBe(1);
    await expectSingleBootstrapStore();
  });

  test("TC-PIN-02/12 create to Key ACK stays restricted until changed PIN login, then seeds once", async ({ page }) => {
    const rpcNames: string[] = [];
    page.on("request", request => {
      const match = request.url().match(/\/rest\/v1\/rpc\/([^?]+)/);
      if (match) rpcNames.push(match[1]);
    });
    await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page);
    await acknowledgeAndReachRestricted(page, rpcNames);
    const forbiddenBeforeNormal = new Set([
      "permission_get_authority", "permission_get_revision", "permission_get_initial_seed_status",
      "permission_begin_initial_seed", "permission_run_initial_seed_stage", "permission_get_menu_catalog",
      "permission_get_floor_workspace", "permission_get_settings_admin", "permission_admin_list",
    ]);
    expect(rpcNames.some(name => forbiddenBeforeNormal.has(name))).toBe(false);
    await completeRequiredPin(page);
    const stages: Stage[] = [];
    page.on("response", response => {
      if (!response.url().includes("/rpc/permission_run_initial_seed_stage") || !response.ok()) return;
      const stage = response.request().postDataJSON()?.p_request?.stage as Stage;
      if (STAGES.includes(stage)) stages.push(stage);
    });
    await loginWithNewPin(page);
    await expect.poll(() => stages, { timeout: 15_000 }).toEqual(STAGES);
    await expect.poll(async () => (await stageSnapshot()).stages.map(row => row.status)).toEqual(["committed", "committed", "committed"]);
    const snapshot = await stageSnapshot();
    expect(snapshot.counts).toEqual({ employees: 1, categories: 2, menu_items: 6, option_groups: 2, option_values: 4, menu_links: 3, areas: 1, tables: 4, decor: 7 });
    await expectSingleBootstrapStore();
  });

  test("TC-PIN-12 compatibility unmount keeps the unacknowledged Store Key and blocks protected UI", async ({ page }) => {
    let bootstrapCommitted = false;
    await page.route("**/rest/v1/rpc/permission_get_contract", async route => {
      if (bootstrapCommitted) {
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
  });

  test("TC-PIN-12 hard reload loses the in-memory Key, does not recreate, and accepts the externally saved Key", async ({ page }) => {
    const capture = await installCreateTransport(page);
    await openCreate(page);
    await submitCreate(page);
    await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 15_000 });
    const savedKey = (await page.getByTestId("result-store-key").textContent()) ?? "";
    expect(savedKey.length > 0).toBe(true);
    const persistedBefore = await page.evaluate(key => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(key), savedKey);
    expect(persistedBefore).toBe(false);
    await page.reload();
    await expect(page.getByTestId("reload-store-key-notice")).toContainText("Hệ thống không thể hiển thị lại Store Key chưa được lưu.");
    await expect(page.getByTestId("create-store-result")).toHaveCount(0);
    await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
    expect(page.url().includes(savedKey)).toBe(false);
    expect(await page.evaluate(key => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(key), savedKey)).toBe(false);
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
    await expectSingleBootstrapStore();
  });

  for (const droppedStage of STAGES) {
    test(`TC-PIN-14 lost ${droppedStage} seed ACK stops, survives reload, and never reapplies committed rows`, async ({ page }) => {
      await createAndChangePin(page);
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
      await expect.poll(() => dropped).toBe(true);
      await expect.poll(() => statusReads, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
      const droppedIndex = STAGES.indexOf(droppedStage);
      expect(calls).toEqual(STAGES.slice(0, droppedIndex + 1));
      if (droppedStage === "floor") await expect(page.getByTestId("initial-seed-status")).toHaveCount(0);
      else await expect(page.getByTestId("retry-initial-seed")).toBeVisible();
      const afterLoss = await stageSnapshot();
      expect(afterLoss.stages.map(row => row.status)).toEqual(STAGES.map((_, index) => index <= droppedIndex ? "committed" : "pending"));
      const committedCounts = structuredClone(afterLoss.counts);

      await page.unroute("**/rest/v1/rpc/permission_run_initial_seed_stage");
      await page.reload();
      await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
      const resumedCalls: Stage[] = [];
      page.on("request", request => {
        if (!request.url().includes("/rpc/permission_run_initial_seed_stage")) return;
        resumedCalls.push(request.postDataJSON()?.p_request?.stage as Stage);
      });
      await loginWithNewPin(page);
      if (droppedStage === "floor") await expect(page.getByTestId("initial-seed-status")).toHaveCount(0);
      else await expect(page.getByTestId("retry-initial-seed")).toBeVisible();
      expect(resumedCalls).toEqual([]);
      expect((await stageSnapshot()).counts).toEqual(committedCounts);

      if (droppedStage === "floor") {
        await expect(page.getByTestId("retry-initial-seed")).toHaveCount(0);
      } else {
        await expect(page.getByTestId("retry-initial-seed")).toBeVisible();
        await page.getByTestId("retry-initial-seed").click();
        await expect.poll(async () => (await stageSnapshot()).stages.map(row => row.status), { timeout: 15_000 })
          .toEqual(["committed", "committed", "committed"]);
        expect(resumedCalls).toEqual(STAGES.slice(droppedIndex + 1));
      }
      const completed = await stageSnapshot();
      expect(completed.counts).toEqual({ employees: 1, categories: 2, menu_items: 6, option_groups: 2, option_values: 4, menu_links: 3, areas: 1, tables: 4, decor: 7 });
    });
  }
});
