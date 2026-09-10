import { mkdirSync, writeFileSync,appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { parseTestEnvironment, loadTestEnvironmentFile, withObserver, type TestEnvironment } from './preflight.ts';
import { ids, T } from './fixtures.ts';

export class RpcError extends Error {
  code:string;
  constructor(code:string) {super(`RPC_ERROR: ${code}`);this.code=code;}
}
const businessTables=['order_events','write_operations','payments','order_item_options','order_items','orders','tables'];
const resetTables=[...businessTables,'menu_item_option_groups','option_values','option_groups','menu_items','categories','floor_areas'];

export class ContractHarness {
  env:TestEnvironment;
  constructor(){loadTestEnvironmentFile();this.env=parseTestEnvironment();}
  observer<T>(run:(db:pg.Client)=>Promise<T>){return withObserver(this.env,run);}
  async assertIsolation(db:pg.Client) {
    const result=await db.query('select marker from private.idempotency_test_environment where singleton=true');
    if(result.rowCount!==1||result.rows[0].marker!==this.env.marker)throw new Error('FIXTURE_RESET_REFUSED: marker mismatch');
    const extra=await db.query('select count(*)::int n from public.stores where not(id=any($1::uuid[]))',[this.env.storeIds]);
    if(extra.rows[0].n!==0)throw new Error('FIXTURE_RESET_REFUSED: nonfixture store');
  }
  async rpcRaw(name:string,args:Record<string,unknown>={},token?:string,jwt=this.env.storeJwt) {
    const headers:Record<string,string>={'Content-Type':'application/json',apikey:this.env.anonKey};
    if(jwt)headers.Authorization=`Bearer ${jwt}`;
    if(token)headers['x-pos-employee-token']=token;
    const response=await fetch(`${this.env.apiUrl}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});
    return {status:response.status,data:await response.json() as any};
  }
  async rpc(name:string,args:Record<string,unknown>={},token?:string,jwt=this.env.storeJwt):Promise<any> {
    const {status,data}=await this.rpcRaw(name,args,token,jwt);
    if(status>=400)throw new RpcError(data?.message?.match(/^[A-Z][A-Z0-9_]+$/)?.[0]??data?.code??'HTTP_FAILURE');
    if(data?.ok===false)throw new RpcError(data.error?.code??'UNKNOWN');
    return data;
  }
  async login(actor:keyof Pick<typeof ids,'A'|'B'|'C'|'E'|'X'>='A') {
    const pins={A:'123456',B:'111111',C:'222222',E:'333333',X:'123456'};
    const jwt=actor==='X'?process.env.IDEM_STORE_S2_JWT:this.env.storeJwt;
    const result=await this.rpc('start_employee_session',{p_employee_id:ids[actor],p_pin:pins[actor]},undefined,jwt);
    if(typeof result.token!=='string'||!/^[\w-]{43}$/.test(result.token))throw new Error('INVALID_SESSION_RESULT');
    return result.token as string;
  }
  register(payload:any,token:string,key=ids.K1){return this.rpc('register_write_operation',{p_operation_id:key,p_payload:payload},token).then((value)=>value.operation);}
  execute(payload:any,token:string,key=ids.K1){return this.rpc('execute_write_operation',{p_operation_id:key,p_payload:payload},token).then((value)=>value.operation);}
  get(token:string,key=ids.K1){return this.rpc('get_write_operation',{p_operation_id:key},token).then((value)=>value.operation);}
  cancel(token:string,key=ids.K1){return this.rpc('cancel_write_operation',{p_operation_id:key},token).then((value)=>value.operation);}
  async clock(moment:string|null) {
    await this.observer(async(db)=>{
      await this.assertIsolation(db);
      if(moment===null) {
        await db.query('create or replace function private.write_clock() returns timestamptz language sql volatile set search_path=pg_catalog as $$select clock_timestamp()$$');return;
      }
      await db.query('create table if not exists private.idempotency_test_clock(singleton boolean primary key default true check(singleton),moment timestamptz not null)');
      await db.query('revoke all on private.idempotency_test_clock from public,anon,authenticated');
      await db.query('insert into private.idempotency_test_clock values(true,$1) on conflict(singleton) do update set moment=excluded.moment',[moment]);
      await db.query('create or replace function private.write_clock() returns timestamptz language sql volatile set search_path=pg_catalog as $$select moment from private.idempotency_test_clock where singleton=true$$');
    });
  }
  async reset(fixture:'F0'|'F1'|'F2'|'F3'|'F4'|'F5'|'F7'='F0') {
    await this.clock(T);
    await this.observer(async(db)=>{
      await this.assertIsolation(db);
      await db.query('begin');
      try {
        // Observer-only fixture cleanup. All application triggers are restored before COMMIT/caller requests.
        for(const table of resetTables)await db.query(`alter table public.${table} disable trigger user`);
        await db.query('delete from private.employee_sessions');
        for(const table of resetTables)await db.query(`delete from public.${table} where store_id=any($1::uuid[])`,[this.env.storeIds]);
        await db.query("update public.employees set is_active=true,permission_overrides='{}'::jsonb where store_id=any($1::uuid[])",[this.env.storeIds]);
        await db.query("update public.employees set permission_overrides=$2 where id=$1",[ids.B,{grants:[],denies:['order.create','order.update','order.voidOpen','order.voidPaid']}]);
        await db.query("update public.employees set permission_overrides=$2 where id=$1",[ids.C,{grants:[],denies:['order.create','order.update','order.voidOpen','payment.take','order.voidPaid']}]);
        await db.query('insert into public.categories(id,store_id,name) values($1,$2,$3)',[ids.CATEGORY,ids.S1,'Fixture category']);
        await db.query('insert into public.menu_items(id,store_id,category_id,name,price) values($1,$3,$4,$5,30000),($2,$3,$4,$6,20000)',[ids.M_A,ids.M_T,ids.S1,ids.CATEGORY,'Cà phê','Trà']);
        await db.query("insert into public.option_groups(id,store_id,name,select_type,is_required) values($1,$2,'Topping','multi',false)",[ids.GROUP,ids.S1]);
        await db.query('insert into public.menu_item_option_groups(id,store_id,menu_item_id,option_group_id,sort_order) values($4,$1,$2,$3,0)',[ids.S1,ids.M_A,ids.GROUP,'00000000-0000-4000-8000-0000000002c0']);
        await db.query("insert into public.option_values(id,store_id,option_group_id,name,price_delta) values($1,$3,$4,'Topping cũ',5000),($2,$3,$4,'Không thêm',0)",[ids.Q,ids.Z,ids.S1,ids.GROUP]);
        await db.query("insert into public.floor_areas(id,store_id,name) values($1,$2,'Khu A')",[ids.AREA,ids.S1]);
        await db.query("insert into public.tables(id,store_id,area_id,name,pos_x,pos_y,width,height,shape) values($1,$2,$3,'B01',0,0,100,100,'square')",[ids.B01,ids.S1,ids.AREA]);
        if(fixture!=='F0') {
          const total=fixture==='F2'?65000:fixture==='F3'||fixture==='F7'?80000:fixture==='F5'?60000:150000;
          await db.query("insert into public.orders(id,store_id,table_id,order_type,order_no,business_date,status,subtotal,total,employee_id,lock_version,created_by_employee_id,last_modified_by_employee_id,created_at,updated_at) values($1,$2,$3,'dine_in',12,'2026-09-08',$7,$4,$4,$5,$8,$5,$5,$6,$6)",[ids.O1,ids.S1,ids.B01,total,ids.A,T,fixture==='F4'?'paid':'open',fixture==='F4'?6:5]);
          await db.query("insert into public.orders(id,store_id,order_type,order_no,business_date,status,employee_id,created_at,updated_at) values($1,$2,'takeaway',20,'2026-09-08','void',$3,$4,$4)",[ids.MAX,ids.S1,ids.A,T]);
          const lines=fixture==='F2'?[[ids.L30,1,30000,'ít đá'],[ids.L35,1,35000,null]]:[[ids.L1,fixture==='F3'||fixture==='F5'||fixture==='F7'?2:5,30000,null]];
          for(const [id,qty,price,note]of lines)await db.query("insert into public.order_items(id,store_id,order_id,menu_item_id,item_name,quantity,unit_price,note,created_at,updated_at) values($1,$2,$3,$4,'Cà phê cũ',$5,$6,$7,$8,$8)",[id,ids.S1,ids.O1,ids.M_A,qty,price,note,T]);
          if(['F3','F5','F7'].includes(fixture))await db.query("insert into public.order_item_options(id,store_id,order_item_id,option_value_id,option_name,price_delta,quantity,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$8)",[ids.OPTION1,ids.S1,ids.L1,fixture==='F5'?ids.Z:ids.Q,fixture==='F5'?'Không thêm':'Topping cũ',fixture==='F5'?0:5000,fixture==='F5'?1:2,T]);
          await db.query("update public.tables set status='occupied' where id=$1",[ids.B01]);
          if(fixture==='F3') {await db.query("update public.menu_items set name='Cà phê mới',price=35000 where id=$1",[ids.M_A]);await db.query("update public.option_values set name='Topping mới',price_delta=7000 where id=$1",[ids.Q]);}
          if(fixture==='F5')await db.query('update public.menu_items set price=40000 where id=$1',[ids.M_A]);
          if(fixture==='F4') {
            await db.query('update public.orders set paid_at=$2 where id=$1',[ids.O1,T]);
            await db.query("insert into public.payments(id,store_id,order_id,employee_id,method,amount,received_amount,change_amount,paid_at,created_at,updated_at) values($1,$2,$3,$4,'cash',150000,200000,50000,$5,$5,$5)",[ids.P0,ids.S1,ids.O1,ids.A,T]);
            await db.query("insert into public.orders(id,store_id,table_id,order_type,order_no,business_date,status,subtotal,total,employee_id,created_at,updated_at) values($1,$2,$3,'dine_in',13,'2026-09-08','open',20000,20000,$4,$5,$5)",[ids.O3,ids.S1,ids.B01,ids.A,T]);
          }
        }
        for(const table of resetTables)await db.query(`alter table public.${table} enable trigger user`);
        await db.query('commit');
      } catch(error) {await db.query('rollback');throw error;}
    });
  }
  async snapshot(label?:string):Promise<Record<string,any[]>> {
    const result=await this.observer(async(db)=>{
      const out:Record<string,any[]>={};
      for(const table of businessTables)out[table]=(await db.query(`select to_jsonb(t) as row from public.${table} t where store_id=any($1::uuid[]) order by to_jsonb(t)::text`,[this.env.storeIds])).rows.map((row)=>row.row);
      return out;
    });
    if(label){mkdirSync('artifacts/idempotency-snapshots',{recursive:true});writeFileSync(`artifacts/idempotency-snapshots/${label.replace(/[^\w.-]/g,'_')}.json`,JSON.stringify(result,null,2)+'\n');}
    return result;
  }
  async waitForDatabaseWait(blockerPid:number):Promise<{pid:number;transactionId:string|null}> {
    const deadline=Date.now()+25000;
    while(Date.now()<deadline) {
      const rows=await this.observer(async(db)=>(await db.query("select a.pid,a.backend_xid::text as xid,(select l.virtualtransaction from pg_locks l where l.pid=a.pid and l.locktype='virtualxid' and l.granted limit 1) virtual_transaction,a.wait_event,pg_blocking_pids(a.pid) blockers from pg_stat_activity a where datname=current_database() and $1=any(pg_blocking_pids(a.pid)) and wait_event_type='Lock'",[blockerPid])).rows);
      if(rows.length){this.recordRaceEvidence(blockerPid,rows);return {pid:rows[0].pid,transactionId:rows[0].xid};}
      await new Promise((done)=>setTimeout(done,20));
    }
    throw new Error('RACE_BARRIER_TIMEOUT: no proven waiting contender');
  }
  recordRaceEvidence(blockerPid:number,rows:any[]){
    if(rows.some(row=>!Number.isInteger(row.pid)||!row.virtual_transaction))throw new Error('RACE_EVIDENCE_MISSING_BACKEND_OR_VIRTUAL_TRANSACTION');
    mkdirSync('artifacts/idempotency-races',{recursive:true});appendFileSync(`artifacts/idempotency-races/barriers-${process.pid}.jsonl`,JSON.stringify({observedAt:new Date().toISOString(),database:this.env.database,blockerPid,contenders:rows,xidNote:'backend_xid may be null before a write assigns an XID; virtual_transaction identifies that live transaction.',callSite:new Error().stack?.split('\n').slice(2,5).join('\n')})+'\n');
  }
}

export function businessOnly(snapshot:Record<string,any[]>) {const {write_operations,...business}=snapshot;return business;}
