import { expect, test } from '@playwright/test';
import { ids } from '../contracts/fixtures.ts';
import { serverHarness as h } from './idempotencyHarness.ts';

test('TC-IDEM-011/e2e real signup bootstrap PIN and optional demo seed both reach the POS', async ({ browser }) => {
  test.setTimeout(120_000);
  await h.reset();
  for (const seedDemo of [false, true]) {
    const context = await browser.newContext(); const page = await context.newPage(); let createdStoreId: string | undefined;
    try {
      await page.goto('http://127.0.0.1:5176/'); await page.getByTestId('go-create-store').click();
      await page.getByTestId('store-name-input').fill('Quán A'); await page.getByLabel('Địa chỉ (tuỳ chọn)').fill('Q 1');
      if (seedDemo) await page.getByTestId('seed-demo-checkbox').check();
      const signup = page.waitForResponse(response => response.url().includes('/auth/v1/signup') && response.request().method() === 'POST');
      await page.getByTestId('create-store-button').click();
      const signupResponse = await signup; expect(signupResponse.status()).toBe(200);
      const signedUp = await signupResponse.json(); createdStoreId = signedUp.user?.id;
      expect(createdStoreId).toMatch(/^[0-9a-f-]{36}$/); expect([ids.S1, ids.S2]).not.toContain(createdStoreId);
      await expect(page.getByTestId('create-store-result')).toBeVisible();
      await expect(page.getByTestId('result-admin-pin')).toHaveText('123456'); await expect(page.getByTestId('seed-failed-warning')).toBeHidden();
      const raw = await h.observer(async db => ({
        store: (await db.query('select name,seed_status from public.stores where id=$1', [createdStoreId])).rows,
        settings: (await db.query('select display_name,address from public.store_settings where store_id=$1', [createdStoreId])).rows,
        admins: (await db.query("select id from public.employees where store_id=$1 and role='admin'", [createdStoreId])).rows,
        menu: (await db.query('select count(*)::int n from public.menu_items where store_id=$1', [createdStoreId])).rows[0].n,
        tables: (await db.query('select count(*)::int n from public.tables where store_id=$1', [createdStoreId])).rows[0].n,
        sessions: (await db.query('select count(*)::int n from private.employee_sessions where store_id=$1 and revoked_at is null', [createdStoreId])).rows[0].n,
      }));
      expect(raw.store).toEqual([{ name: 'Quán A', seed_status: 'seeded' }]); expect(raw.settings).toEqual([{ display_name: 'Quán A', address: 'Q 1' }]);
      expect(raw.admins).toHaveLength(1); expect(raw.sessions).toBe(0);
      if (seedDemo) { expect(raw.menu).toBeGreaterThan(0); expect(raw.tables).toBeGreaterThan(0); }
      else { expect(raw.menu).toBe(0); expect(raw.tables).toBe(0); }
      await page.getByTestId('go-passcode').click(); await page.getByTestId(`employee-${raw.admins[0].id}`).click();
      for (const digit of '123456') await page.getByTestId(`pin-${digit}`).click();
      await page.getByTestId('unlock-button').click(); await expect(page.getByTestId('floor-view')).toBeVisible();
      expect((await h.observer(db => db.query('select count(*)::int n from public.orders where store_id=$1', [createdStoreId]))).rows[0].n).toBe(0);
    } finally {
      await context.close();
      if (createdStoreId) await h.observer(async db => {
        // Remove only the new, observed test Auth identity; never S1/S2 or financial data.
        if ([ids.S1, ids.S2].includes(createdStoreId!) || !/^[0-9a-f-]{36}$/.test(createdStoreId!)) throw new Error('NEW_FIXTURE_TEARDOWN_REFUSED');
        const marker = (await db.query('select marker from private.idempotency_test_environment where singleton=true')).rows[0]?.marker;
        if (marker !== h.env.marker || (await db.query('select count(*)::int n from public.orders where store_id=$1', [createdStoreId])).rows[0].n !== 0) throw new Error('NEW_FIXTURE_TEARDOWN_REFUSED');
        await db.query('begin');
        try {
          await db.query('delete from private.employee_sessions where store_id=$1', [createdStoreId]);
          for (const table of ['menu_item_option_groups', 'option_values', 'option_groups', 'menu_items', 'categories', 'floor_decor_items', 'tables', 'floor_areas', 'employees', 'store_settings']) await db.query(`delete from public.${table} where store_id=$1`, [createdStoreId]);
          await db.query('delete from public.stores where id=$1', [createdStoreId]); await db.query('delete from auth.users where id=$1', [createdStoreId]); await db.query('commit');
        } catch (error) { await db.query('rollback'); throw error; }
      });
    }
  }
  await h.clock(null);
});
