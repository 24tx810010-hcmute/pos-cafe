import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dsn=process.env.IDEM_SQL_CHECK_DSN;assert(dsn?.includes('@127.0.0.1:55439/pos_cafe_idem_test_'));
const db=new pg.Client({connectionString:dsn});await db.connect();
const conns=[];const fresh=async()=>{const c=new pg.Client({connectionString:dsn});await c.connect();conns.push(c);return c;};
const sid=randomUUID(),actor=randomUUID(),menu=randomUUID(),category=randomUUID();let token;
async function tx(c){await c.query('begin');await c.query('set local role authenticated');await c.query("select set_config('request.jwt.claims',$1,true),set_config('request.headers',$2,true)",[JSON.stringify({sub:sid,role:'authenticated'}),JSON.stringify(token?{'x-pos-employee-token':token}:{})]);}
async function rpc(name,args=[],c=db){await tx(c);try{const out=(await c.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;await c.query('commit');return out;}catch(e){await c.query('rollback');throw e;}}
async function clock(at){await db.query('update private.sql_check_clock set at=$1',[at]);}
async function login(){const s=await rpc('start_employee_session',[actor,'123456']);assert(s.ok);token=s.token;}
async function order(){const k=randomUUID(),oid=randomUUID();const p={schemaVersion:1,kind:'submit_order_changes',action:'create',orderId:oid,expectedVersion:null,orderType:'takeaway',tableId:null,newLines:[{id:randomUUID(),menuItemId:menu,quantity:2,quotedBasePrice:30000,options:[]}]};await rpc('register_write_operation',[k,p]);const r=await rpc('execute_write_operation',[k,p]);assert.equal(r.operation.status,'applied',JSON.stringify(r));return oid;}
async function pendingPay(oid){const k=randomUUID(),p={schemaVersion:1,kind:'pay_order',orderId:oid,paymentId:randomUUID(),expectedVersion:0,method:'cash',receivedAmount:100000};await rpc('register_write_operation',[k,p]);return[k,p];}
async function raw(oid){return(await db.query("select (select row_to_json(o) from orders o where id=$1) o,(select coalesce(jsonb_agg(i order by id),'[]') from order_items i where order_id=$1) i,(select coalesce(jsonb_agg(p order by id),'[]') from payments p where order_id=$1) p,(select coalesce(jsonb_agg(e order by id),'[]') from order_events e where source_order_id=$1) e",[oid])).rows[0];}
async function waitBlocked(pid,blocker){const until=Date.now()+5000;while(Date.now()<until){const v=(await db.query('select $2::integer=any(pg_blocking_pids($1)) blocked',[pid,blocker])).rows[0].blocked;if(v)return;await new Promise(r=>setTimeout(r,10));}throw new Error('barrier not observed');}
try{
 assert.equal((await db.query('select engine from private.idempotency_test_environment where singleton')).rows[0]?.engine,'postgres-postgrest','dedicated test marker required');
 assert.equal((await db.query('select count(*)::integer n from pg_stat_activity where datname=current_database()')).rows[0].n,1,'clock hooks require exclusive use of this dedicated test database');
 await db.query("create table private.sql_check_clock(at timestamptz not null);insert into private.sql_check_clock values('2026-09-08T00:00:00Z');revoke all on private.sql_check_clock from public,anon,authenticated;create or replace function private.write_clock() returns timestamptz language sql volatile set search_path=pg_catalog as $$ select at from private.sql_check_clock $$");
 await db.query("insert into auth.users(id,email) values($1,'atomicity-check@invalid.local')",[sid]);await db.query('insert into stores(id,store_no) values($1,920000+(select count(*) from stores))',[sid]);await db.query('insert into store_settings(store_id) values($1)',[sid]);await db.query("insert into employees(id,store_id,name,role,passcode_hash) values($1,$2,'A','admin',extensions.crypt('123456',extensions.gen_salt('bf')))",[actor,sid]);await db.query("insert into categories(id,store_id,name) values($1,$2,'Menu')",[category,sid]);await db.query("insert into menu_items(id,store_id,category_id,name,price) values($1,$2,$3,'A',30000)",[menu,sid,category]);
 for(const [at,status] of [['2026-09-08T23:59:59.999Z','applied'],['2026-09-09T00:00:00.000Z','expired'],['2026-09-09T00:00:00.001Z','expired']]){
  await clock('2026-09-08T00:00:00Z');await login();const oid=await order();const [k,p]=await pendingPay(oid);const before=await raw(oid);await clock(at);await login();const r=await rpc('execute_write_operation',[k,p]);assert.equal(r.operation.status,status,JSON.stringify(r));if(status==='expired')assert.deepEqual(await raw(oid),before);
 }
 await clock('2026-09-08T00:00:00Z');await login();const oid=await order();const [k,p]=await pendingPay(oid);const before=await raw(oid);await clock('2026-09-08T23:59:59Z');await login();
 const block=await fresh(),worker=await fresh();const workerPid=(await worker.query('select pg_backend_pid() p')).rows[0].p,blockPid=(await block.query('select pg_backend_pid() p')).rows[0].p;
 await block.query('begin');await block.query('select id from orders where id=$1 for update',[oid]);const waiting=rpc('execute_write_operation',[k,p],worker);await waitBlocked(workerPid,blockPid);await clock('2026-09-09T00:00:00Z');await block.query('commit');assert.equal((await waiting).operation.status,'expired');assert.deepEqual(await raw(oid),before);
 // New K pays an old open order after 48 hours; only pending commands expire.
 await clock('2026-09-10T00:00:00Z');await login();const [knew,pnew]=await pendingPay(oid);const paid=await rpc('execute_write_operation',[knew,pnew]);assert.equal(paid.operation.status,'applied');assert.equal(paid.operation.result.order.businessDate,'2026-09-08');assert.equal(new Date(paid.operation.result.receipt.paidAt).toISOString(),'2026-09-10T00:00:00.000Z');
 // Terminal retention and replay, including counter separate from immutable R1.
 await clock('2026-09-12T00:00:00Z');await login();const replay=await rpc('execute_write_operation',[knew,pnew]);assert.deepEqual(replay.operation.result,paid.operation.result);assert.equal(replay.operation.replayCount,'1');
 // Fault AFTER payment INSERT: infrastructure must undo payment/order/result.
 await db.query(`create table private.sql_check_fault(mode text);insert into private.sql_check_fault values('infra');revoke all on private.sql_check_fault from public,anon,authenticated;
 create function private.sql_check_fail_payment() returns trigger language plpgsql as $$begin
 if (select mode from private.sql_check_fault)='infra' then raise exception 'isolated fault after payment' using errcode='XX000'; end if;
 if (select mode from private.sql_check_fault)='business' then perform private.reject_write('PAYMENT_AMOUNT_TOO_LOW'); end if;
 return new;end$$;
 create trigger sql_check_payment_fault after insert on payments for each row execute function private.sql_check_fail_payment()`);
 let freshOrder=await order();let [faultK,faultP]=await pendingPay(freshOrder);let rawBefore=await raw(freshOrder);await assert.rejects(()=>rpc('execute_write_operation',[faultK,faultP]),e=>e.code==='XX000');assert.deepEqual(await raw(freshOrder),rawBefore);assert.equal((await rpc('get_write_operation',[faultK])).operation.status,'pending');
 await db.query("update private.sql_check_fault set mode='business'");const rejected=await rpc('execute_write_operation',[faultK,faultP]);assert.equal(rejected.operation.status,'rejected');assert.equal(rejected.operation.error.code,'PAYMENT_AMOUNT_TOO_LOW');assert.deepEqual(await raw(freshOrder),rawBefore);
 await db.query("update private.sql_check_fault set mode='none'");[faultK,faultP]=await pendingPay(freshOrder);assert.equal((await rpc('execute_write_operation',[faultK,faultP])).operation.status,'applied');
 // Same K, distinct PIDs: keep initial execute uncommitted, prove replay waits.
 freshOrder=await order();const [raceK,raceP]=await pendingPay(freshOrder);const first=await fresh(),second=await fresh();const firstPid=(await first.query('select pg_backend_pid() p')).rows[0].p,secondPid=(await second.query('select pg_backend_pid() p')).rows[0].p;assert.notEqual(firstPid,secondPid);
 await tx(first);const r1=(await first.query('select execute_write_operation($1,$2) r',[raceK,raceP])).rows[0].r;assert.equal(r1.operation.status,'applied');const pendingReplay=rpc('execute_write_operation',[raceK,raceP],second);await waitBlocked(secondPid,firstPid);assert.equal((await db.query('select status from write_operations where store_id=$1 and operation_id=$2',[sid,raceK])).rows[0].status,'pending');await first.query('commit');const r2=await pendingReplay;assert.equal(r2.operation.replayCount,'1');assert.deepEqual(r2.operation.result,r1.operation.result);
 // Execute then cancel / cancel then execute winners, each held uncommitted.
 for(const winner of ['execute','cancel']){
  const id=await order();const [key,payload]=await pendingPay(id);await tx(first);const win=winner==='execute'?(await first.query('select execute_write_operation($1,$2) r',[key,payload])).rows[0].r:(await first.query('select cancel_write_operation($1) r',[key])).rows[0].r;
  const other=winner==='execute'?rpc('cancel_write_operation',[key],second):rpc('execute_write_operation',[key,payload],second);await waitBlocked(secondPid,firstPid);await first.query('commit');const lose=await other;assert.equal(lose.operation.status,win.operation.status);assert.equal(win.operation.status,winner==='execute'?'applied':'cancelled');
 }
 // Deterministic test-only seam changes clock after preparing a create plan.
 // The literal oracle is the NEW local business day at the actual checkpoint.
 const migration=readFileSync(new URL('../supabase/migrations/015_write_business_helpers.sql',import.meta.url),'utf8');
 const productionPrepare=migration.slice(migration.indexOf('create function private.prepare_write'),migration.indexOf('create function private.apply_write')).replace('create function','create or replace function');
 const hookAnchor=" return jsonb_build_object('newLines',prepared";
 assert(productionPrepare.includes(hookAnchor),'test hook location must match the production helper');
 await db.query(productionPrepare.replace(hookAnchor," update private.sql_check_clock set at='2026-09-08T17:00:00.000Z';\n"+hookAnchor));
 try {
  await clock('2026-09-08T16:59:59.999Z');await login();const midnightOrder=await order();
  const row=(await db.query("select business_date::text,created_at from orders where id=$1",[midnightOrder])).rows[0];
  assert.equal(row.business_date,'2026-09-09');assert.equal(row.created_at.toISOString(),'2026-09-08T17:00:00.000Z');
 } finally {await db.query(productionPrepare);}
 console.log(JSON.stringify({status:'PASS',engine:'postgresql-native',checks:['TTL_minus_1ms','TTL_equal','TTL_plus_1ms','TTL_after_order_wait','open_order_48h_new_K','terminal_48h_replay','infra_after_payment_rollback','known_failure_subtransaction','retry_after_rollback','concurrent_same_K','observer_pending_before_commit','execute_cancel_both_winners','create_validation_crosses_midnight'],barrierPids:[blockPid,workerPid,firstPid,secondPid]}));
}finally{await db.query('create or replace function private.write_clock() returns timestamptz language sql volatile set search_path=pg_catalog as $$ select clock_timestamp() $$');for(const c of conns)await c.end();await db.end();}
