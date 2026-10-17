import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync,
  rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scanCanaryArtifactDirectory } from '../tests/contracts/permissionCanaryOracle.ts';
import { CANARY_SCENARIOS } from '../tests/contracts/permissionCanaryScenarioMatrix.ts';

const fail = code => { throw new Error(code); };

export function inspectTc18Outputs(root, controlFile, browserExit) {
  let records, reporter;
  try {
    records = readFileSync(controlFile, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    reporter = JSON.parse(readFileSync(join(root, 'browser-safe.json'), 'utf8'));
  } catch { fail('PIN_CANARY_OUTPUT_UNREADABLE'); }
  const required = [...CANARY_SCENARIOS, 'operator'];
  if (records.length !== required.length || new Set(records.map(row => row.scenario)).size !== required.length
    || records.some(row => !required.includes(row.scenario) || !Array.isArray(row.canaries)
      || !row.canaries.length || row.canaries.some(value => typeof value !== 'string' || value.length < 6)))
    fail('PIN_CANARY_CONTROL_INCOMPLETE');
  const canaries = [...new Set(records.flatMap(row => row.canaries))];
  if (!records.find(row => row.scenario === 'complete:denial').canaries.includes('123456'))
    fail('PIN_CANARY_DENIED_INPUT_MISSING');
  const requiredFiles = CANARY_SCENARIOS.flatMap(scenario => ['png', 'json']
    .map(extension => join(root, 'runtime', `${scenario.replace(':', '-')}.${extension}`)));
  requiredFiles.push(join(root, 'runtime', 'masked-completion.png'),
    join(root, 'runtime', 'complete-realtime-readiness.json'), join(root, 'runtime', 'recovery-realtime-readiness.json'),
    join(root, 'runtime', 'operator.png'), join(root, 'runtime', 'operator.json'),
    join(root, 'runner.log'), join(root, 'browser-safe.json'));
  if (requiredFiles.some(path => !existsSync(path))) fail('PIN_CANARY_ARTIFACT_MISSING');
  const artifacts = scanCanaryArtifactDirectory({ root, canaries });
  if (browserExit !== 0 || reporter.status !== 'PASS' || reporter.total !== 7 || reporter.passed !== 7
    || reporter.failed !== 0 || reporter.retried !== 0 || reporter.missing !== 0 || reporter.fatalCount !== 0)
    fail('PIN_CANARY_BROWSER_FAILED');
  return { status: 'PASS', browser: { total: 7, passed: 7, retried: 0, missing: 0 },
    scenarioCount: CANARY_SCENARIOS.length, operatorCaptureCount: 1,
    artifactScan: artifacts };
}

export function runTc18(output) {
  const root = resolve(output);
  const within = relative(resolve('artifacts'), root);
  if (!within || isAbsolute(within) || within.startsWith('..') || resolve('artifacts', within) !== root || existsSync(root))
    fail('PIN_CANARY_FRESH_OUTPUT_REQUIRED');
  mkdirSync(root, { recursive: true });
  const controlDirectory = mkdtempSync(join(tmpdir(), 'pos-cafe-tc18-control-'));
  const controlFile = join(controlDirectory, 'canaries.jsonl');
  writeFileSync(controlFile, '', { mode: 0o600 });
  const startedUtc = new Date().toISOString();
  let receipt;
  try {
    const log = openSync(join(root, 'runner.log'), 'wx', 0o600);
    let run;
    try {
      run = spawnSync(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test',
        '-c', 'playwright.pin-tc18.config.ts', '--workers=1', '--retries=0', '--forbid-only'], {
        cwd: process.cwd(), timeout: 25 * 60_000, stdio: ['ignore', log, log],
        env: { ...process.env, PIN_CANARY_CONTROL_FILE: controlFile,
          PIN_CANARY_ARTIFACT_DIR: join(root, 'runtime'), PIN_CANARY_OUTPUT_DIR: join(root, 'test-results'),
          PIN_CANARY_SAFE_FILE: join(root, 'browser-safe.json') },
      });
    } finally { closeSync(log); }
    if (run.error || run.signal) fail('PIN_CANARY_RUNNER_FAILED');
    receipt = inspectTc18Outputs(root, controlFile, run.status);
  } catch (error) {
    const code = error instanceof Error && /^(PIN_CANARY_|CANARY_)[A-Z_a-z]+$/.test(error.message)
      ? error.message : 'PIN_CANARY_RUN_FAILED';
    receipt = { status: 'FAIL', code };
  } finally {
    unlinkSync(controlFile);
    rmdirSync(controlDirectory);
  }
  receipt.startedUtc = startedUtc;
  receipt.endedUtc = new Date().toISOString();
  receipt.controlDeleted = true;
  writeFileSync(join(root, 'artifact-scan-safe.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const output = process.argv[2];
    if (!output || process.argv.length !== 3) fail('PIN_CANARY_OUTPUT_REQUIRED');
    const receipt = runTc18(output);
    process.stdout.write(`PIN_CANARY_ARTIFACT_${receipt.status}\n`);
    if (receipt.status !== 'PASS') process.exitCode = 1;
  } catch { process.stderr.write('PIN_CANARY_RUN_FAILED\n'); process.exitCode = 1; }
}
