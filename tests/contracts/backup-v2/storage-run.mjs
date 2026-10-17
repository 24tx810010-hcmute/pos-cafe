import fs from 'node:fs';import path from 'node:path';import {randomBytes,createHmac} from 'node:crypto';
import {LocalBackupRuntime,writeNew,utc,fileRef} from '../../../scripts/permission-backup-v2-local.mjs';
import {captureStorageV2} from '../../../scripts/permission-backup-v2-storage.mjs';
import {sha256,fail} from '../../../scripts/permission-backup-v2-core.mjs';
const input=JSON.parse(fs.readFileSync(process.argv[2])),rt=new LocalBackupRuntime(input),checks=[];
let api,db,fatal;
const check=(id,passed)=>{checks.push({id,passed});console.log(id+': '+(passed?'PASS':'FAIL'));};
const image='sha256:105a2584129c9600aebed6f5ac49ca4371c92b996ecd1af7179750333e9e2120';
const save=(n,x)=>writeNew(path.join(input.publicRoot,n+'.json'),x);
save('storage-prerun',{utc:utc(),runner:fileRef(process.argv[1]),helper:fileRef('scripts/permission-backup-v2-storage.mjs'),expected:['three-payload-clone','no-global-control-blocked','wrong-version-not-immutable','unsupported-control-refused','same-size-race-refused'],noDeletes:true});
try{
  db=rt.create('storage-db',{listen:'127.0.0.1'});
  rt.sql(db,"CREATE ROLE postgres LOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE supabase_storage_admin LOGIN CREATEROLE BYPASSRLS; GRANT anon,authenticated,service_role TO supabase_storage_admin; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role; GRANT ALL ON DATABASE postgres TO supabase_storage_admin; CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin; GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;",'lab_restore');
  rt.docker(['exec','-i',db.container,'bash','-ceu','printf "host postgres supabase_storage_admin 127.0.0.1/32 trust\\n" > /lab/hba-new; cat /lab/pgdata/pg_hba.conf >> /lab/hba-new; cat /lab/hba-new > /lab/pgdata/pg_hba.conf']);rt.sql(db,'SELECT pg_reload_conf();','lab_restore');
  const secret=randomBytes(48).toString('hex'),header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),payload=Buffer.from(JSON.stringify({role:'service_role',iss:'v2-local-synthetic',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  const unsigned=header+'.'+payload,token=unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
  const container=db.container.replace('storage-db','storage-api'),volume=container+'-objects';
  const env={AUTH_JWT_SECRET:secret,DATABASE_URL:'postgresql://supabase_storage_admin@127.0.0.1:5432/postgres',STORAGE_BACKEND:'file',FILE_STORAGE_BACKEND_PATH:'/objects',TENANT_ID:'v2-synthetic',REGION:'local',GLOBAL_S3_BUCKET:'v2',SERVER_HOST:'127.0.0.1',SERVER_PORT:'5000',DB_MIGRATIONS_STRATEGY:'on_request',DATABASE_SEARCH_PATH:'storage,public',DATABASE_POSTGRES_VERSION:'17',LOG_LEVEL:'warn',PG_QUEUE_ENABLE:'true',S3_PROTOCOL_ENABLED:'true',S3_PROTOCOL_ACCESS_KEY_ID:'v2synthetic',S3_PROTOCOL_ACCESS_KEY_SECRET:randomBytes(32).toString('hex'),TUS_URL_PATH:'/upload/resumable',UPLOAD_FILE_SIZE_LIMIT:'10485760'};
  writeNew(path.join(input.privateRoot,'storage-credentials.json'),{env,token});
  rt.docker(['volume','create','--label','pos-cafe-backup-v2='+db.instance,volume]);
  rt.docker(['run','-d','--name',container,'--network','container:'+db.id,'--label','pos-cafe-backup-v2='+db.instance,'--mount',`type=volume,source=${volume},target=/objects`,...Object.entries(env).flatMap(([k,v])=>['-e',k+'='+v]),image]);
  api={container,volume,image,id:JSON.parse(rt.docker(['inspect','--format','{{json .Id}}',container])),db,instance:db.instance};save('storage-target',api);
  const guard=()=>{rt.guard(db);const c=JSON.parse(rt.docker(['inspect',container]))[0];if(c.Id!==api.id||c.Image!==image||c.HostConfig.NetworkMode!=='container:'+db.id||c.Config.Labels['pos-cafe-backup-v2']!==db.instance||c.Mounts.length!==1||c.Mounts[0].Name!==volume||Object.keys(c.HostConfig.PortBindings??{}).length)fail('BACKUP_V2_STORAGE_TARGET');};
  const script=`let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',async()=>{const x=JSON.parse(input);try{const r=await fetch('http://127.0.0.1:5000'+x.path,{method:x.method,headers:{Authorization:'Bearer '+x.token,...x.headers},body:x.body===null?undefined:Buffer.from(x.body,'base64'),redirect:'error',signal:AbortSignal.timeout(7000)});const b=Buffer.from(await r.arrayBuffer());console.log(JSON.stringify({status:r.status,mime:(r.headers.get('content-type')||'').split(';')[0],body:b.toString('base64')}));}catch(e){console.log(JSON.stringify({error:e.name}));}});`;
  const request=(url,{method='GET',body=null,headers={}}={})=>{guard();if(!url.startsWith('/')||url.includes('://'))throw Error('PATH');const r=JSON.parse(rt.docker(['exec','-i',container,'node','-e',script],JSON.stringify({path:url,method,token,headers,body:body===null?null:Buffer.from(body).toString('base64')})));return {...r,bytes:r.body?Buffer.from(r.body,'base64'):Buffer.alloc(0)};};
  let ready=false;for(let i=0;i<15;i++){if(request('/status').status===200){ready=true;break;}await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('STORAGE_NOT_READY');
  for(const id of ['capture','clone'])if(request('/bucket',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,name:id,public:false})}).status!==200)throw Error('BUCKET');
  const upload=(bucket,key,bytes)=>request('/object/'+bucket+'/'+key,{method:'POST',headers:{'content-type':'text/plain','x-upsert':'true'},body:bytes});
  for(let i=1;i<=3;i++)if(upload('capture','object-'+i,'SYNTHETIC-V2-00'+i).status!==200)throw Error('UPLOAD');
  const metadata=()=>JSON.parse(rt.sql(db,"select coalesce(json_agg(json_build_object('id',id,'bucket',bucket_id,'path',name,'version',version,'size',(metadata->>'size')::int,'mime',metadata->>'mimetype') order by name),'[]') from storage.objects where bucket_id='capture'",'lab_restore'));
  const objects=metadata(),get=row=>request('/object/'+row.bucket+'/'+row.path),putClone=row=>upload('clone',row.path,row.bytes),getClone=row=>request('/object/clone/'+row.path);
  const result=await captureStorageV2({objects,metadata,get,putClone,getClone});writeNew(path.join(input.privateRoot,'storage-capture.json'),result);
  check('V2-STORAGE-3',result.payloadClone.status==='PASS'&&result.objects.length===3);check('V2-STORAGE-BLOCKED',result.cleanupEligible===false&&result.status==='BLOCKED');
  for(const control of ['immutable-version','retention','IfMatch','gateway-only']){try{await captureStorageV2({objects,metadata,get,putClone,getClone,control});check('V2-STORAGE-'+control,false);}catch(e){check('V2-STORAGE-'+control,e.code==='BACKUP_V2_STORAGE_UNSUPPORTED');}}
  const original=get(objects[0]);upload('capture',objects[0].path,'REPLACED--V2-001');const wrongVersion=request('/object/capture/'+objects[0].path+'?version='+encodeURIComponent(objects[0].version));
  check('V2-STORAGE-VERSION',wrongVersion.status===200&&sha256(wrongVersion.bytes)!==sha256(original.bytes));
  let changed=false;try{await captureStorageV2({objects:metadata(),metadata,get:row=>{const r=get(row);if(!changed){changed=true;upload('capture','object-3','REPLACED--V2-003');}return r;},putClone,getClone});check('V2-STORAGE-RACE',false);}catch(e){check('V2-STORAGE-RACE',e.code==='BACKUP_V2_STORAGE_DRIFT');}
  save('storage-report',{utc:utc(),privateCapture:fileRef(path.join(input.privateRoot,'storage-capture.json')),checks,status:'BLOCKED',cleanupEligible:false,claim:'New API payload clone, database metadata compared separately; no global fence or atomic DB+Storage claim'});
}catch(e){fatal=e.code??e.message;console.log('STORAGE_FAILED '+fatal);}
finally{
  if(api){const c=JSON.parse(rt.docker(['inspect',api.container]))[0];if(c.Id!==api.id||c.Image!==api.image||c.HostConfig.NetworkMode!=='container:'+db.id)throw Error('STOP_GUARD');rt.docker(['stop','--time','10',api.container]);}
  save('storage-teardown',{utc:utc(),api:api?{id:api.id,stopped:true,volumeRetained:true}:null,db:rt.stopOwned()});save('storage-result',{utc:utc(),checks,fatal,passed:!fatal&&checks.every(x=>x.passed)});
}
if(fatal||checks.some(x=>!x.passed))process.exitCode=1;
