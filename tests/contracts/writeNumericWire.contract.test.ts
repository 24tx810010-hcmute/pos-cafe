import { afterAll, expect, test } from 'vitest';
import { ContractHarness, businessOnly } from './harness.ts';
import { createPayload, ids, payPayload, schemaPayload, schemaTarget, splitPayload, updatePayload, voidPayload } from './fixtures.ts';

const h = new ContractHarness();
afterAll(() => h.clock(null));
type WireForm = 'decimal' | 'exponent';

// JSON.stringify erases integral decimal spellings. Build the HTTP body ourselves
// so these regressions reach PostgreSQL as numbers such as 2.0 and 2e0.
function wireJson(value: unknown, form: WireForm): string {
  if (typeof value === 'number') return form === 'decimal' && Number.isInteger(value) ? `${value}.0` : form === 'exponent' ? `${value}e0` : String(value);
  if (Array.isArray(value)) return `[${value.map(item => wireJson(item, form)).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}:${wireJson(item, form)}`).join(',')}}`;
  return JSON.stringify(value);
}

async function wireRpc(endpoint: 'register' | 'execute', payload: unknown, token: string, form: WireForm) {
  const body = wireJson({ p_operation_id: ids.K1, p_payload: payload }, form);
  expect(body).toContain(form === 'decimal' ? '"schemaVersion":1.0' : '"schemaVersion":1e0');
  const response = await fetch(`${h.env.apiUrl}/rest/v1/rpc/${endpoint}_write_operation`, {
    method: 'POST', body, signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', apikey: h.env.anonKey, Authorization: `Bearer ${h.env.storeJwt}`, 'x-pos-employee-token': token },
  });
  return { status: response.status, data: await response.json() as any };
}

async function storedPayload() {
  return h.observer(async db => (await db.query('select payload::text as payload from public.write_operations where store_id=$1 and operation_id=$2', [ids.S1, ids.K1])).rows[0].payload as string);
}

function addedLine() {
  return { id: ids.L2, menuItemId: ids.M_A, quantity: 1, quotedBasePrice: 35000, options: [{ id: ids.OPTION2, optionValueId: ids.Q, quantity: 2, quotedPriceDelta: 7000 }] };
}

type PositiveCase = { name: string; fixture: Parameters<ContractHarness['reset']>[0]; payload: () => any; verify: (result: any, raw: Record<string, any[]>) => void };
const positiveCases: PositiveCase[] = [
  { name: 'create', fixture: 'F0', payload: () => ({ ...createPayload(), newLines: [{ ...createPayload().newLines[0], options: [{ id: ids.OPTION1, optionValueId: ids.Q, quantity: 2, quotedPriceDelta: 5000 }] }] }),
    verify: (r, raw) => {
      expect(r.order).toMatchObject({ id: ids.O1, total: 80000, status: 'open', lockVersion: 0 });
      expect(raw.order_items).toEqual([expect.objectContaining({ id: ids.L1, quantity: 2, unit_price: 30000 })]);
      expect(raw.order_item_options).toEqual([expect.objectContaining({ id: ids.OPTION1, quantity: 2, price_delta: 5000 })]);
    } },
  { name: 'update_retained', fixture: 'F3', payload: () => ({ ...updatePayload(), retainedLines: [{ sourceItemId: ids.L1, quantity: 1 }], newLines: [addedLine()] }),
    verify: (r, raw) => {
      expect(r.order).toMatchObject({ total: 89000, lockVersion: 6 });
      expect(raw.order_items).toEqual(expect.arrayContaining([expect.objectContaining({ id: ids.L1, quantity: 1, unit_price: 30000 }), expect.objectContaining({ id: ids.L2, quantity: 1, unit_price: 35000 })]));
      expect(raw.order_item_options).toEqual(expect.arrayContaining([expect.objectContaining({ id: ids.OPTION1, quantity: 2, price_delta: 5000 }), expect.objectContaining({ id: ids.OPTION2, quantity: 2, price_delta: 7000 })]));
    } },
  { name: 'update_remove', fixture: 'F3', payload: () => ({ ...updatePayload(), retainedLines: [{ sourceItemId: ids.L1, quantity: 0 }], newLines: [addedLine()] }),
    verify: (r, raw) => {
      expect(r.order).toMatchObject({ total: 49000, lockVersion: 6 });
      expect(r.order.items).toEqual([expect.objectContaining({ id: ids.L2, quantity: 1, baseUnitPrice: 35000 })]);
      expect(raw.order_items.find(row => row.id === ids.L1)).toMatchObject({ quantity: 2, status: 'removed' });
    } },
  { name: 'pay', fixture: 'F1', payload: payPayload,
    verify: (r, raw) => {
      expect(r.order).toMatchObject({ status: 'paid', lockVersion: 6, total: 150000 });
      expect(r.payment).toMatchObject({ amount: 150000, receivedAmount: 200000, changeAmount: 50000 });
      expect(r.receipt.total).toBe(150000);
      expect(raw.payments).toEqual([expect.objectContaining({ id: ids.P1, amount: 150000, received_amount: 200000, change_amount: 50000 })]);
    } },
  { name: 'split_partial', fixture: 'F3', payload: splitPayload,
    verify: (r, raw) => {
      expect(r.paidOrder).toMatchObject({ id: ids.O2, total: 40000 });
      expect(r.sourceOrder).toMatchObject({ id: ids.O1, total: 40000, lockVersion: 6 });
      expect(r.payment).toMatchObject({ amount: 40000, receivedAmount: 50000, changeAmount: 10000 });
      expect(r.receipt.total).toBe(40000);
      expect(raw.order_items).toEqual(expect.arrayContaining([expect.objectContaining({ id: ids.L1, order_id: ids.O1, quantity: 1 }), expect.objectContaining({ id: ids.L2, order_id: ids.O2, quantity: 1 })]));
      expect(raw.order_item_options).toHaveLength(2);
      for (const option of raw.order_item_options) expect(option).toMatchObject({ quantity: 2, price_delta: 5000 });
      expect(raw.payments).toHaveLength(1);
    } },
  { name: 'split_whole_line', fixture: 'F2', payload: () => ({ ...splitPayload(), lines: [{ orderItemId: ids.L30, quantity: 1, splitItemId: ids.L2 }] }),
    verify: (r, raw) => {
      expect(r.paidOrder).toMatchObject({ total: 30000, items: [expect.objectContaining({ id: ids.L30, quantity: 1 })] });
      expect(r.sourceOrder).toMatchObject({ total: 35000, lockVersion: 6 });
      expect(r.payment).toMatchObject({ amount: 30000, receivedAmount: 50000, changeAmount: 20000 });
      expect(raw.order_items).toHaveLength(2);
      expect(raw.order_items.find(row => row.id === ids.L30).order_id).toBe(ids.O2);
      expect(raw.payments).toHaveLength(1);
    } },
  { name: 'void_open', fixture: 'F1', payload: () => ({ schemaVersion: 1, kind: 'submit_order_changes', action: 'void_open', orderId: ids.O1, expectedVersion: 5 }),
    verify: (r, raw) => {
      expect(r.order).toMatchObject({ status: 'void', total: 0, lockVersion: 6 });
      expect(raw.order_items).toEqual([expect.objectContaining({ status: 'removed', quantity: 5 })]);
      expect(raw.payments).toHaveLength(0);
    } },
  { name: 'void_paid', fixture: 'F4', payload: voidPayload,
    verify: (r, raw) => {
      expect(r.order).toMatchObject({ status: 'void', total: 150000, lockVersion: 7 });
      expect(raw.payments).toEqual([expect.objectContaining({ id: ids.P0, amount: 150000, received_amount: 200000, change_amount: 50000 })]);
    } },
];

for (const row of positiveCases) for (const form of ['decimal', 'exponent'] as const) {
  test(`TC-IDEM-015/db/numeric=${row.name}/wire=${form} equivalent integral JSON registers, executes and replays without rewriting the frozen payload`, async () => {
    await h.reset(row.fixture); const token = await h.login(); const payload = row.payload();
    const before = await h.snapshot();
    expect(await wireRpc('register', payload, token, form)).toMatchObject({ status: 200, data: { operation: { status: 'pending', payload } } });
    const frozen = await storedPayload();
    if (form === 'decimal') expect(frozen).toContain('"schemaVersion": 1.0');
    expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
    expect((await h.register(payload, token)).status).toBe('pending');
    // Retry registration/execute as integer JSON, then replay using the original
    // raw spelling: all requests must refer to the one immutable operation.
    const applied = await h.execute(payload, token);
    expect(applied.status).toBe('applied');
    const after = await h.snapshot(); row.verify(applied.result, after);
    expect(after.write_operations).toHaveLength(1); expect(after.order_events).toHaveLength(1);
    const replay = await wireRpc('execute', payload, token, form);
    expect(replay).toMatchObject({ status: 200, data: { operation: { status: 'applied', replayCount: '1', result: applied.result } } });
    expect(await storedPayload()).toBe(frozen);
    expect(businessOnly(await h.snapshot())).toEqual(businessOnly(after));
  });
}

const invalidFields = [
  ['update.expectedVersion', 0, 2147483647], ['pay.expectedVersion', 0, 2147483647], ['void.expectedVersion', 0, 2147483647],
  ['retained.quantity', 0, 999], ['newLine.quantity', 1, 999], ['newLine.quotedBasePrice', 0, 2147483647],
  ['option.quantity', 1, 99], ['option.quotedPriceDelta', 0, 2147483647], ['pay.receivedAmount', 0, 2147483647], ['split.quantity', 1, 999],
] as const;

for (const [field, min, max] of invalidFields) for (const [variant, value] of [['fractional', 1.5], ['below_min', min - 1], ['above_max', max + 1]] as const) {
  test(`TC-IDEM-074/db/numeric_field=${field}/invalid=${variant} raw numeric input is rejected before rounding or business effects`, async () => {
    const fixture = field.startsWith('void.') ? 'F4' : /^(update|retained|pay|split)\./.test(field) ? 'F1' : 'F0';
    await h.reset(fixture); const token = await h.login(); const payload = schemaPayload(field);
    const target = schemaTarget(payload, field); const valid = target.object[target.key]; target.object[target.key] = value;
    const before = await h.snapshot();
    expect(await wireRpc('register', payload, token, 'decimal')).toMatchObject({ status: 200, data: { ok: false, error: { code: 'INVALID_WRITE_REQUEST' } } });
    expect(await h.snapshot()).toEqual(before);
    target.object[target.key] = valid;
    expect(await wireRpc('register', payload, token, 'decimal')).toMatchObject({ status: 200, data: { operation: { status: 'pending' } } });
    expect((await h.execute(payload, token)).status).toBe('applied');
  });
}
