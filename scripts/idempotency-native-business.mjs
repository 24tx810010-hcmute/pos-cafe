import pg from 'pg';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const dsn=process.env.IDEM_SQL_CHECK_DSN;
assert(dsn?.startsWith('postgresql://postgres@127.0.0.1:55439/pos_cafe_idem_test_'),'isolated database required');
const db=new pg.Client({connectionString:dsn}); await db.connect();
try {
 assert.equal((await db.query('select engine from private.idempotency_test_environment where singleton')).rows[0]?.engine,'postgres-postgrest','dedicated test marker required');
 const sid=randomUUID(), actor=randomUUID(), category=randomUUID(), menu=randomUUID(), group=randomUUID(), option=randomUUID(), area=randomUUID(), table=randomUUID();
 await db.query("insert into auth.users(id,email) values($1,'sql-check@invalid.local')",[sid]);
 await db.query("insert into stores(id,store_no) values($1,900000+(select count(*) from stores))",[sid]);
 await db.query("insert into store_settings(store_id,display_name,address,bill_footer) values($1,'Quán kiểm','Địa chỉ','Cảm ơn')",[sid]);
 await db.query("insert into employees(id,store_id,name,role,passcode_hash) values($1,$2,'A','admin',extensions.crypt('123456',extensions.gen_salt('bf')))",[actor,sid]);
 await db.query("insert into categories(id,store_id,name) values($1,$2,'Cà phê')",[category,sid]);
 await db.query("insert into menu_items(id,store_id,category_id,name,price) values($1,$2,$3,'Cà phê cũ',30000)",[menu,sid,category]);
 await db.query("insert into option_groups(id,store_id,name,select_type) values($1,$2,'Topping','multi')",[group,sid]);
 await db.query("insert into option_values(id,store_id,option_group_id,name,price_delta) values($1,$2,$3,'Topping cũ',5000)",[option,sid,group]);
 await db.query("insert into menu_item_option_groups(id,store_id,menu_item_id,option_group_id) values($1,$2,$3,$4)",[randomUUID(),sid,menu,group]);
 await db.query("insert into floor_areas(id,store_id,name) values($1,$2,'Tầng 1')",[area,sid]);
 await db.query("insert into tables(id,store_id,area_id,name,pos_x,pos_y,width,height,shape) values($1,$2,$3,'B01',0,0,100,100,'round')",[table,sid,area]);
 let token;
 async function rpc(name,args=[]){
  await db.query('begin');
  try {
   await db.query("set local role authenticated");
   await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.headers',$2,true)",[JSON.stringify({sub:sid,role:'authenticated'}),JSON.stringify(token?{'x-pos-employee-token':token}:{})]);
   const res=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args);
   await db.query('commit'); return res.rows[0].result;
  } catch(error){await db.query('rollback'); throw error;}
 }
 const session=await rpc('start_employee_session',[actor,'123456']); assert.equal(session.ok,true); token=session.token; assert.equal(token.length,43);
 assert.equal((await rpc('get_write_capabilities')).writeProtocolVersion,1);
 const order=randomUUID(), line=randomUUID();
 const create={schemaVersion:1,kind:'submit_order_changes',action:'create',orderId:order,expectedVersion:null,orderType:'dine_in',tableId:table,newLines:[{id:line,menuItemId:menu,quantity:2,quotedBasePrice:30000,options:[{id:randomUUID(),optionValueId:option,quantity:2,quotedPriceDelta:5000}]}]};
 const duplicateLine=structuredClone(create);duplicateLine.newLines.push({...duplicateLine.newLines[0],options:[]});
 assert.equal((await rpc('register_write_operation',[randomUUID(),duplicateLine])).error.code,'INVALID_WRITE_REQUEST');
 const duplicateOption=structuredClone(create);duplicateOption.newLines[0].options.push({...duplicateOption.newLines[0].options[0]});
 assert.equal((await rpc('register_write_operation',[randomUUID(),duplicateOption])).error.code,'INVALID_WRITE_REQUEST');
 const k=randomUUID();
 assert.equal((await rpc('register_write_operation',[k,create])).operation.status,'pending');
 const applied=await rpc('execute_write_operation',[k,create]); assert.equal(applied.operation.status,'applied',JSON.stringify(applied));
 assert.equal(applied.operation.result.order.total,80000); assert.equal(applied.operation.result.order.items[0].unitTotal,40000);
 assert.equal(applied.operation.result.order.createdByEmployeeId,actor);
 const replay=await rpc('execute_write_operation',[k,create]); assert.equal(replay.operation.replayCount,'1'); assert.deepEqual(replay.operation.result,applied.operation.result);
 const mismatch=structuredClone(create);mismatch.newLines[0].note='changed'; assert.equal((await rpc('execute_write_operation',[k,mismatch])).error.code,'IDEMPOTENCY_KEY_REUSED');
 await db.query("update menu_items set name='Cà phê mới',price=40000 where id=$1",[menu]);
 const update={schemaVersion:1,kind:'submit_order_changes',action:'update',orderId:order,expectedVersion:0,retainedLines:[{sourceItemId:line,quantity:2,note:'ít đá'}],newLines:[{id:randomUUID(),menuItemId:menu,quantity:1,quotedBasePrice:40000,options:[]}]};
 const k2=randomUUID();await rpc('register_write_operation',[k2,update]);const updated=await rpc('execute_write_operation',[k2,update]);assert.equal(updated.operation.status,'applied',JSON.stringify(updated));assert.equal(updated.operation.result.order.total,120000);assert.equal(updated.operation.result.order.items[0].name,'Cà phê cũ');assert.equal(updated.operation.result.order.items[0].baseUnitPrice,30000);
 const split={schemaVersion:1,kind:'pay_order_items',orderId:order,paymentId:randomUUID(),newOrderId:randomUUID(),expectedVersion:1,method:'cash',receivedAmount:50000,lines:[{orderItemId:line,quantity:1,splitItemId:randomUUID()}]};
 const k3=randomUUID();await rpc('register_write_operation',[k3,split]);const paid=await rpc('execute_write_operation',[k3,split]);assert.equal(paid.operation.status,'applied',JSON.stringify(paid));assert.equal(paid.operation.result.paidOrder.total,40000);assert.equal(paid.operation.result.sourceOrder.total,80000);assert.equal(paid.operation.result.paidOrder.lockVersion,0);assert.equal(paid.operation.result.payment.changeAmount,10000);assert.equal(paid.operation.result.receipt.lines[0].options[0].quantity,2);
 const full={schemaVersion:1,kind:'pay_order',orderId:order,paymentId:randomUUID(),expectedVersion:2,method:'cash',receivedAmount:100000};const k4=randomUUID();await rpc('register_write_operation',[k4,full]);const fullPaid=await rpc('execute_write_operation',[k4,full]);assert.equal(fullPaid.operation.status,'applied',JSON.stringify(fullPaid));assert.equal(fullPaid.operation.result.receipt.total,80000);
 assert.deepEqual((await rpc('get_payment_receipt',[order])).receipt,fullPaid.operation.result.receipt);
 const trimSet=[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279].map(value=>String.fromCodePoint(value)).join('');
 assert.equal((await db.query('select private.trim_whitespace($1) value',[trimSet+'Ghi chú'+trimSet])).rows[0].value,'Ghi chú');
 for(const reasonNote of ['\t\r\n','\u00a0',trimSet]){
  const invalidVoid={schemaVersion:1,kind:'void_order',orderId:order,expectedVersion:3,reason:'other',reasonNote};const invalidK=randomUUID();
  await rpc('register_write_operation',[invalidK,invalidVoid]);assert.equal((await rpc('execute_write_operation',[invalidK,invalidVoid])).operation.error.code,'VOID_REASON_REQUIRED');
  assert.equal((await db.query('select status from orders where id=$1',[order])).rows[0].status,'paid');
 }
 const voided={schemaVersion:1,kind:'void_order',orderId:order,expectedVersion:3,reason:'other',reasonNote:trimSet+'Trùng đơn'+trimSet};const k5=randomUUID();await rpc('register_write_operation',[k5,voided]);const voidResult=(await rpc('execute_write_operation',[k5,voided])).operation;assert.equal(voidResult.result.order.status,'void');assert.equal(voidResult.result.order.voidReasonNote,'Trùng đơn');assert.equal(voidResult.payload.reasonNote,voided.reasonNote);assert.equal((await rpc('get_payment_receipt',[order])).error.code,'RECEIPT_UNAVAILABLE');
 const page=await rpc('list_write_operations',[null,null,null,null,null,null,2]);assert.equal(page.page.items.length,2);assert(page.page.nextCursor);const next=await rpc('list_write_operations',[null,null,null,null,null,page.page.nextCursor,2]);assert.equal(next.page.items.length,2);
 const cancelled=randomUUID();const cancelledPayload={...create,orderId:randomUUID(),newLines:[{...create.newLines[0],id:randomUUID(),options:[]}]};await rpc('register_write_operation',[cancelled,cancelledPayload]);assert.equal((await rpc('cancel_write_operation',[cancelled])).operation.status,'cancelled');assert.equal((await rpc('execute_write_operation',[cancelled,cancelledPayload])).operation.replayCount,'1');
 const stale=randomUUID();await rpc('register_write_operation',[stale,full]);assert.equal((await rpc('execute_write_operation',[stale,full])).operation.error.code,'ORDER_VERSION_CONFLICT');
 const newPriceK=randomUUID();const pricePayload={...create,orderId:randomUUID(),tableId:null,orderType:'takeaway',newLines:[{id:randomUUID(),menuItemId:menu,quantity:1,quotedBasePrice:30000,options:[]}]};await rpc('register_write_operation',[newPriceK,pricePayload]);const changed=await rpc('execute_write_operation',[newPriceK,pricePayload]);assert.equal(changed.operation.error.code,'PRICE_CHANGED');assert.equal(changed.operation.error.details.proposedNewLinesTotal,40000);
 const counts=(await db.query('select (select count(*) from orders where store_id=$1)::int orders,(select count(*) from payments where store_id=$1)::int payments,(select count(*) from order_events where store_id=$1)::int events',[sid])).rows[0];assert.deepEqual(counts,{orders:2,payments:2,events:5});
 // Each quoted line fits Money, but their SUM does not. Current prices fit;
 // this must reject overflow before reporting PRICE_CHANGED.
 const overflowK=randomUUID();const overflowPayload={...pricePayload,orderId:randomUUID(),newLines:[1,2].map(()=>({id:randomUUID(),menuItemId:menu,quantity:1,quotedBasePrice:1500000000,options:[]}))};
 await rpc('register_write_operation',[overflowK,overflowPayload]);assert.equal((await rpc('execute_write_operation',[overflowK,overflowPayload])).operation.error.code,'INVALID_WRITE_REQUEST');
 assert.deepEqual((await db.query('select (select count(*) from orders where store_id=$1)::int orders,(select count(*) from payments where store_id=$1)::int payments,(select count(*) from order_events where store_id=$1)::int events',[sid])).rows[0],counts);
 console.log(JSON.stringify({status:'PASS',engine:'postgresql-native',checks:['session','capabilities','register_only','duplicate_fresh_ids','create_snapshot','replay','mismatch','retained_price','new_price','split','full_cash','receipt','void','ECMAScript_trim','void_whitespace_rejection','void_note_normalization_preserves_payload','pagination','cancel','OCC','PRICE_CHANGED','raw_counts','quoted_order_overflow'],counts}));
} finally{await db.end();}
