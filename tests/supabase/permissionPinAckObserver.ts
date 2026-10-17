import type { Client } from "pg";

export type PinAckObservation = {
  credentialHashMatchesBaseline: boolean | null;
  credentialMatchesTemporary: boolean;
  credentialMatchesNew: boolean;
  requiresPinChange: boolean;
  revision: number;
  sessionTotal: number;
  sessionActive: number;
  sessionRevoked: number;
  observedOldTokens: number;
  unrevokedOldTokens: number;
  auditCount: number;
  auditAppliedCount: number;
  signalCount: number;
  signalRevision: number;
  signalTargetMatches: boolean;
  requestCount: number;
  requestAppliedCount: number;
};

export type PinAckObservationInput = {
  storeId: string;
  ownerId: string;
  requestId: string;
  tempPin: string;
  newPin: string;
  oldTokens?: string[];
  baseline?: PinAckCredentialBaseline;
};

export type PinAckCredentialBaseline = Readonly<{ baselineKind: "pin-ack-credential" }>;
const baselineSecrets = new WeakMap<PinAckCredentialBaseline, { storeId: string; ownerId: string; hash: string }>();

// The bcrypt value remains inside this module and is never returned, logged, or
// included in an assertion diff. The opaque handle only allows a later equality
// check inside PostgreSQL, including the pre-execute case where both PINs alone
// cannot prove the hash itself was unchanged.
export async function capturePinAckCredentialBaseline(
  db: Client, storeId: string, ownerId: string,
): Promise<PinAckCredentialBaseline> {
  try {
    const result = await db.query(
      "select passcode_hash from public.employees where store_id=$1::uuid and id=$2::uuid and role='owner'",
      [storeId, ownerId],
    );
    if (result.rows.length !== 1 || typeof result.rows[0].passcode_hash !== "string") {
      throw new Error("PIN_ACK_OBSERVER_OWNER_MISMATCH");
    }
    const handle: PinAckCredentialBaseline = Object.freeze({ baselineKind: "pin-ack-credential" });
    baselineSecrets.set(handle, { storeId, ownerId, hash: result.rows[0].passcode_hash });
    return handle;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("PIN_ACK_OBSERVER_")) throw error;
    throw new Error("PIN_ACK_OBSERVER_QUERY_FAILED");
  }
}

// One statement gives a single committed MVCC view on a connection independent
// of the intercepted REST request. Never select a credential, token hash, MAC,
// audit snapshot, or terminal receipt into the test process.
const SNAPSHOT_SQL = `
select
  (select count(*)::int from public.employees e where e.store_id=$1::uuid and e.id=$2::uuid and e.role='owner') owner_count,
  (select case when $7::text is null then null else e.passcode_hash=$7::text end
     from public.employees e where e.store_id=$1::uuid and e.id=$2::uuid) credential_hash_matches_baseline,
  (select e.passcode_hash=extensions.crypt($4::text,e.passcode_hash) from public.employees e where e.store_id=$1::uuid and e.id=$2::uuid) credential_matches_temporary,
  (select e.passcode_hash=extensions.crypt($5::text,e.passcode_hash) from public.employees e where e.store_id=$1::uuid and e.id=$2::uuid) credential_matches_new,
  (select e.pin_change_required from public.employees e where e.store_id=$1::uuid and e.id=$2::uuid) requires_pin_change,
  (select e.permission_revision::text from public.employees e where e.store_id=$1::uuid and e.id=$2::uuid) revision,
  (select count(*)::int from private.employee_sessions s where s.store_id=$1::uuid and s.employee_id=$2::uuid) session_total,
  (select count(*)::int from private.employee_sessions s where s.store_id=$1::uuid and s.employee_id=$2::uuid and s.revoked_at is null) session_active,
  (select count(*)::int from private.employee_sessions s where s.store_id=$1::uuid and s.employee_id=$2::uuid and s.revoked_at is not null) session_revoked,
  (select count(*)::int from unnest($6::text[]) as old_token(token) join private.employee_sessions s
     on s.store_id=$1::uuid and s.employee_id=$2::uuid
     and s.token_hash=extensions.digest(convert_to(old_token.token,'UTF8'),'sha256')) observed_old_tokens,
  (select count(*)::int from unnest($6::text[]) as old_token(token) join private.employee_sessions s
     on s.store_id=$1::uuid and s.employee_id=$2::uuid and s.revoked_at is null
     and s.token_hash=extensions.digest(convert_to(old_token.token,'UTF8'),'sha256')) unrevoked_old_tokens,
  (select count(*)::int from public.employee_admin_audit a where a.store_id=$1::uuid and a.target_id=$2::uuid
     and a.request_id=$3::uuid and a.kind='complete_required_pin_change') audit_count,
  (select count(*)::int from public.employee_admin_audit a where a.store_id=$1::uuid and a.target_id=$2::uuid
     and a.request_id=$3::uuid and a.kind='complete_required_pin_change' and a.outcome='applied'
     and a.credential_changed) audit_applied_count,
  (select count(*)::int from public.store_change_signals g where g.store_id=$1::uuid
     and g.topic='permission' and g.event_id=$3::uuid) signal_count,
  (select coalesce(max(g.revision),0)::text from public.store_change_signals g where g.store_id=$1::uuid
     and g.topic='permission') signal_revision,
  (select exists(select 1 from public.store_change_signals g where g.store_id=$1::uuid
     and g.topic='permission' and g.event_id=$3::uuid and g.target_id=$2::uuid)) signal_target_matches,
  (select count(*)::int from private.employee_admin_requests r where r.store_id=$1::uuid
     and r.actor_type='employee' and r.actor_key=$2::text and r.request_id=$3::uuid
     and r.kind='complete_required_pin_change') request_count,
  (select count(*)::int from private.employee_admin_requests r where r.store_id=$1::uuid
     and r.actor_type='employee' and r.actor_key=$2::text and r.request_id=$3::uuid
     and r.kind='complete_required_pin_change' and r.terminal_outcome->>'outcome'='applied'
     and r.terminal_outcome->'data'->>'credentialChanged'='true') request_applied_count
`;

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("PIN_ACK_OBSERVER_SHAPE_INVALID");
  }
  return value;
}

function revision(value: unknown): number {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("PIN_ACK_OBSERVER_SHAPE_INVALID");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("PIN_ACK_OBSERVER_SHAPE_INVALID");
  return parsed;
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("PIN_ACK_OBSERVER_SHAPE_INVALID");
  return value;
}

export async function capturePinAckSnapshot(db: Client, input: PinAckObservationInput): Promise<PinAckObservation> {
  if (!/^[0-9]{6}$/.test(input.tempPin) || !/^[0-9]{6}$/.test(input.newPin)
    || new Set(input.oldTokens ?? []).size !== (input.oldTokens ?? []).length) {
    throw new Error("PIN_ACK_OBSERVER_INPUT_INVALID");
  }
  const baseline = input.baseline === undefined ? undefined : baselineSecrets.get(input.baseline);
  if (input.baseline !== undefined && (!baseline || baseline.storeId !== input.storeId || baseline.ownerId !== input.ownerId)) {
    throw new Error("PIN_ACK_OBSERVER_BASELINE_MISMATCH");
  }
  try {
    const result = await db.query(SNAPSHOT_SQL, [
      input.storeId, input.ownerId, input.requestId, input.tempPin, input.newPin, input.oldTokens ?? [], baseline?.hash ?? null,
    ]);
    if (result.rows.length !== 1 || count(result.rows[0].owner_count) !== 1) {
      throw new Error("PIN_ACK_OBSERVER_OWNER_MISMATCH");
    }
    const row = result.rows[0];
    return {
      credentialHashMatchesBaseline: row.credential_hash_matches_baseline === null ? null : bool(row.credential_hash_matches_baseline),
      credentialMatchesTemporary: bool(row.credential_matches_temporary),
      credentialMatchesNew: bool(row.credential_matches_new),
      requiresPinChange: bool(row.requires_pin_change),
      revision: revision(row.revision),
      sessionTotal: count(row.session_total),
      sessionActive: count(row.session_active),
      sessionRevoked: count(row.session_revoked),
      observedOldTokens: count(row.observed_old_tokens),
      unrevokedOldTokens: count(row.unrevoked_old_tokens),
      auditCount: count(row.audit_count),
      auditAppliedCount: count(row.audit_applied_count),
      signalCount: count(row.signal_count),
      signalRevision: revision(row.signal_revision),
      signalTargetMatches: bool(row.signal_target_matches),
      requestCount: count(row.request_count),
      requestAppliedCount: count(row.request_applied_count),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("PIN_ACK_OBSERVER_")) throw error;
    throw new Error("PIN_ACK_OBSERVER_QUERY_FAILED");
  }
}
