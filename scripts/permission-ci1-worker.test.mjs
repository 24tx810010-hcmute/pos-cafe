import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ci1Identity } from './permission-ci1-policy.mjs';
import { ci1WorkerPlan, runCi1Worker, ci1EdgeCacheProof, ci1PublicExport, ci1EdgeBundleArguments,
  ci1AcquireDaemons, ci1CloseDaemons, ci1TerminateDaemon, ci1FailureExport } from './permission-ci1-worker.mjs';
import { renderCi1Evidence } from './permission-ci1-evidence.mjs';

// Every Linux fact, adapter and cache below is fake unit data. No Linux/DB/CI is started.
const identity = ci1Identity('12345', 1);
const proof = () => ({ platform: 'linux', arch: 'x64', root: true, wsl: false, authorized: true,
  githubHosted: true, publicRepository: true, manual: true, repository: 'nguyentronglinh045/pos-cafe-ci-preflight', cpus: 4,
  memoryBytes: 16 * 1024 ** 3, cgroup: `/system.slice/${identity.unit}/supervisor`, cpuMax: '300000 100000',
  memoryMax: String(10 * 1024 ** 3), swapMax: '0', pidsMax: '2048', runtime: '30min', stop: '30s', kill: 'control-group',
  stdout: 'null', stderr: 'null', oom: 0, pidsEvents: 0, hostFreeBytes: 60 * 1024 ** 3 });
const adapter = () => { const calls = []; return { calls, supervisor: () => proof(), stage: async name => { calls.push(name); return true; },
  close: async () => { calls.push('close'); return true; } }; };

test('worker plan applies caps before writes and separates network cache warm from offline service tests', () => {
  const plan = ci1WorkerPlan('12345', 1);
  assert.equal(plan.mode, 'LOCAL_PREPARATION_ONLY'); assert.equal(plan.executionAuthorized, false);
  assert.ok(plan.launchPrefix.includes('--property=CPUQuota=300%'));
  assert.ok(plan.launchPrefix.includes('--property=DelegateSubgroup=supervisor'));
  assert.ok(plan.stages.indexOf('stop-prefetch') < plan.stages.indexOf('offline-edge'));
  assert.ok(plan.stages.indexOf('offline-edge') < plan.stages.indexOf('harness'));
});

test('fake worker completes fixed order but never invents business counts', async () => {
  const fake = adapter(), result = await runCi1Worker(fake, identity);
  assert.equal(result.status, 'COMPLETE'); assert.equal(result.businessCounts, null);
  assert.deepEqual(fake.calls, [...ci1WorkerPlan('12345', 1).stages.slice(1), 'close']);
});

test('Edge bundle primes an empty no-copy cache and uses no network in offline verification', () => {
  const layout = ci1WorkerPlan('12345', 1).layout;
  const argv = ci1EdgeBundleArguments(layout, 'public.ecr.aws/supabase/edge-runtime:v1.74.3', 'none', 'offline1', 'menu-image-public', 0);
  assert.equal(argv[argv.indexOf('--network') + 1], 'none');
  assert.ok(argv.some(value => value.endsWith('/root/.cache/deno,volume-nocopy')));
  assert.ok(argv.includes('bundle')); assert.ok(!argv.includes('--rm'));
  assert.ok(argv.some(value => value.endsWith(',readonly')));
  assert.throws(() => ci1EdgeBundleArguments(layout, 'image', 'bridge', 'offline1', 'menu-image-public', 0));
});

test('hardware or any setup/cache/harness failure stops dependent work and still closes owned resources', async () => {
  const invalid = adapter(); invalid.supervisor = () => ({ ...proof(), cpuMax: 'max 100000' });
  assert.equal((await runCi1Worker(invalid, identity)).status, 'ERROR'); assert.deepEqual(invalid.calls, ['close']);
  for (const failed of ci1WorkerPlan('12345', 1).stages.slice(1)) {
    const fake = adapter(); fake.stage = async name => { fake.calls.push(name); if (name === failed) throw new Error('FAKE_UNIT_SECRET'); return true; };
    const result = await runCi1Worker(fake, identity);
    assert.equal(result.status, 'ERROR'); assert.equal(JSON.stringify(result).includes('FAKE_UNIT_SECRET'), false);
    assert.equal(fake.calls.at(-1), 'close'); assert.equal(fake.calls.at(-2), failed);
  }
  const close = adapter(); close.close = async () => false;
  assert.equal((await runCi1Worker(close, identity)).status, 'ERROR');
});

test('worker failure reports finite stage/operation/command and teardown without subprocess secrets', async () => {
  const fake = adapter(); fake.operation = () => 'SOURCE_CLONE';
  fake.stage = async name => { if (name === 'source-tools') throw Object.assign(new Error('FAKE_UNIT_SECRET'),
    {status:128,ci1Command:'git',stderr:'FAKE_UNIT_SECRET'}); return true; };
  const result = await runCi1Worker(fake,identity);
  assert.equal(result.status,'ERROR'); assert.equal(result.cleanup,true);
  assert.deepEqual(result.completed,['loop']);
  assert.deepEqual(result.failure,{stage:'source-tools',operation:'SOURCE_CLONE',code:'COMMAND_FAILED',command:'git',exitCode:128});
  assert.equal(JSON.stringify(result).includes('FAKE_UNIT_SECRET'),false);
  const safe = ci1FailureExport({stage:'FAKE_UNIT_SECRET',operation:'FAKE_UNIT_SECRET',code:'FAKE_UNIT_SECRET',
    command:'FAKE_UNIT_SECRET',exitCode:-1,raw:'FAKE_UNIT_SECRET'});
  assert.equal(JSON.stringify(safe).includes('FAKE_UNIT_SECRET'),false);
  assert.equal(safe.code,'UNKNOWN'); assert.equal(safe.exitCode,null);
});

test('daemon acquisition retains each child before PID-write/readiness/second-spawn failures', async () => {
  for (const phase of ['pid-write', 'ready', 'second-spawn']) {
    const children = [], stopped = [];
    await assert.rejects(ci1AcquireDaemons({
      start: name => { if (name === 'dockerd' && phase === 'second-spawn') throw new Error();
        const child = { name, pid: 100 + children.length }; children.push(child); return child; },
      prepareContainerd: () => { if (phase === 'pid-write') throw new Error(); },
      ready: async () => { if (phase === 'ready') throw new Error(); },
      stop: pair => ci1CloseDaemons(pair, async (name, child) => { stopped.push(child); }),
    }), { message: 'CI1_WORKER_REFUSED' });
    assert.deepEqual(stopped, children); assert.equal(stopped.length, 1);
  }
});

test('daemon cleanup attempts the second owned child even if the first stop fails', async () => {
  const names = [], pair = { dockerd: { pid: 101 }, containerd: { pid: 100 } };
  await assert.rejects(ci1CloseDaemons(pair, async name => { names.push(name); if (name === 'dockerd') throw new Error(); }));
  assert.deepEqual(names, ['dockerd', 'containerd']);
  assert.equal(await ci1CloseDaemons({}, () => { throw new Error(); }), true);
});

test('owned daemon TERM timeout escalates only after a new ownership proof and requires KILL exit', async () => {
  const fake = waits => { const calls = []; return { calls, exited: () => false,
    prove: () => { calls.push('proof'); }, signal: value => { calls.push(value); },
    wait: async milliseconds => { calls.push(milliseconds); return waits.shift(); } }; };
  const term = fake([true]); assert.equal(await ci1TerminateDaemon(term), true);
  assert.deepEqual(term.calls, ['proof', 'SIGTERM', 10000]);
  const kill = fake([false, true]); assert.equal(await ci1TerminateDaemon(kill), true);
  assert.deepEqual(kill.calls, ['proof', 'SIGTERM', 10000, 'proof', 'SIGKILL', 5000]);
  const timeout = fake([false, false]); await assert.rejects(ci1TerminateDaemon(timeout));
  const drift = fake([false]); let proofs = 0;
  drift.prove = () => { if (++proofs === 2) throw new Error('ownership lost'); };
  await assert.rejects(ci1TerminateDaemon(drift)); assert.equal(drift.calls.includes('SIGKILL'), false);
  const exited = fake([]); exited.exited = () => true;
  assert.equal(await ci1TerminateDaemon(exited), true); assert.deepEqual(exited.calls, []);
});

function cacheFixture() {
  const pin = JSON.parse(readFileSync(new URL('../tests/permissions/runtime/ci1-edge.json', import.meta.url), 'utf8'))
    .packages.find(item => item.name === '@supabase/supabase-js');
  const expected = { schemaVersion: 'permission-ci1-edge-v1', root: '@supabase/supabase-js@2.45.0', packages: [pin] };
  const folder = '/cache/npm/registry.npmjs.org/@supabase/supabase-js';
  const entries = new Map([
    ['/cache/npm/registry.npmjs.org', ['@supabase']], ['/cache/npm/registry.npmjs.org/@supabase', ['supabase-js']],
    [folder, ['registry.json', '2.45.0']], [`${folder}/2.45.0`, ['index.js']],
    [`${folder}/registry.json`, JSON.stringify({ name: pin.name, versions: { '2.45.0': { version: pin.version,
      dist: { integrity: pin.integrity, tarball: pin.tarball }, dependencies: pin.dependencies } } })],
    [`${folder}/2.45.0/index.js`, 'fake-unit-module'],
  ]);
  const read = { list: path => { const item = entries.get(path); if (!Array.isArray(item)) throw new Error(); return [...item]; },
    stat: path => { const item = entries.get(path); if (item === undefined) throw new Error();
      return { isDirectory: () => Array.isArray(item), isFile: () => typeof item === 'string', isSymbolicLink: () => false,
        size: typeof item === 'string' ? Buffer.byteLength(item) : 0 }; },
    read: path => { const item = entries.get(path); if (typeof item !== 'string') throw new Error(); return item; } };
  return { pin, expected, folder, entries, read };
}

test('fresh Edge cache proof requires pinned resolved version/SRI and detects file drift or incomplete extraction', () => {
  const fake = cacheFixture(), before = ci1EdgeCacheProof('/cache', fake.expected, fake.read);
  assert.deepEqual(before.observed, ['@supabase/supabase-js@2.45.0']);
  fake.entries.set(`${fake.folder}/2.45.0/index.js`, 'changed-unit-data');
  assert.notEqual(ci1EdgeCacheProof('/cache', fake.expected, fake.read).sha256, before.sha256);
  fake.entries.set(`${fake.folder}/2.45.0`, ['.deno_sync_lock']);
  assert.throws(() => ci1EdgeCacheProof('/cache', fake.expected, fake.read));
  const mismatch = cacheFixture(); const metadata = JSON.parse(mismatch.entries.get(`${mismatch.folder}/registry.json`));
  metadata.versions['2.45.0'].dist.integrity = 'FAKE_UNIT_SECRET';
  mismatch.entries.set(`${mismatch.folder}/registry.json`, JSON.stringify(metadata));
  assert.throws(() => ci1EdgeCacheProof('/cache', mismatch.expected, mismatch.read));
  const extra = cacheFixture(); extra.entries.set(extra.folder, ['registry.json', '2.45.0', '2.46.0']);
  assert.throws(() => ci1EdgeCacheProof('/cache', extra.expected, extra.read));
});

test('Edge cache refuses unreviewed peer copies, unknown entries and package/version/metadata symlinks', () => {
  for (const name of ['2.45.0_1', '2.45.0-beta.1', 'unreviewed']) {
    const fake = cacheFixture(); fake.entries.set(fake.folder, ['registry.json', '2.45.0', name]);
    fake.entries.set(`${fake.folder}/${name}`, ['index.js']); fake.entries.set(`${fake.folder}/${name}/index.js`, 'unaccounted');
    assert.throws(() => ci1EdgeCacheProof('/cache', fake.expected, fake.read));
  }
  for (const suffix of ['', '/2.45.0', '/registry.json']) {
    const fake = cacheFixture(), stat = fake.read.stat;
    fake.read.stat = path => ({ ...stat(path), isSymbolicLink: () => path === fake.folder + suffix });
    assert.throws(() => ci1EdgeCacheProof('/cache', fake.expected, fake.read));
  }
});

test('public export regenerates D12 schema/Markdown and rejects raw or forged derived fields', () => {
  const input = { repository: 'nguyentronglinh045/pos-cafe-ci-preflight', runId: '12345', attempt: 1,
    workflowSHA: '1'.repeat(40), sourceSHA: '2'.repeat(40), sourceFingerprint: '3'.repeat(64), lockSHA: '4'.repeat(64),
    versions: { node: '24.16.0', npm: '11.13.0', supabase: '2.117.0' },
    startedAt: '2026-10-16T00:00:00.000Z', finishedAt: '2026-10-16T00:00:01.000Z',
    checks: { bootstrap: 'NOT_RUN', auth: 'NOT_RUN', apiBinding: 'NOT_RUN', sourcePreservation: 'NOT_RUN', cleanup: 'NOT_RUN' },
    suites: ['T09', 'T10'].map(id => ({ id, status: 'NOT_RUN', exitCode: null, counts: null })) };
  const evidence = JSON.parse(renderCi1Evidence(input).json);
  assert.equal(JSON.parse(ci1PublicExport(evidence).json).overallStatus, 'NOT_RUN');
  assert.throws(() => ci1PublicExport({ ...evidence, raw: 'FAKE_UNIT_SECRET' }), { message: 'CI1_WORKER_REFUSED' });
  assert.throws(() => ci1PublicExport({ ...evidence, overallStatus: 'PASS' }), { message: 'CI1_WORKER_REFUSED' });
});

test('CLI plan is side-effect free; effectful entry refuses Windows before any layout creation', () => {
  const plan = spawnSync(process.execPath, ['scripts/permission-ci1-worker.mjs', 'plan', '12345', '1'], { encoding: 'utf8' });
  assert.equal(plan.status, 0); assert.equal(JSON.parse(plan.stdout).executionAuthorized, false);
  if (process.platform === 'win32') {
    const run = spawnSync(process.execPath, ['scripts/permission-ci1-worker.mjs', 'launch', 'D:/Workspace/pos-cafe'], { encoding: 'utf8' });
    assert.equal(run.status, 78); assert.equal(run.stderr.trim(), 'CI1_WORKER_BLOCKED'); assert.equal(run.stdout, '');
  }
});
