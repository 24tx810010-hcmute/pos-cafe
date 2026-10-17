import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { sha256, fail, IDENT } from './permission-backup-v2-core.mjs';

export const quote = x => { if(typeof x!=='string'||!/^[a-z_][a-z0-9_$-]*$/.test(x))fail('BACKUP_V2_IDENTIFIER_UNSUPPORTED');return '"'+x+'"'; };
export const literal = x => "'"+x.replaceAll("'","''")+"'";
export const utc = () => new Date().toISOString();
export const writeNew = (p,x) => fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx',mode:0o600});
export const fileRef = p => ({path:path.resolve(p),sha256:sha256(fs.readFileSync(p))});
// LOCAL ONLY transport. No URL, credential, hosted fallback, arbitrary Docker network or image tag.
export class LocalBackupRuntime {
  constructor({privateRoot,image,namespace}) {
    if(!/^sha256:[a-f0-9]{64}$/.test(image)||!/^v2-[a-z0-9-]{4,40}$/.test(namespace))fail('BACKUP_V2_TARGET_GUARD');
    this.privateRoot=path.resolve(privateRoot);this.image=image;this.namespace=namespace;this.owned=[];this.commands=[];
    if(!fs.statSync(this.privateRoot).isDirectory())fail('BACKUP_V2_PRIVATE_ROOT');
    if(process.platform==='win32') {
      const script=`$a=Get-Acl -LiteralPath '${this.privateRoot.replaceAll("'","''")}'; $me=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; if(-not $a.AreAccessRulesProtected){exit 1}; foreach($r in $a.Access){$s=$r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value;if($s -ne $me -and $s -ne 'S-1-5-18'){exit 2}}`;
      try{execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:'pipe'});}catch{fail('BACKUP_V2_PRIVATE_ROOT');}
    } else if((fs.statSync(this.privateRoot).mode&0o077)!==0)fail('BACKUP_V2_PRIVATE_ROOT');
  }
  command(args,input,timeout=60000) {
    const record={started:utc(),args,inputSha256:input===undefined?null:sha256(input),exit:0}; let out=Buffer.alloc(0),err=Buffer.alloc(0);
    const executable=process.platform==='win32'?'wsl.exe':args[0],argv=process.platform==='win32'?['-d','Ubuntu-24.04','--exec',...args]:args.slice(1);
    const result=spawnSync(executable,argv,{input,windowsHide:true,timeout,maxBuffer:128*1024*1024,stdio:['pipe','pipe','pipe']});
    out=result.stdout??out;err=result.stderr??err;record.exit=result.status??-1;
    record.completed=utc();record.stdoutSha256=sha256(out);record.stderrSha256=sha256(err);
    fs.appendFileSync(path.join(this.privateRoot,'commands.jsonl'),JSON.stringify({...record,out:out.toString('utf8'),err:err.toString('utf8')})+'\n',{mode:0o600});this.commands.push(record);
    if(record.exit!==0)fail('BACKUP_V2_COMMAND_FAILED');return out;
  }
  docker(args,input){return this.command(['docker',...args],input).toString('utf8').trim();}
  guard(e,requireRunning=true) {
    const c=JSON.parse(this.docker(['inspect',e.container]))[0],v=JSON.parse(this.docker(['volume','inspect',e.volume]))[0];
    if(c.Id!==e.id || c.Image!==this.image || c.Config.Labels['pos-cafe-backup-v2']!==e.instance
      || c.HostConfig.NetworkMode!=='none' || Object.keys(c.HostConfig.PortBindings??{}).length || c.Mounts.length!==1
      || c.Mounts[0].Name!==e.volume || c.Mounts[0].Destination!=='/lab' || v.Labels['pos-cafe-backup-v2']!==e.instance || (requireRunning&&!c.State.Running))fail('BACKUP_V2_TARGET_GUARD');
    return c;
  }
  create(label,{listen=''}={}) {
    if(!/^[a-z0-9-]{1,30}$/.test(label))fail('BACKUP_V2_TARGET_GUARD');
    if(!['','127.0.0.1'].includes(listen))fail('BACKUP_V2_TARGET_GUARD');
    const instance=randomUUID(),container=`pos-cafe-${this.namespace}-${label}-${instance.slice(0,8)}`,volume=container+'-data';
    const e={instance,container,volume,image:this.image,created:utc()};writeNew(path.join(this.privateRoot,container+'-intent.json'),e);
    this.docker(['volume','create','--label','pos-cafe-backup-v2='+instance,volume]);
    const init='umask 077; mkdir -p /lab/pgdata; chown postgres:postgres /lab /lab/pgdata; chmod 0700 /lab /lab/pgdata; gosu postgres initdb -D /lab/pgdata -U supabase_admin --auth-local=trust --auth-host=reject --encoding=UTF8 --locale=C.UTF-8; exec gosu postgres postgres -D /lab/pgdata -c listen_addresses='+listen+' -c unix_socket_directories=/lab -c shared_preload_libraries= -c max_connections=30';
    this.docker(['run','-d','--name',container,'--network','none','--label','pos-cafe-backup-v2='+instance,'--mount',`type=volume,source=${volume},target=/lab`,'--entrypoint','/bin/bash',this.image,'-ceu',init]);
    e.id=JSON.parse(this.docker(['inspect','--format','{{json .Id}}',container]));this.owned.push(e);writeNew(path.join(this.privateRoot,container+'-target.json'),e);
    this.docker(['exec',container,'bash','-ceu','for n in $(seq 1 30); do pg_isready -h /lab -U supabase_admin -d postgres >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1']);
    this.guard(e);this.sql(e,'CREATE ROLE lab_restore SUPERUSER LOGIN;','supabase_admin');return e;
  }
  ps(e,role='postgres',db='postgres'){quote(role);quote(db);return ['docker','exec','-i',e.container,'psql','-X','-qAt','-h','/lab','-U',role,'-d',db,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'];}
  sql(e,text,role='postgres',db='postgres'){this.guard(e);return this.command(this.ps(e,role,db),text+'\n').toString('utf8').trim();}
  session(e,role='postgres') {
    this.guard(e);const args=this.ps(e,role),p=spawn(process.platform==='win32'?'wsl.exe':args[0],process.platform==='win32'?['-d','Ubuntu-24.04','--exec',...args]:args.slice(1),{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let out='',err='',pending,closed=false;
    const done=new Promise(resolve=>p.on('close',code=>{closed=true;if(pending){clearTimeout(pending.timer);pending.reject(Object.assign(Error('BACKUP_V2_SESSION_EOF'),{code:'BACKUP_V2_SESSION_EOF'}));pending=null;}resolve(code);}));
    p.stdout.on('data',b=>{out+=b;if(pending&&out.includes(pending.marker)){const a=pending;pending=null;const result=out.slice(0,out.indexOf(a.marker)).trim();out=out.slice(out.indexOf(a.marker)+a.marker.length);clearTimeout(a.timer);a.resolve(result);}});
    p.stderr.on('data',b=>{err+=b;fs.appendFileSync(path.join(this.privateRoot,'sessions-errors.log'),b,{mode:0o600});});p.stdin.on('error',()=>{});
    return {send:text=>{if(pending||closed)fail('BACKUP_V2_SESSION_STATE');const marker='V2_'+randomUUID().replaceAll('-','');return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending=null;p.stdin.end();reject(Error('BACKUP_V2_SESSION_TIMEOUT'));},30000);pending={marker,timer,resolve,reject};fs.appendFileSync(path.join(this.privateRoot,'sessions.jsonl'),JSON.stringify({utc:utc(),target:e.id,role,text})+'\n',{mode:0o600});p.stdin.write(text+'\n\\echo '+marker+'\n');});},close:async()=>{if(!closed)p.stdin.end('ROLLBACK;\n\\q\n');await done;},done};
  }
  copyIn(e,src,dest){this.guard(e);if(!/^\/lab\/[a-zA-Z0-9_.-]+$/.test(dest))fail('BACKUP_V2_PATH');this.docker(['exec','-i',e.container,'bash','-ceu','umask 077; cat > '+dest],fs.readFileSync(src));}
  copyOut(e,src,dest){this.guard(e);if(!/^\/lab\/[a-zA-Z0-9_.-]+$/.test(src)||!path.resolve(dest).startsWith(this.privateRoot+path.sep))fail('BACKUP_V2_PATH');const bytes=this.command(['docker','exec',e.container,'cat',src]);fs.writeFileSync(dest,bytes,{flag:'wx',mode:0o600});}
  restore(e,archive,roles,extensions,{schemaOnly=false}={}) {
    this.guard(e);
    const empty=this.sql(e,"select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname !~ '^pg_' and n.nspname<>'information_schema'",'lab_restore');
    if(empty!=='0')fail('BACKUP_V2_NONEMPTY_TARGET');
    let roleText=fs.readFileSync(roles,'utf8');
    for(const role of ['supabase_admin','lab_restore'])roleText=roleText.replace(new RegExp('^CREATE ROLE '+role+';\\r?\\n','m'),'');
    this.sql(e,roleText,'lab_restore');this.copyIn(e,archive,'/lab/input.dump');
    const toc=this.docker(['exec',e.container,'pg_restore','-l','/lab/input.dump']),parts={database:[],schemas:[],extensions:[],remainder:[]};
    for(const line of toc.split(/\r?\n/).filter(x=>/^\d+;/.test(x))){const d=line.replace(/^\d+; \d+ \d+ /,'');parts[/^DATABASE - /.test(d)?'database':/^SCHEMA - /.test(d)?'schemas':/^EXTENSION - /.test(d)?'extensions':'remainder'].push(line);}
    for(const [k,v]of Object.entries(parts))this.docker(['exec','-i',e.container,'tee','/lab/'+k+'.list'],v.join('\n')+'\n');
    const restore=(k,db,extra=[])=>this.docker(['exec',e.container,'pg_restore','--exit-on-error','--use-list=/lab/'+k+'.list',...extra,'-h','/lab','-U','lab_restore','-d',db,'/lab/input.dump']);
    restore('database','template1',['--create','--clean','--if-exists']);restore('schemas','postgres');
    for(const x of extensions){const flag=this.sql(e,`SELECT rolsuper FROM pg_roles WHERE rolname=${literal(x.owner)}`,'lab_restore');this.sql(e,`BEGIN; ${x.name==='plpgsql'?'DROP EXTENSION plpgsql;':''} ALTER ROLE ${quote(x.owner)} SUPERUSER; SET LOCAL ROLE ${quote(x.owner)}; CREATE EXTENSION ${quote(x.name)} WITH SCHEMA ${quote(x.schema)} VERSION ${literal(x.version)}; RESET ROLE; ALTER ROLE ${quote(x.owner)} ${flag==='t'?'SUPERUSER':'NOSUPERUSER'}; COMMIT;`,'lab_restore');}
    restore('remainder','postgres',schemaOnly?['--schema-only']:[]);return {empty:true};
  }
  stop(e){if(!this.owned.some(x=>x.id===e.id))fail('BACKUP_V2_TARGET_GUARD');const c=this.guard(e,false);if(c.State.Running)this.docker(['stop','--time','10',e.container]);return {id:e.id,container:e.container,volume:e.volume,stopped:true,volumeRetained:true};}
  stopOwned(){return this.owned.map(e=>this.stop(e));}
}
