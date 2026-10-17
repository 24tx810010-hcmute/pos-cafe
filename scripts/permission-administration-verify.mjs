import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifySuite } from './permission-verify.mjs';
import { permissionFingerprint } from './permission-preflight-core.mjs';
import { hashFile } from './idempotency-artifacts.mjs';

const sourceFingerprint = permissionFingerprint(), runId = randomUUID();
const directory = resolve('artifacts/permissions/t05', runId);
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
const required = JSON.parse(readFileSync('tests/permissions/permissionAdministrationCases.json', 'utf8'));
const evidenceFile = resolve(directory, 'database-evidence.json');
const invoke = (args, env) => spawnSync(process.execPath, args, { env: { ...process.env, NO_COLOR: '1', ...env }, encoding: 'utf8', timeout: 240000, maxBuffer: 12 * 1024 * 1024 });
function runSuite(stage, config, requiredFiles) {
  const files = Object.fromEntries(['discovery', 'results', 'options'].map(k => [k, resolve(directory, `${stage}-${k}.json`)]));
  const env = { PERM_RESULTS_FILE: files.results, IDEM_ATTESTATION_FILE: files.options, PERM_ADMIN_EVIDENCE_FILE: evidenceFile };
  const discovery = invoke(['node_modules/vitest/vitest.mjs', 'list', '--config', config, '--json=' + files.discovery], env);
  const execution = discovery.status === 0 ? invoke(['node_modules/vitest/vitest.mjs', 'run', '--config', config, '--allowOnly=false', '--retry=0', '--reporter=./scripts/permission-vitest-reporter.mjs'], env) : null;
  const artifacts = Object.fromEntries(Object.entries(files).filter(([, p]) => existsSync(p)).map(([k, p]) => [k, { path: p, sha256: hashFile(p) }]));
  if (discovery.status !== 0 || execution?.status !== 0 || Object.keys(artifacts).length !== 3)
    return { stage, valid: false, errors: ['RUNNER_FAILED'], artifacts };
  const read = k => JSON.parse(readFileSync(files[k], 'utf8'));
  return { stage, ...verifySuite(read('discovery'), read('results'), read('options'), requiredFiles, required.filter(c => c.stage === stage)), artifacts };
}
const unit = runSuite('unit', 'vitest.config.ts', ['adapters/mock/permissionAdminRepo.test.ts', 'adapters/supabase/permissionAdminRepo.test.ts', 'architectureBoundaries.test.ts']);
const build = invoke(['node_modules/typescript/bin/tsc', '-b'], {});
const bundle = build.status === 0 ? invoke(['node_modules/vite/bin/vite.js', 'build'], {}) : null;
const database = unit.valid && build.status === 0 && bundle?.status === 0
  ? runSuite('database', 'vitest.permission-administration.config.ts', ['permissionAdministration.contract.test.ts'])
  : { valid: false, errors: ['EARLIER_STAGE_FAILED'] };
const evidence = existsSync(evidenceFile) ? JSON.parse(readFileSync(evidenceFile, 'utf8')) : null;
const valid = unit.valid && build.status === 0 && bundle?.status === 0 && database.valid
  && evidence?.fixtureEvidence?.businessUnchanged === true && evidence.fixtureEvidence.reverted === true
  && evidence.fixtureEvidence.adminAclNegativeControl === true
  && evidence.controls?.canonicalJsonKeyOrder === true && evidence.controls.explicitNullDistinct === true
  && evidence.controls.privateMacOnly === true && evidence.controls.resetStartBarriers === true
  && evidence.controls.rotatedMacReplay === true && evidence.controls.auditCurrentPermission === true
  && evidence.controls.auditTimestampTie === true && evidence.controls.auditUnavailableMapping === true
  && evidence.controls.expiredAtCatalogCheckpoint === true && evidence.controls.lostActionAtMutex === true
  && typeof evidence.controls.concurrencyBarrier === 'string'
  && evidence.sourceFingerprint === sourceFingerprint && evidence.sourceAfter === sourceFingerprint
  && permissionFingerprint() === sourceFingerprint;
const report = { schemaVersion: 1, runId, sourceFingerprint, finishedAt: new Date().toISOString(), valid,
  unit, database, build: { typecheckExitCode: build.status, bundleExitCode: bundle?.status ?? null },
  runtime: { node: process.version, dependencies, packageLockHash: hashFile('package-lock.json'), pnpmLockHash: hashFile('pnpm-lock.yaml') },
  evidence: evidence ? { path: evidenceFile, sha256: hashFile(evidenceFile) } : null,
  scope: { TC05_09_14_24: 'Candidate administration RPC, field authority, before/after ceiling, OCC/catalog, retry and committed audit; UI T12 remains pending',
    TC18_24: 'Fragment revokes legacy employee endpoints and table/column access; audit read guard and retention, clear-demo integration T08 pending',
    TC42_43: 'Real transaction barriers for opposite administrators/catalog writer and session issuance/PIN reset in both orders',
    audit: 'No audit screen; owner or employee.permission.edit reads all same-store rows without target ceiling',
    UI: 'NOT_ACTIVATED', activation: 'NOT_RUN', rollout: 'NOT_RUN', Realtime: 'NOT_RUN', Storage: 'NOT_RUN' } };
writeFileSync(resolve(directory, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ valid, directory, sourceFingerprint, unit: unit.executedCount, database: database.executedCount,
  businessUnchanged: evidence?.fixtureEvidence?.businessUnchanged, errors: [...(unit.errors ?? []), ...(database.errors ?? [])], build: report.build }));
process.exitCode = valid ? 0 : 1;
