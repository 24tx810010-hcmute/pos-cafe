import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {assert,exact,hash,stable,same,SHA,UUID,EVIDENCE_KEYS,LIMITS,readRef,strictJson,validateBinding,assertPrivateRoot,newPrivateOutput,list,QUALIFIED,IDENT,utc} from './permission-hosted-schema.mjs';
import {HostedLocalRuntime,requireHostedTransport} from './permission-hosted-runtime.mjs';
import {adapterHash,verifierHash,hostedMethodHash} from './permission-hosted-profile.mjs';
import {captureHostedInventory,sequenceState,observeHostedClosure} from './permission-hosted-catalog.mjs';
import {deriveHostedReport,readHostedBackup,requiredChecks} from './permission-hosted-compare.mjs';
import {parseArchiveSequences,tocInventory,assessAllocation,CATALOG_IDS} from './permission-backup-v2-core.mjs';
import {literal} from './permission-backup-v2-local.mjs';
import {activationBundleManifest} from './permission-activation-bundle.mjs';
import {verifySourceArchive} from './permission-hosted-source.mjs';

const now=()=>new Date().toISOString();
async function verifySource(config){
 const bytes=fs.readFileSync(config.sourceSnapshotPath);assert(hash(bytes)===config.expectedSourceManifestSha256,'HOSTED_PROOF_INVALID');const snapshot=strictJson(bytes);
 assert(path.resolve(config.sourceRoot)===process.cwd(),'HOSTED_PROOF_INVALID');
 for(const e of snapshot.entries){assert(typeof e.path==='string'&&!path.isAbsolute(e.path)&&!e.path.split(/[\\/]/).includes('..'));const p=path.resolve(config.sourceRoot,e.path);
  if(e.deleted){assert(!fs.existsSync(p),'HOSTED_PROOF_INVALID');continue;}
  assert(fs.statSync(p).isFile()&&fs.statSync(p).size===e.bytes&&hash(fs.readFileSync(p))===e.sha256,'HOSTED_PROOF_INVALID');
 }
 const {permissionFingerprint}=await import('./permission-preflight-core.mjs');
 assert(permissionFingerprint()===config.expectedPermissionFingerprint&&activationBundleManifest().sha256===config.bundleSha256,'HOSTED_PROOF_INVALID');return bytes;
}
export async function runHostedLogicalBackup(config,{runtime,afterSnapshot}={}){
 try{return await captureHostedLogicalBackup(config,{runtime,afterSnapshot});}catch(error){if(error.code?.startsWith('HOSTED_'))throw error;throw Object.assign(Error('HOSTED_CAPTURE_FAILED'),{code:'HOSTED_CAPTURE_FAILED'});}
}
async function captureHostedLogicalBackup(config,{runtime,afterSnapshot}={}){
 if(config?.mode==='HOSTED')requireHostedTransport(config);
 exact(config,['schemaVersion','kind','mode','profileId','runId','privateRoot','image','namespace','source','sourceRoot','sourceSnapshotPath','expectedSourceManifestSha256','expectedPermissionFingerprint','bundleSha256','scopeApprovalPath','consumerApprovalPath','consumers','output']);
 assert(config.schemaVersion===3&&config.kind==='permission-hosted-local-config'&&config.mode==='LOCAL_SYNTHETIC'&&config.profileId==='supabase-hosted-logical-v1'&&UUID.test(config.runId),'HOSTED_PROFILE_UNSUPPORTED');
 for(const key of ['expectedSourceManifestSha256','expectedPermissionFingerprint','bundleSha256'])assert(SHA.test(config[key]));
 exact(config.source,['instance','container','volume','image','created','bootstrap','id']);assert(UUID.test(config.source.instance)&&SHA.test(config.source.id)&&config.source.image===config.image&&['postgres','hp1_bootstrap'].includes(config.source.bootstrap));utc(config.source.created);
 for(const key of ['container','volume'])assert(/^[a-z0-9-]{1,128}(?![\s\S])/.test(config.source[key]));
 list(config.consumers,LIMITS.sequences,c=>{exact(c,['sequence','table','column','cast']);assert(QUALIFIED.test(c.sequence)&&QUALIFIED.test(c.table)&&IDENT.test(c.column)&&['smallint','integer','bigint'].includes(c.cast));});
 assert(config.consumerApprovalPath===null||typeof config.consumerApprovalPath==='string');if(config.consumerApprovalPath===null)assert(config.consumers.length===0,'HOSTED_CONSUMERS_UNCERTIFIED');
 const sourceBytes=await verifySource(config),scopeBytes=fs.readFileSync(config.scopeApprovalPath);assert(hash(scopeBytes)==='362883c12c6d5a1666258572fc7acb32d283c702725520dc06d8a1705ed8ddb8','HOSTED_PROOF_INVALID');
 runtime??=new HostedLocalRuntime(config);assert(runtime instanceof HostedLocalRuntime&&runtime.provenance==='LOCAL_SYNTHETIC','HOSTED_PROFILE_UNSUPPORTED');runtime.guard(config.source);
 const privateRoot=fs.realpathSync(runtime.privateRoot);assertPrivateRoot(privateRoot);const output=newPrivateOutput(privateRoot,config.output);fs.mkdirSync(output,{mode:0o700});
 const save=(name,value,binary=false)=>{const file=path.join(output,name);assert(file.startsWith(output+path.sep),'HOSTED_INPUT_INVALID');fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const bytes=binary?Buffer.from(value):Buffer.from(stable(value)+'\n');assert(bytes.length<= (name.endsWith('.dump')||name.endsWith('.tar')?LIMITS.archive:LIMITS.envelope),'HOSTED_INPUT_INVALID');fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});return {path:name,sha256:hash(bytes),bytes:bytes.length};};
 const data={},refs=Object.fromEntries(EVIDENCE_KEYS.map(k=>[k,null])),commands=[];
 const timed=async(id,fn)=>{const started=now(),n=runtime.commands.length;try{const result=await fn();const records=runtime.commands.slice(n);commands.push({id,started,completed:now(),exit:0,stdoutSha256:hash(stable(records.map(c=>c.stdoutSha256))),stderrSha256:hash(stable(records.map(c=>c.stderrSha256))),truncated:false});return result;}catch(error){save('failure.json',{code:error.code?.startsWith('HOSTED_')?error.code:'HOSTED_CAPTURE_FAILED',commands,failedCommand:id,cleanupEligible:false});throw error;}};
 const target=config.source,runPrefix='hp1_'+config.runId.replaceAll('-',''),app=id=>runPrefix+'_'+id.toLowerCase();
 const environment=await runtime.environment(target,config.runId);
 const binding={projectRef:'kfqjdfwxhkdwihjobpny',backendOrigin:'https://kfqjdfwxhkdwihjobpny.supabase.co',database:'postgres',actor:'postgres',sessionUser:'postgres',scopeApprovalSha256:hash(scopeBytes),sourceManifestSha256:config.expectedSourceManifestSha256,permissionFingerprint:config.expectedPermissionFingerprint,methodSha256:hostedMethodHash(),verifierSha256:verifierHash(),adapterSha256:adapterHash(),environmentSha256:hash(stable(environment)),bundleSha256:config.bundleSha256};validateBinding(binding);
 refs.sourceSnapshot=save('source-snapshot.json',sourceBytes,true);data.sourceSnapshot=sourceBytes;
 const scopeApprovalRef=save('scope-approval.json',scopeBytes,true);
 const sourceManifest=strictJson(sourceBytes),inputRoot=path.dirname(config.sourceSnapshotPath),archiveBytes=readRef(inputRoot,sourceManifest.archive,LIMITS.archive);const sourceArchiveRef=save(sourceManifest.archive.path,archiveBytes,true);
 verifySourceArchive(sourceManifest,archiveBytes,config.expectedPermissionFingerprint);
 for(const ref of sourceManifest.specReferences)save(ref.path,readRef(inputRoot,ref),true);
 const exporter=runtime.session(target);let exporterClosed=null;
 try{
  const exporterStarted=now();
  const exporterStartBytes=Buffer.from(await exporter.send("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL application_name='hp1_exporter'; SET LOCAL idle_in_transaction_session_timeout='180s'; SELECT json_build_object('token',pg_export_snapshot(),'visible',pg_current_snapshot()::text,'database',current_database(),'actor',current_user,'sessionUser',session_user,'pid',pg_backend_pid(),'serverVersion',version());")),info=strictJson(exporterStartBytes),exporterStartRef=save('exporter-start.json',exporterStartBytes,true);
  assert(info.database===binding.database&&info.actor===binding.actor&&info.sessionUser===binding.sessionUser&&info.serverVersion===environment.serverVersion,'HOSTED_PROOF_INVALID');
  const token=info.token,visibleSnapshotHash=hash(info.visible),key=randomBytes(32).toString('hex');
  data.inventoryBefore=await timed('inventoryBefore',()=>captureHostedInventory(runtime,target,{token,appName:app('inventoryBefore'),consumers:config.consumers}));
  assert(data.inventoryBefore.unsupported.length===0,'HOSTED_PROFILE_UNSUPPORTED');
  let approval=null,approvalRef=null;
  if(config.consumerApprovalPath!==null){
   const approvalBytes=fs.readFileSync(config.consumerApprovalPath);approval=strictJson(approvalBytes);
   exact(approval,['schemaVersion','kind','sourceTargetId','sourceManifestSha256','methodSha256','catalogSha256','fixtureSha256','diversitySha256','consumers','paths','provenance','control','complete']);
   assert(approval.schemaVersion===3&&approval.kind==='permission-hosted-local-consumer-approval'&&approval.sourceTargetId===target.id&&approval.sourceManifestSha256===binding.sourceManifestSha256&&approval.methodSha256===binding.methodSha256&&approval.catalogSha256===hash(stable(data.inventoryBefore.catalog))&&same(approval.consumers,config.consumers)&&approval.provenance==='LOCAL_SYNTHETIC'&&approval.control==='OWNED_NETWORK_NONE_EXPLICIT_HARNESS'&&approval.complete===true&&SHA.test(approval.fixtureSha256)&&SHA.test(approval.diversitySha256),'HOSTED_CONSUMERS_UNCERTIFIED');
   approvalRef=save('consumer-approval.json',approvalBytes,true);
  }
  data.schemaSource=await timed('schemaSource',()=>runtime.dump(target,['--schema-only','--create','--restrict-key='+key],{appName:app('schemaSource'),snapshot:token}));
  data.rolesBefore=await timed('rolesBefore',()=>runtime.roles(target,key));
  if(afterSnapshot)await afterSnapshot({runtime,target,token});
  await timed('archive',()=>runtime.dump(target,['--format=custom','--create'],{appName:app('archive'),snapshot:token,output:'/lab/hp1-capture.dump'}));
  data.inventoryAfter=await timed('inventoryAfter',()=>captureHostedInventory(runtime,target,{token,appName:app('inventoryAfter'),consumers:config.consumers}));
  const exporterVerifiedBytes=Buffer.from(await exporter.send("SELECT json_build_object('pid',pg_backend_pid(),'visible',pg_current_snapshot()::text,'readonly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'));")),still=strictJson(exporterVerifiedBytes),exporterVerifiedRef=save('exporter-verified.json',exporterVerifiedBytes,true);
  assert(still.pid===info.pid&&hash(still.visible)===visibleSnapshotHash&&still.readonly==='on'&&still.isolation==='repeatable read','HOSTED_SNAPSHOT_INVALID');const exporterVerified=now();
  await exporter.close();exporterClosed=now();
  data.rolesAfter=await timed('rolesAfter',()=>runtime.roles(target,key));
  runtime.copyOut(target,'/lab/hp1-capture.dump',path.join(output,'archive.dump'));data.archive=fs.readFileSync(path.join(output,'archive.dump'));refs.archive={path:'archive.dump',sha256:hash(data.archive),bytes:data.archive.length};
  data.toc=await timed('toc',()=>runtime.docker(['exec',target.container,runtime.executable(target,'pg_restore'),'-l','/lab/hp1-capture.dump']));
  const toc=tocInventory(data.toc);runtime.docker(['exec','-i',target.container,'tee','/lab/hp1-sequences.list'],toc.sequenceList);
  data.sequenceSql=await timed('sequenceSql',()=>runtime.docker(['exec',target.container,runtime.executable(target,'pg_restore'),'--use-list=/lab/hp1-sequences.list','--file=-','/lab/hp1-capture.dump']));
  const sequences=parseArchiveSequences(data.sequenceSql,data.inventoryBefore.sequenceDefinitions.map(s=>s.name));
  const rolesRef=save('roles-before.sql',data.rolesBefore,true),pristine=runtime.create('pristine',{bootstrap:'hp1_bootstrap'}),allocation=runtime.create('allocation',{bootstrap:'hp1_bootstrap'});
  await timed('restorePristine',()=>runtime.restore(pristine,path.join(output,'archive.dump'),path.join(output,rolesRef.path)));
  data.pristineInventory=await captureHostedInventory(runtime,pristine,{appName:app('pristine'),consumers:config.consumers});
  const sequenceRestored=sequenceState(runtime,pristine,sequences.map(s=>s.name));
  data.schemaRestored=await timed('schemaRestored',()=>runtime.dump(pristine,['--schema-only','--create','--restrict-key='+key],{appName:app('schemaRestored')}));
  data.rolesRestored=await timed('rolesRestored',()=>runtime.roles(pristine,key));
  await timed('restoreAllocation',()=>runtime.restore(allocation,path.join(output,'archive.dump'),path.join(output,rolesRef.path)));
  const baseline=await captureHostedInventory(runtime,allocation,{appName:app('allocationbaseline'),consumers:config.consumers});assert(same(baseline.catalog,data.inventoryBefore.catalog)&&same(baseline.tables,data.pristineInventory.tables),'HOSTED_COVERAGE_INVALID');
  const observations=await timed('allocationProbe',()=>sequences.map(s=>{const c=config.consumers.find(x=>x.sequence===s.name),o=data.inventoryBefore.occupied.find(x=>x.sequence===s.name),result=assessAllocation({...data.inventoryBefore.sequenceDefinitions.find(x=>x.name===s.name),...s},c,o?.values);return {name:s.name,executed:result.status==='PASS',value:result.status==='PASS'?runtime.sql(allocation,`SELECT nextval(${literal(s.name)})::text;`):null};}));
  const pristineAfter=await timed('pristineRecheck',()=>sequenceState(runtime,pristine,sequences.map(s=>s.name)));
  data.allocationProbe={targetId:allocation.id,pristineId:pristine.id,archiveSha256:refs.archive.sha256,sequenceRestored,pristineAfter,observations,baselineCatalogSha256:hash(stable(baseline.catalog)),baselineInventory:baseline};
  const createdUtc=now();data.allocationContract=approval?{schemaVersion:3,kind:'permission-hosted-consumer-contract',binding,runId:config.runId,catalogSha256:hash(stable(data.inventoryBefore.catalog)),approvalRef,consumers:config.consumers,paths:approval.paths,sourceBinarySha256:binding.adapterSha256,serviceConfigSha256:hash(stable(config.consumers)),controlGeneration:environment.configRevision,issuer:'explicit-owned-network-none-harness',issuedUtc:exporterStarted,expiresUtc:new Date(Date.parse(createdUtc)+3600000).toISOString(),provenance:'LOCAL_SYNTHETIC',complete:approval.complete}:null;
  data.scopeObservation=await observeHostedClosure(runtime,target);
  const logs=runtime.logs(target),logsRef=save('postgres.log',logs,true);
  data.snapshotImporters=['inventoryBefore','inventoryAfter','schemaSource','archive'].map(id=>runtime.importer(target,app(id),token,id,environment.serverVersion,logs));
  const {token:_token,visible:_visible,...exporterIdentity}=info;
  data.captureExecution={runId:config.runId,binding,sourceId:target.id,exporter:exporterIdentity,exporterStartRef,exporterVerifiedRef,snapshotToken:token,visibleSnapshotHash,exporterStarted,exporterVerified,exporterClosed,commands,logsRef,sourceArchiveRef,scopeApprovalRef,pristineId:pristine.id,allocationId:allocation.id,pristineWasEmpty:true,allocationWasEmpty:true,archiveSha256:refs.archive.sha256};
  for(const k of EVIDENCE_KEYS){if(k==='archive'||k==='sourceSnapshot')continue;if(data[k]===undefined||data[k]===null){data[k]=null;continue;}refs[k]=save(k+'.'+(['toc','sequenceSql','rolesBefore','rolesAfter','rolesRestored','schemaSource','schemaRestored'].includes(k)?'txt':'json'),data[k],typeof data[k]==='string');}
  await verifySource(config);
  const manifest={schemaVersion:3,kind:'permission-hosted-logical-backup',profileId:config.profileId,runId:config.runId,createdUtc,binding,environment,evidence:refs,coverage:{relations:data.inventoryBefore.relations.map(r=>r.schema+'.'+r.name).sort(),sequences:data.inventoryBefore.sequenceDefinitions.map(s=>s.name).sort(),catalogs:[...CATALOG_IDS].sort(),checkSetDigest:hash(stable(requiredChecks(data.inventoryBefore)))},trustAnchorRef:null,authorizationRef:null,result:{}};
  manifest.result=deriveHostedReport(manifest,data,{read:ref=>readRef(output,ref,ref===sourceArchiveRef?LIMITS.archive:LIMITS.envelope)});
  const manifestRef=save('manifest.json',manifest),loaded=readHostedBackup(manifestRef,{packageRoot:output,expectedBinding:binding});
  return {manifestRef,packageRoot:output,report:loaded.report,trust:loaded.trust,targets:{pristine,allocation},runtime};
 }catch(error){fs.writeFileSync(path.join(output,'capture-error-private.txt'),error.stack??String(error),{flag:'wx',mode:0o600});if(error.code?.startsWith('HOSTED_'))throw error;throw Object.assign(Error('HOSTED_CAPTURE_FAILED'),{code:'HOSTED_CAPTURE_FAILED'});}
 finally{if(!exporterClosed)await exporter.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let runtime;try{assert(process.argv.length===4&&process.argv[2]==='--local-config','HOSTED_ACTION_UNAUTHORIZED');const config=strictJson(fs.readFileSync(process.argv[3]));runtime=new HostedLocalRuntime(config);const r=await runHostedLogicalBackup(config,{runtime});console.log(JSON.stringify({manifest:r.manifestRef,report:r.report,trust:r.trust}));if(r.report.archiveFidelity.status!=='PASS')process.exitCode=1;}catch(error){console.error(error.code?.startsWith('HOSTED_')?error.code:'HOSTED_CAPTURE_FAILED');process.exitCode=1;}finally{if(runtime)fs.writeFileSync(path.join(runtime.privateRoot,'teardown-'+Date.now()+'.json'),stable(runtime.stopOwned()),{flag:'wx',mode:0o600});}
}
