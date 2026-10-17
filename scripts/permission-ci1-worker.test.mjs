import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ci1Identity } from './permission-ci1-policy.mjs';
import { ci1WorkerPlan, runCi1Worker, ci1EdgeCacheProof, ci1PublicExport, ci1EdgeBundleArguments,
  ci1AcquireDaemons, ci1CloseDaemons, ci1TerminateDaemon, ci1FailureExport, ci1DockerFailureCode,
  ci1OwnedMountCount, ci1UnmountFailureCode, ci1IsolatedFailure, ci1IsolatedError, ci1PullImage } from './permission-ci1-worker.mjs';
import { renderCi1Evidence } from './permission-ci1-evidence.mjs';
import { backendEvidence, backendFailureEvidence } from './project-backend.mjs';

// Every Linux fact, adapter and cache below is fake unit data. No Linux/DB/CI is started.
const identity = ci1Identity('12345', 1);
const proof = () => ({ platform: 'linux', arch: 'x64', root: true, wsl: false, authorized: true,
  githubHosted: true, publicRepository: true, manual: true, repository: 'nguyentronglinh045/pos-cafe-ci-preflight', cpus: 4,
  memoryBytes: 16 * 1024 ** 3, cgroup: `/system.slice/${identity.unit}/supervisor`, cpuMax: '300000 100000',
  memoryMax: String(10 * 1024 ** 3), swapMax: '0', pidsMax: '2048', runtime: '30min', stop: '30s', kill: 'control-group',
  stdout: 'null', stderr: 'null', oom: 0, pidsEvents: 0, hostFreeBytes: 60 * 1024 ** 3 });
const adapter = () => { const calls = []; return { calls, supervisor: () => proof(), stage: async name => { calls.push(name); return true; },
  close: async () => { calls.push('close'); return true; } }; };

test('isolated failure receipts bind run, attempt and source and reject raw or unknown fields', () => {
  const sourceSHA='a'.repeat(40), failure={stage:'offline-edge',operation:'STACK_START',code:'COMMAND_FAILED',command:'supabase',exitCode:1};
  const record={schemaVersion:'permission-ci1-isolated-failure-v1',runId:identity.runId,attempt:identity.attempt,sourceSHA,failure,cleanupFailure:null};
  assert.deepEqual(ci1IsolatedFailure(record,identity,sourceSHA),{failure,cleanupFailure:null});
  for(const delta of [{runId:'999'},{attempt:2},{sourceSHA:'b'.repeat(40)},{raw:'FAKE_UNIT_SECRET'},
    {failure:null},{failure:{...failure,operation:'FAKE_UNIT_SECRET'}},{failure:{...failure,facts:{raw:'FAKE_UNIT_SECRET'}}},
    {failure:{...failure,exitCode:-1}},{cleanupFailure:{...failure,stage:'offline-edge'}}])
    assert.throws(()=>ci1IsolatedFailure({...record,...delta},identity,sourceSHA));
});

test('inner primary and teardown failures stay separate and cannot be replaced by successful outer cleanup', async () => {
  const sourceSHA='a'.repeat(40), record={schemaVersion:'permission-ci1-isolated-failure-v1',runId:identity.runId,
    attempt:identity.attempt,sourceSHA,failure:{stage:'offline-edge',operation:'OFFLINE_BUNDLE1',code:'DOCKER_NETWORK',command:'docker',exitCode:1},
    cleanupFailure:{stage:'cleanup',operation:'ISOLATED_STOP_DAEMONS',code:'CONTROL_REFUSED',command:null,exitCode:null}};
  const inner=ci1IsolatedError(record,identity,sourceSHA), fake=adapter();let operation=null;
  fake.operation=()=>operation;fake.stage=async name=>{if(name==='offline-edge'){operation=inner.operation;throw inner.error;}return true;};
  const result=await runCi1Worker(fake,identity);
  assert.equal(result.status,'ERROR');assert.equal(result.cleanup,true);assert.equal(result.businessCounts,null);
  assert.equal(result.failure.operation,'OFFLINE_BUNDLE1');assert.equal(result.failure.code,'DOCKER_NETWORK');
  assert.deepEqual(result.failure.facts,{isolatedFailureSeen:1,isolatedCleanupFailed:1});
  assert.equal(JSON.stringify(result).includes('FAKE_UNIT_SECRET'),false);
  const cleanupOnly=ci1IsolatedError({...record,failure:null},identity,sourceSHA);
  assert.equal(cleanupOnly.operation,'ISOLATED_STOP_DAEMONS');assert.equal(cleanupOnly.error.ci1FailureCode,'CONTROL_REFUSED');
});

test('Docker failures expose bounded fixed categories and image ordinal without raw stderr', async () => {
  assert.equal(ci1DockerFailureCode('FAKE_UNIT_SECRET: no space left on device'), 'DOCKER_NO_SPACE');
  assert.equal(ci1DockerFailureCode('manifest unknown: FAKE_UNIT_SECRET'), 'DOCKER_REGISTRY_NOT_FOUND');
  assert.equal(ci1DockerFailureCode('client version 1.43 is too old. Minimum supported API version is 1.44'), 'DOCKER_API_VERSION');
  assert.equal(ci1DockerFailureCode('FAKE_UNIT_SECRET'), null);
  assert.equal(ci1DockerFailureCode('no space left on device'+'x'.repeat(1024**2)), null);
  const fake=adapter(); fake.operation=()=> 'IMAGE_PULL'; fake.failureFacts=()=>({imageOrdinal:2,raw:'FAKE_UNIT_SECRET'});
  fake.stage=async()=>{throw Object.assign(new Error('FAKE_UNIT_SECRET'), {ci1FailureCode:'DOCKER_REGISTRY_AUTH',ci1Command:'docker',status:1});};
  const result=await runCi1Worker(fake,identity);
  assert.deepEqual(result.failure,{stage:'loop',operation:'IMAGE_PULL',code:'DOCKER_REGISTRY_AUTH',command:'docker',exitCode:1,facts:{imageOrdinal:2}});
  assert.equal(result.cleanup,true);assert.equal(JSON.stringify(result).includes('FAKE_UNIT_SECRET'),false);
});

test('pinned image pulls retry only rate limits with bounded guarded backoff, never tests or other failures', async () => {
  const reference='public.ecr.aws/supabase/postgres@sha256:'+'a'.repeat(64), calls=[], waits=[], attempts=[];let guards=0;
  const rate=()=>Object.assign(new Error('FAKE_UNIT_SECRET'),{ci1FailureCode:'DOCKER_REGISTRY_RATE_LIMIT'});
  const run=(command,args)=>{calls.push([command,args]);if(calls.length<3)throw rate();return 'ok';};
  assert.equal(await ci1PullImage(run,reference,()=>{guards++;},async ms=>{waits.push(ms);},n=>attempts.push(n)),reference);
  assert.deepEqual(attempts,[1,2,3]);assert.deepEqual(waits,[10000,30000]);assert.equal(guards,5);
  assert.ok(calls.every(([command,args])=>command==='docker'&&JSON.stringify(args)===JSON.stringify(['pull','--quiet','--platform','linux/amd64',reference])));
  let exhausted=0;await assert.rejects(ci1PullImage(()=>{exhausted++;throw rate();},reference,()=>{},async()=>{}));assert.equal(exhausted,4);
  for(const code of ['DOCKER_REGISTRY_AUTH','DOCKER_NETWORK','DOCKER_NO_SPACE',undefined]) {
    let count=0;await assert.rejects(ci1PullImage(()=>{count++;throw Object.assign(new Error('FAKE_UNIT_SECRET'),{ci1FailureCode:code});},reference,
      ()=>{},async()=>{assert.fail('non-rate error must not wait');}));assert.equal(count,1);
  }
  let count=0;await assert.rejects(ci1PullImage(()=>{count++;throw rate();},reference,()=>{if(count)throw new Error('guard');},async()=>{}));assert.equal(count,1);
  await assert.rejects(ci1PullImage(()=>assert.fail('arbitrary reference'), 'private/FAKE_UNIT_SECRET:latest'));
});

test('official image mirror is attempted once after three ECR rate failures with identical digest and platform', async () => {
  const reference='public.ecr.aws/supabase/postgres@sha256:'+'a'.repeat(64),mirror=reference.replace('public.ecr.aws/','ghcr.io/');
  const calls=[],attempts=[],waits=[];let guards=0;
  const rate=()=>Object.assign(new Error('FAKE_UNIT_SECRET'),{ci1FailureCode:'DOCKER_REGISTRY_RATE_LIMIT'});
  const result=await ci1PullImage((command,args)=>{calls.push([command,args]);if(calls.length<4)throw rate();},reference,()=>{guards++;},async ms=>waits.push(ms),n=>attempts.push(n));
  assert.equal(result,mirror);assert.deepEqual(attempts,[1,2,3,4]);assert.deepEqual(waits,[10000,30000]);assert.equal(guards,6);
  assert.deepEqual(calls.map(([command,args])=>[command,...args]),[reference,reference,reference,mirror].map(ref=>['docker','pull','--quiet','--platform','linux/amd64',ref]));
  let count=0;await assert.rejects(ci1PullImage(()=>{count++;throw rate();},reference,()=>{if(count===3)throw new Error('guard');},async()=>{}));assert.equal(count,3);
  for(const invalid of ['ghcr.io/supabase/postgres@sha256:'+'a'.repeat(64),'public.ecr.aws/other/postgres@sha256:'+'a'.repeat(64),reference+'?mirror=private',reference.replace('@sha256:',':')])
    await assert.rejects(ci1PullImage(()=>assert.fail('invalid registry'),invalid));
  const fake=adapter();fake.operation=()=> 'IMAGE_PULL';
  fake.failureFacts=()=>({imageOrdinal:1,imagePullAttempt:4,imageRegistryOrdinal:2,raw:'FAKE_UNIT_SECRET'});
  fake.stage=async()=>{throw rate();};
  const failureResult=await runCi1Worker(fake,identity);
  assert.deepEqual(failureResult.failure.facts,{imageOrdinal:1,imagePullAttempt:4,imageRegistryOrdinal:2});
  assert.equal(JSON.stringify(failureResult).includes('FAKE_UNIT_SECRET'),false);
});

test('worker plan applies caps before writes and separates network cache warm from offline service tests', () => {
  const plan = ci1WorkerPlan('12345', 1);
  assert.equal(plan.mode, 'LOCAL_PREPARATION_ONLY'); assert.equal(plan.executionAuthorized, false);
  assert.ok(plan.launchPrefix.includes('--property=CPUQuota=300%'));
  assert.ok(plan.launchPrefix.includes('--property=DelegateSubgroup=supervisor'));
  assert.ok(plan.stages.indexOf('stop-prefetch') < plan.stages.indexOf('offline-edge'));
  assert.ok(plan.stages.indexOf('offline-edge') < plan.stages.indexOf('harness'));
});

test('recursive teardown accepts only the exact owned loop tree and emits finite unmount reasons', () => {
  const tree = { target: '/task/volume', source: '/dev/loop7', children: [{ target: '/task/volume/docker/overlay2/x/merged', source: 'overlay' }] };
  assert.equal(ci1OwnedMountCount(tree, '/task/volume', '/dev/loop7'), 1);
  for (const target of ['/task/volume-other', '/task/volume/../outside', '/outside', '/task/volume/bad\n']) {
    const invalid = structuredClone(tree); invalid.children[0].target = target;
    assert.throws(() => ci1OwnedMountCount(invalid, '/task/volume', '/dev/loop7'));
  }
  assert.throws(() => ci1OwnedMountCount(tree, '/task/volume', '/dev/loop8'));
  assert.throws(() => ci1OwnedMountCount(tree, '/', '/dev/loop7'));
  assert.equal(ci1UnmountFailureCode('FAKE_UNIT_SECRET: target is busy'), 'UNMOUNT_BUSY');
  assert.equal(ci1UnmountFailureCode('FAKE_UNIT_SECRET: not mounted'), 'UNMOUNT_NOT_MOUNTED');
  assert.equal(ci1UnmountFailureCode('FAKE_UNIT_SECRET: permission denied'), 'UNMOUNT_PERMISSION');
  assert.equal(ci1UnmountFailureCode('FAKE_UNIT_SECRET'), null);
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
  assert.ok(argv.includes('bundle'));
  assert.ok(argv.some(value => value.endsWith(',readonly')));
  assert.ok(argv.includes('--rm'));
  assert.equal(argv[argv.indexOf('--ulimit') + 1], 'core=0:0');
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
  const facts = ci1FailureExport({code:'LOOP_REFUSED',facts:{loopAllocatedBytes:123,raw:'FAKE_UNIT_SECRET',loopFreeBytes:-1}});
  assert.deepEqual(facts.facts,{loopAllocatedBytes:123});
  assert.equal(JSON.stringify(facts).includes('FAKE_UNIT_SECRET'),false);
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

test('Edge cache and cleanup failures retain independent finite reasons without exporting metadata', async () => {
  const fixture=cacheFixture(),metadata=JSON.parse(fixture.entries.get(`${fixture.folder}/registry.json`));
  metadata.versions['2.45.0'].dist.integrity='FAKE_UNIT_SECRET';fixture.entries.set(`${fixture.folder}/registry.json`,JSON.stringify(metadata));
  let cacheError;try{ci1EdgeCacheProof('/cache',fixture.expected,fixture.read);}catch(error){cacheError=error;}
  assert.equal(cacheError.ci1FailureCode,'EDGE_CACHE_SRI');
  const fake=adapter();fake.operation=()=> 'EDGE_CACHE_PROOF';fake.stage=async()=>{throw cacheError;};
  fake.close=async()=>false;fake.cleanupFailure=()=>({stage:'cleanup',operation:'CLEANUP_UNMOUNT',code:'COMMAND_FAILED',command:'umount',exitCode:32,raw:'FAKE_UNIT_SECRET'});
  const result=await runCi1Worker(fake,identity);
  assert.equal(result.failure.code,'EDGE_CACHE_SRI');assert.equal(result.failure.facts.edgePackageOrdinal,1);
  assert.deepEqual(Object.fromEntries(Object.entries(result.failure.facts).filter(([k])=>k.startsWith('edgeVersion'))),
    {edgeVersionMajor:2,edgeVersionMinor:45,edgeVersionPatch:0,edgeVersionCopy:0});
  assert.deepEqual(result.cleanupFailure,{stage:'cleanup',operation:'CLEANUP_UNMOUNT',code:'COMMAND_FAILED',command:'umount',exitCode:32});
  assert.equal(result.cleanup,false);assert.equal(result.status,'ERROR');assert.equal(JSON.stringify(result).includes('FAKE_UNIT_SECRET'),false);
});

test('only explicitly reviewed optional metadata may lack installed package files and every byte remains hashed', () => {
  const pin = JSON.parse(readFileSync('tests/permissions/runtime/ci1-edge.json')).packages.find(item => item.name === 'bufferutil');
  const optional = () => {
    const f = cacheFixture(); f.expected.packages.push(pin); f.expected.metadataOnlyAllowed = ['bufferutil@4.1.0'];
    f.entries.set('/cache/npm/registry.npmjs.org', ['@supabase', 'bufferutil']);
    const folder = '/cache/npm/registry.npmjs.org/bufferutil'; f.entries.set(folder, ['registry.json']);
    f.entries.set(folder + '/registry.json', JSON.stringify({ name: pin.name, versions: { [pin.version]: {
      version: pin.version, dist: { integrity: pin.integrity, tarball: pin.tarball }, dependencies: pin.dependencies } } }));
    return { ...f, optionalFolder: folder };
  };
  const f = optional(), proof = ci1EdgeCacheProof('/cache', f.expected, f.read);
  assert.deepEqual(proof.metadataOnly, ['bufferutil@4.1.0']);
  assert.equal(proof.observed.includes('bufferutil@4.1.0'), false);
  assert.ok(proof.files.some(item => item.path === 'bufferutil/registry.json' && item.bytes > 0));
  f.entries.set(f.optionalFolder + '/registry.json', f.entries.get(f.optionalFolder + '/registry.json') + ' ');
  assert.notEqual(ci1EdgeCacheProof('/cache', f.expected, f.read).sha256, proof.sha256);
  for (const change of [x => { delete x.expected.metadataOnlyAllowed; }, x => { x.entries.set(x.optionalFolder, ['registry.json', 'unknown']); },
    x => { x.entries.set(x.folder, ['registry.json']); }, x => { x.entries.set(x.folder + '/2.45.0', []); }, x => {
      const value = JSON.parse(x.entries.get(x.optionalFolder + '/registry.json')); value.versions[pin.version].dist.integrity = 'FAKE_UNIT_SECRET';
      x.entries.set(x.optionalFolder + '/registry.json', JSON.stringify(value));
    }, x => { const stat = x.read.stat; x.read.stat = path => ({ ...stat(path), isSymbolicLink: () => path === x.optionalFolder + '/registry.json' }); }]) {
    const invalid = optional(); change(invalid); assert.throws(() => ci1EdgeCacheProof('/cache', invalid.expected, invalid.read));
  }
});

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

test('backend success independently requires outer teardown proof after a passing synthetic D12 fixture', () => {
  const env={GITHUB_REPOSITORY:'nguyentronglinh045/pos-cafe',GITHUB_RUN_ID:'12345',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'1'.repeat(40),GITHUB_WORKFLOW_SHA:'1'.repeat(40)};
  const input={repository:env.GITHUB_REPOSITORY,runId:'12345',attempt:1,workflowSHA:env.GITHUB_SHA,sourceSHA:env.GITHUB_SHA,
    sourceFingerprint:'2'.repeat(64),lockSHA:'3'.repeat(64),versions:{node:'24.16.0',npm:'11.13.0',supabase:'2.117.0'},
    startedAt:'2026-10-17T00:00:00.000Z',finishedAt:'2026-10-17T00:00:01.000Z',
    checks:Object.fromEntries(['bootstrap','auth','apiBinding','sourcePreservation','cleanup'].map(k=>[k,'PASS'])),
    suites:[['T09',1],['T10',3]].map(([id,n])=>({id,status:'PASS',exitCode:0,counts:{required:n,run:n,pass:n,fail:0,skip:0}}))};
  const evidence=JSON.parse(renderCi1Evidence(input).json),worker={schemaVersion:'permission-ci1-worker-status-v1',status:'COMPLETE',
    completed:ci1WorkerPlan('12345',1).stages.slice(1),businessCounts:null,cleanup:true,cleanupFailure:null};
  assert.equal(JSON.parse(backendEvidence(worker,evidence,env).json).overallStatus,'PASS');
  for(const delta of [{cleanup:false},{cleanupFailure:{stage:'cleanup'}},{status:'ERROR'},{completed:worker.completed.slice(1)}])
    assert.throws(()=>backendEvidence({...worker,...delta},evidence,env),{message:'BACKEND_PROOF_REFUSED'});
});

test('CLI plan is side-effect free; effectful entry refuses Windows before any layout creation', () => {
  const plan = spawnSync(process.execPath, ['scripts/permission-ci1-worker.mjs', 'plan', '12345', '1'], { encoding: 'utf8' });
  assert.equal(plan.status, 0); assert.equal(JSON.parse(plan.stdout).executionAuthorized, false);
  if (process.platform === 'win32') {
    const run = spawnSync(process.execPath, ['scripts/permission-ci1-worker.mjs', 'launch', 'D:/Workspace/pos-cafe'], { encoding: 'utf8' });
    assert.equal(run.status, 78); assert.equal(run.stderr.trim(), 'CI1_WORKER_BLOCKED'); assert.equal(run.stdout, '');
  }
});

test('failed backend can expose bound D12 failure counts but cannot satisfy the success gate', () => {
  const env={GITHUB_REPOSITORY:'nguyentronglinh045/pos-cafe',GITHUB_RUN_ID:'12345',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'1'.repeat(40),GITHUB_WORKFLOW_SHA:'1'.repeat(40)};
  const input={repository:env.GITHUB_REPOSITORY,runId:'12345',attempt:1,workflowSHA:env.GITHUB_SHA,sourceSHA:env.GITHUB_SHA,
    sourceFingerprint:'2'.repeat(64),lockSHA:'3'.repeat(64),versions:{node:'24.16.0',npm:'11.13.0',supabase:'2.117.0'},
    startedAt:'2026-10-17T00:00:00.000Z',finishedAt:'2026-10-17T00:00:01.000Z',
    checks:Object.fromEntries(['bootstrap','auth','apiBinding','sourcePreservation','cleanup'].map(k=>[k,'PASS'])),
    suites:[{id:'T09',status:'FAIL',exitCode:1,counts:{required:1,run:1,pass:0,fail:1,skip:0}},
      {id:'T10',status:'NOT_RUN',exitCode:null,counts:null}]};
  const evidence=JSON.parse(renderCi1Evidence(input).json),worker={schemaVersion:'permission-ci1-worker-status-v1',status:'ERROR',
    completed:ci1WorkerPlan('12345',1).stages.slice(1,7),businessCounts:null,cleanup:true,cleanupFailure:null,
    failure:{stage:'offline-edge',operation:'PILOT_HARNESS',code:'COMMAND_FAILED',command:'node',exitCode:1}};
  const safe=JSON.parse(backendFailureEvidence(worker,evidence,env).json);
  assert.equal(safe.overallStatus,'FAIL');assert.equal(safe.suites[0].counts.fail,1);assert.equal(safe.suites[1].counts,null);
  assert.equal(safe.totals.run,null);assert.throws(()=>backendEvidence(worker,evidence,env));
  for(const delta of [{repository:'nguyentronglinh045/pos-cafe-ci-preflight'},{runId:'999'},{attempt:2},
    {sourceSHA:'2'.repeat(40)},{workflowSHA:'2'.repeat(40)},{raw:'FAKE_UNIT_SECRET'},{overallStatus:'PASS'}])
    assert.throws(()=>backendFailureEvidence(worker,{...evidence,...delta},env));
  for(const delta of [{status:'COMPLETE'},{completed:worker.completed.slice(1)},{businessCounts:{}},{cleanup:false},
    {cleanupFailure:{stage:'cleanup'}},{failure:{...worker.failure,operation:'STACK_START'}}])
    assert.throws(()=>backendFailureEvidence({...worker,...delta},evidence,env));
  const passed=structuredClone(input);passed.suites=[['T09',1],['T10',3]].map(([id,n])=>
    ({id,status:'PASS',exitCode:0,counts:{required:n,run:n,pass:n,fail:0,skip:0}}));
  assert.throws(()=>backendFailureEvidence(worker,JSON.parse(renderCi1Evidence(passed).json),env));
});
