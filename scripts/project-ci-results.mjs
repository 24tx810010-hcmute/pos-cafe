import { createHash } from 'node:crypto';
import { stripVTControlCharacters } from 'node:util';
import { lstatSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

export const PROJECT_REPOSITORY = 'nguyentronglinh045/pos-cafe';
export const PROJECT_REPOSITORY_ID = 1263057386;
export const PROJECT_PHASES = Object.freeze(['install', 'build', 'unit', 'tooling', 'node-tools', 'browser', 'smoke-discovery', 'smoke-preflight', 'smoke', 'ui-selftest', 'ui-audit']);
export const PROJECTS = Object.freeze(['desktop', 'tablet-landscape', 'phone-landscape', 'small-landscape', 'portrait', 'demo-runbook']);
export const hash = value => createHash('sha256').update(value).digest('hex');
const reject = () => { throw new Error('PROJECT_CI_RESULT_INVALID'); };
const integer = n => Number.isSafeInteger(n) && n >= 0;
const SMOKE_STEP_FILES = Object.freeze(['tests/smoke/pos-cafe.spec.ts', 'tests/smoke/helpers.ts',
  'tests/smoke/permission-ui-closeout.spec.ts', 'tests/smoke/demo-runbook.spec.ts']);
const SMOKE_STEP_LOCATORS = Object.freeze(['landing-screen', 'store-pairing-screen', 'passcode-screen',
  'floor-page', 'order-drawer', 'submit-order-button']);
const SMOKE_STEP_CATEGORIES = Object.freeze(['pw:api', 'expect', 'fixture', 'hook', 'test.step', 'test.error']);
const SMOKE_STEP_APIS = Object.freeze([/browserType\.launch|^Launch browser/i, /browser\.newContext|^Create context/i,
  /browserContext\.newPage|^Create page/i, /page\.goto|^Navigate to/i, /locator\.click|^Click /i,
  /locator\.fill|^Fill /i, /toBeVisible/, /toBeHidden/, /browserContext\.close/, /browser\.close/,
  /page\.waitForLoadState/, /page\.waitForURL/]);
export function smokeStepDiagnostic(step, root) {
  if (!step?.error) return null;
  const message = typeof step.error.message === 'string' ? stripVTControlCharacters(step.error.message.slice(0, 1024 ** 2)) : '';
  const title = typeof step.title === 'string' ? step.title.slice(0, 4096) : '';
  const locatorText = title + '\n' + (/^\s*Locator:\s*([^\r\n]*)/m.exec(message)?.[1] ?? '');
  const locator = SMOKE_STEP_LOCATORS.findIndex(id => locatorText.includes(`getByTestId('${id}')`) || locatorText.includes(`getByTestId("${id}")`)) + 1;
  const location = step.location ?? step.error.location;
  const path = typeof location?.file === 'string' ? location.file.replaceAll('\\', '/') : '';
  const prefix = root.replaceAll('\\', '/').replace(/\/$/, '') + '/';
  const file = path.startsWith(prefix) ? path.slice(prefix.length) : path;
  const known = SMOKE_STEP_FILES.includes(file) && integer(location?.line) && location.line > 0 && location.line <= 1000000
    && integer(location?.column) && location.column > 0 && location.column <= 1000000;
  return { schemaVersion: 'pos-smoke-step-v1', categoryOrdinal: SMOKE_STEP_CATEGORIES.indexOf(step.category) + 1,
    apiOrdinal: SMOKE_STEP_APIS.findIndex(pattern => pattern.test(title)) + 1,
    locatorOrdinal: locator, file: known ? file : null, line: known ? location.line : null, column: known ? location.column : null,
    durationMs: integer(step.duration) && step.duration <= 480000 ? step.duration : null };
}

// Optional Playwright reporter, loaded from this already pinned checker module.
// It only observes failures; it has no onEnd/status override or test mutation.
export default class SmokeFailureReporter {
  constructor() { this.emitted = 0; }
  emit(step) {
    if (this.emitted >= 32) return;
    const record = smokeStepDiagnostic(step, process.cwd());
    if (record) { this.emitted++; console.log('PROJECT_SMOKE_FAILED_STEP ' + JSON.stringify(record)); }
  }
  onStepEnd(_test, _result, step) { this.emit(step); }
  onTestEnd(_test, result) {
    for (const error of Array.isArray(result.errors) ? result.errors : [])
      this.emit({ error, location: error.location, category: 'test.error', duration: result.duration });
  }
}

// Read only the failed preflight's own trace. unzip streams selected JSONL to
// RAM; it never extracts files. Every subprocess and decoded payload is bounded.
export function smokeTraceDiagnostics(report, root, expectedFiles, run = execFileSync) {
  const facts = { traceRefusalOrdinal: 1 };
  const unavailable = () => ({ codes: ['TRACE_UNAVAILABLE'], metrics: facts, failedFiles: [] });
  try {
    const attachments = [], queue = [...(report?.suites ?? [])];
    for (let n = 0; queue.length && n < 10000; n++) {
      const suite = queue.shift();
      queue.push(...(suite.suites ?? []).slice(0, 10000 - queue.length));
      for (const spec of suite.specs ?? []) for (const test of spec.tests ?? [])
        for (const result of test.results ?? []) if (['failed', 'timedOut', 'interrupted'].includes(result.status))
          attachments.push(...(result.attachments ?? []).filter(a => a.name === 'trace' && a.contentType === 'application/zip'));
    }
    facts.traceRefusalOrdinal = 2; facts.traceAttachmentCount = Math.min(10000, attachments.length);
    if (queue.length || attachments.length !== 1 || typeof attachments[0].path !== 'string') return unavailable();
    facts.traceRefusalOrdinal = 3;
    const file = resolve(attachments[0].path), directory = resolve(root, 'test-results') + sep;
    if (!file.startsWith(directory) || realpathSync(file) !== file) return unavailable();
    facts.traceRefusalOrdinal = 4;
    const info = lstatSync(file);
    facts.traceCompressedBytes = Math.min(32 * 1024 ** 2 + 1, info.size);
    if (!info.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > 32 * 1024 ** 2) return unavailable();
    const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 1024 ** 2,
      env: { PATH: process.env.PATH, LANG: 'C', ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) } };
    facts.traceRefusalOrdinal = 5;
    const names = run('unzip', ['-Z1', file], options).trim().split(/\r?\n/);
    facts.traceRefusalOrdinal = 6; facts.traceEntryCount = Math.min(4097, names.length);
    if (names.length > 4096 || new Set(names).size !== names.length) return unavailable();
    const selected = names.filter(name => /^[A-Za-z0-9_-]+\.(?:trace|network)$/.test(name));
    facts.traceSelectedCount = Math.min(33, selected.length);
    if (!selected.some(name => name.endsWith('.trace')) || selected.length > 32) return unavailable();
    facts.traceRefusalOrdinal = 7;
    // Playwright's test.trace has no final newline. Read members separately so
    // its last event cannot be concatenated with the next member's first event.
    const chunks = [], deadline = Date.now() + 10000;
    let decodedBytes = 0;
    for (const name of selected) {
      const timeout = deadline - Date.now();
      if (timeout <= 0) throw Object.assign(new Error('TRACE_READ_TIMEOUT'), { code: 'ETIMEDOUT' });
      const chunk = run('unzip', ['-p', file, name], { ...options, timeout, maxBuffer: Math.max(1, 16 * 1024 ** 2 - decodedBytes) });
      if (typeof chunk !== 'string') reject();
      decodedBytes += Buffer.byteLength(chunk) + (chunks.length ? 1 : 0);
      if (decodedBytes > 16 * 1024 ** 2) { facts.traceRefusalOrdinal = 8; reject(); }
      chunks.push(chunk);
    }
    const text = chunks.join('\n');
    const result = smokeTraceEvents(text, expectedFiles, facts);
    delete facts.traceRefusalOrdinal;
    return { ...result, metrics: { ...facts, ...result.metrics } };
  } catch (error) {
    const ioOrdinal = ['ENOENT','ENOTDIR','EACCES','EPERM','ELOOP','EINVAL'].indexOf(error?.code) + 1;
    if (ioOrdinal) facts.traceIOOrdinal = ioOrdinal;
    if (Number.isInteger(error?.status) && error.status >= 0 && error.status <= 255) facts.traceToolExitCode = error.status;
    if (error?.code === 'ETIMEDOUT') facts.traceToolTimedOut = 1;
    if (['ENOBUFS', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'].includes(error?.code)) facts.traceToolOverflow = 1;
    return unavailable();
  }
}

export function smokeTraceEvents(text, expectedFiles, facts = {}) {
  facts.traceRefusalOrdinal = 8;
  if (typeof text !== 'string' || Buffer.byteLength(text) > 16 * 1024 ** 2) reject();
  facts.traceDecodedBytes = Buffer.byteLength(text);
  const lines = text.split('\n').filter(Boolean);
  if (lines.length > 10000) reject();
  const events = lines.map((line, index) => { facts.traceParseLine = index + 1; return JSON.parse(line); });
  delete facts.traceParseLine;
  facts.traceRefusalOrdinal = 9;
  const contexts = events.filter(event => event?.type === 'context-options');
  facts.traceContextCount = contexts.length;
  const context = contexts.find(event => event.origin === 'library') ?? contexts[0];
  if (integer(context?.version) && context.version <= 1000000) facts.traceContextVersion = context.version;
  const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(context?.playwrightVersion ?? '');
  if (version && version.slice(1).every(n => Number(n) <= 1000000))
    [facts.traceVersionMajor, facts.traceVersionMinor, facts.traceVersionPatch] = version.slice(1).map(Number);
  if (['chromium','firefox','webkit'].includes(context?.browserName)) facts.traceBrowserOrdinal = ['chromium','firefox','webkit'].indexOf(context.browserName) + 1;
  if (!events.some(event => event?.type === 'context-options' && event.version === 8
    && event.playwrightVersion === '1.60.0' && event.browserName === 'chromium')) reject();
  const codes = new Set(), metrics = { traceReadable: 1, tracePageErrors: 0, traceConsoleErrors: 0,
    traceConsoleWarnings: 0, traceHttp4xx: 0, traceHttp5xx: 0 }, failedFiles = [];
  const classify = value => {
    if (typeof value !== 'string') return;
    for (const [code, pattern] of Object.entries({ JS_TYPE_ERROR: /\bTypeError\b/, JS_REFERENCE_ERROR: /\bReferenceError\b/,
      JS_SYNTAX_ERROR: /\bSyntaxError\b/, JS_RANGE_ERROR: /\bRangeError\b/,
      REACT_UPDATE_DEPTH: /Maximum update depth exceeded/i, REACT_UNSTABLE_SNAPSHOT: /result of getSnapshot should be cached/i,
      JS_STACK_OVERFLOW: /Maximum call stack size exceeded/i, MODULE_EXPORT_MISSING: /does not provide an export named/i }))
      if (pattern.test(value)) codes.add(code);
    // Served module coordinates are observed generated-code locations, not a
    // claim that browser stacks were mapped back to original TS/TSX lines.
    for (const match of value.matchAll(/http:\/\/127\.0\.0\.1:5175\/(src\/[A-Za-z0-9_./-]+\.(?:tsx?|mjs))(?:\?[^\s):]{0,256})?:(\d+):(\d+)/g)) {
      const [, file, line, column] = match;
      if (!expectedFiles.includes(file) || file.split('/').includes('..') || failedFiles.includes(file) || failedFiles.length >= 32) continue;
      failedFiles.push(file);
      if (metrics.traceModuleLine === undefined && Number(line) > 0 && Number(line) <= 1000000
        && Number(column) > 0 && Number(column) <= 1000000) {
        metrics.traceModuleLine = Number(line); metrics.traceModuleColumn = Number(column);
      }
    }
  };
  facts.traceRefusalOrdinal = 10;
  for (const event of events) {
    if (!event || typeof event !== 'object') reject();
    if (event.type === 'console' && ['error', 'warning', 'warn'].includes(event.messageType)) {
      metrics[event.messageType === 'error' ? 'traceConsoleErrors' : 'traceConsoleWarnings']++;
      classify(event.text);
    } else if (event.type === 'event' && event.class === 'BrowserContext' && event.method === 'pageError') {
      metrics.tracePageErrors++;
      const error = event.params?.error?.error;
      classify(error?.name); classify(error?.message); classify(error?.stack);
    } else if (event.type === 'resource-snapshot') {
      const status = event.snapshot?.response?.status;
      if (Number.isInteger(status) && status >= 400 && status <= 499) metrics.traceHttp4xx++;
      if (Number.isInteger(status) && status >= 500 && status <= 599) metrics.traceHttp5xx++;
    }
  }
  delete facts.traceRefusalOrdinal;
  return { codes: [...codes], metrics, failedFiles };
}
const DIAGNOSTIC_CODES = Object.freeze(['COMMAND_FAILED', 'VITEST_ASSERTION', 'VITEST_RUNTIME', 'REPORT_MISSING',
  'TEST_TIMEOUT', 'ASSERTION_ERROR', 'TYPE_ERROR', 'REFERENCE_ERROR', 'MODULE_NOT_FOUND', 'OUT_OF_MEMORY', 'COVERAGE_LINES',
  'RESOURCE_FREE_SPACE', 'RESOURCE_OWNED_CAP', 'RESOURCE_CGROUP_DRIFT', 'RESOURCE_CORE_LIMIT', 'GUARD_IO_ENOENT', 'GUARD_IO_ENOTDIR',
  'GUARD_IO_EACCES', 'GUARD_REFUSED', 'COMMAND_TIMEOUT', 'OUTPUT_LIMIT', 'COMMAND_SPAWN_FAILED', 'RESULT_INVALID',
  'SOURCE_DRIFT', 'PROCESS_SIGTERM', 'PROCESS_SIGKILL', 'PROCESS_SIGABRT', 'PROCESS_SIGSEGV', 'RESOURCE_CORE_PATTERN', 'RESOURCE_HOST_GROWTH',
  'BROWSER_LAUNCH', 'BROWSER_DEPENDENCIES', 'BROWSER_SANDBOX', 'BROWSER_CRASHPAD', 'BROWSER_EXECUTION',
  'BROWSER_CONTEXT', 'BROWSER_PAGE', 'PAGE_NAVIGATION', 'LOCATOR_ACTION', 'ASSERTION_VISIBLE', 'FIXTURE_SETUP', 'FIXTURE_TEARDOWN',
  'TRACE_UNAVAILABLE', 'JS_TYPE_ERROR', 'JS_REFERENCE_ERROR', 'JS_SYNTAX_ERROR', 'JS_RANGE_ERROR',
  'REACT_UPDATE_DEPTH', 'REACT_UNSTABLE_SNAPSHOT', 'JS_STACK_OVERFLOW', 'MODULE_EXPORT_MISSING', 'LOCATOR_NOT_FOUND', 'LOCATOR_HIDDEN']);
export function guardFailureCode(error) {
  if (['RESOURCE_FREE_SPACE', 'RESOURCE_OWNED_CAP', 'RESOURCE_CGROUP_DRIFT', 'RESOURCE_CORE_LIMIT', 'RESOURCE_CORE_PATTERN', 'RESOURCE_HOST_GROWTH', 'SOURCE_DRIFT'].includes(error?.code)) return error.code;
  if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error?.code)) return `GUARD_IO_${error.code}`;
  return error?.message === 'PROJECT_CI_RESULT_INVALID' ? 'RESULT_INVALID' : 'GUARD_REFUSED';
}

export function privateDiagnostics(output, report, expectedFiles = [], root = '') {
  const codes = ['COMMAND_FAILED'];
  const metrics = {};
  for (const [key, value] of Object.entries(report ?? {})) if (['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numRuntimeErrorTestSuites'].includes(key) && integer(value)) metrics[key] = value;
  if (!report) codes.push('REPORT_MISSING');
  if (metrics.numFailedTests > 0) codes.push('VITEST_ASSERTION');
  if (metrics.numRuntimeErrorTestSuites > 0) codes.push('VITEST_RUNTIME');
  const messages = [output];
  const smokeFailedFiles = [], queue = (Array.isArray(report?.suites) ? report.suites : []).slice(0, 10000);
  for (let n = 0; queue.length && n < 10000; n++) {
    const suite = queue.shift();
    if (Array.isArray(suite?.suites)) queue.push(...suite.suites.slice(0, 10000 - queue.length));
    for (const spec of Array.isArray(suite?.specs) ? suite.specs : []) for (const test of Array.isArray(spec.tests) ? spec.tests : []) {
      const failed = (Array.isArray(test.results) ? test.results : []).filter(r => ['failed', 'timedOut', 'interrupted'].includes(r.status));
      if (!failed.length) continue;
      const file = typeof spec.file === 'string' ? `tests/smoke/${spec.file}` : '';
      if (expectedFiles.includes(file) && /^tests\/smoke\/[A-Za-z0-9_./-]+\.(?:ts|mjs)$/.test(file)) {
        smokeFailedFiles.push(file);
        if (metrics.smokeTestLine === undefined && integer(spec.line) && spec.line > 0 && spec.line <= 1000000) {
          metrics.smokeTestLine = spec.line;
          if (PROJECTS.includes(test.projectName)) metrics.smokeFailureProjectOrdinal = PROJECTS.indexOf(test.projectName) + 1;
        }
      }
      for (const result of failed) for (const error of [result.error, ...(Array.isArray(result.errors) ? result.errors : [])])
        for (const value of [error?.message, error?.stack]) if (typeof value === 'string') messages.push(value);
    }
  }
  for (const [name, key] of Object.entries({expected:'smokeExpected',unexpected:'smokeUnexpected',skipped:'smokeSkipped',flaky:'smokeFlaky'}))
    if (integer(report?.stats?.[name])) metrics[key] = report.stats[name];
  for (const file of report?.testResults ?? []) if (file.status === 'failed') {
    for (const value of [file.message, file.failureMessage]) if (typeof value === 'string') messages.push(value);
    for (const assertion of file.assertionResults ?? []) if (assertion.status === 'failed') {
      for (const value of assertion.failureMessages ?? []) if (typeof value === 'string') messages.push(value);
    }
  }
  const privateText = stripVTControlCharacters(messages.join('\n'));
  for (const file of [...new Set(smokeFailedFiles)]) {
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const location = new RegExp(escaped + ':(\\d+):(\\d+)').exec(privateText.replaceAll('\\', '/'));
    if (location && Number(location[1]) > 0 && Number(location[1]) <= 1000000
      && Number(location[2]) > 0 && Number(location[2]) <= 1000000) {
      metrics.smokeFailureLine = Number(location[1]); metrics.smokeFailureColumn = Number(location[2]); break;
    }
  }
  if (expectedFiles.includes('tests/smoke/helpers.ts')) {
    const helper = /tests[/\\]smoke[/\\]helpers\.ts:(\d+):\d+/.exec(privateText);
    if (helper && Number(helper[1]) > 0 && Number(helper[1]) <= 1000000) metrics.smokeHelperLine = Number(helper[1]);
  }
  const progress = [...privateText.matchAll(/\[(\d+)\/(\d+)\]/g)].filter(m => Number(m[1]) <= Number(m[2]) && Number(m[2]) <= 10000).at(-1);
  if (progress) { metrics.smokeProgressIndex = Number(progress[1]); metrics.smokeProgressTotal = Number(progress[2]); }
  let stepLocation = false;
  for (const line of privateText.split('\n')) {
    const marker = line.indexOf('PROJECT_SMOKE_FAILED_STEP ');
    if (marker < 0 || line.length - marker > 4096) continue;
    let step; try { step = JSON.parse(line.slice(marker + 'PROJECT_SMOKE_FAILED_STEP '.length)); } catch { continue; }
    if (step?.schemaVersion !== 'pos-smoke-step-v1') continue;
    if (integer(step.locatorOrdinal) && step.locatorOrdinal > 0 && step.locatorOrdinal <= SMOKE_STEP_LOCATORS.length)
      metrics.smokeStepLocatorOrdinal ??= step.locatorOrdinal;
    if (integer(step.categoryOrdinal) && step.categoryOrdinal > 0 && step.categoryOrdinal <= SMOKE_STEP_CATEGORIES.length)
      metrics.smokeStepCategoryOrdinal ??= step.categoryOrdinal;
    if (integer(step.apiOrdinal) && step.apiOrdinal > 0 && step.apiOrdinal <= SMOKE_STEP_APIS.length)
      metrics.smokeStepApiOrdinal ??= step.apiOrdinal;
    if (integer(step.durationMs) && step.durationMs <= 480000) metrics.smokeStepDurationMs ??= step.durationMs;
    if (!stepLocation && SMOKE_STEP_FILES.includes(step.file) && expectedFiles.includes(step.file)
      && integer(step.line) && step.line > 0 && step.line <= 1000000 && integer(step.column) && step.column > 0 && step.column <= 1000000) {
      stepLocation = true; metrics.smokeStepSourceOrdinal = SMOKE_STEP_FILES.indexOf(step.file) + 1;
      metrics.smokeFailureLine = step.line; metrics.smokeFailureColumn = step.column;
      if (step.file === 'tests/smoke/helpers.ts') metrics.smokeHelperLine = step.line;
    }
  }
  for (const [code, pattern] of Object.entries({ TEST_TIMEOUT: /timed?\s*out|test timeout|timeout of/i,
    ASSERTION_ERROR: /AssertionError|expected .{0,100} to /i, TYPE_ERROR: /TypeError/, REFERENCE_ERROR: /ReferenceError/,
    MODULE_NOT_FOUND: /ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|cannot find (?:module|package)/i,
    OUT_OF_MEMORY: /heap out of memory|allocation failed|SIGKILL/i, COVERAGE_LINES: /ERROR: Coverage for lines/i,
    BROWSER_LAUNCH: /browserType\.launch|browser has been closed|Target crashed|signal=SIGTRAP/i,
    BROWSER_DEPENDENCIES: /Host system is missing dependencies|error while loading shared libraries/i,
    BROWSER_SANDBOX: /No usable sandbox|Running as root without --no-sandbox|Failed to move to new namespace/i,
    BROWSER_CRASHPAD: /chrome_crashpad_handler: --database is required|FATAL:.*crashpad/i,
    BROWSER_EXECUTION: /Illegal instruction|signal=SIGILL|Exec format error|cannot execute binary/i,
    BROWSER_CONTEXT: /\bbrowser\.newContext:/,
    BROWSER_PAGE: /\bbrowserContext\.newPage:/,
    PAGE_NAVIGATION: /\bpage\.(?:goto|reload|waitForURL):/,
    LOCATOR_ACTION: /\blocator\.(?:click|fill|press|check|waitFor):/,
    ASSERTION_VISIBLE: /expect\([^\r\n]*\)\.(?:toBeVisible|toBeHidden)/,
    LOCATOR_NOT_FOUND: /element\(s\) not found|locator resolved to 0 elements/i,
    LOCATOR_HIDDEN: /Received:\s*hidden|locator resolved to hidden/i,
    FIXTURE_SETUP: /while setting up \"[^\r\n\"]{1,100}\"/i,
    FIXTURE_TEARDOWN: /while tearing down \"[^\r\n\"]{1,100}\"/i })) {
    if (pattern.test(privateText)) codes.push(code);
  }
  const failedFiles = (report?.testResults ?? []).filter(file => file.status === 'failed').map(file => {
    const path = typeof file.name === 'string' ? file.name.replaceAll('\\', '/').replace(root.replaceAll('\\', '/') + '/', '') : '';
    return expectedFiles.includes(path) && /^(?:src|tests)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|mjs)$/.test(path) ? path : null;
  }).filter(Boolean);
  failedFiles.push(...smokeFailedFiles.filter(file => !failedFiles.includes(file)));
  failedFiles.splice(32);
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
  if (env.GITHUB_REPOSITORY !== PROJECT_REPOSITORY || env.GITHUB_REPOSITORY_ID !== String(PROJECT_REPOSITORY_ID)
    || event.repository?.id !== PROJECT_REPOSITORY_ID || !hex(actualSHA) || actualSHA !== env.GITHUB_SHA
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
  return { repository: PROJECT_REPOSITORY, repositoryID: PROJECT_REPOSITORY_ID, event: env.GITHUB_EVENT_NAME,
    sourceSHA: actualSHA, prHeadSHA, workflowSHA: env.GITHUB_WORKFLOW_SHA,
    runId: env.GITHUB_RUN_ID, attempt: Number(env.GITHUB_RUN_ATTEMPT) };
}

export function vitestCounts(report, expectedFiles, root, backendOnly = []) {
  if (!Array.isArray(report.testResults) || !report.testResults.length || !Array.isArray(expectedFiles)) reject();
  const names = report.testResults.map(file => {
    const prefix = root.replaceAll('\\', '/') + '/';
    const name = file.name?.replaceAll('\\', '/');
    if (!name?.startsWith(prefix)) reject();
    return name.slice(prefix.length);
  });
  if (!sameSet(names, expectedFiles)) reject();
  const deferred = backendOnly.map(item => item.file + '\0' + item.fullName);
  if (new Set(deferred).size !== deferred.length || backendOnly.some(item => !expectedFiles.includes(item.file) || typeof item.fullName !== 'string')) reject();
  const tests = report.testResults.flatMap((file, index) => {
    if (!Array.isArray(file.assertionResults) || !file.assertionResults.length) reject();
    return file.assertionResults.map(test => ({ ...test, sourceFile: names[index] }));
  });
  const result = { discovered: tests.length, run: 0, pass: 0, fail: 0, skip: 0, manualDeferred: 0 };
  const seen = [];
  for (const test of tests) {
    const identity = test.sourceFile + '\0' + test.fullName;
    if (deferred.includes(identity)) {
      if (!['pending', 'skipped'].includes(test.status)) reject();
      seen.push(identity); result.skip++; result.manualDeferred++; continue;
    }
    result.run++;
    if (test.status === 'passed') result.pass++;
    else if (test.status === 'failed') result.fail++;
    else if (['pending', 'skipped', 'todo'].includes(test.status)) result.skip++;
    else reject();
  }
  if (!sameSet(seen, deferred) || report.numTotalTests !== result.discovered || report.numPassedTests !== result.pass
    || report.numFailedTests !== result.fail || (report.numPendingTests ?? 0) !== result.skip || (report.numTodoTests ?? 0) !== 0
    || (report.numRuntimeErrorTestSuites ?? 0) !== 0 || result.skip !== deferred.length || !result.run
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

export function smokeCases(report, projects = PROJECTS) {
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
    || !sameSet([...new Set(cases.map(item => item.project))], projects)) reject();
  return cases;
}

export function smokePreflightCounts(report, discovery) {
  const key = 'desktop|pos-cafe.spec.ts|119|POS mock flow keeps primary actions visible on landscape viewports';
  const expected = smokeCases(discovery).filter(item => item.key === key), actual = smokeCases(report, ['desktop']);
  if (expected.length !== 1 || actual.length !== 1 || actual[0].key !== key) reject();
  const test = actual[0].test;
  if (test.expectedStatus !== 'passed' || test.status !== 'expected' || test.results?.length !== 1
    || test.results[0].status !== 'passed' || (test.results[0].retry ?? 0) !== 0 || test.results[0].error || (test.results[0].errors?.length ?? 0)
    || report.stats?.expected !== 1 || report.stats?.unexpected !== 0 || report.stats?.skipped !== 0 || report.stats?.flaky !== 0) reject();
  return {run:1,pass:1,fail:0,skip:0};
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
  if (binding.repository !== PROJECT_REPOSITORY || binding.repositoryID !== PROJECT_REPOSITORY_ID || !['push', 'pull_request'].includes(binding.event)
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
      ['discovered', 'run', 'pass', 'fail', 'skip', 'manualDeferred', 'acceptedFindings', 'detectedFindings'].includes(key) && integer(value))) : null,
    diagnostic: diagnostic ? { codes: diagnostic.codes.filter(code => DIAGNOSTIC_CODES.includes(code)),
      metrics: Object.fromEntries(Object.entries(diagnostic.metrics).filter(([key, value]) =>
        ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numRuntimeErrorTestSuites', 'architectureAssertion',
          'minimumObservedFreeBytes', 'initialFreeBytes', 'freeSpaceDecreaseBytes', 'ownedBytesAtCheckpoint', 'coreFileCount', 'coreAllocatedBytes', 'largestOwnedFileBytes', 'kernelCorePipe',
          'smokeTestLine', 'smokeFailureProjectOrdinal', 'smokeHelperLine', 'smokeFailureLine', 'smokeFailureColumn',
          'smokeStepLocatorOrdinal', 'smokeStepCategoryOrdinal', 'smokeStepApiOrdinal', 'smokeStepSourceOrdinal', 'smokeStepDurationMs',
          'traceReadable', 'tracePageErrors', 'traceConsoleErrors', 'traceConsoleWarnings', 'traceHttp4xx', 'traceHttp5xx', 'traceModuleLine', 'traceModuleColumn',
          'traceRefusalOrdinal', 'traceAttachmentCount', 'traceCompressedBytes', 'traceEntryCount', 'traceSelectedCount', 'traceDecodedBytes', 'traceParseLine',
          'traceContextCount', 'traceContextVersion', 'traceVersionMajor', 'traceVersionMinor', 'traceVersionPatch', 'traceBrowserOrdinal',
          'traceToolExitCode', 'traceToolTimedOut', 'traceToolOverflow',
          'traceIOOrdinal',
          'smokeExpected', 'smokeUnexpected', 'smokeSkipped', 'smokeFlaky', 'smokeProgressIndex', 'smokeProgressTotal',
          'memoryCurrentBytes', 'peakMemoryBytes', 'pidsCurrent', 'peakPids', 'oomEvents', 'oomKills', 'pidsLimitEvents'].includes(key) && integer(value))),
      failedFiles: diagnostic.failedFiles.filter(path => /^(?:src|tests)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|mjs)$/.test(path)).slice(0, 32) } : null }));
  return { schemaVersion: 'pos-cafe-light-ci-v1', verificationScope: 'LIGHT_MOCK_ONLY', repository: PROJECT_REPOSITORY, repositoryID: PROJECT_REPOSITORY_ID,
    event: binding.event, sourceSHA: binding.sourceSHA, prHeadSHA: binding.prHeadSHA, workflowSHA: binding.workflowSHA,
    runId: binding.runId, attempt: binding.attempt,
    sourceFingerprint: fingerprints.source, lockSHA: fingerprints.lock,
    overallStatus: phases.length === PROJECT_PHASES.length && phases.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL',
    runURL: `https://github.com/${PROJECT_REPOSITORY}/actions/runs/${binding.runId}/attempts/${binding.attempt}`, phases };
}
