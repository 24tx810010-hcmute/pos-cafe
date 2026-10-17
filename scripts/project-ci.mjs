// GitHub Linux only. Raw subprocess output stays on the disposable runner.
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, mkdtempSync, lstatSync, readdirSync, statfsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { hash, sourceBinding, vitestCounts, nodeCounts, smokeCounts, uiCounts, publicSummary, privateDiagnostics } from './project-ci-results.mjs';

const GiB = 1024 ** 3;
const refuse = () => { throw new Error('PROJECT_CI_GUARD'); };
export function trackedFingerprint(root, paths) {
  return hash(paths.map(path => path + '\0' + hash(readFileSync(join(root, path))) + '\0').join(''));
}

export function lightEnvironment(task, inherited) {
  mkdirSync(join(task, 'home')); mkdirSync(join(task, 'tmp'));
  for (const name of ['npm-user.conf', 'npm-global.conf']) writeFileSync(join(task, name), '', { flag: 'wx', mode: 0o600 });
  const env = Object.fromEntries(['PATH', 'LANG', 'LC_ALL', 'TZ', 'SystemRoot'].filter(key => inherited[key]).map(key => [key, inherited[key]]));
  return Object.assign(env, { HOME: join(task, 'home'), TMPDIR: join(task, 'tmp'), TMP: join(task, 'tmp'), TEMP: join(task, 'tmp'),
    CI: 'true', NO_COLOR: '1', NODE_OPTIONS: '--max-old-space-size=1536',
    NPM_CONFIG_CACHE: join(task, 'npm-cache'), NPM_CONFIG_USERCONFIG: join(task, 'npm-user.conf'), NPM_CONFIG_GLOBALCONFIG: join(task, 'npm-global.conf'),
    NPM_CONFIG_FETCH_RETRIES: '0', PLAYWRIGHT_BROWSERS_PATH: join(task, 'browsers'),
    VITE_DATA_MODE: 'mock', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' });
}

export function checkoutGit(root, args) {
  // The bounded root service reads the runner-owned checkout, never arbitrary
  // repositories. Trust only this exact directory; capture errors privately.
  return execFileSync('git', ['-c', `safe.directory=${root}`, '-C', root, ...args],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 ** 2, stdio: ['ignore', 'pipe', 'pipe'] });
}

export function allocatedBytes(roots) {
  const seen = new Set(); let bytes = 0;
  const walk = path => {
    const item = lstatSync(path, { throwIfNoEntry: false });
    if (!item || item.isSymbolicLink()) return;
    const key = `${item.dev}:${item.ino}`;
    if (seen.has(key)) return;
    seen.add(key);
    bytes += item.blocks === undefined ? item.size : item.blocks * 512;
    if (item.isDirectory()) {
      let names; try { names = readdirSync(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
      for (const name of names) if (name !== '.git') walk(join(path, name));
    }
  };
  for (const root of roots) walk(root);
  return bytes;
}

export async function capturedCommand(command, args, { cwd, env, output, guard, timeoutMs = 480000, maxBytes = 32 * 1024 ** 2 }) {
  guard();
  // A fresh file, never a pre-existing report from an earlier run/attempt.
  writeFileSync(output, '', { flag: 'wx', mode: 0o600 });
  return new Promise(resolveResult => {
    const child = spawn(command, args, { cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let size = 0, blocked = false, settled = false, escalation;
    const stop = () => {
      blocked = true;
      try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGTERM'); } catch { /* already exited */ }
      escalation ??= setTimeout(() => {
        try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL'); } catch { /* already exited */ }
      }, 5000);
    };
    const record = chunk => {
      size += chunk.length;
      if (size > maxBytes) stop();
      else if (!blocked) appendFileSync(output, chunk);
    };
    child.stdout.on('data', record); child.stderr.on('data', record);
    const monitor = setInterval(() => { try { guard(); } catch { stop(); } }, 5000);
    const deadline = setTimeout(stop, timeoutMs);
    const finish = code => {
      if (settled) return; settled = true;
      clearInterval(monitor); clearTimeout(deadline);
      // A killed group must remain under escalation until every descendant dies.
      clearTimeout(escalation);
      resolveResult({ exitCode: Number.isInteger(code) ? code : null, blocked });
    };
    child.on('error', () => { stop(); finish(null); });
    child.on('close', finish);
  });
}

export async function main() {
  if (process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true'
    || process.env.RUNNER_ENVIRONMENT !== 'github-hosted' || process.version !== 'v24.16.0') refuse();
  const root = resolve(process.cwd());
  const git = args => checkoutGit(root, args);
  if (git(['status', '--porcelain', '--untracked-files=all']).trim()) refuse();
  const paths = git(['ls-files', '-z']).split('\0').filter(Boolean).sort();
  const backendOnly = JSON.parse(readFileSync(join(root, 'ci/backend-only-tests.json'), 'utf8'));
  if (!Array.isArray(backendOnly) || backendOnly.length !== 1 || backendOnly.some(item =>
    !paths.includes(item.file) || !/^tests\/[A-Za-z0-9_./-]+\.tool\.test\.ts$/.test(item.file)
    || hash(readFileSync(join(root, item.file))) !== item.sourceSHA256 || item.requiresRealBackend !== true)) refuse();
  if (paths.some(path => /(^|\/)\.env(?:$|\.)/.test(path) && !path.endsWith('.env.example'))) refuse();
  const binding = sourceBinding(process.env, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')), git(['rev-parse', 'HEAD']).trim());
  const unit = `pos-cafe-light-r${binding.runId}-a${binding.attempt}.service`;
  const cgroup = `/sys/fs/cgroup/system.slice/${unit}`;
  const limits = { 'cpu.max': '300000 100000', 'memory.max': String(8 * GiB), 'memory.swap.max': '0', 'pids.max': '1024' };
  if (!readFileSync('/proc/self/cgroup', 'utf8').trim().endsWith(`/system.slice/${unit}`)) refuse();
  for (const [name, value] of Object.entries(limits)) if (readFileSync(join(cgroup, name), 'utf8').trim() !== value) refuse();
  const fingerprints = { source: trackedFingerprint(root, paths), lock: hash(readFileSync(join(root, 'package-lock.json'))) };
  const task = mkdtempSync(join(process.env.RUNNER_TEMP, `pos-light-${binding.runId}-${binding.attempt}-`));
  const env = lightEnvironment(task, process.env);
  let peak = 0;
  const guard = () => {
    for (const path of [root, task]) { const disk = statfsSync(path); if (disk.bavail * disk.bsize < 30 * GiB) refuse(); }
    peak = Math.max(peak, allocatedBytes([root, task]));
    if (peak > 5 * GiB) refuse();
    for (const [name, value] of Object.entries(limits)) if (readFileSync(join(cgroup, name), 'utf8').trim() !== value) refuse();
  };
  const rows = [];
  const phase = async (id, command, args, readCounts, diagnosticReport) => {
    const started = Date.now(), output = join(task, `${id}.log`);
    const invocationSHA = hash(JSON.stringify({ runId: binding.runId, attempt: binding.attempt, id, command, args,
      sourceFingerprint: fingerprints.source, lockSHA: fingerprints.lock }));
    let result = { exitCode: null, blocked: true }, counts = null, valid = false;
    try {
      result = await capturedCommand(command, args, { cwd: root, env, output, guard });
      if (!result.blocked && readCounts) counts = readCounts(readFileSync(output, 'utf8'));
      if (trackedFingerprint(root, paths) !== fingerprints.source) refuse();
      valid = !result.blocked && result.exitCode === 0;
    } catch { valid = false; }
    const info = lstatSync(output, { throwIfNoEntry: false });
    const reportSHA = info?.isFile() ? hash(readFileSync(output)) : null;
    let diagnostic = null;
    if (!valid && info?.isFile()) {
      let report = null; try { report = diagnosticReport ? json(diagnosticReport) : null; } catch { /* missing report stays unknown */ }
      diagnostic = privateDiagnostics(readFileSync(output, 'utf8'), report, paths, root);
    }
    rows.push({ id, status: valid ? 'PASS' : 'FAIL', exitCode: result.exitCode, elapsedMs: Date.now() - started, counts, invocationSHA, reportSHA, diagnostic });
    console.log(`PROJECT_CI_PHASE ${id} ${valid ? 'PASS' : 'FAIL'}`);
    if (!valid) refuse();
  };
  const json = name => {
    const file = join(task, `${name}.json`), info = lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 32 * 1024 ** 2) refuse();
    return JSON.parse(readFileSync(file, 'utf8'));
  };
  try {
    await phase('install', 'npm', ['ci', '--no-fund']);
    await phase('build', 'npm', ['run', 'build']);
    await phase('unit', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--coverage', '--maxWorkers=2', '--retry=0',
      '--reporter=json', `--outputFile=${join(task, 'unit.json')}`], () => vitestCounts(json('unit'), paths.filter(path => /^src\/.*\.(?:test|spec)\.tsx?$/.test(path)), root), 'unit');
    await phase('tooling', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config=vitest.project-tooling.config.ts',
      '--reporter=json', `--outputFile=${join(task, 'tooling.json')}`], () => vitestCounts(json('tooling'), paths.filter(path => /^tests\/.*\.tool\.test\.(?:ts|mjs)$/.test(path)), root, backendOnly), 'tooling');
    await phase('node-tools', process.execPath, ['--test', '--test-concurrency=2', '--test-reporter=tap', ...paths.filter(path => /^scripts\/.*\.test\.mjs$/.test(path))], nodeCounts);
    await phase('browser', process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium', '--only-shell']);
    // JSON reporter uses its explicit file rather than public stdout.
    env.PLAYWRIGHT_JSON_OUTPUT_NAME = join(task, 'smoke-discovery.json');
    await phase('smoke-discovery', process.execPath, ['node_modules/playwright/cli.js', 'test', '--list', '--reporter=json']);
    env.PLAYWRIGHT_JSON_OUTPUT_NAME = join(task, 'smoke.json');
    await phase('smoke', process.execPath, ['node_modules/playwright/cli.js', 'test', '--workers=2', '--retries=0', '--forbid-only', '--reporter=json'],
      () => smokeCounts(json('smoke'), json('smoke-discovery'), JSON.parse(readFileSync(join(root, 'ci/smoke-applicability.json'), 'utf8'))));
    delete env.PLAYWRIGHT_JSON_OUTPUT_NAME;
    await phase('ui-selftest', process.execPath, ['ui-audit/run.mjs', '--selftest'], output => {
      if (!output.includes('selftest OK') || !/^selftest: 23 finding\(s\)/m.test(output)) refuse();
      return { detectedFindings: 23 };
    });
    await phase('ui-audit', process.execPath, ['ui-audit/run.mjs'], output => uiCounts(output,
      JSON.parse(readFileSync(join(root, 'ui-audit/report.json'), 'utf8')), JSON.parse(readFileSync(join(root, 'ui-audit/config.json'), 'utf8'))));
  } catch { /* Fixed phase status only; never echo raw errors. */ }
  const summary = { ...publicSummary(binding, rows, fingerprints), sourcePreserved: trackedFingerprint(root, paths) === fingerprints.source,
    peakOwnedBytes: peak, operatingCapBytes: 5 * GiB, minimumFreeBytes: 30 * GiB };
  if (!summary.sourcePreserved) summary.overallStatus = 'FAIL';
  const rendered = JSON.stringify(summary, null, 2);
  if (Buffer.byteLength(rendered) > 65536) refuse();
  console.log(rendered);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `# POS light CI\n\nScope: LIGHT_MOCK_ONLY\n\n\`\`\`json\n${rendered}\n\`\`\`\n`);
  if (summary.overallStatus !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.log('PROJECT_CI_BLOCKED'); process.exitCode = 1; });
}
