import { snapshotsEqual } from './permission-preflight-core.mjs';

// Read-only operator guard. This never executes a restore or treats a backup
// timestamp as proof that later payments are safe to discard. Snapshots must
// come from this process's complete observer (serialized digests are not proof).
export function assessPermissionRestore(backup, current, writesQuiesced) {
  if (writesQuiesced !== true) return { decision: 'BLOCKED', reason: 'WRITES_NOT_QUIESCED', next: 'STOP_WRITES_AND_RECONCILE' };
  if (!snapshotsEqual(backup, current)) return { decision: 'BLOCKED', reason: 'POST_BACKUP_STATE_DIFFERS', next: 'FORWARD_FIX_OR_RECONCILE' };
  return { decision: 'OPERATOR_REVIEW_REQUIRED', reason: 'NO_OBSERVED_DATA_DRIFT', next: 'VERIFY_BACKUP_AND_RECOVERY_PLAN' };
}
