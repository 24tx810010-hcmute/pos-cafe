// Native actual GoTrue + PostgreSQL preparation. Never reads application .env.
// GoTrue is upstream v2.197.0 with a Windows-only listener portability patch;
// its API, authentication, JWT code and migrations are unchanged.
import pg from 'pg';
import { randomBytes, createHmac, createHash } from 'node:crypto';
import { existsSync, writeFileSync, readFileSync, readdirSync, openSync, closeSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const runtime=process.env.IDEM_AUTH_RUNTIME_DIR;
const binary=process.env.IDEM_GOTRUE_BINARY;
if(!runtime||!binary||!existsSync(binary))throw new Error('Dedicated IDEM_AUTH_RUNTIME_DIR and verified IDEM_GOTRUE_BINARY required');
let occupied=false;
try{occupied=(await fetch('http://127.0.0.1:55442/health',{signal:AbortSignal.timeout(500)})).ok;}catch{}
if(occupied)throw new Error('GOTRUE_PORT_ALREADY_RUNNING: stop the previous dedicated auth process before making a fresh stack');
mkdirSync(runtime,{recursive:true});
const database=`pos_cafe_idem_test_auth_${randomBytes(6).toString('hex')}`;
const dsn=`postgresql://postgres@127.0.0.1:55439/${database}`;
const master=new pg.Client({host:'127.0.0.1',port:55439,user:'postgres',database:'postgres'});await master.connect();
try{await master.query(`create database ${database}`);}finally{await master.end();}
const db=new pg.Client({connectionString:dsn});await db.connect();
const secret=randomBytes(48).toString('hex');
const authEnv={...process.env,GOTRUE_API_HOST:'127.0.0.1',GOTRUE_API_PORT:'55442',PORT:'55442',
 API_EXTERNAL_URL:'http://127.0.0.1:55444/auth/v1',GOTRUE_SITE_URL:'http://127.0.0.1:5173',
 GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`${dsn}?sslmode=disable&search_path=auth`,GOTRUE_DB_NAMESPACE:'auth',DB_NAMESPACE:'auth',
 GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',
 GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_JWT_EXP:'86400',GOTRUE_MAILER_AUTOCONFIRM:'true',
 GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_EXTERNAL_PHONE_ENABLED:'false',GOTRUE_DISABLE_SIGNUP:'false',
 GOTRUE_DB_MAX_POOL_SIZE:'5',GOTRUE_LOG_LEVEL:'error',LOG_LEVEL:'error'};
const sign=(claims)=>{const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const payload=Buffer.from(JSON.stringify({...claims,exp:Math.floor(Date.now()/1000)+86400})).toString('base64url');return `${header}.${payload}.${createHmac('sha256',secret).update(`${header}.${payload}`).digest('base64url')}`;};
let authProcess;
try{
 await db.query('create schema auth');
 const migrate=spawnSync(binary,['migrate'],{cwd:runtime,env:authEnv,encoding:'utf8',windowsHide:true,timeout:60000});
 writeFileSync(join(runtime,'gotrue-migrate.log'),(migrate.stdout??'')+(migrate.stderr??''));
 if(migrate.status!==0)throw new Error(`GOTRUE_MIGRATION_FAILED: exit=${migrate.status}, signal=${migrate.signal}, code=${migrate.error?.code??'none'}; inspect ${join(runtime,'gotrue-migrate.log')}`);
 const authTables=(await db.query("select count(*)::integer n from information_schema.tables where table_schema='auth'")).rows[0].n;
 if(authTables<10)throw new Error('ACTUAL_GOTRUE_SCHEMA_MISSING');
 // Supabase SQL request helpers and storage catalog shell needed by baseline
 // migrations. There is no fake Auth table or Auth HTTP endpoint here.
 await db.query(`
  grant usage on schema auth,public to anon,authenticated,service_role;
  grant execute on function auth.uid() to anon,authenticated,service_role;
  alter default privileges in schema public grant all on tables to authenticated,service_role;
  alter default privileges in schema public grant all on sequences to authenticated,service_role;
  create schema storage;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key,bucket_id text references storage.buckets(id),name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
  grant usage on schema storage to anon,authenticated;grant all on storage.objects to authenticated;
 `);
 const checksums={};
 for(const name of readdirSync(resolve('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()){
  const source=readFileSync(resolve('supabase/migrations',name));await db.query(source.toString('utf8'));checksums[name]=createHash('sha256').update(source).digest('hex');
 }
 const log=openSync(join(runtime,'gotrue-serve.log'),'a');
 authProcess=spawn(binary,[],{cwd:runtime,env:authEnv,detached:true,windowsHide:true,stdio:['ignore',log,log]});authProcess.unref();closeSync(log);
 let healthy=false;
 for(let i=0;i<100;i++){
  try{const response=await fetch('http://127.0.0.1:55442/health',{signal:AbortSignal.timeout(500)});if(response.ok){healthy=true;break;}}catch{}
  await new Promise(done=>setTimeout(done,50));
 }
 if(!healthy)throw new Error('GOTRUE_HEALTH_FAILED: inspect dedicated runtime log');
 const storeIds=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
 const storePassword=randomBytes(12).toString('hex').toUpperCase();const storeSessions=[];
 for(let i=0;i<2;i++){
  const response=await fetch('http://127.0.0.1:55442/admin/users',{method:'POST',headers:{Authorization:`Bearer ${sign({role:'service_role',aud:'authenticated'})}`,'Content-Type':'application/json'},body:JSON.stringify({id:storeIds[i],email:`store${i+1}@store.pos.local`,password:storePassword,email_confirm:true,role:'authenticated'})});
  if(!response.ok)throw new Error(`GOTRUE_FIXTURE_ADMIN_CREATE_FAILED: HTTP ${response.status}`);
  const login=await fetch('http://127.0.0.1:55442/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`store${i+1}@store.pos.local`,password:storePassword})});
  if(!login.ok)throw new Error(`GOTRUE_PASSWORD_LOGIN_FAILED: HTTP ${login.status}`);
  const session=await login.json();if(session.user.id!==storeIds[i]||!session.access_token||!session.refresh_token)throw new Error('GOTRUE_SESSION_INVALID');storeSessions.push(session);
 }
 await db.query('insert into stores(id,store_no,name) values($1,1,$3),($2,2,$4)',[...storeIds,'IDEM fixture S1','IDEM fixture S2']);
 await db.query("select setval('public.store_no_seq',2,true)");
 await db.query('insert into store_settings(store_id,display_name) values($1,$3),($2,$4)',[...storeIds,'IDEM fixture S1','IDEM fixture S2']);
 for(const [suffix,storeIndex,name,role,pin]of [[11,0,'A','admin','123456'],[12,0,'B','cashier','111111'],[13,0,'C','cashier','222222'],[14,0,'E','cashier','333333'],[15,1,'X','admin','123456']])await db.query("insert into employees(id,store_id,name,role,passcode_hash) values($1,$2,$3,$4,extensions.crypt($5,extensions.gen_salt('bf')))",[`00000000-0000-4000-8000-${suffix.toString(16).padStart(12,'0')}`,storeIds[storeIndex],name,role,pin]);
 const marker=`pos-cafe-idem-${randomBytes(20).toString('hex')}`;
 await db.query('create table private.idempotency_test_environment(singleton boolean primary key default true check(singleton),marker text not null,engine text not null,migration_checksums jsonb not null,store_ids uuid[] not null);revoke all on private.idempotency_test_environment from public,anon,authenticated');
 await db.query('insert into private.idempotency_test_environment values(true,$1,$2,$3,$4)',[marker,'postgres-postgrest-gotrue',checksums,storeIds]);
 writeFileSync(join(runtime,'idempotency.env'),['VITE_DATA_MODE=supabase','VITE_SUPABASE_URL=http://127.0.0.1:55444',`VITE_SUPABASE_ANON_KEY=${sign({role:'anon'})}`,`IDEM_STORE_JWT=${storeSessions[0].access_token}`,`IDEM_STORE_S2_JWT=${storeSessions[1].access_token}`,`IDEM_OBSERVER_DSN=${dsn}`,`IDEM_TEST_MARKER=${marker}`,`IDEM_FIXTURE_STORE_IDS=${storeIds.join(',')}`,'IDEM_TEST_ENGINE=postgres-postgrest-gotrue',`IDEM_STORE_KEY=0001-${storePassword}`,`IDEM_TEST_STORE_KEY=0001-${storePassword}`,`IDEM_STORE_S2_KEY=0002-${storePassword}`].join('\n')+'\n');
 writeFileSync(join(runtime,'postgrest.conf'),[`db-uri = "postgresql://idem_authenticator@127.0.0.1:55439/${database}"`,'db-schemas = "public"','db-anon-role = "anon"',`jwt-secret = "${secret}"`,'server-host = "127.0.0.1"','server-port = 55443','db-pool = 10','log-level = "crit"'].join('\n')+'\n');
 writeFileSync(join(runtime,'provenance.json'),JSON.stringify({database,engine:'postgres-postgrest-gotrue',auth:{version:'v2.197.0',sourceCommit:'4eee58f296d9698a1c2c0ae14d7a0b379c7622d3',patch:'Windows single-listener net.ListenConfig without Unix SO_REUSEPORT; auth/JWT/migrations unchanged',pid:authProcess.pid,health:'http://127.0.0.1:55442/health',schemaTables:authTables},compatibilityOnly:['storage catalog shell (no Storage API)'],omittedServices:['Realtime','Storage API']},null,2)+'\n');
 console.log(JSON.stringify({status:'ACTUAL_GOTRUE_PASSWORD_LOGIN_VERIFIED',database,runtime,authPid:authProcess.pid,authSchemaTables:authTables,engine:'postgres-postgrest-gotrue',restConfig:join(runtime,'postgrest.conf'),envFile:join(runtime,'idempotency.env')}));
}catch(error){if(authProcess)authProcess.kill();throw error;}finally{await db.end();}
