import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBridgeOracle, BRIDGE_ORACLE_CONTRACT } from './permission-bridge-oracle.mjs';
import { scanSourceInventory } from './permission-inventory.mjs';
import { parseObserverEnvironment, runPreflight, permissionFingerprint, readMappingFiles, digest, PreflightError } from './permission-preflight-core.mjs';
import { hashFile } from './idempotency-artifacts.mjs';

export async function main(args = process.argv.slice(2)) {
  const mode = args.shift();
  if (!['static', 'run'].includes(mode)) throw new PreflightError('MODE_MUST_BE_STATIC_OR_RUN');
  const mappingPaths = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--mapping' || !args[i + 1]) throw new PreflightError('INVALID_CLI_ARGUMENT');
    mappingPaths.push(args[++i]);
  }
  if (mode === 'static' && mappingPaths.length) throw new PreflightError('STATIC_HAS_NO_MAPPING');
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  const directory = resolve('artifacts/permissions/t01', runId);
  if (existsSync(directory)) throw new PreflightError('ARTIFACT_RUN_ALREADY_EXISTS');
  const sourceFingerprint = permissionFingerprint();
  const staticProfile = { kind: 'static', backend: null, fixtureIds: [], runtime: { node: process.version }, configId: 't01-static-v1' };
  const staticHeader = { schemaVersion: 1, runId, sourceFingerprint, executionProfile: staticProfile };
  const result = mode === 'run' ? await runPreflight(parseObserverEnvironment(), { mappings: readMappingFiles(mappingPaths), runId }) : null;
  const oracle = createBridgeOracle();
  const header = result?.header ?? staticHeader;
  const artifacts = {
    inventory: result?.inventory ?? { ...staticHeader, surfaces: scanSourceInventory(), catalogObservation: 'NOT_RUN' },
    preflight: result?.preflight ?? { ...staticHeader, status: 'NOT_RUN', stores: [], reason: 'STATIC_MODE_HAS_NO_DATABASE' },
    'bridge-oracle': { ...staticHeader, contract: BRIDGE_ORACLE_CONTRACT, ...oracle },
  };
  if (permissionFingerprint() !== sourceFingerprint) throw new PreflightError('SOURCE_CHANGED_DURING_RUN');
  mkdirSync(directory, { recursive: true });
  const paths = {};
  for (const [name, data] of Object.entries(artifacts)) {
    const filename = resolve(directory, `${name}.json`);
    writeFileSync(filename, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
    paths[name] = { path: `artifacts/permissions/t01/${runId}/${name}.json`, sha256: hashFile(filename) };
  }
  const manifest = { ...header, command: { id: `permission:t01:${mode}`, mappingInputHashes: result?.preflight.inputMappingHashes ?? [] },
    artifacts: paths, profileSet: [header.executionProfile, staticProfile], startedAt, finishedAt: new Date().toISOString(),
    executions: [
      { tcId: 'TC-PERM-48', variant: 'preflight-observation-only', outcome: result ? 'PARTIAL' : 'NOT_RUN', observed: result?.preflight.status ?? null,
        commandId: `permission:t01:${mode}`, profile: header.executionProfile.configId, expected: 'Read-only owner proposal with provenance; no activation', artifact: paths.preflight, startedAt, finishedAt: new Date().toISOString() },
      { tcId: 'TC-PERM-49', variant: 'full-variant-suite-requires-test-report', outcome: 'NOT_RUN', artifact: paths.preflight,
        commandId: `permission:t01:${mode}`, profile: header.executionProfile.configId, expected: 'Run every T01 ambiguity/environment variant', observed: 'Use permission-verify runner', startedAt, finishedAt: new Date().toISOString() },
      { tcId: 'TC-PERM-50', variant: 'expected-only', outcome: 'PARTIAL', profile: staticProfile.configId,
        commandId: `permission:t01:${mode}`, expected: '6144 independent expected profiles', observedProfileCount: oracle.profiles.length,
        candidateHelper: 'NOT_RUN', artifact: paths['bridge-oracle'], startedAt, finishedAt: new Date().toISOString() },
    ], fixtureOnly: true, activation: 'NOT_RUN', reportDigest: digest(paths) };
  writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return { runId, directory, eligibility: result?.preflight.status ?? 'NOT_RUN', expectedProfiles: oracle.profiles.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const result = await main(); process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = result.eligibility === 'BLOCKED' ? 2 : 0; }
  catch (error) { process.stderr.write(JSON.stringify({ status: 'BLOCKED', code: error instanceof PreflightError ? error.reason : 'PERMISSION_TOOL_UNAVAILABLE' }) + '\n'); process.exitCode = 1; }
}
