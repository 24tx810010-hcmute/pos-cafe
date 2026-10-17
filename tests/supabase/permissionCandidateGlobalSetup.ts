import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { activateDatabase } from "../../scripts/permission-activate.mjs";
import { activationBundleManifest } from "../../scripts/permission-activation-bundle.mjs";
import { captureSnapshot, permissionFingerprint } from "../../scripts/permission-preflight-core.mjs";
import { prepareCompatibilityHook, verifyCompatibilityRestRouting } from "../../scripts/permission-compatibility-prepare.mjs";
import { EMPLOYEE_IDS, STORE_IDS } from "../../scripts/permission-identity-runtime.mjs";
import { candidateEnvironment } from "./permissionCandidateEnvironment.ts";

export default async function setup() {
  const env = candidateEnvironment();
  const db = new pg.Client({ connectionString: env.dsn }); await db.connect();
  try {
    const fixture = (await db.query("select marker,engine,store_ids from private.idempotency_test_environment where singleton")).rows[0];
    if (!fixture || fixture.marker !== env.marker || fixture.engine !== "supabase-identity-v1" || JSON.stringify(fixture.store_ids) !== JSON.stringify(STORE_IDS)) throw new Error("FIXTURE_DATABASE_BINDING_MISMATCH");
    await prepareCompatibilityHook(db); await verifyCompatibilityRestRouting({ restUrl: `${env.api}/rest/v1`, anonKey: env.anonKey });
    const identityResponse = await fetch(`${env.api}/rest/v1/rpc/permission_fixture_identity`, { method: "POST", headers: { apikey: env.anonKey, Authorization: `Bearer ${env.storeJwt}`, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(10_000) });
    const identity = await identityResponse.json() as { marker?: string; storeId?: string; database?: string };
    if (!identityResponse.ok || identity.marker !== env.marker || identity.storeId !== STORE_IDS[0] || identity.database !== "postgres") throw new Error("FIXTURE_API_BINDING_MISMATCH");
    const already = (await db.query("select to_regclass('public.permission_catalog') value")).rows[0].value;
    if (already) {
      throw new Error("FRESH_LEGACY_FIXTURE_REQUIRED");
    }
    const snapshot = await captureSnapshot(db), directory = mkdtempSync(join(tmpdir(), "permission-candidate-e2e-"));
    const mappings = [0, 1].map(index => ({ schemaVersion: 1, storeId: STORE_IDS[index], ownerId: EMPLOYEE_IDS[index === 0 ? 0 : 3], verifiedByRef: `synthetic:e2e-owner-${index + 1}`, evidenceRefs: ["synthetic:isolated-fixture"], sourceSnapshotHash: snapshot.hash }));
    const paths = mappings.map((mapping, index) => { const path = join(directory, `mapping-${index + 1}.json`); writeFileSync(path, JSON.stringify(mapping), { mode: 0o600 }); return path; });
    await activateDatabase({ schemaVersion: 1, mode: "synthetic-activation", connectionString: env.dsn, database: "postgres", marker: env.marker, storeIds: STORE_IDS, sourceFingerprint: permissionFingerprint(), bundleHash: activationBundleManifest().sha256, mappingFiles: paths });
    // Established synthetic stores did not request initial demo data. This is
    // fixture configuration, never a production backfill in the activation bundle.
    await db.query(`insert into private.initial_seed_workflows(workflow_id,store_id,requested,template_version,status,created_at,updated_at)
      select private.permission_stable_uuid(id,'fixture.initial-seed.skipped'),id,false,1,'skipped',private.write_clock(),private.write_clock()
      from public.stores where id=any($1::uuid[])`, [STORE_IDS]);
    await db.query("notify pgrst,'reload schema'");
  } finally { await db.end(); }
}
