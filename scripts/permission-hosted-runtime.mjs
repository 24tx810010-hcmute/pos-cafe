import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {LocalBackupRuntime,literal,quote} from './permission-backup-v2-local.mjs';
import {assert,hash,stable,SHA,fail} from './permission-hosted-schema.mjs';
import {CERTIFIED_HOSTED_PROFILES} from './permission-hosted-profile.mjs';
import {globalsReplayPlan} from './permission-hosted-globals.mjs';

// Reuse only the pinned LOCAL process/identity/ACL guards, never a v2 report or
// capture recipe. Every HP1 database, archive and receipt is newly produced.
export class HostedLocalRuntime extends LocalBackupRuntime {
 constructor(config){super({...config,namespace:'v2-'+config.namespace});assert(/^hp1-[a-z0-9-]{4,32}$/.test(config.namespace));this.provenance='LOCAL_SYNTHETIC';}
 create(label,{bootstrap='postgres'}={}){
  assert(/^[a-z0-9-]{1,30}$/.test(label)&&['postgres','hp1_bootstrap'].includes(bootstrap));
  const instance=randomUUID(),container=`pos-cafe-${this.namespace}-${label}-${instance.slice(0,8)}`,volume=container+'-data';
  const e={instance,container,volume,image:this.image,created:new Date().toISOString(),bootstrap};
  fs.writeFileSync(path.join(this.privateRoot,container+'-intent.json'),stable(e),{flag:'wx',mode:0o600});
  this.docker(['volume','create','--label','pos-cafe-backup-v2='+instance,volume]);
  const init=`umask 077; mkdir -p /lab/pgdata; chown postgres:postgres /lab /lab/pgdata; chmod 0700 /lab /lab/pgdata; gosu postgres initdb -D /lab/pgdata -U ${bootstrap} --auth-local=trust --auth-host=reject --encoding=UTF8 --locale=C.UTF-8; exec gosu postgres postgres -D /lab/pgdata -c listen_addresses= -c unix_socket_directories=/lab -c shared_preload_libraries= -c max_connections=30 -c log_statement=all -c 'log_line_prefix=HP1 pid=%p app=%a user=%u db=%d '`;
  this.docker(['run','-d','--name',container,'--network','none','--label','pos-cafe-backup-v2='+instance,'--mount',`type=volume,source=${volume},target=/lab`,'--entrypoint','/bin/bash',this.image,'-ceu',init]);
  e.id=JSON.parse(this.docker(['inspect','--format','{{json .Id}}',container]));this.owned.push(e);
  fs.writeFileSync(path.join(this.privateRoot,container+'-target.json'),stable(e),{flag:'wx',mode:0o600});
  this.docker(['exec',container,'bash','-ceu',`for n in $(seq 1 30); do pg_isready -h /lab -U ${bootstrap} -d postgres >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1`]);this.guard(e);return e;
 }
 async identity(target){this.guard(target);return JSON.parse(this.sql(target,"select json_build_object('database',current_database(),'actor',current_user,'sessionUser',session_user,'pid',pg_backend_pid(),'serverVersion',version())"));}
 session(target,role='postgres'){
  const session=super.session(target,role),send=session.send,close=session.close;
  session.send=async sql=>{const result=await send(sql);fs.appendFileSync(path.join(this.privateRoot,'session-outputs.jsonl'),JSON.stringify({utc:new Date().toISOString(),targetId:target.id,role,inputSha256:hash(sql),output:result})+'\n',{mode:0o600});return result;};session.close=async()=>{await close();assert(await session.done===0,'HOSTED_SNAPSHOT_INVALID');};return session;
 }
 async environment(target,runId){
  const identity=await this.identity(target);
  const binary=(name,flags)=>{const executable=this.executable(target,name);return {path:executable,sha256:this.docker(['exec',target.container,'sha256sum',executable]).split(' ')[0],version:this.docker(['exec',target.container,executable,'--version']),flags};};
  return {provenance:'LOCAL_SYNTHETIC',observedProjectRef:'local-hp1-'+runId,serverVersion:identity.serverVersion,dumpBinary:binary('pg_dump',['--format=custom','--create','--snapshot','--lock-wait-timeout=2s']),restoreBinary:binary('pg_restore',['--exit-on-error','--create','--clean','--if-exists']),os:this.docker(['exec',target.container,'uname','-srm']),imageDigest:this.image,services:[],configRevision:'owned-network-none-'+runId,tlsCaSha256:hash('LOCAL_UNIX_SOCKET_NO_TLS'),route:{kind:'owned-unix',host:'/lab',port:5432,username:'postgres'},providerReceipt:null};
 }
 executable(target,name){
  this.guard(target);assert(['pg_dump','pg_dumpall','pg_restore'].includes(name));
  const executable=this.docker(['exec',target.container,'bash','-ceu',`binary=$(readlink -f "$(command -v ${name})"); test -x "$binary"; printf '%s' "$binary"`]).trim();
  assert(/^\/[A-Za-z0-9_./+-]+$/.test(executable),'HOSTED_PROFILE_UNSUPPORTED');return executable;
 }
 dump(target,args,{appName,snapshot,output}={}){
  this.guard(target);assert(/^hp1_[a-z0-9_]+$/.test(appName));
  if(snapshot)assert(/^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$/.test(snapshot));
  return this.docker(['exec','-e','PGAPPNAME='+appName,target.container,this.executable(target,'pg_dump'),'-h','/lab','-U','postgres','-d','postgres',...args,...(snapshot?['--snapshot='+snapshot]:[]),...(output?['-f',output]:[]),'--lock-wait-timeout=2s']);
 }
 roles(target,key){this.guard(target);assert(SHA.test(key));return this.docker(['exec',target.container,this.executable(target,'pg_dumpall'),'-h','/lab','-U','postgres','--roles-only','--no-role-passwords','--restrict-key='+key]);}
 restore(target,archive,roles,{schemaOnly=false}={}){
  this.guard(target);assert(target.bootstrap==='hp1_bootstrap','HOSTED_PROFILE_UNSUPPORTED');
  assert(this.sql(target,"select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname !~ '^pg_' and n.nspname<>'information_schema'",'hp1_bootstrap')==='0','HOSTED_COVERAGE_INVALID');
  // PostgreSQL 17 treats OID10 specially as a membership grantor. Replaying a
  // different bootstrap OID with extra ADMIN grants would change the graph.
  // Execute every original role statement, then transplant the restored LOCAL
  // bootstrap identity onto OID10 before replaying membership statements.
  const plan=globalsReplayPlan(fs.readFileSync(roles,'utf8'));
  assert(plan.grantors.every(x=>x==='supabase_admin'),'HOSTED_PROFILE_UNSUPPORTED');
  this.sql(target,'CREATE ROLE hp1_replay_helper SUPERUSER LOGIN;','hp1_bootstrap');
  this.sql(target,plan.prefix+(plan.suffix&&plan.restrictKey?'\n\\unrestrict '+plan.restrictKey+'\n':''),'hp1_bootstrap');
  this.sql(target,'DROP ROLE supabase_admin; ALTER ROLE hp1_bootstrap RENAME TO supabase_admin;\n'+plan.bootstrapStatements.join('\n'),'hp1_replay_helper');
  if(plan.suffix)this.sql(target,(plan.restrictKey?'\\restrict '+plan.restrictKey+'\n':'')+plan.suffix,'hp1_replay_helper');
  this.sql(target,'DROP ROLE hp1_replay_helper;','supabase_admin');
  this.copyIn(target,archive,'/lab/hp1-input.dump');
  this.docker(['exec',target.container,this.executable(target,'pg_restore'),'--exit-on-error','--create','--clean','--if-exists',...(schemaOnly?['--schema-only']:[]),'-h','/lab','-U','supabase_admin','-d','template1','/lab/hp1-input.dump']);
  return {empty:true};
 }
 logs(target){this.guard(target);const p=path.join(this.privateRoot,'logs-'+randomUUID()+'.txt');
  // docker logs puts server output on stderr: capture both privately, never print.
  const args=['docker','logs',target.container];
  const bytes=this.command(['bash','-ceu','docker logs "$1" 2>&1','hp1-logs',target.container]);
  fs.writeFileSync(p,bytes,{flag:'wx',mode:0o600});return bytes.toString('utf8');
 }
 importer(target,appName,token,id,serverVersion,logs){
  const match=logs.split('\n').find(line=>line.includes(`app=${appName} user=postgres db=postgres `)&&line.includes(`SET TRANSACTION SNAPSHOT '${token}'`));
  assert(match,'HOSTED_SNAPSHOT_INVALID');const pid=/^HP1 pid=(\d+) /.exec(match)?.[1];assert(pid,'HOSTED_SNAPSHOT_INVALID');
  return {id,appName,backend:{database:'postgres',actor:'postgres',sessionUser:'postgres',pid:Number(pid),serverVersion},snapshotHash:hash(token)};
 }
}

// Hosted admission is intentionally before any credential read, socket, driver
// construction or subprocess. There is no .env or transaction-pooler fallback.
export function requireHostedTransport(config){
 assert(config&&config.mode==='HOSTED'&&config.route?.port===5432&&['direct','session-pooler'].includes(config.route.kind),'HOSTED_PROFILE_UNSUPPORTED');
 assert(CERTIFIED_HOSTED_PROFILES.some(p=>p.profileId===config.profileId),'HOSTED_PROFILE_UNSUPPORTED');
 fail('HOSTED_ACTION_UNAUTHORIZED');
}
