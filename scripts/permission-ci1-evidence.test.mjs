import assert from 'node:assert/strict';
import test from 'node:test';
import { renderCi1Evidence } from './permission-ci1-evidence.mjs';

// Unit-only invented data; never an actual CI/backend result or saved pilot receipt.
function fixture() {
  return {
    repository: 'nguyentronglinh045/pos-cafe-ci-preflight', runId: '12345', attempt: 1,
    workflowSHA: '1'.repeat(40), sourceSHA: '2'.repeat(40), sourceFingerprint: '3'.repeat(64), lockSHA: '4'.repeat(64),
    versions: { node: '24.16.0', npm: '11.13.0', supabase: '2.117.0' },
    startedAt: '2026-10-15T10:00:00.000Z', finishedAt: '2026-10-15T10:00:01.000Z',
    checks: { bootstrap: 'PASS', auth: 'PASS', apiBinding: 'PASS', sourcePreservation: 'PASS', cleanup: 'PASS' },
    suites: [
      { id: 'T09', status: 'PASS', exitCode: 0, counts: { required: 1, run: 1, pass: 1, fail: 0, skip: 0 } },
      { id: 'T10', status: 'PASS', exitCode: 0, counts: { required: 3, run: 3, pass: 3, fail: 0, skip: 0 } },
    ],
  };
}

function invalid(input) {
  assert.throws(() => renderCi1Evidence(input), error => {
    assert.equal(error.message, 'CI1_EVIDENCE_INVALID');
    assert.equal(error.cause, undefined);
    assert.deepEqual(Object.keys(error), []);
    return true;
  });
}

test('valid unit data yields consistent JSON, summary and source/run identity without mutation', () => {
  const input = fixture();
  const original = structuredClone(input);
  const output = renderCi1Evidence(input);
  const parsed = JSON.parse(output.json);
  assert.equal(parsed.overallStatus, 'PASS');
  assert.equal(parsed.verificationScope, 'CI1_PILOT_ONLY');
  assert.deepEqual(parsed.totals, { required: 4, run: 4, pass: 4, fail: 0, skip: 0 });
  assert.equal(parsed.sourceFingerprint, input.sourceFingerprint);
  assert.equal(parsed.lockSHA, input.lockSHA);
  assert.equal(parsed.runURL, 'https://github.com/nguyentronglinh045/pos-cafe-ci-preflight/actions/runs/12345/attempts/1');
  assert.match(output.markdown, /T09_STORAGE_EDGE/);
  assert.match(output.markdown, /T10_REALTIME/);
  assert.match(output.markdown, /\| TOTAL \| PASS \| - \| 4 \| 4 \| 4 \| 0 \| 0 \|/);
  assert.match(output.markdown, /does not execute tests/);
  assert.ok(Buffer.byteLength(output.json) + Buffer.byteLength(output.markdown) < 1024 * 1024);
  assert.deepEqual(input, original);
  assert.deepEqual(renderCi1Evidence(input), output);
});

test('required check failures and test failures never become PASS', () => {
  for (const check of ['sourcePreservation', 'cleanup']) {
    for (const state of ['FAIL', 'ERROR', 'NOT_RUN']) {
      const input = fixture();
      input.checks[check] = state;
      assert.equal(JSON.parse(renderCi1Evidence(input).json).overallStatus, state);
    }
  }
  const failed = fixture();
  failed.suites[1] = { id: 'T10', status: 'FAIL', exitCode: 1, counts: { required: 3, run: 3, pass: 2, fail: 1, skip: 0 } };
  const parsed = JSON.parse(renderCi1Evidence(failed).json);
  assert.equal(parsed.overallStatus, 'FAIL');
  assert.deepEqual(parsed.totals, { required: 4, run: 4, pass: 3, fail: 1, skip: 0 });
  // Hooks/process failure can fail a suite even when its cases passed.
  failed.suites[1].counts = { required: 3, run: 3, pass: 3, fail: 0, skip: 0 };
  assert.equal(JSON.parse(renderCi1Evidence(failed).json).overallStatus, 'FAIL');
});

test('skip or missing required cases cannot be labelled PASS even with exit zero', () => {
  for (const counts of [
    { required: 3, run: 2, pass: 2, fail: 0, skip: 1 },
    { required: 3, run: 2, pass: 2, fail: 0, skip: 0 },
  ]) {
    const input = fixture();
    input.suites[1] = { id: 'T10', status: 'FAIL', exitCode: 0, counts };
    assert.equal(JSON.parse(renderCi1Evidence(input).json).overallStatus, 'FAIL');
    input.suites[1].status = 'PASS';
    invalid(input);
  }
});

test('unknown counts stay unknown on ERROR/NOT_RUN and failed prerequisites prevent execution claims', () => {
  for (const state of ['ERROR', 'NOT_RUN']) {
    const input = fixture();
    input.suites[1] = { id: 'T10', status: state, exitCode: state === 'ERROR' ? 0 : null, counts: null };
    const output = renderCi1Evidence(input);
    const parsed = JSON.parse(output.json);
    assert.equal(parsed.overallStatus, state);
    assert.deepEqual(parsed.totals, { required: 4, run: null, pass: null, fail: null, skip: null });
    assert.match(output.markdown, /UNKNOWN/);
    input.suites[1].counts = { required: 3, run: 0, pass: 0, fail: 0, skip: 0 };
    invalid(input);
  }
  for (const check of ['bootstrap', 'auth', 'apiBinding']) {
    const input = fixture();
    input.checks[check] = 'FAIL';
    invalid(input);
    input.suites = ['T09', 'T10'].map(id => ({ id, status: 'NOT_RUN', exitCode: null, counts: null }));
    assert.equal(JSON.parse(renderCi1Evidence(input).json).overallStatus, 'FAIL');
  }
});

test('rejects inconsistent identity, timestamps, counts and suite shapes', () => {
  const changes = [
    input => { input.sourceSHA = 'A'.repeat(40); },
    input => { input.sourceSHA += '\n'; },
    input => { input.sourceSHA += '\u2028'; },
    input => { input.sourceSHA += '\u2029'; },
    input => { input.sourceFingerprint = '3'.repeat(63); },
    input => { input.lockSHA = 'not-a-hash'; },
    input => { input.runId = '0'; },
    input => { input.attempt = 0; },
    input => { input.versions.node = 'v24.16.0'; },
    input => { input.versions.npm += '\r\n'; },
    input => { input.startedAt = '2026-02-30T10:00:00.000Z'; },
    input => { input.finishedAt = '2026-10-15T09:59:59.000Z'; },
    input => { input.suites.reverse(); },
    input => { input.suites.push(input.suites[1]); },
    input => { input.suites[1].counts.required = 2; },
    input => { input.suites[1].counts.pass = 2; },
    input => { input.suites[1].counts.skip = 1; },
    input => { input.suites[1].counts.run = 3.1; },
    input => { input.suites[1].exitCode = null; },
    input => { input.suites[1].exitCode = 256; },
    input => { input.suites[1].status = 'FAIL'; },
    input => { input.checks.cleanup = 'SKIP'; },
  ];
  for (const change of changes) { const input = fixture(); change(input); invalid(input); }
});

test('rejects raw/free-text fields and credential-shaped values without reflecting input', () => {
  const fakeSecret = 'FAKE_UNIT_ONLY_SECRET_do_not_publish';
  for (const container of [input => input, input => input.versions, input => input.checks,
    input => input.suites[0], input => input.suites[0].counts]) {
    const input = fixture();
    container(input).raw = fakeSecret;
    invalid(input);
  }
  for (const field of ['repository', 'runId', 'workflowSHA', 'sourceSHA', 'sourceFingerprint', 'lockSHA', 'startedAt', 'finishedAt']) {
    const input = fixture(); input[field] = `${fakeSecret}\n::warning::injected`; invalid(input);
  }
  const version = fixture(); version.versions.supabase = 'eyJhbGciOiJIUzI1NiJ9.FAKE_TOKEN.FAKE_SIGNATURE'; invalid(version);
  const long = fixture(); long.sourceSHA = fakeSecret.repeat(50_000); invalid(long);
  const accessor = fixture();
  let reads = 0;
  Object.defineProperty(accessor, 'lockSHA', { get() { reads += 1; throw new Error(fakeSecret); } });
  invalid(accessor);
  assert.equal(reads, 0);
  const symbol = fixture(); symbol[Symbol(fakeSecret)] = fakeSecret; invalid(symbol);
  const arrayExtra = fixture(); arrayExtra.suites.raw = fakeSecret; invalid(arrayExtra);
  const arrayAccessor = fixture();
  Object.defineProperty(arrayAccessor.suites, '0', { get() { reads += 1; throw new Error(fakeSecret); } });
  invalid(arrayAccessor);
  assert.equal(reads, 0);
  const inherited = Object.assign(Object.create({ raw: fakeSecret }), fixture()); invalid(inherited);
  const proxy = new Proxy({}, { getPrototypeOf() { throw new Error(fakeSecret); } }); invalid(proxy);
});
