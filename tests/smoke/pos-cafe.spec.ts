import { expect, test } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  // Wait for the app to finish first render (avoids racing Vite's initial compile).
  await page.getByTestId("landing-screen").or(page.getByTestId("passcode-screen")).first().waitFor();
  if (await page.getByTestId("landing-screen").isVisible()) {
    await page.getByTestId("go-store-pairing").click();
    await page.getByTestId("store-pairing-screen").waitFor();
    await page.getByTestId("store-key-input").fill("0001-X8F3QA");
    await page.getByTestId("go-passcode").click();
  }
  await page.getByTestId("passcode-screen").waitFor();
  await page.getByTestId("employee-emp-admin").click();
  for (const digit of ["1", "2", "3", "4", "5", "6"]) {
    await page.getByTestId(`pin-${digit}`).click();
  }
  await page.getByTestId("unlock-button").click();
  await expect(page.getByTestId("floor-view")).toBeVisible();
}

test("portrait viewport shows rotate guidance", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "portrait", "portrait-only assertion");
  await page.goto("/");
  await expect(page.getByTestId("rotate-guidance")).toBeVisible();
});

test("POS mock flow keeps primary actions visible on landscape viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "portrait", "landscape-only flow");
  await page.goto("/");
  await expect(page.getByTestId("landing-screen")).toBeVisible();
  await loginAsAdmin(page);

  await page.getByTestId("table-tbl-b01").click();
  await expect(page.getByTestId("order-drawer")).toBeVisible();
  await page.getByTestId("menu-item-mi-ca-phe-sua").click();
  await expect(page.getByTestId("submit-order-button")).toBeVisible();
});

test("admin mock modules are reachable without changing URL", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "portrait", "landscape-only flow");
  await page.goto("/");
  await loginAsAdmin(page);
  const initialUrl = page.url();
  const rail = page.getByRole("navigation", { name: "POS modules" });

  await rail.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByTestId("menu-editor")).toBeVisible();
  await expect(page.getByTestId("save-menu-button")).toBeVisible();
  await page.getByTestId("add-item-button").click();
  await expect(page.getByTestId("menu-dirty-badge")).toBeVisible();
  await expect(page.getByTestId("menu-item-name-input")).toBeVisible();

  await rail.getByRole("button", { name: "Sơ đồ", exact: true }).click();
  await expect(page.getByTestId("floor-editor")).toBeVisible();
  await expect(page.getByTestId("save-floor-button")).toBeVisible();
  await page.getByTestId("add-table-round").click();
  await expect(page.getByTestId("floor-dirty-badge")).toBeVisible();
  await expect(page.getByTestId("fe-table-name-input")).toBeVisible();

  await rail.getByRole("button", { name: "Báo cáo", exact: true }).click();
  await expect(page.getByTestId("report-settings")).toBeVisible();
  await page.getByTestId("report-settings").getByRole("button", { name: "7 ngày" }).click();
  await expect(page.getByTestId("report-settings").getByText("Doanh thu", { exact: true })).toBeVisible();

  await rail.getByRole("button", { name: "Nhân viên", exact: true }).click();
  await expect(page.getByTestId("employees-drawer")).toBeVisible();
  await expect(page.getByTestId("add-employee-button")).toBeVisible();

  await rail.getByRole("button", { name: "Bếp", exact: true }).click();
  await expect(page.getByTestId("kitchen-drawer")).toBeVisible();
  await page.getByTestId("kitchen-done-kt-1").click();

  await rail.getByRole("button", { name: "Thanh toán", exact: true }).click();
  const payDrawer = page.getByTestId("payment-settings-drawer");
  await expect(payDrawer).toBeVisible();
  await expect(page.getByTestId("save-payment-button")).toBeVisible();
  await payDrawer.getByRole("button", { name: "QR" }).click();
  await payDrawer.getByRole("button", { name: "Bật", exact: true }).click();
  await payDrawer.getByRole("button", { name: "Hiện QR trên hoá đơn" }).click();
  await expect(page.getByTestId("pay-qr-preview")).toBeVisible();

  await rail.getByRole("button", { name: "Cài đặt", exact: true }).click();
  const settingsDrawer = page.getByTestId("settings-drawer");
  await expect(settingsDrawer).toBeVisible();
  await expect(page.getByTestId("save-settings-button")).toBeVisible();
  await expect(settingsDrawer.getByRole("button", { name: "Bảo trì dữ liệu", exact: true })).toBeVisible();
  await settingsDrawer.getByRole("button", { name: "Bảo trì dữ liệu", exact: true }).click();
  await page.getByTestId("open-clear-demo").click();
  await expect(page.getByTestId("clear-demo-dialog")).toBeVisible();
  expect(page.url()).toBe(initialUrl);
});

test("payment drawer exposes complete action for occupied table", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "portrait", "landscape-only flow");
  await page.goto("/");
  await loginAsAdmin(page);
  await page.getByTestId("table-tbl-b02").click();
  await page.getByTestId("submit-order-button-footer").click();
  await expect(page.getByTestId("payment-drawer")).toBeVisible();
  await expect(page.getByTestId("pay-button")).toBeVisible();
});
