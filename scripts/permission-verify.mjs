import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readVitestTests } from '../tests/contracts/resultVerifier.ts';
import { permissionFingerprint, parseObserverEnvironment, digest } from './permission-preflight-core.mjs';
import requiredCases from '../tests/contracts/permissionCaseCatalog.json' with { type: 'json' };
import { hashFile } from './idempotency-artifacts.mjs';
import { main as preflight } from './permission-preflight.mjs';

const key = entry => `${entry.file.replaceAll('\\', '/')}|${entry.name}`;
const normalize = file => file.replaceAll('\\', '/');
export function verifySuite(discovery, report, attestation, requiredFiles, required = []) {
  const discovered = readVitestTests(discovery, true), results = readVitestTests(report);
  const expected = new Set(discovered.map(key)), actual = new Map(results.map(entry => [key(entry), entry]));
  const options = new Map((attestation?.tests ?? []).map(entry => [key(entry), entry]));
  const errors = [];
  if (!discovered.length || expected.size !== discovered.length || actual.size !== results.length) errors.push('EMPTY_OR_DUPLICATE_DISCOVERY_RESULTS');
  for (const file of requiredFiles) if (!discovered.some(entry => normalize(entry.file).endsWith(file))) errors.push(`MISSING_FILE:${file}`);
  for (const item of required) {
    if (discovered.filter(entry => normalize(entry.file).endsWith(item.file) && entry.name === item.name).length !== 1) errors.push(`MISSING_REQUIRED_VARIANT:${item.name}`);
  }
  if (expected.size !== actual.size || [...expected].some(id => !actual.has(id))) errors.push('DISCOVERY_RESULT_MISMATCH');
  if (report.success !== true || attestation?.runner !== 'vitest-actual-options-v1' || attestation.reason !== 'passed' || attestation.errorCount !== 0
    || options.size !== expected.size || (attestation?.tests ?? []).length !== expected.size) errors.push('RUNNER_OPTIONS_NOT_ATTESTED');
  for (const entry of results) {
    const recorded = options.get(key(entry)), o = recorded?.options;
    if (entry.status !== 'passed' || recorded?.state !== 'passed' || o?.fails !== false || o?.retry !== 0 || o?.repeats !== 0 || o?.mode !== 'run') errors.push(`NONSTANDARD_PASS:${entry.name}`);
  }
  return { valid: errors.length === 0, discoveredCount: discovered.length, executedCount: results.length, errors, results };
}

export function verifyProfiles(profiles, results, header, required = requiredCases) {
  const errors = [], hex = /^[a-f0-9]{64}$/;
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const binding = profile => profile?.kind === 'legacy' && profile.configId === header.executionProfile.configId
    && same(profile.backend, header.executionProfile.backend) && same(profile.fixtureIds, header.executionProfile.fixtureIds)
    && profile.markerProof === header.executionProfile.markerProof && profile.catalogHash === header.executionProfile.catalogHash;
  if (!profiles || profiles.schemaVersion !== 1 || profiles.runId !== header.runId || profiles.sourceFingerprint !== header.sourceFingerprint
    || !binding(profiles.executionProfile) || !Array.isArray(profiles.cases)) return { valid: false, errors: ['PROFILE_BINDING_MISSING_OR_MISMATCH'] };
  const cases = new Map(profiles.cases.map(entry => [entry.testName, entry]));
  if (cases.size !== results.length || cases.size !== profiles.cases.length) errors.push('PROFILE_CASE_SET_MISMATCH');
  for (const result of results) {
    const entry = cases.get(result.name);
    const requirement = required.find(item => item.name === result.name);
    if (!entry || entry.sourceFingerprint !== header.sourceFingerprint || !binding(entry.executionProfile)
      || !hex.test(entry.catalogHashAtStart ?? '') || !hex.test(entry.catalogHashAtEnd ?? '')
      || entry.catalogHashAtStart !== header.executionProfile.catalogHash || entry.catalogHashAtEnd !== header.executionProfile.catalogHash
      || !Number.isFinite(Date.parse(entry.startedAt)) || !Number.isFinite(Date.parse(entry.finishedAt))
      || Date.parse(entry.finishedAt) < Date.parse(entry.startedAt) || !Array.isArray(entry.events)
      || !requirement || entry.events.length !== requirement.expectedEventCount
      || entry.scope !== (requirement.expectedEventCount === 0 ? 'direct-observer-control' : 'preflight-observer-control')) { errors.push(`PROFILE_CASE_INVALID:${result.name}`); continue; }
    for (const event of entry.events) {
      if (event.testName !== entry.testName || event.runId !== header.runId || event.sourceFingerprint !== header.sourceFingerprint
        || !same(event.executionProfile?.backend, header.executionProfile.backend)
        || !same(event.executionProfile?.fixtureIds, header.executionProfile.fixtureIds)
        || event.executionProfile?.configId !== header.executionProfile.configId
        || event.executionProfile?.markerProof !== header.executionProfile.markerProof
        || !hex.test(event.executionProfile?.catalogHash ?? event.catalogHash ?? '')
        || !Number.isFinite(Date.parse(event.execution?.startedAt)) || !Number.isFinite(Date.parse(event.execution?.finishedAt))) errors.push(`PROFILE_EVENT_INVALID:${result.name}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export async function verify(args = process.argv.slice(2)) {
  // Only explicit mapping arguments are passed through; no shell or arbitrary runner overrides.
  if (args.length % 2 || args.some((arg, i) => i % 2 === 0 && arg !== '--mapping')) throw new Error('INVALID_VERIFY_ARGUMENT');
  const env = parseObserverEnvironment();
  const sourceFingerprint = permissionFingerprint(), startedAt = new Date().toISOString(), runId = randomUUID();
  const directory = resolve('artifacts/permissions/t01', runId);
  mkdirSync(directory, { recursive: true });
  const header = { schemaVersion: 1, runId, sourceFingerprint, executionProfile: { kind: 'legacy', configId: env.profile,
    backend: { reference: env.backendRef, database: env.database, engine: env.engine, host: env.host, port: env.port }, fixtureIds: env.storeIds,
    markerProof: digest(env.marker), catalogHash: env.expectedCatalogHash,
    runtime: { node: process.version, vitest: JSON.parse(readFileSync('node_modules/vitest/package.json', 'utf8')).version },
    apiBinding: 'NOT_APPLICABLE_OBSERVER_ONLY' } };
  const stages = [];
  for (const [stage, config, requiredFiles] of [
    ['tools', 'tests/contracts/tooling.config.ts', ['permissionPreflight.tool.test.ts', 'permissionMigrationPlan.tool.test.ts', 'permissionBridgeOracle.tool.test.ts', 'permissionInventory.tool.test.ts', 'permissionVerify.tool.test.ts', 'harness.tool.test.ts']],
    ['database', 'vitest.permission.config.ts', ['permissionMigration.contract.test.ts']],
  ]) {
    const started = new Date().toISOString();
    const paths = Object.fromEntries(['discovery', 'results', 'options', 'profiles'].map(name => [name, resolve(directory, `${stage}-${name}.json`)]));
    const childEnv = { ...process.env, NO_COLOR: '1', IDEM_ATTESTATION_FILE: paths.options, PERM_EXECUTIONS_FILE: paths.profiles, PERM_RUN_ID: runId, PERM_RESULTS_FILE: paths.results };
    const invoke = params => spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', ...params], { encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024, env: childEnv });
    const files = requiredFiles.map(file => `tests/contracts/${file}`);
    const discovery = invoke(['list', '--config', config, ...files, `--json=${paths.discovery}`]);
    const run = discovery.status === 0 ? invoke(['run', '--config', config, ...files, '--allowOnly=false', '--retry=0', '--reporter=./scripts/permission-vitest-reporter.mjs']) : null;
    // Reuse the phase-27 runner/parser/attestation, but scope redaction to this new run.
    for (const path of Object.values(paths)) if (existsSync(path)) {
      const redact = value => typeof value === 'string' ? value.replaceAll(env.observerDsn, '[REDACTED_OBSERVER_DSN]')
        .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[REDACTED_DSN]')
        .replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
        : Array.isArray(value) ? value.map(redact) : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redact(entry)])) : value;
      writeFileSync(path, JSON.stringify(redact(JSON.parse(readFileSync(path, 'utf8'))), null, 2) + '\n');
    }
    let checked = { valid: false, errors: ['RUNNER_FAILED_OR_REPORT_MISSING'] };
    if (discovery.status === 0 && run?.status === 0 && ['discovery', 'results', 'options'].every(name => existsSync(paths[name]))) {
      const required = requiredCases.filter(entry => entry.stage === stage);
      checked = verifySuite(JSON.parse(readFileSync(paths.discovery, 'utf8')), JSON.parse(readFileSync(paths.results, 'utf8')), JSON.parse(readFileSync(paths.options, 'utf8')), requiredFiles, required);
      if (!required.length) { checked.valid = false; checked.errors.push('REQUIRED_VARIANT_MANIFEST_EMPTY'); }
      if (stage === 'database') {
        const binding = verifyProfiles(existsSync(paths.profiles) ? JSON.parse(readFileSync(paths.profiles, 'utf8')) : null, checked.results, header);
        checked.errors.push(...binding.errors); checked.valid = checked.valid && binding.valid;
      }
    }
    stages.push({ stage, configId: config, commandId: `permission:verify:${stage}`, startedAt: started, finishedAt: new Date().toISOString(),
      discoveryExitCode: discovery.status, exitCode: run?.status ?? null, ...checked,
      artifacts: Object.fromEntries(Object.entries(paths).filter(([, path]) => existsSync(path)).map(([name, path]) => [name, { path: normalize(path), sha256: hashFile(path) }])) });
    process.stdout.write(JSON.stringify({ stage, valid: checked.valid, executed: checked.executedCount ?? 0 }) + '\n');
    if (!checked.valid) break;
  }
  const sourceUnchanged = permissionFingerprint() === sourceFingerprint;
  const testsPassed = stages.length === 2 && stages.every(stage => stage.valid) && sourceUnchanged;
  let artifacts = null, preflightFailure = null;
  if (testsPassed) try { artifacts = await preflight(['run', ...args]); } catch { preflightFailure = 'PREFLIGHT_REPORT_FAILED'; }
  const valid = testsPassed && artifacts?.eligibility === 'READY' && permissionFingerprint() === sourceFingerprint;
  const report = { ...header, startedAt, finishedAt: new Date().toISOString(), sourceUnchanged, stages, valid,
    preflightRun: artifacts, preflightFailure, requiredManifest: { path: 'tests/contracts/permissionCaseCatalog.json', sha256: hashFile('tests/contracts/permissionCaseCatalog.json') }, scope: { 'TC-PERM-48': 'PARTIAL: T01 preflight only', 'TC-PERM-49': valid ? 'PASS: T01 variants' : 'NOT_ACCEPTED',
      'TC-PERM-50': 'PARTIAL: 6144 expected profiles; bridge helper NOT_RUN' }, activation: 'NOT_RUN', services: 'Auth/REST/Storage/Realtime NOT_RUN' };
  writeFileSync(resolve(directory, 'verification.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return { valid, directory, sourceFingerprint, preflightRun: artifacts };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const result = await verify(); process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = result.valid ? 0 : 1; }
  catch { process.stderr.write('PERMISSION_VERIFICATION_BLOCKED\n'); process.exitCode = 1; }
}
