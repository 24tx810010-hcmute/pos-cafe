import pg from "pg";
import { STORE_IDS } from "../../scripts/permission-identity-runtime.mjs";
import { assertActivatedCandidate, candidateEnvironment, refreshStoreSession } from "./permissionCandidateEnvironment";

export default async function setup() {
  const env = candidateEnvironment();
  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 10_000 });
  await db.connect();
  try { await assertActivatedCandidate(db, env); }
  finally { await db.end(); }

  const session = await refreshStoreSession(env);
  const response = await fetch(`${env.api}/rest/v1/rpc/permission_fixture_identity`, {
    method: "POST",
    headers: { apikey: env.anonKey, Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json", "x-pos-permission-contract": "2" },
    body: "{}", signal: AbortSignal.timeout(10_000),
  });
  const identity = await response.json();
  if (!response.ok || identity.marker !== env.marker || identity.storeId !== STORE_IDS[0] || identity.database !== "postgres")
    throw new Error("CANDIDATE_API_DB_BINDING_MISMATCH");
}
