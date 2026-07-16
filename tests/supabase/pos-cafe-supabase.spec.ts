import { expect, test, type Page } from "@playwright/test";

const adminPin = "123456";
const runRealtimeE2E = process.env.RUN_SUPABASE_REALTIME_E2E === "1";

async function createStoreThroughUi(page: Page) {
  await page.goto("/");
  await page.getByTestId("landing-screen").waitFor();
  await page.getByTestId("go-create-store").click();
  await page.getByTestId("create-store-screen").waitFor();
  await page.getByTestId("store-name-input").fill(`POS Cafe E2E ${Date.now()}`);
  // E2E cần menu + sơ đồ bàn mẫu để tạo đơn → bật khởi tạo dữ liệu mẫu.
  await page.getByTestId("seed-demo-checkbox").check();
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

async function addFirstMenuItem(page: Page) {
  await page.getByTestId("order-drawer").locator('[data-testid^="menu-item-"]').first().click();
  // Món có nhóm tuỳ chọn sẽ mở popup chọn modifier; xác nhận nếu xuất hiện.
  const confirmModifier = page.getByTestId("modifier-confirm");
  await confirmModifier
    .waitFor({ state: "visible", timeout: 1500 })
    .then(() => confirmModifier.click())
    .catch(() => undefined);
}

async function closeReceiptPopupIfAny(page: Page) {
  const closeButton = page.getByTestId("receipt-preview").getByRole("button", { name: "Đóng" }).first();
  await closeButton
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => closeButton.click())
    .catch(() => undefined);
}

async function createOpenOrderOnFirstTable(page: Page, itemQuantity = 1) {
  await page.getByTestId("floor-view").locator('[data-testid^="table-"]').first().click();
  await expect(page.getByTestId("order-drawer")).toBeVisible();
  for (let index = 0; index < itemQuantity; index += 1) {
    await addFirstMenuItem(page);
  }
  await page.getByTestId("submit-order-button-footer").click();
  await expect(page.getByTestId("order-drawer")).toBeHidden({ timeout: 30_000 });
  // "Gửi đơn" mở popup phiếu gửi bếp — đóng để overlay không che sơ đồ bàn.
  await closeReceiptPopupIfAny(page);
}

function openOrderTables(page: Page) {
  // Bàn đang phục vụ hiển thị giá compact (label "price") trên tile, không còn badge #N.
  return page
    .getByTestId("floor-view")
    .locator('[data-testid^="table-"]')
    .filter({ has: page.locator('[data-floor-label="price"]') });
}

async function payFirstOccupiedTable(page: Page) {
  await openOrderTables(page).first().click();
  await expect(page.getByTestId("order-drawer")).toBeVisible();
  await page.getByTestId("submit-order-button-footer").click();
  await expect(page.getByTestId("payment-drawer")).toBeVisible();
  await expect(page.getByTestId("pay-button-footer")).toBeEnabled();
  await page.getByTestId("pay-button-footer").click();
  await expect(page.getByTestId("payment-drawer")).toBeHidden({ timeout: 30_000 });
  // Thanh toán xong mở popup hoá đơn — đóng để overlay không che left nav.
  await closeReceiptPopupIfAny(page);
}

test("Supabase UI E2E creates a store, pays an order, and shows history/report", async ({ page }) => {
  const storeKey = await createStoreThroughUi(page);
  await unlockAsAdmin(page);
  await createOpenOrderOnFirstTable(page);
  await payFirstOccupiedTable(page);

  await page.getByRole("button", { name: "Lịch sử" }).click();
  await expect(page.getByTestId("order-history-drawer")).toBeVisible();
  await expect(page.getByTestId("order-history-drawer").locator('[data-testid^="history-row-"]').first()).toBeVisible({ timeout: 30_000 });

  // Đóng drawer lịch sử trước khi mở module khác (drawer che vùng nav khi mở).
  await page.getByTestId("order-history-drawer").getByRole("button", { name: "Đóng" }).first().click();
  await expect(page.getByTestId("order-history-drawer")).toBeHidden();

  await page.getByRole("button", { name: "Báo cáo" }).click();
  await expect(page.getByTestId("report")).toBeVisible();
  await expect(page.getByTestId("report").getByText("Doanh thu hôm nay").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("report").getByText("Số đơn đã thanh toán").first()).toBeVisible();

  test.info().annotations.push({ type: "store-key", description: storeKey });
});

test("Supabase admin voids a paid order and it leaves the paid revenue", async ({ page }) => {
  const storeKey = await createStoreThroughUi(page);
  await unlockAsAdmin(page);
  await createOpenOrderOnFirstTable(page);
  await payFirstOccupiedTable(page);

  await page.getByRole("button", { name: "Lịch sử" }).click();
  await expect(page.getByTestId("order-history-drawer")).toBeVisible();
  const drawer = page.getByTestId("order-history-drawer");
  await drawer.locator('[data-testid^="history-row-"]').first().click();

  // Nút hủy chỉ bật khi order detail đã load (có lock_version).
  const voidButton = page.getByTestId("history-void-order");
  await expect(voidButton).toBeEnabled({ timeout: 30_000 });
  await voidButton.click();

  await expect(page.getByTestId("history-void-popup")).toBeVisible();
  await page.getByTestId("history-void-reason").selectOption("duplicate");
  await page.getByTestId("history-void-confirm").click();

  // Void thành công: popup đóng, khối thông tin hủy hiện, badge chuyển "Đã hủy".
  await expect(page.getByTestId("history-void-popup")).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId("history-void-info")).toBeVisible({ timeout: 30_000 });
  await expect(drawer.getByText("Đã hủy").first()).toBeVisible();

  test.info().annotations.push({ type: "store-key", description: storeKey });
});

test("Supabase instant pay splits selected items into an independent paid order", async ({ page }) => {
  const storeKey = await createStoreThroughUi(page);
  await unlockAsAdmin(page);
  // Đơn #1 có 2 × món đầu tiên để trả một phần số lượng (tách dòng qua pay_order_items).
  await createOpenOrderOnFirstTable(page, 2);

  await openOrderTables(page).first().click();
  await expect(page.getByTestId("order-drawer")).toBeVisible();
  await page.getByTestId("submit-order-button-footer").click();
  await expect(page.getByTestId("payment-drawer")).toBeVisible();

  // Bỏ "Chọn tất cả", chọn 1/2 món đầu -> tách đơn thanh toán riêng.
  await page.getByTestId("pay-select-all").uncheck();
  await page.getByTestId("pay-item-checkbox").first().check();
  await expect(page.getByTestId("pay-item-quantity").first()).toHaveText("2/2");
  await page.getByTestId("pay-item-plus").first().click();
  await expect(page.getByTestId("pay-item-quantity").first()).toHaveText("1/2");
  await expect(page.getByTestId("pay-button-footer")).toBeEnabled();
  await page.getByTestId("pay-button-footer").click();

  // Quy tắc đánh số: bill trả trước kế thừa số #1 của đơn gốc.
  await expect(page.getByTestId("receipt-preview")).toContainText("#1", { timeout: 30_000 });
  await closeReceiptPopupIfAny(page);

  // Đơn gốc còn lại trên bàn: drawer giữ nguyên, selection quay về "Chọn tất cả" phần còn lại.
  await expect(page.getByTestId("payment-drawer")).toBeVisible();
  await expect(page.getByTestId("pay-select-all")).toBeChecked({ timeout: 30_000 });
  await expect(page.getByTestId("pay-item-line")).toHaveCount(1, { timeout: 30_000 });

  // Trả nốt phần còn lại -> đơn gốc (giờ mang số #2) đóng, bàn trống.
  await expect(page.getByTestId("pay-button-footer")).toBeEnabled();
  await page.getByTestId("pay-button-footer").click();
  await expect(page.getByTestId("payment-drawer")).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId("receipt-preview")).toContainText("#2", { timeout: 30_000 });
  await closeReceiptPopupIfAny(page);
  await expect(openOrderTables(page)).toHaveCount(0, { timeout: 30_000 });

  // Lịch sử: 2 ĐƠN độc lập (#1 trả trước, #2 trả sau), không liên kết gì nhau.
  await page.getByRole("button", { name: "Lịch sử" }).click();
  await expect(page.getByTestId("order-history-drawer")).toBeVisible();
  const rows = page.getByTestId("order-history-drawer").locator('[data-testid^="history-row-"]');
  await expect(rows).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId("order-history-drawer").getByText("#1", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("order-history-drawer").getByText("#2", { exact: true }).first()).toBeVisible();

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
    await expect(openOrderTables(pageB).first()).toBeVisible({ timeout: 30_000 });

    await payFirstOccupiedTable(pageB);
    await expect(openOrderTables(pageA)).toHaveCount(0, { timeout: 30_000 });

    test.info().annotations.push({ type: "store-key", description: storeKey });
  } finally {
    await contextB.close();
    await contextA.close();
  }
});
