import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
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

async function expectNodeCenterKeepsLogicalRatio(
  page: Page,
  stageTestId: string,
  nodeTestId: string,
  expected: { x: number; y: number },
) {
  await waitForStageFit(page, stageTestId);
  await page.waitForTimeout(250);

  const stageBox = await page.getByTestId(stageTestId).boundingBox();
  const nodeBox = await page.getByTestId(nodeTestId).boundingBox();

  if (!stageBox || !nodeBox) {
    throw new Error(`Missing geometry for ${stageTestId}/${nodeTestId}`);
  }

  const nodeCenterX = nodeBox.x + nodeBox.width / 2 - stageBox.x;
  const nodeCenterY = nodeBox.y + nodeBox.height / 2 - stageBox.y;

  expect(nodeCenterX / stageBox.width).toBeCloseTo(expected.x / 1600, 2);
  expect(nodeCenterY / stageBox.height).toBeCloseTo(expected.y / 900, 2);
}

async function expectNodeInsideStage(page: Page, stageTestId: string, nodeTestId: string) {
  const visualTolerance = 8;
  const stageBox = await page.getByTestId(stageTestId).boundingBox();
  const nodeBox = await page.getByTestId(nodeTestId).boundingBox();

  if (!stageBox || !nodeBox) {
    throw new Error(`Missing geometry for ${stageTestId}/${nodeTestId}`);
  }

  expect(nodeBox.x).toBeGreaterThanOrEqual(stageBox.x - visualTolerance);
  expect(nodeBox.y).toBeGreaterThanOrEqual(stageBox.y - visualTolerance);
  expect(nodeBox.x + nodeBox.width).toBeLessThanOrEqual(stageBox.x + stageBox.width + visualTolerance);
  expect(nodeBox.y + nodeBox.height).toBeLessThanOrEqual(stageBox.y + stageBox.height + visualTolerance);
}

async function expectReadableFloorLabel(page: Page, nodeTestId: string, label: "name" | "price", minHeight = 10) {
  const labelBox = await page.getByTestId(nodeTestId).locator(`[data-floor-label="${label}"]`).boundingBox();

  if (!labelBox) {
    throw new Error(`Missing ${label} label for ${nodeTestId}`);
  }

  expect(labelBox.height).toBeGreaterThanOrEqual(minHeight);
}

async function waitForTransientOverlays(page: Page) {
  await page.waitForTimeout(4500);
}

async function waitForStageFit(page: Page, stageTestId: string) {
  await page.waitForFunction((id) => {
    const stage = document.querySelector(`[data-testid="${id}"]`);
    const parent = stage?.parentElement;
    if (!stage || !parent) return false;

    const stageRect = stage.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return stageRect.width > 0 && stageRect.height > 0 && stageRect.width <= parentRect.width + 1;
  }, stageTestId);
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

test("floor plan stage keeps demo layout readable across landscape viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "portrait", "landscape-only flow");
  await page.goto("/");
  await loginAsAdmin(page);

  await expectNodeCenterKeepsLogicalRatio(page, "floor-stage", "table-tbl-b01", { x: 260, y: 190 });
  await expectNodeCenterKeepsLogicalRatio(page, "floor-stage", "table-tbl-b08", { x: 1180, y: 520 });
  await expectNodeCenterKeepsLogicalRatio(page, "floor-stage", "decor-decor-door", { x: 1480, y: 88 });
  await expectNodeCenterKeepsLogicalRatio(page, "floor-stage", "decor-decor-plant", { x: 300, y: 760 });
  for (const nodeTestId of ["table-tbl-b01", "table-tbl-b02", "table-tbl-b08", "decor-decor-door", "decor-decor-plant"]) {
    await expectNodeInsideStage(page, "floor-stage", nodeTestId);
  }
  await expect(page.getByTestId("table-tbl-b01").getByText("B01", { exact: true })).toBeVisible();
  await expect(page.getByTestId("table-tbl-b01").getByText("Trống", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("table-tbl-b01").getByText("4 chỗ", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("table-tbl-b02").getByText("B02", { exact: true })).toBeVisible();
  await expect(page.getByTestId("table-tbl-b02").getByText("125K", { exact: true })).toBeVisible();
  await expect(page.getByTestId("table-tbl-b02").getByText(/#24/)).toHaveCount(0);
  await expectReadableFloorLabel(page, "table-tbl-b01", "name");
  await expectReadableFloorLabel(page, "table-tbl-b02", "price");
  await waitForTransientOverlays(page);
  await page.getByTestId("floor-view").screenshot({ path: testInfo.outputPath("floor-stage-pos.png") });

  await page.getByTestId("nav-floor-editor").click();
  await expect(page.getByTestId("floor-editor")).toBeVisible();
  await expect(page.getByTestId("floor-editor-stage")).toBeVisible();
  await expectNodeCenterKeepsLogicalRatio(page, "floor-editor-stage", "fe-table-tbl-b01", { x: 260, y: 190 });
  await expectNodeCenterKeepsLogicalRatio(page, "floor-editor-stage", "fe-table-tbl-b08", { x: 1180, y: 520 });
  await expectReadableFloorLabel(page, "fe-table-tbl-b01", "name");
  await page.getByTestId("floor-editor-stage").screenshot({ path: testInfo.outputPath("floor-stage-editor.png") });

  const stageFit = await page.getByTestId("floor-editor-stage").evaluate((stage) => {
    const parent = stage.parentElement;
    const stageRect = stage.getBoundingClientRect();
    const parentRect = parent?.getBoundingClientRect();
    return {
      stageWidth: stageRect.width,
      parentWidth: parentRect?.width ?? 0,
      parentScrollWidth: parent?.scrollWidth ?? 0,
      parentClientWidth: parent?.clientWidth ?? 0,
    };
  });

  expect(stageFit.stageWidth).toBeLessThanOrEqual(stageFit.parentWidth + 1);
  expect(stageFit.parentScrollWidth).toBeLessThanOrEqual(stageFit.parentClientWidth + 1);

  if (testInfo.project.name === "phone-landscape" || testInfo.project.name === "small-landscape") {
    const stageBox = await page.getByTestId("floor-editor-stage").boundingBox();
    const inspectorBox = await page.getByTestId("floor-editor-inspector").boundingBox();
    if (!stageBox || !inspectorBox) {
      throw new Error("Missing editor stage or inspector geometry");
    }
    expect(inspectorBox.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 1);
  }
});

test("admin mock modules are reachable without changing URL", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "portrait", "landscape-only flow");
  await page.goto("/");
  await loginAsAdmin(page);
  const initialUrl = page.url();

  await page.getByTestId("nav-menu-editor").click();
  await expect(page.getByTestId("menu-editor")).toBeVisible();
  await expect(page.getByTestId("save-menu-button")).toBeVisible();
  await page.getByTestId("add-item-button").click();
  await expect(page.getByTestId("menu-dirty-badge")).toBeVisible();
  await expect(page.getByTestId("menu-item-name-input")).toBeVisible();

  await page.getByTestId("nav-floor-editor").click();
  await expect(page.getByTestId("floor-editor")).toBeVisible();
  await expect(page.getByTestId("save-floor-button")).toBeVisible();
  await page.getByTestId("add-table-round").click();
  await expect(page.getByTestId("floor-dirty-badge")).toBeVisible();
  await expect(page.getByTestId("fe-table-name-input")).toBeVisible();

  await page.getByTestId("nav-report-settings").click();
  await expect(page.getByTestId("report-settings")).toBeVisible();
  await page.getByTestId("report-settings").getByRole("button", { name: /7/ }).click();
  await expect(page.getByTestId("report-settings").getByText("Doanh thu", { exact: true })).toBeVisible();

  await page.getByTestId("nav-employees").click();
  await expect(page.getByTestId("employees-drawer")).toBeVisible();
  await expect(page.getByTestId("add-employee-button")).toBeVisible();

  await page.getByTestId("nav-kitchen").click();
  await expect(page.getByTestId("kitchen-drawer")).toBeVisible();
  await page.getByTestId("kitchen-done-kt-1").click();

  await page.getByTestId("nav-payment-settings").click();
  const payDrawer = page.getByTestId("payment-settings-drawer");
  await expect(payDrawer).toBeVisible();
  await expect(page.getByTestId("save-payment-button")).toBeVisible();
  await payDrawer.getByTestId("payment-method-qr").click();
  await payDrawer.locator("section").getByRole("button", { name: /B.*t/ }).first().click();
  await payDrawer.locator("section").getByRole("button", { name: /QR/ }).click();
  await expect(page.getByTestId("pay-qr-preview")).toBeVisible();

  await page.getByTestId("nav-settings").click();
  const settingsDrawer = page.getByTestId("settings-drawer");
  await expect(settingsDrawer).toBeVisible();
  await expect(page.getByTestId("save-settings-button")).toBeVisible();
  await settingsDrawer.getByTestId("settings-section-demo").click();
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
