import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { CI1_LIMITS, CI1_PROJECT, CI1_RUNTIME, CI1_SUITES, assertCi1Envelope, assertCi1WriteBoundary, ci1ProcessEnvironment, ci1Identity, ci1Invocation, ci1SuiteResult } from './permission-ci1-policy.mjs';
import { runCi1Pilot, ci1LinuxRecipe, ci1ContainersCoreDisabled, ci1SystemdProperty, ci1HarnessFailureMarker, ci1HarnessFailureFacts } from './permission-ci1-harness.mjs';
import { summarizeCi1Modules } from './permission-ci1-vitest-reporter.mjs';
import { ci1SuiteDiagnostic, ci1SuiteFailureMarker, ci1SuiteFailureFacts, ci1PreservationMask, ci1PreservationFacts } from './permission-ci1-diagnostics.mjs';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { assertCi1Supervisor } from './permission-ci1-intake.mjs';
import { runCi1Worker, ci1FailureExport } from './permission-ci1-worker.mjs';

// All adapters/proofs below are fake unit data. No Linux/DB/CI operation is run.
const identity = ci1Identity('12345', 1);

test('failed teardown projection retains finite hook origin and cleanup step without private error text', () => {
  const error={message:'PRIVATE_SECRET',stack:'PRIVATE_SECRET',permissionCleanupDiagnostics:[{
    phase:'database-surface',step:'restore-functions',code:'IMAGE_CLEANUP_STEP_FAILED',sqlstate:'2BP01',raw:'PRIVATE_SECRET'}]};
  const modules=[{errors:()=>[error],children:{allSuites:()=>[],allTests:()=>[{result:()=>({state:'passed'})}]}}];
  const diagnostic=ci1SuiteDiagnostic(modules,[]);
  assert.deepEqual(diagnostic,{originOrdinal:1,phaseOrdinal:3,stepOrdinal:3,codeOrdinal:17,sqlstateOrdinal:7});
  const marker=ci1SuiteFailureMarker('T09',{hookErrorCount:1,errorCount:0,diagnostic});
  assert.equal(marker,'CI1_SUITE_FAILURE 1 1 0 1 3 3 17 7');
  const facts=ci1HarnessFailureFacts(marker+'\n');
  assert.deepEqual(facts,{suiteOrdinal:1,suiteHookErrorCount:1,suiteRunErrorCount:0,suiteErrorOriginOrdinal:1,
    suiteCleanupPhaseOrdinal:3,suiteCleanupStepOrdinal:3,suiteCleanupCodeOrdinal:17,suiteCleanupSqlstateOrdinal:7});
  const failure=ci1FailureExport({stage:'offline-edge',operation:'PILOT_HARNESS',code:'COMMAND_FAILED',command:'node',exitCode:1,facts});
  assert.deepEqual(failure.facts,facts);
  assert.ok(!JSON.stringify({diagnostic,marker,failure}).includes('PRIVATE_SECRET'));
});

test('suite diagnostics refuse ambiguous markers and bound unknown errors, counts and iterables', () => {
  const modules=[{errors:[{message:'PRIVATE_SECRET',permissionCleanupDiagnostics:[{phase:'PRIVATE_SECRET',step:'PRIVATE_SECRET',code:'PRIVATE_SECRET',sqlstate:'PRIVATE_SECRET'}]}],children:{allSuites:()=>[]}}];
  assert.deepEqual(ci1SuiteDiagnostic(modules,[]),{originOrdinal:1,phaseOrdinal:0,stepOrdinal:0,codeOrdinal:0,sqlstateOrdinal:0});
  const line='CI1_SUITE_FAILURE 1 1 0 1 0 0 0 0';
  for(const value of [line+' PRIVATE_SECRET',line+'\n'+line,line.replace(' 1 1',' 01 1'),
    'CI1_SUITE_FAILURE 3 1 0 1 0 0 0 0','CI1_SUITE_FAILURE 1 129 0 1 0 0 0 0',
    'CI1_SUITE_FAILURE 1 0 0 1 0 0 0 0','CI1_SUITE_FAILURE 1 1 0 1 6 0 0 0',
    'CI1_SUITE_FAILURE 1 1 0 1 0 15 0 0','CI1_SUITE_FAILURE 1 1 0 1 0 0 20 0',
    'CI1_SUITE_FAILURE 1 1 0 1 0 0 0 18','x'.repeat(1024**2+1)])assert.deepEqual(ci1SuiteFailureFacts(value),{});
  assert.equal(ci1SuiteDiagnostic(modules,Array(129).fill({})),null);
  for(const diagnostic of ['PRIVATE_SECRET',true,42,[],null])assert.equal(ci1SuiteFailureMarker('T09',{hookErrorCount:1,errorCount:0,diagnostic}),null);
  modules[0].children.allSuites=function*(){while(true)yield {errors:[]};};
  assert.equal(ci1SuiteDiagnostic(modules,[]),null);
});

test('valid assertion-pass suite failure emits diagnostics without converting cleanup or unrun suite to PASS', async () => {
  const adapter=fakeAdapter(),markers=[];
  adapter.execute=async invocation=>{
    const result=completed(invocation);result.exitCode=1;result.result.success=false;result.result.hookErrorCount=1;
    result.result.diagnostic={originOrdinal:1,phaseOrdinal:3,stepOrdinal:9,codeOrdinal:11,sqlstateOrdinal:0};
    return result;
  };
  adapter.preserved=async()=>false;
  const output=JSON.parse((await runCi1Pilot(adapter,metadata(),marker=>markers.push(marker))).json);
  assert.deepEqual(markers,['CI1_SUITE_FAILURE 1 1 0 1 3 9 11 0']);
  assert.equal(output.overallStatus,'FAIL');assert.equal(output.checks.cleanup,'FAIL');
  assert.equal(output.suites[0].status,'FAIL');assert.equal(output.suites[0].counts.pass,1);
  assert.equal(output.suites[1].status,'NOT_RUN');assert.equal(output.totals.pass,null);
  const sinkFailure=JSON.parse((await runCi1Pilot(adapter,metadata(),()=>{throw new Error('PRIVATE_SECRET');})).json);
  assert.equal(sinkFailure.suites[0].status,'FAIL');assert.equal(sinkFailure.checks.cleanup,'FAIL');
  const passMarkers=[];await runCi1Pilot(fakeAdapter(),metadata(),marker=>passMarkers.push(marker));
  assert.deepEqual(passMarkers,[]);
});

test('preservation drift exposes only bounded component and financial masks with consistent bits', () => {
  const before={components:Array(5).fill('a'.repeat(64)),financial:Array(6).fill('b'.repeat(32))};
  const after=structuredClone(before);after.components[1]='c'.repeat(64);after.components[4]='d'.repeat(64);after.financial[2]='e'.repeat(32);
  assert.equal(ci1PreservationMask(before,after),'CI1_PRESERVATION_FAILURE 18 4');
  assert.deepEqual(ci1HarnessFailureFacts('CI1_PRESERVATION_FAILURE 18 4'),{preservationComponentDriftMask:18,preservationFinancialDriftMask:4});
  assert.equal(ci1PreservationMask(before,before),null);
  for(const key of ['components','financial']){
    const sparse=structuredClone(before);delete sparse[key][0];assert.equal(ci1PreservationMask(sparse,before),null);assert.equal(ci1PreservationMask(before,sparse),null);
    const newline=structuredClone(before);newline[key][0]+='\n';assert.equal(ci1PreservationMask(before,newline),null);
  }
  after.components[1]=before.components[1];assert.equal(ci1PreservationMask(before,after),null);
  for(const value of ['CI1_PRESERVATION_FAILURE 32 0','CI1_PRESERVATION_FAILURE 2 64','CI1_PRESERVATION_FAILURE 0 0',
    'CI1_PRESERVATION_FAILURE 1 1','CI1_PRESERVATION_FAILURE 2 0','CI1_PRESERVATION_FAILURE 01 0',
    'CI1_PRESERVATION_FAILURE 1 0 PRIVATE_SECRET','CI1_PRESERVATION_FAILURE 1 0\nCI1_PRESERVATION_FAILURE 1 0'])assert.deepEqual(ci1PreservationFacts(value),{});
});

test('actual fixture capture and verification retain the original whole-snapshot hash acceptance', async () => {
  const source=readFileSync(new URL('./permission-ci1-fixture.mjs',import.meta.url),'utf8');
  const start=source.indexOf('const preservationHashes ='),end=source.indexOf('export async function closeCi1Fixture');
  assert.ok(start>0&&end>start);
  const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
  let value={catalog:'a'.repeat(64),financial:Array(6).fill('b'.repeat(32)),metadata:[{fake:'PRIVATE_SECRET'}],buckets:[],payloads:['c'.repeat(64)]};
  const context={snapshot:async()=>value,state:{},hash,ci1PreservationMask};
  runInNewContext(source.slice(start,end).replaceAll('export ','')+'\nthis.capture=captureCi1Baseline;this.verify=verifyCi1Baseline;',context);
  const original=hash(value),baseline=await context.capture();assert.equal(baseline,original);
  const markers=[];assert.equal(await context.verify(baseline,m=>markers.push(m)),true);assert.deepEqual(markers,[]);
  value={...value,metadata:[{fake:'CHANGED_SECRET'}]};
  assert.equal(await context.verify(baseline,m=>markers.push(m)),false);assert.deepEqual(markers,['CI1_PRESERVATION_FAILURE 4 0']);
  assert.equal(await context.verify(baseline,()=>{throw new Error('PRIVATE_SECRET');}),false);
  assert.equal(await context.verify(hash(value)),true); // Same original equality rule, independent of diagnostic state.
  assert.equal(await context.verify(null),false);
  assert.ok(!JSON.stringify(markers).includes('SECRET'));
});

test('harness setup diagnostics export only bounded phase and failure ordinals', () => {
  const error = Object.assign(new Error('PRIVATE_SECRET'), {status:1,stderr:'npm error code ENOTCACHED\nnpm error PRIVATE_SECRET /private/path\n'});
  const marker = ci1HarnessFailureMarker(4,error);
  assert.equal(marker,'CI1_HARNESS_FAILURE 4 9 1 1');
  assert.deepEqual(ci1HarnessFailureFacts(marker+'\nCI1_HARNESS_BLOCKED\n'),{
    harnessPhaseOrdinal:4,harnessFailureOrdinal:9,harnessExitOrdinal:1,harnessNpmFailureOrdinal:1});
  assert.equal(ci1HarnessFailureMarker(3,error),'CI1_HARNESS_FAILURE 3 9 1 0');
  assert.equal(ci1HarnessFailureMarker(4,{code:'ETIMEDOUT'}),'CI1_HARNESS_FAILURE 4 5 256 0');
  for(const phase of [0,16,NaN,'4'])assert.throws(()=>ci1HarnessFailureMarker(phase,error));
  assert.ok(!JSON.stringify(ci1HarnessFailureFacts(marker)).includes('PRIVATE_SECRET'));
});
test('malformed, duplicated and unbounded private harness markers cannot create facts', () => {
  for(const value of ['CI1_HARNESS_FAILURE 4 9 1 1 PRIVATE_SECRET','CI1_HARNESS_FAILURE 16 9 1 1',
    'CI1_HARNESS_FAILURE 8 21 1 0','CI1_HARNESS_FAILURE 4 11 1 1','CI1_HARNESS_FAILURE 4 9 257 1','CI1_HARNESS_FAILURE 3 9 1 1',
    'CI1_HARNESS_FAILURE 04 9 1 1','CI1_HARNESS_FAILURE 4 9 -1 1',
    'CI1_HARNESS_FAILURE 4 9 1 1\nCI1_HARNESS_FAILURE 4 9 1 1','x'.repeat(1024**2+1)])
    assert.deepEqual(ci1HarnessFailureFacts(value),{});
  assert.equal(ci1HarnessFailureMarker(4,{stderr:'npm error code ENOTCACHED\nnpm error code EACCES\n'}),'CI1_HARNESS_FAILURE 4 10 256 0');
});
test('phase8 runtime and image pin failures use fixed ordinals without reflecting private facts', () => {
  for(const [message,code] of Object.entries({ISOLATED_RUNTIME_CONFIG_MISMATCH:11,ISOLATED_SERVICE_NOT_HEALTHY:12,
    NONLOCAL_CONTAINER_PORT_REFUSED:13,DEDICATED_DB_VOLUME_REQUIRED:14,CLI_VERSION_MISMATCH:15,CI1_INTAKE_REFUSED:16})){
    const marker=ci1HarnessFailureMarker(8,{message});
    assert.equal(ci1HarnessFailureFacts(marker).harnessFailureOrdinal,code);
    assert.equal(ci1HarnessFailureFacts(ci1HarnessFailureMarker(7,{message})).harnessFailureOrdinal,10);
  }
  for(const ordinal of [1,2,3,4])assert.equal(ci1HarnessFailureFacts(ci1HarnessFailureMarker(8,{
    message:'CI1_PINNED_IMAGE_REFUSED',ci1ImageProofOrdinal:ordinal,stderr:'PRIVATE_SECRET'})).harnessFailureOrdinal,16+ordinal);
  for(const ordinal of [0,5,'4',NaN])assert.equal(ci1HarnessFailureFacts(ci1HarnessFailureMarker(8,{
    message:'CI1_PINNED_IMAGE_REFUSED',ci1ImageProofOrdinal:ordinal})).harnessFailureOrdinal,10);
});

test('live systemd reads use only five exact properties on the owned unit over the ordinary system bus', () => {
  const values={RuntimeMaxUSec:['t 1800000000','30min'],TimeoutStopUSec:['t 30000000','30s'],
    KillMode:['s "control-group"','control-group'],StandardOutput:['s "null"','null'],StandardError:['s "null"','null']};
  for(const [property,[raw,value]] of Object.entries(values)) {
    assert.equal(ci1SystemdProperty(identity,property,(command,args,options)=>{
      assert.equal(command,'busctl');assert.equal(args[0],'--address=unix:path=/run/dbus/system_bus_socket');
      assert.deepEqual(args.slice(3),['get-property','org.freedesktop.systemd1',
        '/org/freedesktop/systemd1/unit/pos_2dcafe_2dci1_2dr12345_2da1_2eservice','org.freedesktop.systemd1.Service',property]);
      assert.equal(options.maxBuffer,4096);assert.equal(options.timeout,10000);assert.equal(options.env.SYSTEMD_BUS_ADDRESS,undefined);
      return raw+'\n';
    }),value);
    for(const invalid of ['t 1800000001','s "FAKE_UNIT_SECRET"','t 0','s "null"\nFAKE_UNIT_SECRET'])
      if(invalid!==raw) assert.throws(()=>ci1SystemdProperty(identity,property,()=>invalid),error=>
        error.ci1Command==='busctl'&&error.ci1Facts.systemdPropertyOrdinal>0&&!JSON.stringify(error).includes('FAKE_UNIT_SECRET'));
  }
  const never=()=>{throw new Error('must not execute');};
  assert.throws(()=>ci1SystemdProperty({...identity,unit:'other.service'},'RuntimeMaxUSec',never));
  assert.throws(()=>ci1SystemdProperty(identity,'ExecStart',never));
  assert.throws(()=>ci1SystemdProperty(identity,'KillMode',()=>{throw Object.assign(new Error('FAKE_UNIT_SECRET'),{status:1});}),
    error=>error.status===1&&error.ci1FailureCode==='SUPERVISOR_REFUSED'&&!JSON.stringify(error).includes('FAKE_UNIT_SECRET'));
});
const metadata = () => ({ repository: 'nguyentronglinh045/pos-cafe-ci-preflight', runId: '12345', attempt: 1,
  workflowSHA: '1'.repeat(40), sourceSHA: '2'.repeat(40), sourceFingerprint: '3'.repeat(64), lockSHA: '4'.repeat(64),
  versions: { node: '24.16.0', npm: '11.13.0', supabase: '2.117.0' } });
const envelope = () => ({ platform: 'linux', arch: 'x64', githubHosted: true,
  publicRepository: true, hostCPUs: 4, hostMemoryBytes: 16 * 1024 ** 3,
  repository: metadata().repository, manual: true, unit: identity.unit, cgroup: '/system.slice/' + identity.unit, delegatedSupervisor: true,
  cpuMax: '300000 100000', memoryMax: String(CI1_LIMITS.memoryBytes), swapMax: '0', pidsMax: '2048',
  runtimeSeconds: 1800, stopGraceSeconds: 30, killMode: 'control-group', standardOutput: 'null', standardError: 'null', filesystem: 'ext4', loopBacked: true,
  imageBytes: CI1_LIMITS.filesystemBytes, imageAllocatedBytes: CI1_LIMITS.filesystemBytes, filesystemBytes: CI1_LIMITS.filesystemBytes - 1024 ** 2,
  filesystemFreeBytes: 8 * 1024 ** 3, hostFreeBytes: 40 * 1024 ** 3, mutablePathsOnVolume: true,
  memoryCurrent: 1024 ** 3, pidsCurrent: 200, oomEvents: 0, pidsLimitEvents: 0,
  privateNamespaces: true, noDefaultRoute: true, ownedDaemon: true, containersInCgroup: true, containersCoreDisabled: true });

function completed(invocation) {
  return { exitCode: 0,
    result: { schemaVersion: 'permission-ci1-suite-v1', runId: invocation.runId, commandId: invocation.commandId,
      invocationSHA: invocation.invocationSHA, sourceFingerprint: invocation.sourceFingerprint,
      lockSHA: invocation.lockSHA, configSHA: invocation.configSHA, success: true,
      run: invocation.required, pass: invocation.required, fail: 0, skip: 0, errorCount: 0, hookErrorCount: 0 },
    observation: { schemaVersion: 'permission-stage-observation-v1', runId: invocation.runId, stage: invocation.stage,
      sourceFingerprint: invocation.sourceFingerprint, executionProfile: { stage: invocation.stage, executionKind: 'service',
        profile: 'candidate', configId: invocation.configSHA, markerProof: '5'.repeat(64),
        backend: { reference: CI1_PROJECT, host: '127.0.0.1', port: 62422, database: 'postgres', engine: 'supabase-cli-2.117.0' },
        apiBinding: { projectRef: CI1_PROJECT, baseUrl: 'http://127.0.0.1:62421' } } } };
}

function fakeAdapter() {
  const calls = [];
  return { calls, source: '/volume/source', privateRoot: '/volume/private',
    envelope: async () => { calls.push('guard'); return envelope(); },
    sourceFingerprint: async () => metadata().sourceFingerprint, configHash: async () => '6'.repeat(64),
    bootstrap: async () => { calls.push('bootstrap'); return { authVerified: true, apiBindingVerified: true, markerProof: '5'.repeat(64) }; },
    baseline: async () => { calls.push('baseline'); return 'baseline'; },
    execute: async invocation => { calls.push(invocation.commandId); return completed(invocation); },
    preserved: async before => { assert.equal(before, 'baseline'); calls.push('preserved'); return true; },
    close: async () => { calls.push('close'); },
  };
}

test('both exact trusted repositories pass the full supervisor, envelope, worker and evidence chain; unknown repo is refused', async () => {
  for (const repository of ['nguyentronglinh045/pos-cafe-ci-preflight', 'nguyentronglinh045/pos-cafe', 'attacker/pos-cafe', '24tx810010-hcmute/pos-cafe']) {
    const supervisor = { platform: 'linux', arch: 'x64', root: true, wsl: false, authorized: true, githubHosted: true,
      publicRepository: true, manual: true, repository, cpus: 4, memoryBytes: 16 * 1024 ** 3,
      cgroup: `/system.slice/${identity.unit}/supervisor`, cpuMax: '300000 100000', memoryMax: String(CI1_LIMITS.memoryBytes),
      swapMax: '0', pidsMax: '2048', runtime: '30min', stop: '30s', kill: 'control-group', stdout: 'null', stderr: 'null',
      oom: 0, pidsEvents: 0, hostFreeBytes: 60 * 1024 ** 3 };
    const worker = { supervisor: () => supervisor, stage: async () => true, close: async () => true };
    const fake = fakeAdapter(); fake.envelope = async () => ({ ...envelope(), repository });
    if (repository.startsWith('attacker/') || repository === '24tx810010-hcmute/pos-cafe') {
      assert.throws(() => assertCi1Supervisor(supervisor, identity));
      assert.throws(() => assertCi1Envelope({ ...envelope(), repository }, identity));
      assert.equal((await runCi1Worker(worker, identity)).status, 'ERROR');
      await assert.rejects(runCi1Pilot(fake, { ...metadata(), repository }));
    } else {
      assert.equal(assertCi1Supervisor(supervisor, identity), true);
      assert.equal((await runCi1Worker(worker, identity)).status, 'COMPLETE');
      const proof = JSON.parse((await runCi1Pilot(fake, { ...metadata(), repository })).json);
      assert.equal(proof.repository, repository); assert.equal(proof.overallStatus, 'PASS');
    }
  }
});

test('recipe keeps protective caps, preflight order and future execution blockers explicit', () => {
  const recipe = ci1LinuxRecipe('12345', 1);
  assert.equal(recipe.noAutomaticInstallOrExecution, true);
  assert.equal(recipe.limits.taskBytes, 20 * 1024 ** 3);
  for (const value of ['--property=CPUQuota=300%', '--property=MemoryMax=10737418240', '--property=MemorySwapMax=0',
    '--property=TasksMax=2048', '--property=RuntimeMaxSec=1800s', '--property=KillMode=control-group', '--property=LimitCORE=0']) {
    assert.ok(recipe.systemdArgv.includes(value));
  }
  assert.ok(recipe.provisioningOrder.indexOf('apply-systemd-cgroup-before-heavy-writes')
    < recipe.provisioningOrder.indexOf('prefetch-pinned-images-and-Edge-npm-cache-inside-volume'));
  assert.ok(recipe.executionBlockedUntil.length > 0);
  assert.throws(() => ci1LinuxRecipe('12345\n--property=MemoryMax=infinity', 1));
});

test('all twelve live service processes must expose zero hard and soft core limits', () => {
  const values = Array.from({ length: 12 }, (_, i) => ({ State: { Running: true, Pid: i + 1 } }));
  const zero = 'Max core file size        0                    0                    bytes';
  const read = [];
  assert.equal(ci1ContainersCoreDisabled(values, 'core\n', pid => { read.push(pid); return zero; }), true);
  assert.deepEqual(read, Array.from({ length: 12 }, (_, i) => i + 1));
  for (const limits of ['', zero.replace('0', 'unlimited'), zero.replace(/0(\s+bytes)$/, 'unlimited$1')])
    assert.equal(ci1ContainersCoreDisabled(values, 'core\n', pid => pid === 12 ? limits : zero), false);
  assert.equal(ci1ContainersCoreDisabled(values, '|handler\n', () => zero), false);
  assert.equal(ci1ContainersCoreDisabled(values, 'core\n', () => { throw Object.assign(new Error(), { code: 'EACCES' }); }), false);
  assert.equal(ci1ContainersCoreDisabled(values.slice(1), 'core\n', () => zero), false);
  for (const state of [{ Running: false, Pid: 12 }, { Running: true, Pid: 1 }, { Running: true, Pid: -1 }, { Running: true, Pid: '12' }]) {
    const invalid = structuredClone(values); invalid[11].State = state;
    assert.equal(ci1ContainersCoreDisabled(invalid, 'core\n', () => zero), false);
  }
});

test('hardware readback refuses absent, exceeded or non-owned protection without fallback', () => {
  assert.equal(assertCi1Envelope(envelope(), identity), true);
  for (const [key, value] of Object.entries({ platform: 'win32', githubHosted: false, publicRepository: false,
    hostCPUs: 8, hostMemoryBytes: 8 * 1024 ** 3, manual: false,
    cpuMax: 'max 100000', memoryMax: 'max', swapMax: '1073741824', pidsMax: 'max',
    runtimeSeconds: 1801, killMode: 'process', stopGraceSeconds: 60, filesystem: 'overlay', loopBacked: false,
    standardOutput: 'journal', standardError: 'inherit',
    imageBytes: 21 * 1024 ** 3, imageAllocatedBytes: 1024, filesystemFreeBytes: 0, hostFreeBytes: 29 * 1024 ** 3,
    mutablePathsOnVolume: false, delegatedSupervisor: false, privateNamespaces: false, noDefaultRoute: false, ownedDaemon: false,
    containersInCgroup: false, containersCoreDisabled: false, oomEvents: 1, pidsLimitEvents: 1, memoryCurrent: CI1_LIMITS.memoryBytes, pidsCurrent: 2048,
  })) assert.throws(() => assertCi1Envelope({ ...envelope(), [key]: value }, identity), { message: 'CI1_GUARD_REFUSED' });
  const missing = envelope(); delete missing.containersCoreDisabled;
  assert.throws(() => assertCi1Envelope(missing, identity), { message: 'CI1_GUARD_REFUSED' });
});

test('actual write paths, environment, runtime mount and daemon flags must share the bounded volume', () => {
  const root = '/task/volume';
  const fact = path => ({ realpath: path, device: 7, inode: 10, directory: true, symlink: false });
  const valid = () => ({ root, environment: ci1ProcessEnvironment(root, { PATH: '/usr/bin', HOME: '/host', FAKE_UNIT_SECRET: 'must-not-copy' }),
    paths: { root: fact(root), ...Object.fromEntries(['source', 'private', 'docker', 'containerd', 'run', 'tmp', 'home', 'npm-cache', 'runtime', 'home/.cache']
      .map(name => [name, fact(`${root}/${name}`)])), compatibility: fact(CI1_RUNTIME), nodeModules: fact(`${root}/source/node_modules`) },
    runtimeMount: { target: CI1_RUNTIME, filesystem: 'ext4' },
    dockerd: { inCgroup: true, argv: ['dockerd', `--host=unix://${root}/docker.sock`, `--data-root=${root}/docker`,
      `--exec-root=${root}/run/docker`, `--pidfile=${root}/run/dockerd.pid`, `--containerd=${root}/run/containerd.sock`,
      `--cgroup-parent=/system.slice/${identity.unit}`, '--exec-opt=native.cgroupdriver=cgroupfs', '--default-ulimit=core=0:0'] },
    containerd: { inCgroup: true, argv: ['containerd', `--root=${root}/containerd`, `--state=${root}/run/containerd-state`, `--address=${root}/run/containerd.sock`] } });
  assert.equal(assertCi1WriteBoundary(valid(), identity), true);
  assert.equal(valid().environment.FAKE_UNIT_SECRET, undefined);
  assert.equal(valid().environment.HOME, `${root}/home`);
  for (const mutate of [
    value => { value.environment.HOME = '/host'; },
    value => { value.environment.TMPDIR = '/tmp'; },
    value => { delete value.environment.XDG_CACHE_HOME; },
    value => { value.environment.NPM_CONFIG_CACHE = '/host/cache'; },
    value => { value.environment.npm_config_cache = '/host/cache'; },
    value => { value.environment.DENO_DIR = '/host/deno'; },
    value => { value.paths.tmp.device = 8; },
    value => { value.paths.home.realpath = '/host/home'; },
    value => { value.paths.nodeModules.symlink = true; },
    value => { value.paths.compatibility.device = 8; },
    value => { value.paths.compatibility.inode = 11; },
    value => { value.runtimeMount.target = '/var/tmp'; },
    value => { value.dockerd.argv = value.dockerd.argv.filter(arg => !arg.startsWith('--exec-root=')); },
    value => { value.dockerd.argv.push('--exec-root=/host/run'); },
    value => { value.dockerd.argv = value.dockerd.argv.filter(arg => !arg.startsWith('--default-ulimit=')); },
    value => { value.dockerd.argv.push('--default-ulimit=core=-1:-1'); },
    value => { value.containerd.argv = value.containerd.argv.filter(arg => !arg.startsWith('--address=')); },
    value => { value.containerd.inCgroup = false; },
  ]) { const value = valid(); mutate(value); assert.throws(() => assertCi1WriteBoundary(value, identity), { message: 'CI1_GUARD_REFUSED' }); }
});

test('pilot state machine binds whole suites to commands and exports only finite proof', async () => {
  const adapter = fakeAdapter();
  const result = JSON.parse((await runCi1Pilot(adapter, metadata())).json);
  assert.equal(result.overallStatus, 'PASS');
  assert.deepEqual(result.totals, { required: 4, run: 4, pass: 4, fail: 0, skip: 0 });
  assert.deepEqual(adapter.calls, ['guard', 'bootstrap', 'baseline', 'guard', 'T09_STORAGE_EDGE', 'guard', 'T10_REALTIME', 'guard', 'preserved', 'close']);
  assert.equal(JSON.stringify(result).includes('baseline'), false);
});

test('invalid resource or metadata blocks bootstrap and both suites', async () => {
  const adapter = fakeAdapter();
  adapter.envelope = async () => ({ ...envelope(), cpuMax: 'max 100000' });
  const result = JSON.parse((await runCi1Pilot(adapter, metadata())).json);
  assert.equal(result.overallStatus, 'ERROR');
  assert.ok(result.suites.every(item => item.status === 'NOT_RUN'));
  assert.equal(adapter.calls.includes('bootstrap'), false);
  await assert.rejects(runCi1Pilot(fakeAdapter(), { ...metadata(), workflowSHA: 'FAKE_SECRET' }), { message: 'CI1_EVIDENCE_INVALID' });
});

test('suite result requires exact source, invocation, marker and actual stage/API binding', () => {
  const invocation = ci1Invocation('T09', { source: '/volume/source', privateRoot: '/volume/private',
    runId: '12345', sourceFingerprint: metadata().sourceFingerprint, lockSHA: metadata().lockSHA, configSHA: '6'.repeat(64) });
  const valid = completed(invocation);
  assert.equal(ci1SuiteResult(invocation, { ...valid, markerProof: '5'.repeat(64) }).status, 'PASS');
  for (const mutate of [
    value => { value.result.invocationSHA = '7'.repeat(64); },
    value => { value.result.lockSHA = '7'.repeat(64); },
    value => { value.result.runId = '12346'; },
    value => { value.observation.stage = 'other'; },
    value => { value.observation.executionProfile.configId = '7'.repeat(64); },
    value => { delete value.observation.executionProfile.configId; },
    value => { value.observation.executionProfile.markerProof = '7'.repeat(64); },
    value => { value.observation.executionProfile.backend.host = 'example.test'; },
    value => { value.observation.executionProfile.backend.engine = 'other'; },
    value => { value.observation.executionProfile.apiBinding.baseUrl = 'https://example.test'; },
    value => { value.result.run = 0; },
  ]) {
    const value = structuredClone(valid); mutate(value);
    assert.equal(ci1SuiteResult(invocation, { ...value, markerProof: '5'.repeat(64) }).status, 'ERROR');
  }
});

test('hook errors and missing/failed cases stop the next suite and cannot become PASS', async () => {
  for (const exitCode of [0, 1]) {
    const adapter = fakeAdapter();
    adapter.execute = async invocation => { const result = completed(invocation); result.exitCode = exitCode;
      result.result.success = false; result.result.hookErrorCount = 1; adapter.calls.push(invocation.commandId); return result; };
    const output = JSON.parse((await runCi1Pilot(adapter, metadata())).json);
    assert.notEqual(output.overallStatus, 'PASS');
    assert.equal(output.suites[1].status, 'NOT_RUN');
    assert.equal(adapter.calls.includes('T10_REALTIME'), false);
    assert.equal(adapter.calls.at(-1), 'close');
  }
});

test('mid-run quota/source drift and bootstrap failures retain honest status and stop owned resources', async () => {
  const drift = fakeAdapter(); let calls = 0;
  drift.envelope = async () => ++calls === 1 ? envelope() : { ...envelope(), hostFreeBytes: 0 };
  const output = JSON.parse((await runCi1Pilot(drift, metadata())).json);
  assert.equal(output.overallStatus, 'ERROR'); assert.equal(output.suites[0].status, 'NOT_RUN');
  assert.equal(drift.calls.at(-1), 'close');
  const source = fakeAdapter(); let snapshots = 0;
  source.sourceFingerprint = async () => ++snapshots === 1 ? metadata().sourceFingerprint : '8'.repeat(64);
  assert.equal(JSON.parse((await runCi1Pilot(source, metadata())).json).checks.sourcePreservation, 'FAIL');
  const bootstrap = fakeAdapter(); bootstrap.bootstrap = async () => { throw new Error('FAKE_UNIT_SECRET'); };
  const blocked = await runCi1Pilot(bootstrap, metadata());
  assert.equal(JSON.parse(blocked.json).overallStatus, 'ERROR');
  assert.equal(blocked.json.includes('FAKE_UNIT_SECRET'), false); assert.equal(bootstrap.calls.at(-1), 'close');
});

test('Vitest adapter projects no error text and counts afterAll errors even when bodies passed', () => {
  const module = { moduleId: resolve(CI1_SUITES[0].module), errors: () => [], children: {
    allSuites: () => [{ errors: () => [new Error('FAKE_UNIT_SECRET')] }],
    allTests: () => [{ result: () => ({ state: 'passed' }) }],
  } };
  const projection = summarizeCi1Modules([module], [], 'passed', CI1_SUITES[0].module);
  assert.equal(projection.pass, 1); assert.equal(projection.hookErrorCount, 1); assert.equal(projection.success, false);
  assert.equal(JSON.stringify(projection).includes('FAKE_UNIT_SECRET'), false);
  module.children.allSuites = () => [{ errors: [new Error('FAKE_UNIT_SECRET')] }];
  assert.equal(summarizeCi1Modules([module], [], 'passed', CI1_SUITES[0].module).hookErrorCount, 1);
  module.children.allSuites = () => [{}];
  assert.throws(() => summarizeCi1Modules([module], [], 'passed', CI1_SUITES[0].module), { message: 'CI1_REPORTER_REFUSED' });
  assert.throws(() => summarizeCi1Modules([module], [], 'passed', CI1_SUITES[1].module), { message: 'CI1_REPORTER_REFUSED' });
});
