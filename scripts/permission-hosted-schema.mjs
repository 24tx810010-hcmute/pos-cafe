import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const LIMITS=Object.freeze({envelope:16*1024*1024,archive:1024*1024*1024,relations:10000,sequences:10000,catalogs:64,rows:1000000,importers:32,commands:256,objects:100000});
export const SHA=/^[a-f0-9]{64}(?![\s\S])/;
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/;
export const IDENT=/^[a-z_][a-z0-9_$]*(?![\s\S])/;
export const QUALIFIED=/^[a-z_][a-z0-9_$]*\.[a-z_][a-z0-9_$]*(?![\s\S])/;
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const stable=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v);
export const fail=code=>{throw Object.assign(Error(code),{code});};
export const assert=(ok,code='HOSTED_PROOF_INVALID')=>{if(!ok)fail(code);};
export const same=(a,b)=>stable(a)===stable(b);
export const exact=(v,keys)=>assert(v!==null&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort()));
export const list=(v,max,fn)=>{assert(Array.isArray(v)&&v.length<=max);v.forEach(fn);};
export const unique=v=>assert(new Set(v).size===v.length,'HOSTED_COVERAGE_INVALID');
export const int64=v=>{assert(typeof v==='string'&&v.length<=20&&/^(?:0|-?[1-9][0-9]*)(?![\s\S])/.test(v),'HOSTED_INPUT_INVALID');const n=BigInt(v);assert(n>=-9223372036854775808n&&n<=9223372036854775807n,'HOSTED_INPUT_INVALID');return n;};
export const utc=v=>{const n=typeof v==='string'?Date.parse(v):NaN;assert(Number.isFinite(n)&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&new Date(n).toISOString()===v,'HOSTED_INPUT_INVALID');return n;};
export const boundedText=(v,max=4096)=>assert(typeof v==='string'&&v.length>0&&v.length<=max&&!v.includes('\0'));
export function assertPrivateRoot(root){
 try{const actual=fs.realpathSync(root);assert(fs.statSync(actual).isDirectory(),'HOSTED_INPUT_INVALID');
  if(process.platform!=='win32'){assert((fs.statSync(actual).mode&0o077)===0,'HOSTED_INPUT_INVALID');return;}
  const allowed=fs.realpathSync(path.join(process.env.LOCALAPPDATA,'pos-cafe-release'));assert(actual.startsWith(allowed+path.sep),'HOSTED_INPUT_INVALID');
  const script=`$a=Get-Acl -LiteralPath '${actual.replaceAll("'","''")}'; $me=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; if(-not $a.AreAccessRulesProtected){exit 1}; foreach($r in $a.Access){$s=$r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value;if($s -ne $me -and $s -ne 'S-1-5-18'){exit 2}}`;
  execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:'pipe'});
 }catch{fail('HOSTED_INPUT_INVALID');}
}

// A small recursive parser rejects duplicate decoded keys before JSON.parse can
// discard them. Fatal UTF8 decoding also refuses BOM, overlong and partial bytes.
export function strictJson(bytes,max=LIMITS.envelope){
 try{
  assert(Buffer.isBuffer(bytes)||bytes instanceof Uint8Array,'HOSTED_INPUT_INVALID');
  assert(bytes.length>0&&bytes.length<=max,'HOSTED_INPUT_INVALID');
  assert(!(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf),'HOSTED_INPUT_INVALID');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);let i=0,nodes=0;
  const ws=()=>{while(/[\x20\t\r\n]/.test(text[i]??'x'))i++;};
  const str=()=>{const start=i++;while(i<text.length){const ch=text[i++];if(ch==='"')return JSON.parse(text.slice(start,i));if(ch==='\\')i++;}fail('HOSTED_INPUT_INVALID');};
  const val=depth=>{
   assert(depth<64&&++nodes<=2000000,'HOSTED_INPUT_INVALID');ws();const ch=text[i];
   if(ch==='"')return str();
   if(ch==='{'){i++;ws();const keys=new Set();if(text[i]==='}'){i++;return;}
    while(true){ws();assert(text[i]==='"','HOSTED_INPUT_INVALID');const key=str();assert(!keys.has(key),'HOSTED_INPUT_INVALID');keys.add(key);ws();assert(text[i++]===':','HOSTED_INPUT_INVALID');val(depth+1);ws();const end=text[i++];if(end==='}')return;assert(end===',','HOSTED_INPUT_INVALID');}
   }
   if(ch==='['){i++;ws();if(text[i]===']'){i++;return;}while(true){val(depth+1);ws();const end=text[i++];if(end===']')return;assert(end===',','HOSTED_INPUT_INVALID');}}
   const m=/^(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));assert(m,'HOSTED_INPUT_INVALID');i+=m[0].length;
  };
  val(0);ws();assert(i===text.length,'HOSTED_INPUT_INVALID');return JSON.parse(text);
 }catch(error){if(error.code?.startsWith('HOSTED_'))throw error;fail('HOSTED_INPUT_INVALID');}
}

export function validateRef(ref,max=LIMITS.envelope){
 exact(ref,['path','sha256','bytes']);boundedText(ref.path,512);
 assert(!path.isAbsolute(ref.path)&&!path.win32.isAbsolute(ref.path)&&!/[\\:]/.test(ref.path)&&ref.path.split('/').every(p=>p&&p!=='.'&&p!=='..'),'HOSTED_INPUT_INVALID');
 assert(SHA.test(ref.sha256)&&Number.isSafeInteger(ref.bytes)&&ref.bytes>0&&ref.bytes<=max,'HOSTED_INPUT_INVALID');
}
export function readRef(root,ref,max=LIMITS.envelope){
 try{
  validateRef(ref,max);const base=fs.realpathSync(root);const file=fs.realpathSync(path.resolve(base,ref.path));
  const rel=path.relative(base,file);assert(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel),'HOSTED_INPUT_INVALID');
  const stat=fs.statSync(file);assert(stat.isFile()&&stat.size===ref.bytes,'HOSTED_INPUT_INVALID');
  const fd=fs.openSync(file,'r');try{const after=fs.fstatSync(fd);assert(after.dev===stat.dev&&after.ino===stat.ino&&after.size===stat.size,'HOSTED_INPUT_INVALID');const bytes=fs.readFileSync(fd);assert(bytes.length===ref.bytes&&hash(bytes)===ref.sha256,'HOSTED_INPUT_INVALID');return bytes;}finally{fs.closeSync(fd);}
 }catch(error){if(error.code?.startsWith('HOSTED_'))throw error;fail('HOSTED_INPUT_INVALID');}
}
export function newPrivateOutput(root,requested){
 try{
  const base=fs.realpathSync(root),output=path.resolve(requested),parent=fs.realpathSync(path.dirname(output));
  assert(output.startsWith(base+path.sep)&&(parent===base||parent.startsWith(base+path.sep))&&fs.statSync(parent).isDirectory()&&!fs.existsSync(output),'HOSTED_INPUT_INVALID');
  return output;
 }catch(error){if(error.code?.startsWith('HOSTED_'))throw error;fail('HOSTED_INPUT_INVALID');}
}
export const BINDING_KEYS=['projectRef','backendOrigin','database','actor','sessionUser','scopeApprovalSha256','sourceManifestSha256','permissionFingerprint','methodSha256','verifierSha256','adapterSha256','environmentSha256','bundleSha256'];
export function validateBinding(v){
 exact(v,BINDING_KEYS);assert(v.projectRef==='kfqjdfwxhkdwihjobpny'&&v.backendOrigin==='https://kfqjdfwxhkdwihjobpny.supabase.co'&&v.database==='postgres');
 assert(v.actor==='postgres'&&v.sessionUser==='postgres');
 for(const k of BINDING_KEYS.filter(k=>k.endsWith('Sha256')||k==='permissionFingerprint'))assert(SHA.test(v[k]));
 assert(v.scopeApprovalSha256==='362883c12c6d5a1666258572fc7acb32d283c702725520dc06d8a1705ed8ddb8');
}
export const EVIDENCE_KEYS=['sourceSnapshot','captureExecution','snapshotImporters','inventoryBefore','inventoryAfter','archive','toc','sequenceSql','rolesBefore','rolesAfter','rolesRestored','schemaSource','schemaRestored','pristineInventory','allocationContract','allocationProbe','scopeObservation','storageCapture','catalogWindow','actorRehearsal','controllerRehearsal','recoveryAssessment','deploymentProvenance','journal'];
export const BI_KEYS=[...EVIDENCE_KEYS.slice(0,14),'allocationProbe'];
export function validateEnvironment(v){
 exact(v,['provenance','observedProjectRef','serverVersion','dumpBinary','restoreBinary','os','imageDigest','services','configRevision','tlsCaSha256','route','providerReceipt']);
 assert(['LOCAL_SYNTHETIC','HOSTED'].includes(v.provenance));boundedText(v.observedProjectRef,128);boundedText(v.serverVersion);boundedText(v.os);assert(/^sha256:[a-f0-9]{64}$/.test(v.imageDigest));assert(SHA.test(v.tlsCaSha256));boundedText(v.configRevision,128);
 for(const binary of [v.dumpBinary,v.restoreBinary]){exact(binary,['path','sha256','version','flags']);boundedText(binary.path);assert(SHA.test(binary.sha256));boundedText(binary.version);list(binary.flags,32,x=>boundedText(x,512));unique(binary.flags);}
 list(v.services,128,s=>{exact(s,['name','binarySha256','configSha256']);boundedText(s.name,128);assert(SHA.test(s.binarySha256)&&SHA.test(s.configSha256));});unique(v.services.map(s=>s.name));
 exact(v.route,['kind','host','port','username']);assert(['owned-unix','direct','session-pooler'].includes(v.route.kind),'HOSTED_PROFILE_UNSUPPORTED');boundedText(v.route.host,256);boundedText(v.route.username,128);assert(v.route.port===5432,'HOSTED_PROFILE_UNSUPPORTED');
 if(v.provenance==='LOCAL_SYNTHETIC')assert(v.route.kind==='owned-unix'&&/^local-hp1-/.test(v.observedProjectRef));
 else assert(v.observedProjectRef==='kfqjdfwxhkdwihjobpny'&&v.route.kind!=='owned-unix');
 if(v.providerReceipt!==null)validateRef(v.providerReceipt);
}
export function validateManifest(m){
 exact(m,['schemaVersion','kind','profileId','runId','createdUtc','binding','environment','evidence','coverage','trustAnchorRef','authorizationRef','result']);
 assert(m.schemaVersion===3&&m.kind==='permission-hosted-logical-backup');assert(m.profileId==='supabase-hosted-logical-v1','HOSTED_PROFILE_UNSUPPORTED');assert(UUID.test(m.runId));utc(m.createdUtc);validateBinding(m.binding);validateEnvironment(m.environment);
 assert(m.binding.environmentSha256===hash(stable(m.environment)));
 exact(m.evidence,EVIDENCE_KEYS);for(const k of EVIDENCE_KEYS){if(m.evidence[k]===null){assert(!BI_KEYS.includes(k));continue;}validateRef(m.evidence[k],k==='archive'?LIMITS.archive:LIMITS.envelope);}
 for(const k of ['trustAnchorRef','authorizationRef'])if(m[k]!==null)validateRef(m[k]);
 exact(m.coverage,['relations','sequences','catalogs','checkSetDigest']);list(m.coverage.relations,LIMITS.relations,x=>assert(QUALIFIED.test(x)));list(m.coverage.sequences,LIMITS.sequences,x=>assert(QUALIFIED.test(x)));list(m.coverage.catalogs,LIMITS.catalogs,x=>boundedText(x,128));for(const k of ['relations','sequences','catalogs'])unique(m.coverage[k]);assert(SHA.test(m.coverage.checkSetDigest));
 // Result is compared byte-for-byte with the verifier's closed result object.
 assert(m.result!==null&&typeof m.result==='object'&&!Array.isArray(m.result));
}
