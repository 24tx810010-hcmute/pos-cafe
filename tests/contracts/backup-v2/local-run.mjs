import fs from 'node:fs';
import path from 'node:path';
import {LocalBackupRuntime,writeNew,fileRef,utc} from '../../../scripts/permission-backup-v2-local.mjs';
import {runLogicalBackupV2} from '../../../scripts/permission-backup-v2.mjs';
import {captureInventory,captureRoles} from '../../../scripts/permission-backup-v2-catalog.mjs';
import {readBackupV2,requireBackupV2Cutover,deriveBackupV2Report,sha256,stable,backupV2MethodHash} from '../../../scripts/permission-backup-v2-core.mjs';
import {loadReleaseEvidence} from '../../../scripts/permission-release-cutover.mjs';
import {payment} from './payment-fixture.mjs';

const configPath=process.argv[2];if(!configPath)throw Error('EXPLICIT_LOCAL_RUN_CONFIG_REQUIRED');
const input=JSON.parse(fs.readFileSync(configPath));
const rt=new LocalBackupRuntime(input),checks=[];let fatal=null,output;
const check=(id,passed,detail={})=>{checks.push({id,passed,...detail});console.log(id+': '+(passed?'PASS':'FAIL'));};
const pin=ref=>{if(sha256(fs.readFileSync(ref.path))!==ref.sha256)throw Error('INPUT_DRIFT');return ref.path;};
const save=(name,x)=>writeNew(path.join(input.publicRoot,name+'.json'),x);
save('prerun',{utc:utc(),runner:fileRef(process.argv[1]),config:fileRef(configPath),expected:['fidelity-pass-concurrent','allocation-pass-separate','C-blocked','schema-status-hash-source-check-forgery-rejected','same-count-row-LO-ACL-role-drift','closed-exporter-refused','corrupt-archive-refused'],requiredSkip:0});
try {
  const source=rt.create('source');
  rt.restore(source,pin(input.schemaArchive),pin(input.schemaRoles),JSON.parse(fs.readFileSync(pin(input.schemaMetadata))).extensions,{schemaOnly:true});
  rt.sql(source,fs.readFileSync(pin(input.fixture),'utf8'),'lab_restore');
  rt.sql(source,fs.readFileSync(pin(input.diversity),'utf8'),'lab_restore');
  rt.sql(source,"ALTER ROLE anon VALID UNTIL '2030-01-01 00:00:00+00'; COMMENT ON ROLE anon IS 'v2 synthetic role comment';",'lab_restore');
  const config={...input,schemaVersion:2,kind:'permission-backup-v2-local-config',source,sourceFingerprint:input.sourceSnapshot.sha256,profile:'local-synthetic',projectRef:'local-close3-v2'};
  const initial=await captureInventory(rt,source,{consumers:config.consumers});
  const contractPath=path.join(input.privateRoot,'explicit-consumer-contract.json');
  writeNew(contractPath,{schemaVersion:2,kind:'explicit-local-consumer-contract',sourceId:source.id,sourceFingerprint:config.sourceFingerprint,
    methodSha256:backupV2MethodHash(),fixtureSha256:config.fixture.sha256,diversitySha256:config.diversity.sha256,catalogSha256:sha256(stable(initial.catalog)),
    closedWorld:true,dynamicOrExternalConsumers:false,control:'OWNED_NETWORK_NONE_SYNTHETIC_FIXTURE_ONLY',consumers:config.consumers,
    provenance:{actor:'local test harness',runner:fileRef(process.argv[1]),scope:'Only pinned schema/fixture and this explicit writer harness; not provider/client discovery'}});
  config.consumerApproval=fileRef(contractPath);
  output=await runLogicalBackupV2(config,{runtime:rt,afterSnapshot:async()=>{
    rt.sql(source,'BEGIN;'+payment(2)+'COMMIT;');
    rt.sql(source,"INSERT INTO auth.refresh_tokens(token) VALUES('synthetic-v2-default');",'supabase_auth_admin');
    rt.sql(source,"BEGIN; INSERT INTO auth.refresh_tokens(token) VALUES('synthetic-v2-abort'); ROLLBACK;",'supabase_auth_admin');
    const writer=rt.session(source,'supabase_auth_admin');
    const done=writer.send("DO $$ BEGIN FOR n IN 1..50 LOOP PERFORM nextval('auth.refresh_tokens_id_seq'); PERFORM pg_sleep(0.03); END LOOP; END $$;").finally(()=>writer.close());
    return {done};
  }});
  const loaded=readBackupV2(output.manifestRef,output.report.binding),{manifest,data}=loaded;
  check('V2-ROLE-FIXTURE',data.roles.includes("VALID UNTIL '2030-01-01 00:00:00+00'")&&data.roles.includes("COMMENT ON ROLE anon IS 'v2 synthetic role comment'"));
  check('V2-MAIN',output.report.archiveFidelity.status==='PASS',{checks:output.report.archiveFidelity.checks.length,tableCount:data.captured.tables.length,populated:data.captured.tables.filter(t=>t.rowCount!=='0').length});
  check('V2-ALLOC',output.report.allocationSafety.status==='PASS',{separateClone:manifest.environment.probe!==manifest.environment.pristine});
  check('V2-CONCURRENT',data.execution.sequenceBefore.some((b,i)=>b.value!==data.execution.sequenceAfter[i].value));
  const live=await captureInventory(rt,source,{consumers:config.consumers});
  check('V2-Q',data.captured.tables.find(t=>t.name==='payments').rowCount==='1'&&live.tables.find(t=>t.name==='payments').rowCount==='2');
  try{requireBackupV2Cutover(output.manifestRef,manifest.binding);check('V2-C-BLOCK',false);}catch(e){check('V2-C-BLOCK',e.code==='BACKUP_V2_CUTOVER_BLOCKED');}
  const inv=path.join(input.privateRoot,'fake-inventory.json');writeNew(inv,{});
  try{loadReleaseEvidence({inventory:fileRef(inv),backupProof:output.manifestRef,...manifest.binding});check('V2-CONTROLLER',false);}catch(e){check('V2-CONTROLLER',e.code==='BACKUP_V2_CUTOVER_BLOCKED');}
  // Every mutated proof gets a new graph/root hash. The trusted source/method stay fixed.
  let n=0;
  for(const [id,mutate]of [
    ['status',(m,d)=>{d.report.archiveFidelity.status='FAIL';}],
    ['truncate',(m,d)=>{d.report.archiveFidelity.checks.pop();}],
    ['extra',(m,d)=>{d.report.archiveFidelity.checks.push({id:'invented',status:'PASS'});}],
    ['duplicate',(m,d)=>{d.report.archiveFidelity.checks[1]=d.report.archiveFidelity.checks[0];}],
    ['schema',(m)=>{m.schemaVersion=1;}],
    ['source',(m)=>{m.binding.sourceFingerprint='0'.repeat(64);}],
    ['method',(m)=>{m.binding.methodSha256='0'.repeat(64);}],
    ['target',(m)=>{m.environment.pristine=m.environment.probe;}],
    ['snapshot',(m,d)=>{d.execution.dumpSnapshotHash='0'.repeat(64);}],
    ['catalog-missing',(m,d)=>{delete d.captured.catalog.triggers;}],
    ['forged-row-pass',(m,d)=>{d.restored.tables[0].sha256='0'.repeat(64);}],
    ['forged-schema-pass',(m,d)=>{d.restoredSchema+='\nALTER TABLE public.stores SET (fillfactor=80);';}],
    ['forged-roles-pass',(m,d)=>{d.restoredRoles+='\nALTER ROLE anon VALID UNTIL \'infinity\';';}],
    ['forged-role-window',(m,d)=>{d.windowRoles+='\nCOMMENT ON ROLE anon IS \'changed\';';}],
    ['forged-probe-roles',(m,d)=>{d.probeRoles+='\nCOMMENT ON ROLE anon IS \'changed\';';}],
  ]){
    const m=structuredClone(manifest),d=structuredClone(data);mutate(m,d);
    for(const key of ['report','captured','restored','execution']){const p=path.join(input.privateRoot,`negative-${++n}-${key}.json`);writeNew(p,d[key]);m.artifacts[key]=fileRef(p);}
    const schemaPath=path.join(input.privateRoot,`negative-${++n}-schema.sql`);fs.writeFileSync(schemaPath,d.restoredSchema,{flag:'wx',mode:0o600});m.artifacts.restoredSchema=fileRef(schemaPath);
    for(const key of ['restoredRoles','windowRoles','probeRoles']){const p=path.join(input.privateRoot,`negative-${++n}-${key}.sql`);fs.writeFileSync(p,d[key],{flag:'wx',mode:0o600});m.artifacts[key]=fileRef(p);}
    const p=path.join(input.privateRoot,`negative-${++n}-manifest.json`);writeNew(p,m);
    let rejected=false;try{readBackupV2(fileRef(p),manifest.binding);}catch{rejected=true;}check('V2-PROOF-'+id,rejected);
  }
  const badRef={...output.manifestRef,sha256:'0'.repeat(64)};try{readBackupV2(badRef,manifest.binding);check('V2-PROOF-hash',false);}catch{check('V2-PROOF-hash',true);}
  const fault=rt.create('fault');rt.restore(fault,manifest.artifacts.archive.path,manifest.artifacts.roles.path,data.captured.extensions);
  for(const [id,sql,catalog]of [
    ['row',"update public.stores set name='CHANGED-SAME-COUNT' where store_no=1",null],
    ['LO',"select lo_put(900001,0,decode('11','hex'))",'largeObjects'],
    ['ACL',"revoke select on large object 900001 from anon",'largeObjects'],
    ['role',"alter role anon connection limit 3",'roles'],
    ['default',"alter table auth.refresh_tokens alter column id set default 999",'columns'],
  ]){
    rt.sql(fault,sql,'lab_restore');const state=await captureInventory(rt,fault,{consumers:config.consumers});
    check('V2-FAULT-'+id,catalog?state.catalog[catalog].sha256!==data.captured.catalog[catalog].sha256:state.tables.find(t=>t.name==='stores').sha256!==data.captured.tables.find(t=>t.name==='stores').sha256);
    writeNew(path.join(input.privateRoot,'fault-'+id+'.json'),state);
  }
  try{rt.restore(fault,manifest.artifacts.archive.path,manifest.artifacts.roles.path,data.captured.extensions);check('V2-NONEMPTY',false);}catch(e){check('V2-NONEMPTY',e.code==='BACKUP_V2_NONEMPTY_TARGET');}rt.stop(fault);
  const restrictKey=/^\\restrict ([a-f0-9]{64})$/m.exec(data.roles)?.[1];
  for(const [id,sql] of [['expiration',"ALTER ROLE anon VALID UNTIL '2031-01-01 00:00:00+00'"],['comment',"COMMENT ON ROLE anon IS 'changed role comment'"]]){
    const target=rt.create('role-'+id);rt.restore(target,manifest.artifacts.archive.path,manifest.artifacts.roles.path,data.captured.extensions);
    rt.sql(target,sql,'lab_restore');
    const state=await captureInventory(rt,target,{consumers:config.consumers}),roles=captureRoles(rt,target,restrictKey);
    const report=deriveBackupV2Report(manifest,{...data,restoredRoles:roles});
    check('V2-FAULT-role-'+id,state.catalog.roles.sha256!==data.captured.catalog.roles.sha256&&report.archiveFidelity.checks.find(c=>c.id==='catalog:complete-roles').status==='FAIL');
    writeNew(path.join(input.privateRoot,'role-fault-'+id+'.json'),{state,roles,report});rt.stop(target);
    const window=rt.create('window-'+id);rt.restore(window,manifest.artifacts.archive.path,manifest.artifacts.roles.path,data.captured.extensions);
    const windowApproval=path.join(input.privateRoot,'window-'+id+'-approval.json');
    writeNew(windowApproval,{...JSON.parse(fs.readFileSync(config.consumerApproval.path)),sourceId:window.id});
    try{await runLogicalBackupV2({...config,source:window,consumerApproval:fileRef(windowApproval),output:path.join(input.privateRoot,'window-'+id)},{runtime:rt,afterSnapshot:async()=>{rt.sql(window,sql,'lab_restore');}});check('V2-WINDOW-role-'+id,false);}
    catch(e){check('V2-WINDOW-role-'+id,e.code==='BACKUP_V2_CATALOG_WINDOW_DRIFT');}rt.stop(window);
  }
  const extensionFault=rt.create('extension-fault');rt.restore(extensionFault,manifest.artifacts.archive.path,manifest.artifacts.roles.path,data.captured.extensions);
  rt.sql(extensionFault,'CREATE TABLE public.v2_unbacked(id integer); INSERT INTO public.v2_unbacked VALUES(1); ALTER EXTENSION "uuid-ossp" ADD TABLE public.v2_unbacked;','lab_restore');
  try{await captureInventory(rt,extensionFault);check('V2-EXTENSION-NONCONFIG',false);}catch(e){check('V2-EXTENSION-NONCONFIG',e.code==='BACKUP_V2_EXTENSION_CONTENT_UNSUPPORTED');}rt.stop(extensionFault);
  const exporter=rt.session(source),token=await exporter.send('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();');await exporter.close();
  try{await captureInventory(rt,source,{snapshot:token});check('V2-EXPORTER-EOF',false);}catch{check('V2-EXPORTER-EOF',true);}
  const corrupt=path.join(input.privateRoot,'corrupt.dump');fs.writeFileSync(corrupt,fs.readFileSync(manifest.artifacts.archive.path).subarray(0,100),{flag:'wx',mode:0o600});
  const badTarget=rt.create('corrupt');try{rt.restore(badTarget,corrupt,manifest.artifacts.roles.path,data.captured.extensions);check('V2-CORRUPT',false);}catch{check('V2-CORRUPT',true);}rt.stop(badTarget);
  save('report',{utc:utc(),manifest:output.manifestRef,report:output.report,checks,localOnly:true,cleanupEligible:false});
}catch(e){fatal=e.code??e.message;console.log('LOCAL_RUN_FAILED '+fatal);}
finally{save('teardown',{utc:utc(),targets:rt.stopOwned()});save('result',{utc:utc(),config:fileRef(configPath),checks,fatal,passed:!fatal&&checks.every(c=>c.passed),requiredSkips:0});}
if(fatal||checks.some(c=>!c.passed))process.exitCode=1;
