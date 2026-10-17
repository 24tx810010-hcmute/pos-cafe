// Pure serializer only. The caller must supply results from a real, bound run.
// This module does not execute tests, inspect the environment or publish output.
import { ci1TrustedRepository } from './permission-ci1-policy.mjs';
const INVALID = 'CI1_EVIDENCE_INVALID';
const MAX_OUTPUT_BYTES = 1024 * 1024;
const STATUSES = ['PASS', 'FAIL', 'ERROR', 'NOT_RUN'];
const CHECKS = ['bootstrap', 'auth', 'apiBinding', 'sourcePreservation', 'cleanup'];
const SUITES = [
  { id: 'T09', commandId: 'T09_STORAGE_EDGE', required: 1 },
  { id: 'T10', commandId: 'T10_REALTIME', required: 3 },
];

const reject = () => { throw new Error(INVALID); };

function record(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) reject();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) reject();
  const names = Reflect.ownKeys(value);
  if (names.length !== keys.length || names.some(key => !keys.includes(key))) reject();
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) reject();
    result[key] = descriptor.value;
  }
  return result;
}

function text(value, pattern) {
  if (typeof value !== 'string' || value.length > 128 || /[^\x20-\x7e]/.test(value) || !pattern.test(value)) reject();
  return value;
}

function timestamp(value) {
  text(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) reject();
  return value;
}

function status(value) {
  if (!STATUSES.includes(value)) reject();
  return value;
}

function suite(value, expected) {
  const input = record(value, ['id', 'status', 'exitCode', 'counts']);
  if (input.id !== expected.id) reject();
  status(input.status);
  const exitCode = input.exitCode;
  if (exitCode !== null && (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255)) reject();
  let counts = null;
  if (input.status === 'ERROR' || input.status === 'NOT_RUN') {
    // A parsing/launch error must not invent zero or passing test counts.
    if (input.counts !== null || (input.status === 'NOT_RUN' && exitCode !== null)) reject();
  } else {
    if (exitCode === null) reject();
    const supplied = record(input.counts, ['required', 'run', 'pass', 'fail', 'skip']);
    for (const key of ['required', 'run', 'pass', 'fail', 'skip']) {
      if (!Number.isInteger(supplied[key]) || supplied[key] < 0 || supplied[key] > expected.required) reject();
    }
    if (supplied.required !== expected.required || supplied.run !== supplied.pass + supplied.fail
      || supplied.run + supplied.skip > expected.required) reject();
    const passed = exitCode === 0 && supplied.pass === expected.required
      && supplied.run === expected.required && supplied.fail === 0 && supplied.skip === 0;
    if ((input.status === 'PASS') !== passed) reject();
    counts = { required: supplied.required, run: supplied.run, pass: supplied.pass, fail: supplied.fail, skip: supplied.skip };
  }
  return { id: expected.id, commandId: expected.commandId, status: input.status, exitCode, counts };
}

function build(input) {
  const data = record(input, ['repository', 'runId', 'attempt', 'workflowSHA', 'sourceSHA', 'sourceFingerprint',
    'lockSHA', 'versions', 'startedAt', 'finishedAt', 'checks', 'suites']);
  if (!ci1TrustedRepository(data.repository)) reject();
  const runId = text(data.runId, /^[1-9]\d{0,19}$/);
  if (!Number.isSafeInteger(data.attempt) || data.attempt < 1 || data.attempt > 1000) reject();
  const workflowSHA = text(data.workflowSHA, /^[a-f0-9]{40}$/);
  const sourceSHA = text(data.sourceSHA, /^[a-f0-9]{40}$/);
  const sourceFingerprint = text(data.sourceFingerprint, /^[a-f0-9]{64}$/);
  const lockSHA = text(data.lockSHA, /^[a-f0-9]{64}$/);
  const suppliedVersions = record(data.versions, ['node', 'npm', 'supabase']);
  const versions = {};
  const versionPattern = /^(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})$/;
  for (const key of ['node', 'npm', 'supabase']) versions[key] = text(suppliedVersions[key], versionPattern);
  const startedAt = timestamp(data.startedAt);
  const finishedAt = timestamp(data.finishedAt);
  if (finishedAt < startedAt) reject();
  const suppliedChecks = record(data.checks, CHECKS);
  const checks = {};
  for (const key of CHECKS) checks[key] = status(suppliedChecks[key]);
  if (!Array.isArray(data.suites) || data.suites.length !== SUITES.length) reject();
  const suiteKeys = Reflect.ownKeys(data.suites);
  if (suiteKeys.length !== 3 || suiteKeys.some(key => !['0', '1', 'length'].includes(key))) reject();
  const suites = SUITES.map((expected, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(data.suites, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) reject();
    return suite(descriptor.value, expected);
  });
  if (['bootstrap', 'auth', 'apiBinding'].some(key => checks[key] !== 'PASS')
    && suites.some(item => item.status !== 'NOT_RUN')) reject();
  const allStatuses = [...Object.values(checks), ...suites.map(item => item.status)];
  const overallStatus = ['ERROR', 'FAIL', 'NOT_RUN'].find(value => allStatuses.includes(value)) ?? 'PASS';
  const totals = { required: 4, run: null, pass: null, fail: null, skip: null };
  if (suites.every(item => item.counts !== null)) {
    for (const key of ['run', 'pass', 'fail', 'skip']) totals[key] = suites.reduce((sum, item) => sum + item.counts[key], 0);
  }
  return {
    schemaVersion: 'permission-ci1-public-evidence-v1', verificationScope: 'CI1_PILOT_ONLY',
    repository: data.repository, runId, attempt: data.attempt,
    runURL: `https://github.com/${data.repository}/actions/runs/${runId}/attempts/${data.attempt}`,
    workflowSHA, sourceSHA, sourceFingerprint, lockSHA, versions, startedAt, finishedAt,
    checks, suites, totals, overallStatus,
  };
}

function markdown(evidence) {
  const count = value => value === null ? 'UNKNOWN' : String(value);
  return [
    '# CI-1 pilot evidence',
    '',
    `Status: **${evidence.overallStatus}**. Scope: CI1_PILOT_ONLY.`,
    'This serializer does not execute tests or certify a deployment.',
    '',
    `Run: ${evidence.runURL}`,
    `Workflow SHA: ${evidence.workflowSHA}`,
    `Source SHA: ${evidence.sourceSHA}`,
    `Source fingerprint: ${evidence.sourceFingerprint}`,
    `Lock SHA: ${evidence.lockSHA}`,
    `Versions: Node ${evidence.versions.node}; npm ${evidence.versions.npm}; Supabase CLI ${evidence.versions.supabase}`,
    `UTC: ${evidence.startedAt} to ${evidence.finishedAt}`,
    '',
    '| Check | Status |',
    '| --- | --- |',
    ...CHECKS.map(key => `| ${key} | ${evidence.checks[key]} |`),
    '',
    '| Suite / command ID | Status | Exit | Required | Run | Pass | Fail | Skip |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...evidence.suites.map(item => `| ${item.id} / ${item.commandId} | ${item.status} | ${count(item.exitCode)} | ${SUITES.find(s => s.id === item.id).required} | ${count(item.counts?.run ?? null)} | ${count(item.counts?.pass ?? null)} | ${count(item.counts?.fail ?? null)} | ${count(item.counts?.skip ?? null)} |`),
    `| TOTAL | ${evidence.overallStatus} | - | 4 | ${count(evidence.totals.run)} | ${count(evidence.totals.pass)} | ${count(evidence.totals.fail)} | ${count(evidence.totals.skip)} |`,
    '',
    'Command IDs are fixed labels; invocation and backend binding must be verified by the caller.',
    '',
  ].join('\n');
}

/** Returns safe JSON/Markdown strings. Invalid input throws a fixed, non-reflecting error. */
export function renderCi1Evidence(input) {
  try {
    const evidence = build(input);
    const json = `${JSON.stringify(evidence, null, 2)}\n`;
    const summary = markdown(evidence);
    if (Buffer.byteLength(json, 'utf8') + Buffer.byteLength(summary, 'utf8') > MAX_OUTPUT_BYTES) reject();
    return { json, markdown: summary };
  } catch {
    throw new Error(INVALID);
  }
}
