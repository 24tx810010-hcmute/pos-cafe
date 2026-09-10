import pg from 'pg';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const dsn=process.env.IDEM_SQL_CHECK_DSN;assert(dsn?.includes('@127.0.0.1:55439/pos_cafe_idem_test_'));
const db=new pg.Client({connectionString:dsn});await db.connect();
try{
 assert.equal((await db.query('select engine from private.idempotency_test_environment where singleton')).rows[0]?.engine,'postgres-postgrest','dedicated test marker required');
 const sid=randomUUID(),aid=randomUUID(),cid=randomUUID(),pid=randomUUID(),oid=randomUUID();
 const no=910000+(await db.query('select count(*)::int n from stores')).rows[0].n;
 await db.query('insert into auth.users(id,email) values($1,$2)',[sid,`store${no}@store.pos.local`]);
 let token;
 async function call(query,args=[],role='authenticated'){
  await db.query('begin');try{await db.query(`set local role ${role}`);await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.headers',$2,true)",[JSON.stringify(role==='anon'?{}:{sub:sid,role}),JSON.stringify(token?{'x-pos-employee-token':token}:{})]);const res=await db.query(query,args);await db.query('commit');return res;}catch(error){await db.query('rollback');throw error;}
 }
 async function rpc(name,args=[]){return(await call(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;}
 assert.equal((await rpc('get_write_capabilities')).error.code,'EMPLOYEE_SESSION_REQUIRED');
 assert.equal((await rpc('bootstrap_store',[aid,no,'Quán kiểm','Q1'])).ok,true);
 assert.equal((await rpc('bootstrap_store',[randomUUID(),no,'x','y'])).error.code,'ENTITY_ID_CONFLICT');
 const admin=await rpc('start_employee_session',[aid,'123456']);assert.equal(admin.ok,true);token=admin.token;
 assert.equal((await rpc('create_employee',[cid,'C','cashier','222222',null])).ok,true);
 const safe=(await call('select id,name,role,is_active,permission_overrides from employees')).rows;assert.equal(safe.length,2);
 for(const sql of ['select * from employees','select passcode_hash from employees',"update employees set passcode_hash='bad'",'delete from stores','delete from orders',"select public.hash_employee_pin('123456')",'select private.current_employee(false)',"select private.write_clock()"]){await assert.rejects(()=>call(sql),error=>error.code==='42501',sql);}
 const oldFns=(await db.query("select p.oid::regprocedure::text f,has_function_privilege('authenticated',p.oid,'execute') permitted from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('submit_order_changes','pay_order','pay_order_items','void_order','verify_employee_pin','hash_employee_pin')")).rows;assert(oldFns.length>=6);assert(oldFns.every(x=>!x.permitted));
 await rpc('reset_employee_pin',[cid,'333333']);assert.equal((await rpc('start_employee_session',[cid,'222222'])).error.code,'INVALID_PIN');
 const cashier=await rpc('start_employee_session',[cid,'333333']);assert.equal(cashier.ok,true);token=cashier.token;
 const denied=await call("update employees set role='admin' where id=$1 returning id",[cid]);assert.equal(denied.rowCount,0);
 assert.equal((await rpc('create_employee',[randomUUID(),'bad','admin','123456',null])).error.code,'FORBIDDEN');
 assert.equal((await rpc('reset_employee_pin',[aid,'999999'])).error.code,'FORBIDDEN');
 const malformed={schemaVersion:1,kind:'pay_order',orderId:oid,paymentId:pid,expectedVersion:null,method:'cash',receivedAmount:100};assert.equal((await rpc('register_write_operation',[randomUUID(),malformed])).error.code,'INVALID_WRITE_REQUEST');
 const valid={...malformed,expectedVersion:1};const k=randomUUID();assert.equal((await rpc('register_write_operation',[k,valid])).operation.status,'pending');
 token=admin.token;await call("update employees set permission_overrides='{"+ '"denies":["payment.take"],"grants":[]' +"}' where id=$1",[cid]);token=cashier.token;
 assert.equal((await rpc('execute_write_operation',[k,valid])).error.code,'FORBIDDEN');assert.equal((await rpc('get_write_operation',[k])).error.code,'FORBIDDEN');assert.equal((await rpc('list_write_operations')).page.items.length,0);
 token=admin.token;assert.equal((await rpc('get_write_operation',[k])).operation.status,'pending');
 await rpc('reset_employee_pin',[cid,'444444']);token=cashier.token;assert.equal((await rpc('get_write_capabilities')).error.code,'EMPLOYEE_SESSION_REQUIRED');
 token=admin.token;await rpc('revoke_employee_session');assert.equal((await rpc('get_write_capabilities')).error.code,'EMPLOYEE_SESSION_REQUIRED');await rpc('revoke_employee_session');
 console.log(JSON.stringify({status:'PASS',engine:'postgresql-native',checks:['bootstrap','duplicate_bootstrap','admin_employee_create','safe_employee_select','hash_denied','private_helpers_denied','legacy_overloads_denied','no_financial_DML','cashier_cannot_promote','admin_reset','old_PIN_denied','revoke_sessions','NULL_version_schema','permission_live','list_filter','takeover_read','revoke_idempotent'],oldOverloads:oldFns.length}));
}finally{await db.end();}
