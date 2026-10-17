import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifySuite } from './permission-verify.mjs';
import { permissionFingerprint } from './permission-preflight-core.mjs';
import { hashFile } from './idempotency-artifacts.mjs';

const sourceFingerprint = permissionFingerprint(), runId = randomUUID();
const directory = resolve('artifacts/permissions/t07', runId);
mkdirSync(directory, { recursive: true });
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const dependencies = {};
for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
  const version = JSON.parse(readFileSync('node_modules/' + name + '/package.json', 'utf8')).version;
  if (version !== lock.packages['node_modules/' + name]?.version) throw new Error('DEPENDENCY_LOCK_MISMATCH: ' + name);
  dependencies[name] = version;
}
if (process.version !== 'v24.16.0') throw new Error('NODE_RUNTIME_MISMATCH');
const required = JSON.parse(readFileSync('tests/permissions/permissionReadCases.json', 'utf8'));
if (!Array.isArray(required) || ['unit', 'database'].some(stage => !required.some(c => c.stage === stage))
  || required.some(c => !['unit', 'database'].includes(c.stage) || typeof c.file !== 'string' || !c.file || typeof c.name !== 'string' || !c.name))
  throw new Error('REQUIRED_VARIANT_MANIFEST_EMPTY_OR_INVALID');
const evidenceFile = resolve(directory, 'database-evidence.json');
const invoke = (args, env) => spawnSync(process.execPath, args, { env: { ...process.env, NO_COLOR: '1', ...env }, encoding: 'utf8', timeout: 240000, maxBuffer: 12 * 1024 * 1024 });
function runSuite(stage, config, requiredFiles) {
  const files = Object.fromEntries(['discovery', 'results', 'options'].map(k => [k, resolve(directory, `${stage}-${k}.json`)]));
  const env = { PERM_RESULTS_FILE: files.results, IDEM_ATTESTATION_FILE: files.options, PERM_READ_EVIDENCE_FILE: evidenceFile };
  const discovery = invoke(['node_modules/vitest/vitest.mjs', 'list', '--config', config, '--json=' + files.discovery], env);
  const execution = discovery.status === 0 ? invoke(['node_modules/vitest/vitest.mjs', 'run', '--config', config, '--allowOnly=false', '--retry=0', '--reporter=./scripts/permission-vitest-reporter.mjs'], env) : null;
  const artifacts = Object.fromEntries(Object.entries(files).filter(([, p]) => existsSync(p)).map(([k, p]) => [k, { path: p, sha256: hashFile(p) }]));
  if (discovery.status !== 0 || execution?.status !== 0 || Object.keys(artifacts).length !== 3)
    return { stage, valid: false, errors: ['RUNNER_FAILED'], artifacts };
  const read = k => JSON.parse(readFileSync(files[k], 'utf8'));
  return { stage, ...verifySuite(read('discovery'), read('results'), read('options'), requiredFiles, required.filter(c => c.stage === stage)), artifacts };
}
const unit = runSuite('unit', 'vitest.config.ts', ['adapters/mock/permissionReadRepo.test.ts', 'adapters/supabase/permissionReadRepo.test.ts', 'core/permissionReadInputs.test.ts', 'architectureBoundaries.test.ts']);
const build = invoke(['node_modules/typescript/bin/tsc', '-b'], {});
const bundle = build.status === 0 ? invoke(['node_modules/vite/bin/vite.js', 'build'], {}) : null;
const database = unit.valid && build.status === 0 && bundle?.status === 0
  ? runSuite('database', 'vitest.permission-read.config.ts', ['permissionRead.contract.test.ts'])
  : { valid: false, errors: ['EARLIER_STAGE_FAILED'] };
const evidence = existsSync(evidenceFile) ? JSON.parse(readFileSync(evidenceFile, 'utf8')) : null;
const fixtureValid = e => e?.fixtureEvidence?.businessUnchanged === true && e.fixtureEvidence.reverted === true
  && e.fixtureEvidence.financialAclNegativeControl === true && e.fixtureEvidence.financialPhasePreserved === true
  && e.fixtureEvidence.financialBusinessRestored === true && e.fixtureEvidence.readAclNegativeControl === true
  && e.fixtureEvidence.readPhasePreserved === true && e.fixtureEvidence.readBusinessRestored === true
  && e.sourceFingerprint === sourceFingerprint && e.sourceAfter === sourceFingerprint;
const requiredControls = ['rawSelectClosed','privateHelperClosed','endpointPermissionMatrix','receiptSnapshotsImmutable',
  'orderStateFreshAfterWait','authorityFreshAfterWait','catalogFreshAfterWait','sessionFreshAfterWait',
  'reportStoreTimezone','historyFilterBoundaries','administrationStillUsable','readOnlyStateUnchanged',
  'reportOrderSummaries','postLockAuthorityNegativeControl'];
const valid = unit.valid && build.status === 0 && bundle?.status === 0 && database.valid && fixtureValid(evidence)
  && requiredControls.every(k => evidence.controls?.[k] === true) && permissionFingerprint() === sourceFingerprint;
const report = { schemaVersion: 1, runId, sourceFingerprint, finishedAt: new Date().toISOString(), valid,
  unit, database, build: { typecheckExitCode: build.status, bundleExitCode: bundle?.status ?? null },
  runtime: { node: process.version, dependencies, packageLockHash: hashFile('package-lock.json'), pnpmLockHash: hashFile('pnpm-lock.yaml') },
  evidence: evidence ? { path: evidenceFile, sha256: hashFile(evidenceFile) } : null,
  scope: { reads: 'Purpose-specific projections with fresh authority, raw table/column SELECT closure and immutable receipt views',
    reports: 'Store-timezone hourly aggregates; separate max-20 paid summaries across date range; stored business_date unchanged',
    TC13_38: 'Read half only; receipt print grants and UI remain T14',
    UI: 'NOT_ACTIVATED', activation: 'NOT_RUN', rollout: 'NOT_RUN', Realtime: 'NOT_RUN', Storage: 'NOT_RUN' } };

writeFileSync(resolve(directory, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ valid, directory, sourceFingerprint, unit: unit.executedCount, database: database.executedCount,
  businessUnchanged: evidence?.fixtureEvidence?.businessUnchanged, errors: [...(unit.errors ?? []), ...(database.errors ?? [])], build: report.build }));
process.exitCode = valid ? 0 : 1;
