import { expect } from '@playwright/test';
import { test } from './idempotencyTest.ts';
import { ids, payPayload, splitPayload, updatePayload, voidPayload, freshTestId,createPayload } from '../contracts/fixtures.ts';
import { pairAndUnlock, unlock, openRecovery, watchWrites, printCount, installPrintCounter, serverHarness as h } from './idempotencyHarness.ts';
test.afterEach(()=>h.clock(null));

async function paidRecoveryFixture() {
  await h.reset('F1'); const token = await h.login();
  await h.register(payPayload(), token); expect((await h.execute(payPayload(), token)).status).toBe('applied');
}
async function closeRecovery(page: import('@playwright/test').Page) {
  await page.getByTestId('write-recovery-drawer').getByRole('button', { name: 'Đóng', exact: true }).click();
}
async function expectNoRecoveryData(page: import('@playwright/test').Page) {
  await expect(page.getByTestId(`operation-${ids.K1}`)).toHaveCount(0);
  await expect(page.getByTestId('historical-result')).toHaveCount(0);
  await expect(page.getByTestId('write-recovery-resume')).toHaveCount(0);
}

test('TC-IDEM-006/e2e/cache=switch_employee A to denied C to authorized B on the same browser never reuses the earlier cache', async ({ page }) => {
  await paidRecoveryFixture(); await pairAndUnlock(page); await openRecovery(page);
  await expect(page.getByTestId('historical-result')).toContainText('150.000');
  await closeRecovery(page); await page.getByTestId('nav-lock').click(); await unlock(page, 'C');
  await expect(h.get(await h.login('C'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  const listResponse = page.waitForResponse(response => response.url().endsWith('/rpc/list_write_operations'));
  await page.getByTestId('nav-write-recovery').click(); await expectNoRecoveryData(page); await listResponse;
  await expect(page.getByText('Không tìm thấy thao tác phù hợp.')).toBeVisible(); await expectNoRecoveryData(page);
  await closeRecovery(page); await page.getByTestId('nav-lock').click(); await unlock(page, 'B');
  await openRecovery(page); await expect(page.getByTestId('historical-result')).toContainText('150.000');
  expect((await h.snapshot()).payments).toHaveLength(1);
});

test('TC-IDEM-006/e2e/cache=revoked_permission a real server denial clears open details until a fresh authorized read', async ({ page }) => {
  await paidRecoveryFixture(); await pairAndUnlock(page); await openRecovery(page);
  await expect(page.getByTestId('historical-result')).toContainText('150.000');
  await h.observer(db => db.query('update public.employees set permission_overrides=$2 where id=$1', [ids.A, { grants: [], denies: ['payment.take'] }]));
  const deniedResponse = await page.waitForResponse(async response => response.url().endsWith('/rpc/get_write_operation') && (await response.json()).error?.code === 'FORBIDDEN', { timeout: 10000 });
  expect((await deniedResponse.json()).error.code).toBe('FORBIDDEN');
  await expectNoRecoveryData(page);
  await h.observer(db => db.query("update public.employees set permission_overrides='{}'::jsonb where id=$1", [ids.A]));
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await page.getByTestId(`operation-${ids.K1}`).click(); await expect(page.getByTestId('historical-result')).toContainText('150.000');
  expect((await h.snapshot()).payments).toHaveLength(1);
});

test('TC-IDEM-006/e2e/cache=late_response an authorized result held across lock and employee change stays invisible', async ({ page }) => {
  await paidRecoveryFixture(); await pairAndUnlock(page);
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let captured = false;
  await page.route('**/rest/v1/rpc/get_write_operation', async route => {
    const response = await route.fetch(); expect(response.status()).toBe(200); captured = true;
    await gate; await route.fulfill({ response });
  });
  await page.getByTestId('nav-write-recovery').click(); await page.getByTestId(`operation-${ids.K1}`).click();
  await expect.poll(() => captured).toBe(true);
  await closeRecovery(page); await page.getByTestId('nav-lock').click(); await unlock(page, 'C');
  await page.getByTestId('nav-write-recovery').click(); await expect(page.getByText('Không tìm thấy thao tác phù hợp.')).toBeVisible();
  const oldResponse = page.waitForResponse(response => response.url().endsWith('/rpc/get_write_operation'));
  release(); await oldResponse; await expectNoRecoveryData(page);
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click(); await expectNoRecoveryData(page);
  expect((await h.snapshot()).payments).toHaveLength(1);
});
test('TC-IDEM-057/e2e server recovery paginates all 101 tied registrations and applies filters',async({page,browser})=>{
  await h.reset();const token=await h.login();const keys:string[]=[];for(let i=0;i<101;i++){const key=freshTestId(7000+i);keys.push(key);const p:any=i%2?payPayload():createPayload();await h.register(p,token,key);if(i===0)await h.cancel(token,key);}
  await pairAndUnlock(page);await page.getByTestId('nav-write-recovery').click();const rows=page.locator('button[data-testid^="operation-"]');
  const observed:string[]=[];for(const count of [50,50,1]){await expect(rows).toHaveCount(count);observed.push(...await rows.evaluateAll(elements=>elements.map(el=>el.getAttribute('data-testid')!.slice(10))));if(count!==1)await page.getByRole('button',{name:'Trang tiếp',exact:true}).click();}
  expect(new Set(observed).size).toBe(101);expect(new Set(observed)).toEqual(new Set(keys));await page.getByRole('button',{name:'Trang tiếp',exact:true}).isDisabled();
  await page.getByLabel('Trạng thái thao tác',{exact:true}).selectOption('cancelled');await expect(rows).toHaveCount(1);await expect(page.getByTestId(`operation-${keys[0]}`)).toBeVisible();
  await page.getByLabel('Trạng thái thao tác',{exact:true}).selectOption('pending');await page.getByLabel('Loại thao tác',{exact:true}).selectOption('pay_order');await expect(rows).toHaveCount(50);await page.getByLabel('Mã đơn',{exact:true}).fill(ids.O2);await expect(rows).toHaveCount(0);expect((await h.snapshot()).orders).toHaveLength(0);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5176'});try{const other=await context.newPage();await pairAndUnlock(other,'B');await other.getByTestId('nav-write-recovery').click();const allowed=other.locator('button[data-testid^="operation-"]');await expect(allowed).toHaveCount(50);for(const text of await allowed.allTextContents())expect(text).toContain('Thanh toán toàn bộ');await expect(other.getByRole('button',{name:'Trang tiếp',exact:true})).toBeDisabled();}finally{await context.close();}
});

test('TC-IDEM-058/e2e unknown key is never reported cancelled and a late register stays pending',async({page})=>{
  await h.reset();const token=await h.login();await pairAndUnlock(page);await page.getByTestId(`table-${ids.B01}`).click();await page.getByTestId(`menu-item-${ids.M_T}`).click();
  let release!:()=>void;const gate=new Promise<void>(done=>{release=done;});let key='',registered=false;
  await page.route('**/rest/v1/rpc/register_write_operation',async route=>{key=route.request().postDataJSON().p_operation_id;await gate;await route.fetch();registered=true;await route.abort('failed');});
  await page.getByTestId('submit-order-button').click();await expect(page.getByTestId('write-attempt-notice')).toBeVisible({timeout:18000});expect((await h.snapshot()).write_operations).toHaveLength(0);
  await page.getByRole('button',{name:'Thử lại cùng lệnh',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Server chưa tìm thấy thao tác này. Chưa thể xác nhận đã thực hiện hay đã hủy.'})).toBeVisible();await expect(h.cancel(token,key)).rejects.toMatchObject({code:'OPERATION_NOT_FOUND'});await expect(h.execute(createPayload(),token,key)).rejects.toMatchObject({code:'OPERATION_NOT_FOUND'});await expect(page.getByText('Đã hủy lệnh',{exact:true})).toHaveCount(0);
  release();await expect.poll(()=>registered).toBe(true);await openRecovery(page,key);await expect(page.getByTestId('operation-status')).toContainText('Chưa thực hiện');expect((await h.snapshot()).orders).toHaveLength(0);await page.getByTestId('write-recovery-cancel').click();await expect(page.getByTestId('operation-status')).toContainText('Đã hủy lệnh');expect((await h.snapshot()).orders).toHaveLength(0);
});
test('TC-IDEM-046/e2e voiding a paid order through recovery preserves the new customer at its table',async({page})=>{
  await h.reset('F4');const token=await h.login();await h.register(voidPayload(),token);await pairAndUnlock(page);await openRecovery(page);await page.getByTestId('write-recovery-resume').click();await expect(page.getByTestId('historical-result')).toContainText('void');const raw=await h.snapshot();expect(raw.orders.find(row=>row.id===ids.O1)).toMatchObject({status:'void',total:150000,lock_version:7});expect(raw.orders.find(row=>row.id===ids.O3)).toMatchObject({status:'open',total:20000});expect(raw.tables[0].status).toBe('occupied');expect(raw.payments).toHaveLength(1);
});
test('TC-IDEM-049/e2e a void reason of other without explanation displays its precise rejection',async({page})=>{
  await h.reset('F4');const token=await h.login();await h.register({...voidPayload(),reason:'other'},token);await pairAndUnlock(page);await openRecovery(page);await page.getByTestId('write-recovery-resume').click();await expect(page.getByText('Vui lòng chọn lý do hủy và nhập ghi chú nếu chọn lý do khác.',{exact:true}).first()).toBeVisible();expect((await h.snapshot()).orders.find(row=>row.id===ids.O1)?.status).toBe('paid');
});
for (const terminal of ['applied', 'rejected', 'cancelled', 'expired']) test(`TC-IDEM-068/e2e/terminal=${terminal} recovers its durable decision after the browser loses an observed committed ACK`, async ({ page, newRecoveryPage }) => {
  await test.step('Prepare a pending operation on the original device', async () => {
    await h.reset('F1');
    const token = await h.login();
    const payload = terminal === 'rejected' ? { ...payPayload(), receivedAmount: 1 } : payPayload();
    await h.register(payload, token);
    if (terminal === 'expired') await h.clock('2026-09-08T20:00:00Z');
    await pairAndUnlock(page);
    await openRecovery(page);
  });

  await test.step('Observe the committed decision and finish dropping its ACK', async () => {
    const rpc = `${terminal === 'cancelled' ? 'cancel' : 'execute'}_write_operation`;
    const writes = watchWrites(page);
    let dropped!: () => void;
    let dropFailed!: (error: unknown) => void;
    const ackDropped = new Promise<void>((resolve, reject) => { dropped = resolve; dropFailed = reject; });
    await page.route(`**/rest/v1/rpc/${rpc}`, async (route) => {
      try {
        if (terminal === 'expired') await h.clock('2026-09-09T00:00:00Z');
        await route.fetch();
        const raw = await h.snapshot();
        expect(raw.write_operations).toHaveLength(1);
        expect(raw.write_operations[0].status).toBe(terminal);
        await route.abort('failed');
        dropped();
      } catch (error) { dropFailed(error); }
    });
    const requestFailed = page.waitForEvent('requestfailed', (request) => request.url().endsWith(`/rpc/${rpc}`));
    await Promise.all([
      ackDropped,
      requestFailed,
      page.getByTestId(terminal === 'cancelled' ? 'write-recovery-cancel' : 'write-recovery-resume').click(),
    ]);
    // The old device must be quiescent before a shared test clock jumps days.
    // Late-response UI behavior has separate TC053/054 lifecycle oracles.
    await page.close();
    expect(writes.map((request) => request.name)).toEqual([rpc]);
    await h.clock('2026-09-11T00:00:00Z');
  }, { timeout: 15_000 });

  const other = await test.step('Create and authenticate a fresh device after the clock jump', async () => {
    const fresh = await newRecoveryPage();
    await pairAndUnlock(fresh);
    return fresh;
  }, { timeout: 15_000 });
  await test.step('Recover the original terminal decision without another write', async () => {
    const writes = watchWrites(other);
    await openRecovery(other);
    const labels: Record<string, string> = { applied: 'Đã ghi thành công', rejected: 'Đã từ chối', cancelled: 'Đã hủy lệnh', expired: 'Lệnh hết hạn' };
    await expect(other.getByTestId('operation-status')).toContainText(labels[terminal]);
    await expect(other.getByTestId('write-recovery-resume')).toBeDisabled();
    const raw = await h.snapshot();
    expect(raw.payments).toHaveLength(terminal === 'applied' ? 1 : 0);
    expect(raw.write_operations).toHaveLength(1);
    expect(raw.write_operations[0].status).toBe(terminal);
    expect(writes).toHaveLength(0);
  }, { timeout: 15_000 });
});

test('TC-IDEM-059/e2e a permitted cashier can cancel a pending operation without changing its order',async({page})=>{
  await h.reset('F1');const a=await h.login();await h.register(payPayload(),a);await pairAndUnlock(page,'B');await openRecovery(page);const writes=watchWrites(page);await page.getByTestId('write-recovery-cancel').click();await expect(page.getByTestId('operation-status')).toContainText('hủy');expect(writes.map(request=>request.name)).toEqual(['cancel_write_operation']);const raw=await h.snapshot();expect(raw.payments).toHaveLength(0);expect(raw.write_operations[0].cancelled_by_employee_id).toBe(ids.B);
});
test('TC-IDEM-056/e2e another cashier resumes a pending payment and preserves initiator attribution',async({page})=>{
  await h.reset('F1');const a=await h.login();await h.register(payPayload(),a);await pairAndUnlock(page,'B');await openRecovery(page);await page.getByTestId('write-recovery-resume').click();await expect(page.getByTestId('historical-result')).toContainText('150.000');const raw=await h.snapshot();expect(raw.write_operations[0]).toMatchObject({initiated_by_employee_id:ids.A,executed_by_employee_id:ids.B});expect(raw.payments[0].employee_id).toBe(ids.B);
});
test('TC-IDEM-055/e2e a fresh browser recovers distinct historical and pending split operations from server',async({page,browser})=>{
  await h.reset('F1');await h.observer(async db=>{await db.query('delete from public.orders where id=$1',[ids.MAX]);await db.query('update public.orders set order_no=7 where id=$1',[ids.O1]);});const a=await h.login();await h.register(splitPayload(),a);await h.execute(splitPayload(),a);const second={...splitPayload(),expectedVersion:6,newOrderId:ids.O3,paymentId:freshTestId(302),lines:[{orderItemId:ids.L1,quantity:1,splitItemId:ids.L35}]};await h.register(second,a,ids.K2);
  await pairAndUnlock(page);await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await page.context().clearCookies();
  const fresh=await browser.newContext({baseURL:'http://127.0.0.1:5176'});try{const other=await fresh.newPage();await pairAndUnlock(other,'B');await openRecovery(other);await expect(other.getByTestId('historical-result')).toContainText('120.000');await other.getByTestId(`operation-${ids.K2}`).click();await other.getByTestId('write-recovery-resume').click();await expect(other.getByTestId('current-order')).toContainText('90.000');await other.getByTestId(`operation-${ids.K1}`).click();await expect(other.getByTestId('historical-result')).toContainText('120.000');await expect(other.getByTestId('current-order')).toContainText('90.000');expect((await h.snapshot()).payments).toHaveLength(2);}finally{await fresh.close();}
});
test('TC-IDEM-066/e2e expiry is shown separately from an old order that can still be paid',async({page})=>{
  await h.reset('F1');let token=await h.login();await h.register(payPayload(),token);await h.clock('2026-09-10T00:00:00Z');token=await h.login();await h.get(token);await h.register(payPayload(),token,ids.Knew);await pairAndUnlock(page);await openRecovery(page);await expect(page.getByTestId('operation-status')).toContainText('hạn');await expect(page.getByTestId('current-order')).toContainText('150.000');await page.getByTestId(`operation-${ids.Knew}`).click();await page.getByTestId('write-recovery-resume').click();await expect(page.getByTestId('historical-result')).toContainText('150.000');
  const raw=await h.snapshot();expect(raw.payments).toHaveLength(1);expect(raw.orders.find(row=>row.id===ids.O1)).toMatchObject({status:'paid',lock_version:6,total:150000,business_date:'2026-09-08'});expect(Date.parse(raw.payments[0].paid_at)).toBe(Date.parse('2026-09-10T00:00:00Z'));expect(raw.tables.find(row=>row.id===ids.B01)?.status).toBe('empty');expect((await h.get(token)).status).toBe('expired');
  await page.getByTestId('write-recovery-drawer').getByRole('button',{name:'Đóng',exact:true}).click();await page.getByTestId('nav-report').click();await page.getByRole('button',{name:'Tuỳ chọn',exact:true}).click();
  await page.getByTestId('report-from-date').fill('2026-09-08');await page.getByTestId('report-to-date').fill('2026-09-08');await expect(page.getByTestId('report-summary')).toHaveAttribute('data-revenue','150000');
  await page.getByTestId('report-to-date').fill('2026-09-10');await page.getByTestId('report-from-date').fill('2026-09-10');await expect(page.getByTestId('report-summary')).toHaveAttribute('data-revenue','0');
});
test('TC-IDEM-083/e2e historical paid split remains readable after child void without enabling a stale reprint',async({page})=>{
  await h.reset('F1');const token=await h.login();await h.register(splitPayload(),token);await h.execute(splitPayload(),token);const update={...updatePayload(),expectedVersion:6,retainedLines:[{sourceItemId:ids.L1,quantity:4,note:'new'}]};await h.register(update,token,ids.K2);await h.execute(update,token,ids.K2);const voided={...voidPayload(),orderId:ids.O2,expectedVersion:0};await h.register(voided,token,ids.Knew);await h.execute(voided,token,ids.Knew);await installPrintCounter(page);await pairAndUnlock(page);await openRecovery(page);await expect(page.getByTestId('historical-result')).toContainText('30.000');await expect(page.getByTestId('current-order')).toContainText('phiên bản 7');await page.getByTestId('write-recovery-reprint').click();await expect(page.getByRole('status').filter({hasText:'Đơn chưa thanh toán hoặc đã hủy nên không thể in hóa đơn.'})).toBeVisible();expect(await printCount(page)).toBe(0);
});
