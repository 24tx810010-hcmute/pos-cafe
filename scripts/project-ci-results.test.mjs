import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sourceBinding, vitestCounts, nodeCounts, smokeCounts, uiCounts, publicSummary, privateDiagnostics, PROJECTS, PROJECT_PHASES, hash } from './project-ci-results.mjs';
import { capturedCommand, trackedFingerprint, lightEnvironment, checkoutGit } from './project-ci.mjs';
import { lightService } from './project-ci-launch.mjs';
import { backendInvocation } from './project-backend.mjs';
import { verifyReleaseRun, verifyReleaseEnvironment, verifyReleaseFiles, productionCommands, PRODUCTION_ENABLED } from './project-release.mjs';
import { ci1TrustedRepository } from './permission-ci1-policy.mjs';
import { renderCi1Evidence } from './permission-ci1-evidence.mjs';

const sha = '1'.repeat(40), other = '2'.repeat(40), digest = '3'.repeat(64);
const env = { GITHUB_REPOSITORY: 'nguyentronglinh045/pos-cafe', GITHUB_REPOSITORY_ID: '1263057386', GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted',
  GITHUB_EVENT_NAME: 'push', GITHUB_SHA: sha, GITHUB_WORKFLOW_SHA: sha, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1' };
const binding = sourceBinding(env, { after: sha, repository: { full_name: env.GITHUB_REPOSITORY, id: 1263057386 } }, sha);

test('source binding distinguishes tested PR merge from head and refuses mismatched SHA/event/repo', () => {
  const event = { repository: { full_name: env.GITHUB_REPOSITORY, id: 1263057386 }, pull_request: { head: { sha: other }, merge_commit_sha: sha } };
  assert.equal(sourceBinding({ ...env, GITHUB_EVENT_NAME: 'pull_request' }, event, sha).prHeadSHA, other);
  assert.throws(() => sourceBinding({ ...env, GITHUB_EVENT_NAME: 'pull_request' }, event, other));
  assert.throws(() => sourceBinding({ ...env, GITHUB_EVENT_NAME: 'pull_request_target' }, event, sha));
  assert.throws(() => sourceBinding(env, { after: other }, sha));
  assert.throws(() => sourceBinding({ ...env, GITHUB_REPOSITORY_ID: '1' }, event, sha));
  assert.throws(() => sourceBinding(env, { ...event, repository: {...event.repository, id:1} }, sha));
});

test('Vitest requires exact discovered file set, totals and zero pending/fail/hook errors', () => {
  const report = { numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, success: true,
    testResults: [{ name: '/source/src/a.test.ts', status: 'passed', assertionResults: [{ status: 'passed' }] }] };
  assert.equal(vitestCounts(report, ['src/a.test.ts'], '/source').pass, 1);
  assert.throws(() => vitestCounts(report, ['src/a.test.ts', 'src/b.test.ts'], '/source'));
  assert.throws(() => vitestCounts({ ...report, numTotalTests: 2 }, ['src/a.test.ts'], '/source'));
  assert.throws(() => vitestCounts({ ...report, numRuntimeErrorTestSuites: 1 }, ['src/a.test.ts'], '/source'));
});

test('light tooling accounts for exactly the declared real-backend case without accepting any other skip or failure', () => {
  const manual = [{file:'tests/contracts/gates.tool.test.ts',fullName:'TC-IDEM-087/tool real backend'}];
  const report = {numTotalTests:2,numPassedTests:1,numFailedTests:0,numPendingTests:1,success:true,
    testResults:[{name:'/source/tests/contracts/gates.tool.test.ts',status:'passed',assertionResults:[
      {fullName:'pure runner gate',status:'passed'}, {fullName:manual[0].fullName,status:'pending'}]}]};
  const files = [manual[0].file];
  assert.deepEqual(vitestCounts(report,files,'/source',manual),{discovered:2,run:1,pass:1,fail:0,skip:1,manualDeferred:1});
  assert.throws(()=>vitestCounts(report,files,'/source'));
  const extra = structuredClone(report);extra.testResults[0].assertionResults[0].status='pending';
  assert.throws(()=>vitestCounts(extra,files,'/source',manual));
  const missing = structuredClone(report);missing.testResults[0].assertionResults[1].fullName='another case';
  assert.throws(()=>vitestCounts(missing,files,'/source',manual));
  const accidentalRun = structuredClone(report);accidentalRun.testResults[0].assertionResults[1].status='passed';
  assert.throws(()=>vitestCounts(accidentalRun,files,'/source',manual));
  assert.throws(()=>vitestCounts(report,files,'/source',[...manual,...manual]));
  assert.throws(()=>vitestCounts({...report,numPendingTests:0,numTodoTests:1},files,'/source',manual));
});

test('Node TAP pending/cancelled/malformed counts cannot become a pass', () => {
  const tap = '# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(nodeCounts(tap).run, 2);
  assert.throws(() => nodeCounts(tap.replace('# skipped 0', '# skipped 1')));
  assert.throws(() => nodeCounts('FAKE_PRIVATE_TOKEN'));
});

test('smoke requires every project/case and exact applicability skips without retries or expected failures', () => {
  const report = { suites: [{ specs: PROJECTS.map(projectName => ({ file: 'a.ts', line: 1, title: 'case', tests: [
    { projectName, expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed', retry: 0, errors: [] }] }] })) }],
    errors: [], stats: { expected: 6, skipped: 0, unexpected: 0, flaky: 0 } };
  assert.equal(smokeCounts(report, report, []).pass, 6);
  const missing = structuredClone(report); missing.suites[0].specs.pop();
  assert.throws(() => smokeCounts(missing, report, []));
  const retry = structuredClone(report); retry.suites[0].specs[0].tests[0].results[0].retry = 1;
  assert.throws(() => smokeCounts(retry, report, []));
});

test('UI gate requires every target/viewport and rejects fresh or incomplete findings', () => {
  const cfg = { states: [{ name: 'floor' }], viewports: [{ name: 'tablet' }] };
  const output = ' ok   tablet floor 0 finding(s), 0 new\nno new UI anomalies';
  assert.equal(uiCounts(output, [], cfg).run, 1);
  assert.throws(() => uiCounts('no new UI anomalies', [], cfg));
  assert.throws(() => uiCounts(output, [{ known: false }], cfg));
});

test('public evidence excludes arbitrary binding/count/raw fields and incomplete phase sets fail', () => {
  const rows = PROJECT_PHASES.map(id => ({ id, status: 'PASS', elapsedMs: 1, exitCode: 0, invocationSHA: digest, reportSHA: digest,
    counts: { pass: 1, raw: 'FAKE_PRIVATE_TOKEN' } }));
  const result = publicSummary({ ...binding, raw: 'FAKE_PRIVATE_TOKEN' }, rows, { source: digest, lock: digest });
  assert.equal(result.overallStatus, 'PASS');
  assert.equal(JSON.stringify(result).includes('FAKE_PRIVATE_TOKEN'), false);
  assert.equal(publicSummary(binding, rows.slice(0, -1), { source: digest, lock: digest }).overallStatus, 'FAIL');
});

test('failed Vitest diagnostics retain known counters and source paths without raw messages or credentials', () => {
  const report = { numTotalTests: 2, numPassedTests: 1, numFailedTests: 1, numPendingTests: 0, success: false,
    secret: 'FAKE_PRIVATE_TOKEN', testResults: [{ name: '/source/src/a.test.ts', status: 'failed',
      failureMessage: 'AssertionError: FAKE_PRIVATE_TOKEN test \u001b[31mtimed\u001b[39m out' }, { name: '/private/FAKE_PRIVATE_TOKEN', status: 'failed' }] };
  const diagnostic = privateDiagnostics('FAKE_PRIVATE_TOKEN', report, ['src/a.test.ts'], '/source');
  assert.equal(diagnostic.metrics.numFailedTests, 1);
  assert.deepEqual(diagnostic.failedFiles, ['src/a.test.ts']);
  assert.ok(diagnostic.codes.includes('TEST_TIMEOUT'));
  assert.equal(JSON.stringify(diagnostic).includes('FAKE_PRIVATE_TOKEN'), false);
  const row = { id: 'install', status: 'FAIL', exitCode: 1, elapsedMs: 1, invocationSHA: digest, reportSHA: digest,
    diagnostic: { ...diagnostic, codes: [...diagnostic.codes, 'FAKE_PRIVATE_TOKEN'], metrics: { ...diagnostic.metrics, raw: 'FAKE_PRIVATE_TOKEN' } } };
  assert.equal(JSON.stringify(publicSummary(binding, [row], {source:digest,lock:digest})).includes('FAKE_PRIVATE_TOKEN'), false);
  assert.ok(privateDiagnostics('ERROR: Coverage for lines (89%) does not meet global threshold (90%)', null).codes.includes('COVERAGE_LINES'));
  const architectureReport = { testResults: [{ name: '/source/src/architectureBoundaries.test.ts', status: 'failed',
    assertionResults: [{status:'passed'}, {status:'failed', message:'FAKE_PRIVATE_TOKEN'}] }] };
  const precise = privateDiagnostics('', architectureReport, ['src/architectureBoundaries.test.ts'], '/source');
  assert.equal(precise.metrics.architectureAssertion, 2);
  assert.equal(JSON.stringify(precise).includes('FAKE_PRIVATE_TOKEN'), false);
  const passedText = {testResults:[{name:'/source/src/a.test.ts',status:'passed',assertionResults:[{status:'passed',failureMessages:['Test timed out FAKE_PRIVATE_TOKEN']}]}]};
  assert.equal(privateDiagnostics('',passedText,['src/a.test.ts'],'/source').codes.includes('TEST_TIMEOUT'), false);
});

test('fresh capture retains output privately; guard refusal stops dependent process and never echoes output', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pos-ci-test-'));
  const result = await capturedCommand(process.execPath, ['-e', 'process.stdout.write("FAKE_PRIVATE_TOKEN"); process.exit(7)'],
    { cwd: root, env: process.env, output: join(root, 'out'), guard() {} });
  assert.equal(result.exitCode, 7); assert.equal(readFileSync(join(root, 'out'), 'utf8'), 'FAKE_PRIVATE_TOKEN');
  await assert.rejects(capturedCommand(process.execPath, [], { cwd: root, env: {}, output: join(root, 'blocked'), guard() { throw new Error(); } }));
  writeFileSync(join(root, 'source'), 'before'); const initial = trackedFingerprint(root, ['source']);
  writeFileSync(join(root, 'source'), 'after'); assert.notEqual(trackedFingerprint(root, ['source']), initial);
});

test('light supervisor constrains descendants and passes no credential environment', () => {
  const args = lightService({ ...env, GITHUB_TOKEN: 'FAKE_PRIVATE_TOKEN' }, '/node', '/source');
  assert.ok(args.includes('--property=KillMode=control-group'));
  assert.ok(args.includes('--property=MemorySwapMax=0'));
  assert.equal(args.join(' ').includes('FAKE_PRIVATE_TOKEN'), false);
});

test('light npm loads two separate empty configs and ignores inherited credentials', () => {
  const root = mkdtempSync(join(tmpdir(), 'pos-ci-npm-'));
  const childEnv = lightEnvironment(root, { ...process.env, GITHUB_TOKEN: 'FAKE_PRIVATE_TOKEN', NPM_TOKEN: 'FAKE_PRIVATE_TOKEN' });
  assert.notEqual(childEnv.NPM_CONFIG_USERCONFIG, childEnv.NPM_CONFIG_GLOBALCONFIG);
  assert.equal(readFileSync(childEnv.NPM_CONFIG_USERCONFIG, 'utf8'), '');
  assert.equal(readFileSync(childEnv.NPM_CONFIG_GLOBALCONFIG, 'utf8'), '');
  const npm = [join(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(process.execPath, '..', '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')].find(existsSync);
  assert.ok(npm, 'npm bundled with the pinned Node runtime must exist');
  const version = execFileSync(process.execPath, [npm, '--version'], { env: childEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(version.trim(), /^\d+\.\d+\.\d+$/);
  assert.equal(JSON.stringify(childEnv).includes('FAKE_PRIVATE_TOKEN'), false);
});

test('checkout Git trusts only its exact directory and captures command errors', () => {
  const root = mkdtempSync(join(tmpdir(), 'pos-ci-git-'));
  assert.match(checkoutGit(root, ['init', '--quiet', '--initial-branch=main']), /^$/);
  assert.equal(checkoutGit(root, ['rev-parse', '--show-toplevel']).trim().replaceAll('\\', '/'), root.replaceAll('\\', '/'));
  assert.throws(() => checkoutGit(root, ['rev-parse', '--verify', 'missing']), error => Boolean(error.stderr?.length));
});

test('output overflow terminates the owned child and reusing an old capture cannot pass', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pos-ci-overflow-'));
  const output = join(root, 'out');
  const result = await capturedCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(2048)); setInterval(()=>{},1000)'],
    { cwd: root, env: process.env, output, guard() {}, maxBytes: 32, timeoutMs: 2000 });
  assert.equal(result.blocked, true);
  await assert.rejects(capturedCommand(process.execPath, [], { cwd: root, env: process.env, output, guard() {} }));
});

test('backend manual guard requires confirmation, immutable workflow/source and exact allowed repositories', () => {
  assert.ok(backendInvocation({ ...env, GITHUB_EVENT_NAME: 'workflow_dispatch', CI1_CONFIRMATION: 'RUN_SYNTHETIC_PILOT' }, '/node', '/source').argv.includes('CI1_EXECUTION_AUTHORIZED=yes'));
  assert.throws(() => backendInvocation({ ...env, CI1_CONFIRMATION: 'RUN_SYNTHETIC_PILOT' }, '/node', '/source'));
  assert.equal(ci1TrustedRepository(env.GITHUB_REPOSITORY), true);
  assert.equal(ci1TrustedRepository('nguyentronglinh045/pos-cafe-ci-preflight'), true);
  assert.equal(ci1TrustedRepository('attacker/pos-cafe'), false);
});

test('CD rejects PR/fork/failing/wrong-attempt runs and checker changes even with the same source SHA', () => {
  const input = { sourceSHA: sha, runId: '123', attempt: 1 };
  const policy = { allowedSourceBranches: ['main'], trustedFiles: { 'ci.yml': hash('trusted') } };
  const run = { repository: { full_name: env.GITHUB_REPOSITORY, id:1263057386 }, head_repository: { full_name: env.GITHUB_REPOSITORY, id:1263057386 },
    id: 123, run_attempt: 1, head_sha: sha, event: 'push', status: 'completed', conclusion: 'success', path: '.github/workflows/ci.yml', head_branch: 'main' };
  assert.equal(verifyReleaseRun(run, input, policy), true);
  for (const delta of [{ event: 'pull_request' }, { conclusion: 'failure' }, { run_attempt: 2 }, { head_repository: { full_name: 'attacker/fork' } }, { repository: {full_name:env.GITHUB_REPOSITORY,id:1} }]) {
    assert.throws(() => verifyReleaseRun({ ...run, ...delta }, input, policy));
  }
  assert.throws(() => verifyReleaseFiles({ 'ci.yml': Buffer.from('changed') }, policy));
});

test('CD requires the exact owner, branch restrictions and no admin bypass; production cannot be enabled by input/env', () => {
  const policy = { reviewers: ['nguyentronglinh045'] };
  const environment = { name: 'production', can_admins_bypass: false, deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
    protection_rules: [{ type: 'required_reviewers', prevent_self_review: false, reviewers: [{ type: 'User', reviewer: { login: 'nguyentronglinh045' } }] }] };
  assert.equal(verifyReleaseEnvironment(environment, [{ name: 'main', type: 'branch' }], policy), true);
  assert.equal(verifyReleaseEnvironment({ ...environment, name: 'Production' }, [{ name: 'main', type: 'branch' }], policy), true);
  assert.throws(() => verifyReleaseEnvironment({ ...environment, name: 'Preview' }, [{ name: 'main', type: 'branch' }], policy));
  assert.throws(() => verifyReleaseEnvironment({ ...environment, can_admins_bypass: true }, [{ name: 'main', type: 'branch' }], policy));
  assert.throws(() => verifyReleaseEnvironment(environment, [{ name: '*', type: 'branch' }], policy));
  assert.equal(PRODUCTION_ENABLED, false);
  assert.throws(() => productionCommands({ enable: true, VERCEL_TOKEN: 'FAKE_PRIVATE_TOKEN' }));
});

test('CD verifies canonical Git bytes across CRLF checkouts and rejects detector/fixture drift', () => {
  const root = mkdtempSync(join(tmpdir(), 'pos-ci-canonical-'));
  checkoutGit(root, ['init', '--quiet', '--initial-branch=main']);
  writeFileSync(join(root, 'checker.txt'), 'checker\r\nfixture\r\n');
  const blob = checkoutGit(root, ['-c', 'core.autocrlf=true', 'hash-object', '-w', '--path=checker.txt', 'checker.txt']).trim();
  const canonical = execFileSync('git', ['-C', root, 'cat-file', 'blob', blob], { stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(canonical.toString(), 'checker\nfixture\n');
  const policy = { trustedFiles: { 'ui-audit/audit.js': hash(canonical), 'ui-audit/demo-buggy.html': hash(canonical) } };
  const files = Object.fromEntries(Object.keys(policy.trustedFiles).map(path => [path, canonical]));
  assert.equal(verifyReleaseFiles(files, policy), true);
  for (const path of Object.keys(files)) assert.throws(() => verifyReleaseFiles({ ...files, [path]: Buffer.from('changed') }, policy));
  assert.throws(() => verifyReleaseFiles(Object.fromEntries(Object.keys(files).map(path => [path, readFileSync(join(root, 'checker.txt'))])), policy));
});
