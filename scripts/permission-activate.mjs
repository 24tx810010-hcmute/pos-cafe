import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { activationBundleManifest, inspectExpectedEmptyTarget } from './permission-activation-bundle.mjs';
import { ActivationError, applyActivationSteps } from './permission-activation-steps.mjs';
export { ActivationError, stripTopLevelTransactions } from './permission-activation-steps.mjs';
import { captureSnapshot, permissionFingerprint, readMappingFiles } from './permission-preflight-core.mjs';
import { planMigration } from './permission-migration-plan.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha=/^[a-f0-9]{64}$/;

const fail=code=>{throw new ActivationError(code);};
export const activationBeginStatement = config => config.expectedEmptyStoreSet===true
  ?'begin isolation level read committed'
  :'begin isolation level serializable';
export function validateActivationConfig(value){
  const keys=['schemaVersion','mode','connectionString','database','marker','storeIds','sourceFingerprint','bundleHash','mappingFiles','expectedEmptyStoreSet'];
  const emptyOptIn=value?.expectedEmptyStoreSet===true;
  const normalSet=value?.expectedEmptyStoreSet===undefined||value?.expectedEmptyStoreSet===false;
  const validTargetSet=Array.isArray(value?.storeIds)&&Array.isArray(value?.mappingFiles)
    &&((emptyOptIn&&value.storeIds.length===0&&value.mappingFiles.length===0)
      ||(normalSet&&value.storeIds.length>0&&value.mappingFiles.length>0));
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k))||value.schemaVersion!==1||value.mode!=='synthetic-activation'
    ||!value.connectionString||!value.database||!value.marker||!validTargetSet||new Set(value.storeIds).size!==value.storeIds.length||value.storeIds.some(x=>!uuid.test(x))
    ||!sha.test(value.sourceFingerprint??'')||!sha.test(value.bundleHash??'')||value.mappingFiles.some(x=>typeof x!=='string'||!x))fail('INVALID_ACTIVATION_CONFIG');
  let url;try{url=new URL(value.connectionString);}catch{fail('INVALID_ACTIVATION_CONFIG');}
  // pg-connection-string lets query parameters override URL routing. Never let
  // ?host/?port/?user bypass the loopback binding checked below.
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.hash
    ||[...url.searchParams.keys()].some(key=>key!=='sslmode')||url.searchParams.getAll('sslmode').length>1
    ||(url.searchParams.has('sslmode')&&!['require','verify-ca','verify-full'].includes(url.searchParams.get('sslmode'))))fail('INVALID_ACTIVATION_CONFIG');
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))fail('NONLOCAL_ACTIVATION_REFUSED');
  if(decodeURIComponent(url.pathname.slice(1))!==value.database)fail('ACTIVATION_DATABASE_MISMATCH');
  return {...value,mappingFiles:value.mappingFiles.map(item=>resolve(item))};
}
function explicitConfig(path){
  if(!path)fail('EXPLICIT_ACTIVATION_CONFIG_REQUIRED');let value;
  try{value=JSON.parse(readFileSync(resolve(path),'utf8'));}catch{fail('INVALID_ACTIVATION_CONFIG');}
  return validateActivationConfig(value);
}
export async function activateDatabase(rawConfig,options={}){
  const config=validateActivationConfig(rawConfig);
  if(permissionFingerprint()!==config.sourceFingerprint)fail('SOURCE_FINGERPRINT_MISMATCH');
  const bundle=activationBundleManifest();if(bundle.sha256!==config.bundleHash)fail('BUNDLE_HASH_MISMATCH');
  const mappings=readMappingFiles(config.mappingFiles);const db=new pg.Client({connectionString:config.connectionString,connectionTimeoutMillis:5000,statement_timeout:120000,application_name:'pos-cafe-permission-activate'});
  await db.connect();let begun=false;
  try{
    // Empty activation needs a fresh statement snapshot after a writer that
    // held ROW EXCLUSIVE commits and releases the tenant-table locks. A
    // SERIALIZABLE snapshot established by the marker/catalog reads could keep
    // that committed row invisible. The nonempty migration keeps its existing
    // SERIALIZABLE behavior.
    await db.query(activationBeginStatement(config));begun=true;
    await db.query("select pg_advisory_xact_lock(hashtext('pos-cafe:permission-activation'))");
    const marker=(await db.query('select marker,store_ids from private.idempotency_test_environment for update')).rows;
    if(marker.length!==1||marker[0].marker!==config.marker||JSON.stringify([...marker[0].store_ids].sort())!==JSON.stringify([...config.storeIds].sort()))fail('ACTIVATION_TARGET_BINDING_MISMATCH');
    let stores;
    let emptyTargetEvidence=null;
    if(config.expectedEmptyStoreSet===true){
      emptyTargetEvidence=await inspectExpectedEmptyTarget(db,{lockTables:true});
      if(!emptyTargetEvidence.schemaMatches)fail('ACTIVATION_TENANT_SCHEMA_MISMATCH');
      if(emptyTargetEvidence.storeIds.length!==0)fail('ACTIVATION_STORE_SET_MISMATCH');
      if(!emptyTargetEvidence.empty)fail('ACTIVATION_TARGET_NOT_EMPTY');
      // A local contract test may pause here to prove a concurrent INSERT waits
      // behind the table locks. This hook is programmatic only and is never read
      // from the strict CLI config.
      if(typeof options.afterEmptyTargetLocked==='function')await options.afterEmptyTargetLocked(emptyTargetEvidence);
      stores=[];
    }else{
      stores=(await db.query('select id,name from public.stores order by id for update')).rows;
      if(JSON.stringify(stores.map(x=>x.id).sort())!==JSON.stringify([...config.storeIds].sort()))fail('ACTIVATION_STORE_SET_MISMATCH');
      await db.query('select id from public.employees where store_id=any($1::uuid[]) order by store_id,id for update',[config.storeIds]);
    }
    const before=await captureSnapshot(db);
    const employees=(await db.query(`select id,store_id as "storeId",name,role::text,is_active as "isActive",to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt",permission_overrides as "permissionOverrides" from public.employees order by id`)).rows;
    const plan=config.expectedEmptyStoreSet===true?{status:'READY',stores:[]}:planMigration({stores,employees,mappings,snapshotHash:before.hash});
    if(config.expectedEmptyStoreSet!==true&&(plan.status!=='READY'||plan.stores.some(s=>s.status!=='READY')))fail('OWNER_MIGRATION_REVIEW_REQUIRED');
    for(const store of plan.stores){const match=mappings.filter(m=>m.storeId===store.storeId&&m.ownerId===store.candidateOwnerId&&m.sourceSnapshotHash===before.hash);if(match.length!==1)fail('LOCKED_MAPPING_RECHECK_FAILED');}
    const { post, postEmptyTargetEvidence, enumDependencies } = await applyActivationSteps(db, {
      plan, storeIds: config.storeIds, expectedEmptyStoreSet: config.expectedEmptyStoreSet, failAfterFragment: options.failAfterFragment,
    });
    await db.query('commit');begun=false;
    return {status:'ACTIVATED',sourceFingerprint:config.sourceFingerprint,bundleHash:config.bundleHash,beforeHash:before.hash,
      expectedEmptyStoreSet:config.expectedEmptyStoreSet===true,stores:post,
      emptyTargetRelations:emptyTargetEvidence?.actualRelations??null,
      postEmptyTargetRelations:postEmptyTargetEvidence?.actualRelations??null,
      legacyEnumTeardown:enumDependencies===0?'COMPLETE':'BLOCKED_BY_DEPENDENCIES',legacyEnumDependencies:enumDependencies};
  }catch(error){if(begun)await db.query('rollback').catch(()=>{});if(error instanceof ActivationError)throw error;throw new ActivationError('ACTIVATION_FAILED');}
  finally{await db.end().catch(()=>{});}
}
export async function main(path=process.argv[2]){return activateDatabase(explicitConfig(path));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{process.stdout.write(JSON.stringify(await main())+'\n');}catch(error){process.stderr.write(JSON.stringify({status:'BLOCKED',code:error instanceof ActivationError?error.code:'ACTIVATION_FAILED'})+'\n');process.exitCode=1;}}
