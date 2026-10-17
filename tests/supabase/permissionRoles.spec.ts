import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { EMPLOYEE_IDS } from "../../scripts/permission-identity-runtime.mjs";
import { candidateEnvironment, installStoreSession } from "./permissionCandidateEnvironment.ts";

const FIXTURE_PIN = "384729";
const CUSTOM_PIN = "456789";

type RpcResult = { status: number; body: any };
type PaidWrite = { operationId: string; payload: Record<string, unknown>; orderId: string };

function captureEmployeeToken(page: Page) {
  let token = "";
  page.on("request", request => {
    const next = request.headers()["x-pos-employee-token"];
    if (next) token = next;
  });
  return async () => {
    await expect.poll(() => token.length, { timeout: 10_000 }).toBeGreaterThan(0);
    return token;
  };
}

async function unlock(page: Page, employeeId: string, pin = FIXTURE_PIN) {
  await installStoreSession(page);
  await page.goto("/");
  await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId(`employee-${employeeId}`).click();
  for (const digit of pin) await page.getByTestId(`pin-${digit}`).click();
  await page.getByTestId("unlock-button").click();
  await expect(page.getByTestId("floor-view")).toBeVisible({ timeout: 15_000 });
}

async function unlockExistingStore(page: Page, employeeId: string, pin: string) {
  await expect(page.getByTestId("passcode-screen")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId(`employee-${employeeId}`).click();
  for (const digit of pin) await page.getByTestId(`pin-${digit}`).click();
  await page.getByTestId("unlock-button").click();
  await expect(page.getByTestId("floor-view")).toBeVisible({ timeout: 15_000 });
}

async function rpc(page: Page, token: string, name: string, args: Record<string, unknown> = {}): Promise<RpcResult> {
  const { api, anonKey } = candidateEnvironment();
  return page.evaluate(async input => {
    const session = Object.values(localStorage).map(value => {
      try { return JSON.parse(value); } catch { return null; }
    }).find(value => value?.access_token);
    if (!session?.access_token) throw new Error("BROWSER_STORE_SESSION_REQUIRED");
    const response = await fetch(`${input.api}/rest/v1/rpc/${input.name}`, {
      method: "POST",
      headers: {
        apikey: input.anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "x-pos-employee-token": input.token,
        "x-pos-permission-contract": "2",
      },
      body: JSON.stringify(input.args),
    });
    return { status: response.status, body: await response.json() };
  }, { api, anonKey, token, name, args });
}

async function expectSuccessfulMutation(page: Page, rpcName: string, action: () => Promise<void>) {
  const pending = page.waitForResponse(response => response.url().endsWith(`/rpc/${rpcName}`));
  await action();
  const response = await pending;
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body).toMatchObject({ ok: true });
  return body;
}

async function createEmployee(page: Page, name: string, role: "waiter" | "cashier" | "manager", configure?: (page: Page) => Promise<void>) {
  await page.getByTestId("nav-employees").click();
  await page.getByTestId("add-employee-button").click();
  await page.getByTestId("employee-name-input").fill(name);
  await page.getByTestId("employee-role-select").selectOption(role);
  await page.getByTestId("employee-pin-input").fill(CUSTOM_PIN);
  await page.getByTestId("employee-confirm-pin-input").fill(CUSTOM_PIN);
  if (configure) await configure(page);
  await expectSuccessfulMutation(page, "permission_admin_create", () => page.getByTestId("save-employee-button").click());
  const row = page.locator('[data-testid^="employee-row-"]').filter({ hasText: name });
  await expect(row).toBeVisible();
  const id = (await row.getAttribute("data-testid"))?.slice("employee-row-".length);
  if (!id) throw new Error("CREATED_EMPLOYEE_ID_REQUIRED");
  await page.getByTestId("employees-close-button").click();
  await expect(page.getByTestId("employees-drawer")).toBeHidden();
  return id;
}

async function payOccupiedOrder(page: Page): Promise<PaidWrite> {
  const occupied = page.locator('[data-testid^="table-"]').filter({ has: page.locator('[data-floor-label="price"]') }).first();
  if (await occupied.count() === 0) {
    const empty = page.locator('[data-testid^="table-"]').first();
    await expect(empty).toBeVisible();
    await empty.click();
    await expect(page.getByTestId("order-drawer")).toBeVisible();
    await page.getByTestId("order-drawer").locator('[data-testid^="menu-item-"]').first().click();
    const modifier = page.getByTestId("modifier-confirm");
    if (await modifier.isVisible()) await modifier.click();
    await page.getByTestId("submit-order-button-footer").click();
    const kitchenPreview = page.getByTestId("receipt-preview");
    await expect(kitchenPreview).toBeVisible({ timeout: 10_000 });
    await kitchenPreview.getByTestId("receipt-close-footer").click();
  }
  await expect(occupied).toBeVisible();
  await occupied.click();
  await expect(page.getByTestId("order-drawer")).toBeVisible();
  await page.getByTestId("submit-order-button-footer").click();
  await expect(page.getByTestId("payment-drawer")).toBeVisible();
  await page.getByTestId("payment-received-amount").fill("1000000");
  let requestBody: any;
  const request = page.waitForRequest(value => {
    if (!value.url().endsWith("/rpc/execute_write_operation")) return false;
    const body = value.postDataJSON();
    if (body?.p_payload?.kind !== "pay_order") return false;
    requestBody = body;
    return true;
  });
  const response = page.waitForResponse(value => value.url().endsWith("/rpc/execute_write_operation"));
  await page.getByTestId("pay-button-footer").click();
  await request;
  const paid = await response;
  expect(paid.ok()).toBeTruthy();
  expect(await paid.json()).toMatchObject({ ok: true, operation: { operationId: requestBody.p_operation_id, status: "applied" } });
  await expect(page.getByTestId("receipt-preview")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("receipt-close-footer").click();
  return { operationId: requestBody.p_operation_id, payload: requestBody.p_payload, orderId: requestBody.p_payload.orderId };
}

async function installPrintCounter(page: Page) {
  await page.addInitScript(() => {
    if (window === window.top) (window as any).__permissionPrintCount = 0;
    window.print = () => {
      const root = window.top as any;
      root.__permissionPrintCount = (root.__permissionPrintCount ?? 0) + 1;
      // A native print dialog returns focus when dismissed. The headless stub
      // must do that too: leaving focus in the zero-size iframe makes the next
      // pointer-down resume authority verification before its pointer-up.
      root.focus();
    };
  });
}

const printCount = (page: Page) => page.evaluate(() => (window as any).__permissionPrintCount ?? 0);

// Read-only inspection of the real mounted QueryClientProvider. No app hook or
// cache mutation is installed. Assert a nonempty baseline so a missing observer
// cannot make the employee-switch cache test pass vacuously.
async function employeeCacheEntries(page: Page, employeeId: string) {
  return page.evaluate(id => {
    const element = document.getElementById("root") as any;
    const key = Object.keys(element ?? {}).find(name => name.startsWith("__reactContainer$"));
    const root = key && element[key]?.stateNode?.current;
    if (!root) throw new Error("MOUNTED_REACT_ROOT_REQUIRED");
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      const client = node.memoizedProps?.client;
      if (typeof client?.getQueryCache === "function") {
        return client.getQueryCache().getAll().filter((query: any) =>
          query.queryKey[0] === "permission" && query.queryKey[2] === id).length as number;
      }
      if (node.child) stack.push(node.child);
      if (node.sibling) stack.push(node.sibling);
    }
    throw new Error("MOUNTED_QUERY_CLIENT_REQUIRED");
  }, employeeId);
}

test("TC-PERM-56 defaults, overrides, reprint, ceiling and employee-switch lifetime stay aligned", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const actorContext = await browser.newContext();
  const managerContext = await browser.newContext();
  try {
    const owner = await ownerContext.newPage();
    await unlock(owner, EMPLOYEE_IDS[0]);
    const paid = await payOccupiedOrder(owner);
    const defaultWaiter = await createEmployee(owner, "Default W TC56", "waiter");
    const roleDefaults = [
      { id: EMPLOYEE_IDS[0], role: "owner", permissions: ["floor.view", "order.create", "order.update", "order.voidOpen", "payment.take", "orderHistory.view", "order.voidPaid", "menu.manage", "floor.manage", "employee.manage", "employee.permission.edit", "report.view", "settings.manage", "data.clearDemo", "receipt.reprint"] },
      { id: EMPLOYEE_IDS[1], role: "manager", permissions: ["floor.view", "order.create", "order.update", "order.voidOpen", "payment.take", "orderHistory.view", "order.voidPaid", "menu.manage", "floor.manage", "employee.manage", "report.view", "receipt.reprint"] },
      { id: EMPLOYEE_IDS[2], role: "cashier", permissions: ["floor.view", "order.create", "order.update", "order.voidOpen", "payment.take", "orderHistory.view", "receipt.reprint"] },
      { id: defaultWaiter, role: "waiter", permissions: ["floor.view", "order.create", "order.update"] },
    ];
    for (const expected of roleDefaults) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        const token = captureEmployeeToken(page);
        await unlock(page, expected.id, expected.role === "waiter" ? CUSTOM_PIN : FIXTURE_PIN);
        const authority = await rpc(page, await token(), "permission_get_authority");
        expect(authority.body).toMatchObject({ ok: true, data: { snapshot: { role: expected.role, permissions: [...expected.permissions].sort() } } });
        for (const [nav, permission] of [["nav-order-history", "orderHistory.view"], ["nav-report", "report.view"], ["nav-employees", "employee.manage"], ["nav-menu-editor", "menu.manage"], ["nav-floor-editor", "floor.manage"], ["nav-settings", "settings.manage"]]) {
          if (expected.permissions.includes(permission)) await expect(page.getByTestId(nav)).toBeVisible();
          else await expect(page.getByTestId(nav)).toHaveCount(0);
        }
        const lookup = await rpc(page, await token(), "get_write_operation", { p_operation_id: paid.operationId });
        expect(lookup.status).toBe(200);
        if (expected.permissions.includes("payment.take")) expect(lookup.body).toMatchObject({ ok: true, operation: { operationId: paid.operationId, status: "applied" } });
        else expect(lookup.body).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      } finally { await context.close(); }
    }

    const actorId = await createEmployee(owner, "Override A TC56", "waiter", async page => {
      await page.getByTestId("permission-order.create").uncheck();
      await page.getByTestId("permission-order.update").uncheck();
      await page.getByTestId("permission-orderHistory.view").check();
      await page.getByTestId("permission-report.view").check();
    });
    const waiterId = await createEmployee(owner, "Shared B TC56", "waiter", async page => {
      await page.getByTestId("permission-orderHistory.view").check();
      await page.getByTestId("permission-receipt.reprint").check();
    });

    // A has exactly floor/history/report: both protected screens are usable, while
    // payment, kitchen and reprint entry points stay absent.
    const actor = await actorContext.newPage();
    await installPrintCounter(actor);
    const actorToken = captureEmployeeToken(actor);
    await unlock(actor, actorId, CUSTOM_PIN);
    await expect(actor.getByTestId("nav-order-history")).toBeVisible();
    await expect(actor.getByTestId("nav-report")).toBeVisible();
    const initialAuthority = await rpc(actor, await actorToken(), "permission_get_authority");
    expect(initialAuthority.body.data.snapshot.permissions).toEqual(["floor.view", "orderHistory.view", "report.view"]);
    await actor.getByTestId("nav-report").click();
    await expect(actor.getByTestId("report-summary")).toBeVisible();
    await actor.getByTestId("report-close-button").click();
    const table = actor.locator('[data-testid^="table-"]').first();
    await expectSuccessfulMutation(actor, "permission_get_floor_operational", () => table.click());
    // A has no create/update/void/payment action, so clicking a table leaves the
    // floor visible and does not mount an order/payment drawer at all.
    await expect(actor.getByTestId("floor-view")).toBeVisible();
    await expect(actor.getByTestId("order-drawer")).toHaveCount(0);
    await expect(actor.getByTestId("payment-drawer")).toHaveCount(0);
    await expect(actor.getByTestId("submit-order-button-footer")).toHaveCount(0);
    await actor.getByTestId("nav-order-history").click();
    await expect(actor.getByTestId(`history-row-${paid.orderId}`)).toBeVisible();
    await expect(actor.getByTestId("history-reprint-button")).toHaveCount(0);
    const deniedReprint = await rpc(actor, await actorToken(), "prepare_receipt_reprint", { p_order_id: paid.orderId });
    expect(deniedReprint.status).toBe(200);
    expect(deniedReprint.body).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    const deniedOperation = await rpc(actor, await actorToken(), "get_write_operation", { p_operation_id: paid.operationId });
    expect(deniedOperation.status).toBe(200);
    expect(deniedOperation.body).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    const deniedPayment = await rpc(actor, await actorToken(), "execute_write_operation", { p_operation_id: paid.operationId, p_payload: paid.payload });
    expect(deniedPayment.status).toBe(200);
    expect(deniedPayment.body).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });

    // Owner grants only receipt.reprint through the real employee editor. A gets
    // reprint without gaining payment or kitchen rights.
    await owner.getByTestId("nav-employees").click();
    await owner.getByTestId(`employee-row-${actorId}`).click();
    await owner.getByTestId("permission-receipt.reprint").check();
    await expectSuccessfulMutation(owner, "permission_admin_update", () => owner.getByTestId("save-employee-button").click());
    await expect(actor.getByTestId("history-reprint-button")).toBeVisible({ timeout: 5_000 });
    await actor.getByTestId("history-reprint-button").click();
    await expect(actor.getByTestId("receipt-preview")).toBeVisible();
    await actor.getByTestId("receipt-print-button").click();
    await expect.poll(() => printCount(actor)).toBe(1);
    // The print stub returns immediately; wait for the application's iframe
    // cleanup/focus validation before interacting with the restored preview.
    await expect(actor.locator('iframe[aria-hidden="true"]')).toHaveCount(0);
    await expect(actor.getByTestId("permission-verification-gate")).toHaveCount(0);
    await expect.poll(() => actor.evaluate(() => document.hasFocus())).toBe(true);
    await actor.getByTestId("receipt-close-footer").click();
    await expect(actor.getByTestId("receipt-preview")).toHaveCount(0);
    const grantedAuthority = await rpc(actor, await actorToken(), "permission_get_authority");
    expect(grantedAuthority.body.data.snapshot.permissions)
      .toEqual(["floor.view", "orderHistory.view", "receipt.reprint", "report.view"]);
    expect((await rpc(actor, await actorToken(), "get_write_operation", { p_operation_id: paid.operationId })).body)
      .toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect((await rpc(actor, await actorToken(), "execute_write_operation", { p_operation_id: paid.operationId, p_payload: paid.payload })).body)
      .toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });

    // Give M the delegated permission editor. The UI disables owner-only and
    // above-ceiling choices, and direct RPC calls enforce the same boundaries.
    await owner.getByTestId(`employee-row-${EMPLOYEE_IDS[1]}`).click();
    await owner.getByTestId("permission-employee.permission.edit").check();
    await expectSuccessfulMutation(owner, "permission_admin_update", () => owner.getByTestId("save-employee-button").click());
    const manager = await managerContext.newPage();
    const managerToken = captureEmployeeToken(manager);
    await unlock(manager, EMPLOYEE_IDS[1]);
    await manager.getByTestId("nav-employees").click();
    await manager.getByTestId(`employee-row-${actorId}`).click();
    await expect(manager.getByTestId("permission-data.clearDemo")).toBeDisabled();
    await expect(manager.getByTestId("permission-settings.manage")).toBeDisabled();
    const listed = await rpc(manager, await managerToken(), "permission_admin_list");
    expect(listed.body).toMatchObject({ ok: true });
    const actorView = listed.body.data.find((row: any) => row.id === actorId);
    expect(actorView).toBeTruthy();
    const authority = await rpc(manager, await managerToken(), "permission_get_authority");
    expect(authority.body).toMatchObject({ ok: true });
    const catalogRevision = authority.body.data.catalog.revision;
    const baseOverrides = { grants: ["orderHistory.view", "receipt.reprint", "report.view"], denies: ["order.create", "order.update"] };
    const update = (overrides: typeof baseOverrides) => ({
      p_request: { requestId: randomUUID(), targetId: actorId, expectedRevision: actorView.permissionRevision,
        expectedCatalogRevision: catalogRevision, patch: { overrides } },
    });
    const ownerOnly = await rpc(manager, await managerToken(), "permission_admin_update", update({ ...baseOverrides, grants: [...baseOverrides.grants, "data.clearDemo"] }));
    expect(ownerOnly.status).toBe(200);
    expect(ownerOnly.body).toMatchObject({ ok: false, error: { code: "OWNER_ONLY_PERMISSION" } });
    const ceiling = await rpc(manager, await managerToken(), "permission_admin_update", update({ ...baseOverrides, grants: [...baseOverrides.grants, "settings.manage"] }));
    expect(ceiling.status).toBe(200);
    expect(ceiling.body).toMatchObject({ ok: false, error: { code: "PERMISSION_CEILING_EXCEEDED" } });

    // Hold A's authorized receipt response, close the old view, lock the shared
    // tablet and sign in as a different employee who ALSO has history/reprint.
    // This forces the identity/view fence, rather than B's lack of permissions,
    // to reject A's late response and avoid receipt UI/cache/print dispatch.
    await manager.getByTestId("employees-close-button").click();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let captured = false;
    let heldRequest: import("@playwright/test").Request;
    await actor.route("**/rest/v1/rpc/prepare_receipt_reprint", async route => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true });
      heldRequest = route.request();
      captured = true;
      await gate;
      await route.fulfill({ response });
    });
    await actor.getByTestId("history-reprint-button").click();
    await expect.poll(() => captured).toBe(true);
    expect(await employeeCacheEntries(actor, actorId)).toBeGreaterThan(0);
    await actor.getByTestId("history-close-button").click();
    await expect(actor.getByTestId("order-history-drawer")).toBeHidden();
    await actor.getByTestId("nav-lock").click();
    await unlockExistingStore(actor, waiterId, CUSTOM_PIN);
    const nextAuthority = await rpc(actor, await actorToken(), "permission_get_authority");
    expect(nextAuthority.body).toMatchObject({ ok: true, data: { snapshot: { employeeId: waiterId } } });
    expect(nextAuthority.body.data.snapshot.permissions).toEqual(expect.arrayContaining(["orderHistory.view", "receipt.reprint"]));
    const heldResponse = actor.waitForResponse(response => response.request() === heldRequest);
    release();
    await heldResponse;
    await actor.waitForTimeout(300);
    await expect(actor.getByTestId("receipt-preview")).toHaveCount(0);
    await expect(actor.getByTestId("nav-order-history")).toBeVisible();
    await expect(actor.getByText("Fixture coffee", { exact: false })).toHaveCount(0);
    await expect(actor.locator('iframe[aria-hidden="true"]')).toHaveCount(0);
    expect(await employeeCacheEntries(actor, actorId)).toBe(0);
    expect(await employeeCacheEntries(actor, waiterId)).toBeGreaterThan(0);
    expect(await printCount(actor)).toBe(1);
  } finally {
    await Promise.allSettled([ownerContext.close(), actorContext.close(), managerContext.close()]);
  }
});
