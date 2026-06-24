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

async function openB02PaymentDrawer(page: Page) {
  await page.getByTestId("table-tbl-b02").click();
  await page.getByTestId("submit-order-button-footer").click();
  await expect(page.getByTestId("payment-drawer")).toBeVisible();
}

async function closeCleanDrawer(page: Page, drawerTestId: string) {
  const drawer = page.getByTestId(drawerTestId);
  await drawer.locator("header").getByRole("button", { name: "Đóng" }).click();
  await expect(drawer).toBeHidden();
}

async function cancelDirtyDrawer(page: Page, drawerTestId: string) {
  const drawer = page.getByTestId(drawerTestId);
  await drawer.locator("header").getByRole("button", { name: "Huỷ" }).click();

  const discardButton = page.getByRole("button", { name: "Bỏ thay đổi" });
  await discardButton
    .waitFor({ state: "visible", timeout: 1000 })
    .then(() => discardButton.click())
    .catch(() => undefined);

  await expect(drawer).toBeHidden();
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
  await cancelDirtyDrawer(page, "menu-editor");

  await page.getByTestId("nav-floor-editor").click();
  await expect(page.getByTestId("floor-editor")).toBeVisible();
  await expect(page.getByTestId("save-floor-button")).toBeVisible();
  await page.getByTestId("add-table-round").click();
  await expect(page.getByTestId("floor-dirty-badge")).toBeVisible();
  await expect(page.getByTestId("fe-table-name-input")).toBeVisible();
  await cancelDirtyDrawer(page, "floor-editor");

  await page.getByTestId("nav-report").click();
  await expect(page.getByTestId("report")).toBeVisible();
  await page.getByTestId("report").getByRole("button", { name: /7/ }).click();
  await expect(page.getByTestId("report").getByText("Doanh thu", { exact: true })).toBeVisible();
  await closeCleanDrawer(page, "report");

  await page.getByTestId("nav-employees").click();
  await expect(page.getByTestId("employees-drawer")).toBeVisible();
  await expect(page.getByTestId("add-employee-button")).toBeVisible();
  await closeCleanDrawer(page, "employees-drawer");

  await page.getByTestId("nav-kitchen").click();
  await expect(page.getByTestId("kitchen-drawer")).toBeVisible();
  await closeCleanDrawer(page, "kitchen-drawer");

  await page.getByTestId("nav-payment-settings").click();
  const payDrawer = page.getByTestId("payment-settings-drawer");
  await expect(payDrawer).toBeVisible();
  await expect(page.getByTestId("save-payment-button")).toBeVisible();
  await payDrawer.getByTestId("payment-method-qr").click();
  await payDrawer.locator("section").getByRole("button", { name: /B.*t/ }).first().click();
  await payDrawer.locator("section").getByRole("button", { name: /QR/ }).click();
  await expect(page.getByTestId("pay-qr-preview")).toBeVisible();
  await cancelDirtyDrawer(page, "payment-settings-drawer");

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
  await openB02PaymentDrawer(page);
  await expect(page.getByTestId("pay-button-footer")).toBeVisible();
});

test("payment drawer keeps secondary text readable on landscape viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "portrait", "landscape-only flow");
  await page.goto("/");
  await loginAsAdmin(page);
  await openB02PaymentDrawer(page);

  const tooSmallText = await page.getByTestId("payment-drawer").evaluate((drawer) => {
    const read = (name: string, selector: string, text?: string) => {
      const candidates = Array.from(drawer.querySelectorAll<HTMLElement>(selector));
      const element = text
        ? candidates.find((candidate) => candidate.textContent?.trim().includes(text))
        : candidates[0];
      if (!element) return { fontSize: 0, name, text: "<missing>" };

      return {
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        name,
        text: (element.textContent || element.getAttribute("aria-label") || "").trim().replace(/\s+/g, " "),
      };
    };

    return [
      read("header meta", "header p"),
      read("method description", '[data-testid="payment-method-list"] span', "Đang chọn"),
      read("amount label", 'label[for="payment-received-amount"]'),
      read("amount mirror", 'label[for="payment-received-amount"] + span'),
      read("currency suffix", "#payment-received-amount + span"),
      read("quick amount", "button", "Đúng tiền"),
      read("customer label", "aside p", "Khách hàng"),
      read("order item count", "aside span", "4 món"),
      read("item option", "article p", "Size M"),
      read("item unit price", "article div:last-child span", "29.000"),
      read("summary label", '[data-testid="payment-order-summary"] span', "Khách đưa"),
      read("print checkbox label", '[data-testid="payment-order-summary"] label'),
    ].filter((item) => item.fontSize < 12);
  });

  expect(tooSmallText).toEqual([]);
});

test("payment drawer scales text across landscape breakpoints", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "covers multiple landscape breakpoints in one run");
  await page.goto("/");
  await loginAsAdmin(page);
  await openB02PaymentDrawer(page);

  const breakpoints = [
    {
      viewport: { width: 844, height: 390 },
      expected: { amountHeader: 12, body: 13, emphasis: 16, micro: 12, secondary: 12, strong: 15 },
    },
    {
      viewport: { width: 1024, height: 640 },
      expected: { amountHeader: 15, body: 15, emphasis: 17, micro: 13, secondary: 14, strong: 16 },
    },
    {
      viewport: { width: 1280, height: 720 },
      expected: { amountHeader: 16, body: 16, emphasis: 17, micro: 14, secondary: 15, strong: 17 },
    },
    {
      viewport: { width: 1440, height: 900 },
      expected: { amountHeader: 16, body: 16, emphasis: 17, micro: 14, secondary: 15, strong: 17 },
    },
  ] as const;

  for (const { expected, viewport } of breakpoints) {
    await page.setViewportSize(viewport);
    await expect(page.getByTestId("payment-drawer")).toBeVisible();

    const typography = await page.getByTestId("payment-drawer").evaluate((drawer, expectedSizes) => {
      type FontGroup = keyof typeof expectedSizes;

      const summary = drawer.querySelector<HTMLElement>('[data-testid="payment-order-summary"]');
      const keypad = drawer.querySelector<HTMLElement>('[data-testid="payment-keypad"]');
      const quickAmount =
        keypad?.previousElementSibling instanceof HTMLElement
          ? keypad.previousElementSibling.querySelector<HTMLElement>("button")
          : null;

      const sampleDefinitions: Array<{ group: FontGroup; name: string; query: () => HTMLElement | null }> = [
        { group: "emphasis", name: "drawer title", query: () => drawer.querySelector("header h2") },
        { group: "micro", name: "header meta", query: () => drawer.querySelector("header p") },
        { group: "body", name: "close button", query: () => drawer.querySelector("header button") },
        { group: "strong", name: "panel title", query: () => drawer.querySelector('[data-testid="payment-cashier-console"] h3') },
        {
          group: "strong",
          name: "method label",
          query: () => drawer.querySelector('[data-testid="payment-method-list"] button > span:last-child > span:first-child'),
        },
        {
          group: "micro",
          name: "method status",
          query: () => drawer.querySelector('[data-testid="payment-method-list"] button > span:last-child > span:last-child'),
        },
        { group: "amountHeader", name: "amount label", query: () => drawer.querySelector('label[for="payment-received-amount"]') },
        { group: "amountHeader", name: "amount mirror", query: () => drawer.querySelector('label[for="payment-received-amount"] + span') },
        { group: "emphasis", name: "amount input", query: () => drawer.querySelector("#payment-received-amount") },
        { group: "micro", name: "currency suffix", query: () => drawer.querySelector("#payment-received-amount + span") },
        { group: "body", name: "quick amount", query: () => quickAmount },
        { group: "emphasis", name: "keypad digit", query: () => drawer.querySelector('[data-testid="payment-keypad"] button') },
        { group: "secondary", name: "customer label", query: () => drawer.querySelector("aside > section:first-child p") },
        { group: "strong", name: "customer name", query: () => drawer.querySelector("aside > section:first-child strong") },
        { group: "micro", name: "order type chip", query: () => drawer.querySelector("aside > section:first-child span") },
        { group: "strong", name: "items heading", query: () => drawer.querySelector("aside section:nth-of-type(2) h3") },
        { group: "micro", name: "order item count", query: () => drawer.querySelector("aside section:nth-of-type(2) > div:first-child > span") },
        { group: "strong", name: "item name", query: () => drawer.querySelector("article h4") },
        { group: "micro", name: "item option", query: () => drawer.querySelector("article p") },
        { group: "strong", name: "item qty", query: () => drawer.querySelector("article strong") },
        { group: "micro", name: "item unit price", query: () => drawer.querySelector("article div:last-child span") },
        { group: "secondary", name: "summary label", query: () => summary?.querySelector(".grid > div:first-child > span") ?? null },
        { group: "strong", name: "summary value", query: () => summary?.querySelector(".grid > div:first-child > strong") ?? null },
        { group: "secondary", name: "summary total label", query: () => summary?.querySelector(".grid > div:last-child > span") ?? null },
        { group: "emphasis", name: "summary total value", query: () => summary?.querySelector(".grid > div:last-child > strong") ?? null },
        { group: "secondary", name: "print checkbox label", query: () => summary?.querySelector("label") ?? null },
        { group: "emphasis", name: "footer pay button", query: () => drawer.querySelector('[data-testid="pay-button-footer"]') },
      ];

      const read = (definition: (typeof sampleDefinitions)[number]) => {
        const element = definition.query();
        if (!element) {
          return { fontSize: 0, group: definition.group, missing: true, name: definition.name, text: "<missing>" };
        }

        return {
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
          group: definition.group,
          missing: false,
          name: definition.name,
          text: (element.textContent || element.getAttribute("aria-label") || element.getAttribute("value") || "")
            .trim()
            .replace(/\s+/g, " "),
        };
      };

      const samples = sampleDefinitions.map(read);
      const visibleTextNodes = Array.from(drawer.querySelectorAll<HTMLElement>("button, label, h2, h3, h4, p, span, strong, input"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const text = (element.textContent || element.getAttribute("aria-label") || element.getAttribute("value") || "")
            .trim()
            .replace(/\s+/g, " ");

          return {
            fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
            height: rect.height,
            overflowX: element.scrollWidth > element.clientWidth + 1,
            text,
            width: rect.width,
          };
        })
        .filter((node) => node.text && node.width > 0 && node.height > 0);

      const checkbox = summary?.querySelector("label")?.getBoundingClientRect();
      const complete = drawer.querySelector('[data-testid="pay-button-footer"]')?.getBoundingClientRect();
      const items = drawer.querySelector<HTMLElement>('[data-testid="payment-order-items"]');

      return {
        fontOutOfRange: visibleTextNodes
          .filter((node) => node.fontSize < 12 || node.fontSize > 17)
          .map((node) => ({ fontSize: node.fontSize, text: node.text.slice(0, 80) })),
        groupMismatches: samples.filter(
          (sample) => sample.missing || Math.abs(sample.fontSize - expectedSizes[sample.group]) > 0.25,
        ),
        layout: {
          checkboxAboveComplete: !!checkbox && !!complete && checkbox.bottom <= complete.top,
          completeVisible: !!complete && complete.width > 0 && complete.height > 0,
          itemListScrollsVertically: ["auto", "scroll"].includes(items ? getComputedStyle(items).overflowY : ""),
          keypadButtons: drawer.querySelectorAll('[data-testid="payment-keypad"] button').length,
          overflowingText: visibleTextNodes.filter((node) => node.overflowX).map((node) => node.text.slice(0, 80)),
        },
      };
    }, expected);

    expect(typography.fontOutOfRange, `${viewport.width}px text outside 12-17px`).toEqual([]);
    expect(typography.groupMismatches, `${viewport.width}px group scale`).toEqual([]);
    expect(typography.layout.overflowingText, `${viewport.width}px overflowing text`).toEqual([]);
    expect(typography.layout.completeVisible, `${viewport.width}px complete button`).toBe(true);
    expect(typography.layout.checkboxAboveComplete, `${viewport.width}px print checkbox`).toBe(true);
    expect(typography.layout.itemListScrollsVertically, `${viewport.width}px order item list`).toBe(true);
    expect(typography.layout.keypadButtons, `${viewport.width}px keypad`).toBe(12);
  }

  const amountInput = page.locator("#payment-received-amount");
  await expect(amountInput).toHaveValue("125.000");
  await amountInput.fill("1234567");
  await expect(amountInput).toHaveValue("1.234.567");
  await page.locator('button[aria-label="Xóa một số"]').click();
  await expect(amountInput).toHaveValue("123.456");
});
