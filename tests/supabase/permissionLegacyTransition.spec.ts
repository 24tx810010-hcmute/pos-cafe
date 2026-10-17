import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";
import pg from "pg";
import { activateDatabase } from "../../scripts/permission-activate.mjs";
import { activationBundleManifest } from "../../scripts/permission-activation-bundle.mjs";
import { prepareCompatibilityHook, verifyCompatibilityRestRouting } from "../../scripts/permission-compatibility-prepare.mjs";
import { prepareLegacyBrowserSurface } from "../../scripts/permission-legacy-browser-prepare.mjs";
import { LEGACY_PERMISSION_HEAD, legacyArtifactPaths } from "../../scripts/permission-legacy-head.mjs";
import { EMPLOYEE_IDS, STORE_IDS, assertBridgeFixture } from "../../scripts/permission-identity-runtime.mjs";
import { captureSnapshot, permissionFingerprint } from "../../scripts/permission-preflight-core.mjs";
import { candidateEnvironment, installStoreSession } from "./permissionCandidateEnvironment.ts";

const PIN = "384729";
const LEGACY_URL = "http://127.0.0.1:5179";

type WritePayload = Record<string, unknown> & { orderId: string; paymentId: string };
type RpcBody = { p_operation_id: string; p_payload: WritePayload };

async function login(page: Page, employeeId: string) {
  await installStoreSession(page);
  await page.goto("/");
  await expect(page.getByTestId("passcode-screen")).toBeVisible();
  await page.getByTestId(`employee-${employeeId}`).click();
  for (const digit of PIN) await page.getByTestId(`pin-${digit}`).click();
  await page.getByTestId("unlock-button").click();
  await expect(page.getByTestId("floor-view")).toBeVisible();
}

async function writeProof(db: pg.Client, operationId: string, paymentId: string) {
  const operation = (await db.query(`select operation_id,status,payload,result,initiated_by_employee_id,executed_by_employee_id,
    cancelled_by_employee_id from public.write_operations where operation_id=$1`, [operationId])).rows;
  const payments = (await db.query("select id,order_id,employee_id,amount,received_amount,change_amount from public.payments where id=$1", [paymentId])).rows;
  const operationCount = (await db.query("select count(*)::int count from public.write_operations")).rows[0].count as number;
  return { operation, payments, operationCount };
}

async function writeMappings(testInfo: TestInfo, sourceSnapshotHash: string) {
  const mappings = [
    { schemaVersion: 1, storeId: STORE_IDS[0], ownerId: EMPLOYEE_IDS[0], verifiedByRef: "synthetic:legacy-browser-primary", evidenceRefs: ["synthetic:isolated-fixture"], sourceSnapshotHash },
    { schemaVersion: 1, storeId: STORE_IDS[1], ownerId: EMPLOYEE_IDS[3], verifiedByRef: "synthetic:legacy-browser-primary", evidenceRefs: ["synthetic:isolated-fixture"], sourceSnapshotHash },
  ];
  return mappings.map((mapping, index) => {
    const path = testInfo.outputPath(`owner-mapping-${index + 1}.json`);
    writeFileSync(path, JSON.stringify(mapping), { mode: 0o600 });
    return path;
  });
}

test("TC-PERM-51/54 archived phase27 browser is rejected and candidate reconciles its resumed K after a lost ACK by historical read", async ({ browser }, testInfo) => {
  const env = candidateEnvironment();
  const db = new pg.Client({ connectionString: env.dsn });
  const legacyContext = await browser.newContext({ baseURL: LEGACY_URL });
  const candidateContext = await browser.newContext({ baseURL: "http://127.0.0.1:5178" });
  const sourceFingerprint = permissionFingerprint();
  const bundle = activationBundleManifest();
  const legacyManifest = JSON.parse(readFileSync(legacyArtifactPaths().report, "utf8")) as Record<string, unknown>;
  const evidence: Record<string, unknown> = { sourceFingerprint, bundleHash: bundle.sha256, legacyManifest };
  expect(legacyManifest).toMatchObject({ schemaVersion: 1, legacyHead: LEGACY_PERMISSION_HEAD, archiveFormat: "git-archive-tar" });

  await db.connect();
  try {
    // These guards run before the first database mutation. They bind both the
    // observer and REST service to the exact two-store isolated fixture.
    await assertBridgeFixture(db, env, "legacy");
    expect((await db.query("select count(*)::int count from public.stores")).rows[0].count).toBe(2);
    expect((await db.query("select to_regclass('public.permission_catalog') value")).rows[0].value).toBeNull();

    const legacySurface = await prepareLegacyBrowserSurface(db, { marker: env.marker, storeIds: STORE_IDS });
    expect(legacySurface).toMatchObject({ status: "LEGACY_BROWSER_READS_READY" });
    evidence.legacySurface = legacySurface;
    const preparation = await prepareCompatibilityHook(db);
    expect(preparation).toMatchObject({ status: "PREPARED", requiresRestProbe: true });
    await expect(verifyCompatibilityRestRouting({ restUrl: `${env.api}/rest/v1`, anonKey: env.anonKey })).resolves.toBe(true);
    for (const row of (await db.query(`select c.relname,has_table_privilege('authenticated',c.oid,'SELECT') allowed
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
      and c.relname=any($1::text[]) order by c.relname`, [["orders", "order_items", "order_item_options", "payments"]])).rows) expect(row.allowed).toBe(true);
    evidence.compatibilityPreparation = preparation;

    const legacy = await legacyContext.newPage();
    let legacyEmployeeToken = "";
    const unmarkedRequests: { path: string; contract?: string }[] = [];
    legacy.on("request", request => {
      const url = new URL(request.url());
      if (url.origin !== env.api || !url.pathname.startsWith("/rest/v1/")) return;
      legacyEmployeeToken ||= request.headers()["x-pos-employee-token"] ?? "";
      unmarkedRequests.push({ path: url.pathname, contract: request.headers()["x-pos-permission-contract"] });
    });
    await login(legacy, EMPLOYEE_IDS[0]);
    await expect.poll(() => legacyEmployeeToken.length).toBeGreaterThan(0);
    expect(unmarkedRequests.some(request => request.contract !== undefined)).toBe(false);

    const occupied = legacy.locator('[data-testid^="table-"]').filter({ has: legacy.locator('[data-floor-label="price"]') }).first();
    await expect(occupied).toBeVisible();
    await occupied.click();
    await expect(legacy.getByTestId("order-drawer")).toBeVisible();
    await legacy.getByTestId("submit-order-button-footer").click();
    await expect(legacy.getByTestId("payment-drawer")).toBeVisible();

    let heldExecute: RpcBody | undefined;
    const holdLegacyExecute = async (route: Route) => {
      heldExecute = route.request().postDataJSON() as RpcBody;
      await route.abort("failed");
    };
    await legacy.route("**/rest/v1/rpc/execute_write_operation", holdLegacyExecute);
    const registeredResponse = legacy.waitForResponse(response => response.url().endsWith("/rpc/register_write_operation"));
    await legacy.getByTestId("pay-button-footer").click();
    expect((await registeredResponse).ok()).toBe(true);
    await expect.poll(() => heldExecute).toBeTruthy();
    await expect(legacy.getByTestId("write-attempt-notice")).toBeVisible();
    const operationId = heldExecute!.p_operation_id;
    const payload = heldExecute!.p_payload;
    expect(operationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload).toMatchObject({ schemaVersion: 1, kind: "pay_order" });

    const pendingProof = await writeProof(db, operationId, payload.paymentId);
    expect(pendingProof.operation).toEqual([expect.objectContaining({
      operation_id: operationId,
      status: "pending",
      payload,
      result: null,
      initiated_by_employee_id: EMPLOYEE_IDS[0],
      executed_by_employee_id: null,
    })]);
    expect(pendingProof.payments).toHaveLength(0);
    await legacy.unroute("**/rest/v1/rpc/execute_write_operation", holdLegacyExecute);

    // Snapshot and approved mapping are created only after the pass-through hook
    // was proven through REST and after the legacy browser registered its real K.
    const before = await captureSnapshot(db);
    const mappingFiles = await writeMappings(testInfo, before.hash);
    const activation = await activateDatabase({
      schemaVersion: 1,
      mode: "synthetic-activation",
      connectionString: env.dsn,
      database: "postgres",
      marker: env.marker,
      storeIds: STORE_IDS,
      sourceFingerprint,
      bundleHash: bundle.sha256,
      mappingFiles,
    });
    expect(activation).toMatchObject({ status: "ACTIVATED", legacyEnumTeardown: "COMPLETE", legacyEnumDependencies: 0 });
    expect(permissionFingerprint()).toBe(sourceFingerprint);
    evidence.activation = activation;

    // The committed bundle emits a schema reload notification. Emit the same
    // post-commit signal as candidate global setup, then read the just-committed
    // contract directly while PostgREST handles that asynchronous notification.
    await db.query("notify pgrst,'reload schema'");
    const contract = (await db.query("select public.permission_get_contract() contract")).rows[0].contract as {
      permissionContractVersion?: number; writeProtocolVersion?: number;
    };
    expect(contract.permissionContractVersion).toEqual(expect.any(Number));
    expect(contract.writeProtocolVersion).toBe(1);
    const expectedContractHeader = String(contract.permissionContractVersion);
    evidence.contract = contract;

    await legacy.getByRole("button", { name: "Thử lại cùng lệnh", exact: true }).click();
    await expect(legacy.getByRole("status").filter({ hasText: "Phiên bản ứng dụng và server chưa tương thích. Tạm dừng ghi và tải lại ứng dụng." })).toBeVisible();
    await expect(legacy.getByTestId("compatibility-update-gate")).toHaveCount(0);
    const deniedReload = legacy.waitForResponse(response => response.url().includes("/rest/v1/") && response.status() === 426);
    await legacy.reload();
    expect((await deniedReload).status()).toBe(426);
    await expect(legacy.getByTestId("compatibility-update-gate")).toHaveCount(0);
    expect(await writeProof(db, operationId, payload.paymentId)).toEqual(pendingProof);

    const contractResponse = await fetch(`${env.api}/rest/v1/rpc/permission_get_contract`, {
      method: "POST", headers: { apikey: env.anonKey, "Content-Type": "application/json" }, body: "{}",
      signal: AbortSignal.timeout(10_000),
    });
    expect(contractResponse.ok, await contractResponse.text()).toBe(true);

    const oldCalls: { path: string; status: number; body: { code?: string } }[] = [];
    for (const call of [
      { path: "orders?select=id&limit=1" },
      { path: "rpc/permission_get_open_order_detail", body: { p_order_id: payload.orderId } },
      { path: "rpc/execute_write_operation", body: { p_operation_id: operationId, p_payload: payload } },
      { path: "rpc/get_write_operation", body: { p_operation_id: operationId } },
    ]) {
      oldCalls.push(await legacy.evaluate(async ({ api, anonKey, storeJwt, employeeToken, call }) => {
        const response = await fetch(`${api}/rest/v1/${call.path}`, {
          method: call.body ? "POST" : "GET",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${storeJwt}`,
            "Content-Type": "application/json",
            "x-pos-employee-token": employeeToken,
          },
          body: call.body ? JSON.stringify(call.body) : undefined,
        });
        return { path: call.path, status: response.status, body: await response.json() };
      }, { api: env.api, anonKey: env.anonKey, storeJwt: env.storeJwt, employeeToken: legacyEmployeeToken, call }));
    }
    expect(oldCalls).toHaveLength(4);
    for (const response of oldCalls) expect(response).toMatchObject({ status: 426, body: { code: "WRITE_PROTOCOL_UNSUPPORTED" } });
    expect(await writeProof(db, operationId, payload.paymentId)).toEqual(pendingProof);
    evidence.legacyStrictCalls = oldCalls;

    const candidate = await candidateContext.newPage();
    const candidateWrites: { name: string; body: Record<string, unknown>; contract?: string }[] = [];
    let candidateEmployeeToken = "";
    candidate.on("request", request => {
      const match = /\/rest\/v1\/rpc\/(register_write_operation|execute_write_operation|get_write_operation)/.exec(request.url());
      candidateEmployeeToken ||= request.headers()["x-pos-employee-token"] ?? "";
      if (match) candidateWrites.push({ name: match[1], body: request.postDataJSON() as Record<string, unknown>, contract: request.headers()["x-pos-permission-contract"] });
    });
    await login(candidate, EMPLOYEE_IDS[1]);
    await expect.poll(() => candidateEmployeeToken.length).toBeGreaterThan(0);
    await candidate.getByTestId("nav-write-recovery").click();
    await expect(candidate.getByTestId("write-recovery-drawer")).toBeVisible();
    await expect(candidate.getByTestId(`operation-${operationId}`)).toBeVisible();
    await candidate.getByTestId(`operation-${operationId}`).click();
    await expect(candidate.getByTestId("operation-status")).toContainText("Chưa thực hiện");

    let lostAckCommitted = false;
    let firstTerminal: Awaited<ReturnType<typeof writeProof>> | undefined;
    await candidate.route("**/rest/v1/rpc/execute_write_operation", async route => {
      if (lostAckCommitted) { await route.continue(); return; }
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      firstTerminal = await writeProof(db, operationId, payload.paymentId);
      expect(firstTerminal.operation).toEqual([expect.objectContaining({ status: "applied", payload, initiated_by_employee_id: EMPLOYEE_IDS[0], executed_by_employee_id: EMPLOYEE_IDS[1] })]);
      expect(firstTerminal.payments).toHaveLength(1);
      lostAckCommitted = true;
      await route.abort("failed");
    });
    await candidate.getByTestId("write-recovery-resume").click();
    await expect.poll(() => lostAckCommitted).toBe(true);
    await expect(candidate.getByTestId("operation-status")).toContainText("Đã ghi thành công");
    await expect(candidate.getByTestId("historical-result")).toBeVisible();

    const terminalProof = await writeProof(db, operationId, payload.paymentId);
    expect(terminalProof.operationCount).toBe(pendingProof.operationCount);
    expect(terminalProof.payments).toHaveLength(1);
    expect(terminalProof.operation[0]).toMatchObject({
      operation_id: operationId,
      status: "applied",
      payload,
      result: firstTerminal!.operation[0].result,
      initiated_by_employee_id: EMPLOYEE_IDS[0],
      executed_by_employee_id: EMPLOYEE_IDS[1],
    });
    expect(candidateWrites.filter(request => request.name === "register_write_operation")).toHaveLength(0);
    expect(candidateWrites.filter(request => request.name === "execute_write_operation")).toHaveLength(1);
    for (const request of candidateWrites) expect(request.contract).toBe(expectedContractHeader);
    for (const request of candidateWrites.filter(request => request.name === "execute_write_operation")) {
      expect(request.body).toEqual({ p_operation_id: operationId, p_payload: payload });
    }
    evidence.operation = {
      operationId, payload, pendingProof, firstTerminal, terminalProof, candidateWrites,
      lostAckReconciliation: "historical-read-after-transport-loss",
      terminalExecuteReplayObserved: false,
    };
  } finally {
    await testInfo.attach("permission-legacy-transition-evidence.json", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
    await legacyContext.close();
    await candidateContext.close();
    await db.end().catch(() => {});
  }
});
