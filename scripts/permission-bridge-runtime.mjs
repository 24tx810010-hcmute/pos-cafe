import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { migrationChecksums } from '../tests/contracts/observerPreflight.ts';
import { loadTestEnvironmentFile } from '../tests/contracts/preflight.ts';
import { seedLegacyFixture } from './permission-fixture-bootstrap.mjs';
import { digest } from './permission-preflight-core.mjs';

export const PROJECT = 'pos-cafe-perm-s31-t02-20261013';
export const LINUX_ROOT = '/var/tmp/' + PROJECT;
export const STORE_IDS = ['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'];
export const EMPLOYEE_IDS = [1,2,3,4,5].map(n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0'));
const wsl = args => execFileSync('wsl',['-d','Ubuntu-24.04','--',...args],{encoding:'utf8',maxBuffer:8*1024*1024,timeout:30000});
const configHash = text => digest(text.replaceAll('\r\n','\n').trim());
const same = (a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function runtimeProof() {
 const config=wsl(['cat',LINUX_ROOT+'/stack/supabase/config.toml']);
 if(!config.includes(`project_id = "${PROJECT}"`) || configHash(config)!==configHash(readFileSync('tests/permissions/runtime/config.toml','utf8')))
  throw new Error('ISOLATED_RUNTIME_CONFIG_MISMATCH');
 const names=['db','auth','rest','kong','storage','realtime','edge_runtime','studio','pg_meta','inbucket','vector','analytics'];
 const containers=JSON.parse(wsl(['docker','inspect',...names.map(n=>`supabase_${n}_${PROJECT}`)]));
 for(const c of containers) {
  if(c.Config.Labels?.['com.supabase.cli.project']!==PROJECT || !c.State.Running
    || (c.State.Health && c.State.Health.Status!=='healthy')) throw new Error('ISOLATED_SERVICE_NOT_HEALTHY');
  for(const ports of Object.values(c.NetworkSettings.Ports ?? {})) for(const p of ports??[])
   if(p.HostIp!=='127.0.0.1' && p.HostIp!=='::1') throw new Error('NONLOCAL_CONTAINER_PORT_REFUSED');
 }
 const db=containers[0];
 if(!db.Mounts.some(m=>m.Type==='volume' && m.Name===`supabase_db_${PROJECT}`)) throw new Error('DEDICATED_DB_VOLUME_REQUIRED');
 const cli=wsl([LINUX_ROOT+'/bin/supabase','--workdir',LINUX_ROOT+'/stack','--version']).trim();
 if(cli!=='2.117.0') throw new Error('CLI_VERSION_MISMATCH');
 return {project:PROJECT,configHash:configHash(config),cli,
  docker:wsl(['docker','version','--format','{{.Server.Version}}']).trim(),
  containers:containers.map(c=>({name:c.Name.slice(1),id:c.Id,image:c.Config.Image,imageId:c.Image,
   status:c.State.Health?.Status??'running',ports:c.NetworkSettings.Ports})),
  serviceGate:'health only; Storage/gateway and Realtime behavior remain T09/T10'};
}
export function parseBridgeEnvironment(input=process.env) {
 const env={...input};
 if(!env.IDEM_ENV_FILE || ['.env','.env.local'].includes(basename(env.IDEM_ENV_FILE))) throw new Error('EXPLICIT_FIXTURE_ENV_REQUIRED');
 loadTestEnvironmentFile(env);
 if(env.PERM_TEST_PROFILE!=='supabase-bridge-v1') throw new Error('BRIDGE_PROFILE_REQUIRED');
 const dsn=new URL(env.IDEM_OBSERVER_DSN), api=new URL(env.PERM_API_URL);
 if(dsn.protocol!=='postgresql:' || dsn.hostname!=='127.0.0.1' || dsn.port!=='63422' || dsn.pathname!=='/postgres' || dsn.search || dsn.hash
  || api.origin!=='http://127.0.0.1:63421' || api.pathname!=='/' || api.search || api.hash) throw new Error('ISOLATED_ENDPOINT_REQUIRED');
 if(!/^pos-cafe-perm-[a-f0-9]{40}$/.test(env.IDEM_TEST_MARKER??'')) throw new Error('FIXTURE_MARKER_REQUIRED');
 if(!same(env.IDEM_FIXTURE_STORE_IDS?.split(','),STORE_IDS)) throw new Error('FIXTURE_STORES_REQUIRED');
 try {
  const anon=JSON.parse(Buffer.from(env.PERM_ANON_KEY.split('.')[1],'base64url').toString());
  const actor=JSON.parse(Buffer.from(env.PERM_STORE_JWT.split('.')[1],'base64url').toString());
  if(anon.role!=='anon' || actor.role!=='authenticated' || actor.sub!==STORE_IDS[0] || !(actor.exp*1000>Date.now())) throw new Error();
 } catch {throw new Error('FIXTURE_AUTH_IDENTITY_REQUIRED');}
 return {dsn:dsn.href,api:api.origin,marker:env.IDEM_TEST_MARKER,anonKey:env.PERM_ANON_KEY,
  storeJwt:env.PERM_STORE_JWT,controlPath:env.PERM_FIXTURE_CONTROL};
}
export async function assertBridgeFixture(db,env,phase='legacy') {
 const proof=runtimeProof();
 const control=JSON.parse(readFileSync(env.controlPath,'utf8'));
 if(control.project!==PROJECT || control.marker!==env.marker || !same(control.storeIds,STORE_IDS)) throw new Error('FIXTURE_CONTROL_MISMATCH');
 const result=await db.query(`select current_database() as database,marker,engine,store_ids,migration_checksums
  from private.idempotency_test_environment where singleton`);
 const m=result.rows[0];
 const expected=migrationChecksums(process.cwd(),16);
 if(result.rowCount!==1 || !m || m.database!=='postgres' || m.marker!==env.marker || m.engine!=='supabase-bridge-v1' || !same(m.store_ids,STORE_IDS)
  || Object.keys(m.migration_checksums??{}).length!==16 || Object.entries(expected).some(([k,v])=>m.migration_checksums[k]!==v)) throw new Error('FIXTURE_IDENTITY_MISMATCH');
 if((await db.query('select count(*)::int n from public.stores where not(id=any($1::uuid[]))',[STORE_IDS])).rows[0].n!==0) throw new Error('NONFIXTURE_STORES');
 const columns=(await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='employees' and column_name='permission_revision'")).rowCount;
 if(columns!==(phase==='bridge'?1:0)) throw new Error('FIXTURE_PHASE_MISMATCH');
 const r=await fetch(env.api+'/rest/v1/rpc/permission_fixture_identity',{method:'POST',headers:{apikey:env.anonKey,Authorization:'Bearer '+env.storeJwt,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
 const identity=await r.json();
 if(!r.ok || identity.marker!==env.marker || identity.storeId!==STORE_IDS[0] || identity.database!=='postgres') throw new Error('API_OBSERVER_BINDING_MISMATCH');
 return proof;
}
export async function bootstrapBridgeRuntime(directory) {
 runtimeProof();
 const status=JSON.parse(wsl([LINUX_ROOT+'/bin/supabase','status','--workdir',LINUX_ROOT+'/stack','-o','json']));
 const dbUrl=new URL(status.DB_URL);
 if(dbUrl.hostname!=='127.0.0.1' || dbUrl.port!=='63422' || dbUrl.pathname!=='/postgres') throw new Error('CLI_ENDPOINT_MISMATCH');
 directory=resolve(directory); mkdirSync(directory,{recursive:true});
 if(existsSync(join(directory,'bridge.env'))) throw new Error('FIXTURE_ALREADY_CONFIGURED');
 const db=new pg.Client({connectionString:dbUrl.href}); await db.connect();
 try {
  if((await db.query("select to_regclass('public.stores') present")).rows[0].present) throw new Error('NONEMPTY_DATABASE_REFUSED');
  const checksums=migrationChecksums(process.cwd(),16);
  for(const name of Object.keys(checksums)) await db.query(readFileSync(join('supabase/migrations',name),'utf8'));
  const marker='pos-cafe-perm-'+randomBytes(20).toString('hex');
  await db.query(`create table private.idempotency_test_environment(singleton boolean primary key check(singleton),marker text not null,
   engine text not null,migration_checksums jsonb not null,store_ids uuid[] not null);
   revoke all on private.idempotency_test_environment from public,anon,authenticated,service_role`);
  await db.query('insert into private.idempotency_test_environment values(true,$1,$2,$3,$4)',[marker,'supabase-bridge-v1',checksums,STORE_IDS]);
 let storeJwt,refreshToken;
  for(const [i,id] of STORE_IDS.entries()) {
   const email=`permission-t02-${i}@example.test`, password=randomBytes(24).toString('hex');
   const created=await fetch(status.API_URL+'/auth/v1/admin/users',{method:'POST',headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:'Bearer '+status.SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({id,email,password,email_confirm:true})});
   const user=await created.json(); if(!created.ok || user.id!==id) throw new Error('AUTH_FIXTURE_CREATION_FAILED');
   if(i===0) {
    const response=await fetch(status.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:status.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const session=await response.json(); if(!response.ok || !session.access_token) throw new Error('AUTH_FIXTURE_SESSION_FAILED');
    storeJwt=session.access_token; refreshToken=session.refresh_token;
   }
   await db.query('insert into public.stores(id,store_no,name) values($1,$2,$3)',[id,i+1,'Synthetic T02']);
   await db.query('insert into public.store_settings(store_id,display_name) values($1,$2)',[id,'Synthetic T02']);
  }
  for(const [i,id] of EMPLOYEE_IDS.entries()) await db.query(`insert into public.employees(id,store_id,name,role,is_active,passcode_hash)
   values($1,$2,'Fixture employee',$3,true,extensions.crypt('384729',extensions.gen_salt('bf')))`,[id,STORE_IDS[i<3?0:1],i===2?'cashier':'admin']);
  await seedLegacyFixture(db,STORE_IDS,EMPLOYEE_IDS);
  // Fixture-only binding probe, absent from production migrations. Session JWT
  // proves the tenant; random marker binds that service to this observer DB.
  await db.query(`create function public.permission_fixture_identity() returns jsonb language sql stable security definer set search_path=pg_catalog as $$
   select jsonb_build_object('marker',marker,'database',current_database(),'storeId',auth.uid())
   from private.idempotency_test_environment where singleton and auth.uid()=any(store_ids) $$;
   revoke all on function public.permission_fixture_identity() from public,anon,authenticated,service_role;
   grant execute on function public.permission_fixture_identity() to authenticated;
   notify pgrst,'reload schema'`);
  const controlPath=join(directory,'fixture-control.json');
  writeFileSync(controlPath,JSON.stringify({schemaVersion:1,project:PROJECT,marker,employeeIds:EMPLOYEE_IDS,storeIds:STORE_IDS,refreshToken}),{mode:0o600});
  writeFileSync(join(directory,'bridge.env'),[
   'PERM_TEST_PROFILE=supabase-bridge-v1','IDEM_OBSERVER_DSN='+dbUrl.href,'PERM_API_URL='+status.API_URL,
   'IDEM_TEST_MARKER='+marker,'IDEM_FIXTURE_STORE_IDS='+STORE_IDS.join(','),'PERM_ANON_KEY='+status.ANON_KEY,
   'PERM_STORE_JWT='+storeJwt,'PERM_FIXTURE_CONTROL='+controlPath].join('\n')+'\n',{mode:0o600});
  return {project:PROJECT,envFile:join(directory,'bridge.env'),profile:'supabase-bridge-v1'};
 } finally {await db.end();}
}
// Explicit fixture setup: renew the store Auth session before a run. This never
// changes employee PINs, roles, business rows or an external project's identity.
export async function refreshBridgeRuntime(directory) {
 runtimeProof(); directory=resolve(directory);
 const file=join(directory,'bridge.env'), controlFile=join(directory,'fixture-control.json');
 const settings={IDEM_ENV_FILE:file}; loadTestEnvironmentFile(settings);
 const control=JSON.parse(readFileSync(controlFile,'utf8'));
 if(control.project!==PROJECT || control.marker!==settings.IDEM_TEST_MARKER || !same(control.storeIds,STORE_IDS)) throw new Error('FIXTURE_CONTROL_MISMATCH');
 const status=JSON.parse(wsl([LINUX_ROOT+'/bin/supabase','status','--workdir',LINUX_ROOT+'/stack','-o','json']));
 if(status.DB_URL!==settings.IDEM_OBSERVER_DSN || status.API_URL!==settings.PERM_API_URL
  || new URL(status.DB_URL).hostname!=='127.0.0.1' || new URL(status.DB_URL).port!=='63422' || status.API_URL!=='http://127.0.0.1:63421') throw new Error('CLI_ENDPOINT_MISMATCH');
 const db=new pg.Client({connectionString:status.DB_URL}); await db.connect();
 try {
  const row=(await db.query('select marker,engine,store_ids from private.idempotency_test_environment where singleton')).rows[0];
  if(row?.marker!==control.marker || row.engine!=='supabase-bridge-v1' || !same(row.store_ids,STORE_IDS)) throw new Error('FIXTURE_IDENTITY_MISMATCH');
 } finally {await db.end();}
 let response;
 if(control.refreshToken) response=await fetch(status.API_URL+'/auth/v1/token?grant_type=refresh_token',{
  method:'POST',headers:{apikey:status.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:control.refreshToken})});
 else {
  // Compatibility for the first T02 fixture, created before refresh persistence.
  const password=randomBytes(24).toString('hex');
  const changed=await fetch(status.API_URL+'/auth/v1/admin/users/'+STORE_IDS[0],{method:'PUT',
   headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:'Bearer '+status.SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({password})});
  const user=await changed.json(); if(!changed.ok || user.id!==STORE_IDS[0] || user.email!=='permission-t02-0@example.test') throw new Error('AUTH_FIXTURE_REFRESH_FAILED');
  response=await fetch(status.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:status.ANON_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({email:user.email,password})});
 }
 const session=await response.json(); if(!response.ok || !session.access_token || !session.refresh_token) throw new Error('AUTH_FIXTURE_REFRESH_FAILED');
 control.refreshToken=session.refresh_token;
 writeFileSync(controlFile,JSON.stringify(control),{mode:0o600});
 writeFileSync(file,readFileSync(file,'utf8').replace(/^PERM_STORE_JWT=.*$/m,'PERM_STORE_JWT='+session.access_token),{mode:0o600});
 parseBridgeEnvironment({IDEM_ENV_FILE:file});
 return {project:PROJECT,envFile:file,refreshed:true};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 try {
  if(!['bootstrap','refresh'].includes(process.argv[2]) || !process.argv[3] || process.argv.length!==4) throw new Error('USAGE_BOOTSTRAP_OR_REFRESH_RUNTIME_DIRECTORY');
  console.log(JSON.stringify(await (process.argv[2]==='bootstrap'?bootstrapBridgeRuntime:refreshBridgeRuntime)(process.argv[3])));
 } catch(error) { console.error(error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'RUNTIME_SETUP_FAILED'); process.exitCode=1; }
}
