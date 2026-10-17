import { createOwnerRecoveryServer } from '../../scripts/owner-recovery-operator-core.mjs';

const receipts = new Map();
const { listen } = createOwnerRecoveryServer({ port: 5192,
  launchCode: 'operator-browser-test-code-2026-strong',
  recover: async payload => {
    const errors = {
      'case-owner-protected': 'OWNER_PROTECTED',
      'case-not-found': 'NOT_FOUND',
      'case-review-required': 'OWNER_RECOVERY_REVIEW_REQUIRED',
      'case-forbidden': 'FORBIDDEN',
      'case-reused': 'ADMIN_REQUEST_REUSED',
    };
    if (errors[payload.caseRef]) return { ok: false, error: { code: errors[payload.caseRef] } };
    const fingerprint = JSON.stringify(payload);
    const prior = receipts.get(payload.requestId);
    if (prior && prior !== fingerprint) return { ok: false, error: { code: 'ADMIN_REQUEST_REUSED' } };
    receipts.set(payload.requestId, fingerprint);
    if (payload.caseRef === 'case-unavailable' && !prior)
      return { ok: false, error: { code: 'PERMISSION_UPDATE_UNAVAILABLE' } };
    return { ok: true, outcome: prior ? 'replayed' : 'applied',
      data: { credentialChanged: true, pinChangeRequired: true, employeeRevision: 8 } };
  },
});
await listen();
