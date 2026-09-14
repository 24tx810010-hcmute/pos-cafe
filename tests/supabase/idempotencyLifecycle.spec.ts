import { expect, test } from '@playwright/test';
import { ids, payPayload } from '../contracts/fixtures.ts';
import { serverHarness as h, pairAndUnlock, openRecovery, installPrintCounter, printCount, watchWrites } from './idempotencyHarness.ts';

test.afterEach(() => h.clock(null));
async function paidFixture() {
  await h.reset('F1'); const token = await h.login();
  await h.register(payPayload(), token); expect((await h.execute(payPayload(), token)).status).toBe('applied');
}
for (const transition of ['offline', 'close_reopen'] as const) test(`TC-IDEM-051/e2e/reprint=${transition} ignores a late real receipt response`, async ({ page, context }) => {
  await paidFixture(); await installPrintCounter(page); await pairAndUnlock(page); await openRecovery(page);
  let release!: () => void; const gate = new Promise<void>(done => { release = done; }); let captured = false;
  await page.route('**/rest/v1/rpc/get_payment_receipt', async route => {
    const response = await route.fetch(); expect(response.status()).toBe(200); captured = true;
    await gate; await route.fulfill({ response });
  });
  await page.getByTestId('write-recovery-reprint').click(); await expect.poll(() => captured).toBe(true);
  if (transition === 'offline') await context.setOffline(true);
  else {
    await page.getByTestId('write-recovery-drawer').getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.getByTestId('nav-write-recovery').click();
  }
  const response = page.waitForResponse(r => r.url().endsWith('/rpc/get_payment_receipt'));
  release(); await response; await page.waitForTimeout(400);
  await expect(page.getByTestId('receipt-preview')).toHaveCount(0); expect(await printCount(page)).toBe(0);
});
for (const stage of ['read', 'timer'] as const) for (const transition of ['offline', 'close_reopen'] as const) {
  test(`TC-IDEM-051/e2e/print=${stage}/transition=${transition} cancels stale browser printing`, async ({ page, context }) => {
    await paidFixture(); await installPrintCounter(page); await pairAndUnlock(page); await openRecovery(page);
    await page.getByTestId('write-recovery-reprint').click(); await expect(page.getByTestId('receipt-preview')).toBeVisible();
    await page.clock.install(); await page.clock.pauseAt(new Date());
    let release!: () => void; const gate = new Promise<void>(done => { release = done; }); let captured = false;
    let capturedRequest: import('@playwright/test').Request;
    await page.route('**/rest/v1/rpc/get_payment_receipt', async route => {
      if (captured) { await route.continue(); return; }
      const response = await route.fetch(); expect(response.status()).toBe(200); capturedRequest = route.request(); captured = true;
      await gate; await route.fulfill({ response });
    });
    await page.getByTestId('receipt-print-button').click(); await expect.poll(() => captured).toBe(true);
    const response = page.waitForResponse(r => r.request() === capturedRequest);
    if (stage === 'timer') { release(); await response; await expect(page.locator('iframe[aria-hidden=true]')).toHaveCount(1); }
    if (transition === 'offline') await context.setOffline(true);
    else {
      await page.getByTestId('receipt-close-footer').click();
      // Reopening is a new authorized read, not permission to finish an old print.
      await page.getByTestId('write-recovery-reprint').click(); await expect(page.getByTestId('receipt-preview')).toBeVisible();
    }
    if (stage === 'read') { release(); await response; }
    await page.clock.runFor(1000);
    expect(await printCount(page)).toBe(0); await expect(page.locator('iframe[aria-hidden=true]')).toHaveCount(0);
    expect((await h.snapshot()).payments).toHaveLength(1);
  });
}
test('TC-IDEM-051/e2e/print=positive a fresh authorized click still prints exactly once', async ({ page }) => {
  await paidFixture(); await installPrintCounter(page); await pairAndUnlock(page); await openRecovery(page);
  await page.getByTestId('write-recovery-reprint').click(); await expect(page.getByTestId('receipt-preview')).toBeVisible();
  expect(await printCount(page)).toBe(0); await page.getByTestId('receipt-print-button').click();
  await expect.poll(() => printCount(page)).toBe(1);
});
for (const lost of ['pending', 'committed'] as const) test(`TC-IDEM-052/e2e/draft=${lost} retry consumes its create draft without another K or automatic print`, async ({ page }) => {
  await h.reset(); await installPrintCounter(page); await pairAndUnlock(page); await page.getByTestId('nav-takeaway').click();
  await page.getByRole('button', { name: 'Tạo đơn mang đi', exact: true }).first().click();
  await page.getByTestId(`menu-item-${ids.M_T}`).click(); const writes = watchWrites(page); let first = true;
  await page.route('**/rest/v1/rpc/execute_write_operation', async route => {
    if (!first) { await route.continue(); return; }
    first = false;
    if (lost === 'committed') { const response = await route.fetch(); expect(response.status()).toBe(200); expect((await h.snapshot()).orders).toHaveLength(1); }
    await route.abort('failed');
  });
  await page.getByTestId('submit-order-button-footer').click();
  await expect(page.getByRole('button', { name: 'Thử lại cùng lệnh', exact: true })).toBeVisible();
  await expect(page.getByTestId('order-cart-increase')).toBeDisabled(); await expect(page.getByTestId(`menu-item-${ids.M_T}`)).toBeDisabled();
  await page.getByRole('button', { name: 'Thử lại cùng lệnh', exact: true }).click();
  await expect(page.getByTestId('order-drawer')).toHaveCount(0);
  await expect(page.getByTestId('receipt-preview')).toHaveCount(0); expect(await printCount(page)).toBe(0);
  const raw = await h.snapshot(); expect(raw.orders).toHaveLength(1); expect(raw.write_operations).toHaveLength(1);
  expect(raw.write_operations[0]).toMatchObject({ status: 'applied', replay_count: lost === 'committed' ? 1 : 0 });
  const registers = writes.filter(w => w.name === 'register_write_operation'); const executes = writes.filter(w => w.name === 'execute_write_operation');
  expect(registers).toHaveLength(1); expect(executes).toHaveLength(2); expect(executes[0].body).toEqual(executes[1].body);
  await page.getByTestId('nav-takeaway').click(); await page.getByRole('button', { name: 'Tạo đơn mang đi', exact: true }).first().click();
  await expect(page.getByTestId('order-cart-line')).toHaveCount(0);
  expect(writes.filter(w => w.name === 'register_write_operation')).toHaveLength(1);
});
