import { createHash } from 'node:crypto';

export const PROJECT_REPOSITORY = '24tx810010-hcmute/pos-cafe';
export const PROJECT_PHASES = Object.freeze(['install', 'build', 'unit', 'tooling', 'node-tools', 'browser', 'smoke-discovery', 'smoke', 'ui-selftest', 'ui-audit']);
export const PROJECTS = Object.freeze(['desktop', 'tablet-landscape', 'phone-landscape', 'small-landscape', 'portrait', 'demo-runbook']);
export const hash = value => createHash('sha256').update(value).digest('hex');
const reject = () => { throw new Error('PROJECT_CI_RESULT_INVALID'); };
const integer = n => Number.isSafeInteger(n) && n >= 0;
const DIAGNOSTIC_CODES = Object.freeze(['COMMAND_FAILED', 'VITEST_ASSERTION', 'VITEST_RUNTIME', 'REPORT_MISSING',
  'TEST_TIMEOUT', 'ASSERTION_ERROR', 'TYPE_ERROR', 'REFERENCE_ERROR', 'MODULE_NOT_FOUND', 'OUT_OF_MEMORY', 'COVERAGE_LINES']);

export function privateDiagnostics(output, report, expectedFiles = [], root = '') {
  const codes = ['COMMAND_FAILED'];
  const metrics = {};
  for (const [key, value] of Object.entries(report ?? {})) if (['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numRuntimeErrorTestSuites'].includes(key) && integer(value)) metrics[key] = value;
  if (!report) codes.push('REPORT_MISSING');
  if (metrics.numFailedTests > 0) codes.push('VITEST_ASSERTION');
  if (metrics.numRuntimeErrorTestSuites > 0) codes.push('VITEST_RUNTIME');
  const privateText = output + '\n' + JSON.stringify(report ?? {});
  for (const [code, pattern] of Object.entries({ TEST_TIMEOUT: /timed?\s*out|test timeout|timeout of/i,
    ASSERTION_ERROR: /AssertionError|expected .{0,100} to /i, TYPE_ERROR: /TypeError/, REFERENCE_ERROR: /ReferenceError/,
    MODULE_NOT_FOUND: /ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|cannot find (?:module|package)/i,
    OUT_OF_MEMORY: /heap out of memory|allocation failed|SIGKILL/i, COVERAGE_LINES: /ERROR: Coverage for lines/i })) {
    if (pattern.test(privateText)) codes.push(code);
  }
  const failedFiles = (report?.testResults ?? []).filter(file => file.status === 'failed').map(file => {
    const path = typeof file.name === 'string' ? file.name.replaceAll('\\', '/').replace(root.replaceAll('\\', '/') + '/', '') : '';
    return expectedFiles.includes(path) && /^(?:src|tests)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|mjs)$/.test(path) ? path : null;
  }).filter(Boolean).slice(0, 32);
  const architecture = (report?.testResults ?? []).find(file => file.name?.replaceAll('\\', '/') === root.replaceAll('\\', '/') + '/src/architectureBoundaries.test.ts');
  if (failedFiles.includes('src/architectureBoundaries.test.ts') && Array.isArray(architecture?.assertionResults)) {
    const index = architecture.assertionResults.findIndex(item => item.status === 'failed');
    if (index >= 0 && index < 5) metrics.architectureAssertion = index + 1;
  }
  return { codes, metrics, failedFiles };
}
const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length
  && [...a].sort().every((value, index) => value === [...b].sort()[index]);

export function sourceBinding(env, event, actualSHA) {
  const hex = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
  if (env.GITHUB_REPOSITORY !== PROJECT_REPOSITORY || !hex(actualSHA) || actualSHA !== env.GITHUB_SHA
    || !hex(env.GITHUB_WORKFLOW_SHA) || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? '')
    || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT ?? '')) reject();
  let prHeadSHA = null;
  if (env.GITHUB_EVENT_NAME === 'push') {
    if (event.after !== actualSHA || event.repository?.full_name !== PROJECT_REPOSITORY) reject();
  } else if (env.GITHUB_EVENT_NAME === 'pull_request') {
    prHeadSHA = event.pull_request?.head?.sha;
    if (!hex(prHeadSHA) || event.pull_request?.merge_commit_sha !== actualSHA
      || event.repository?.full_name !== PROJECT_REPOSITORY) reject();
  } else reject();
  return { repository: PROJECT_REPOSITORY, event: env.GITHUB_EVENT_NAME,
    sourceSHA: actualSHA, prHeadSHA, workflowSHA: env.GITHUB_WORKFLOW_SHA,
    runId: env.GITHUB_RUN_ID, attempt: Number(env.GITHUB_RUN_ATTEMPT) };
}

export function vitestCounts(report, expectedFiles, root) {
  if (!Array.isArray(report.testResults) || !report.testResults.length || !Array.isArray(expectedFiles)) reject();
  const names = report.testResults.map(file => {
    const prefix = root.replaceAll('\\', '/') + '/';
    const name = file.name?.replaceAll('\\', '/');
    if (!name?.startsWith(prefix)) reject();
    return name.slice(prefix.length);
  });
  if (!sameSet(names, expectedFiles)) reject();
  const tests = report.testResults.flatMap(file => {
    if (!Array.isArray(file.assertionResults) || !file.assertionResults.length) reject();
    return file.assertionResults;
  });
  const result = { run: tests.length, pass: 0, fail: 0, skip: 0 };
  for (const test of tests) {
    if (test.status === 'passed') result.pass++;
    else if (test.status === 'failed') result.fail++;
    else if (['pending', 'skipped', 'todo'].includes(test.status)) result.skip++;
    else reject();
  }
  if (report.numTotalTests !== result.run || report.numPassedTests !== result.pass
    || report.numFailedTests !== result.fail || (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0) !== result.skip
    || (report.numRuntimeErrorTestSuites ?? 0) !== 0 || result.skip
    || report.testResults.some(file => file.status !== 'passed') || report.success !== true || result.fail) reject();
  return result;
}

export function nodeCounts(tap) {
  const value = key => {
    const matches = [...tap.matchAll(new RegExp('^# ' + key + ' ([0-9]+)\\r?$', 'gm'))];
    if (!matches.length) reject();
    return Number(matches.at(-1)[1]);
  };
  const result = { run: value('tests'), pass: value('pass'), fail: value('fail'), skip: value('skipped') };
  if (!result.run || result.pass !== result.run || result.fail || result.skip || value('cancelled') || value('todo')) reject();
  return result;
}

export function smokeCases(report) {
  const cases = [];
  function visit(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      const key = `${test.projectName}|${spec.file}|${spec.line}|${spec.title}`;
      cases.push({ key, project: test.projectName, test });
    }
    for (const child of suite.suites ?? []) visit(child);
  }
  if (!Array.isArray(report.suites) || (report.errors?.length ?? 0)) reject();
  for (const suite of report.suites) visit(suite);
  if (!cases.length || new Set(cases.map(item => item.key)).size !== cases.length
    || !sameSet([...new Set(cases.map(item => item.project))], PROJECTS)) reject();
  return cases;
}

export function smokeCounts(report, discovery, allowedSkips) {
  const actual = smokeCases(report), expected = smokeCases(discovery);
  if (!sameSet(actual.map(item => item.key), expected.map(item => item.key))) reject();
  const result = { run: actual.length, pass: 0, fail: 0, skip: 0 }, skipped = [];
  for (const { key, test } of actual) {
    if (!Array.isArray(test.results) || test.results.length !== 1 || (test.results[0].retry ?? 0) !== 0) reject();
    const status = test.results[0].status;
    if (status === 'skipped') { result.skip++; skipped.push(key); }
    else if (status === 'passed' && test.expectedStatus === 'passed' && test.status === 'expected'
      && !(test.results[0].errors?.length)) result.pass++;
    else { result.fail++; }
  }
  if (!sameSet(skipped, allowedSkips) || result.fail || !result.pass
    || report.stats?.expected !== result.pass || report.stats?.skipped !== result.skip
    || report.stats?.unexpected !== 0 || report.stats?.flaky !== 0) reject();
  return result;
}

export function uiCounts(output, findings, config) {
  if (!Array.isArray(findings) || !Array.isArray(config.states) || !config.states.length
    || !Array.isArray(config.viewports) || !config.viewports.length || !output.includes('no new UI anomalies')
    || output.includes('SETUP-FAIL')) reject();
  // Match the runner's one completion line for every concrete target/viewport.
  for (const target of config.states) for (const viewport of config.viewports) {
    const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('^\\s*ok\\s+' + escape(viewport.name) + '\\s+' + escape(target.name) + '\\s+', 'gm');
    if ([...output.matchAll(pattern)].length !== 1) reject();
  }
  if (findings.some(item => !item.known)) reject();
  return { run: config.states.length * config.viewports.length, pass: config.states.length * config.viewports.length,
    fail: 0, skip: 0, acceptedFindings: findings.length };
}

export function publicSummary(binding, rows, fingerprints) {
  if (binding.repository !== PROJECT_REPOSITORY || !['push', 'pull_request'].includes(binding.event)
    || !/^[a-f0-9]{40}$/.test(binding.sourceSHA) || !/^[a-f0-9]{40}$/.test(binding.workflowSHA)
    || !(binding.prHeadSHA === null || /^[a-f0-9]{40}$/.test(binding.prHeadSHA))
    || !/^[1-9][0-9]*$/.test(binding.runId) || !Number.isSafeInteger(binding.attempt) || binding.attempt < 1) reject();
  if (!rows.length || rows.length > PROJECT_PHASES.length || rows.some((row, index) => row.id !== PROJECT_PHASES[index]
    || !['PASS', 'FAIL', 'ERROR'].includes(row.status) || !integer(row.elapsedMs)
    || !(row.exitCode === null || integer(row.exitCode)) || !/^[a-f0-9]{64}$/.test(row.invocationSHA)
    || !(row.reportSHA === null || /^[a-f0-9]{64}$/.test(row.reportSHA)))) reject();
  if (!/^[a-f0-9]{64}$/.test(fingerprints.source) || !/^[a-f0-9]{64}$/.test(fingerprints.lock)) reject();
  const phases = rows.map(({ id, status, elapsedMs, exitCode, counts, invocationSHA, reportSHA, diagnostic }) => ({ id, status, elapsedMs, exitCode, invocationSHA, reportSHA,
    counts: counts ? Object.fromEntries(Object.entries(counts).filter(([key, value]) =>
      ['run', 'pass', 'fail', 'skip', 'acceptedFindings', 'detectedFindings'].includes(key) && integer(value))) : null,
    diagnostic: diagnostic ? { codes: diagnostic.codes.filter(code => DIAGNOSTIC_CODES.includes(code)),
      metrics: Object.fromEntries(Object.entries(diagnostic.metrics).filter(([key, value]) =>
        ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numRuntimeErrorTestSuites', 'architectureAssertion'].includes(key) && integer(value))),
      failedFiles: diagnostic.failedFiles.filter(path => /^(?:src|tests)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|mjs)$/.test(path)).slice(0, 32) } : null }));
  return { schemaVersion: 'pos-cafe-light-ci-v1', verificationScope: 'LIGHT_MOCK_ONLY', repository: PROJECT_REPOSITORY,
    event: binding.event, sourceSHA: binding.sourceSHA, prHeadSHA: binding.prHeadSHA, workflowSHA: binding.workflowSHA,
    runId: binding.runId, attempt: binding.attempt,
    sourceFingerprint: fingerprints.source, lockSHA: fingerprints.lock,
    overallStatus: phases.length === PROJECT_PHASES.length && phases.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL',
    runURL: `https://github.com/${PROJECT_REPOSITORY}/actions/runs/${binding.runId}/attempts/${binding.attempt}`, phases };
}
