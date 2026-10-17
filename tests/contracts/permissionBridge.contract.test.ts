import { beforeAll, afterAll, afterEach, expect, test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { parseBridgeEnvironment, assertBridgeFixture, STORE_IDS, EMPLOYEE_IDS } from '../../scripts/permission-bridge-runtime.mjs';
import { createBridgeOracle, LEGACY_PERMISSION_CODES } from '../../scripts/permission-bridge-oracle.mjs';
import { permissionFingerprint, digest } from '../../scripts/permission-preflight-core.mjs';
import { hasPermission, canAccessModule, isEmployeeRoleEnabledInUi } from '../../src/core/guards.ts';
import { deterministicUuid } from '../../src/adapters/supabase/deterministicId.ts';
import { loadTestEnvironmentFile } from './preflight.ts';

const env=parseBridgeEnvironment();
const db=new pg.Client({connectionString:env.dsn,connectionTimeoutMillis:5000,statement_timeout:30000});
const migration=readFileSync('supabase/migrations/017_permission_catalog_bridge.sql','utf8');
const revert=readFileSync('scripts/sql/permission-t02-revert.sql','utf8');
const evidence:any={schemaVersion:1,runId:process.env.PERM_RUN_ID,sourceFingerprint:permissionFingerprint(),profile:'supabase-bridge-v1',
 migrationHash:digest(migration),revertHash:digest(revert),comparisons:[],checks:[],startedAt:new Date().toISOString()};
let applied=false;
let legacyTables:Array<{schema:string;name:string}>;
let baselineFunctions:any[];
let baselineAcl:any[];
const q=(s:string)=>'"'+s.replaceAll('"','""')+'"';
async function legacyIntegrity() {
 const values=[];
 for(const t of legacyTables) values.push((await db.query(`select count(*)::text n,
 md5(coalesce(string_agg(md5((to_jsonb(t)-'permission_revision')::text),'' order by md5((to_jsonb(t)-'permission_revision')::text)),'')) h
 from ${q(t.schema)}.${q(t.name)} t`)).rows[0]);
 return digest(values); // Internal only; never serialized into artifacts.
}
const acl=()=>db.query(`select n.nspname,c.relname,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where (n.nspname='public' or n.nspname='private') and c.relkind='r' and (n.nspname||'.'||c.relname)=any($1::text[]) order by 1,2`,[legacyTables.map(t=>t.schema+'.'+t.name)]).then(r=>r.rows);
beforeAll(async()=>{
 await db.connect(); evidence.runtime=await assertBridgeFixture(db,env);
 // Register one pending K through the unchanged protocol before migration.
 // Together with the bootstrap terminal K, this prevents an empty parity check.
 const session=await rpc('start_employee_session',{p_employee_id:EMPLOYEE_IDS[0],p_pin:'384729'});
 const pendingPayload={schemaVersion:1,kind:'pay_order',orderId:await deterministicUuid(STORE_IDS[0],'permission-fixture.open-order'),
  paymentId:randomUUID(),expectedVersion:0,method:'cash',receivedAmount:50000};
 const pending=await rpc('register_write_operation',{p_operation_id:randomUUID(),p_payload:pendingPayload},session.token);
 expect(pending.operation.status).toBe('pending'); await rpc('revoke_employee_session',{},session.token);
 evidence.preexistingKinds=(await db.query("select count(*) filter(where status='pending')::int pending,count(*) filter(where status='applied')::int terminal from public.write_operations")).rows[0];
 expect(evidence.preexistingKinds.pending).toBeGreaterThan(0); expect(evidence.preexistingKinds.terminal).toBeGreaterThan(0);
 legacyTables=(await db.query("select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','private') order by 1,2")).rows;
 baselineFunctions=(await db.query("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' order by 1")).rows;
 baselineAcl=await acl(); const before=await legacyIntegrity();
 await db.query(migration); applied=true;
 expect(await legacyIntegrity()===before).toBe(true);
 expect(await acl()).toEqual(baselineAcl);
 evidence.checks.push('additive preserved all legacy rows, credentials, sessions, K/payload/R1 and table ACLs');
 evidence.runtimeAfter=await assertBridgeFixture(db,env,'bridge');
});
afterEach(async()=>{await db.query('rollback');});
afterAll(async()=>{
 try {
  await db.query('rollback');
  if(applied) {
   const before=await legacyIntegrity(); await db.query(revert); applied=false;
   expect(await legacyIntegrity()===before).toBe(true); expect(await acl()).toEqual(baselineAcl);
   // Restore the exact old helper definition for byte-level rehearsal parity;
   // the committed revert is separately checked against all legacy profiles.
   const original=baselineFunctions.find(f=>f.signature.startsWith('has_employee_permission('));
   const actual=(await db.query("select provolatile,prosecdef,proconfig,proacl::text acl from pg_proc where oid='public.has_employee_permission(public.employee_role,jsonb,text)'::regprocedure")).rows[0];
   expect(actual).toEqual({provolatile:'i',prosecdef:false,proconfig:null,acl:original.acl});
   const oracle=createBridgeOracle();
   const failures=(await db.query(`select count(*)::int n from jsonb_array_elements($1::jsonb) p cross join unnest($2::text[]) code
    where public.has_employee_permission((p->>'role')::public.employee_role,p->'permissionOverrides',code)
    is distinct from ((p->'expected'->'configuredEffective') ? code)`,[JSON.stringify(oracle.profiles),LEGACY_PERMISSION_CODES])).rows[0].n;
   expect(failures).toBe(0);
   await db.query(original.definition);
   expect((await db.query("select to_regclass('public.permission_catalog') catalog,to_regclass('private.employee_admin_requests') registry")).rows[0]).toEqual({catalog:null,registry:null});
   evidence.revert={passed:true,profilesCompared:6144,legacyRowsAndAclPreserved:true};
  }
 } finally {
  evidence.finishedAt=new Date().toISOString(); evidence.sourceAfter=permissionFingerprint();
  if(process.env.PERM_BRIDGE_EVIDENCE_FILE) writeFileSync(process.env.PERM_BRIDGE_EVIDENCE_FILE,JSON.stringify(evidence,null,2)+'\n');
  await db.end();
 }
});

const codes=['floor.view','order.create','order.update','order.voidOpen','payment.take','orderHistory.view','order.voidPaid',
 'menu.manage','floor.manage','employee.manage','employee.permission.edit','report.view','settings.manage','data.clearDemo','receipt.reprint'].sort();
const defaults:Record<string,string[]>={owner:[...codes],manager:codes.filter(c=>!['employee.permission.edit','settings.manage','data.clearDemo'].includes(c)),
 cashier:['floor.view','order.create','order.update','order.voidOpen','payment.take','orderHistory.view','receipt.reprint'].sort(),
 waiter:['floor.view','order.create','order.update'].sort(),kitchen:[]};
test('TC-PERM-01/db five roles, 75 cells, 15 codes and exact enabled/selectable flags',async()=>{
 expect((await db.query('select code,enabled,selectable from public.permission_roles order by code')).rows).toEqual([
  {code:'cashier',enabled:true,selectable:true},{code:'kitchen',enabled:false,selectable:false},{code:'manager',enabled:true,selectable:true},
  {code:'owner',enabled:true,selectable:false},{code:'waiter',enabled:true,selectable:true}]);
 expect((await db.query('select code from public.permission_catalog order by code')).rows.map(r=>r.code)).toEqual(codes);
 for(const [role,expected] of Object.entries(defaults)) expect((await db.query('select private.configured_employee_permissions($1,null) rights',[role])).rows[0].rights).toEqual(expected);
 expect((await db.query('select code from public.permission_catalog where baseline')).rows).toEqual([{code:'floor.view'}]);
 expect((await db.query('select code from public.permission_catalog where owner_only')).rows).toEqual([{code:'data.clearDemo'}]);
});
test.each([
 ['null',null,null],['empty arrays',{grants:[],denies:[]},null],
 ['redundant default',{grants:['order.create'],denies:[]},null],
 ['duplicate grant',{grants:['order.voidPaid','order.voidPaid'],denies:[]},{grants:['order.voidPaid'],denies:[]}],
 ['deny default beats grant',{grants:['payment.take'],denies:['payment.take']},{grants:[],denies:['payment.take']}],
 ['deny nondefault beats grant',{grants:['order.voidPaid'],denies:['order.voidPaid']},null],
 ['irrelevant deny',{grants:[],denies:['report.view']},null],
 ['100 repeated grants',{grants:Array(100).fill('order.voidPaid'),denies:[]},{grants:['order.voidPaid'],denies:[]}],
] as const)('TC-PERM-04/db normalize %s',async(_name,value,expected)=>{
 expect((await db.query('select private.normalize_permission_overrides($1,$2::jsonb) result',['cashier',JSON.stringify(value)])).rows[0].result).toEqual(expected);
});
test.each([
 ['empty object',{},'INVALID_EMPLOYEE_REQUEST'],['array',[],'INVALID_EMPLOYEE_REQUEST'],
 ['missing denies',{grants:[]},'INVALID_EMPLOYEE_REQUEST'],['wrong grants',{grants:null,denies:[]},'INVALID_EMPLOYEE_REQUEST'],
 ['wrong item',{grants:[1],denies:[]},'INVALID_EMPLOYEE_REQUEST'],['unknown code',{grants:['x.invalid'],denies:[]},'INVALID_EMPLOYEE_REQUEST'],
 ['extra field',{grants:[],denies:[],actorRole:'owner'},'INVALID_EMPLOYEE_REQUEST'],
 ['101 items',{grants:Array(101).fill('order.create'),denies:[]},'INVALID_EMPLOYEE_REQUEST'],
 ['baseline deny',{grants:[],denies:['floor.view']},'PERMISSION_BASELINE_REQUIRED'],
 ['owner-only grant',{grants:['data.clearDemo'],denies:[]},'OWNER_ONLY_PERMISSION'],
] as const)('TC-PERM-04/db reject %s',async(_name,value,error)=>{
 await expect(db.query('select private.normalize_permission_overrides($1,$2::jsonb)',['cashier',JSON.stringify(value)])).rejects.toMatchObject({message:error});
});
test('TC-PERM-04/db read-only waiter fixture keeps history/report separate from payment and reprint',async()=>{
 const overrides={grants:['report.view','orderHistory.view'],denies:['order.create','order.update']};
 expect((await db.query('select private.configured_employee_permissions($1,$2::jsonb) rights',['waiter',overrides])).rows[0].rights).toEqual(['floor.view','orderHistory.view','report.view']);
 overrides.grants.push('receipt.reprint');
 expect((await db.query('select private.configured_employee_permissions($1,$2::jsonb) rights',['waiter',overrides])).rows[0].rights).toEqual(['floor.view','orderHistory.view','receipt.reprint','report.view']);
 await expect(db.query("select private.normalize_permission_overrides('accountant',null)")).rejects.toMatchObject({message:'INVALID_EMPLOYEE_REQUEST'});
});

test('TC-PERM-50/db 6144 bridge profiles agree with independent oracle, legacy SQL and current UI guards',async()=>{
 const oracle=createBridgeOracle();
 const original=baselineFunctions.find(f=>f.signature.startsWith('has_employee_permission('));
 await db.query(original.definition.replace('FUNCTION public.has_employee_permission(', 'FUNCTION private.permission_test_original('));
 await db.query('revoke all on function private.permission_test_original(public.employee_role,jsonb,text) from public,anon,authenticated,service_role');
 try {
  const rows=(await db.query(`select p->>'id' id,private.legacy_permission_snapshot((p->>'role')::public.employee_role,p->'permissionOverrides',(p->>'isActive')::boolean) actual,
   (select coalesce(jsonb_agg(code order by code),'[]'::jsonb) from unnest($2::text[]) code
    where private.permission_test_original((p->>'role')::public.employee_role,p->'permissionOverrides',code)) original,
   (select coalesce(jsonb_agg(code order by code),'[]'::jsonb) from unnest($2::text[]) code
    where public.has_employee_permission((p->>'role')::public.employee_role,p->'permissionOverrides',code)) wrapper
   from jsonb_array_elements($1::jsonb) p`,[JSON.stringify(oracle.profiles),LEGACY_PERMISSION_CODES])).rows;
  const byId=new Map(rows.map(r=>[r.id,r]));
  for(const profile of oracle.profiles) {
   const row=byId.get(profile.id), expected={...profile.expected,configuredEffective:[...profile.expected.configuredEffective].sort(),actionPermissions:[...profile.expected.actionPermissions].sort()};
   expect(row.actual,profile.id).toEqual(expected); expect(row.original,profile.id).toEqual(expected.configuredEffective); expect(row.wrapper,profile.id).toEqual(expected.configuredEffective);
   const employee={role:profile.role,isActive:profile.isActive,permissionOverrides:profile.permissionOverrides} as any;
   expect(LEGACY_PERMISSION_CODES.filter(c=>hasPermission(employee,c as any)).sort(),profile.id).toEqual(expected.actionPermissions);
   expect(isEmployeeRoleEnabledInUi(profile.role as any)).toBe(expected.roleEnabledInUi);
   for(const module of ['floor','order','payment','orderHistory','menuEditor','floorEditor','employees','report','settings','clearDemo','kitchen'])
    expect(canAccessModule(employee,module as any),profile.id+'/'+module).toBe(expected.accessibleModules.includes(module));
   evidence.comparisons.push({id:profile.id,passed:true});
  }
  expect(rows).toHaveLength(6144);
 } finally {await db.query('drop function private.permission_test_original(public.employee_role,jsonb,text)');}
});
test.each([null,{}, {grants:[],denies:[]},{grants:['payment.take','payment.take'],denies:['payment.take','payment.take']}])('TC-PERM-50/db null, empty and duplicate legacy override forms %#',async(value)=>{
 const result=(await db.query("select public.has_employee_permission('cashier',$1,'payment.take') allowed",[value])).rows[0];
 expect(result.allowed).toBe(!(value as any)?.denies?.length);
});
test('TC-PERM-50/db legacy null permission and unknown explicit grants retain old helper semantics',async()=>{
 for(const role of ['admin','cashier','kitchen']) {
  expect((await db.query('select public.has_employee_permission($1,null,null) allowed',[role])).rows[0].allowed).toBe(role==='kitchen'?false:null);
  expect((await db.query('select public.has_employee_permission($1,$2,\'legacy.unknown\') allowed',[role,{grants:['legacy.unknown'],denies:[]}])).rows[0].allowed).toBe(true);
 }
});
test('TC-PERM-50/db catalog maintenance changes once per transaction and leaves legacy bridge untouched',async()=>{
 const revision=(await db.query('select revision from public.permission_catalog_state')).rows[0].revision;
 await db.query('begin');
 await db.query("update public.permission_roles set label_vi=label_vi where code='manager'");
 expect((await db.query('select revision from public.permission_catalog_state')).rows[0].revision).toBe(revision);
 await db.query("update public.permission_roles set label_vi='Quản lý kiểm thử' where code='manager'");
 await db.query("delete from public.role_permission_defaults where role_code='cashier' and permission_code='payment.take'");
 expect(BigInt((await db.query('select revision from public.permission_catalog_state')).rows[0].revision)).toBe(BigInt(revision)+1n);
 expect((await db.query("select public.has_employee_permission('cashier',null,'payment.take') allowed")).rows[0].allowed).toBe(true);
 await db.query('set constraints all immediate');
});
test('TC-PERM-01/db two catalog writers serialize and do not lose revisions',async()=>{
 const other=new pg.Client({connectionString:env.dsn,statement_timeout:10000}); await other.connect();
 const revision=BigInt((await db.query('select revision from public.permission_catalog_state')).rows[0].revision);
 let pending:Promise<any>|undefined;
 try {
  await db.query('begin'); await db.query("update public.permission_roles set label_vi='Writer one' where code='manager'");
  const pid=(await db.query('select pg_backend_pid() pid')).rows[0].pid;
  const otherPid=(await other.query('select pg_backend_pid() pid')).rows[0].pid;
  await other.query('begin');
  pending=other.query("update public.permission_roles set label_vi='Writer two' where code='cashier'");
  // Attach a rejection handler while proving the database lock, not a guessed delay.
  pending.catch(()=>{});
  let blocked=false;
  for(let i=0;i<100;i++) {
   blocked=(await db.query('select $1=any(pg_blocking_pids($2)) blocked',[pid,otherPid])).rows[0].blocked;
   if(blocked) break; await new Promise(r=>setTimeout(r,10));
  }
  expect(blocked).toBe(true); await db.query('commit'); await pending; await other.query('commit');
  expect(BigInt((await db.query('select revision from public.permission_catalog_state')).rows[0].revision)).toBe(revision+2n);
  evidence.checks.push('two catalog writers: proven database wait, no lost revision');
 } finally {
  await db.query('rollback'); if(pending) await pending.catch(()=>{}); await other.query('rollback'); await other.end();
  await db.query("update public.permission_roles set label_vi=case code when 'manager' then 'Quản lý' else 'Thu ngân' end where code in ('manager','cashier')");
 }
});
test.each([
 "delete from public.role_permission_defaults where role_code='owner' and permission_code='report.view'",
 "delete from public.role_permission_defaults where role_code='cashier' and permission_code='floor.view'",
 "delete from public.permission_catalog_state",
 "insert into public.permission_roles values('accountant','Kế toán',true,true)",
 "insert into public.role_permission_defaults values('cashier','data.clearDemo')",
 "update public.permission_roles set enabled=true where code='kitchen'",
 "truncate public.permission_catalog_state",
 "update public.employees set permission_revision=-1",
])('TC-PERM-01/db catalog and revision constraints reject invalid state %#',async(sql)=>{
 await db.query('begin');
 await expect(db.query(sql+'; set constraints all immediate')).rejects.toMatchObject({code:'23514'});
});
test('TC-PERM-50/db old RPC definitions and grants stay closed; new catalog and secrets are inaccessible',async()=>{
 for(const f of baselineFunctions.filter(f=>!f.signature.startsWith('has_employee_permission('))) {
  const row=(await db.query('select pg_get_functiondef($1::regprocedure) definition,proacl::text acl from pg_proc where oid=$1::regprocedure',[f.signature])).rows[0];
  expect(row).toEqual({definition:f.definition,acl:f.acl});
 }
 const exposed=(await db.query(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname like '%permission%' and p.proname<>'permission_fixture_identity'
  and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))`)).rows[0].n;
 expect(exposed).toBe(0);
 expect((await db.query("select has_schema_privilege('authenticated','private','usage') usage,has_function_privilege('authenticated','private.is_verified_admin()','execute') helper")).rows[0]).toEqual({usage:true,helper:true});
 for(const role of ['anon','authenticated','service_role']) for(const table of ['public.permission_roles','public.permission_catalog','public.role_permission_defaults',
  'public.permission_catalog_state','private.permission_request_mac_keys','private.employee_admin_requests','private.bootstrap_requests','private.legacy_permission_defaults']) {
  expect((await db.query('select has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER\') exposed',[role,table])).rows[0].exposed).toBe(false);
 }
 expect((await db.query("select tablename from pg_publication_tables where schemaname='private' or tablename in ('permission_roles','permission_catalog','role_permission_defaults','permission_catalog_state')")).rows).toEqual([]);
 for(const table of ['orders','payments','order_items','order_item_options']) expect((await db.query("select has_table_privilege('authenticated',$1,'INSERT,UPDATE,DELETE') exposed",['public.'+table])).rows[0].exposed).toBe(false);
});

async function rpc(name:string,args:Record<string,unknown>,token?:string) {
 const headers:Record<string,string>={apikey:env.anonKey,Authorization:'Bearer '+env.storeJwt,'Content-Type':'application/json'};
 if(token) headers['x-pos-employee-token']=token;
 const response=await fetch(env.api+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
 const data=await response.json(); if(!response.ok) throw new Error('RPC_HTTP_'+response.status);
 return data;
}
test('TC-PERM-50/REST real session, create, update, pay, split, void and replay preserve protocol v1',async()=>{
 const login=await rpc('start_employee_session',{p_employee_id:EMPLOYEE_IDS[0],p_pin:'384729'});
 expect(typeof login.token).toBe('string');
 const token=login.token, menu=await deterministicUuid(STORE_IDS[0],'permission-fixture.menu');
 const run=async(payload:any)=>{
  const k=randomUUID(); expect((await rpc('register_write_operation',{p_operation_id:k,p_payload:payload},token)).ok).toBe(true);
  const result=await rpc('execute_write_operation',{p_operation_id:k,p_payload:payload},token);
  expect(result.ok).toBe(true); expect(result.operation.status,payload.kind+'/'+payload.action+': '+result.operation.error?.code).toBe('applied');
  const replay=await rpc('execute_write_operation',{p_operation_id:k,p_payload:payload},token);
  expect(replay.operation.result).toEqual(result.operation.result); return result.operation.result;
 };
 expect(await rpc('get_write_capabilities',{},token)).toEqual({writeProtocolVersion:1,maxPayloadBytes:262144,pendingTtlSeconds:86400});
 const order=randomUUID(),line=randomUUID();
 const created=await run({schemaVersion:1,kind:'submit_order_changes',action:'create',orderId:order,expectedVersion:null,orderType:'takeaway',tableId:null,
  newLines:[{id:line,menuItemId:menu,quantity:3,quotedBasePrice:30000,options:[]}]});
 const updated=await run({schemaVersion:1,kind:'submit_order_changes',action:'update',orderId:order,expectedVersion:created.order.lockVersion,
  retainedLines:[{sourceItemId:line,quantity:3,note:'T02'}],newLines:[]});
 const split=await run({schemaVersion:1,kind:'pay_order_items',orderId:order,paymentId:randomUUID(),newOrderId:randomUUID(),
  expectedVersion:updated.order.lockVersion,method:'cash',receivedAmount:50000,lines:[{orderItemId:line,quantity:1,splitItemId:randomUUID()}]});
 const version=(await db.query('select lock_version from public.orders where id=$1',[order])).rows[0].lock_version;
 const paid=await run({schemaVersion:1,kind:'pay_order',orderId:order,paymentId:randomUUID(),expectedVersion:version,method:'cash',receivedAmount:100000});
 expect(paid.payment.amount).toBe(60000); expect(split.payment.amount).toBe(30000);
 await run({schemaVersion:1,kind:'void_order',orderId:order,expectedVersion:paid.order.lockVersion,reason:'duplicate'});
 const openId=randomUUID();
 const open=await run({schemaVersion:1,kind:'submit_order_changes',action:'create',orderId:openId,expectedVersion:null,orderType:'takeaway',tableId:null,
  newLines:[{id:randomUUID(),menuItemId:menu,quantity:1,quotedBasePrice:30000,options:[]}]});
 const voided=await run({schemaVersion:1,kind:'submit_order_changes',action:'void_open',orderId:openId,expectedVersion:open.order.lockVersion});
 expect(voided.order.status).toBe('void');
 const receipt=await rpc('get_payment_receipt',{p_order_id:order},token);
 expect(receipt.ok).toBe(false);
 await rpc('revoke_employee_session',{},token);
 expect((await rpc('get_write_capabilities',{},token)).error.code).toBe('EMPLOYEE_SESSION_REQUIRED');
 evidence.checks.push('real Auth/REST protocol v1: create/update/split/pay/void/replay/session revoke');
});
test('TC-PERM-50/REST direct catalog, registry and private schema access fail',async()=>{
 for(const path of ['/permission_catalog?select=*','/role_permission_defaults?select=*','/employee_admin_requests?select=*']) {
  const response=await fetch(env.api+'/rest/v1'+path,{headers:{apikey:env.anonKey,Authorization:'Bearer '+env.storeJwt}});
  expect(response.status).toBeGreaterThanOrEqual(400);
 }
 const response=await fetch(env.api+'/rest/v1/permission_request_mac_keys',{headers:{apikey:env.anonKey,Authorization:'Bearer '+env.storeJwt,'Accept-Profile':'private'}});
 expect(response.status).toBe(406);
});
test('TC-PERM-50/REST revoked action refuses execution without cancelling pending K',async()=>{
 const token=(await rpc('start_employee_session',{p_employee_id:EMPLOYEE_IDS[2],p_pin:'384729'})).token;
 const payload={schemaVersion:1,kind:'pay_order',orderId:await deterministicUuid(STORE_IDS[0],'permission-fixture.open-order'),
  paymentId:randomUUID(),expectedVersion:0,method:'cash',receivedAmount:50000};
 const k=randomUUID(); const first=await rpc('register_write_operation',{p_operation_id:k,p_payload:payload},token);
 expect(first.operation.status).toBe('pending');
 const before=(await db.query('select payload,expires_at,status,result from public.write_operations where operation_id=$1',[k])).rows[0];
 try {
  await db.query('update public.employees set permission_overrides=$2 where id=$1',[EMPLOYEE_IDS[2],{grants:[],denies:['payment.take']}]);
  const denied=await rpc('execute_write_operation',{p_operation_id:k,p_payload:payload},token);
  expect(denied.error.code).toBe('FORBIDDEN');
  expect((await db.query('select payload,expires_at,status,result from public.write_operations where operation_id=$1',[k])).rows[0]).toEqual(before);
  expect((await db.query('select count(*)::int n from public.payments where id=$1',[payload.paymentId])).rows[0].n).toBe(0);
 } finally {
  await db.query('update public.employees set permission_overrides=null where id=$1',[EMPLOYEE_IDS[2]]);
  await rpc('revoke_employee_session',{},token);
 }
});
test('TC-PERM-50/preflight rejects config, marker, phase and service binding drift before migration',async()=>{
 await expect(assertBridgeFixture(db,{...env,marker:'pos-cafe-perm-'+'0'.repeat(40)},'bridge')).rejects.toThrow('FIXTURE_CONTROL_MISMATCH');
 await expect(assertBridgeFixture(db,env,'legacy')).rejects.toThrow('FIXTURE_PHASE_MISMATCH');
 await db.query('begin');
 await db.query("update private.idempotency_test_environment set engine='wrong-engine'");
 await expect(assertBridgeFixture(db,env,'bridge')).rejects.toThrow('FIXTURE_IDENTITY_MISMATCH');
});
test('TC-PERM-50/db app callers cannot execute bridge internals or edit row revision',async()=>{
 for(const sql of ["select private.normalize_permission_overrides('cashier',null)",
  'select secret_bytes from private.permission_request_mac_keys',
  'update public.employees set permission_revision=99']) {
  await db.query('begin'); await db.query('set local role authenticated');
  await expect(db.query(sql)).rejects.toMatchObject({code:'42501'}); await db.query('rollback');
 }
});
test('TC-PERM-50/db revert refuses a revision already used by candidate consumers',async()=>{
 await db.query('begin'); await db.query('update public.employees set permission_revision=1 where id=$1',[EMPLOYEE_IDS[0]]);
 await expect(db.query(revert)).rejects.toMatchObject({message:'PERMISSION_REVERT_AFTER_USE_REFUSED'});
 await db.query('rollback');
 expect((await db.query("select to_regclass('public.permission_catalog') present")).rows[0].present).toBe('permission_catalog');
 expect((await db.query('select permission_revision from public.employees where id=$1',[EMPLOYEE_IDS[0]])).rows[0].permission_revision).toBe('0');
});
test.each([
 ['implicit env',{IDEM_ENV_FILE:undefined},'EXPLICIT_FIXTURE_ENV_REQUIRED'],
 ['application env',{IDEM_ENV_FILE:'D:/Workspace/pos-cafe/.env.local'},'EXPLICIT_FIXTURE_ENV_REQUIRED'],
 ['wrong profile',{PERM_TEST_PROFILE:'candidate'},'BRIDGE_PROFILE_REQUIRED'],
 ['remote observer',{IDEM_OBSERVER_DSN:'postgresql://example.invalid/postgres'},'ISOLATED_ENDPOINT_REQUIRED'],
 ['wrong database',{IDEM_OBSERVER_DSN:'postgresql://postgres@127.0.0.1:63422/other'},'ISOLATED_ENDPOINT_REQUIRED'],
 ['remote API',{PERM_API_URL:'https://example.invalid'},'ISOLATED_ENDPOINT_REQUIRED'],
 ['missing marker',{IDEM_TEST_MARKER:''},'FIXTURE_MARKER_REQUIRED'],
 ['wrong stores',{IDEM_FIXTURE_STORE_IDS:STORE_IDS[0]},'FIXTURE_STORES_REQUIRED'],
 ['invalid Auth JWT',{PERM_STORE_JWT:'invalid'},'FIXTURE_AUTH_IDENTITY_REQUIRED'],
] as const)('TC-PERM-50/preflight refuses %s',(_name,patch,error)=>{
 const input={...process.env};loadTestEnvironmentFile(input);
 expect(()=>parseBridgeEnvironment({...input,...patch})).toThrow(error);
});
