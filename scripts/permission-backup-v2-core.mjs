import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export const SHA = /^[a-f0-9]{64}$/;
export const IDENT = /^[a-z_][a-z0-9_$]*$/;
export const INT = /^(?:0|-?[1-9][0-9]*)$/;
export const fail = code => { throw Object.assign(new Error(code), { code }); };
const invalid = () => fail('BACKUP_V2_PROOF_INVALID');
const same = (a, b) => stable(a) === stable(b);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) => object(x) && same(Object.keys(x).sort(), [...keys].sort());
export function exactSet(actual, expected) {
  return Array.isArray(actual) && new Set(actual).size === actual.length && same([...actual].sort(), [...expected].sort());
}
const root = dirname(fileURLToPath(import.meta.url));
export function backupV2MethodHash() {
  return sha256(stable(['permission-backup-v2-core.mjs','permission-backup-v2.mjs','permission-backup-v2-queries.json','permission-backup-v2-catalog.mjs','permission-backup-v2-local.mjs','permission-backup-v2-storage.mjs','permission-backup-v2-plan.mjs']
    .map(name => ({ name, sha256: sha256(readFileSync(resolve(root, name))) }))));
}
export function integer(value) {
  if (typeof value !== 'string' || !INT.test(value)) fail('BACKUP_V2_SEQUENCE_PARSE');
  const n = BigInt(value);
  if (n < -9223372036854775808n || n > 9223372036854775807n) fail('BACKUP_V2_SEQUENCE_PARSE');
  return n;
}

// Input is pg_restore text from a TOC whitelist. Never execute extracted SQL.
export function parseArchiveSequences(sql, names) {
  if (!exactSet(names, names) || names.some(n => !/^[a-z_][a-z0-9_$]*\.[a-z_][a-z0-9_$]*$/.test(n))) fail('BACKUP_V2_SEQUENCE_PARSE');
  const values = [];
  for (const line of sql.split(/\r?\n/).map(x => x.trim()).filter(Boolean)) {
    if (line.startsWith('--') || /^\\(?:un)?restrict [A-Za-z0-9]+$/.test(line)) continue;
    if (/^SET (?:statement_timeout|lock_timeout|idle_in_transaction_session_timeout|transaction_timeout) = 0;$/.test(line)
      || /^SET (?:client_encoding = 'UTF8'|standard_conforming_strings = on|check_function_bodies = false|xmloption = content|client_min_messages = warning|row_security = off);$/.test(line)
      || line === "SELECT pg_catalog.set_config('search_path', '', false);") continue;
    const match = /^SELECT pg_catalog\.setval\('([a-z_][a-z0-9_$]*\.[a-z_][a-z0-9_$]*)', (0|-?[1-9][0-9]*), (true|false)\);$/.exec(line);
    if (!match) fail('BACKUP_V2_SEQUENCE_PARSE');
    values.push({ name: match[1], value: integer(match[2]).toString(), called: match[3] === 'true' });
  }
  if (!exactSet(values.map(x => x.name), names)) fail('BACKUP_V2_SEQUENCE_PARSE');
  return values.sort((a,b) => a.name.localeCompare(b.name));
}
export function tocInventory(text) {
  const entries = text.split(/\r?\n/).filter(x => /^\d+;/.test(x));
  if (!entries.length || new Set(entries.map(x => x.split(';')[0])).size !== entries.length) fail('BACKUP_V2_COVERAGE');
  const list = type => entries.filter(x => x.includes(` ${type} `)).map(x => {
    const tail = x.split(` ${type} `)[1].split(' ');
    if (tail.length !== 3 || !tail.every(x => IDENT.test(x))) fail('BACKUP_V2_COVERAGE');
    return `${tail[0]}.${tail[1]}`;
  });
  return { tables: list('TABLE DATA'), sequences: list('SEQUENCE SET'), sequenceList: entries.filter(x => x.includes(' SEQUENCE SET ')).join('\n')+'\n' };
}
export function canonicalSchema(text) {
  // Both dumps use the same binary, flags and fresh per-run restrict key.
  // Compare all SQL text, including framing; never strip SQL literal content.
  return text;
}
const ranges = { smallint: ['-32768','32767'], integer: ['-2147483648','2147483647'], bigint: ['-9223372036854775808','9223372036854775807'] };
export function assessAllocation(sequence, consumer, occupied) {
  const blocked = reason => ({status:'BLOCKED',reason});
  const unsafe = reason => ({status:'FAIL',reason});
  if (!consumer || !ranges[consumer.cast] || !ranges[sequence.type]) return blocked('UNSUPPORTED_CONSUMER');
  if (sequence.cycle !== false) return blocked('CYCLE_UNSUPPORTED');
  if (sequence.cache !== '1') return blocked('CACHE_UNSUPPORTED');
  if (typeof sequence.called !== 'boolean' || !Array.isArray(occupied)) return blocked('CONSUMER_INPUT_INVALID');
  let last, step, min, max, ids;
  try { [last,step,min,max]=[sequence.value,sequence.increment,sequence.min,sequence.max].map(integer); ids=occupied.map(integer); }
  catch { return unsafe('INTEGER_RANGE'); }
  const [typeMin,typeMax]=ranges[sequence.type].map(BigInt),[castMin,castMax]=ranges[consumer.cast].map(BigInt);
  const next=sequence.called ? last+step : last;
  if (step===0n || min>max || min<typeMin || max>typeMax || last<min || last>max || next<min || next>max) return unsafe('SEQUENCE_RANGE');
  if (next<castMin || next>castMax || ids.some(n=>n<castMin || n>castMax)) return unsafe('CONSUMER_RANGE');
  if (ids.some(n=>n===next)) return unsafe('COLLISION');
  if (ids.some(n=>step>0n ? n>=next : n<=next)) return unsafe('UNSAFE_EXTREMA');
  return {status:'PASS',next:next.toString()};
}

export const CATALOG_IDS = ['relations','constraints','partitions','columns','roles','memberships','database','extensionInventory','extensions','schemas','functions','rowLevelSecurity','grants','sequences','largeObjects','triggers','sequenceDependencies','indexes','views','types'];
function validateInventory(x) {
  if (!object(x) || !Array.isArray(x.tables) || !x.tables.length || !Array.isArray(x.relations)
    || !Array.isArray(x.sequenceDefinitions) || !object(x.catalog) || !exactSet(Object.keys(x.catalog),CATALOG_IDS)) invalid();
  const identities=x.tables.map(t=>`${t.schema}.${t.name}`);
  if (!exactSet(identities,x.relations.filter(r=>r.kind==='r').map(r=>`${r.schema}.${r.name}`))
    || x.relations.some(r=>!['r','p'].includes(r.kind)||!IDENT.test(r.schema)||!IDENT.test(r.name))
    || !exactSet(x.relations.map(r=>`${r.schema}.${r.name}`),x.relations.map(r=>`${r.schema}.${r.name}`))) invalid();
  for(const row of [...x.tables,...Object.values(x.catalog)]) if (!SHA.test(row.sha256??'') || !/^\d+$/.test(row.rowCount??'')) invalid();
  if (!exactSet(x.sequenceDefinitions.map(s=>s.name),x.sequenceDefinitions.map(s=>s.name))) invalid();
  if(x.catalog.relations.rowCount!==String(x.relations.length)||x.catalog.relations.sha256!==sha256(stable(x.relations))
    || x.catalog.sequences.rowCount!==String(x.sequenceDefinitions.length)
    || x.catalog.extensions.rowCount!==String(x.extensions?.length)||x.catalog.extensions.sha256!==sha256(stable(x.extensions)))invalid();
  if(!Array.isArray(x.sequenceCatalog)||x.catalog.sequences.sha256!==sha256(stable(x.sequenceCatalog))
    || !exactSet(x.sequenceCatalog.map(s=>s.schema+'.'+s.name),x.sequenceDefinitions.map(s=>s.name)))invalid();
  for(const s of x.sequenceDefinitions){const r=x.sequenceCatalog.find(r=>r.schema+'.'+r.name===s.name);
    if(!same(s,{name:r.schema+'.'+r.name,type:r.dataType,start:r.start,increment:r.increment,min:r.minimum,max:r.maximum,cache:r.cache,cycle:r.cycle,owner:r.owner}))invalid();}
}
export function storageV2Disposition(storage) {
  const basic=['schemaVersion','kind','objects','control'];
  const full=[...basic,'payloadClone','status','captureBoundary','payloads','metadataSha256','immutableVersionRead','retention','conditionalDelete','globalControl','cleanupEligible'];
  if ((!exact(storage,basic)&&!exact(storage,full)) || storage.schemaVersion!==2 || storage.kind!=='separate-storage-capture'
    || !Array.isArray(storage.objects)) invalid();
  // No supported provider fence/version/retention profile has been certified.
  if(storage.control!==null) fail('BACKUP_V2_STORAGE_UNSUPPORTED');
  if(exact(storage,basic)&&storage.objects.length)invalid();
  if(exact(storage,full)){
    if(storage.objects.length!==3 || !exactSet(storage.payloads?.map(x=>x.id),storage.objects.map(x=>x.id))
      || !exactSet(storage.payloadClone?.checks?.map(x=>x.id),storage.objects.map(x=>x.id))
      || storage.payloadClone.status!=='PASS'||storage.payloadClone.newApiMetadata!==true||storage.status!=='BLOCKED'
      || storage.captureBoundary!=='MUTABLE_KEY_ENDPOINT_CHECKS_ONLY'||!SHA.test(storage.metadataSha256??'')
      || ['immutableVersionRead','retention','conditionalDelete','globalControl','cleanupEligible'].some(k=>storage[k]!==false))invalid();
    for(const object of storage.objects){const payload=storage.payloads.find(x=>x.id===object.id),clone=storage.payloadClone.checks.find(x=>x.id===object.id);
      const bytes=Buffer.from(payload.base64,'base64');
      if(bytes.toString('base64')!==payload.base64 || bytes.length!==object.size || sha256(bytes)!==object.sha256
        || !object.version || !object.mime || !object.bucket || !object.path || clone.matched!==true
        || clone.sha256!==object.sha256 || clone.size!==object.size || clone.mime!==object.mime)invalid();
    }
  }
  return {status:'BLOCKED',reason:'GLOBAL_STORAGE_CONTROL_ABSENT',boundary:'DATABASE_METADATA_ONLY; API_PAYLOAD_CLONE_SEPARATE',objects:storage.objects.length};
}
export function deriveBackupV2Report(manifest, data) {
  const { captured:a, restored:b, execution:e, contract:c, probe:p, storage }=data;
  validateInventory(a); validateInventory(b);
  if (!exact(manifest,['schemaVersion','kind','binding','environment','artifacts']) || manifest.schemaVersion!==2 || manifest.kind!=='permission-logical-backup'
    || !exact(manifest.binding,['sourceFingerprint','projectRef','methodSha256']) || !SHA.test(manifest.binding.sourceFingerprint??'') || !SHA.test(manifest.binding.methodSha256??'')) invalid();
  const env=manifest.environment;
  if (!exact(env,['source','pristine','probe','image','network','ports','profile']) || env.network!=='none' || !same(env.ports,[])
    || env.profile!=='local-synthetic' || !/^sha256:[a-f0-9]{64}$/.test(env.image??'')
    || ![env.source,env.pristine,env.probe].every(x=>SHA.test(x??'')) || new Set([env.source,env.pristine,env.probe]).size!==3) invalid();
  if (!object(e) || !same(e.environment,env) || !same(e.binding,manifest.binding) || !SHA.test(e.snapshotHash??'')
    || e.snapshotHash!==a.snapshotHash || e.archiveSha256!==manifest.artifacts.archive.sha256
    || !exactSet(e.commands?.map(x=>x.id),['dump','roles','roles-window','roles-restored','roles-probe','toc','extract','schema-source','schema-restored','restore-pristine','restore-probe'])
    || e.commands.some(x=>x.exit!==0 || !Number.isFinite(Date.parse(x.started)) || !Number.isFinite(Date.parse(x.completed)) || x.started>x.completed)
    || e.dumpSnapshotHash!==a.snapshotHash || e.pristineEmpty!==true || e.probeEmpty!==true || e.rolesWindowStable!==true) invalid();
  const names=a.sequenceDefinitions.map(s=>s.name), toc=tocInventory(data.toc), seq=parseArchiveSequences(data.sequenceSql,names);
  for(const bounds of [e.sequenceBefore,e.sequenceAfter]){
    if(!exactSet(bounds?.map(x=>x.name),names)||bounds.some(x=>!exact(x,['name','value','called','started','completed'])
      || typeof x.called!=='boolean'||!Number.isFinite(Date.parse(x.started))||!Number.isFinite(Date.parse(x.completed))||x.started>x.completed))invalid();
    bounds.forEach(x=>integer(x.value));
  }
  const dump=e.commands.find(x=>x.id==='dump');
  if(e.sequenceBefore.some(x=>x.completed>dump.started)||e.sequenceAfter.some(x=>x.started<dump.completed))invalid();
  const roleCapture=e.commands.find(x=>x.id==='roles'),roleWindow=e.commands.find(x=>x.id==='roles-window');
  if(roleCapture.completed>dump.started || roleWindow.started<dump.completed
    || ['roles','windowRoles','restoredRoles','probeRoles'].some(k=>typeof data[k]!=='string'||!data[k].length))invalid();
  const checks=[]; const check=(id,matched)=>checks.push({id,status:matched?'PASS':'FAIL'});
  check('archive:toc',exactSet(toc.tables,a.tables.map(t=>`${t.schema}.${t.name}`)) && exactSet(toc.sequences,names));
  check('snapshot:shared',a.importedSnapshot===true && e.dumpSnapshotHash===a.snapshotHash);
  check('catalog:complete-schema',canonicalSchema(data.sourceSchema)===canonicalSchema(data.restoredSchema));
  check('catalog:complete-roles',data.roles===data.restoredRoles);
  check('catalog:probe-roles',data.roles===data.probeRoles);
  check('catalog:roles-window',data.roles===data.windowRoles);
  check('inventory:relations',same(a.relations,b.relations));
  check('inventory:sequences',same(a.sequenceDefinitions,b.sequenceDefinitions));
  for(const t of a.tables) check(`table:${t.schema}.${t.name}`,same(t,b.tables.find(r=>r.schema===t.schema&&r.name===t.name)));
  if (!exactSet(b.tables.map(t=>`${t.schema}.${t.name}`),a.tables.map(t=>`${t.schema}.${t.name}`))) check('inventory:extra-table',false);
  for(const id of CATALOG_IDS) check('catalog:'+id,same(a.catalog[id],b.catalog[id]));
  if(!exactSet(b.sequenceState?.map(s=>s.name),names) || !exactSet(p.pristineAfter?.map(s=>s.name),names)) invalid();
  for(const s of seq) check('sequence:'+s.name,same(s,b.sequenceState.find(x=>x.name===s.name))&&same(s,p.pristineAfter.find(x=>x.name===s.name)));
  let allocations=[];
  const approval=data.consumerApproval;
  const approved=object(approval)&&approval.schemaVersion===2&&approval.kind==='explicit-local-consumer-contract'
    && approval.sourceId===env.source&&approval.sourceFingerprint===manifest.binding.sourceFingerprint
    && approval.methodSha256===manifest.binding.methodSha256&&approval.fixtureSha256===manifest.artifacts.fixture.sha256
    && approval.diversitySha256===manifest.artifacts.diversity.sha256&&approval.catalogSha256===sha256(stable(a.catalog))
    && approval.closedWorld===true&&approval.dynamicOrExternalConsumers===false
    && approval.control==='OWNED_NETWORK_NONE_SYNTHETIC_FIXTURE_ONLY'&&same(approval.consumers,c.consumers);
  if(manifest.artifacts.sourceSnapshot.sha256!==manifest.binding.sourceFingerprint
    || e.fixtureSha256!==manifest.artifacts.fixture.sha256 || e.diversitySha256!==manifest.artifacts.diversity.sha256
    || manifest.artifacts.scopeApproval.sha256!=='362883c12c6d5a1666258572fc7acb32d283c702725520dc06d8a1705ed8ddb8'
    || e.scopeApprovalSha256!==manifest.artifacts.scopeApproval.sha256||e.scopeMode!=='SYNTHETIC_FIXTURE; NOT_HOSTED_SCOPE_OBSERVATION')invalid();
  const closed=approved&&exact(c,['schemaVersion','kind','binding','catalogSha256','fixtureSha256','consumerApprovalSha256','control','consumers']) && c.schemaVersion===2
    && c.kind==='closed-world-local-v1' && same(c.binding,manifest.binding) && c.catalogSha256===sha256(stable(a.catalog))
    && SHA.test(c.fixtureSha256??'') && c.fixtureSha256===e.fixtureSha256
    && c.consumerApprovalSha256===manifest.artifacts.consumerApproval.sha256&&e.consumerApprovalSha256===c.consumerApprovalSha256
    && c.control==='OWNED_NETWORK_NONE_SYNTHETIC_FIXTURE_ONLY' && Array.isArray(c.consumers)
    && exactSet(c.consumers.map(x=>x.sequence),names)
    && c.consumers.every(x=>exact(x,['sequence','table','column','cast']) && IDENT.test(x.column) && a.tables.some(t=>`${t.schema}.${t.name}`===x.table)
      && same(a.consumerFacts?.[x.sequence],{table:x.table,column:x.column,cast:x.cast}));
  if (!closed) allocations=[{id:'contract',status:'BLOCKED',reason:'CLOSED_WORLD_CONTRACT_ABSENT_OR_UNSUPPORTED'}];
  else {
    if(!exactSet(p.observations?.map(x=>x.name),names) || !exactSet(Object.keys(a.occupied??{}),names)
      || p.container!==env.probe || p.pristine!==env.pristine || p.archiveSha256!==manifest.artifacts.archive.sha256) invalid();
    allocations=seq.map(s=>{
      const result=assessAllocation({...a.sequenceDefinitions.find(x=>x.name===s.name),...s},c.consumers.find(x=>x.sequence===s.name),a.occupied[s.name]);
      const actual=p.observations.find(x=>x.name===s.name);
      if(result.status==='PASS' && (actual.value!==result.next || actual.executed!==true)) return {id:s.name,status:'FAIL',reason:'ACTUAL_ALLOCATION_MISMATCH'};
      return {id:s.name,...result};
    });
  }
  const storageResult=storageV2Disposition(storage);
  return {schemaVersion:2,kind:'permission-logical-backup-report',binding:manifest.binding,
    archiveFidelity:{status:checks.every(x=>x.status==='PASS')?'PASS':'FAIL',checks},
    allocationSafety:{status:allocations.some(x=>x.status==='FAIL')?'FAIL':allocations.some(x=>x.status==='BLOCKED')?'BLOCKED':'PASS',checks:allocations},
    concurrencyObservations:{diagnosticOnly:true,before:e.sequenceBefore,after:e.sequenceAfter,dumpInterval:e.commands.find(x=>x.id==='dump'),quiescenceEstablished:false},
    catalogProvenance:{snapshotHash:a.snapshotHash,rolesWindowStable:e.rolesWindowStable,providerWindowEstablished:false},
    storageCaptureBoundary:storageResult,coverageComplete:false,cleanupEligible:false,executionReady:false,
    blockers:['C_FULL_ROW_LOCKED_RECHECK_AND_ACTOR_CONTROL_REQUIRED','GLOBAL_STORAGE_CONTROL_ABSENT','HOSTED_PROVIDER_PROFILE_UNCERTIFIED']};
}
export const ARTIFACT_KEYS=['captured','restored','execution','contract','consumerApproval','scopeApproval','fixture','diversity','sourceSnapshot','sourceSchema','restoredSchema','probe','storage','archive','toc','sequenceSql','roles','windowRoles','restoredRoles','probeRoles','report'];
export function readBackupV2(manifestRef, expectedBinding) {
  const read=(ref,base)=>{
    if(!exact(ref,['path','sha256']) || !SHA.test(ref.sha256??'') || typeof ref.path!=='string') invalid();
    const bytes=readFileSync(resolve(base,ref.path)); if(sha256(bytes)!==ref.sha256) invalid();return bytes;
  };
  try {
    const manifest=JSON.parse(read(manifestRef,process.cwd()));
    if(!exactSet(Object.keys(manifest.artifacts??{}),ARTIFACT_KEYS) || !same(manifest.binding,expectedBinding)
      || expectedBinding.methodSha256!==backupV2MethodHash()) invalid();
    const data={};
    for(const key of ARTIFACT_KEYS){const bytes=read(manifest.artifacts[key],dirname(resolve(manifestRef.path)));
      data[key]=['archive','fixture','diversity','sourceSnapshot'].includes(key)?bytes:['toc','sequenceSql','sourceSchema','restoredSchema','roles','windowRoles','restoredRoles','probeRoles'].includes(key)?bytes.toString('utf8'):JSON.parse(bytes);}
    const report=deriveBackupV2Report(manifest,data);
    if(!same(report,data.report)) invalid();
    return {manifest,report,data};
  } catch(error) { if(error?.code?.startsWith('BACKUP_V2_'))throw error; invalid(); }
}
export function requireBackupV2Cutover(manifestRef, expectedBinding) {
  const result=readBackupV2(manifestRef,expectedBinding);
  if(result.report.archiveFidelity.status!=='PASS') fail('BACKUP_V2_ARCHIVE_FAILED');
  if(!result.report.cleanupEligible) fail('BACKUP_V2_CUTOVER_BLOCKED');
  return result;
}
