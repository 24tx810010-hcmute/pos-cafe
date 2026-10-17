import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll,beforeAll,expect,test } from 'vitest';
import { assertBridgeFixture,parseBridgeEnvironment } from '../../scripts/permission-identity-runtime.mjs';
import { prepareCompatibilityHook,restoreCompatibilityPreparation,verifyCompatibilityRestRouting } from '../../scripts/permission-compatibility-prepare.mjs';

const env=parseBridgeEnvironment();
const db=new pg.Client({connectionString:env.dsn,connectionTimeoutMillis:5_000,statement_timeout:60_000});
let receipt:{installedByCaller:boolean}|undefined;
let fixtureVerified=false;
let serviceKey='';
const endpoint=env.api+'/rest/v1/rpc/get_write_capabilities';

function isolatedServiceKey(){
 const command='/var/tmp/pos-cafe-perm-s31-t04-20261013/bin/supabase status --workdir /var/tmp/pos-cafe-perm-s31-t04-20261013/stack -o json';
 const raw=process.platform==='win32'
  ? execFileSync('wsl',['-d','Ubuntu-24.04','--','bash','-lc',command],{encoding:'utf8',timeout:30_000})
  : execFileSync('/bin/bash',['-lc',command],{encoding:'utf8',timeout:30_000});
 const status=JSON.parse(raw.slice(raw.indexOf('{')));
 if(new URL(status.API_URL).origin!==env.api||new URL(status.API_URL).port!=='62421'||typeof status.SERVICE_ROLE_KEY!=='string')throw Error('RUNTIME_BINDING_MISMATCH');
 return status.SERVICE_ROLE_KEY as string;
}
async function call(key:string,authorization?:string,marker=false){
 const headers:Record<string,string>={apikey:key,'content-type':'application/json'};
 if(authorization)headers.authorization='Bearer '+authorization;if(marker)headers['x-pos-permission-contract']='2';
 const response=await fetch(endpoint,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10_000)});
 return {status:response.status,body:await response.json()};
}
async function protectedRequest(path:string,body:unknown,marker?:string){
 const headers:Record<string,string>={apikey:env.anonKey,authorization:'Bearer '+env.storeJwt,'content-type':'application/json'};
 if(marker!==undefined)headers['x-pos-permission-contract']=marker;
 const response=await fetch(env.api+'/rest/v1/'+path,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(10_000)});
 return {status:response.status,body:await response.json()};
}
async function businessHash(){return (await db.query(`select md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' order by md5(to_jsonb(x)::text)),'')) h from (
 select 'payments' t,to_jsonb(p) x from public.payments p union all select 'orders',to_jsonb(o) from public.orders o
 union all select 'write_operations',to_jsonb(w) from public.write_operations w union all select 'order_events',to_jsonb(e) from public.order_events e) x`)).rows[0].h;}
beforeAll(async()=>{
 await db.connect();await assertBridgeFixture(db,env,'bridge');fixtureVerified=true;
 const hooks=(await db.query(`select split_part(setting,'=',2) value from pg_db_role_setting s join pg_roles r on r.oid=s.setrole,
  lateral unnest(s.setconfig) setting where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%'`)).rows;
 expect(hooks).toEqual([]);
 receipt=await prepareCompatibilityHook(db);serviceKey=isolatedServiceKey();
});
afterAll(async()=>{
 try{
  if(!fixtureVerified||!receipt)return;
  await db.query(`insert into private.permission_contract_gate(singleton,strict,contract_version) values(true,false,2)
   on conflict(singleton) do update set strict=false,contract_version=2`);
  if(receipt)await restoreCompatibilityPreparation(db,receipt);
 }finally{serviceKey='';await db.end();}
});

test('TC-PERM-51 routing probe rejects exposed RPC when pre-request hook is disabled',async()=>{
 await expect(verifyCompatibilityRestRouting({restUrl:env.api+'/rest/v1',anonKey:env.anonKey})).resolves.toBe(true);
 await db.query("alter role authenticator reset pgrst.db_pre_request; notify pgrst,'reload config'");
 try{
  // Wait for the independently observed routing change, not an arbitrary delay.
  let disabled=false;
  for(let attempt=0;attempt<50;attempt++){
   const response=await fetch(env.api+'/rest/v1/rpc/permission_contract_probe',{
    method:'POST',headers:{apikey:env.anonKey,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(5_000)});
   if(response.ok&&!response.headers.has('x-pos-permission-hook')){disabled=true;break;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  expect(disabled).toBe(true);
  await expect(verifyCompatibilityRestRouting({restUrl:env.api+'/rest/v1',anonKey:env.anonKey}))
   .rejects.toThrow('PERMISSION_CONTRACT_REST_ROUTING_UNVERIFIED');
 }finally{
  await db.query("alter role authenticator set pgrst.db_pre_request to 'public.permission_contract_pre_request'; notify pgrst,'reload config'");
 }
});

test('TC-PERM-51 pass-through routing, atomic strict rollback and role matrix',async()=>{
 await expect(verifyCompatibilityRestRouting({restUrl:env.api+'/rest/v1',anonKey:env.anonKey})).resolves.toBe(true);
 const activationSql=readFileSync('supabase/candidate/permission-compatibility-activate.sql','utf8');
 await db.query('begin');await db.query(activationSql);await db.query('rollback');
 expect((await db.query('select strict from private.permission_contract_gate where singleton')).rows[0].strict).toBe(false);
 await db.query(activationSql);
 const anon=await call(env.anonKey),authenticated=await call(env.anonKey,env.storeJwt),marked=await call(env.anonKey,env.storeJwt,true),service=await call(serviceKey,serviceKey);
 for(const denied of[anon,authenticated])expect(denied).toMatchObject({status:426,body:{code:'WRITE_PROTOCOL_UNSUPPORTED'}});
 expect(marked.status).toBe(200);expect(service).not.toMatchObject({status:426,body:{code:'WRITE_PROTOCOL_UNSUPPORTED'}});
 const before=await businessHash(),id='50000000-0000-4000-8000-000000000099';
 const cases:[string,unknown][]=[['stores?select=id',{}],['rpc/register_write_operation',{p_operation_id:id,p_payload:{}}],
  ['rpc/execute_write_operation',{p_operation_id:id,p_payload:{}}],['rpc/get_write_operation',{p_operation_id:id}],
  ['rpc/cancel_write_operation',{p_operation_id:id}],['rpc/list_write_operations',{}],['rpc/permission_get_pos_menu',{}]];
 for(const [path,body] of cases){const result=path.startsWith('stores?')
   ? await (async()=>{const r=await fetch(env.api+'/rest/v1/'+path,{headers:{apikey:env.anonKey,authorization:'Bearer '+env.storeJwt}});return{status:r.status,body:await r.json()};})()
   : await protectedRequest(path,body);
  expect(result).toMatchObject({status:426,body:{code:'WRITE_PROTOCOL_UNSUPPORTED'}});
 }
 expect(await protectedRequest('rpc/get_write_operation',{p_operation_id:id},'0')).toMatchObject({status:426,body:{code:'WRITE_PROTOCOL_UNSUPPORTED'}});
 expect(await protectedRequest('rpc/get_write_operation',{p_operation_id:id},'1')).toMatchObject({status:426,body:{code:'WRITE_PROTOCOL_UNSUPPORTED'}});
 const insufficient=await protectedRequest('rpc/get_write_operation',{p_operation_id:id},'2');
 expect(insufficient).toMatchObject({status:200,body:{ok:false,error:{code:'EMPLOYEE_SESSION_REQUIRED'}}});
 expect(await businessHash()).toBe(before);
});

test('TC-PERM-51 missing gate singleton fails closed and is restored',async()=>{
 await db.query('delete from private.permission_contract_gate where singleton');
 const denied=await call(env.anonKey);
 expect(denied).toMatchObject({status:426,body:{code:'WRITE_PROTOCOL_UNSUPPORTED'}});
 await db.query('insert into private.permission_contract_gate(singleton,strict,contract_version) values(true,true,2)');
});

test('TC-PIN-17 preparation and activation reject an older permission marker without changing the gate',async()=>{
 for(const path of ['supabase/candidate/permission-compatibility-prepare.sql','supabase/candidate/permission-compatibility-activate.sql']) {
  await db.query('begin');
  try {
   await db.query('alter table private.permission_contract_gate drop constraint permission_contract_gate_contract_version_check');
   await db.query('update private.permission_contract_gate set contract_version=1 where singleton');
   await expect(db.query(readFileSync(path,'utf8'))).rejects.toMatchObject({message:'PERMISSION_CONTRACT_VERSION_MISMATCH'});
  } finally { await db.query('rollback'); }
  expect((await db.query('select contract_version from private.permission_contract_gate where singleton')).rows[0].contract_version).toBe(2);
 }
});
