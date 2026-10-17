import { writeFileSync } from 'node:fs';
import type pg from 'pg';
import { captureExecutionProfile } from '../../scripts/permission-execution-evidence.mjs';
import { collectInventory } from '../../scripts/permission-inventory.mjs';
import { digest, permissionFingerprint } from '../../scripts/permission-preflight-core.mjs';
import { parseBridgeEnvironment, runtimeProof, STORE_IDS } from '../../scripts/permission-identity-runtime.mjs';

const identity = ['permission-identity.sql'];
const administration = [...identity, 'permission-administration.sql'];
const financial = [...administration, 'permission-financial.sql'];
const read = [...financial, 'permission-read.sql'];
const fragments: Record<string, string[]> = {
  'identity-database': identity,
  'administration-database': administration,
  'financial-database': financial,
  'read-database': read,
  'clear-demo-database': [...financial, 'permission-changes.sql'],
  'candidate-signals-database': [...administration, 'permission-signals.sql'],
  'candidate-print-database': [...read, 'permission-print.sql'],
  'candidate-bulk-concurrency-database': [...financial, 'permission-changes.sql', 'permission-seed.sql'],
  'candidate-images-service': [...read, 'permission-changes.sql', 'permission-images.sql',
    'permission-compatibility-prepare.sql', 'permission-compatibility-activate.sql'],
  'candidate-seed-recovery-database': [...read, 'permission-changes.sql', 'permission-images.sql',
    'permission-signals.sql', 'permission-print.sql', 'permission-seed.sql',
    'permission-compatibility-prepare.sql', 'permission-compatibility-activate.sql'],
};

// Called on the fixture's own connection after its DDL, including DDL kept in
// an uncommitted test transaction. No business row or credential is exported.
export async function observeCandidateStage(db: pg.Client): Promise<void> {
  const path = process.env.PERM_STAGE_OBSERVATION_FILE;
  if (!path) return;
  const stage = process.env.PERM_RUN_STAGE ?? '', runId = process.env.PERM_RUN_ID;
  const files = fragments[stage];
  if (!files || !runId || !process.env.PERM_RUN_CONFIG) throw new Error('STAGE_OBSERVATION_OPTIONS_REQUIRED');
  const env = parseBridgeEnvironment(), runtime = runtimeProof();
  const marker = (await db.query('select current_database() database,marker,store_ids,migration_checksums from private.idempotency_test_environment where singleton')).rows;
  if (marker.length !== 1 || marker[0].database !== 'postgres' || marker[0].marker !== env.marker
    || JSON.stringify(marker[0].store_ids) !== JSON.stringify(STORE_IDS)) throw new Error('STAGE_OBSERVATION_FIXTURE_REFUSED');
  const phase = (await db.query(`select to_regclass('public.permission_catalog') is not null catalog,
    to_regprocedure('public.permission_start_session(uuid,text)') is not null identity_rpc,
    (select data_type from information_schema.columns where table_schema='public' and table_name='employees' and column_name='role') role_type,
    (select count(*)::int from public.permission_catalog) catalog_rows`)).rows[0];
  if (!phase.catalog || !phase.identity_rpc || phase.role_type !== 'text' || phase.catalog_rows !== 15)
    throw new Error('STAGE_OBSERVATION_CANDIDATE_REQUIRED');
  const response = await fetch(env.api + '/rest/v1/rpc/permission_fixture_identity', {
    method: 'POST', headers: { apikey: env.anonKey, Authorization: 'Bearer ' + env.storeJwt,
      'Content-Type': 'application/json', 'x-pos-permission-contract': '2' }, body: '{}', signal: AbortSignal.timeout(10000),
  });
  const binding = await response.json();
  if (!response.ok || binding.marker !== env.marker || binding.storeId !== STORE_IDS[0] || binding.database !== 'postgres')
    throw new Error('STAGE_OBSERVATION_API_BINDING_REFUSED');
  const inventory = await collectInventory(db);
  const appliedArtifacts = [...Object.keys(marker[0].migration_checksums).sort().map(name => ({ id: name, path: `supabase/migrations/${name}` })),
    { id: '017_permission_catalog_bridge.sql', path: 'supabase/migrations/017_permission_catalog_bridge.sql' },
    ...files.map(name => ({ id: name, path: `supabase/candidate/${name}` }))];
  const sourceFingerprint = permissionFingerprint();
  const executionProfile = await captureExecutionProfile({ profile: 'candidate', stage, executionKind: 'service',
    configId: process.env.PERM_RUN_CONFIG, appliedArtifacts, observer: { observe: async () => ({
      backend: { reference: runtime.project, host: '127.0.0.1', port: 62422, database: 'postgres', engine: `supabase-cli-${runtime.cli}` },
      fixtureIds: STORE_IDS, markerProof: digest(env.marker), catalogHash: inventory.catalogHash,
      schemaHash: digest({ catalogHash: inventory.catalogHash, phase }),
      apiBinding: { verified: true, baseUrl: env.api, projectRef: runtime.project },
    }) } });
  writeFileSync(path, JSON.stringify({ schemaVersion: 'permission-stage-observation-v1', runId, stage,
    sourceFingerprint, observedAt: new Date().toISOString(), phase, executionProfile }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
}
