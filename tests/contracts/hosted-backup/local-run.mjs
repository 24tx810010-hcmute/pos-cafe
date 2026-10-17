import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {HostedLocalRuntime} from '../../../scripts/permission-hosted-runtime.mjs';
import {runHostedLogicalBackup} from '../../../scripts/permission-hosted-backup.mjs';
import {readHostedBackup,deriveHostedReport,requireHostedCutover} from '../../../scripts/permission-hosted-compare.mjs';
import {captureHostedInventory} from '../../../scripts/permission-hosted-catalog.mjs';
import {hash,stable,strictJson,readRef,assert,LIMITS} from '../../../scripts/permission-hosted-schema.mjs';
import {adapterHash,verifierHash,hostedMethodHash} from '../../../scripts/permission-hosted-profile.mjs';
import {loadReleaseEvidence} from '../../../scripts/permission-release-cutover.mjs';
import {observePermissionReleaseProofs} from '../../../scripts/permission-release-rehearsal.mjs';
import {activationBundleManifest} from '../../../scripts/permission-activation-bundle.mjs';
import {permissionFingerprint} from '../../../scripts/permission-preflight-core.mjs';
import {payment} from '../backup-v2/payment-fixture.mjs';

assert(process.argv.length===3,'HOSTED_INPUT_INVALID');const input=strictJson(fs.readFileSync(process.argv[2]));
const runtime=new HostedLocalRuntime(input),checks=[];let fatal=null,result=null;
const save=(name,v)=>fs.writeFileSync(path.join(input.publicRoot,name+'.json'),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const check=(id,ok,detail={})=>{checks.push({id,passed:ok,...detail});console.log(id+': '+(ok?'PASS':'FAIL'));};
const pin=ref=>{assert(hash(fs.readFileSync(ref.path))===ref.sha256,'HOSTED_INPUT_INVALID');return ref.path;};
const read=(root,ref)=>readRef(root,ref,ref.path.endsWith('.tar')?LIMITS.archive:LIMITS.envelope);
const privateClone=(from,to)=>{fs.cpSync(from,to,{recursive:true});const protect=p=>{const s=fs.lstatSync(p);assert(!s.isSymbolicLink(),'HOSTED_INPUT_INVALID');fs.chmodSync(p,s.isDirectory()?0o700:0o600);if(s.isDirectory())for(const n of fs.readdirSync(p))protect(path.join(p,n));};protect(to);};
save('prerun',{utc:new Date().toISOString(),runnerSha256:hash(fs.readFileSync(process.argv[1])),sourceManifestSha256:input.sourceSnapshot.sha256,requiredSkip:0,localOnly:true,expected:['B/I dynamic full graph','separate allocation clone','same-count faults','strict graph forgery refusal','controller and rehearsal preconnect refusal','missing exporter rejected','all optional capabilities BLOCKED']});
try{
 const source=runtime.create('source',{bootstrap:'hp1_bootstrap'});
 runtime.restore(source,pin(input.schemaArchive),pin(input.schemaRoles),{schemaOnly:true});
 runtime.sql(source,fs.readFileSync(pin(input.fixture),'utf8'),'supabase_admin');
 runtime.sql(source,fs.readFileSync(pin(input.diversity),'utf8'),'supabase_admin');
 runtime.sql(source,"ALTER ROLE anon VALID UNTIL '2030-01-01 00:00:00+00'; COMMENT ON ROLE anon IS 'HP1 synthetic role comment';",'supabase_admin');
 const observed=await captureHostedInventory(runtime,source,{appName:'hp1_explicit_contract',consumers:input.consumers}),consumerApprovalPath=path.join(input.privateRoot,'consumer-approval.json');
 fs.writeFileSync(consumerApprovalPath,stable({schemaVersion:3,kind:'permission-hosted-local-consumer-approval',sourceTargetId:source.id,sourceManifestSha256:input.sourceSnapshot.sha256,methodSha256:hostedMethodHash(),catalogSha256:hash(stable(observed.catalog)),fixtureSha256:input.fixture.sha256,diversitySha256:input.diversity.sha256,consumers:input.consumers,paths:input.consumers.map(c=>({kind:c.sequence==='public.store_no_seq'?'function':'default',identity:c.sequence+'->'+c.table+'.'+c.column,binarySha256:adapterHash(),configSha256:hash(stable(input.consumers))})),provenance:'LOCAL_SYNTHETIC',control:'OWNED_NETWORK_NONE_EXPLICIT_HARNESS',complete:true}),{flag:'wx',mode:0o600});
 const config={schemaVersion:3,kind:'permission-hosted-local-config',mode:'LOCAL_SYNTHETIC',profileId:'supabase-hosted-logical-v1',runId:randomUUID(),privateRoot:input.privateRoot,image:input.image,namespace:input.namespace,source,sourceRoot:process.cwd(),sourceSnapshotPath:pin(input.sourceSnapshot),expectedSourceManifestSha256:input.sourceSnapshot.sha256,expectedPermissionFingerprint:permissionFingerprint(),bundleSha256:activationBundleManifest().sha256,scopeApprovalPath:pin(input.scopeApproval),consumerApprovalPath,consumers:input.consumers,output:path.join(input.privateRoot,'capture')};
 result=await runHostedLogicalBackup(config,{runtime,afterSnapshot:async()=>{runtime.sql(source,'BEGIN;'+payment(2)+'COMMIT;');runtime.sql(source,"INSERT INTO auth.refresh_tokens(token) VALUES('synthetic-hp1');");}});
 const loaded=readHostedBackup(result.manifestRef,{packageRoot:result.packageRoot,expectedBinding:result.report.binding});const {manifest,data,report}=loaded;
 for(const kind of ['dumpBinary','restoreBinary']){const binary=manifest.environment[kind],file=path.join(input.privateRoot,'actual-'+kind);runtime.docker(['cp',source.container+':'+binary.path,file]);fs.chmodSync(file,0o600);check('HP-ACTUAL-PATH-'+kind,hash(fs.readFileSync(file))===binary.sha256);}
 check('HP-MAIN-BI',report.archiveFidelity.status==='PASS',{checks:report.archiveFidelity.checks.length,tables:data.inventoryBefore.tables.length,nonempty:data.inventoryBefore.tables.filter(t=>t.rows.length).length});
 check('HP-LOCAL-ALLOCATION',report.allocationSafety.status==='LOCAL_PASS');
 check('HP-SEPARATE-CLONE',data.captureExecution.pristineId!==data.captureExecution.allocationId);
 check('HP-TRUST-BLOCKED',loaded.trust.status==='BLOCKED_TRUST');
 const trustRoot=path.join(input.privateRoot,'local-trust');privateClone(result.packageRoot,trustRoot);
 readHostedBackup(result.manifestRef,{packageRoot:trustRoot,expectedBinding:manifest.binding});
 const localManifest=structuredClone(manifest),nonce=randomUUID(),receipt={issuer:'EXPLICIT LOCAL HARNESS; NOT PROVIDER',keyFingerprint:hash('LOCAL_HARNESS_KEY_ID_ONLY'),projectRef:manifest.binding.projectRef,runId:manifest.runId,sourceManifestSha256:manifest.binding.sourceManifestSha256,configGeneration:manifest.environment.configRevision,nonce,issuedUtc:new Date(Date.parse(manifest.createdUtc)-1000).toISOString(),expiresUtc:new Date(Date.parse(manifest.createdUtc)+3600000).toISOString(),assurance:'LOCAL_SYNTHETIC'};
 const receiptBytes=Buffer.from(stable(receipt)+'\n');fs.writeFileSync(path.join(trustRoot,'local-receipt.json'),receiptBytes,{flag:'wx',mode:0o600});localManifest.trustAnchorRef={path:'local-receipt.json',bytes:receiptBytes.length,sha256:hash(receiptBytes)};
 const manifestBytes=Buffer.from(stable(localManifest)+'\n');fs.writeFileSync(path.join(trustRoot,'manifest.json'),manifestBytes);const localRef={path:'manifest.json',bytes:manifestBytes.length,sha256:hash(manifestBytes)},externalTrust={expectedManifestSha256:localRef.sha256,channel:'LOCAL_HARNESS',issuer:receipt.issuer,keyFingerprint:receipt.keyFingerprint,configGeneration:receipt.configGeneration,nonce,receiptSha256:hash(receiptBytes),assurance:'LOCAL_SYNTHETIC'},localOptions={packageRoot:trustRoot,expectedBinding:manifest.binding,externalTrust};
 check('HP-LOCAL-EXTERNAL-PIN',readHostedBackup(localRef,localOptions).trust.status==='LOCAL_HARNESS_PINNED');
 try{requireHostedCutover(localRef,localOptions);check('HP-PIN-DOES-NOT-CERTIFY',false);}catch(e){check('HP-PIN-DOES-NOT-CERTIFY',e.code==='HOSTED_PROFILE_UNSUPPORTED');}
 for(const [id,delta]of [['hash',{expectedManifestSha256:'0'.repeat(64)}],['issuer',{issuer:'FORGED'}],['key',{keyFingerprint:'0'.repeat(64)}],['generation',{configGeneration:'REPLAY'}],['nonce',{nonce:randomUUID()}],['receipt-hash',{receiptSha256:'0'.repeat(64)}]]){try{readHostedBackup(localRef,{...localOptions,externalTrust:{...externalTrust,...delta}});check('HP-TRUST-'+id,false);}catch{check('HP-TRUST-'+id,true);}}
 try{readHostedBackup(localRef,{...localOptions,now:Date.parse(receipt.expiresUtc)});check('HP-TRUST-EXPIRED',false);}catch{check('HP-TRUST-EXPIRED',true);}
 check('HP-ELIGIBILITY',!report.coverageComplete&&!report.cleanupEligible&&!report.executionReady&&report.profileCertification.status==='BLOCKED'&&report.storageCaptureBoundary.status==='BLOCKED'&&report.recovery.status==='BLOCKED');
 check('HP-COMPLETE-ROLES',data.rolesBefore.includes("VALID UNTIL '2030-01-01 00:00:00+00'")&&data.rolesBefore.includes("COMMENT ON ROLE anon IS 'HP1 synthetic role comment'"));
 const fresh=await captureHostedInventory(runtime,source,{appName:'hp1_live_after',consumers:input.consumers});check('HP-SHARED-SNAPSHOT-Q',fresh.tables.find(t=>t.identity==='public.payments').rows.length===2&&data.inventoryBefore.tables.find(t=>t.identity==='public.payments').rows.length===1);
 const controller={backupProof:{path:path.join(result.packageRoot,result.manifestRef.path),sha256:result.manifestRef.sha256},projectRef:manifest.binding.projectRef,backendHost:'kfqjdfwxhkdwihjobpny.supabase.co',database:'postgres',executionRole:'postgres',sourceFingerprint:manifest.binding.permissionFingerprint,bundleHash:manifest.binding.bundleSha256};
 try{loadReleaseEvidence(controller);check('HP-CONTROLLER-PRECONNECT',false);}catch(e){check('HP-CONTROLLER-PRECONNECT',e.code==='HOSTED_TRUST_ANCHOR_REQUIRED');}
 try{await observePermissionReleaseProofs({...controller,backupManifest:controller.backupProof,catalogSupplementOutput:path.join(input.privateRoot,'unused-catalog'),prepareProofOutput:path.join(input.privateRoot,'unused-prepare')},{connect:()=>{throw Error('MUST_NOT_CONNECT');}});check('HP-REHEARSAL-PRECONNECT',false);}catch(e){check('HP-REHEARSAL-PRECONNECT',e.code==='HOSTED_TRUST_ANCHOR_REQUIRED');}
 let mutation=0;
 for(const [id,mutate] of [
  ['row',(m,d)=>{d.pristineInventory.tables.find(t=>t.rows.length).rows[0]+=' changed';}],
  ['catalog-LO',(m,d)=>{d.pristineInventory.catalog.find(c=>c.id==='largeObjects').rows[0]+=' changed';}],
  ['catalog-role',(m,d)=>{d.pristineInventory.catalog.find(c=>c.id==='roles').rows[0]+=' changed';}],
  ['schema',(m,d)=>{d.schemaRestored+='\nALTER TABLE public.stores SET(fillfactor=80);';}],
  ['roles-expiry',(m,d)=>{d.rolesRestored=d.rolesRestored.replace('2030-01-01','2031-01-01');}],
  ['roles-comment',(m,d)=>{d.rolesRestored+='\nCOMMENT ON ROLE anon IS \'changed\';';}],
  ['roles-window',(m,d)=>{d.rolesAfter+='\nCOMMENT ON ROLE anon IS \'changed\';';}],
  ['importer-missing',(m,d)=>{d.snapshotImporters.pop();}],
  ['exporter-pid',(m,d)=>{d.captureExecution.exporter.pid=d.inventoryBefore.backend.pid;}],
  ['source-target',(m,d)=>{d.captureExecution.sourceId='0'.repeat(64);}],
  ['allocation-value',(m,d)=>{d.allocationProbe.observations[0].value='9223372036854775807';}],
  ['command-nonzero',(m,d)=>{d.captureExecution.commands[0].exit=1;}],
  ['command-timeout',(m,d)=>{d.captureExecution.commands[0].truncated=true;}],
  ['command-duplicate',(m,d)=>{d.captureExecution.commands[1]=d.captureExecution.commands[0];}],
  ['check-missing',(m)=>{m.result.archiveFidelity.checks.pop();}],
  ['check-extra',(m)=>{m.result.archiveFidelity.checks.push({id:'invented',status:'PASS'});}],
  ['check-duplicate',(m)=>{m.result.archiveFidelity.checks[1]=m.result.archiveFidelity.checks[0];}],
  ['source',(m)=>{m.binding.sourceManifestSha256='0'.repeat(64);}],
  ['profile',(m)=>{m.profileId='forged';}],
  ['coverage',(m)=>{m.coverage.relations.pop();}],
  ['toc',(m,d)=>{d.toc=d.toc.replace(' TABLE DATA ',' UNSUPPORTED ');}],
  ['authorization',(m)=>{m.authorizationRef=m.evidence.sourceSnapshot;}],
  ['provider',(m)=>{m.environment.providerReceipt=m.evidence.sourceSnapshot;}],
  ['receipt-without-pin',(m)=>{m.trustAnchorRef=m.evidence.sourceSnapshot;}],
 ]){
  const m=structuredClone(manifest),d=structuredClone(data);const dir=path.join(input.privateRoot,'negative-'+(++mutation));privateClone(result.packageRoot,dir);readHostedBackup(result.manifestRef,{packageRoot:dir,expectedBinding:manifest.binding});mutate(m,d);
  for(const k of ['pristineInventory','snapshotImporters','captureExecution','allocationProbe']){const p=path.join(dir,m.evidence[k].path),bytes=Buffer.from(stable(d[k])+'\n');fs.writeFileSync(p,bytes);m.evidence[k]={...m.evidence[k],bytes:bytes.length,sha256:hash(bytes)};}
  for(const k of ['schemaRestored','rolesRestored','rolesAfter','toc']){const p=path.join(dir,m.evidence[k].path),bytes=Buffer.from(d[k]);fs.writeFileSync(p,bytes);m.evidence[k]={...m.evidence[k],bytes:bytes.length,sha256:hash(bytes)};}
  const bytes=Buffer.from(stable(m)+'\n');fs.writeFileSync(path.join(dir,'manifest.json'),bytes);try{readHostedBackup({path:'manifest.json',bytes:bytes.length,sha256:hash(bytes)},{packageRoot:dir,expectedBinding:manifest.binding});check('HP-FORGED-'+id,false);}catch{check('HP-FORGED-'+id,true);}
 }
 const fault=runtime.create('fault',{bootstrap:'hp1_bootstrap'});runtime.restore(fault,path.join(result.packageRoot,'archive.dump'),path.join(result.packageRoot,'roles-before.sql'));
 for(const [id,sql,key] of [
  ['row',"UPDATE public.stores SET name='HP1-SAME-COUNT' WHERE store_no=1",null],
  ['LO',"SELECT lo_put(900001,0,decode('11','hex'))",'largeObjects'],
  ['ACL',"REVOKE SELECT ON LARGE OBJECT 900001 FROM anon",'largeObjects'],
  ['role',"ALTER ROLE anon CONNECTION LIMIT 3",'roles'],
  ['schema',"ALTER TABLE auth.refresh_tokens ALTER COLUMN id SET DEFAULT 999",'columns'],
 ]){runtime.sql(fault,sql,'supabase_admin');const changed=await captureHostedInventory(runtime,fault,{appName:'hp1_fault_'+id.toLowerCase(),consumers:input.consumers});const comparison=deriveHostedReport(manifest,{...data,pristineInventory:changed},{read:ref=>read(result.packageRoot,ref)});check('HP-ACTUAL-FAULT-'+id,key?comparison.archiveFidelity.checks.find(c=>c.id==='catalog:'+key).status==='FAIL':comparison.archiveFidelity.checks.find(c=>c.id==='table:public.stores').status==='FAIL');}
 try{runtime.restore(fault,path.join(result.packageRoot,'archive.dump'),path.join(result.packageRoot,'roles-before.sql'));check('HP-NONEMPTY-RESTORE',false);}catch{check('HP-NONEMPTY-RESTORE',true);}
 const exporter=runtime.session(source),token=await exporter.send('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();');await exporter.close();try{await captureHostedInventory(runtime,source,{token,appName:'hp1_closed_exporter'});check('HP-EXPORTER-EOF',false);}catch{check('HP-EXPORTER-EOF',true);}
 const biOnly=await runHostedLogicalBackup({...config,runId:randomUUID(),consumerApprovalPath:null,consumers:[],output:path.join(input.privateRoot,'capture-bi-only')},{runtime});
 const biLoaded=readHostedBackup(biOnly.manifestRef,{packageRoot:biOnly.packageRoot,expectedBinding:biOnly.report.binding});
 check('HP-ACTUAL-BI-ONLY',biOnly.report.archiveFidelity.status==='PASS'&&biOnly.report.allocationSafety.status==='BLOCKED'&&biLoaded.manifest.evidence.allocationContract===null&&biLoaded.data.allocationProbe.observations.every(x=>x.executed===false&&x.value===null)&&!biOnly.report.cleanupEligible&&!biOnly.report.executionReady,{checks:biOnly.report.archiveFidelity.checks.length});
 // These mutations deliberately keep mutually matching inventories and a
 // recomputed proposed PASS report. Ref/hash-only or report-mismatch rejection
 // would not prove independent denominator and backend checks.
 const inventories=d=>[d.inventoryBefore,d.inventoryAfter,d.pristineInventory,d.allocationProbe.baselineInventory];
 const removeCheck=(m,id)=>{m.result.archiveFidelity.checks=m.result.archiveFidelity.checks.filter(c=>c.id!==id);m.coverage.checkSetDigest=hash(stable(m.result.archiveFidelity.checks.map(c=>c.id).sort()));};
 const rewrite=(dir,ref,bytes)=>{fs.writeFileSync(path.join(dir,ref.path),bytes);return {...ref,bytes:bytes.length,sha256:hash(bytes)};};
 const observation=(d,dir,key,mutate)=>{const e=d.captureExecution,v=strictJson(fs.readFileSync(path.join(dir,e[key].path)));mutate(v);e[key]=rewrite(dir,e[key],Buffer.from(stable(v)+'\n'));};
 const logs=(d,dir,mutate)=>{const e=d.captureExecution,bytes=fs.readFileSync(path.join(dir,e.logsRef.path));e.logsRef=rewrite(dir,e.logsRef,Buffer.from(mutate(bytes.toString('utf8'),e)));};
 const exporterLine=(line,e)=>line.startsWith('HP1 pid='+e.exporter.pid+' app=');
 for(const [id,code,mutate]of[
  ['table-denominator','HOSTED_COVERAGE_INVALID',(m,d)=>{for(const v of inventories(d)){v.relations=v.relations.filter(r=>r.schema+'.'+r.name!=='public.stores');v.tables=v.tables.filter(t=>t.identity!=='public.stores');}d.toc=d.toc.split('\n').filter(x=>!x.includes(' TABLE DATA public stores ')).join('\n');m.coverage.relations=m.coverage.relations.filter(x=>x!=='public.stores');removeCheck(m,'table:public.stores');}],
  ['sequence-denominator','HOSTED_COVERAGE_INVALID',(m,d)=>{for(const v of inventories(d))v.sequenceDefinitions=v.sequenceDefinitions.filter(s=>s.name!=='public.store_no_seq');d.toc=d.toc.split('\n').filter(x=>!x.includes(' SEQUENCE SET public store_no_seq ')).join('\n');d.sequenceSql=d.sequenceSql.split('\n').filter(x=>!x.includes("setval('public.store_no_seq'")).join('\n');m.coverage.sequences=m.coverage.sequences.filter(x=>x!=='public.store_no_seq');removeCheck(m,'sequence:public.store_no_seq');}],
  ['sequence-definition','HOSTED_COVERAGE_INVALID',(_m,d)=>{for(const v of inventories(d))v.sequenceDefinitions.find(s=>s.name==='public.store_no_seq').increment='2';}],
  ['exporter-pid-type','HOSTED_SNAPSHOT_INVALID',(_m,d)=>{d.captureExecution.exporter.pid='NOT_A_BACKEND_PID';}],
  ['exporter-importer-alias','HOSTED_SNAPSHOT_INVALID',(_m,d)=>{d.captureExecution.exporter.pid=d.snapshotImporters.find(x=>x.id==='schemaSource').backend.pid;}],
  ['inventory-importer-binding','HOSTED_SNAPSHOT_INVALID',(_m,d)=>{d.inventoryAfter.backend.pid+=100000;}],
  ['probe-extra','HOSTED_COVERAGE_INVALID',(_m,d)=>{d.allocationProbe.sequenceRestored.push({name:'public.forged_seq',value:'1',called:true});}],
  ['probe-missing','HOSTED_COVERAGE_INVALID',(_m,d)=>{d.allocationProbe.observations.pop();}],
  ['unexecuted-probe-value','HOSTED_SNAPSHOT_INVALID',(_m,d)=>{d.allocationProbe.observations[0].value='1';}],
  ['bi-only-executed-probe','HOSTED_CONSUMERS_UNCERTIFIED',(_m,d)=>{d.allocationProbe.observations[0].executed=true;d.allocationProbe.observations[0].value='1';}],
  ['unsupported-hidden','HOSTED_COVERAGE_INVALID',(m,d)=>{for(const v of inventories(d)){v.relations.find(r=>r.schema+'.'+r.name==='public.stores').kind='m';v.tables=v.tables.filter(t=>t.identity!=='public.stores');const c=v.catalog.find(c=>c.id==='relations');c.rows=c.rows.map(row=>{const r=strictJson(Buffer.from(row));if(r.schema+'.'+r.name==='public.stores')r.kind='m';return stable(r);}).sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)));}d.toc=d.toc.split('\n').filter(x=>!x.includes(' TABLE DATA public stores ')).join('\n');removeCheck(m,'table:public.stores');}],
  ['occupied-unknown','HOSTED_COVERAGE_INVALID',(_m,d)=>{for(const v of inventories(d))v.occupied.push({sequence:'public.forged_seq',table:'public.stores',column:'store_no',cast:'bigint',values:[]});}],
  ['exporter-positive-unobserved','HOSTED_SNAPSHOT_INVALID',(_m,d)=>{d.captureExecution.exporter.pid=2147483647;}],
  ['exporter-forged-observations','HOSTED_SNAPSHOT_INVALID',(_m,d,dir)=>{d.captureExecution.exporter.pid=2147483647;for(const key of ['exporterStartRef','exporterVerifiedRef'])observation(d,dir,key,v=>{v.pid=2147483647;});}],
  ['exporter-start-log-missing','HOSTED_SNAPSHOT_INVALID',(_m,d,dir)=>logs(d,dir,(text,e)=>text.split('\n').filter(line=>!(exporterLine(line,e)&&line.includes('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;'))).join('\n'))],
  ['exporter-verification-log-missing','HOSTED_SNAPSHOT_INVALID',(_m,d,dir)=>logs(d,dir,(text,e)=>text.split('\n').filter(line=>!(exporterLine(line,e)&&line.includes("'readonly',current_setting"))).join('\n'))],
  ['exporter-close-log-missing','HOSTED_SNAPSHOT_INVALID',(_m,d,dir)=>logs(d,dir,(text,e)=>text.split('\n').filter(line=>!(exporterLine(line,e)&&line.endsWith('ROLLBACK;'))).join('\n'))],
  ['exporter-extra-sql','HOSTED_SNAPSHOT_INVALID',(_m,d,dir)=>logs(d,dir,(text,e)=>text+'\nHP1 pid='+e.exporter.pid+' app=hp1_exporter user=postgres db=postgres LOG:  statement: SELECT 1;\n')],
  ['exporter-renamed-app','HOSTED_SNAPSHOT_INVALID',(_m,d,dir)=>logs(d,dir,(text,e)=>text.split('\n').map(line=>exporterLine(line,e)?line.replace('app=hp1_exporter','app=hp1_other'):line).join('\n'))],
  ['importer-after-exporter-close','HOSTED_SNAPSHOT_INVALID',(_m,d,dir)=>logs(d,dir,(text,e)=>{const rows=text.split('\n'),i=d.snapshotImporters[0],index=rows.findIndex(line=>line.startsWith(`HP1 pid=${i.backend.pid} app=${i.appName} user=postgres db=postgres `)&&line.includes(`SET TRANSACTION SNAPSHOT '${e.snapshotToken}'`));assert(index>=0,'HOSTED_SNAPSHOT_INVALID');const moved=rows.splice(index,1)[0];rows.push(moved);return rows.join('\n');})],
  ['exporter-readonly-observation','HOSTED_SNAPSHOT_INVALID',(_m,d,dir)=>observation(d,dir,'exporterVerifiedRef',v=>{v.readonly='off';})],
  ['exporter-visible-observation','HOSTED_SNAPSHOT_INVALID',(_m,d,dir)=>observation(d,dir,'exporterVerifiedRef',v=>{v.visible='0:1:';})],
  ['exporter-invalid-log-utf8','HOSTED_PROOF_INVALID',(_m,d,dir)=>logs(d,dir,text=>Buffer.concat([Buffer.from(text),Buffer.from([255])]))],
 ]){
  const m=structuredClone(biLoaded.manifest),d=structuredClone(biLoaded.data),dir=path.join(input.privateRoot,'denominator-'+id);privateClone(biOnly.packageRoot,dir);readHostedBackup(biOnly.manifestRef,{packageRoot:dir,expectedBinding:m.binding});mutate(m,d,dir);
  for(const k of ['inventoryBefore','inventoryAfter','pristineInventory','allocationProbe','captureExecution','snapshotImporters','toc','sequenceSql']){const bytes=Buffer.from(['toc','sequenceSql'].includes(k)?d[k]:stable(d[k])+'\n');fs.writeFileSync(path.join(dir,m.evidence[k].path),bytes);m.evidence[k]={...m.evidence[k],bytes:bytes.length,sha256:hash(bytes)};}
  const bytes=Buffer.from(stable(m)+'\n');fs.writeFileSync(path.join(dir,'manifest.json'),bytes);try{readHostedBackup({path:'manifest.json',bytes:bytes.length,sha256:hash(bytes)},{packageRoot:dir,expectedBinding:m.binding});check('HP-DENOMINATOR-'+id,false);}catch(e){check('HP-DENOMINATOR-'+id,e.code===code,{rejectionCode:e.code});}
 }
 save('report',{utc:new Date().toISOString(),sourceManifestSha256:input.sourceSnapshot.sha256,permissionFingerprint:manifest.binding.permissionFingerprint,manifestSha256:result.manifestRef.sha256,report,trust:loaded.trust,checks,localOnly:true});
}catch(error){fatal=error.code?.startsWith('HOSTED_')?error.code:'HP1_LOCAL_FAILED';console.log(fatal);fs.writeFileSync(path.join(input.privateRoot,'failure-detail.txt'),error.stack??String(error),{flag:'wx',mode:0o600});}
finally{save('teardown',{utc:new Date().toISOString(),targets:runtime.stopOwned()});save('result',{utc:new Date().toISOString(),fatal,checks,passed:!fatal&&checks.every(c=>c.passed),requiredSkips:0,cleanupEligible:false,executionReady:false});}
if(fatal||checks.some(c=>!c.passed))process.exitCode=1;
