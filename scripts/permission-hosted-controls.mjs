import {assert,exact,list,unique,same,SHA,UUID,QUALIFIED,utc,validateRef,hash,stable} from './permission-hosted-schema.mjs';

export const STORAGE_INGRESS=Object.freeze(['http','signed-upload','upsert','copy-move-delete','tus-existing','s3-multipart','direct-admin','service-role','dashboard-operator','backend','background-gc']);
const blocked=reason=>({status:'BLOCKED',reason});
export function validateControl(receipt,binding,runId,now){
 if(receipt===null)return blocked('HOSTED_CONTROL_REQUIRED');
 exact(receipt,['controlId','generation','projectRef','sourceManifestSha256','runId','configSha256','issuer','keyFingerprint','nonce','activatedUtc','drainedUtc','expiresUtc','heartbeatUtc','ingress','inflight','queue','admitted','status','exclusiveDeleteExecutor','readerEntitlement','failClosed','assurance']);
 assert(UUID.test(receipt.controlId)&&UUID.test(receipt.nonce)&&SHA.test(receipt.configSha256)&&SHA.test(receipt.keyFingerprint));
 assert(typeof receipt.issuer==='string'&&receipt.issuer.length>0&&typeof receipt.generation==='string'&&receipt.generation.length>0);
 assert(receipt.projectRef===binding.projectRef&&receipt.sourceManifestSha256===binding.sourceManifestSha256&&receipt.runId===runId,'HOSTED_RECEIPT_INVALID');
 list(receipt.ingress,STORAGE_INGRESS.length,x=>assert(STORAGE_INGRESS.includes(x)));unique(receipt.ingress);
 for(const n of ['inflight','queue','admitted'])assert(Number.isSafeInteger(receipt[n])&&receipt[n]>=0);
 const activated=utc(receipt.activatedUtc),drained=utc(receipt.drainedUtc),expires=utc(receipt.expiresUtc),heartbeat=utc(receipt.heartbeatUtc);
 assert(activated<=drained&&drained<=heartbeat&&heartbeat<=now&&expires>activated,'HOSTED_RECEIPT_INVALID');
 for(const k of ['exclusiveDeleteExecutor','readerEntitlement','failClosed'])assert(typeof receipt[k]==='boolean');
 assert(['ACTIVE_DRAINED','EXPIRED','UNKNOWN'].includes(receipt.status)&&['LOCAL_SYNTHETIC','AUTHENTICATED_OPERATOR_OBSERVATION'].includes(receipt.assurance));
 if(now>=expires||now-heartbeat>30000)return blocked('HOSTED_CONTROL_EXPIRED');
 if(receipt.status!=='ACTIVE_DRAINED'||receipt.inflight||receipt.queue||receipt.admitted||!receipt.exclusiveDeleteExecutor||!receipt.readerEntitlement||!receipt.failClosed||!same([...receipt.ingress].sort(),[...STORAGE_INGRESS].sort()))return blocked('HOSTED_STORAGE_CONTROL_UNSUPPORTED');
 return blocked('HOSTED_PROVIDER_PROFILE_UNCERTIFIED');
}
export function assessStorage(value,binding,runId,now,read){
 if(value===null)return blocked('HOSTED_STORAGE_CONTROL_UNSUPPORTED');
 exact(value,['schemaVersion','kind','claims','metadata','payloads','controlBefore','controlAfter']);
 assert(value.schemaVersion===3&&value.kind==='permission-hosted-storage-observation');
 exact(value.claims,['immutableVersion','retention','ifMatch']);for(const k of Object.keys(value.claims))assert(typeof value.claims[k]==='boolean');
 list(value.metadata,100000,x=>{exact(x,['id','bucket','path','version','bytes','mime','sha256']);assert(UUID.test(x.id)&&SHA.test(x.sha256));for(const k of ['bucket','path','version','mime'])assert(typeof x[k]==='string'&&x[k].length>0&&x[k].length<=1024);assert(Number.isSafeInteger(x.bytes)&&x.bytes>=0);});unique(value.metadata.map(x=>x.id));
 list(value.payloads,100000,x=>{exact(x,['id','ref']);assert(UUID.test(x.id));validateRef(x.ref);});unique(value.payloads.map(x=>x.id));
 if(Object.values(value.claims).some(Boolean))return blocked('HOSTED_STORAGE_CONTROL_UNSUPPORTED');
 if(!same(value.metadata.map(x=>x.id).sort(),value.payloads.map(x=>x.id).sort()))return {status:'FAIL',reason:'HOSTED_STORAGE_DRIFT'};
 for(const obj of value.metadata){const p=value.payloads.find(x=>x.id===obj.id),bytes=read(p.ref);if(bytes.length!==obj.bytes||hash(bytes)!==obj.sha256)return {status:'FAIL',reason:'HOSTED_STORAGE_DRIFT'};}
 const before=validateControl(value.controlBefore,binding,runId,now),after=validateControl(value.controlAfter,binding,runId,now);
 if(value.controlBefore&&value.controlAfter&&(value.controlBefore.controlId!==value.controlAfter.controlId||value.controlBefore.generation!==value.controlAfter.generation||value.controlBefore.configSha256!==value.controlAfter.configSha256))return {status:'FAIL',reason:'HOSTED_STORAGE_DRIFT'};
 return before.reason==='HOSTED_PROVIDER_PROFILE_UNCERTIFIED'?after:before;
}
export function assessClosure(value){
 if(value===null)return blocked('HOSTED_CONTROL_REQUIRED');
 exact(value,['relations','fkEdges','partitions','sideEffects','catalogRolesDdlControl','actualActorRehearsal','lockedFullRows','kCount']);
 list(value.relations,10000,x=>assert(QUALIFIED.test(x)));unique(value.relations);
 for(const k of ['fkEdges','partitions','sideEffects'])list(value[k],100000,x=>{exact(x,['identity','classification']);assert(typeof x.identity==='string'&&x.identity.length>0);assert(['UNCLASSIFIED','OBSERVED_CATALOG'].includes(x.classification));});
 for(const k of ['catalogRolesDdlControl','actualActorRehearsal','lockedFullRows'])assert(value[k]===false);assert(/^(?:0|[1-9]\d*)$/.test(value.kCount));
 if(value.kCount!=='0')return blocked('HOSTED_K_NONEMPTY');
 if(value.sideEffects.some(x=>x.classification==='UNCLASSIFIED'))return blocked('HOSTED_CLOSURE_DRIFT');
 return blocked('HOSTED_CATALOG_WINDOW_INVALID');
}
export function assessJournal(value){
 if(value===null)return {status:'UNKNOWN',reason:'HOSTED_OUTCOME_UNKNOWN',retryAllowed:false,reopenAllowed:false};
 exact(value,['schemaVersion','kind','runId','events']);assert(value.schemaVersion===3&&value.kind==='permission-hosted-action-journal'&&UUID.test(value.runId));
 const steps=['PREPARE','DB_COMMIT','STORAGE_DELETE'];let phase=0,pending=false,previousTime=-Infinity;
 list(value.events,6,event=>{exact(event,['step','state','utc','receiptSha256']);const time=utc(event.utc);assert(time>=previousTime);previousTime=time;assert(event.step===steps[phase]&&['INTENT','ACK','UNKNOWN'].includes(event.state));
  if(event.state==='INTENT'){assert(!pending&&event.receiptSha256===null);pending=true;}
  else if(event.state==='ACK'){assert(pending&&SHA.test(event.receiptSha256));pending=false;phase++;}
  else {assert(pending&&event.receiptSha256===null);}
 });
 return {status:pending||phase<3?'UNKNOWN':'OBSERVED_ACKS',reason:'HOSTED_OUTCOME_UNKNOWN',retryAllowed:false,reopenAllowed:false};
}
export function assessRecovery(value){
 if(value!==null){exact(value,['writesQuiesced','completeCurrentEquality','postBackupChanges']);for(const k of Object.keys(value))assert(typeof value[k]==='boolean');}
 // Serialized equality never replaces the current process's protected snapshots
 // required by assessPermissionRestore. No file can mint L=PASS.
 return {status:'BLOCKED',reason:value?.postBackupChanges?'FORWARD_FIX_OR_RECONCILE':'CURRENT_PROTECTED_SNAPSHOT_ASSESSOR_REQUIRED'};
}
