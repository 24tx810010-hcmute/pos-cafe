import { afterAll, expect, test } from 'vitest';
import { ContractHarness } from './harness.ts';
import { createPayload, freshTestId, ids, payPayload } from './fixtures.ts';

const h = new ContractHarness(); afterAll(() => h.clock(null));
const headers = (token: string) => ({ apikey: h.env.anonKey, Authorization: `Bearer ${h.env.storeJwt}`, 'x-pos-employee-token': token, 'Content-Type': 'application/json', Prefer: 'return=representation' });

test('TC-IDEM-011/db bootstrap once and admin configuration retain identity and financial boundaries', async () => {
  await h.reset();
  // Temporarily empty ONLY fixture S2, which has no financial data after reset.
  // Keep actual Auth user/JWT, and restore every fixture row in finally.
  const saved = await h.observer(async db => {
    await h.assertIsolation(db);
    const store = (await db.query('select to_jsonb(s) row from public.stores s where id=$1', [ids.S2])).rows[0].row;
    const settings = (await db.query('select to_jsonb(s) row from public.store_settings s where store_id=$1', [ids.S2])).rows[0].row;
    const employees = (await db.query('select to_jsonb(e) row from public.employees e where store_id=$1', [ids.S2])).rows.map(row => row.row);
    expect((await db.query('select count(*)::int n from public.orders where store_id=$1', [ids.S2])).rows[0].n).toBe(0);
    await db.query('begin');
    try { await db.query('delete from private.employee_sessions where store_id=$1', [ids.S2]); await db.query('delete from public.employees where store_id=$1', [ids.S2]); await db.query('delete from public.store_settings where store_id=$1', [ids.S2]); await db.query('delete from public.stores where id=$1', [ids.S2]); await db.query('commit'); }
    catch (error) { await db.query('rollback'); throw error; }
    return { store, settings, employees };
  });
  try {
    const args = { p_admin_id: ids.X, p_store_no: 2, p_display_name: 'Quán A', p_address: 'Q 1' };
    expect(await h.rpc('bootstrap_store', args, undefined, process.env.IDEM_STORE_S2_JWT)).toMatchObject({ ok: true, storeId: ids.S2, adminId: ids.X, adminPin: '123456' });
    const before = await h.observer(async db => ({ store: (await db.query('select id,store_no,name from public.stores where id=$1', [ids.S2])).rows, employees: (await db.query('select id,name,role from public.employees where store_id=$1', [ids.S2])).rows }));
    expect(before.store).toEqual([{ id: ids.S2, store_no: 2, name: 'Quán A' }]); expect(before.employees).toEqual([{ id: ids.X, name: 'Quản lý', role: 'admin' }]);
    await expect(h.rpc('bootstrap_store', { ...args, p_display_name: 'Không được ghi đè' }, undefined, process.env.IDEM_STORE_S2_JWT)).rejects.toMatchObject({ code: 'ENTITY_ID_CONFLICT' });
    expect(await h.login('X')).toHaveLength(43);
    expect((await h.observer(db => db.query('select name from public.stores where id=$1', [ids.S2]))).rows[0].name).toBe('Quán A');
    expect((await h.observer(db => db.query('select count(*)::int n from public.menu_items where store_id=$1', [ids.S2]))).rows[0].n).toBe(0);
  } finally {
    await h.observer(async db => {
      await h.assertIsolation(db); await db.query('begin');
      try {
        await db.query('delete from private.employee_sessions where store_id=$1', [ids.S2]);
        await db.query('delete from public.employees where store_id=$1', [ids.S2]); await db.query('delete from public.store_settings where store_id=$1', [ids.S2]); await db.query('delete from public.stores where id=$1', [ids.S2]);
        await db.query('insert into public.stores select (jsonb_populate_record(null::public.stores,$1)).*', [saved.store]);
        await db.query('insert into public.store_settings select (jsonb_populate_record(null::public.store_settings,$1)).*', [saved.settings]);
        for (const employee of saved.employees) await db.query('insert into public.employees select (jsonb_populate_record(null::public.employees,$1)).*', [employee]);
        await db.query('commit');
      } catch (error) { await db.query('rollback'); throw error; }
    });
  }
  const a = await h.login();
  for (const actor of ['B', 'C'] as const) {
    const token = await h.login(actor);
    const response = await fetch(`${h.env.apiUrl}/rest/v1/tables`, { method: 'POST', headers: headers(token), body: JSON.stringify({ id: freshTestId(actor === 'B' ? 9001 : 9002), store_id: ids.S1, area_id: ids.AREA, name: 'Không được tạo', pos_x: 0, pos_y: 0, width: 100, height: 100, shape: 'square' }) });
    expect(response.status).toBe(403);
    await expect(h.rpc('seed_employee', { p_employee_id: freshTestId(9010), p_name: 'Seed', p_role: 'cashier', p_pin: '111111', p_seed_key: 'test:seed' }, token)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(h.rpc('reset_employee_pin', { p_employee_id: ids.A, p_pin: '654321' }, token)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  }
  const created = await fetch(`${h.env.apiUrl}/rest/v1/tables`, { method: 'POST', headers: headers(a), body: JSON.stringify({ id: ids.B02, store_id: ids.S1, area_id: ids.AREA, name: 'B02', pos_x: 0, pos_y: 0, width: 100, height: 100, shape: 'square' }) });
  expect(created.status).toBe(201); expect(await created.json()).toMatchObject([{ id: ids.B02, store_id: ids.S1, status: 'empty' }]);
  const layout = await fetch(`${h.env.apiUrl}/rest/v1/tables?id=eq.${ids.B02}`, { method: 'PATCH', headers: headers(a), body: JSON.stringify({ pos_x: 200, pos_y: 300 }) });
  expect(layout.status).toBe(200); expect(await layout.json()).toMatchObject([{ id: ids.B02, pos_x: 200, pos_y: 300, status: 'empty' }]);
  for (const field of [{ id: freshTestId(9020) }, { store_id: ids.S2 }, { status: 'occupied' }]) expect((await fetch(`${h.env.apiUrl}/rest/v1/tables?id=eq.${ids.B02}`, { method: 'PATCH', headers: headers(a), body: JSON.stringify(field) })).status).toBe(403);
  const menu = await fetch(`${h.env.apiUrl}/rest/v1/menu_items?id=eq.${ids.M_A}`, { method: 'PATCH', headers: headers(a), body: JSON.stringify({ price: 40_000 }) }); expect(menu.status).toBe(200);
  expect((await h.snapshot()).orders).toHaveLength(0);
});

test('TC-IDEM-082/db thirty-day retention and clear demo preserve all four terminal states and legacy finance', async () => {
  await h.reset('F1'); let token = await h.login();
  const pay = payPayload(); await h.register(pay, token); expect((await h.execute(pay, token)).status).toBe('applied');
  const rejected = createPayload(); await h.register(rejected, token, ids.K2); expect((await h.execute(rejected, token, ids.K2)).status).toBe('rejected');
  await h.register(pay, token, ids.Knew); expect((await h.cancel(token, ids.Knew)).status).toBe('cancelled');
  const expiredKey = freshTestId(9999); await h.register(pay, token, expiredKey);
  await h.observer(async db => {
    await db.query('update public.orders set created_by_employee_id=null,last_modified_by_employee_id=null where id=$1', [ids.MAX]);
    await db.query("update public.menu_items set seed_key='test:menu' where id=$1", [ids.M_A]);
    await db.query("update public.tables set seed_key='test:table' where id=$1", [ids.B01]);
  });
  await h.clock('2026-10-08T00:00:00Z'); token = await h.login(); expect((await h.get(token, expiredKey)).status).toBe('expired');
  const before = await h.snapshot();
  expect(before.write_operations.map(row => row.status).sort()).toEqual(['applied', 'cancelled', 'expired', 'rejected']);
  expect(before.payments).toHaveLength(1); expect(before.payments[0]).toMatchObject({ amount: 150_000, received_amount: 200_000, change_amount: 50_000 });
  expect(before.orders.find(row => row.id === ids.MAX)).toMatchObject({ created_by_employee_id: null, business_date: '2026-09-08' });
  expect((await h.rpc('clear_demo_data', { p_employee_id: ids.A }, token)).cleared).toBe(true);
  expect((await fetch(`${h.env.apiUrl}/rest/v1/stores?id=eq.${ids.S1}`, { method: 'DELETE', headers: headers(token) })).status).toBe(403);
  const after = await h.snapshot('TC-IDEM-082-retention');
  for (const table of ['orders', 'order_items', 'order_item_options', 'payments', 'write_operations', 'order_events']) expect(after[table], table).toEqual(before[table]);
  expect(after.tables[0].deleted_at).not.toBeNull();
  const list = await h.rpc('list_write_operations', { p_limit: 100 }, token); expect(list.page.items).toHaveLength(4);
  const historical = await h.get(token); expect(historical.result.receipt).toMatchObject({ total: 150_000, receivedAmount: 200_000, changeAmount: 50_000 });
});
