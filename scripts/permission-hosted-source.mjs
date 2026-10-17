import {createHash} from 'node:crypto';
import {assert,exact,list,unique,validateRef,SHA,hash,LIMITS,utc} from './permission-hosted-schema.mjs';

// Non-executing USTAR reader for this task's versioned source packages. Links,
// devices, PAX overrides, duplicate paths and unexpected bytes are never read as
// source. PostgreSQL's custom archive is handled separately by pinned pg_restore.
export function verifySourceArchive(manifest,bytes,expectedFingerprint){
 exact(manifest,['schemaVersion','kind','utc','label','head','base','delta','entries','archive','specReferences']);
 assert(manifest.schemaVersion===1&&manifest.kind==='permission-source-snapshot'&&/^[a-f0-9]{40}$/.test(manifest.head));
 utc(manifest.utc);assert(/^source-[0-9]+(?![\s\S])/.test(manifest.label));
 exact(manifest.base,['label','manifestSha256']);assert(SHA.test(manifest.base.manifestSha256));
 list(manifest.delta,100000,p=>assert(typeof p==='string'));
 validateRef(manifest.archive,LIMITS.archive);assert(bytes.length===manifest.archive.bytes&&hash(bytes)===manifest.archive.sha256,'HOSTED_INPUT_INVALID');
 list(manifest.specReferences,128,ref=>validateRef(ref));unique(manifest.specReferences.map(r=>r.path));
 list(manifest.entries,100000,e=>{if(e.deleted===true){exact(e,['path','deleted']);validateRef({path:e.path,sha256:'0'.repeat(64),bytes:1});}else validateRef(e,LIMITS.envelope);});unique(manifest.entries.map(e=>e.path));
 const expected=new Map(manifest.entries.filter(e=>!e.deleted).map(e=>[e.path,e])),files=new Map(),directories=new Set(['','.']);let offset=0,ended=false;
 for(const name of expected.keys()){const parts=name.split('/');for(let i=1;i<parts.length;i++)directories.add(parts.slice(0,i).join('/'));}
 const text=b=>new TextDecoder('utf-8',{fatal:true}).decode(b).split('\0')[0];
 const octal=b=>{const s=text(b).trim();assert(/^[0-7]+$/.test(s),'HOSTED_INPUT_INVALID');const n=parseInt(s,8);assert(Number.isSafeInteger(n),'HOSTED_INPUT_INVALID');return n;};
 while(offset+512<=bytes.length){
  const h=bytes.subarray(offset,offset+512);if(h.every(b=>b===0)){assert(offset+1024<=bytes.length&&bytes.subarray(offset).every(b=>b===0),'HOSTED_INPUT_INVALID');ended=true;break;}
  assert(text(h.subarray(257,263))==='ustar','HOSTED_INPUT_INVALID');
  let checksum=0;for(let i=0;i<512;i++)checksum+=i>=148&&i<156?32:h[i];assert(checksum===octal(h.subarray(148,156)),'HOSTED_INPUT_INVALID');
  const name=text(h.subarray(0,100)),prefix=text(h.subarray(345,500)),raw=(prefix?prefix+'/':'')+name,relative=raw.replace(/^\.\//,'').replace(/\/$/,'');
  const size=octal(h.subarray(124,136)),type=h[156];offset+=512;assert(offset+size<=bytes.length,'HOSTED_INPUT_INVALID');
  if(type===53){assert(size===0&&directories.has(relative),'HOSTED_INPUT_INVALID');}
  else {assert(type===48||type===0,'HOSTED_INPUT_INVALID');validateRef({path:relative,bytes:size,sha256:'0'.repeat(64)},LIMITS.envelope);const e=expected.get(relative);assert(e&&!files.has(relative)&&size===e.bytes,'HOSTED_INPUT_INVALID');const data=bytes.subarray(offset,offset+size);assert(hash(data)===e.sha256,'HOSTED_INPUT_INVALID');files.set(relative,data);}
  offset+=Math.ceil(size/512)*512;
 }
 assert(ended&&files.size===expected.size,'HOSTED_INPUT_INVALID');
 const fingerprint=createHash('sha256');for(const e of [...manifest.entries].sort((a,b)=>a.path<b.path?-1:1)){
  if(e.path.startsWith('artifacts/')||e.path.startsWith('test-results/')||e.path.endsWith('.tsbuildinfo')||e.path==='pnpm-lock.yaml')continue;
  fingerprint.update(e.path);fingerprint.update('\0');fingerprint.update(e.deleted?'[deleted]':files.get(e.path));fingerprint.update('\0');
 }
 const computed=hash(JSON.stringify({head:manifest.head,source:fingerprint.digest('hex'),pnpmLock:files.has('pnpm-lock.yaml')?hash(files.get('pnpm-lock.yaml')):null}));
 assert(computed===expectedFingerprint,'HOSTED_PROOF_INVALID');return {entries:manifest.entries.length,files:files.size,permissionFingerprint:computed};
}
