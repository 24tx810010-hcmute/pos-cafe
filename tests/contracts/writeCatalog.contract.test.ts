import { afterAll, expect, test } from 'vitest';
import { ContractHarness, businessOnly } from './harness.ts';
import { createPayload, ids, updatePayload, freshTestId } from './fixtures.ts';
const h=new ContractHarness();afterAll(()=>h.clock(null));
for(const source of ['other_order','other_store','removed','moved','duplicate','omitted','over_quantity'])test(`TC-IDEM-032/db/source=${source} validates provenance against actual persisted rows`,async()=>{
  await h.reset(source==='omitted'?'F2':'F1');const token=await h.login();const p:any=updatePayload();
  if(source==='other_order'||source==='other_store')await h.observer(async db=>{
    if(source==='other_store')await db.query("insert into public.orders(id,store_id,order_type,order_no,business_date,employee_id,total,subtotal) values($1,$2,'takeaway',1,'2026-09-08',$3,30000,30000)",[ids.O2,ids.S2,ids.X]);
    await db.query("insert into public.order_items(id,store_id,order_id,item_name,quantity,unit_price) values($1,$2,$3,'Other source',1,30000)",[ids.L2,source==='other_store'?ids.S2:ids.S1,source==='other_store'?ids.O2:ids.MAX]);
  });
  if(source==='moved')await h.observer(db=>db.query('update public.order_items set order_id=$2 where id=$1',[ids.L1,ids.MAX]));
  if(source==='removed')await h.observer(db=>db.query("update public.order_items set status='removed' where id=$1",[ids.L1]));
  if(['other_order','other_store'].includes(source))p.retainedLines=[{sourceItemId:ids.L2,quantity:1}];
  if(source==='duplicate')p.retainedLines=[{sourceItemId:ids.L1,quantity:1},{sourceItemId:ids.L1,quantity:1}];
  if(source==='omitted')p.retainedLines=[{sourceItemId:ids.L30,quantity:1}];
  if(source==='over_quantity')p.retainedLines[0].quantity=6;
  const before=await h.snapshot();await h.register(p,token);expect(await h.execute(p,token)).toMatchObject({status:'rejected',error:{code:'INVALID_ORDER_ITEMS'}});expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
});
test('TC-IDEM-036/db unavailable catalog and invalid group choices reject but a valid multi group applies',async()=>{
  for(const variant of ['item_inactive','option_deleted','unlinked_group','required_missing','single_multiple','positive_multi']){
    await h.reset();const token=await h.login();const p:any=createPayload();p.newLines[0].quantity=1;
    if(variant==='item_inactive')await h.observer(db=>db.query('update public.menu_items set is_available=false where id=$1',[ids.M_A]));
    if(variant==='option_deleted')await h.observer(db=>db.query('update public.option_values set deleted_at=now() where id=$1',[ids.Q]));
    if(variant==='unlinked_group')await h.observer(db=>db.query('update public.menu_item_option_groups set deleted_at=now() where menu_item_id=$1',[ids.M_A]));
    if(variant==='required_missing')await h.observer(db=>db.query('update public.option_groups set is_required=true where id=$1',[ids.GROUP]));
    if(variant==='single_multiple')await h.observer(db=>db.query("update public.option_groups set select_type='single' where id=$1",[ids.GROUP]));
    if(['option_deleted','unlinked_group','single_multiple','positive_multi'].includes(variant))p.newLines[0].options=[{id:ids.OPTION1,optionValueId:ids.Q,quantity:1,quotedPriceDelta:5000}];
    if(['single_multiple','positive_multi'].includes(variant))p.newLines[0].options.push({id:ids.OPTION2,optionValueId:ids.Z,quantity:1,quotedPriceDelta:0});
    const before=await h.snapshot();await h.register(p,token);const result=await h.execute(p,token);
    if(variant==='positive_multi'){expect(result.status).toBe('applied');expect(result.result.order.total).toBe(35000);expect(result.result.order.items[0].options).toHaveLength(2);}
    else{expect(result).toMatchObject({status:'rejected',error:{code:variant==='item_inactive'?'MENU_ITEM_UNAVAILABLE':'OPTION_VALUE_UNAVAILABLE'}});expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));}
  }
});
test('TC-IDEM-076/db money domain and aggregate overflow never produce an out-of-range result',async()=>{
  for(const money of [0,2147483647,-1,2147483648,0.5,'1']){
    await h.reset();const token=await h.login();const p:any=createPayload();p.newLines[0].quantity=1;p.newLines[0].quotedBasePrice=money;
    if(money===0||money===2147483647){await h.observer(db=>db.query('update public.menu_items set price=$2 where id=$1',[ids.M_A,money]));await h.register(p,token);expect((await h.execute(p,token)).result.order.total).toBe(money);}
    else await expect(h.register(p,token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});
  }
  await h.reset();const token=await h.login();const p:any=createPayload();p.newLines[0].quotedBasePrice=1;await h.observer(db=>db.query('update public.menu_items set price=2147483647 where id=$1',[ids.M_A]));await h.register(p,token);expect(await h.execute(p,token)).toMatchObject({status:'rejected',error:{code:'INVALID_WRITE_REQUEST'}});expect((await h.snapshot()).orders).toHaveLength(0);
});
test('TC-IDEM-077/db line and modifier quantity bounds are tested with zero-priced catalog data',async()=>{
  for(const [kind,values]of [['line',[0,1,999,1000]],['option',[0,1,99,100]]] as const)for(const quantity of values){
    await h.reset();const token=await h.login();await h.observer(async db=>{await db.query('update public.menu_items set price=0 where id=$1',[ids.M_A]);await db.query('update public.option_values set price_delta=0 where id=$1',[ids.Q]);});
    const p:any=createPayload();p.newLines[0].quotedBasePrice=0;p.newLines[0].quantity=kind==='line'?quantity:1;if(kind==='option')p.newLines[0].options=[{id:ids.OPTION1,optionValueId:ids.Q,quantity,quotedPriceDelta:0}];
    if(quantity===0||quantity===(kind==='line'?1000:100))await expect(h.register(p,token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});
    else {await h.register(p,token);expect((await h.execute(p,token)).status).toBe('applied');}
  }
});
for(const array of ['create_lines','options'])for(const count of ['0','1','max','max_plus_1'])test(`TC-IDEM-078/db/array=${array}/count=${count} enforces array boundaries without price interference`,async()=>{
  await h.reset();const token=await h.login();const n=count==='max'?(array==='create_lines'?200:20):count==='max_plus_1'?(array==='create_lines'?201:21):Number(count);const p:any=createPayload();
  if(array==='create_lines')p.newLines=Array.from({length:n},(_,i)=>({id:freshTestId(4000+i),menuItemId:ids.M_A,quantity:1,quotedBasePrice:0,options:[]}));
  else p.newLines[0].options=Array.from({length:n},(_,i)=>({id:freshTestId(5000+i),optionValueId:freshTestId(6000+i),quantity:1,quotedPriceDelta:0}));
  const valid=count!=='max_plus_1'&&!(array==='create_lines'&&count==='0');
  if(valid)expect((await h.register(p,token)).status).toBe('pending');else await expect(h.register(p,token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});
  expect((await h.snapshot()).orders).toHaveLength(0);
});
for(const byteSize of [262144,262145])test(`TC-IDEM-078/db/bytes=${byteSize} measures exact PostgreSQL JSONB text size with a positive boundary`,async()=>{
  await h.reset();const token=await h.login();const p:any=createPayload();p.newLines=Array.from({length:200},(_,i)=>({id:freshTestId(10000+i),menuItemId:freshTestId(20000+i),quantity:1,quotedBasePrice:0,options:Array.from({length:8},(_,j)=>({id:freshTestId(30000+i*8+j),optionValueId:freshTestId(50000+j),quantity:1,quotedPriceDelta:0}))}));
  const initial=await h.observer(async db=>(await db.query('select octet_length($1::jsonb::text) bytes',[JSON.stringify(p)])).rows[0].bytes);expect(initial).toBeLessThanOrEqual(byteSize);
  let remaining=byteSize-initial;for(const line of p.newLines){if(remaining===0)break;const overhead=12;expect(remaining).toBeGreaterThanOrEqual(overhead);const padding=Math.min(500,remaining-overhead);line.note='a'.repeat(padding);remaining-=padding+overhead;}expect(remaining).toBe(0);
  const actual=await h.observer(async db=>(await db.query('select octet_length($1::jsonb::text) bytes',[JSON.stringify(p)])).rows[0].bytes);expect(actual).toBe(byteSize);
  if(byteSize===262144)expect((await h.register(p,token)).status).toBe('pending');else await expect(h.register(p,token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});
});
