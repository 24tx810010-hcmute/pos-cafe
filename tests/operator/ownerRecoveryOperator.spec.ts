import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const pin = '729461';
const launchCode = 'operator-browser-test-code-2026-strong';

test('operator UI keeps recovery local, shows exact errors, and retries one lost ACK safely', async ({ page }) => {
  const consoleRows: string[] = [];
  const urls: string[] = [];
  const responses: string[] = [];
  page.on('console', message => consoleRows.push(message.text()));
  page.on('request', request => urls.push(request.url()));
  page.on('response', async response => {
    if (response.url().endsWith('/api/recover')) responses.push(await response.text().catch(() => ''));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Khôi phục PIN chủ quán' })).toBeVisible();
  await page.getByLabel('Mã mở phiên').fill(launchCode);
  await page.getByRole('button', { name: 'Mở phiên 10 phút' }).click();
  await expect(page.getByText('PHIÊN OPERATOR · 10 PHÚT')).toBeVisible();
  await expect(page.getByLabel('Mã mở phiên')).toBeHidden();
  await expect(page.getByLabel('PIN tạm mới · đúng 6 chữ số')).toHaveAttribute('autocomplete', 'off');
  const storeId = randomUUID();
  const targetId = randomUUID();
  await page.getByLabel('Store ID đã xác minh').fill(storeId);
  await page.getByLabel('Owner ID đã xác minh').fill(targetId);
  await page.getByLabel('Mã operator').fill('operator-test');
  await page.getByLabel('Mã hồ sơ hỗ trợ').fill('case-owner-protected');
  await page.getByLabel('Mã bằng chứng xác minh').fill('proof-test');
  await page.getByLabel('PIN tạm mới · đúng 6 chữ số').fill(pin);
  await page.getByLabel(/Tôi đã đối chiếu hồ sơ/).check();
  const geometry = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth, inputs: [...document.querySelectorAll('input')].filter(input => !input.closest('[hidden]'))
      .map(input => ({ width: input.getBoundingClientRect().width, height: input.getBoundingClientRect().height })) }));
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.inputs.every(input => input.width > 0 && input.height >= 19)).toBe(true);
  mkdirSync('artifacts/permission-pin-tc18-private', { recursive: true });
  await page.locator('#new-pin').scrollIntoViewIfNeeded();
  writeFileSync(`artifacts/permission-pin-tc18-private/operator-${test.info().project.name}-masked.png`,
    await page.screenshot({ mask: [page.locator('#new-pin')], maskColor: '#000000' }));
  await page.getByRole('button', { name: 'Phát hành PIN tạm' }).click();
  await expect(page.getByText('Tài khoản cần khôi phục phải là chủ quán đang hoạt động.')).toBeVisible();
  await page.getByRole('button', { name: 'Tạo yêu cầu mới' }).click();
  await page.getByLabel('Mã hồ sơ hỗ trợ').fill('case-not-found');
  await page.getByLabel('PIN tạm mới · đúng 6 chữ số').fill(pin);
  await page.getByLabel(/Tôi đã đối chiếu hồ sơ/).check();
  await page.getByRole('button', { name: 'Phát hành PIN tạm' }).click();
  await expect(page.getByText('Không tìm thấy tài khoản cần khôi phục.')).toBeVisible();
  await page.getByRole('button', { name: 'Tạo yêu cầu mới' }).click();
  await page.getByLabel('Mã hồ sơ hỗ trợ').fill('case-unavailable');
  await page.getByLabel('PIN tạm mới · đúng 6 chữ số').fill(pin);
  await page.getByLabel(/Tôi đã đối chiếu hồ sơ/).check();
  const unavailableRequestId = await page.getByLabel('Mã yêu cầu').inputValue();
  await page.getByRole('button', { name: 'Phát hành PIN tạm' }).click();
  await expect(page.getByText('Chưa xác nhận được việc khôi phục PIN. Kiểm tra hồ sơ trước khi thử lại cùng yêu cầu.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo yêu cầu mới' })).toBeHidden();
  await page.getByRole('button', { name: 'Thử lại cùng yêu cầu' }).click();
  await expect(page.getByText(/Đã tìm thấy receipt của yêu cầu này/)).toBeVisible();
  expect(await page.getByLabel('Mã yêu cầu').inputValue()).toBe(unavailableRequestId);
  await page.getByRole('button', { name: 'Xóa PIN khỏi trang' }).click();
  for (const [caseRef, exactMessage] of [
    ['case-review-required', 'Chưa đủ căn cứ khôi phục chủ quán. Cần xác minh hồ sơ hỗ trợ.'],
    ['case-forbidden', 'Bạn không có quyền thực hiện thao tác này.'],
    ['case-reused', 'Mã yêu cầu đã được dùng cho nội dung khác. Vui lòng tạo yêu cầu mới.'],
  ]) {
    await page.getByRole('button', { name: 'Tạo yêu cầu mới' }).click();
    await page.getByLabel('Mã hồ sơ hỗ trợ').fill(caseRef);
    await page.getByLabel('PIN tạm mới · đúng 6 chữ số').fill(pin);
    await page.getByLabel(/Tôi đã đối chiếu hồ sơ/).check();
    await page.getByRole('button', { name: 'Phát hành PIN tạm' }).click();
    await expect(page.getByText(exactMessage)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Tạo yêu cầu mới' }).click();
  await page.getByLabel('Mã hồ sơ hỗ trợ').fill('case-success');
  await page.getByLabel('PIN tạm mới · đúng 6 chữ số').fill(pin);
  await page.getByLabel(/Tôi đã đối chiếu hồ sơ/).check();
  const requestId = await page.getByLabel('Mã yêu cầu').inputValue();
  await page.route('**/api/recover', async route => {
    await route.fetch();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Phát hành PIN tạm' }).click();
  await expect(page.getByRole('button', { name: 'Thử lại cùng yêu cầu' })).toBeVisible();
  expect(await page.getByLabel('Mã yêu cầu').inputValue()).toBe(requestId);
  await page.unroute('**/api/recover');
  await page.getByRole('button', { name: 'Thử lại cùng yêu cầu' }).click();
  await expect(page.getByText(/Đã tìm thấy receipt của yêu cầu này/)).toBeVisible();
  expect(await page.getByLabel('Mã yêu cầu').inputValue()).toBe(requestId);
  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
  expect(JSON.stringify(storage)).not.toContain(pin);
  expect(JSON.stringify(storage)).not.toContain(launchCode);
  expect([...urls, ...consoleRows, ...responses].join('\n')).not.toContain(pin);
  expect([...urls, ...consoleRows, ...responses].join('\n')).not.toContain(launchCode);
  expect(await page.locator('body').innerText()).not.toContain(pin);
  await page.getByRole('button', { name: 'Xóa PIN khỏi trang' }).click();
  expect(await page.getByLabel('PIN tạm mới · đúng 6 chữ số').inputValue()).toBe('');
  writeFileSync(`artifacts/permission-pin-tc18-private/operator-${test.info().project.name}-full.png`,
    await page.screenshot({ fullPage: true }));
  await page.getByRole('button', { name: 'Khóa phiên' }).click();
  await expect(page.getByText('CHƯA MỞ PHIÊN')).toBeVisible();
});
