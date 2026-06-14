import { expect, test, type Page } from "@playwright/test";

const adminPin = "123456";
const runRealtimeE2E = process.env.RUN_SUPABASE_REALTIME_E2E === "1";

async function createStoreThroughUi(page: Page) {
  await page.goto("/");
  await page.getByTestId("landing-screen").waitFor();
  await page.getByTestId("go-create-store").click();
  await page.getByTestId("create-store-screen").waitFor();
  await page.getByTestId("store-name-input").fill(`POS Cafe E2E ${Date.now()}`);
  await page.getByTestId("create-store-button").click();

  await expect(page.getByTestId("create-store-result")).toBeVisible({ timeout: 60_000 });
  const storeKey = (await page.getByTestId("result-store-key").innerText()).trim();
  const displayedAdminPin = (await page.getByTestId("result-admin-pin").innerText()).trim();
  expect(storeKey).toMatch(/^\d{4}-[A-Z0-9]{4,64}$/);
  expect(displayedAdminPin).toBe(adminPin);

  await page.getByTestId("go-passcode").click();
  return storeKey;
}

async function unlockAsAdmin(page: Page) {
  await page.getByTestId("passcode-screen").waitFor();
  await page.locator('[data-testid^="employee-"]').filter({ hasText: "Quản lý" }).click();
  for (const digit of adminPin.split("")) {
    await page.getByTestId(`pin-${digit}`).click();
  }
  await page.getByTestId("unlock-button").click();
  await expect(page.getByTestId("floor-view")).toBeVisible({ timeout: 30_000 });
}

async function pairStoreThroughUi(page: Page, storeKey: string) {
  await page.goto("/");
  await page.getByTestId("landing-screen").waitFor();
  await page.getByTestId("go-store-pairing").click();
  await page.getByTestId("store-pairing-screen").waitFor();
  await page.getByTestId("store-key-input").fill(storeKey);
  await page.getByTestId("go-passcode").click();
  await unlockAsAdmin(page);
}

async function createOpenOrderOnFirstTable(page: Page) {
  await page.getByTestId("floor-view").locator('[data-testid^="table-"]').first().click();
  await expect(page.getByTestId("order-drawer")).toBeVisible();
  await page.getByTestId("order-drawer").locator('[data-testid^="menu-item-"]').first().click();
  await page.getByTestId("submit-order-button-footer").click();
  await expect(page.getByTestId("order-drawer")).toBeHidden({ timeout: 30_000 });
}

async function payFirstOccupiedTable(page: Page) {
  await page.getByTestId("floor-view").locator(".table-node.occupied").first().click();
  await expect(page.getByTestId("order-drawer")).toBeVisible();
  await page.getByTestId("submit-order-button-footer").click();
  await expect(page.getByTestId("payment-drawer")).toBeVisible();
  await expect(page.getByTestId("pay-button")).toBeEnabled();
  await page.getByTestId("pay-button").click();
  await expect(page.getByTestId("payment-drawer")).toBeHidden({ timeout: 30_000 });
}

test("Supabase UI E2E creates a store, pays an order, and shows history/report", async ({ page }) => {
  const storeKey = await createStoreThroughUi(page);
  await unlockAsAdmin(page);
  await createOpenOrderOnFirstTable(page);
  await payFirstOccupiedTable(page);

  await page.locator(".rail-action").filter({ hasText: "Lịch sử" }).click();
  await expect(page.getByTestId("order-history-drawer")).toBeVisible();
  await expect(page.getByTestId("order-history-drawer").locator('[data-testid^="history-row-"]').first()).toBeVisible({ timeout: 30_000 });

  await page.locator(".rail-action").filter({ hasText: "Báo cáo" }).click();
  await expect(page.getByTestId("report-settings")).toBeVisible();
  await expect(page.getByTestId("report-settings").getByText("Doanh thu", { exact: true })).toBeVisible();
  await expect(page.getByTestId("report-settings").getByText("Số đơn đã TT", { exact: true })).toBeVisible();

  test.info().annotations.push({ type: "store-key", description: storeKey });
});

test("Supabase realtime invalidates table status across two browsers", async ({ browser }) => {
  test.skip(!runRealtimeE2E, "Requires migration 004_realtime_publication.sql applied to the Supabase project.");

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    const storeKey = await createStoreThroughUi(pageA);
    await unlockAsAdmin(pageA);
    await pairStoreThroughUi(pageB, storeKey);
    await pageB.waitForTimeout(2_500);

    await createOpenOrderOnFirstTable(pageA);
    await expect(pageB.getByTestId("floor-view").locator(".table-node.occupied").first()).toBeVisible({ timeout: 30_000 });

    await payFirstOccupiedTable(pageB);
    await expect(pageA.getByTestId("floor-view").locator(".table-node.occupied")).toHaveCount(0, { timeout: 30_000 });

    test.info().annotations.push({ type: "store-key", description: storeKey });
  } finally {
    await contextB.close();
    await contextA.close();
  }
});
