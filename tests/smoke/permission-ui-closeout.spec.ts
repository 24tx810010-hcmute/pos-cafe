import { expect, test, type Locator } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

async function expectUncovered(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect.poll(() => control.evaluate(element => {
    const r = element.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return hit === element || element.contains(hit);
  })).toBe(true);
}

test.describe("landscape permission controls", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "portrait", "Business controls require landscape; portrait guidance is checked separately.");
    await page.goto("/");
    await loginAsAdmin(page);
  });

  test("employees rows remain selectable through ordinary scrolling", async ({ page }, testInfo) => {
    await page.getByTestId("nav-employees").click();
    const drawer = page.getByTestId("employees-drawer");
    await expect(drawer).toBeVisible();
    const rows = drawer.locator('[data-testid^="employee-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(3);
    for (let i = 0; i < count; i++) {
      await rows.nth(i).click();
      await expect(rows.nth(i)).toHaveClass(/bg-pos-primary/);
      await expectUncovered(rows.nth(i));
    }
    const add = page.getByTestId("add-employee-button");
    await expectUncovered(add);
    await add.click();
    await expect(page.getByTestId("employee-detail-pane").getByRole("textbox").first()).toHaveValue("");
    await expect(rows).toHaveCount(count);
    await drawer.screenshot({ path: `artifacts/permission-ui-closeout-20261009/employees-${testInfo.project.name}.png` });
  });

  test("payment selection and quantity controls stay accessible without paying", async ({ page }, testInfo) => {
    await page.getByTestId("table-a254abd0-b883-4d5c-85c1-89f660409e02").click();
    await page.getByTestId("submit-order-button-footer").click();
    const drawer = page.getByTestId("payment-drawer");
    await expect(drawer).toBeVisible();
    const summary = page.getByTestId("payment-order-summary");
    const originalTotal = await summary.getAttribute("data-order-total");
    const list = page.getByTestId("payment-order-items");
    // A zero-height list cannot become interactive just by scrolling its contents.
    await expect.poll(() => list.evaluate(element => element.clientHeight >= 44)).toBe(true);
    const all = page.getByTestId("pay-select-all");
    await expectUncovered(all);
    await all.uncheck();
    await expect(summary).toHaveAttribute("data-amount-due", "0");
    await expect(page.getByTestId("pay-button-footer")).toBeDisabled();
    const lines = page.getByTestId("pay-item-line");
    expect(await lines.count()).toBeGreaterThan(1);
    for (let i = 0; i < await lines.count(); i++) {
      const line = lines.nth(i);
      const name = (await line.locator("h4").innerText()).trim();
      const box = line.getByTestId("pay-item-checkbox");
      await expect(box).toHaveAccessibleName(`Chọn thanh toán ${name}`);
      await expectUncovered(box);
      await box.check();
      await expect(line).toHaveAttribute("data-selected-quantity", "1");
      const plus = line.getByTestId("pay-item-plus");
      await expectUncovered(plus);
      await plus.click();
      const quantity = Number(await line.getAttribute("data-line-quantity"));
      await expect(line).toHaveAttribute("data-selected-quantity", quantity > 1 ? "2" : "1");
      await box.focus();
      await page.keyboard.press("Space");
      await expect(box).not.toBeChecked();
      await expect(line).toHaveAttribute("data-selected-quantity", "0");
      await expect(summary).toHaveAttribute("data-amount-due", "0");
    }
    await all.check();
    await expect(summary).toHaveAttribute("data-order-total", originalTotal!);
    await expect(summary).toHaveAttribute("data-amount-due", originalTotal!);
    await expect(page.getByTestId("receipt-preview")).toHaveCount(0);
    await expect(drawer).toBeVisible();
    await expectUncovered(page.getByTestId("pay-button-footer"));
    await drawer.screenshot({ path: `artifacts/permission-ui-closeout-20261009/payment-${testInfo.project.name}.png` });
  });
});

test("portrait shows rotation guidance after login and restores POS on landscape", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "portrait", "portrait-only rotation contract");
  const portrait = page.viewportSize()!;
  const landscape = { width: portrait.height, height: portrait.width };
  await page.setViewportSize(landscape);
  await page.goto("/");
  await loginAsAdmin(page);
  await page.setViewportSize(portrait);
  await expect(page.getByRole("heading", { name: "Xoay ngang thiết bị" })).toBeVisible();
  await expect(page.getByTestId("floor-view")).toBeHidden();
  await page.setViewportSize(landscape);
  await expect(page.getByTestId("floor-view")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Xoay ngang thiết bị" })).toBeHidden();
});
