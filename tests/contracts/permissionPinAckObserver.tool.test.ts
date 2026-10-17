import { expect, test } from "vitest";
import type { Client } from "pg";
import { capturePinAckCredentialBaseline, capturePinAckSnapshot } from "../supabase/permissionPinAckObserver";

const input = {
  storeId: "00000000-0000-4000-8000-000000000001",
  ownerId: "00000000-0000-4000-8000-000000000002",
  requestId: "00000000-0000-4000-8000-000000000003",
  tempPin: "123456",
  newPin: "384729",
  oldTokens: ["synthetic-token-one", "synthetic-token-two"],
};

function client(query: Client["query"]): Client {
  return { query } as Client;
}

test("observer keeps baseline hash opaque and returns safe fields from one snapshot query", async () => {
  let calls = 0;
  const db = client((async (sql: string, params: unknown[]) => {
    calls += 1;
    if (calls === 1) {
      expect(sql).toContain("select passcode_hash");
      return { rows: [{ passcode_hash: "private-bcrypt-value" }] };
    }
    expect(sql).toContain("extensions.crypt($5::text,e.passcode_hash)");
    expect(sql).toContain("extensions.digest(convert_to(old_token.token,'UTF8'),'sha256')");
    expect(params.slice(0, 6)).toEqual([input.storeId, input.ownerId, input.requestId, input.tempPin, input.newPin, input.oldTokens]);
    expect(params[6]).toBe("private-bcrypt-value");
    return { rows: [{
      owner_count: 1,
      credential_hash_matches_baseline: false,
      credential_matches_temporary: false,
      credential_matches_new: true,
      requires_pin_change: false,
      revision: "1",
      session_total: 2,
      session_active: 0,
      session_revoked: 2,
      observed_old_tokens: 2,
      unrevoked_old_tokens: 0,
      audit_count: 1,
      audit_applied_count: 1,
      signal_count: 1,
      signal_revision: "1",
      signal_target_matches: true,
      request_count: 1,
      request_applied_count: 1,
      credential_hash: "must-never-leak",
      token_hash: "must-never-leak",
    }] };
  }) as unknown as Client["query"]);
  const baseline = await capturePinAckCredentialBaseline(db, input.storeId, input.ownerId);
  expect(JSON.stringify(baseline)).not.toContain("private-bcrypt-value");
  const snapshot = await capturePinAckSnapshot(db, { ...input, baseline });
  expect(calls).toBe(2);
  expect(snapshot).toEqual({
    credentialHashMatchesBaseline: false,
    credentialMatchesTemporary: false,
    credentialMatchesNew: true,
    requiresPinChange: false,
    revision: 1,
    sessionTotal: 2,
    sessionActive: 0,
    sessionRevoked: 2,
    observedOldTokens: 2,
    unrevokedOldTokens: 0,
    auditCount: 1,
    auditAppliedCount: 1,
    signalCount: 1,
    signalRevision: 1,
    signalTargetMatches: true,
    requestCount: 1,
    requestAppliedCount: 1,
  });
  expect(JSON.stringify(snapshot)).not.toContain("must-never-leak");
});

test("observer masks database diagnostics and rejects unsafe result shapes", async () => {
  const failed = client((async () => { throw new Error("sensitive database detail"); }) as unknown as Client["query"]);
  await expect(capturePinAckSnapshot(failed, input)).rejects.toThrow(/^PIN_ACK_OBSERVER_QUERY_FAILED$/);
  const malformed = client((async () => ({ rows: [{ owner_count: 0 }] })) as unknown as Client["query"]);
  await expect(capturePinAckSnapshot(malformed, input)).rejects.toThrow(/^PIN_ACK_OBSERVER_OWNER_MISMATCH$/);
});

test("baseline handle is bound to one owner and cannot silently compare another fixture", async () => {
  let calls = 0;
  const db = client((async () => {
    calls += 1;
    return { rows: [{ passcode_hash: "private-bcrypt-value" }] };
  }) as unknown as Client["query"]);
  const baseline = await capturePinAckCredentialBaseline(db, input.storeId, input.ownerId);
  await expect(capturePinAckSnapshot(db, { ...input, ownerId: "00000000-0000-4000-8000-000000000099", baseline }))
    .rejects.toThrow(/^PIN_ACK_OBSERVER_BASELINE_MISMATCH$/);
  expect(calls).toBe(1);
});
