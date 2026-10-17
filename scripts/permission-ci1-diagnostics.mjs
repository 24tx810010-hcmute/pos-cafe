import { CI1_SUITES } from './permission-ci1-policy.mjs';

// Only this fixed vocabulary can cross the private reporter boundary. Zero is
// unknown, never a reflected error string or a successful cleanup assertion.
const cleanupCodes = ['IMAGE_COMPATIBILITY_STATE_DRIFT','IMAGE_STORAGE_SCOPE_REFUSED','IMAGE_STORAGE_TRACKING_DRIFT',
  'IMAGE_STORAGE_PREEXISTING_OBJECT_REFUSED','IMAGE_STORAGE_DELETE_FAILED','IMAGE_STORAGE_DELETE_UNCONFIRMED',
  'IMAGE_STORAGE_BYTES_REMAIN','IMAGE_STAGING_BUCKET_DELETE_FAILED','IMAGE_STAGING_BUCKET_NOT_EMPTY',
  'IMAGE_CONTRACT_GATE_MISSING','IMAGE_SCHEMA_RESTORE_MISMATCH','IMAGE_STORAGE_METADATA_RESTORE_MISMATCH',
  'IMAGE_SENTINEL_METADATA_RESTORE_MISMATCH','IMAGE_SENTINEL_BYTES_RESTORE_MISMATCH',
  'IMAGE_STORAGE_PROOF_COUNT_MISMATCH','IMAGE_STORAGE_BASELINE_UNREADABLE','IMAGE_CLEANUP_STEP_FAILED',
  'IMAGE_FIXTURE_MARKER_REFUSED','IMAGE_FIXTURE_CLEANUP_IN_PROGRESS'];
const cleanupPhases = ['compatibility','storage-objects','database-surface','read-fixture','source-runtime'];
const cleanupSteps = ['restore-compatibility','delete-owned-storage','restore-functions','drop-image-tables','restore-storage',
  'restore-change-acl','restore-contract-gate','reload-schema','verify-schema','verify-storage-metadata',
  'verify-sentinel-metadata','verify-sentinel-bytes','cleanup-read','verify-source-runtime'];
const cleanupSqlstates = ['0A000','42501','42704','42P01','42883','42710','2BP01','23505','23503',
  '23514','55000','57014','40001','40P01','25P02','42601','22P02'];
const ordinal = (values,value) => values.indexOf(value) + 1;
const diagnosticKeys = ['originOrdinal','phaseOrdinal','stepOrdinal','codeOrdinal','sqlstateOrdinal'];
const limits = [2,cleanupPhases.length,cleanupSteps.length,cleanupCodes.length,cleanupSqlstates.length];

export function ci1SuiteDiagnostic(modules, errors) {
  if (!Array.isArray(modules) || modules.length !== 1 || !Array.isArray(errors) || errors.length > 128) return null;
  const hooks = [];
  let suiteCount = 0;
  function* suites() { yield modules[0]; yield* (modules[0].children.allSuites?.() ?? []); }
  for (const suite of suites()) {
    if (++suiteCount > 128) return null;
    const values = typeof suite.errors === 'function' ? suite.errors() : suite.errors;
    if (!Array.isArray(values) || hooks.length + values.length > 128) return null;
    hooks.push(...values);
  }
  const originOrdinal = hooks.length ? 1 : errors.length ? 2 : 0;
  const error = (hooks.length ? hooks : errors)[0];
  const supplied = error?.permissionCleanupDiagnostics;
  const detail = Array.isArray(supplied) && supplied.length > 0 && supplied.length <= 32 ? supplied[0] : null;
  return {originOrdinal, phaseOrdinal:ordinal(cleanupPhases,detail?.phase), stepOrdinal:ordinal(cleanupSteps,detail?.step),
    codeOrdinal:ordinal(cleanupCodes,detail?.code ?? error?.message), sqlstateOrdinal:ordinal(cleanupSqlstates,detail?.sqlstate)};
}

export function ci1SuiteFailureMarker(id, result) {
  const suiteOrdinal = CI1_SUITES.findIndex(suite=>suite.id===id) + 1, d = result?.diagnostic;
  if (!suiteOrdinal || !d || typeof d!=='object' || Array.isArray(d) || Reflect.ownKeys(d).length !== diagnosticKeys.length
    || diagnosticKeys.some((key,i)=>!Object.hasOwn(d,key)||!Number.isSafeInteger(d[key])||d[key]<0||d[key]>limits[i])
    || ![result.hookErrorCount,result.errorCount].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=128)
    || d.originOrdinal !== (result.hookErrorCount ? 1 : result.errorCount ? 2 : 0)
    || (d.originOrdinal===0&&diagnosticKeys.slice(1).some(key=>d[key]!==0))) return null;
  return `CI1_SUITE_FAILURE ${[suiteOrdinal,result.hookErrorCount,result.errorCount,...diagnosticKeys.map(key=>d[key])].join(' ')}`;
}

export function ci1SuiteFailureFacts(stderr) {
  if (typeof stderr!=='string'||Buffer.byteLength(stderr)>1024**2) return {};
  const lines=stderr.split(/\r?\n/).filter(line=>line.startsWith('CI1_SUITE_FAILURE'));
  if(lines.length!==1||!/^CI1_SUITE_FAILURE(?: (?:0|[1-9][0-9]{0,2})){8}$/.test(lines[0]))return {};
  const [suite,hook,run,...values]=lines[0].slice('CI1_SUITE_FAILURE '.length).split(' ').map(Number);
  const result={hookErrorCount:hook,errorCount:run,diagnostic:Object.fromEntries(diagnosticKeys.map((key,i)=>[key,values[i]]))};
  if(ci1SuiteFailureMarker(CI1_SUITES[suite-1]?.id,result)!==lines[0])return {};
  return {suiteOrdinal:suite,suiteHookErrorCount:hook,suiteRunErrorCount:run,
    suiteErrorOriginOrdinal:values[0],suiteCleanupPhaseOrdinal:values[1],suiteCleanupStepOrdinal:values[2],
    suiteCleanupCodeOrdinal:values[3],suiteCleanupSqlstateOrdinal:values[4]};
}

// Caller holds the full private snapshots. Only fixed drift masks leave it.
export function ci1PreservationMask(before, after) {
  const valid = value => Array.isArray(value?.components) && value.components.length === 5
    && Array.from(value.components).every(h=>typeof h==='string'&&h.length===64&&/^[a-f0-9]{64}$/.test(h))
    && Array.isArray(value?.financial) && value.financial.length === 6
    && Array.from(value.financial).every(h=>typeof h==='string'&&h.length===32&&/^[a-f0-9]{32}$/.test(h));
  if(!valid(before)||!valid(after))return null;
  const componentMask=before.components.reduce((mask,h,i)=>mask|(h!==after.components[i]?2**i:0),0);
  const financialMask=before.financial.reduce((mask,h,i)=>mask|(h!==after.financial[i]?2**i:0),0);
  if(Boolean(componentMask&2)!==Boolean(financialMask))return null;
  return componentMask ? `CI1_PRESERVATION_FAILURE ${componentMask} ${financialMask}` : null;
}

export function ci1PreservationFacts(stderr) {
  if(typeof stderr!=='string'||Buffer.byteLength(stderr)>1024**2)return {};
  const lines=stderr.split(/\r?\n/).filter(line=>line.startsWith('CI1_PRESERVATION_FAILURE'));
  if(lines.length!==1)return {};
  const match=/^CI1_PRESERVATION_FAILURE ([1-9][0-9]?) (0|[1-9][0-9]?)$/.exec(lines[0]);
  if(!match)return {};
  const componentMask=Number(match[1]),financialMask=Number(match[2]);
  if(componentMask>31||financialMask>63||Boolean(componentMask&2)!==Boolean(financialMask))return {};
  return {preservationComponentDriftMask:componentMask,preservationFinancialDriftMask:financialMask};
}
