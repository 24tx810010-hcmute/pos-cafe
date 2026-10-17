import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { LocalBackupRuntime, writeNew, fileRef, utc, literal } from './permission-backup-v2-local.mjs';
import { captureInventory, captureRoles, observeSequences, sequenceValues } from './permission-backup-v2-catalog.mjs';
import { planBackupV2 } from './permission-backup-v2-plan.mjs';
import { sha256, stable, fail, backupV2MethodHash, tocInventory, parseArchiveSequences, deriveBackupV2Report, readBackupV2, assessAllocation, exactSet } from './permission-backup-v2-core.mjs';

// This version deliberately has no hosted transport/control profile. It is the
// complete capture/restore/verifier chain, with local-only mutation guards.
export async function runLogicalBackupV2(config,{runtime,afterSnapshot}={}) {
  if(config.schemaVersion!==2 || config.kind!=='permission-backup-v2-local-config' || config.profile!=='local-synthetic'
    || !/^[a-f0-9]{64}$/.test(config.sourceFingerprint??'') || !Array.isArray(config.consumers)
    || !/^local-[a-z0-9-]+$/.test(config.projectRef??''))fail('BACKUP_V2_CONFIG_INVALID');
  const readPin=ref=>{const bytes=fs.readFileSync(ref.path);if(sha256(bytes)!==ref.sha256)fail('BACKUP_V2_INPUT_HASH');return bytes;};
  readPin(config.fixture); readPin(config.diversity); readPin(config.sourceSnapshot);
  readPin(config.scopeApproval);const scopePlan=planBackupV2(config.scopeApproval.path);
  const approval=JSON.parse(readPin(config.consumerApproval));
  if(approval.schemaVersion!==2 || approval.kind!=='explicit-local-consumer-contract'
    || approval.sourceId!==config.source.id || approval.sourceFingerprint!==config.sourceFingerprint
    || approval.fixtureSha256!==config.fixture.sha256 || approval.diversitySha256!==config.diversity.sha256
    || approval.methodSha256!==backupV2MethodHash() || stable(approval.consumers)!==stable(config.consumers)
    || approval.closedWorld!==true || approval.dynamicOrExternalConsumers!==false
    || approval.control!=='OWNED_NETWORK_NONE_SYNTHETIC_FIXTURE_ONLY')fail('BACKUP_V2_CONSUMER_CONTRACT_REQUIRED');
  if(config.sourceSnapshot.sha256!==config.sourceFingerprint)fail('BACKUP_V2_INPUT_HASH');
  runtime??=new LocalBackupRuntime(config);
  const target=config.source;runtime.guard(target);
  const output=path.resolve(config.output);
  if(!output.startsWith(runtime.privateRoot+path.sep)||fs.existsSync(output))fail('BACKUP_V2_OUTPUT_EXISTS_OR_UNSAFE');
  fs.mkdirSync(output,{mode:0o700});
  const save=(name,value)=>{const p=path.join(output,name+'.json');writeNew(p,value);return fileRef(p);};
  const text=(name,value)=>{const p=path.join(output,name);fs.writeFileSync(p,value,{flag:'wx',mode:0o600});return fileRef(p);};
  const binding={sourceFingerprint:config.sourceFingerprint,projectRef:config.projectRef,methodSha256:backupV2MethodHash()};
  const commands=[];const timed=(id,fn)=>{const started=utc();try{const result=fn();commands.push({id,started,completed:utc(),exit:0});return result;}catch(error){commands.push({id,started,completed:utc(),exit:1});throw error;}};
  const exporter=runtime.session(target);let error=null;
  try {
    const token=await exporter.send("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL idle_in_transaction_session_timeout='180s'; SELECT pg_export_snapshot();");
    const captured=await captureInventory(runtime,target,{snapshot:token,consumers:config.consumers});
    if(approval.catalogSha256!==sha256(stable(captured.catalog)))fail('BACKUP_V2_CONSUMER_CATALOG_DRIFT');
    if(!exactSet(config.consumers.map(c=>c.sequence),captured.sequenceDefinitions.map(s=>s.name))
      || config.consumers.some(c=>stable(captured.consumerFacts[c.sequence])!==stable({table:c.table,column:c.column,cast:c.cast})))fail('BACKUP_V2_CONSUMER_CONTRACT_REQUIRED');
    const names=captured.sequenceDefinitions.map(x=>x.name),before=observeSequences(runtime,target,names);
    const schemaRestrictKey=randomBytes(32).toString('hex');
    const sourceSchema=timed('schema-source',()=>runtime.docker(['exec',target.container,'pg_dump','-h','/lab','-U','postgres','-d','postgres','--schema-only','--create','--restrict-key='+schemaRestrictKey,'--snapshot='+token,'--lock-wait-timeout=2s']));
    const sourceRoles=timed('roles',()=>captureRoles(runtime,target,schemaRestrictKey));
    const roles=text('roles.sql',sourceRoles);
    const concurrent=afterSnapshot?await afterSnapshot({runtime,target,token,captured}):null;
    timed('dump',()=>{runtime.guard(target);runtime.docker(['exec',target.container,'pg_dump','-h','/lab','-U','postgres','-d','postgres','-Fc','--create','--snapshot='+token,'--lock-wait-timeout=2s','-f','/lab/v2capture.dump']);});
    if(concurrent?.done)await concurrent.done;
    const snapshotAgain=await captureInventory(runtime,target,{snapshot:token,consumers:config.consumers});
    if(stable(captured)!==stable(snapshotAgain))fail('BACKUP_V2_SNAPSHOT_DRIFT');
    const after=observeSequences(runtime,target,names);await exporter.close();
    const liveCatalog=await captureInventory(runtime,target,{consumers:config.consumers});
    const windowRoles=timed('roles-window',()=>captureRoles(runtime,target,schemaRestrictKey));
    if(sourceRoles!==windowRoles)fail('BACKUP_V2_CATALOG_WINDOW_DRIFT');
    if(stable(captured.catalog)!==stable(liveCatalog.catalog))fail('BACKUP_V2_CATALOG_WINDOW_DRIFT');
    runtime.copyOut(target,'/lab/v2capture.dump',path.join(output,'archive.dump'));const archive=fileRef(path.join(output,'archive.dump'));
    const tocText=timed('toc',()=>runtime.docker(['exec',target.container,'pg_restore','-l','/lab/v2capture.dump']));
    const toc=tocInventory(tocText);runtime.docker(['exec','-i',target.container,'tee','/lab/v2sequence.list'],toc.sequenceList);
    const sequenceSql=timed('extract',()=>runtime.docker(['exec',target.container,'pg_restore','--use-list=/lab/v2sequence.list','--file=-','/lab/v2capture.dump']));
    const archiveSequences=parseArchiveSequences(sequenceSql,names);
    const pristine=runtime.create('pristine'),probe=runtime.create('probe');
    timed('restore-pristine',()=>runtime.restore(pristine,archive.path,roles.path,captured.extensions));
    const restored=await captureInventory(runtime,pristine,{consumers:config.consumers});restored.sequenceState=sequenceValues(observeSequences(runtime,pristine,names));
    const restoredSchema=timed('schema-restored',()=>runtime.docker(['exec',pristine.container,'pg_dump','-h','/lab','-U','postgres','-d','postgres','--schema-only','--create','--restrict-key='+schemaRestrictKey,'--lock-wait-timeout=2s']));
    const restoredRoles=timed('roles-restored',()=>captureRoles(runtime,pristine,schemaRestrictKey));
    timed('restore-probe',()=>runtime.restore(probe,archive.path,roles.path,captured.extensions));
    const probeRoles=timed('roles-probe',()=>captureRoles(runtime,probe,schemaRestrictKey));
    const probeInventory=await captureInventory(runtime,probe,{consumers:config.consumers});
    if(stable(probeInventory.tables)!==stable(restored.tables)||stable(probeInventory.catalog)!==stable(restored.catalog))fail('BACKUP_V2_PROBE_BASELINE_DRIFT');
    const observations=[];
    for(const sequence of archiveSequences){
      const consumer=config.consumers.find(c=>c.sequence===sequence.name);
      const result=assessAllocation({...captured.sequenceDefinitions.find(x=>x.name===sequence.name),...sequence},consumer,captured.occupied[sequence.name]);
      if(result.status==='PASS')observations.push({name:sequence.name,executed:true,value:runtime.sql(probe,`select nextval(${literal(sequence.name)})::text`)});
      else observations.push({name:sequence.name,executed:false,reason:result.reason});
    }
    const environment={source:target.id,pristine:pristine.id,probe:probe.id,image:runtime.image,network:'none',ports:[],profile:'local-synthetic'};
    const execution={environment,binding,snapshotHash:sha256(token),dumpSnapshotHash:sha256(token),archiveSha256:archive.sha256,
      fixtureSha256:config.fixture.sha256,diversitySha256:config.diversity.sha256,consumerApprovalSha256:config.consumerApproval.sha256,
      scopeApprovalSha256:scopePlan.scopeApprovalSha256,scopeMode:'SYNTHETIC_FIXTURE; NOT_HOSTED_SCOPE_OBSERVATION',
      commands,pristineEmpty:true,probeEmpty:true,rolesWindowStable:true,sequenceBefore:before,sequenceAfter:after,
      runtime:{node:process.version,nodeSha256:sha256(fs.readFileSync(process.execPath)),pgDump:runtime.docker(['exec',target.container,'pg_dump','--version'])}};
    const contract={schemaVersion:2,kind:'closed-world-local-v1',binding,catalogSha256:sha256(stable(captured.catalog)),fixtureSha256:config.fixture.sha256,
      consumerApprovalSha256:config.consumerApproval.sha256,control:'OWNED_NETWORK_NONE_SYNTHETIC_FIXTURE_ONLY',consumers:config.consumers};
    const probeResult={container:probe.id,pristine:pristine.id,archiveSha256:archive.sha256,observations,pristineAfter:sequenceValues(observeSequences(runtime,pristine,names))};
    const storage=config.storageCapture?JSON.parse(readPin(config.storageCapture)):{schemaVersion:2,kind:'separate-storage-capture',objects:[],control:null};
    const data={captured,restored,execution,contract,probe:probeResult,storage,toc:tocText,sequenceSql,sourceSchema,restoredSchema,roles:sourceRoles,windowRoles,restoredRoles,probeRoles,consumerApproval:approval};
    const artifacts={archive,roles,scopeApproval:config.scopeApproval,consumerApproval:config.consumerApproval,fixture:config.fixture,diversity:config.diversity,
      sourceSnapshot:config.sourceSnapshot,sourceSchema:text('source-schema.sql',sourceSchema),restoredSchema:text('restored-schema.sql',restoredSchema),toc:text('archive.toc',tocText),sequenceSql:text('sequence.sql',sequenceSql)};
    for(const key of ['windowRoles','restoredRoles','probeRoles'])artifacts[key]=text(key+'.sql',data[key]);
    for(const key of ['captured','restored','execution','contract','probe','storage'])artifacts[key]=save(key,data[key]);
    const manifest={schemaVersion:2,kind:'permission-logical-backup',binding,environment,artifacts};
    const report=deriveBackupV2Report(manifest,data);artifacts.report=save('report',report);
    const manifestRef=save('manifest',manifest);
    const loaded=readBackupV2(manifestRef,binding);
    return {manifestRef,report:loaded.report,targets:{pristine,probe},runtime};
  } catch(e) {error=e;save('failure',{utc:utc(),code:e.code??'BACKUP_V2_CAPTURE_FAILED',commands,cleanupEligible:false});throw e;}
  finally {await exporter.close(); if(error)writeNew(path.join(output,'owned-targets.json'),runtime.owned);}
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  let runtime;
  try{
    if(process.argv.length!==4||process.argv[2]!=='--config')fail('BACKUP_V2_EXPLICIT_CONFIG_REQUIRED');
    const config=JSON.parse(fs.readFileSync(path.resolve(process.argv[3]),'utf8'));runtime=new LocalBackupRuntime(config);
    const result=await runLogicalBackupV2(config,{runtime});console.log(JSON.stringify({manifest:result.manifestRef,report:result.report}));
    if(result.report.archiveFidelity.status!=='PASS')process.exitCode=1;
  }catch(error){console.error(error.code??'BACKUP_V2_CAPTURE_FAILED');process.exitCode=1;}
  finally{if(runtime)writeNew(path.join(runtime.privateRoot,'teardown-'+Date.now()+'.json'),runtime.stopOwned());}
}
