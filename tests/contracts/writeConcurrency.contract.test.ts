import { afterAll, expect, test } from 'vitest';
import pg from 'pg';
import { ContractHarness, businessOnly } from './harness.ts';
import { ids, payPayload, splitPayload, updatePayload, voidPayload, createPayload, T } from './fixtures.ts';
const h=new ContractHarness();afterAll(()=>h.clock(null));

for(const [boundary,moment,allowed] of [['minus_1ms','2026-09-08T11:59:59.999Z',true],['equal','2026-09-08T12:00:00.000Z',false],['plus_1ms','2026-09-08T12:00:00.001Z',false]] as const)test(`TC-IDEM-005/db/boundary=${boundary} enforces the employee expiry without expiring the pending operation`,async()=>{
  await h.reset('F1');const token=await h.login();await h.register(payPayload(),token);await h.clock(moment);
  if(allowed)expect((await h.execute(payPayload(),token)).status).toBe('applied');
  else{await expect(h.execute(payPayload(),token)).rejects.toMatchObject({code:'EMPLOYEE_SESSION_REQUIRED'});const raw=await h.snapshot();expect(raw.write_operations[0].status).toBe('pending');expect(raw.payments).toHaveLength(0);}
});
test('TC-IDEM-005/db/reset_pin invalidates the old employee token and requires the new PIN',async()=>{
  await h.reset('F1');const token=await h.login();await h.register(payPayload(),token);
  try{await h.rpc('reset_employee_pin',{p_employee_id:ids.A,p_pin:'654321'},token);await expect(h.execute(payPayload(),token)).rejects.toMatchObject({code:'EMPLOYEE_SESSION_REQUIRED'});const session=await h.rpc('start_employee_session',{p_employee_id:ids.A,p_pin:'654321'});expect((await h.execute(payPayload(),session.token)).status).toBe('applied');}
  finally{await h.observer(db=>db.query("update public.employees set passcode_hash=extensions.crypt('123456',extensions.gen_salt('bf')) where id=$1",[ids.A]));}
});

async function lock(sql:string,values:any[]) {
  const db=new pg.Client({connectionString:h.env.observerDsn,application_name:'idem-controlled-blocker'});await db.connect();await db.query('begin');
  const pid=(await db.query('select pg_backend_pid() pid')).rows[0].pid;await db.query(sql,values);
  return {db,pid,release:async()=>{await db.query('commit');await db.end();}};
}
async function waitTwo(blockerPid:number){
  const deadline=Date.now()+25000;
  while(Date.now()<deadline){
    const rows=await h.observer(async db=>(await db.query("select a.pid,a.backend_xid::text as xid,(select l.virtualtransaction from pg_locks l where l.pid=a.pid and l.locktype='virtualxid' and l.granted limit 1) virtual_transaction,a.wait_event,pg_blocking_pids(a.pid) blockers from pg_stat_activity a where datname=current_database() and $1=any(pg_blocking_pids(a.pid)) and wait_event_type='Lock'",[blockerPid])).rows);
    if(rows.length>=2){expect(new Set(rows.map(row=>row.pid)).size).toBe(2);h.recordRaceEvidence(blockerPid,rows);return rows;}
    await new Promise(done=>setTimeout(done,20));
  }throw new Error('TWO_CONTENDERS_DID_NOT_REACH_BARRIER');
}

test('TC-IDEM-019/db two PostgREST backend PIDs register and execute the same key exactly once',async()=>{
  await h.reset();const token=await h.login();const p=createPayload();
  let blocker=await lock("select pg_advisory_xact_lock(hashtext($1||':pos-write'))",[ids.S1]);let left=h.register(p,token),right=h.register(p,token);
  try{await waitTwo(blocker.pid);}finally{await blocker.release();}await Promise.all([left,right]);
  blocker=await lock("select pg_advisory_xact_lock(hashtext($1||':pos-write'))",[ids.S1]);left=h.execute(p,token);right=h.execute(p,token);
  try{await waitTwo(blocker.pid);}finally{await blocker.release();}const results=await Promise.all([left,right]);expect(results.map(result=>result.status)).toEqual(['applied','applied']);expect(results[0].result).toEqual(results[1].result);expect(results[0].result.order.total).toBe(60000);
  const raw=await h.snapshot('TC-IDEM-019-after');expect(raw.orders).toHaveLength(1);expect(raw.order_events).toHaveLength(1);expect(raw.write_operations).toHaveLength(1);expect(raw.write_operations[0].replay_count).toBe(1);
});

for(const winner of ['cancel','execute'])test(`TC-IDEM-060/db/winner=${winner} proves both contenders waited and only the winner takes effect`,async()=>{
  await h.reset('F1');const token=await h.login();const p=payPayload();await h.register(p,token);
  const blocker=await lock('select 1 from public.write_operations where operation_id=$1 for update',[ids.K1]);
  const first=winner==='cancel'?h.cancel(token):h.execute(p,token);let second:Promise<any>|undefined;
  try{const firstPid=await h.waitForDatabaseWait(blocker.pid);second=winner==='cancel'?h.execute(p,token):h.cancel(token);const secondPid=await h.waitForDatabaseWait(firstPid.pid);expect(firstPid.pid).not.toBe(secondPid.pid);}finally{await blocker.release();}
  const results=await Promise.all([first,second!]);expect(results.map(result=>result.status)).toEqual(winner==='cancel'?['cancelled','cancelled']:['applied','applied']);
  const raw=await h.snapshot(`TC-IDEM-060-${winner}`);expect(raw.payments).toHaveLength(winner==='cancel'?0:1);if(winner==='execute')expect(raw.payments[0].amount).toBe(150000);
});

const pairs:Record<string,()=>[any,any]>={update_pay:()=>[updatePayload(),payPayload()],update_split:()=>[updatePayload(),splitPayload()],pay_split:()=>[payPayload(),splitPayload()],update_voidOpen:()=>[updatePayload(),{schemaVersion:1,kind:'submit_order_changes',action:'void_open',orderId:ids.O1,expectedVersion:5}],voidPaid_voidPaid:()=>[voidPayload(),voidPayload()]};
for(const pair of Object.keys(pairs))for(const winner of ['left','right'])test(`TC-IDEM-023/db/pair=${pair}/winner=${winner} forces one OCC winner instead of accepting two failures`,async()=>{
  await h.reset(pair==='voidPaid_voidPaid'?'F4':'F1');const token=await h.login();const [leftPayload,rightPayload]=pairs[pair]();await h.register(leftPayload,token,ids.K1);await h.register(rightPayload,token,ids.K2);
  const blocker=await lock('select 1 from public.orders where id=$1 for update',[ids.O1]);
  const first=winner==='left'?h.execute(leftPayload,token,ids.K1):h.execute(rightPayload,token,ids.K2);let second:Promise<any>|undefined;
  try{const firstPid=await h.waitForDatabaseWait(blocker.pid);second=winner==='left'?h.execute(rightPayload,token,ids.K2):h.execute(leftPayload,token,ids.K1);const secondPid=await h.waitForDatabaseWait(firstPid.pid);expect(secondPid.pid).not.toBe(firstPid.pid);}finally{await blocker.release();}
  const [won,lost]=await Promise.all([first,second!]);expect(won.status).toBe('applied');expect(lost).toMatchObject({status:'rejected',error:{code:'ORDER_VERSION_CONFLICT'}});
  const effective=winner==='left'?leftPayload:rightPayload;const raw=await h.snapshot();const source=raw.orders.find(row=>row.id===ids.O1)!;
  if(effective.kind==='pay_order'){expect(source).toMatchObject({status:'paid',lock_version:6,total:150000});expect(raw.payments).toHaveLength(1);}
  else if(effective.kind==='pay_order_items'){expect(source).toMatchObject({status:'open',lock_version:6,total:120000});expect(raw.payments).toHaveLength(1);expect(raw.payments[0].amount).toBe(30000);}
  else if(effective.kind==='void_order'){expect(source).toMatchObject({status:'void',lock_version:7,total:150000});expect(raw.payments).toHaveLength(1);}
  else {expect(source).toMatchObject({status:effective.action==='void_open'?'void':'open',lock_version:6,total:effective.action==='void_open'?0:150000});expect(raw.payments).toHaveLength(0);}
});

for(const [boundary,moment,status]of [['minus_1ms','2026-09-08T23:59:59.999Z','applied'],['equal','2026-09-09T00:00:00.000Z','expired'],['plus_1ms','2026-09-09T00:00:00.001Z','expired']])test(`TC-IDEM-062/db/boundary=${boundary} checks operation TTL with a newly valid employee session`,async()=>{
  await h.reset('F1');let token=await h.login();const p=payPayload();await h.register(p,token);await h.clock(moment);token=await h.login();const first=await h.execute(p,token);expect(first.status).toBe(status);expect((await h.snapshot()).payments).toHaveLength(status==='applied'?1:0);
});
for(const blockerName of ['operation','store','order','table'])test(`TC-IDEM-063/db/blocker=${blockerName} checks expiry after the contender crosses an observed lock wait`,async()=>{
  await h.reset('F1');let token=await h.login();const p=payPayload();await h.register(p,token);await h.clock('2026-09-08T20:00:00Z');token=await h.login();await h.clock('2026-09-08T23:59:59.999Z');
  const blocks:Record<string,[string,any[]]>={operation:['select 1 from public.write_operations where operation_id=$1 for update',[ids.K1]],store:["select pg_advisory_xact_lock(hashtext($1||':pos-write'))",[ids.S1]],order:['select 1 from public.orders where id=$1 for update',[ids.O1]],table:['select 1 from public.tables where id=$1 for update',[ids.B01]]};
  const before=await h.snapshot();const blocker=await lock(...blocks[blockerName]);const pending=h.execute(p,token);
  try{await h.waitForDatabaseWait(blocker.pid);await h.clock('2026-09-09T00:00:00.001Z');}finally{await blocker.release();}
  expect((await pending).status).toBe('expired');expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
});

for(const winner of ['P1','P2'])test(`TC-IDEM-020/db/winner=${winner} binds one canonical payload after two observed registration contenders`,async()=>{
  await h.reset();const token=await h.login();const p1=createPayload(),p2=createPayload();p1.newLines[0].quantity=1;
  const blocker=await lock("select pg_advisory_xact_lock(hashtext($1||':pos-write'))",[ids.S1]);
  const wonPayload=winner==='P1'?p1:p2,lostPayload=winner==='P1'?p2:p1;const first=h.register(wonPayload,token);let second:Promise<any>|undefined;
  try{const firstPid=await h.waitForDatabaseWait(blocker.pid);second=h.register(lostPayload,token).then(value=>({value}),error=>({error}));const secondPid=await h.waitForDatabaseWait(firstPid.pid);expect(secondPid.pid).not.toBe(firstPid.pid);}finally{await blocker.release();}
  expect((await first).status).toBe('pending');expect((await second!).error).toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});
  const registered=(await h.snapshot()).write_operations[0];expect(registered.payload).toEqual(wonPayload);expect(registered.initiated_by_employee_id).toBe(ids.A);expect(new Date(registered.expires_at).toISOString()).toBe('2026-09-09T00:00:00.000Z');
  expect((await h.execute(wonPayload,token)).result.order.total).toBe(winner==='P1'?30000:60000);expect((await h.snapshot()).orders).toHaveLength(1);
});

for(const winner of ['K1','K2'])test(`TC-IDEM-021/db/winner=${winner} preserves a single occupied-table creation`,async()=>{
  await h.reset();const token=await h.login();const left=createPayload();left.newLines[0].quantity=1;const right=structuredClone(left);right.orderId=ids.O2;right.newLines[0].id=ids.L2;
  await h.register(left,token,ids.K1);await h.register(right,token,ids.K2);const blocker=await lock('select 1 from public.tables where id=$1 for update',[ids.B01]);
  const first=winner==='K1'?h.execute(left,token,ids.K1):h.execute(right,token,ids.K2);let second:Promise<any>|undefined;
  try{const pid=await h.waitForDatabaseWait(blocker.pid);second=winner==='K1'?h.execute(right,token,ids.K2):h.execute(left,token,ids.K1);await h.waitForDatabaseWait(pid.pid);}finally{await blocker.release();}
  expect((await first).status).toBe('applied');expect(await second!).toMatchObject({status:'rejected',error:{code:'TABLE_OCCUPIED'}});const raw=await h.snapshot();expect(raw.orders).toHaveLength(1);expect(raw.orders[0].total).toBe(30000);expect(raw.order_items).toHaveLength(1);expect(raw.order_events).toHaveLength(1);expect(raw.tables[0].status).toBe('occupied');
});

test('TC-IDEM-022/db equal takeaway contents with distinct keys create two legitimate orders',async()=>{
  await h.reset();const token=await h.login();const left:any=createPayload();left.orderType='takeaway';left.tableId=null;left.newLines[0].quantity=1;const right=structuredClone(left);right.orderId=ids.O2;right.newLines[0].id=ids.L2;
  await Promise.all([h.register(left,token,ids.K1),h.register(right,token,ids.K2)]);expect((await Promise.all([h.execute(left,token,ids.K1),h.execute(right,token,ids.K2)])).map(x=>x.status)).toEqual(['applied','applied']);
  const raw=await h.snapshot();expect(raw.orders).toHaveLength(2);expect(raw.orders.map(o=>o.total)).toEqual([30000,30000]);expect(new Set(raw.orders.map(o=>o.order_no)).size).toBe(2);expect(raw.order_events).toHaveLength(2);
});

for(const winner of ['create','split'])test(`TC-IDEM-024/db/winner=${winner} allocates distinct numbers in the actual store lock order`,async()=>{
  await h.reset('F1');const token=await h.login();const create:any=createPayload();create.orderId=ids.O3;create.orderType='takeaway';create.tableId=null;create.newLines[0].id=ids.L30;const split=splitPayload();await h.register(create,token,ids.K1);await h.register(split,token,ids.K2);
  const blocker=await lock("select pg_advisory_xact_lock(hashtext($1||':pos-write'))",[ids.S1]);const first=winner==='create'?h.execute(create,token,ids.K1):h.execute(split,token,ids.K2);let second:Promise<any>|undefined;
  try{const pid=await h.waitForDatabaseWait(blocker.pid);second=winner==='create'?h.execute(split,token,ids.K2):h.execute(create,token,ids.K1);await h.waitForDatabaseWait(pid.pid);}finally{await blocker.release();}
  expect((await first).status).toBe('applied');expect((await second!).status).toBe('applied');const raw=await h.snapshot();expect(raw.orders.find(o=>o.id===ids.O3).order_no).toBe(winner==='create'?21:22);expect(raw.orders.find(o=>o.id===ids.O1).order_no).toBe(winner==='create'?22:21);expect(raw.orders.find(o=>o.id===ids.O2).order_no).toBe(12);
  const numbers=raw.orders.map(o=>`${o.store_id}/${o.business_date}/${o.order_no}`);expect(new Set(numbers).size).toBe(numbers.length);await h.execute(create,token,ids.K1);await h.execute(split,token,ids.K2);expect(businessOnly(await h.snapshot())).toEqual(businessOnly(raw));
});

test('TC-IDEM-007/db observes a committed permission revocation before the final execution checkpoint',async()=>{
  await h.reset('F1');const b=await h.login('B');await h.register(payPayload(),b);const blocker=await lock('select 1 from public.orders where id=$1 for update',[ids.O1]);const pending=h.execute(payPayload(),b).then(value=>({value}),error=>({error}));
  try{await h.waitForDatabaseWait(blocker.pid);await h.observer(db=>db.query("update public.employees set permission_overrides=$2 where id=$1",[ids.B,{grants:[],denies:['payment.take']}]));const changed=await h.observer(async db=>(await db.query('select permission_overrides from public.employees where id=$1',[ids.B])).rows[0]);expect(changed.permission_overrides.denies).toContain('payment.take');}finally{await blocker.release();}
  expect((await pending).error).toMatchObject({code:'FORBIDDEN'});expect((await h.snapshot()).write_operations[0].status).toBe('pending');expect((await h.snapshot()).payments).toHaveLength(0);expect((await h.execute(payPayload(),await h.login())).status).toBe('applied');expect((await h.snapshot()).payments).toHaveLength(1);
});

for(const race of ['start_first','reset_first'])test(`TC-IDEM-005/db/race=${race} serializes PIN reset and session issuance on the same employee row`,async()=>{
  await h.reset('F1');const admin=await h.login();const blocker=await lock('select 1 from public.employees where id=$1 for update',[ids.B]);
  const start=()=>h.rpc('start_employee_session',{p_employee_id:ids.B,p_pin:'111111'}).then(value=>({value}),error=>({error}));const reset=()=>h.rpc('reset_employee_pin',{p_employee_id:ids.B,p_pin:'654321'},admin);const first=race==='start_first'?start():reset();let second:Promise<any>|undefined;
  try{const pid=await h.waitForDatabaseWait(blocker.pid);second=race==='start_first'?reset():start();await h.waitForDatabaseWait(pid.pid);}finally{await blocker.release();}
  try{const a=await first,b=await second!;if(race==='start_first'){expect(a.value?.ok).toBe(true);await expect(h.register(payPayload(),a.value.token)).rejects.toMatchObject({code:'EMPLOYEE_SESSION_REQUIRED'});}else expect(b.error).toMatchObject({code:'INVALID_PIN'});const fresh=await h.rpc('start_employee_session',{p_employee_id:ids.B,p_pin:'654321'});await h.register(payPayload(),fresh.token);expect((await h.execute(payPayload(),fresh.token)).status).toBe('applied');}
  finally{await h.observer(db=>db.query("update public.employees set passcode_hash=extensions.crypt('111111',extensions.gen_salt('bf')) where id=$1",[ids.B]));}
});
