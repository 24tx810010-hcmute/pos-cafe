import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifySuite } from './permission-verify.mjs';
import { permissionFingerprint } from './permission-preflight-core.mjs';
import { hashFile } from './idempotency-artifacts.mjs';
import { captureExecutionProfile, emitExecutionAttestation } from './permission-execution-evidence.mjs';

const sourceFingerprint = permissionFingerprint(), runId = randomUUID();
const directory = resolve('artifacts/permissions/t03', runId);
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
const required = JSON.parse(readFileSync('tests/permissions/permissionFoundationCases.json', 'utf8'));
const evidenceFile = resolve(directory, 'database-evidence.json');
const invoke = (args, env) => spawnSync(process.execPath, args, { env: { ...process.env, NO_COLOR: '1', ...env }, encoding: 'utf8', timeout: 240000, maxBuffer: 12 * 1024 * 1024 });
function runSuite(stage, config, requiredFiles) {
  const startedAt = new Date().toISOString();
  const files = Object.fromEntries(['discovery', 'results', 'options'].map(k => [k, resolve(directory, `${stage}-${k}.json`)]));
  const env = { PERM_RESULTS_FILE: files.results, IDEM_ATTESTATION_FILE: files.options, PERM_FOUNDATION_EVIDENCE_FILE: evidenceFile };
  const discovery = invoke(['node_modules/vitest/vitest.mjs', 'list', '--config', config, '--json=' + files.discovery], env);
  const execution = discovery.status === 0 ? invoke(['node_modules/vitest/vitest.mjs', 'run', '--config', config, '--allowOnly=false', '--retry=0', '--reporter=./scripts/permission-vitest-reporter.mjs'], env) : null;
  const artifacts = Object.fromEntries(Object.entries(files).filter(([, p]) => existsSync(p)).map(([k, p]) => [k, { path: p, sha256: hashFile(p) }]));
  if (discovery.status !== 0 || execution?.status !== 0 || Object.keys(artifacts).length !== 3)
    return { stage, valid: false, errors: ['RUNNER_FAILED'], artifacts, startedAt };
  const read = k => JSON.parse(readFileSync(files[k], 'utf8'));
  return { stage, ...verifySuite(read('discovery'), read('results'), read('options'), requiredFiles, required.filter(c => c.stage === stage)), artifacts, startedAt };
}
const unitProfile = await captureExecutionProfile({ profile: 'candidate', stage: 'foundation-unit', executionKind: 'unit', configId: 'foundation-unit-v1' });
const unit = runSuite('unit', 'vitest.config.ts', ['permissionCatalog.test.ts', 'permissionOverrides.test.ts', 'permissionInputs.test.ts', 'permissionRepos.test.ts', 'architectureBoundaries.test.ts']);
const build = invoke(['node_modules/typescript/bin/tsc', '-b'], {});
const bundle = build.status === 0 ? invoke(['node_modules/vite/bin/vite.js', 'build'], {}) : null;
const database = unit.valid && build.status === 0 && bundle?.status === 0
  ? runSuite('database', 'vitest.permission-foundation.config.ts', ['permissionFoundation.contract.test.ts'])
  : { valid: false, errors: ['EARLIER_STAGE_FAILED'] };
const evidence = existsSync(evidenceFile) ? JSON.parse(readFileSync(evidenceFile, 'utf8')) : null;
const valid = unit.valid && build.status === 0 && bundle?.status === 0 && database.valid
  && evidence?.comparisons === 1280 && evidence.rejectedComparisons === 9 && evidence.reverted === true
  && evidence.sourceFingerprint === sourceFingerprint && evidence.sourceAfter === sourceFingerprint
  && permissionFingerprint() === sourceFingerprint;
const report = { schemaVersion: 1, runId, sourceFingerprint, finishedAt: new Date().toISOString(), valid,
  unit, database, build: { typecheckExitCode: build.status, bundleExitCode: bundle?.status ?? null },
  runtime: { node: process.version, dependencies, packageLockHash: hashFile('package-lock.json'), pnpmLockHash: hashFile('pnpm-lock.yaml') },
  evidence: evidence ? { path: evidenceFile, sha256: hashFile(evidenceFile) } : null,
  scope: { TC01: 'candidate core/mock defaults and real SQL catalog parity', TC03: 'pure navigation and mock projections; application UI follows T11-T14',
    TC04: 'core normalization and DTO patch presence; real SQL parity; server mutation composition follows T05', TC19: 'pure input validators; UI follows T12',
    TC57: 'candidate core/domain/ports import boundary; full consumer cleanup follows T13/T15', activation: 'NOT_RUN', rollout: 'NOT_RUN', Realtime: 'NOT_RUN', Storage: 'NOT_RUN' } };
function writeExecution(stage, suite, profile) {
  const artifactPaths = Object.fromEntries(Object.entries(suite.artifacts).map(([name, value]) => [name, value.path]));
  const attestationPath = resolve(directory, `${stage}-profile-attestation.json`);
  emitExecutionAttestation({ runId: `${runId}:${stage}`, sourceFingerprint, executionProfile: profile, startedAt: suite.startedAt,
    finishedAt: report.finishedAt, artifactPaths, outputPath: attestationPath });
  const executionReport = { schemaVersion: 'permission-execution-report-v1', runId: `${runId}:${stage}`, sourceFingerprint,
    sourceSnapshot: { kind: 'permissionFingerprint', value: sourceFingerprint }, profile: profile.profile, stage,
    executionKind: profile.executionKind, runner: 'vitest', exitCode: 0, valid: true, artifacts: suite.artifacts,
    attestation: { path: attestationPath, sha256: hashFile(attestationPath) } };
  writeFileSync(resolve(directory, `${stage}-execution-report.json`), JSON.stringify(executionReport, null, 2) + '\n');
}
if (valid) {
  writeExecution('foundation-unit', unit, unitProfile);
  writeExecution('foundation-database', database, evidence.executionProfile);
}
writeFileSync(resolve(directory, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ valid, directory, sourceFingerprint, unit: unit.executedCount, database: database.executedCount,
  sqlComparisons: evidence?.comparisons, errors: [...(unit.errors ?? []), ...(database.errors ?? [])], build: report.build }));
process.exitCode = valid ? 0 : 1;
