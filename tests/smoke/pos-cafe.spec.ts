import { expect, test } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  if (await page.getByTestId("landing-screen").isVisible()) {
    await page.getByTestId("go-store-pairing").click();
    await page.getByTestId("store-pairing-screen").waitFor();
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

  await page.locator(".rail-action").filter({ hasText: "Menu" }).click();
  await expect(page.getByTestId("menu-editor")).toBeVisible();
  await expect(page.getByTestId("save-menu-button")).toBeVisible();

  await page.locator(".rail-action").filter({ hasText: "Layout" }).click();
  await expect(page.getByTestId("floor-editor")).toBeVisible();
  await expect(page.getByTestId("save-floor-button")).toBeVisible();

  await page.locator(".rail-action").filter({ hasText: "BC" }).click();
  await expect(page.getByTestId("report-settings")).toBeVisible();
  expect(page.url()).toBe(initialUrl);
});

test("payment drawer exposes complete action for occupied table", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "portrait", "landscape-only flow");
  await page.goto("/");
  await loginAsAdmin(page);
  await page.getByTestId("table-tbl-b02").click();
  await page.getByRole("button", { name: "Thanh toán" }).click();
  await expect(page.getByTestId("payment-drawer")).toBeVisible();
  await expect(page.getByTestId("pay-button")).toBeVisible();
});
