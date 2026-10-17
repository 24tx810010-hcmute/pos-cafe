import { readFileSync } from 'node:fs';
import { sha256, exactSet, fail } from './permission-backup-v2-core.mjs';
export const SCOPE79_SHA='362883c12c6d5a1666258572fc7acb32d283c702725520dc06d8a1705ed8ddb8';
// Pure preparation: approval is pinned provenance, never a backup or capability.
export function planBackupV2(scopePath) {
  const bytes=readFileSync(scopePath);if(sha256(bytes)!==SCOPE79_SHA)fail('BACKUP_V2_SCOPE_INVALID');
  const s=JSON.parse(bytes);
  if(s.baseline77.length!==77 || s.approvedAdditional2.length!==2
    || !exactSet(s.approvedStoreIds,[...s.baseline77,...s.approvedAdditional2])
    || !exactSet(s.approvedAuthIds,s.approvedStoreIds) || s.preservedAuthIds.length!==66
    || s.storageDeletionAllowlist.length!==2 || s.storagePreservationAllowlist.length!==1)fail('BACKUP_V2_SCOPE_INVALID');
  return {schemaVersion:2,kind:'phase2-backup79-preparation-only',scopeApprovalSha256:SCOPE79_SHA,
    projectRef:s.projectRef,approvedStoreIds:s.approvedStoreIds,preservedAuthIds:s.preservedAuthIds,
    storageDeletionAllowlist:s.storageDeletionAllowlist,storagePreservationAllowlist:s.storagePreservationAllowlist,
    requirements:{B_I:['SHARED_EXPORTED_SNAPSHOT','EXACT_INVENTORIES_FULL_ROWS_CATALOG_LO_ROLES_ACL','ARCHIVE_SEQUENCE_FIDELITY','CLOSED_WORLD_ALLOCATION_CONTRACT'],
      C:['ACTUAL_DEPENDENCY_CLOSURE_DRAIN','FULL_ROW_AUTH_OUTSIDE_STORAGE_RECHECK','CATALOG_ROLES_DDL_WINDOW','EMPTY_K_TARGET','ACTUAL_AUTHENTICATOR_AND_STORAGE_POLICY_ACTOR'],
      Storage:['ALL_INGRESS_ADMITTED_UPLOAD_BACKGROUND_CONTROL','STABILITY_THROUGH_DELETE_RECONCILE','THREE_EXACT_PAYLOADS_METADATA_VERSION_HASH_SIZE_MIME'],
      L:['CURRENT_COMPLETE_STATE_EQUALITY','WRITES_QUIESCED_OR_RECONCILED','OPERATOR_REVIEW']},
    globalSequenceFreezeForLogicalDump:false,global64LockForLogicalDump:false,
    executionReady:false,cleanupEligible:false,providerControl:null,windowApproved:false};
}
