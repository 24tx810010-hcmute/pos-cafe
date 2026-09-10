import { afterAll, expect, test } from 'vitest';
import { ContractHarness, businessOnly } from './harness.ts';
import { createPayload, ids, payPayload, splitPayload, updatePayload, voidPayload, T } from './fixtures.ts';

const h=new ContractHarness();
afterAll(()=>h.clock(null));
async function setup(fixture:Parameters<ContractHarness['reset']>[0]='F0') {await h.reset(fixture);return h.login();}
async function apply(payload:any,token:string,key=ids.K1){await h.register(payload,token,key);return h.execute(payload,token,key);}

test('TC-IDEM-001/db session has exactly twelve hours and acknowledged revoke prevents reuse',async()=>{
  await h.reset();const session=await h.rpc('start_employee_session',{p_employee_id:ids.A,p_pin:'123456'});
  expect(session.token).toMatch(/^[\w-]{43}$/);expect(Date.parse(session.expiresAt)-Date.parse(session.issuedAt)).toBe(43200000);
  expect(JSON.stringify(session.employee)).not.toContain('hash');
  await h.rpc('revoke_employee_session',{},session.token);
  await expect(h.register(createPayload(),session.token)).rejects.toMatchObject({code:'EMPLOYEE_SESSION_REQUIRED'});
});
test('TC-IDEM-002/db wrong PIN and inactive employee fail while valid PIN has a positive control',async()=>{
  await h.reset();await expect(h.rpc('start_employee_session',{p_employee_id:ids.A,p_pin:'000000'})).rejects.toMatchObject({code:'INVALID_PIN'});
  expect(await h.login()).toHaveLength(43);
  await h.observer(db=>db.query('update public.employees set is_active=false where id=$1',[ids.A]));
  await expect(h.login()).rejects.toMatchObject({code:'INVALID_PIN'});
});
test('TC-IDEM-012/db register writes only one immutable pending operation',async()=>{
  const token=await setup();const before=await h.snapshot();const operation=await h.register(createPayload(),token);
  expect(operation).toMatchObject({status:'pending',initiatedByEmployeeId:ids.A,result:null});expect(Date.parse(operation.registeredAt)).toBe(Date.parse(T));
  expect(Date.parse(operation.expiresAt)-Date.parse(operation.registeredAt)).toBe(86400000);
  const after=await h.snapshot('TC-IDEM-012-after');expect(businessOnly(after)).toEqual(businessOnly(before));expect(after.write_operations).toHaveLength(1);
});
test('TC-IDEM-013/db repeated registration never extends expiry and terminal remains expired',async()=>{
  const token=await setup();const payload=createPayload();const first=await h.register(payload,token);
  await h.clock('2026-09-08T01:00:00Z');expect((await h.register(payload,token)).registeredAt).toBe(first.registeredAt);
  await h.clock('2026-09-09T01:00:00Z');const fresh=await h.login();expect((await h.get(fresh)).status).toBe('expired');
  const terminal=await h.register(payload,fresh);expect(terminal.status).toBe('expired');expect(terminal.expiresAt).toBe(first.expiresAt);
  expect((await h.snapshot()).orders).toHaveLength(0);
});
test('TC-IDEM-014/db first create is sixty thousand and two replays preserve the complete R1',async()=>{
  const token=await setup();const payload=createPayload();const first=await apply(payload,token);
  expect(first.status).toBe('applied');expect(first.result.order).toMatchObject({id:ids.O1,orderNo:1,lockVersion:0,status:'open',total:60000,createdByEmployeeId:ids.A});
  expect(first.result.order.items).toHaveLength(1);expect(first.result.order.items[0]).toMatchObject({quantity:2,baseUnitPrice:30000,lineTotal:60000});
  const before=await h.snapshot();await h.execute(payload,token);const replay=await h.execute(payload,token);
  expect(replay.result).toEqual(first.result);expect(replay.replayCount).toBe('2');
  const after=await h.snapshot('TC-IDEM-014-after');expect(businessOnly(after)).toEqual(businessOnly(before));expect(after.orders).toHaveLength(1);expect(after.payments).toHaveLength(0);expect(after.order_events).toHaveLength(1);expect(after.tables[0].status).toBe('occupied');
});
test('TC-IDEM-015/db JSON object key order is irrelevant to payload equality',async()=>{
  const token=await setup();const payload:any=createPayload();payload.newLines[0].quantity=1;payload.newLines.push({id:ids.L2,menuItemId:ids.M_T,quantity:1,quotedBasePrice:20000,options:[]});
  await h.register(payload,token);const reordered=Object.fromEntries(Object.entries(payload).reverse());const result=await h.execute(reordered,token);
  expect(result.status).toBe('applied');expect(result.result.order.total).toBe(50000);
});
test('TC-IDEM-016/db changing array order is a mismatch and original payload still applies',async()=>{
  const token=await setup();const p:any=createPayload();p.newLines[0].quantity=1;p.newLines.push({id:ids.L2,menuItemId:ids.M_T,quantity:1,quotedBasePrice:20000,options:[]});
  await h.register(p,token);await expect(h.execute({...p,newLines:[...p.newLines].reverse()},token)).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});
  expect((await h.snapshot()).orders).toHaveLength(0);expect((await h.execute(p,token)).result.order.total).toBe(50000);
});
test('TC-IDEM-017/db absent and null notes are separately valid but unequal payloads',async()=>{
  const token=await setup();const p:any=createPayload();await h.register(p,token);const mutated=structuredClone(p);mutated.newLines[0].note=null;
  await expect(h.execute(mutated,token)).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});expect((await h.execute(p,token)).status).toBe('applied');
});
test('TC-IDEM-018/db quantity amount version and kind mutations cannot change a registered split',async()=>{
  const token=await setup('F1');const p=splitPayload();await h.register(p,token);const before=await h.snapshot();
  for(const changed of [{...p,lines:[{...p.lines[0],quantity:2}]},{...p,receivedAmount:60000},{...p,expectedVersion:6},payPayload()])await expect(h.execute(changed,token)).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});
  expect(await h.snapshot()).toEqual(before);expect((await h.execute(p,token)).result.paidOrder.total).toBe(30000);
});
test('TC-IDEM-025/db old two portions retain thirty thousand while new portion is forty thousand',async()=>{
  const token=await setup('F5');const p={...updatePayload(),retainedLines:[{sourceItemId:ids.L1,quantity:2}],newLines:[{id:ids.L2,menuItemId:ids.M_A,quantity:1,quotedBasePrice:40000,options:[{id:ids.OPTION2,optionValueId:ids.Z,quantity:1,quotedPriceDelta:0}]}]};
  const first=await apply(p,token);expect(first.status).toBe('applied');expect(first.result.order).toMatchObject({total:100000,lockVersion:6});
  expect(first.result.order.items).toEqual(expect.arrayContaining([expect.objectContaining({id:ids.L1,quantity:2,baseUnitPrice:30000,lineTotal:60000}),expect.objectContaining({id:ids.L2,quantity:1,baseUnitPrice:40000,lineTotal:40000})]));
  expect(first.result.order.items).toHaveLength(2);const raw=await h.snapshot('TC-IDEM-025-applied');expect(raw.orders.find(o=>o.id===ids.O1)).toMatchObject({total:100000,subtotal:100000,lock_version:6});expect(raw.order_items).toHaveLength(2);expect(raw.order_items.find(i=>i.id===ids.L1)).toMatchObject({quantity:2,unit_price:30000,item_name:'Cà phê cũ'});expect(raw.order_items.find(i=>i.id===ids.L2)).toMatchObject({quantity:1,unit_price:40000,item_name:'Cà phê'});expect(raw.order_item_options).toHaveLength(2);for(const option of raw.order_item_options)expect(option).toMatchObject({price_delta:0,quantity:1});expect(raw.order_events).toHaveLength(1);expect((await h.execute(p,token)).result).toEqual(first.result);expect(businessOnly(await h.snapshot())).toEqual(businessOnly(raw));
});
test('TC-IDEM-028/db decrease keeps original price and removal preserves raw old quantity',async()=>{
  let token=await setup('F5');let result=await apply({...updatePayload(),retainedLines:[{sourceItemId:ids.L1,quantity:1}]},token);expect(result.result.order.total).toBe(30000);
  token=await setup('F5');result=await apply({...updatePayload(),retainedLines:[{sourceItemId:ids.L1,quantity:0}],newLines:[{id:ids.L2,menuItemId:ids.M_A,quantity:1,quotedBasePrice:40000,options:[]}]},token);
  expect(result.result.order.items).toHaveLength(1);expect(result.result.order.total).toBe(40000);
  const raw=await h.snapshot();expect(raw.order_items.find(row=>row.id===ids.L1)).toMatchObject({status:'removed',quantity:2,unit_price:30000});expect(raw.order_item_options).toHaveLength(1);
});
test('TC-IDEM-029/db inactive renamed catalog cannot reprice or rename retained snapshots',async()=>{
  const token=await setup('F3');await h.observer(db=>db.query('update public.menu_items set is_available=false where id=$1',[ids.M_A]));
  const result=await apply({...updatePayload(),retainedLines:[{sourceItemId:ids.L1,quantity:1,note:'ít đá'}]},token);
  expect(result.status).toBe('applied');expect(result.result.order.total).toBe(40000);expect(result.result.order.items[0]).toMatchObject({name:'Cà phê cũ',baseUnitPrice:30000});expect(result.result.order.items[0].options[0]).toMatchObject({name:'Topping cũ',priceDelta:5000,quantity:2});
});
test('TC-IDEM-030/db adding current modifier prices preserves old components and split totals',async()=>{
  const token=await setup('F3');const result=await apply({...updatePayload(),retainedLines:[{sourceItemId:ids.L1,quantity:2}],newLines:[{id:ids.L2,menuItemId:ids.M_A,quantity:1,quotedBasePrice:35000,options:[{id:ids.OPTION2,optionValueId:ids.Q,quantity:2,quotedPriceDelta:7000}]}]},token);
  expect(result.result.order.total).toBe(129000);expect(result.result.order.items.find((row:any)=>row.id===ids.L1).lineTotal).toBe(80000);
  const split={...splitPayload(),expectedVersion:6,receivedAmount:50000,lines:[{orderItemId:ids.L2,quantity:1,splitItemId:ids.L35}]};const paid=await apply(split,token,ids.K2);
  expect(paid.result.paidOrder.total).toBe(49000);expect(paid.result.sourceOrder.total).toBe(80000);expect(paid.result.payment.amount).toBe(49000);
});
test('TC-IDEM-034/db quote increases and decreases both reject durably before a new confirmation',async()=>{
  for(const [current,total]of [[45000,105000],[35000,95000]]) {
    const token=await setup('F5');const payload={...updatePayload(),retainedLines:[{sourceItemId:ids.L1,quantity:2}],newLines:[{id:ids.L2,menuItemId:ids.M_A,quantity:1,quotedBasePrice:40000,options:[]}]};
    await h.observer(db=>db.query('update public.menu_items set price=$2 where id=$1',[ids.M_A,current]));const before=await h.snapshot();const rejected=await apply(payload,token);
    expect(rejected).toMatchObject({status:'rejected',error:{code:'PRICE_CHANGED'}});expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
    expect((await h.execute(payload,token)).error).toEqual(rejected.error);payload.newLines[0].quotedBasePrice=current;expect((await apply(payload,token,ids.K2)).result.order.total).toBe(total);
  }
});
test('TC-IDEM-035/db offsetting base and option changes reject even when new portion total stays equal',async()=>{
  const token=await setup('F3');await h.observer(async db=>{await db.query('update public.menu_items set price=37000 where id=$1',[ids.M_A]);await db.query('update public.option_values set price_delta=6000 where id=$1',[ids.Q]);});
  const p={...updatePayload(),retainedLines:[{sourceItemId:ids.L1,quantity:2}],newLines:[{id:ids.L2,menuItemId:ids.M_A,quantity:1,quotedBasePrice:35000,options:[{id:ids.OPTION2,optionValueId:ids.Q,quantity:2,quotedPriceDelta:7000}]}]};
  expect(await apply(p,token)).toMatchObject({status:'rejected',error:{code:'PRICE_CHANGED'}});expect((await h.snapshot()).orders.find(row=>row.id===ids.O1)?.total).toBe(80000);
});
test('TC-IDEM-037/db void open keeps raw removed history and replays without another event',async()=>{
  const token=await setup('F1');const p={schemaVersion:1,kind:'submit_order_changes',action:'void_open',orderId:ids.O1,expectedVersion:5};const first=await apply(p,token);
  expect(first.result.order).toMatchObject({status:'void',total:0,subtotal:0,lockVersion:6,items:[]});const before=await h.snapshot();expect(before.order_items[0]).toMatchObject({quantity:5,status:'removed'});expect(before.payments).toHaveLength(0);expect(before.tables[0].status).toBe('empty');
  expect((await h.execute(p,token)).result).toEqual(first.result);expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
});
test('TC-IDEM-038/db full cash payment has literal amount change receipt and one immutable result',async()=>{
  const token=await setup('F1');const p=payPayload();const first=await apply(p,token);expect(first.result.payment).toMatchObject({amount:150000,receivedAmount:200000,changeAmount:50000,employeeId:ids.A});expect(first.result.receipt.total).toBe(150000);expect(first.result.order).toMatchObject({status:'paid',lockVersion:6});
  const before=await h.snapshot('TC-IDEM-038-applied');expect(before.payments).toHaveLength(1);expect(before.payments[0]).toMatchObject({id:ids.P1,order_id:ids.O1,store_id:ids.S1,method:'cash',amount:150000,received_amount:200000,change_amount:50000,employee_id:ids.A});expect(before.orders.find(o=>o.id===ids.O1)).toMatchObject({status:'paid',total:150000,subtotal:150000,lock_version:6});expect(before.order_items).toHaveLength(1);expect(before.order_items[0]).toMatchObject({id:ids.L1,order_id:ids.O1,quantity:5,unit_price:30000});expect(before.order_item_options).toHaveLength(0);expect(before.order_events).toHaveLength(1);expect(before.tables[0].status).toBe('empty');expect((await h.execute(p,token)).result).toEqual(first.result);expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
});
test('TC-IDEM-039/db cash amount one below total fails while exact total has zero change',async()=>{
  let token=await setup('F1');let result=await apply({...payPayload(),receivedAmount:149999},token);expect(result).toMatchObject({status:'rejected',error:{code:'PAYMENT_AMOUNT_TOO_LOW'}});expect((await h.snapshot()).payments).toHaveLength(0);
  token=await setup('F1');result=await apply({...payPayload(),receivedAmount:150000},token);expect(result.result.payment.changeAmount).toBe(0);
});
test('TC-IDEM-040/db partial split preserves numbering quantities relations and twenty thousand change',async()=>{
  const token=await setup('F1');const p=splitPayload();const first=await apply(p,token);expect(first.result.sourceOrder).toMatchObject({orderNo:21,lockVersion:6,status:'open',total:120000});expect(first.result.paidOrder).toMatchObject({orderNo:12,lockVersion:0,status:'paid',total:30000});expect(first.result.payment).toMatchObject({orderId:ids.O2,amount:30000,changeAmount:20000});
  const before=await h.snapshot('TC-IDEM-040-applied');expect(before.order_items).toEqual(expect.arrayContaining([expect.objectContaining({id:ids.L1,order_id:ids.O1,quantity:4}),expect.objectContaining({id:ids.L2,order_id:ids.O2,quantity:1})]));expect(before.payments).toHaveLength(1);expect(before.tables[0].status).toBe('occupied');expect((await h.execute(p,token)).result).toEqual(first.result);expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
});
test('TC-IDEM-041/db splitting a complete line moves its original identity',async()=>{
  const token=await setup('F2');const p={...splitPayload(),lines:[{orderItemId:ids.L30,quantity:1,splitItemId:ids.L2}]};const result=await apply(p,token);
  expect(result.result.paidOrder).toMatchObject({orderNo:12,total:30000});expect(result.result.sourceOrder).toMatchObject({orderNo:21,total:35000});expect(result.result.paidOrder.items[0].id).toBe(ids.L30);expect((await h.snapshot()).order_items).toHaveLength(2);
});
test('TC-IDEM-043/db invalid selections cannot create partial effects and a one-unit control works',async()=>{
  for(const lines of [[],[{orderItemId:ids.L1,quantity:5,splitItemId:ids.L2}],[{orderItemId:ids.L1,quantity:6,splitItemId:ids.L2}],[{orderItemId:ids.L2,quantity:1,splitItemId:ids.L30}]]) {
    const token=await setup('F1');const p={...splitPayload(),lines};const before=await h.snapshot();
    if(!lines.length)await expect(h.register(p,token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});
    else expect(await apply(p,token)).toMatchObject({status:'rejected',error:{code:'INVALID_ORDER_ITEMS'}});
    expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
  }
  const token=await setup('F1');expect((await apply(splitPayload(),token)).status).toBe('applied');
});
test('TC-IDEM-046/db void paid retains money history and does not empty a table with another open order',async()=>{
  const token=await setup('F4');const p=voidPayload();const first=await apply(p,token);expect(first.result.order).toMatchObject({status:'void',lockVersion:7,total:150000});const before=await h.snapshot();expect(before.payments).toHaveLength(1);expect(before.tables[0].status).toBe('occupied');expect(before.orders.find(row=>row.id===ids.O3)).toMatchObject({status:'open',total:20000,lock_version:0});expect((await h.execute(p,token)).result).toEqual(first.result);expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
});
test('TC-IDEM-058/db execute get and cancel never implicitly register an unknown key',async()=>{
  const token=await setup();for(const action of [()=>h.execute(createPayload(),token),()=>h.get(token),()=>h.cancel(token)])await expect(action()).rejects.toMatchObject({code:'OPERATION_NOT_FOUND'});
  expect((await h.snapshot()).write_operations).toHaveLength(0);expect((await h.register(createPayload(),token)).status).toBe('pending');expect((await h.snapshot()).orders).toHaveLength(0);
});
test('TC-IDEM-059/db an authorized different employee can cancel and replay does not rewrite that actor',async()=>{
  const token=await setup('F1');const p=payPayload();await h.register(p,token);const b=await h.login('B');const first=await h.cancel(b);expect(first).toMatchObject({status:'cancelled',cancelledByEmployeeId:ids.B});const replay=await h.execute(p,token);expect(replay).toMatchObject({status:'cancelled',replayCount:'1',cancelledByEmployeeId:ids.B});expect((await h.cancel(token)).replayCount).toBe('1');expect((await h.snapshot()).payments).toHaveLength(0);
});
test('TC-IDEM-061/db cancelling at expiry expires only the operation and preserves the open order',async()=>{
  const token=await setup('F1');await h.register(payPayload(),token);const before=await h.snapshot();await h.clock('2026-09-09T00:00:00Z');const fresh=await h.login();expect((await h.cancel(fresh)).status).toBe('expired');expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
});
test('TC-IDEM-066/db a two-day-old open order can be paid with a fresh operation',async()=>{
  let token=await setup('F1');await h.register(payPayload(),token);await h.clock('2026-09-10T00:00:00Z');token=await h.login();expect((await h.get(token)).status).toBe('expired');const result=await apply(payPayload(),token,ids.Knew);expect(result.result.order).toMatchObject({businessDate:'2026-09-08',status:'paid',total:150000});expect(Date.parse(result.result.order.paidAt)).toBe(Date.parse('2026-09-10T00:00:00Z'));expect((await h.snapshot()).payments).toHaveLength(1);
});
test('TC-IDEM-067/db first applied result survives forty-eight hours without being expired',async()=>{
  let token=await setup('F1');const p=payPayload();const first=await apply(p,token);await h.clock('2026-09-10T00:00:00Z');token=await h.login();for(const response of [await h.get(token),await h.register(p,token),await h.cancel(token),await h.execute(p,token)]){expect(response.status).toBe('applied');expect(response.result).toEqual(first.result);expect(response.expiresAt).toBe(first.expiresAt);}expect((await h.snapshot()).payments).toHaveLength(1);
});
