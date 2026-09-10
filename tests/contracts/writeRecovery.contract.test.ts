import { createServer } from 'node:http';
import { afterAll, expect, test } from 'vitest';
import { ContractHarness, businessOnly } from './harness.ts';
import { ids, freshTestId, payPayload, splitPayload, updatePayload, createPayload, voidPayload } from './fixtures.ts';
const h=new ContractHarness();afterAll(()=>h.clock(null));
async function apply(p:any,token:string,key=ids.K1){await h.register(p,token,key);return h.execute(p,token,key);}

test('TC-IDEM-026/db adding one newly priced portion cannot increase the old retained quantity',async()=>{
  await h.reset('F5');const token=await h.login();const p={...updatePayload(),retainedLines:[{sourceItemId:ids.L1,quantity:2}],newLines:[{id:ids.L2,menuItemId:ids.M_A,quantity:1,quotedBasePrice:40000,options:[]}]};
  const result=await apply(p,token);expect(result.result.order.total).toBe(100000);const raw=await h.snapshot();expect(raw.order_items.find(row=>row.id===ids.L1)).toMatchObject({quantity:2,unit_price:30000});expect(raw.order_items.find(row=>row.id===ids.L2)).toMatchObject({quantity:1,unit_price:40000});
});
test('TC-IDEM-027/db swapping notes between different price portions preserves their identities',async()=>{
  await h.reset('F2');const token=await h.login();const result=await apply({...updatePayload(),retainedLines:[{sourceItemId:ids.L30,quantity:1,note:null},{sourceItemId:ids.L35,quantity:1,note:'ít đá'}]},token);
  expect(result.result.order).toMatchObject({total:65000,lockVersion:6});expect(result.result.order.items).toEqual(expect.arrayContaining([expect.objectContaining({id:ids.L30,note:null,baseUnitPrice:30000}),expect.objectContaining({id:ids.L35,note:'ít đá',baseUnitPrice:35000})]));
});
test('TC-IDEM-031/db equal unit totals with different base and modifier components remain two portions',async()=>{
  await h.reset('F2');await h.observer(async db=>{await db.query('update public.orders set subtotal=70000,total=70000 where id=$1',[ids.O1]);await db.query("insert into public.order_item_options(id,store_id,order_item_id,option_value_id,option_name,price_delta,quantity) values($1,$2,$3,$4,'Topping cũ',5000,1)",[ids.OPTION1,ids.S1,ids.L30,ids.Q]);});
  const token=await h.login();const result=await apply({...updatePayload(),retainedLines:[{sourceItemId:ids.L30,quantity:1,note:null},{sourceItemId:ids.L35,quantity:1,note:null}]},token);
  expect(result.result.order.total).toBe(70000);expect(result.result.order.items).toHaveLength(2);expect(result.result.order.items.find((item:any)=>item.id===ids.L30).options).toHaveLength(1);expect(result.result.order.items.find((item:any)=>item.id===ids.L35).options).toHaveLength(0);
});
test('TC-IDEM-048/db stale versions invalid order status and unknown IDs reject without business changes',async()=>{
  for(const [fixture,p,error]of [
    ['F1',{...updatePayload(),expectedVersion:4},'ORDER_VERSION_CONFLICT'],['F1',voidPayload(),'ORDER_VERSION_CONFLICT'],
    ['F4',{...payPayload(),expectedVersion:6},'ORDER_VERSION_CONFLICT'],['F4',{...splitPayload(),expectedVersion:6},'ORDER_VERSION_CONFLICT'],
    ['F4',{...updatePayload(),expectedVersion:6},'ORDER_VERSION_CONFLICT'],['F1',{...payPayload(),orderId:ids.O2},'NOT_FOUND'],
  ] as const){await h.reset(fixture);const token=await h.login();const before=await h.snapshot();expect(await apply(p,token)).toMatchObject({status:'rejected',error:{code:error}});expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));}
});
test('TC-IDEM-049/db all supported void reasons work and other requires an explanation',async()=>{
  for(const reason of ['wrong_order','customer_request','out_of_stock','duplicate','other']){await h.reset('F4');const token=await h.login();const p:any={...voidPayload(),reason};if(reason==='other')p.reasonNote='Nhập nhầm';expect((await apply(p,token)).status).toBe('applied');}
  await h.reset('F4');const token=await h.login();await expect(h.register({...voidPayload(),reason:'invalid'},token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});
});
test('TC-IDEM-050/db full and split historical receipts preserve option quantity and original names',async()=>{
  for(const kind of ['full','split']){await h.reset('F7');const token=await h.login();const p=kind==='full'?{...payPayload(),receivedAmount:100000}:{...splitPayload(),receivedAmount:50000};const result=await apply(p,token);
    expect(result.result.receipt).toMatchObject({total:kind==='full'?80000:40000,changeAmount:kind==='full'?20000:10000});expect(result.result.receipt.lines[0]).toMatchObject({name:'Cà phê cũ',unitTotal:40000});expect(result.result.receipt.lines[0].options[0]).toMatchObject({name:'Topping cũ',priceDelta:5000,quantity:2});
    await h.observer(async db=>{await db.query("update public.menu_items set name='NEW',price=90000 where id=$1",[ids.M_A]);await db.query("update public.option_values set name='NEW OPTION',price_delta=10000 where id=$1",[ids.Q]);});
    expect((await h.execute(p,token)).result).toEqual(result.result);const historical=await h.rpc('get_payment_receipt',{p_order_id:kind==='full'?ids.O1:ids.O2},token);expect(historical.receipt).toEqual(result.result.receipt);
  }
});

async function loseTerminalAck(token:string,endpoint:string,args:Record<string,unknown>,terminal:string){
  let observedCommit=false;let serverFailure:unknown;
  const server=createServer(async(request,response)=>{
    try {
      const upstream=await h.rpcRaw(endpoint,args,token);expect(upstream.status).toBe(200);
      // A new observer session confirms commit before the client transport is broken.
      const raw=await h.snapshot();expect(raw.write_operations.find(row=>row.operation_id===ids.K1)?.status).toBe(terminal);observedCommit=true;
      response.destroy();
    }catch(error){serverFailure=error;response.destroy();}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const address=server.address();if(!address||typeof address==='string')throw new Error('INVALID_TEST_PROXY_ADDRESS');await expect(fetch(`http://127.0.0.1:${address.port}/lost-ack`,{method:'POST',signal:AbortSignal.timeout(30000)})).rejects.toThrow();}
  finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  if(serverFailure)throw serverFailure;expect(observedCommit).toBe(true);
}
test('TC-IDEM-052/db losing the HTTP reply after an observed payment commit still recovers exactly one payment',async()=>{
  await h.reset('F1');const token=await h.login();const p=payPayload();await h.register(p,token);
  await loseTerminalAck(token,'execute_write_operation',{p_operation_id:ids.K1,p_payload:p},'applied');const first=await h.get(token);expect(first.result.payment.amount).toBe(150000);expect((await h.execute(p,token)).result).toEqual(first.result);expect((await h.snapshot()).payments).toHaveLength(1);
});
for(const terminal of ['applied','rejected','cancelled','expired'])test(`TC-IDEM-068/db/terminal=${terminal} survives an actual lost reply and a forty-eight-hour recovery`,async()=>{
  await h.reset('F1');let token=await h.login();const p=terminal==='rejected'?{...payPayload(),receivedAmount:1}:payPayload();await h.register(p,token);
  if(terminal==='expired'){await h.clock('2026-09-09T00:00:00Z');token=await h.login();}
  await loseTerminalAck(token,terminal==='cancelled'?'cancel_write_operation':'execute_write_operation',terminal==='cancelled'?{p_operation_id:ids.K1}:{p_operation_id:ids.K1,p_payload:p},terminal);
  const first=await h.get(token);const before=await h.snapshot();await h.clock('2026-09-11T00:00:00Z');token=await h.login();const result=await h.execute(p,token);expect(result.status).toBe(terminal);expect(result.result).toEqual(first.result);expect(result.error).toEqual(first.error);expect(result.decidedAt).toBe(first.decidedAt);expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
});
test('TC-IDEM-055/db server recovery distinguishes applied and pending split operations without local data',async()=>{
  await h.reset('F1');await h.observer(async db=>{await db.query('delete from public.orders where id=$1',[ids.MAX]);await db.query('update public.orders set order_no=7 where id=$1',[ids.O1]);});const a=await h.login();const first=await apply(splitPayload(),a);
  const secondPayload={...splitPayload(),expectedVersion:6,newOrderId:ids.O3,paymentId:freshTestId(302),lines:[{orderItemId:ids.L1,quantity:1,splitItemId:ids.L35}]};await h.register(secondPayload,a,ids.K2);
  const b=await h.login('B');const list=await h.rpc('list_write_operations',{p_limit:50},b);expect(list.page.items).toHaveLength(2);expect((await h.get(b)).result).toEqual(first.result);const second=await h.execute(secondPayload,b,ids.K2);expect(second.result.sourceOrder).toMatchObject({total:90000,lockVersion:7,orderNo:9});expect(second.result.paidOrder.orderNo).toBe(8);const raw=await h.snapshot();expect(raw.payments).toHaveLength(2);expect(raw.payments.map(row=>row.amount)).toEqual([30000,30000]);expect(raw.write_operations).toHaveLength(2);
});
test('TC-IDEM-056/db creator modifier initiator executor and payment actor stay independently attributed',async()=>{
  await h.reset('F1');const e=await h.login('E');await apply(updatePayload(),e);const a=await h.login();const p={...payPayload(),expectedVersion:6};await h.register(p,a,ids.K2);const b=await h.login('B');const first=await h.execute(p,b,ids.K2);expect(first).toMatchObject({initiatedByEmployeeId:ids.A,executedByEmployeeId:ids.B});expect(first.result.order).toMatchObject({createdByEmployeeId:ids.A,lastModifiedByEmployeeId:ids.E});expect(first.result.payment.employeeId).toBe(ids.B);
  await h.observer(db=>db.query('update public.employees set permission_overrides=$2 where id=$1',[ids.C,{grants:['payment.take'],denies:['order.create','order.update','order.voidOpen','order.voidPaid']}]));const c=await h.login('C');const replay=await h.execute(p,c,ids.K2);expect(replay.result).toEqual(first.result);expect(replay.executedByEmployeeId).toBe(ids.B);
});
test('TC-IDEM-057/db stable cursor pagination returns all one-hundred-one tied timestamps without duplicates',async()=>{
  await h.reset();let token=await h.login();const keys:string[]=[];for(let i=0;i<101;i++){const key=freshTestId(2000+i);keys.push(key);await h.register(i%2?payPayload():{...createPayload(),orderId:freshTestId(3000+i)},token,key);if(i===0)await h.cancel(token,key);}
  const x=await h.login('X');await h.rpc('register_write_operation',{p_operation_id:ids.K1,p_payload:createPayload()},x,process.env.IDEM_STORE_S2_JWT);
  const first=(await h.rpc('list_write_operations',{p_limit:50},token)).page;const second=(await h.rpc('list_write_operations',{p_limit:50,p_cursor:first.nextCursor},token)).page;const third=(await h.rpc('list_write_operations',{p_limit:50,p_cursor:second.nextCursor},token)).page;
  expect([first.items.length,second.items.length,third.items.length]).toEqual([50,50,1]);expect(new Set([...first.items,...second.items,...third.items].map(row=>row.operationId))).toEqual(new Set(keys));expect(third.nextCursor).toBeNull();const b=await h.login('B');const permitted=(await h.rpc('list_write_operations',{p_limit:100},b)).page.items;expect(permitted).toHaveLength(50);expect(permitted.every((row:any)=>row.kind==='pay_order')).toBe(true);
  const filtered=(await h.rpc('list_write_operations',{p_limit:100,p_order_id:ids.O1,p_kinds:['pay_order'],p_statuses:['pending'],p_registered_from:'2026-09-08T00:00:00Z',p_registered_to:'2026-09-08T00:00:00Z'},token)).page.items;expect(filtered).toHaveLength(50);expect((await h.rpc('list_write_operations',{p_registered_from:'2026-09-08T00:00:00.001Z'},token)).page.items).toHaveLength(0);await expect(h.rpc('list_write_operations',{p_cursor:'bad cursor'},token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});
  await h.clock('2026-09-09T00:00:00Z');token=await h.login();const expired=(await h.rpc('list_write_operations',{p_limit:100,p_statuses:['expired']},token)).page.items;expect(expired).toHaveLength(100);expect(expired.every((row:any)=>row.status==='expired')).toBe(true);expect((await h.rpc('list_write_operations',{p_statuses:['cancelled']},token)).page.items.map((row:any)=>row.operationId)).toEqual([keys[0]]);expect((await h.snapshot()).orders).toHaveLength(0);
});
test('TC-IDEM-080/db invalid list limits fail and a max lock version cannot wrap or poison an operation',async()=>{
  await h.reset('F1');const token=await h.login();for(const limit of [0,101])await expect(h.rpc('list_write_operations',{p_limit:limit},token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});for(const limit of [1,100])expect((await h.rpc('list_write_operations',{p_limit:limit},token)).ok).toBe(true);
  await h.observer(db=>db.query('update public.orders set lock_version=2147483647 where id=$1',[ids.O1]));const before=await h.snapshot();const result=await apply({...updatePayload(),expectedVersion:2147483647},token);expect(result).toMatchObject({status:'rejected',error:{code:'INVALID_WRITE_REQUEST'}});expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
});
test('TC-IDEM-081/db only cash integer amounts register and valid exact cash remains payable',async()=>{
  for(const mutation of [{method:'bank_transfer'},{method:'qr'},{method:'other'},{method:null},{receivedAmount:null},{receivedAmount:-1},{receivedAmount:0.5},{receivedAmount:'150000'}]){await h.reset('F1');const token=await h.login();await expect(h.register({...payPayload(),...mutation},token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});expect((await h.snapshot()).write_operations).toHaveLength(0);}
  await h.reset('F1');const token=await h.login();expect((await apply({...payPayload(),receivedAmount:150000},token)).status).toBe('applied');
});
test('TC-IDEM-083/db historical split R1 stays paid after its child is voided and source is edited',async()=>{
  await h.reset('F1');const token=await h.login();const first=await apply(splitPayload(),token);await apply({...updatePayload(),expectedVersion:6,retainedLines:[{sourceItemId:ids.L1,quantity:4,note:'new note'}]},token,ids.K2);await apply({...voidPayload(),orderId:ids.O2,expectedVersion:0},token,ids.Knew);expect((await h.get(token)).result).toEqual(first.result);const raw=await h.snapshot();expect(raw.orders.find(row=>row.id===ids.O2)?.status).toBe('void');expect(raw.orders.find(row=>row.id===ids.O1)?.lock_version).toBe(7);expect(raw.payments).toHaveLength(1);await expect(h.rpc('get_payment_receipt',{p_order_id:ids.O2},token)).rejects.toMatchObject({code:'RECEIPT_UNAVAILABLE'});
});
test('TC-IDEM-090/db persisted request result errors and list never contain employee credentials',async()=>{
  await h.reset('F1');const a=await h.login();await h.register(payPayload(),a);const b=await h.login('B');const first=await h.execute(payPayload(),b);const list=await h.rpc('list_write_operations',{},b);const serialized=JSON.stringify({first,list,raw:await h.snapshot()});for(const forbidden of [a,b,'passcode_hash','token_hash','123456','111111'])expect(serialized).not.toContain(forbidden);expect(first).toMatchObject({initiatedByEmployeeId:ids.A,executedByEmployeeId:ids.B});
});
test('TC-IDEM-091/db missing deleted or cross-store table IDs reject without creating an order',async()=>{
  for(const variant of ['missing','deleted','cross_store']){await h.reset();const token=await h.login();const p=createPayload();if(variant==='deleted')await h.observer(db=>db.query('update public.tables set deleted_at=now() where id=$1',[ids.B01]));else p.tableId=ids.B02;
    if(variant==='cross_store')await h.observer(async db=>{await db.query("insert into public.floor_areas(id,store_id,name) values($1,$2,'S2')",[freshTestId(704),ids.S2]);await db.query("insert into public.tables(id,store_id,area_id,name,pos_x,pos_y,width,height,shape) values($1,$2,$3,'S2 table',0,0,100,100,'square')",[ids.B02,ids.S2,freshTestId(704)]);});
    const before=await h.snapshot();expect(await apply(p,token)).toMatchObject({status:'rejected',error:{code:'TABLE_NOT_FOUND'}});expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));}
  await h.reset();const token=await h.login();expect((await apply(createPayload(),token)).status).toBe('applied');
});
test('TC-IDEM-092/db partial underpayment and zero-total selections cannot create a cash payment',async()=>{
  await h.reset('F1');let token=await h.login();expect(await apply({...splitPayload(),receivedAmount:29999},token)).toMatchObject({status:'rejected',error:{code:'PAYMENT_AMOUNT_TOO_LOW'}});expect((await h.snapshot()).payments).toHaveLength(0);
  await h.reset('F1');token=await h.login();expect((await apply({...splitPayload(),receivedAmount:30000},token)).result.payment.changeAmount).toBe(0);
  await h.reset('F1');await h.observer(async db=>{await db.query('update public.orders set total=0,subtotal=0 where id=$1',[ids.O1]);await db.query('update public.order_items set unit_price=0 where id=$1',[ids.L1]);});token=await h.login();expect(await apply({...payPayload(),receivedAmount:0},token)).toMatchObject({status:'rejected',error:{code:'INVALID_ORDER_ITEMS'}});expect((await h.snapshot()).payments).toHaveLength(0);
  await h.reset('F1');await h.observer(async db=>{await db.query('update public.orders set total=20000,subtotal=20000 where id=$1',[ids.O1]);await db.query('update public.order_items set unit_price=0,quantity=1 where id=$1',[ids.L1]);await db.query("insert into public.order_items(id,store_id,order_id,menu_item_id,item_name,quantity,unit_price) values($1,$2,$3,$4,'Trà',1,20000)",[ids.L30,ids.S1,ids.O1,ids.M_T]);});token=await h.login();const before=await h.snapshot();expect(await apply({...splitPayload(),receivedAmount:0},token)).toMatchObject({status:'rejected',error:{code:'INVALID_ORDER_ITEMS'}});expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));const paid=await apply({...payPayload(),receivedAmount:20000},token,ids.K2);expect(paid.status).toBe('applied');const raw=await h.snapshot('TC-IDEM-092-mixed-positive');expect(raw.payments).toHaveLength(1);expect(raw.payments[0]).toMatchObject({amount:20000,received_amount:20000,change_amount:0});expect(raw.orders.find(o=>o.id===ids.O1)).toMatchObject({total:20000,status:'paid'});expect(raw.order_items).toHaveLength(2);
});
