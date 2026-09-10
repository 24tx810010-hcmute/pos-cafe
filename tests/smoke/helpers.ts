import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function loginAsAdmin(page: Page) {
  // Wait for the app to finish first render (avoids racing Vite's initial compile).
  await page.getByTestId("landing-screen").or(page.getByTestId("passcode-screen")).first().waitFor();
  if (await page.getByTestId("landing-screen").isVisible()) {
    await page.getByTestId("go-store-pairing").click();
    await page.getByTestId("store-pairing-screen").waitFor();
    await page.getByTestId("store-key-input").fill("0001-X8F3QA");
    await page.getByTestId("go-passcode").click();
  }
  await page.getByTestId("passcode-screen").waitFor();
  await page.getByTestId("employee-6b7bd350-7db2-4160-8471-cca2668c070d").click();
  for (const digit of ["1", "2", "3", "4", "5", "6"]) {
    await page.getByTestId(`pin-${digit}`).click();
  }
  await page.getByTestId("unlock-button").click();
  await expect(page.getByTestId("floor-view")).toBeVisible();
}

export async function waitForTransientOverlays(page: Page) {
  await page.waitForTimeout(4500);
}

export async function waitForStageFit(page: Page, stageTestId: string) {
  await page.waitForFunction((id) => {
    const stage = document.querySelector(`[data-testid="${id}"]`);
    const parent = stage?.parentElement;
    if (!stage || !parent) return false;

    const stageRect = stage.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return stageRect.width > 0 && stageRect.height > 0 && stageRect.width <= parentRect.width + 1;
  }, stageTestId);
}
