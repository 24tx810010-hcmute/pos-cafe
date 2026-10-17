type RestrictedDenialProbe = {
  readSnapshot: () => Promise<string>;
  invoke: () => Promise<unknown>;
  cleanup: () => Promise<void>;
};

type ProbeFailure =
  | 'PIN_RESTRICTED_ROUTE_MUTATION'
  | 'PIN_RESTRICTED_DENIAL_MISMATCH'
  | 'PIN_RESTRICTED_ROUTE_PROBE_FAILED'
  | 'PIN_RESTRICTED_ROUTE_ROLLBACK_FAILED';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Test-only oracle: inspect effects in the caller's transaction before cleanup
// can erase them. Snapshots, RPC payloads and underlying errors stay private.
export async function probeRestrictedDenial(probe: RestrictedDenialProbe): Promise<boolean> {
  let failure: ProbeFailure | undefined;
  try {
    const before = await probe.readSnapshot();
    const result = await probe.invoke();
    const after = await probe.readSnapshot();
    if (before !== after) {
      failure = 'PIN_RESTRICTED_ROUTE_MUTATION';
    } else if (!isRecord(result) || result.ok !== false || !isRecord(result.error)
      || result.error.code !== 'PIN_CHANGE_REQUIRED') {
      failure = 'PIN_RESTRICTED_DENIAL_MISMATCH';
    }
  } catch {
    failure = 'PIN_RESTRICTED_ROUTE_PROBE_FAILED';
  } finally {
    try {
      await probe.cleanup();
    } catch {
      failure = 'PIN_RESTRICTED_ROUTE_ROLLBACK_FAILED';
    }
  }
  if (failure) throw new Error(failure);
  return true;
}
