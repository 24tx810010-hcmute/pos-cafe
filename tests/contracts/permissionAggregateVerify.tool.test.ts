import { describe, expect, it } from 'vitest';
import { verifyAggregate } from '../../scripts/permission-aggregate-verify.mjs';
import aggregateManifest from '../permissions/permissionAggregateCases.json';
import { digest } from '../../scripts/permission-preflight-core.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const test = { file: 'package.json', name: 'TC01 sample' };
const discovery = () => [{ name: test.name, file: test.file }];
const report = (status = 'passed') => ({ success: status === 'passed', testResults: [{ name: test.file, assertionResults: [{ fullName: test.name, status }] }] });
const options = (retry = 0) => ({ runner: 'vitest-actual-options-v1', reason: 'passed', errorCount: 0,
  tests: [{ ...test, state: 'passed', options: { fails: false, retry, repeats: 0, mode: 'run' } }] });
const manifest = () => ({ schemaVersion: 1, cases: Array.from({ length: 60 }, (_, index) => {
  const id = `TC${String(index + 1).padStart(2, '0')}`;
  return [48, 51, 52, 53, 54].includes(index + 1) ? { id, profile: 'transition', status: 'PENDING_T16', sourceHints: ['package.json'], variants: [] }
    : { id, profile: index + 1 === 49 ? 'legacy' : index + 1 === 50 ? 'bridge' : 'candidate', status: 'REQUIRED', sourceHints: ['package.json'], variants: [{ ...test, stage: index === 0 ? 'candidate-unit' : `stage-${id}`, runner: 'vitest', ...(index === 1 ? { profile: 'bridge' } : {}) }] };
} ) });
const executions = (retry = 0) => ({ runs: manifest().cases.filter(item => item.status === 'REQUIRED').map(item => {
  const runProfile=item.variants[0].profile??item.profile;
  const stage=item.variants[0].stage, kind=stage.endsWith('-unit')?'unit':stage.endsWith('-tools')?'static':'service';
  const serviceBinding = kind === 'service' ? { profile: runProfile, executionKind: kind, stage,
    configId: `${runProfile}-v1`, backend: { reference: 'isolated-1', host: '127.0.0.1', port: 54321, database: 'pos_cafe_test', engine: 'postgresql-17' }, fixtureIds: ['fixture-1'],
    markerProof: 'b'.repeat(64), catalogHash: 'c'.repeat(64), schemaHash:'d'.repeat(64), appliedArtifacts:[{id:stage,hash:'e'.repeat(64)}],
    apiBinding: runProfile === 'legacy' ? 'OBSERVER_ONLY' : { projectRef: 'local-test', baseUrl:'http://127.0.0.1:54321' } }
    : { profile:runProfile,executionKind:kind,stage,configId:`${runProfile}-${kind}-v1`,backend:{applicable:false} };
  const artifacts = { discovery: discovery(), results: report(), options: options(retry) };
  return { id: `run-${item.id}`, profile: runProfile, stage, runner: 'vitest', exitCode: 0,
    sourceFingerprint: 'a'.repeat(64), serviceBinding, ...artifacts, profileAttestation: { runner: 'permission-execution-profile-v1',
      sourceFingerprint: 'a'.repeat(64), executionProfile: serviceBinding, startedAt: '2026-09-17T00:00:00Z', finishedAt: '2026-09-17T00:00:01Z',
      artifactHashes: { discovery: digest(artifacts.discovery), results: digest(artifacts.results), options: digest(artifacts.options) } } };
}) });

function actualPlaywrightReports(testRetries = 0) {
  const directory = mkdtempSync(join(process.cwd(), '.aggregate-playwright-'));
  const modulePath = resolve('node_modules/@playwright/test').replaceAll('\\', '/');
  const cli = resolve('node_modules/@playwright/test/cli.js');
  const config = join(directory, 'playwright.config.cjs');
  const attestation = join(directory, 'options.json');
  const reporter = resolve('scripts/permission-playwright-options-reporter.mjs');
  writeFileSync(config, `const { defineConfig } = require('${modulePath}'); module.exports = defineConfig({ testDir: '.', projects: [{ name: 'alpha', retries: 0, repeatEach: 1 }, { name: 'beta', retries: 0, repeatEach: 1 }] });`);
  writeFileSync(join(directory, 'sample.spec.cjs'), `const { test, expect } = require('${modulePath}'); test.describe.configure({ retries: ${testRetries} }); test('TC01 sample', () => expect(2 + 2).toBe(4));`);
  const read = (extra: string[], attest = false) => {
    const reporters = attest ? `json,${reporter}` : 'json';
    try { return JSON.parse(execFileSync(process.execPath, [cli, 'test', '--config', config, ...extra, `--reporter=${reporters}`], { encoding: 'utf8', env: { ...process.env, PERM_PLAYWRIGHT_OPTIONS_FILE: attestation } })); }
    catch (error: any) { throw new Error(`${error?.stdout ?? ''}\n${error?.stderr ?? ''}`); }
  };
  try { const discovery=read(['--list']); const results=read([],true); return { discovery, results, options: JSON.parse(readFileSync(attestation,'utf8')), cleanup: () => rmSync(directory, { recursive: true, force: true }) }; }
  catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
}

describe('permission aggregate verifier', () => {
  it('ships all 60 cases and confines any remaining pending cases to the T16 transition set', () => {
    expect(aggregateManifest.cases.map(item => item.id)).toEqual(Array.from({ length: 60 }, (_, n) => `TC${String(n + 1).padStart(2, '0')}`));
    for (const item of aggregateManifest.cases) {
      expect(['REQUIRED', 'PENDING_T16']).toContain(item.status);
      if (item.status === 'PENDING_T16') expect(['TC48', 'TC51', 'TC52', 'TC53', 'TC54']).toContain(item.id);
      else expect(item.variants.length).toBeGreaterThan(0);
    }
    expect(aggregateManifest.cases.find(item => item.id === 'TC49')?.profile).toBe('legacy');
    expect(aggregateManifest.cases.find(item => item.id === 'TC50')?.profile).toBe('bridge');
  });
  it('accepts only the five T16 pendings in T15 mode', () => {
    expect(verifyAggregate(manifest(), executions(), { mode: 't15', sourceFingerprint: 'a'.repeat(64) })).toMatchObject({ valid: true, checkedCases: 60 });
  });
  it('rejects pending cases in full mode', () => {
    expect(verifyAggregate(manifest(), executions(), { mode: 'full', sourceFingerprint: 'a'.repeat(64) }).errors).toContain('PENDING_IN_FULL_MODE:TC48');
  });
  it('rejects an unknown mode instead of treating it like T15', () => {
    expect(verifyAggregate(manifest(), executions(), { mode: 'ful1', sourceFingerprint: 'a'.repeat(64) }).errors).toContain('INVALID_MODE');
  });
  it('rejects retry and source drift rather than accepting a green report', () => {
    const retryResult = verifyAggregate(manifest(), executions(1), { mode: 't15', sourceFingerprint: 'a'.repeat(64) });
    expect(retryResult.valid).toBe(false);
    const drift = executions(); drift.runs[0].sourceFingerprint = 'b'.repeat(64);
    expect(verifyAggregate(manifest(), drift, { mode: 't15', sourceFingerprint: 'a'.repeat(64) }).errors.some(error => error.startsWith('SOURCE_DRIFT:'))).toBe(true);
  });
  it('rejects undeclared gaps, wrong profiles and mixed candidate backends', () => {
    const m = manifest(); m.cases[0].missingVariants = ['ui']; m.cases[2].profile = 'legacy';
    const e = executions(); e.runs[3].serviceBinding.backend.reference = 'isolated-2';
    const result = verifyAggregate(m, e, { mode: 't15', sourceFingerprint: 'a'.repeat(64) });
    expect(result.errors).toContain('DECLARED_GAP:TC01:ui');
    expect(result.errors.some(error => error.startsWith('MISSING_OR_DUPLICATE_RUN:TC03'))).toBe(true);
    expect(result.errors).toContain('CANDIDATE_BACKEND_MIXED');
  });
  it('rejects runner substitution, nonzero exit and opaque service claims', () => {
    const e = executions(); e.runs[0].runner = 'playwright'; e.runs[0].exitCode = 7; e.runs[0].discovery = [] as never; delete e.runs[0].options;
    e.runs[0].results = { config: { retries: 9, repeatEach: 3 }, errors: [{ message: 'global setup failed' }], stats: { unexpected: 1, flaky: 0, skipped: 0 },
      suites: [{ file: 'package.json', specs: [{ file: 'package.json', title: 'TC01 sample', tests: [{ expectedStatus: 'passed', results: [{ status: 'passed', retry: 5 }] }] }] }] } as never;
    e.runs[0].serviceBinding = { profile: 'candidate', backendRef: 'not-a-proof', marker: 'not-a-proof' } as never;
    const errors = verifyAggregate(manifest(), e, { mode: 't15', sourceFingerprint: 'a'.repeat(64) }).errors;
    expect(errors.some(error => error.startsWith('RUNNER_OR_EXIT_MISMATCH:TC01'))).toBe(true);
    expect(errors.some(error => error.startsWith('SERVICE_BINDING_INVALID:TC01'))).toBe(true);
    expect(errors.some(error => error.includes('PROFILE_ATTESTATION_INVALID'))).toBe(true);
    expect(errors.some(error => error.includes('PLAYWRIGHT_OPTIONS_NOT_ATTESTED'))).toBe(true);
    expect(errors.some(error => error.includes('PLAYWRIGHT_DISCOVERY_RESULT_MISSING'))).toBe(true);
    expect(errors.some(error => error.includes('PLAYWRIGHT_GLOBAL_STATUS_INVALID'))).toBe(true);
    expect(errors.some(error => error.includes('PLAYWRIGHT_ATTEMPT_INVALID'))).toBe(true);
  });
  it('accepts the installed Playwright JSON reporter shape and binds a variant to one project', () => {
    const actual = actualPlaywrightReports();
    try {
      const m = manifest();
      m.cases[0].variants[0] = { ...m.cases[0].variants[0], runner: 'playwright', file: resolve(actual.results.config.rootDir, 'sample.spec.cjs'), project: 'alpha' };
      const e = executions();
      const run = e.runs[0];
      run.runner = 'playwright';
      run.discovery = actual.discovery;
      run.results = actual.results;
      run.options = actual.options as never;
      run.profileAttestation.artifactHashes = { discovery: digest(run.discovery), results: digest(run.results), options: digest(run.options) };
      expect(verifyAggregate(m, e, { mode: 't15', sourceFingerprint: 'a'.repeat(64) })).toMatchObject({ valid: true, errors: [] });
    } finally { actual.cleanup(); }
  });
  it('rejects a real Playwright per-test retry override even when its first attempt passes', () => {
    const actual = actualPlaywrightReports(1);
    try {
      const m=manifest(); m.cases[0].variants[0]={...m.cases[0].variants[0],runner:'playwright',file:resolve(actual.results.config.rootDir,'sample.spec.cjs'),project:'alpha'};
      const e=executions(),run=e.runs[0]; run.runner='playwright'; run.discovery=actual.discovery; run.results=actual.results; run.options=actual.options as never;
      run.profileAttestation.artifactHashes={discovery:digest(run.discovery),results:digest(run.results),options:digest(run.options)};
      expect(verifyAggregate(m,e,{mode:'t15',sourceFingerprint:'a'.repeat(64)}).errors).toContain('TC01:run-TC01:PLAYWRIGHT_TEST_OPTIONS_INVALID');
    } finally { actual.cleanup(); }
  });
});
