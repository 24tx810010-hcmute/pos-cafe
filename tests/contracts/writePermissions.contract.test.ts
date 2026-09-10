import { afterAll, expect, test } from 'vitest';
import { ContractHarness, businessOnly } from './harness.ts';
import { createPayload, ids, payPayload, splitPayload, updatePayload, voidPayload } from './fixtures.ts';
const h=new ContractHarness();afterAll(()=>h.clock(null));
const permission:Record<string,string>={create:'order.create',update:'order.update',void_open:'order.voidOpen',pay:'payment.take',split:'payment.take',void_paid:'order.voidPaid'};
function payload(action:string){return action==='create'?createPayload():action==='update'?updatePayload():action==='pay'?payPayload():action==='split'?splitPayload():action==='void_paid'?voidPayload():{schemaVersion:1,kind:'submit_order_changes',action:'void_open',orderId:ids.O1,expectedVersion:5};}
async function resetAction(action:string){await h.reset(action==='create'?'F0':action==='void_paid'?'F4':'F1');}

for(const action of Object.keys(permission))for(const endpoint of ['register','execute','get','list','cancel'])for(const actor of ['A','B','C'] as const){
  test(`TC-IDEM-006/db/action=${action}/endpoint=${endpoint}/actor=${actor} checks current server permission for the stored action`,async()=>{
    await resetAction(action);const a=await h.login();const p=payload(action);if(endpoint!=='register')await h.register(p,a);const caller=actor==='A'?a:await h.login(actor);const allowed=actor==='A'||(actor==='B'&&['pay','split'].includes(action));const before=await h.snapshot();
    if(endpoint==='list'){
      const result=await h.rpc('list_write_operations',{p_limit:50},caller);expect(result.page.items).toHaveLength(allowed?1:0);
    }else{
      const call=()=>endpoint==='register'?h.register(p,caller):endpoint==='execute'?h.execute(p,caller):endpoint==='get'?h.get(caller):h.cancel(caller);
      if(allowed){const result=await call();expect(result.status).toBe(endpoint==='execute'?'applied':endpoint==='cancel'?'cancelled':'pending');}
      else await expect(call()).rejects.toMatchObject({code:'FORBIDDEN'});
    }
    if(!allowed)expect(await h.snapshot()).toEqual(before);
  });
}
for(const action of Object.keys(permission))for(const override of ['grant','deny_both'])test(`TC-IDEM-006/db/action=${action}/override=${override} gives an explicit deny precedence over a grant`,async()=>{
  await resetAction(action);const p=payload(action);const a=await h.login();await h.register(p,a);
  const all=Object.values(permission);await h.observer(db=>db.query('update public.employees set permission_overrides=$2 where id=$1',[ids.C,{grants:[permission[action]],denies:override==='grant'?all.filter(value=>value!==permission[action]):all}]));
  const c=await h.login('C');if(override==='grant')expect((await h.execute(p,c)).status).toBe('applied');else await expect(h.execute(p,c)).rejects.toMatchObject({code:'FORBIDDEN'});
});

test('TC-IDEM-003/db missing forged and other-store employee tokens cannot register a write',async()=>{
  await h.reset('F1');const x=await h.login('X');for(const token of [undefined,'a'.repeat(43),x])await expect(h.rpc('register_write_operation',{p_operation_id:ids.K1,p_payload:payPayload()},token)).rejects.toMatchObject({code:'EMPLOYEE_SESSION_REQUIRED'});
  expect((await h.snapshot()).write_operations).toHaveLength(0);
});
test('TC-IDEM-004/db absent JWT returns auth required and invalid JWT is rejected at PostgREST',async()=>{
  await h.reset();const token=await h.login();await expect(h.rpc('get_write_capabilities',{},token,'')).rejects.toMatchObject({code:'AUTH_REQUIRED'});
  const response=await h.rpcRaw('get_write_capabilities',{},token,'invalid.jwt.signature');expect(response.status).toBe(401);expect((await h.snapshot()).write_operations).toHaveLength(0);
});
test('TC-IDEM-008/db store authenticated role cannot promote itself or read a PIN hash',async()=>{
  await h.reset();const state=await h.observer(async db=>{
    const before=(await db.query('select id,role,passcode_hash,is_active,permission_overrides from public.employees order by id')).rows;
    const privileges=await db.query("select has_column_privilege('authenticated','public.employees','passcode_hash','SELECT') as read_hash,has_table_privilege('authenticated','public.employees','INSERT') as insert_employee,has_column_privilege('authenticated','public.employees','role','UPDATE') as update_role");
    const safe=await db.query("select has_column_privilege('authenticated','public.employees','name','SELECT') as name_read");
    return {before,privileges:privileges.rows[0],safe:safe.rows[0]};
  });
  expect(state.privileges.read_hash).toBe(false);expect(state.safe.name_read).toBe(true);
  const c=await h.login('C');
  for(const mutation of [{role:'admin'},{permission_overrides:{grants:['payment.take'],denies:[]}},{is_active:true},{passcode_hash:'forged-hash'}]) {
    const response=await fetch(`${h.env.apiUrl}/rest/v1/employees?id=eq.${ids.C}`,{method:'PATCH',headers:{apikey:h.env.anonKey,Authorization:`Bearer ${h.env.storeJwt}`,'x-pos-employee-token':c,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(mutation)});
    expect([204,403]).toContain(response.status);
  }
  const rest=await fetch(`${h.env.apiUrl}/rest/v1/employees?select=*`,{headers:{apikey:h.env.anonKey,Authorization:`Bearer ${h.env.storeJwt}`}});expect(rest.status).toBe(403);
  expect((await h.observer(db=>db.query('select id,role,passcode_hash,is_active,permission_overrides from public.employees order by id'))).rows).toEqual(state.before);
});
test('TC-IDEM-009/db inventory covers every old overload and financial write privilege',async()=>{
  await h.reset('F1');const inventory=await h.observer(async db=>({
    legacy:(await db.query("select p.oid::regprocedure::text signature,has_function_privilege('authenticated',p.oid,'EXECUTE') as allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any($1::text[])",[['submit_order_changes','pay_order','pay_order_items','void_order']])).rows,
    private:(await db.query("select proname,has_function_privilege('authenticated',p.oid,'EXECUTE') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and proname<>'is_verified_admin'")).rows,
    financial:(await db.query("select c.relname,has_table_privilege('authenticated',c.oid,'INSERT') or has_table_privilege('authenticated',c.oid,'UPDATE') or has_table_privilege('authenticated',c.oid,'DELETE') allowed from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1::text[])",[['orders','order_items','order_item_options','payments','write_operations','order_events']])).rows,
  }));
  expect(inventory.legacy.length).toBeGreaterThanOrEqual(4);expect(inventory.financial).toHaveLength(6);expect(inventory.private.length).toBeGreaterThan(10);
  for(const row of [...inventory.legacy,...inventory.private,...inventory.financial])expect(row.allowed,JSON.stringify({name:row.signature??row.proname??row.relname})).toBe(false);
});
test('TC-IDEM-010/db parent delete and table status mutation are denied and other-store keys stay hidden',async()=>{
  await h.reset();const token=await h.login();await h.register(createPayload(),token);
  const x=await h.login('X');await expect(h.rpc('get_write_operation',{p_operation_id:ids.K1},x,process.env.IDEM_STORE_S2_JWT)).rejects.toMatchObject({code:'OPERATION_NOT_FOUND'});
  const checks=await h.observer(db=>db.query("select has_table_privilege('authenticated','public.stores','DELETE') parent_delete,has_column_privilege('authenticated','public.tables','status','UPDATE') table_status,has_column_privilege('authenticated','public.tables','store_id','UPDATE') tenant_update"));expect(checks.rows[0]).toEqual({parent_delete:false,table_status:false,tenant_update:false});
});
test('TC-IDEM-033/db historical retained price menu modifier name and ID cannot be supplied through JSON',async()=>{
  for(const field of ['price','menuItemId','options','name','id']){
    await h.reset('F1');const token=await h.login();const p:any=updatePayload();p.retainedLines[0][field]=field==='price'?0:field==='options'?[]:'tamper';
    await expect(h.register(p,token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});expect((await h.snapshot()).write_operations).toHaveLength(0);
  }
});
test('TC-IDEM-093/db unauthorized and mismatched requests cannot mutate any of the four terminal results',async()=>{
  for(const terminal of ['applied','rejected','cancelled','expired']){
    await h.reset('F1');let a=await h.login();const p=terminal==='rejected'?{...payPayload(),receivedAmount:1}:payPayload();await h.register(p,a);
    if(terminal==='cancelled')await h.cancel(a);else if(terminal==='expired'){await h.clock('2026-09-09T00:00:00Z');a=await h.login();await h.get(a);}else await h.execute(p,a);
    const before=await h.snapshot();expect(before.write_operations[0].status).toBe(terminal);const c=await h.login('C');
    for(const call of [()=>h.execute(p,c),()=>h.get(c),()=>h.cancel(c)])await expect(call()).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(h.execute({...p,receivedAmount:300000},a)).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});expect(await h.snapshot(`TC-IDEM-093-${terminal}`)).toEqual(before);
  }
});

test('TC-IDEM-075/db rejects persisted UUID collisions across both stores and repeated fresh IDs before registration',async()=>{
  for(const scope of ['same_store','other_store'])for(const entity of ['order','child','payment','line','option','split_item']){
    await h.reset('F1');const a=await h.login();const store=scope==='same_store'?ids.S1:ids.S2;const owner=scope==='same_store'?ids.A:ids.X;
    const collision='00000000-0000-4000-8000-000000002711',otherOrder='00000000-0000-4000-8000-000000002712',otherLine='00000000-0000-4000-8000-000000002713';
    await h.observer(async db=>{
      await db.query("insert into public.orders(id,store_id,order_type,order_no,business_date,employee_id,total,subtotal) values($1,$2,'takeaway',99,'2026-09-08',$3,30000,30000)",[entity==='order'||entity==='child'?collision:otherOrder,store,owner]);
      if(entity==='payment')await db.query("insert into public.payments(id,store_id,order_id,employee_id,method,amount,received_amount,change_amount) values($1,$2,$3,$4,'cash',30000,30000,0)",[collision,store,otherOrder,owner]);
      if(['line','option','split_item'].includes(entity))await db.query("insert into public.order_items(id,store_id,order_id,item_name,quantity,unit_price) values($1,$2,$3,'Other persisted item',1,30000)",[entity==='option'?otherLine:collision,store,otherOrder]);
      if(entity==='option')await db.query("insert into public.order_item_options(id,store_id,order_item_id,option_name,price_delta,quantity) values($1,$2,$3,'Old option',0,1)",[collision,store,otherLine]);
    });
    let p:any;if(['child','split_item'].includes(entity)){p=splitPayload();if(entity==='child')p.newOrderId=collision;else p.lines[0].splitItemId=collision;}
    else if(entity==='payment'){p=payPayload();p.paymentId=collision;}
    else{p=createPayload();p.orderId=entity==='order'?collision:ids.O2;p.orderType='takeaway';p.tableId=null;p.newLines[0].id=entity==='line'?collision:ids.L2;if(entity==='option')p.newLines[0].options=[{id:collision,optionValueId:ids.Z,quantity:1,quotedPriceDelta:0}];}
    const before=await h.snapshot();await h.register(p,a);expect(await h.execute(p,a)).toMatchObject({status:'rejected',error:{code:'ENTITY_ID_CONFLICT'}});expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
  }
  for(const entity of ['line','option','split_item']){
    await h.reset('F1');const a=await h.login();const p:any=entity==='split_item'?splitPayload():createPayload();
    if(entity==='line')p.newLines.push(structuredClone(p.newLines[0]));
    if(entity==='option')p.newLines[0].options=[{id:ids.OPTION1,optionValueId:ids.Q,quantity:1,quotedPriceDelta:5000},{id:ids.OPTION1,optionValueId:ids.Z,quantity:1,quotedPriceDelta:0}];
    if(entity==='split_item')p.lines.push({orderItemId:ids.L30,quantity:1,splitItemId:ids.L2});
    const before=await h.snapshot();await expect(h.register(p,a)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});expect(await h.snapshot()).toEqual(before);
  }
});
