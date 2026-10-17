import fs from 'node:fs';
import path from 'node:path';
import {assert,exact,list,unique,same,hash,stable,SHA,QUALIFIED,IDENT,LIMITS,int64,utc,strictJson,readRef,validateManifest,validateRef,assertPrivateRoot} from './permission-hosted-schema.mjs';
import {checkImplementation,verifyExternalTrust,CERTIFIED_HOSTED_PROFILES,requireImplementedEnvironment} from './permission-hosted-profile.mjs';
import {assessStorage,assessClosure,assessRecovery,assessJournal} from './permission-hosted-controls.mjs';
import {CATALOG_IDS,parseArchiveSequences,tocInventory,assessAllocation} from './permission-backup-v2-core.mjs';
import {verifySourceArchive} from './permission-hosted-source.mjs';

export function validateBackendIdentity(v){
 exact(v,['database','actor','sessionUser','pid','serverVersion']);assert(v.database==='postgres'&&v.actor==='postgres'&&v.sessionUser==='postgres'&&Number.isSafeInteger(v.pid)&&v.pid>0&&v.pid<=2147483647&&typeof v.serverVersion==='string'&&v.serverVersion.length>0&&v.serverVersion.length<=4096,'HOSTED_SNAPSHOT_INVALID');return v;
}
export function validateInventory(v){
 exact(v,['backend','snapshot','relations','sequenceDefinitions','tables','catalog','occupied','unsupported']);
 validateBackendIdentity(v.backend);
 exact(v.snapshot,['tokenHash','visibleHash']);for(const x of Object.values(v.snapshot))assert(x===null||SHA.test(x));
 list(v.relations,LIMITS.relations,r=>{exact(r,['schema','name','kind','owner','extension','config','condition']);assert(IDENT.test(r.schema)&&IDENT.test(r.name)&&['r','p','m','f'].includes(r.kind)&&IDENT.test(r.owner)&&typeof r.config==='boolean');assert(r.extension===null||typeof r.extension==='string');assert(r.condition===null||typeof r.condition==='string');});unique(v.relations.map(r=>r.schema+'.'+r.name));
 list(v.sequenceDefinitions,LIMITS.sequences,s=>{exact(s,['name','type','start','increment','min','max','cache','cycle','owner']);assert(QUALIFIED.test(s.name)&&['smallint','integer','bigint'].includes(s.type)&&IDENT.test(s.owner)&&typeof s.cycle==='boolean');for(const k of ['start','increment','min','max','cache'])int64(s[k]);});unique(v.sequenceDefinitions.map(s=>s.name));
 const rows=x=>{list(x,LIMITS.rows,r=>assert(typeof r==='string'&&Buffer.byteLength(r)<=1024*1024));assert(same(x,[...x].sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)))));};
 list(v.tables,LIMITS.relations,t=>{exact(t,['identity','rows']);assert(QUALIFIED.test(t.identity));rows(t.rows);});unique(v.tables.map(t=>t.identity));
 assert(same(v.tables.map(t=>t.identity).sort(),v.relations.filter(r=>r.kind==='r').map(r=>r.schema+'.'+r.name).sort()),'HOSTED_COVERAGE_INVALID');
 list(v.catalog,LIMITS.catalogs,c=>{exact(c,['id','rows']);assert(CATALOG_IDS.includes(c.id));rows(c.rows);});unique(v.catalog.map(c=>c.id));assert(same(v.catalog.map(c=>c.id).sort(),[...CATALOG_IDS].sort()));
 const canonical=values=>values.map(stable).sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)));
 assert(same(v.catalog.find(c=>c.id==='relations').rows,canonical(v.relations)),'HOSTED_COVERAGE_INVALID');
 const sequenceCatalog=v.sequenceDefinitions.map(s=>{const [schema,name]=s.name.split('.');return {schema,name,owner:s.owner,dataType:s.type,start:s.start,increment:s.increment,minimum:s.min,maximum:s.max,cache:s.cache,cycle:s.cycle};});
 assert(same(v.catalog.find(c=>c.id==='sequences').rows,canonical(sequenceCatalog)),'HOSTED_COVERAGE_INVALID');
 list(v.occupied,LIMITS.sequences,c=>{exact(c,['sequence','table','column','cast','values']);assert(QUALIFIED.test(c.sequence)&&QUALIFIED.test(c.table)&&IDENT.test(c.column)&&['smallint','integer','bigint'].includes(c.cast));list(c.values,LIMITS.rows,int64);});unique(v.occupied.map(c=>c.sequence));
 list(v.unsupported,LIMITS.relations,x=>{exact(x,['identity','reason']);assert(typeof x.identity==='string'&&typeof x.reason==='string');});unique(v.unsupported.map(x=>x.identity));
 const unsupported=v.relations.filter(r=>!['r','p'].includes(r.kind)||r.extension&&(!r.config||r.condition)).map(r=>({identity:r.schema+'.'+r.name,reason:'UNSUPPORTED_RELATION_OR_EXTENSION_CONTENT'}));
 assert(same(canonical(v.unsupported),canonical(unsupported))&&v.occupied.every(c=>v.sequenceDefinitions.some(s=>s.name===c.sequence)&&v.tables.some(t=>t.identity===c.table)),'HOSTED_COVERAGE_INVALID');
 return v;
}
export function requiredChecks(inventory){
 validateInventory(inventory);
 return ['snapshot:shared','snapshot:all-importers','archive:toc','catalog:complete-schema','catalog:complete-roles','catalog:roles-window','inventory:relations','inventory:sequences','inventory:supported',
  ...inventory.tables.map(t=>'table:'+t.identity),...CATALOG_IDS.map(id=>'catalog:'+id),...inventory.sequenceDefinitions.map(s=>'sequence:'+s.name)].sort();
}
const state=values=>{list(values,LIMITS.sequences,s=>{exact(s,['name','value','called']);assert(QUALIFIED.test(s.name)&&typeof s.called==='boolean');int64(s.value);});unique(values.map(s=>s.name));return values;};
const identityEqual=(a,b)=>a.database===b.database&&a.actor===b.actor&&a.sessionUser===b.sessionUser&&a.serverVersion===b.serverVersion;
export function correlateExporterLog(logs,exporter,importers){
 validateBackendIdentity(exporter);assert(typeof logs==='string','HOSTED_SNAPSHOT_INVALID');const lines=logs.split('\n'),statements=[];
 const prefix='HP1 pid='+exporter.pid+' app=';
 for(let index=0;index<lines.length;index++)if(lines[index].startsWith(prefix)){
  const match=/^HP1 pid=\d+ app=([^ ]*) user=postgres db=postgres LOG:  statement: (.*)$/.exec(lines[index]);
  if(match)statements.push({index,app:match[1],sql:match[2].trim()});
 }
 const expected=['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;',"SET LOCAL application_name='hp1_exporter';","SET LOCAL idle_in_transaction_session_timeout='180s';","SELECT json_build_object('token',pg_export_snapshot(),'visible',pg_current_snapshot()::text,'database',current_database(),'actor',current_user,'sessionUser',session_user,'pid',pg_backend_pid(),'serverVersion',version());","SELECT json_build_object('pid',pg_backend_pid(),'visible',pg_current_snapshot()::text,'readonly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'));",'ROLLBACK;'];
 assert(same(statements.map(x=>x.sql),expected)&&statements.slice(2).every(x=>x.app==='hp1_exporter'),'HOSTED_SNAPSHOT_INVALID');
 const exported=statements[3].index,verified=statements[4].index,closed=statements[5].index;assert(exported<verified&&verified<closed,'HOSTED_SNAPSHOT_INVALID');
 for(const importer of importers){const importerPrefix=`HP1 pid=${importer.backend.pid} app=${importer.appName} user=postgres db=postgres `;const index=lines.findIndex(line=>line.startsWith(importerPrefix)&&line.includes(`SET TRANSACTION SNAPSHOT '${importer.token}'`));assert(index>exported&&index<verified,'HOSTED_SNAPSHOT_INVALID');}
 return {exported,verified,closed};
}
export function deriveHostedReport(m,d,{now=Date.parse(m.createdUtc),read=()=>{throw Error('HOSTED_INPUT_INVALID');}}={}){
 validateManifest(m);checkImplementation(m.binding);requireImplementedEnvironment(m);
 const a=validateInventory(d.inventoryBefore),b=validateInventory(d.pristineInventory),after=validateInventory(d.inventoryAfter);
 assert(d.sourceSnapshot&&hash(d.sourceSnapshot)===m.binding.sourceManifestSha256);
 const source=strictJson(d.sourceSnapshot);assert(Array.isArray(source.entries)&&source.entries.length>0&&source.entries.length<=100000);
 // Source bytes carry every executable and test, rather than a digest-only claim.
 for(const e of source.entries){assert(typeof e.path==='string'&&!e.path.includes('..')&&!path.isAbsolute(e.path));if(e.deleted){assert(!e.sha256);continue;}assert(SHA.test(e.sha256)&&Number.isSafeInteger(e.bytes)&&e.bytes>=0);}
 const e=d.captureExecution;exact(e,['runId','binding','sourceId','exporter','exporterStartRef','exporterVerifiedRef','snapshotToken','visibleSnapshotHash','exporterStarted','exporterVerified','exporterClosed','commands','logsRef','sourceArchiveRef','scopeApprovalRef','pristineId','allocationId','pristineWasEmpty','allocationWasEmpty','archiveSha256']);
 validateBackendIdentity(e.exporter);
 validateRef(e.sourceArchiveRef,LIMITS.archive);assert(same(e.sourceArchiveRef,source.archive)&&hash(read(e.sourceArchiveRef))===source.archive.sha256,'HOSTED_INPUT_INVALID');
 assert([e.sourceId,e.pristineId,e.allocationId].every(x=>SHA.test(x)));unique([e.sourceId,e.pristineId,e.allocationId]);
 verifySourceArchive(source,read(e.sourceArchiveRef),m.binding.permissionFingerprint);for(const ref of source.specReferences)read(ref);
 validateRef(e.scopeApprovalRef);assert(e.scopeApprovalRef.sha256===m.binding.scopeApprovalSha256&&hash(read(e.scopeApprovalRef))===m.binding.scopeApprovalSha256,'HOSTED_INPUT_INVALID');
 for(const k of ['catalogWindow','actorRehearsal','controllerRehearsal','deploymentProvenance'])assert(d[k]===null,'HOSTED_PROFILE_UNSUPPORTED');
 assert(e.runId===m.runId&&same(e.binding,m.binding)&&e.archiveSha256===m.evidence.archive.sha256&&e.pristineId!==e.allocationId&&e.pristineWasEmpty===true&&e.allocationWasEmpty===true);
 assert(/^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$/.test(e.snapshotToken)&&SHA.test(e.visibleSnapshotHash));
 assert(identityEqual(e.exporter,a.backend)&&e.exporter.pid!==a.backend.pid,'HOSTED_SNAPSHOT_INVALID');
 const start=utc(e.exporterStarted),verified=utc(e.exporterVerified),closed=utc(e.exporterClosed);assert(start<=verified&&verified<=closed,'HOSTED_SNAPSHOT_INVALID');
 const commandIds=['inventoryBefore','schemaSource','rolesBefore','archive','inventoryAfter','rolesAfter','toc','sequenceSql','restorePristine','schemaRestored','rolesRestored','restoreAllocation','allocationProbe','pristineRecheck'];
 list(e.commands,LIMITS.commands,c=>{exact(c,['id','started','completed','exit','stdoutSha256','stderrSha256','truncated']);assert(typeof c.id==='string'&&utc(c.started)<=utc(c.completed)&&c.exit===0&&c.truncated===false&&SHA.test(c.stdoutSha256)&&SHA.test(c.stderrSha256),'HOSTED_COVERAGE_INVALID');});unique(e.commands.map(c=>c.id));assert(same(e.commands.map(c=>c.id).sort(),commandIds.sort()),'HOSTED_COVERAGE_INVALID');
 const importers=d.snapshotImporters;list(importers,LIMITS.importers,x=>{exact(x,['id','appName','backend','snapshotHash']);assert(typeof x.appName==='string'&&/^hp1_[a-z0-9_]+$/.test(x.appName)&&SHA.test(x.snapshotHash));validateBackendIdentity(x.backend);assert(identityEqual(x.backend,a.backend)&&x.backend.pid!==e.exporter.pid,'HOSTED_SNAPSHOT_INVALID');});unique(importers.map(x=>x.id));unique(importers.map(x=>x.appName));unique(importers.map(x=>x.backend.pid));
 const wanted=['inventoryBefore','inventoryAfter','schemaSource','archive'];assert(same(importers.map(x=>x.id).sort(),wanted.sort()),'HOSTED_SNAPSHOT_INVALID');
 assert(same(importers.find(x=>x.id==='inventoryBefore').backend,a.backend)&&same(importers.find(x=>x.id==='inventoryAfter').backend,after.backend)&&identityEqual(a.backend,after.backend)&&identityEqual(a.backend,b.backend),'HOSTED_SNAPSHOT_INVALID');
 for(const key of ['exporterStartRef','exporterVerifiedRef'])validateRef(e[key]);const startedObservation=strictJson(read(e.exporterStartRef)),verifiedObservation=strictJson(read(e.exporterVerifiedRef));
 exact(startedObservation,['token','visible','database','actor','sessionUser','pid','serverVersion']);exact(verifiedObservation,['pid','visible','readonly','isolation']);
 const {token:observedToken,visible:observedVisible,...observedBackend}=startedObservation;validateBackendIdentity(observedBackend);
 const visible=x=>typeof x==='string'&&x.length<=65536&&/^[0-9]+:[0-9]+:(?:[0-9]+(?:,[0-9]+)*)?(?![\s\S])/.test(x);
 assert(same(observedBackend,e.exporter)&&observedToken===e.snapshotToken&&visible(observedVisible)&&hash(observedVisible)===e.visibleSnapshotHash&&verifiedObservation.pid===e.exporter.pid&&visible(verifiedObservation.visible)&&hash(verifiedObservation.visible)===e.visibleSnapshotHash&&verifiedObservation.readonly==='on'&&verifiedObservation.isolation==='repeatable read','HOSTED_SNAPSHOT_INVALID');
 validateRef(e.logsRef);const logs=new TextDecoder('utf-8',{fatal:true}).decode(read(e.logsRef)),tokenHash=hash(e.snapshotToken);
 correlateExporterLog(logs,e.exporter,importers.map(x=>({...x,token:e.snapshotToken})));
 const importerPass=importers.every(x=>{
  const cmd=e.commands.find(c=>c.id===x.id),prefix=`HP1 pid=${x.backend.pid} app=${x.appName} user=postgres db=postgres `;
  return x.snapshotHash===tokenHash&&utc(cmd.started)>=start&&utc(cmd.completed)<=verified&&logs.split('\n').some(line=>line.startsWith(prefix)&&line.includes(`SET TRANSACTION SNAPSHOT '${e.snapshotToken}'`));
 });
 let archiveSequences,toc;try{archiveSequences=parseArchiveSequences(d.sequenceSql,a.sequenceDefinitions.map(s=>s.name));toc=tocInventory(d.toc);}catch{assert(false,'HOSTED_COVERAGE_INVALID');}
 const probe=d.allocationProbe;exact(probe,['targetId','pristineId','archiveSha256','sequenceRestored','pristineAfter','observations','baselineCatalogSha256','baselineInventory']);assert(probe.targetId===e.allocationId&&probe.pristineId===e.pristineId&&probe.archiveSha256===m.evidence.archive.sha256);state(probe.sequenceRestored);state(probe.pristineAfter);validateInventory(probe.baselineInventory);assert(same(probe.baselineInventory.catalog,a.catalog)&&same(probe.baselineInventory.tables,a.tables),'HOSTED_COVERAGE_INVALID');
 list(probe.observations,LIMITS.sequences,x=>{exact(x,['name','executed','value']);assert(QUALIFIED.test(x.name)&&typeof x.executed==='boolean');if(x.value!==null)int64(x.value);});unique(probe.observations.map(x=>x.name));
 const sequenceNames=a.sequenceDefinitions.map(s=>s.name).sort();for(const values of [probe.sequenceRestored,probe.pristineAfter,probe.observations])assert(same(values.map(s=>s.name).sort(),sequenceNames),'HOSTED_COVERAGE_INVALID');
 assert(identityEqual(a.backend,probe.baselineInventory.backend)&&probe.observations.every(x=>x.executed?x.value!==null:x.value===null),'HOSTED_SNAPSHOT_INVALID');
 if(d.allocationContract===null)assert(probe.observations.every(x=>x.executed===false&&x.value===null),'HOSTED_CONSUMERS_UNCERTIFIED');
 const checks=[];const check=(id,ok)=>checks.push({id,status:ok?'PASS':'FAIL'});
 check('snapshot:shared',a.snapshot.tokenHash===tokenHash&&after.snapshot.tokenHash===tokenHash&&a.snapshot.visibleHash===e.visibleSnapshotHash&&after.snapshot.visibleHash===e.visibleSnapshotHash&&same({...a,backend:null},{...after,backend:null}));
 check('snapshot:all-importers',importerPass);
 check('archive:toc',same(toc.tables.sort(),a.tables.map(t=>t.identity).sort())&&same(toc.sequences.sort(),a.sequenceDefinitions.map(s=>s.name).sort()));
 check('catalog:complete-schema',d.schemaSource===d.schemaRestored);
 check('catalog:complete-roles',d.rolesBefore===d.rolesRestored);
 check('catalog:roles-window',d.rolesBefore===d.rolesAfter);
 check('inventory:relations',same(a.relations,b.relations)&&same(a.tables.map(t=>t.identity),b.tables.map(t=>t.identity)));
 check('inventory:sequences',same(a.sequenceDefinitions,b.sequenceDefinitions));
 check('inventory:supported',a.unsupported.length===0&&b.unsupported.length===0);
 for(const t of a.tables)check('table:'+t.identity,same(t.rows,b.tables.find(x=>x.identity===t.identity)?.rows));
 for(const c of a.catalog)check('catalog:'+c.id,same(c.rows,b.catalog.find(x=>x.id===c.id)?.rows));
 for(const s of archiveSequences)check('sequence:'+s.name,same(s,probe.sequenceRestored.find(x=>x.name===s.name))&&same(s,probe.pristineAfter.find(x=>x.name===s.name)));
 checks.sort((x,y)=>x.id<y.id?-1:1);const ids=requiredChecks(a);assert(same(checks.map(x=>x.id),ids)&&m.coverage.checkSetDigest===hash(stable(ids))&&same(m.coverage.relations,a.relations.map(r=>r.schema+'.'+r.name).sort())&&same(m.coverage.sequences,a.sequenceDefinitions.map(s=>s.name).sort())&&same(m.coverage.catalogs,[...CATALOG_IDS].sort()),'HOSTED_COVERAGE_INVALID');
 const allocation=deriveAllocation(m,a,archiveSequences,probe,d.allocationContract,read,e.sourceId);
 if(d.journal!==null)assert(d.journal.runId===m.runId,'HOSTED_PROOF_INVALID');
 const storage=assessStorage(d.storageCapture??null,m.binding,m.runId,now,read);
 return {schemaVersion:3,kind:'permission-hosted-logical-backup-report',binding:m.binding,archiveFidelity:{status:checks.every(c=>c.status==='PASS')?'PASS':'FAIL',checks},allocationSafety:allocation,cutoverConcurrency:assessClosure(d.scopeObservation??null),storageCaptureBoundary:storage,recovery:assessRecovery(d.recoveryAssessment??null),deployment:{status:'BLOCKED',reason:'HOSTED_DEPLOYMENT_BINDING_INVALID'},journal:assessJournal(d.journal??null),profileCertification:{status:'BLOCKED',reason:'HOSTED_PROVIDER_PROFILE_UNCERTIFIED'},coverageComplete:false,cleanupEligible:false,executionReady:false};
}
function deriveAllocation(m,a,sequences,p,contract,read,sourceId){
 const blocked=()=>({status:'BLOCKED',checks:[{id:'consumers',status:'BLOCKED',reason:'HOSTED_CONSUMERS_UNCERTIFIED'}]});
 if(contract===null||contract===undefined)return blocked();
 exact(contract,['schemaVersion','kind','binding','runId','catalogSha256','approvalRef','consumers','paths','sourceBinarySha256','serviceConfigSha256','controlGeneration','issuer','issuedUtc','expiresUtc','provenance','complete']);
 assert(contract.schemaVersion===3&&contract.kind==='permission-hosted-consumer-contract'&&same(contract.binding,m.binding)&&contract.runId===m.runId&&contract.catalogSha256===hash(stable(a.catalog))&&SHA.test(contract.sourceBinarySha256)&&SHA.test(contract.serviceConfigSha256));
 for(const k of ['controlGeneration','issuer'])assert(typeof contract[k]==='string'&&contract[k].length>0);utc(contract.issuedUtc);utc(contract.expiresUtc);assert(typeof contract.complete==='boolean');
 list(contract.paths,128,x=>{exact(x,['kind','identity','binarySha256','configSha256']);assert(['default','trigger','function','direct','remote','provider','explicit-id'].includes(x.kind)&&typeof x.identity==='string'&&SHA.test(x.binarySha256)&&SHA.test(x.configSha256));});
 list(contract.consumers,LIMITS.sequences,c=>{exact(c,['sequence','table','column','cast']);assert(QUALIFIED.test(c.sequence)&&QUALIFIED.test(c.table)&&IDENT.test(c.column)&&['smallint','integer','bigint'].includes(c.cast));});unique(contract.consumers.map(c=>c.sequence));
 assert(['LOCAL_SYNTHETIC','PROVIDER_CERTIFIED'].includes(contract.provenance));
 validateRef(contract.approvalRef);const approval=strictJson(read(contract.approvalRef));exact(approval,['schemaVersion','kind','sourceTargetId','sourceManifestSha256','methodSha256','catalogSha256','fixtureSha256','diversitySha256','consumers','paths','provenance','control','complete']);
 assert(approval.schemaVersion===3&&approval.kind==='permission-hosted-local-consumer-approval'&&approval.sourceTargetId===sourceId&&approval.sourceManifestSha256===m.binding.sourceManifestSha256&&approval.methodSha256===m.binding.methodSha256&&approval.catalogSha256===contract.catalogSha256&&same(approval.consumers,contract.consumers)&&same(approval.paths,contract.paths)&&approval.provenance==='LOCAL_SYNTHETIC'&&approval.control==='OWNED_NETWORK_NONE_EXPLICIT_HARNESS'&&approval.complete===contract.complete&&SHA.test(approval.fixtureSha256)&&SHA.test(approval.diversitySha256),'HOSTED_CONSUMERS_UNCERTIFIED');
 if(contract.provenance!=='LOCAL_SYNTHETIC'||m.environment.provenance!=='LOCAL_SYNTHETIC'||!contract.complete||utc(contract.issuedUtc)>utc(m.createdUtc)||utc(contract.expiresUtc)<=utc(m.createdUtc)||!same(contract.consumers.map(c=>c.sequence).sort(),sequences.map(s=>s.name).sort()))return blocked();
 assert(p.baselineCatalogSha256===hash(stable(a.catalog)));
 const checks=sequences.map(s=>{const c=contract.consumers.find(x=>x.sequence===s.name),o=a.occupied.find(x=>x.sequence===s.name);if(!o||!same(c,{sequence:o.sequence,table:o.table,column:o.column,cast:o.cast}))return {id:s.name,status:'BLOCKED',reason:'HOSTED_CONSUMERS_UNCERTIFIED'};
  const result=assessAllocation({...a.sequenceDefinitions.find(x=>x.name===s.name),...s},c,o.values),actual=p.observations.find(x=>x.name===s.name);
  return {id:s.name,...(result.status==='PASS'&&(!actual?.executed||actual.value!==result.next)?{status:'FAIL',reason:'ACTUAL_ALLOCATION_MISMATCH'}:result)};});
 return {status:checks.some(c=>c.status==='FAIL')?'FAIL':checks.some(c=>c.status==='BLOCKED')?'BLOCKED':'LOCAL_PASS',checks};
}

const TEXT_KEYS=['toc','sequenceSql','rolesBefore','rolesAfter','rolesRestored','schemaSource','schemaRestored'];
export function readHostedBackup(manifestRef,{packageRoot,expectedBinding,externalTrust=null,now}={}){
 try{
  assert(typeof packageRoot==='string'&&expectedBinding,'HOSTED_INPUT_INVALID');assertPrivateRoot(packageRoot);const bytes=readRef(packageRoot,manifestRef),manifest=strictJson(bytes);validateManifest(manifest);checkImplementation(manifest.binding);requireImplementedEnvironment(manifest);assert(same(manifest.binding,expectedBinding),'HOSTED_PROOF_INVALID');
  const data={};for(const [key,ref]of Object.entries(manifest.evidence)){if(ref===null){data[key]=null;continue;}const b=readRef(packageRoot,ref,key==='archive'?LIMITS.archive:LIMITS.envelope);data[key]=key==='archive'||key==='sourceSnapshot'?b:TEXT_KEYS.includes(key)?new TextDecoder('utf-8',{fatal:true}).decode(b):strictJson(b);}
  const receipt=manifest.trustAnchorRef?strictJson(readRef(packageRoot,manifest.trustAnchorRef)):null;
  if(manifest.environment.providerReceipt!==null){strictJson(readRef(packageRoot,manifest.environment.providerReceipt));assert(false,'HOSTED_PROFILE_UNSUPPORTED');}
  if(manifest.authorizationRef!==null){strictJson(readRef(packageRoot,manifest.authorizationRef));assert(false,'HOSTED_ACTION_UNAUTHORIZED');}
  const report=deriveHostedReport(manifest,data,{now:now??Date.parse(manifest.createdUtc),read:ref=>readRef(packageRoot,ref,ref.path.endsWith('.tar')?LIMITS.archive:LIMITS.envelope)});
  assert(same(report,manifest.result),'HOSTED_PROOF_INVALID');
  const trust=verifyExternalTrust(manifest,hash(bytes),externalTrust,receipt,{now:now??Date.now()});
  return {manifest,data,report,trust};
 }catch(error){if(error.code?.startsWith('HOSTED_'))throw error;assert(false,'HOSTED_PROOF_INVALID');}
}
export function requireHostedCutover(manifestRef,options){
 const proof=readHostedBackup(manifestRef,options);
 assert(proof.trust.status!=='BLOCKED_TRUST','HOSTED_TRUST_ANCHOR_REQUIRED');
 assert(CERTIFIED_HOSTED_PROFILES.some(p=>p.profileId===proof.manifest.profileId),'HOSTED_PROFILE_UNSUPPORTED');
 assert(proof.report.cleanupEligible&&proof.report.executionReady,'HOSTED_CONTROL_REQUIRED');return proof;
}
