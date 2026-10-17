import { readFileSync, writeFileSync, existsSync, realpathSync, statSync, lstatSync, statfsSync, readlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { cpus, totalmem } from 'node:os';
import { coreDumpDisabled } from './project-ci-launch.mjs';
import { CI1_LIMITS, CI1_PROJECT, CI1_RUNTIME, CI1_SUITES, assertCi1Envelope, assertCi1WriteBoundary, ci1ProcessEnvironment, ci1Identity, ci1Invocation, ci1SuiteResult, ci1Hash } from './permission-ci1-policy.mjs';
import { renderCi1Evidence } from './permission-ci1-evidence.mjs';
import { ci1SuiteFailureMarker, ci1SuiteFailureFacts, ci1PreservationFacts } from './permission-ci1-diagnostics.mjs';

const refused = () => { throw new Error('CI1_HARNESS_REFUSED'); };
const stopped = id => ({ id, status: 'NOT_RUN', exitCode: null, counts: null });
const readJSON = path => {
  if (statSync(path).size > CI1_LIMITS.outputBytes) refused();
  return JSON.parse(readFileSync(path, 'utf8'));
};
const child = (command, args, options = {}) => execFileSync(command, args,
  { encoding: 'utf8', maxBuffer: CI1_LIMITS.outputBytes, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'], ...options });

// Private stderr transport: only fixed numeric facts cross the worker boundary.
export function ci1HarnessFailureMarker(phase, error) {
  if (!Number.isSafeInteger(phase) || phase < 1 || phase > 15) refused();
  const runtimeCode = phase === 8 ? ({ISOLATED_RUNTIME_CONFIG_MISMATCH:11,ISOLATED_SERVICE_NOT_HEALTHY:12,
    NONLOCAL_CONTAINER_PORT_REFUSED:13,DEDICATED_DB_VOLUME_REQUIRED:14,CLI_VERSION_MISMATCH:15,CI1_INTAKE_REFUSED:16})[error?.message]
    ?? (error?.message === 'CI1_PINNED_IMAGE_REFUSED' && Number.isSafeInteger(error.ci1ImageProofOrdinal)
      && error.ci1ImageProofOrdinal >= 1 && error.ci1ImageProofOrdinal <= 4 ? 16 + error.ci1ImageProofOrdinal : undefined) : undefined;
  const code = runtimeCode ?? (['CI1_HARNESS_REFUSED', 'CI1_GUARD_REFUSED'].includes(error?.message) ? 1
    : ({ENOENT:2,ENOTDIR:3,EACCES:4,EPERM:4,ETIMEDOUT:5,ENOBUFS:6,ERR_CHILD_PROCESS_STDIO_MAXBUFFER:6})[error?.code]
      ?? (error?.name === 'TypeError' ? 7 : error?.name === 'SyntaxError' ? 8 : Number.isInteger(error?.status) ? 9 : 10));
  const exit = Number.isInteger(error?.status) && error.status >= 0 && error.status <= 255 ? error.status : 256;
  let npm = 0;
  if (phase === 4 && typeof error?.stderr === 'string' && Buffer.byteLength(error.stderr) <= CI1_LIMITS.outputBytes) {
    const codes = [...new Set([...error.stderr.matchAll(/^npm (?:error|ERR!) code ([A-Z_]+)\s*$/gm)].map(m=>m[1]))];
    if (codes.length === 1) npm = ({ENOTCACHED:1,EACCES:2,ENOSPC:3,ELIFECYCLE:4,EINTEGRITY:5,
      ENETUNREACH:6,EAI_AGAIN:6,ECONNREFUSED:6,ERESOLVE:7,EBADENGINE:8})[codes[0]] ?? 0;
  }
  return `CI1_HARNESS_FAILURE ${phase} ${code} ${exit} ${npm}`;
}
export function ci1HarnessFailureFacts(stderr) {
  if (typeof stderr !== 'string' || Buffer.byteLength(stderr) > CI1_LIMITS.outputBytes) return {};
  const suiteFacts = {...ci1SuiteFailureFacts(stderr),...ci1PreservationFacts(stderr)};
  const lines = stderr.split(/\r?\n/).filter(line=>line.startsWith('CI1_HARNESS_FAILURE'));
  if (lines.length === 0) return suiteFacts;
  if (lines.length !== 1) return {};
  const match = /^CI1_HARNESS_FAILURE ([1-9][0-9]?) ([1-9][0-9]?) (0|[1-9][0-9]{0,2}) ([0-8])$/.exec(lines[0]);
  if (!match) return {};
  const [phase, code, exit, npm] = match.slice(1).map(Number);
  if (phase > 15 || code > 20 || (phase !== 8 && code > 10) || exit > 256 || (phase !== 4 && npm !== 0)) return {};
  return {...suiteFacts,harnessPhaseOrdinal:phase,harnessFailureOrdinal:code,harnessExitOrdinal:exit,harnessNpmFailureOrdinal:npm};
}

// systemctl's root shortcut checks the peer PID of the host manager, which is
// not visible inside our private PID namespace. Query the ordinary filesystem
// system bus instead; these are live read-only properties of the exact unit.
export function ci1SystemdProperty(identity, property, run = execFileSync) {
  const expected = ci1Identity(identity.runId, identity.attempt);
  const properties = ['RuntimeMaxUSec','TimeoutStopUSec','KillMode','StandardOutput','StandardError'];
  const ordinal = properties.indexOf(property) + 1;
  if (identity.unit !== expected.unit || !ordinal) refused();
  const object = '/org/freedesktop/systemd1/unit/' + expected.unit.replace(/[^A-Za-z0-9]/g,
    value => '_' + value.charCodeAt(0).toString(16).padStart(2, '0'));
  try {
    const raw = run('busctl', ['--address=unix:path=/run/dbus/system_bus_socket', '--no-pager', '--timeout=5s',
      'get-property', 'org.freedesktop.systemd1', object, 'org.freedesktop.systemd1.Service', property],
    { encoding:'utf8', maxBuffer:4096, timeout:10000, stdio:['ignore','pipe','pipe'],
      env:{PATH:process.env.PATH,LANG:'C',LC_ALL:'C'} }).trim();
    const values = { RuntimeMaxUSec: ['t 1800000000','30min'], TimeoutStopUSec: ['t 30000000','30s'],
      KillMode: ['s "control-group"','control-group'], StandardOutput: ['s "null"','null'], StandardError: ['s "null"','null'] };
    if (raw !== values[property][0]) refused();
    return values[property][1];
  } catch (error) {
    throw Object.assign(new Error('CI1_HARNESS_REFUSED'), { ci1FailureCode:'SUPERVISOR_REFUSED', ci1Command:'busctl',
      status:Number.isInteger(error?.status)&&error.status>=0&&error.status<=255?error.status:null,
      ci1Facts:{systemdPropertyOrdinal:ordinal} });
  }
}

// The adapter boundary permits in-memory unit checks without starting any stack.
export async function runCi1Pilot(adapter, metadata, diagnostic = () => {}) {
  const identity = ci1Identity(metadata.runId, metadata.attempt);
  const startedAt = new Date().toISOString();
  const checks = { bootstrap: 'NOT_RUN', auth: 'NOT_RUN', apiBinding: 'NOT_RUN', sourcePreservation: 'NOT_RUN', cleanup: 'NOT_RUN' };
  const suites = CI1_SUITES.map(item => stopped(item.id));
  // Validate metadata before any fixture work, discarding this NOT_RUN projection.
  renderCi1Evidence({ ...metadata, startedAt, finishedAt: startedAt, checks, suites });
  let baseline, started = false;
  try {
    assertCi1Envelope(await adapter.envelope(), identity);
    if (await adapter.sourceFingerprint() !== metadata.sourceFingerprint) refused();
    started = true;
    const bootstrap = await adapter.bootstrap();
    if (bootstrap.authVerified !== true || bootstrap.apiBindingVerified !== true
      || !/^[a-f0-9]{64}$/.test(bootstrap.markerProof ?? '') || bootstrap.markerProof.length !== 64) refused();
    checks.bootstrap = checks.auth = checks.apiBinding = 'PASS';
    baseline = await adapter.baseline();
    for (let index = 0; index < CI1_SUITES.length; index++) {
      assertCi1Envelope(await adapter.envelope(), identity);
      if (await adapter.sourceFingerprint() !== metadata.sourceFingerprint) refused();
      const spec = CI1_SUITES[index];
      const invocation = ci1Invocation(spec.id, { source: adapter.source, privateRoot: adapter.privateRoot,
        runId: metadata.runId, sourceFingerprint: metadata.sourceFingerprint, lockSHA: metadata.lockSHA,
        configSHA: await adapter.configHash(spec.config) });
      const result = await adapter.execute(invocation);
      suites[index] = ci1SuiteResult(invocation, { ...result, markerProof: bootstrap.markerProof });
      if (suites[index].status !== 'PASS') {
        if (suites[index].status === 'FAIL') {
          try {
            const marker = ci1SuiteFailureMarker(spec.id,result.result);
            if (marker) diagnostic(marker);
          } catch { /* Diagnostics cannot change the primary result. */ }
        }
        break;
      }
    }
    assertCi1Envelope(await adapter.envelope(), identity);
  } catch {
    // Never print/reflect errors from Docker, test output or fixture credentials.
    if (checks.bootstrap !== 'PASS') checks.bootstrap = 'ERROR';
    else checks.cleanup = 'ERROR';
  } finally {
    try { checks.sourcePreservation = await adapter.sourceFingerprint() === metadata.sourceFingerprint ? 'PASS' : 'FAIL'; }
    catch { checks.sourcePreservation = 'ERROR'; }
    if (started) {
      try {
        const preserved = baseline && await adapter.preserved(baseline);
        if (checks.cleanup !== 'ERROR') checks.cleanup = preserved === true ? 'PASS' : 'FAIL';
      } catch { checks.cleanup = 'ERROR'; }
    }
    // Stop only the owned daemon/stack; deleting runtime/data is a separate scope.
    try { if (started) await adapter.close(); } catch { checks.cleanup = 'ERROR'; }
  }
  return renderCi1Evidence({ ...metadata, startedAt, finishedAt: new Date().toISOString(), checks, suites });
}

export function ci1LinuxRecipe(runId, attempt) {
  const identity = ci1Identity(runId, attempt);
  return {
    schemaVersion: 'permission-ci1-linux-recipe-v1', mode: 'LOCAL_PREPARATION_ONLY', identity, limits: CI1_LIMITS,
    systemdArgv: ['systemd-run', '--quiet', '--wait', '--collect', `--unit=${identity.unit}`,
      '--property=CPUQuota=300%', '--property=CPUQuotaPeriodSec=100ms', '--property=MemoryMax=10737418240',
      '--property=MemorySwapMax=0', '--property=TasksMax=2048', '--property=Delegate=yes', '--property=DelegateSubgroup=supervisor',
      '--property=RuntimeMaxSec=1800s', '--property=TimeoutStopSec=30s', '--property=KillMode=control-group',
      '--property=LimitCORE=0', '--property=PrivateTmp=yes', '--property=StandardOutput=null', '--property=StandardError=null'],
    provisioningOrder: ['verify-public-standard-free-runner-and-owner-run-scope', 'apply-systemd-cgroup-before-heavy-writes',
      'verify-host-free-at-least-50GiB-before-18GiB-image', 'create-exclusive-preallocated-18GiB-ext4-loop',
      'stage-approved-source-and-pinned-tools-inside-volume', 'prefetch-pinned-images-and-Edge-npm-cache-inside-volume',
      'stop-prefetch-daemon-before-private-mount-network-pid-namespace', 'start-owned-daemon-on-same-volume-in-private-namespace',
      'verify-12-services-image-digests-cgroup-loopback-and-hardware-readback', 'run-guarded-harness',
      'stop-owned-stack-and-daemon-then-export-only-safe-summary'],
    executionBlockedUntil: ['explicit future push/run permission', 'exact publication allowlist/source/lock fingerprint',
      'pinned CLI/Node/npm/Edge intake and transfer/peak estimates', 'Linux cgroup/loop/namespace readback and owned daemon verified'],
    noAutomaticInstallOrExecution: true,
  };
}

export function ci1ContainersCoreDisabled(containers, pattern, readLimits) {
  if (!Array.isArray(containers) || containers.length !== 12
    || new Set(containers.map(value => value?.State?.Pid)).size !== 12) return false;
  try {
    return containers.every(value => value?.State?.Running === true
      && Number.isSafeInteger(value.State.Pid) && value.State.Pid > 0
      && coreDumpDisabled(readLimits(value.State.Pid), pattern));
  } catch { return false; }
}

// Read kernel/daemon state for each phase. No user-provided limits receipt is trusted.
export function readCi1LinuxEnvelope(root, identity, env = process.env) {
  if (process.platform !== 'linux' || process.arch !== 'x64' || process.getuid?.() !== 0
    || env.CI1_EXECUTION_AUTHORIZED !== 'yes' || /microsoft/i.test(readFileSync('/proc/version', 'utf8'))) refused();
  if (!coreDumpDisabled(readFileSync('/proc/self/limits', 'utf8'), readFileSync('/proc/sys/kernel/core_pattern', 'utf8'))) refused();
  root = realpathSync(root);
  const ownCgroup = readFileSync('/proc/self/cgroup', 'utf8').trim().split('\n').find(value => value.startsWith('0::'))?.slice(3);
  const cgroup = `/system.slice/${identity.unit}`;
  if (ownCgroup !== `${cgroup}/supervisor`) refused();
  const cg = '/sys/fs/cgroup' + cgroup;
  const scalar = name => readFileSync(`${cg}/${name}`, 'utf8').trim();
  const events = name => Object.fromEntries(scalar(name).split('\n').map(value => value.split(/\s+/)));
  const runtime = ci1SystemdProperty(identity, 'RuntimeMaxUSec');
  const stop = ci1SystemdProperty(identity, 'TimeoutStopUSec');
  const killMode = ci1SystemdProperty(identity, 'KillMode');
  const standardOutput = ci1SystemdProperty(identity, 'StandardOutput');
  const standardError = ci1SystemdProperty(identity, 'StandardError');
  const mount = JSON.parse(child('findmnt', ['--json', '--target', root, '--output', 'TARGET,SOURCE,FSTYPE'])).filesystems[0];
  if (realpathSync(mount.target) !== root || !/^\/dev\/loop[0-9]+$/.test(mount.source)) refused();
  const loop = JSON.parse(child('losetup', ['--json', '--list', '--output', 'NAME,BACK-FILE,OFFSET,SIZELIMIT', mount.source])).loopdevices[0];
  const image = realpathSync(loop['back-file']);
  if (image !== join(dirname(root), 'data.img') || Number(loop.offset) !== 0 || Number(loop.sizelimit) !== CI1_LIMITS.filesystemBytes) refused();
  const filesystem = statfsSync(root), host = statfsSync(image), device = statSync(root).dev;
  const pathFact = path => { const info = statSync(path); return { realpath: realpathSync(path),
    device: info.dev, inode: info.ino, directory: info.isDirectory(), symlink: lstatSync(path).isSymbolicLink() }; };
  const paths = Object.fromEntries(['source', 'private', 'docker', 'containerd', 'run', 'tmp', 'home', 'npm-cache', 'runtime', 'home/.cache']
    .map(name => [name, pathFact(join(root, name))]));
  Object.assign(paths, { root: pathFact(root), compatibility: pathFact(CI1_RUNTIME),
    nodeModules: lstatSync(join(root, 'source', 'node_modules'), { throwIfNoEntry: false }) ? pathFact(join(root, 'source', 'node_modules')) : null });
  for (const [key, suffix] of Object.entries({ XDG_CONFIG_HOME: 'home/.config', DENO_DIR: 'home/.cache/deno' })) {
    if (env[key] !== undefined) paths[suffix] = pathFact(join(root, suffix));
  }
  const compatibility = JSON.parse(child('findmnt', ['--json', '--target', CI1_RUNTIME, '--output', 'TARGET,FSTYPE'])).filesystems[0];
  if (realpathSync(process.cwd()) !== join(root, 'source')) refused();
  const docker = JSON.parse(child('docker', ['info', '--format', '{{json .}}']));
  const ownedProcess = name => {
    const pid = readFileSync(join(root, 'run', `${name}.pid`), 'utf8').trim();
    if (!/^[1-9][0-9]*$/.test(pid)) refused();
    const argv = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
    return { argv, inCgroup: readFileSync(`/proc/${pid}/cgroup`, 'utf8').trim().split('\n')
      .some(line => line === `0::${cgroup}` || line.startsWith(`0::${cgroup}/`)) };
  };
  const mutablePathsOnVolume = assertCi1WriteBoundary({ root, environment: env, paths,
    runtimeMount: { target: compatibility.target, filesystem: compatibility.fstype },
    dockerd: ownedProcess('dockerd'), containerd: ownedProcess('containerd') }, identity);
  const containers = JSON.parse(child('docker', ['inspect', ...['db', 'auth', 'rest', 'kong', 'storage', 'realtime', 'edge_runtime', 'studio', 'pg_meta', 'inbucket', 'vector', 'analytics'].map(name => `supabase_${name}_${CI1_PROJECT}`)]));
  const containersInCgroup = containers.every(value => value.State.Running
    && readFileSync(`/proc/${value.State.Pid}/cgroup`, 'utf8').trim().split('\n').some(line => line.startsWith(`0::${cgroup}/`))
    && value.Mounts.every(mount => mount.Type === 'tmpfs' || (['bind', 'volume'].includes(mount.Type) && statSync(mount.Source).dev === device)));
  const origin = readJSON(join(dirname(root), 'host-namespaces.json'));
  const event = env.GITHUB_EVENT_PATH ? readJSON(env.GITHUB_EVENT_PATH) : null;
  const privateNamespaces = ['mnt', 'net', 'pid'].every(name => typeof origin[name] === 'string'
    && /^[a-z]+:\[[0-9]+\]$/.test(origin[name]) && readlinkSync(`/proc/self/ns/${name}`) !== origin[name]);
  return {
    platform: process.platform, arch: process.arch, githubHosted: env.GITHUB_ACTIONS === 'true' && env.RUNNER_ENVIRONMENT === 'github-hosted',
    publicRepository: event?.repository?.private === false, hostCPUs: cpus().length, hostMemoryBytes: totalmem(),
    repository: env.GITHUB_REPOSITORY, manual: env.GITHUB_EVENT_NAME === 'workflow_dispatch', unit: identity.unit, cgroup,
    delegatedSupervisor: ownCgroup === `${cgroup}/supervisor`,
    cpuMax: scalar('cpu.max'), memoryMax: scalar('memory.max'), swapMax: scalar('memory.swap.max'), pidsMax: scalar('pids.max'),
    runtimeSeconds: runtime === '30min' ? 1800 : -1, stopGraceSeconds: stop === '30s' ? 30 : -1, killMode, standardOutput, standardError,
    memoryCurrent: Number(scalar('memory.current')), pidsCurrent: Number(scalar('pids.current')),
    oomEvents: Number(events('memory.events').oom ?? 0) + Number(events('memory.events').oom_kill ?? 0),
    pidsLimitEvents: Number(events('pids.events').max ?? 0),
    filesystem: mount.fstype, loopBacked: true, imageBytes: statSync(image).size,
    imageAllocatedBytes: statSync(image).blocks * 512,
    filesystemBytes: filesystem.blocks * filesystem.bsize, filesystemFreeBytes: filesystem.bavail * filesystem.bsize,
    hostFreeBytes: host.bavail * host.bsize, mutablePathsOnVolume, privateNamespaces,
    noDefaultRoute: child('ip', ['route', 'show', 'default']).trim() === '',
    ownedDaemon: docker.DockerRootDir === `${root}/docker` && docker.CgroupDriver === 'cgroupfs' && typeof docker.ID === 'string' && docker.ID.length > 0,
    containersInCgroup,
    containersCoreDisabled: ci1ContainersCoreDisabled(containers, readFileSync('/proc/sys/kernel/core_pattern', 'utf8'),
      pid => readFileSync(`/proc/${pid}/limits`, 'utf8')),
  };
}

async function realAdapter(root, identity, mark = () => {}) {
  const source = realpathSync(process.cwd()), privateRoot = join(root, 'private');
  mark(2);
  assertCi1Envelope(readCi1LinuxEnvelope(root, identity), identity);
  mark(3);
  if (process.versions.node !== '24.16.0' || existsSync(join(privateRoot, 'bridge.env'))
    || lstatSync(join(source, 'node_modules'), { throwIfNoEntry: false })) refused();
  const lockBefore = ci1Hash(readFileSync('package-lock.json', 'utf8'));
  const installEnv = ci1ProcessEnvironment(root, process.env);
  // Fresh exact-lock install is offline, confined to the already verified volume.
  // No fallback to online/npm-global/cache from the host.
  mark(4);
  child('npm', ['ci', '--offline', '--cache', `${root}/npm-cache`, '--no-audit', '--no-fund'],
    { env: installEnv, timeout: CI1_LIMITS.phaseTimeoutMs });
  mark(5);
  if (ci1Hash(readFileSync('package-lock.json', 'utf8')) !== lockBefore) refused();
  mark(6);
  assertCi1Envelope(readCi1LinuxEnvelope(root, identity), identity);
  mark(7);
  const runtime = await import('./permission-identity-runtime.mjs');
  const fixture = await import('./permission-ci1-fixture.mjs');
  mark(8);
  const pinned = fixture.verifyCi1ImagePins();
  mark(9);
  const fingerprint = (await import('./permission-preflight-core.mjs')).permissionFingerprint;
  const adapter = {
    source, privateRoot, envelope: () => { fixture.verifyCi1ImagePins(); return readCi1LinuxEnvelope(root, identity); }, sourceFingerprint: fingerprint,
    configHash: config => ci1Hash(readFileSync(join(source, config), 'utf8')),
    bootstrap: async () => { await runtime.bootstrapBridgeRuntime(privateRoot); return fixture.prepareCi1Fixture(privateRoot); },
    baseline: () => fixture.captureCi1Baseline(privateRoot),
    preserved: baseline => fixture.verifyCi1Baseline(baseline, marker=>console.error(marker)),
    close: async () => {
      try { await fixture.closeCi1Fixture(); }
      finally { child('docker', ['stop', '--time', '10', ...pinned.containers.map(value => value.id)]); }
    },
    execute: async invocation => {
      if (existsSync(invocation.resultPath) || existsSync(invocation.observationPath)) refused();
      const env = ci1ProcessEnvironment(root, process.env);
      Object.assign(env, { IDEM_ENV_FILE: `${privateRoot}/bridge.env`, PERM_RUN_ID: identity.runId,
        PERM_RUN_STAGE: invocation.stage, PERM_RUN_CONFIG: invocation.configSHA,
        PERM_STAGE_OBSERVATION_FILE: invocation.observationPath, CI1_PRIVATE_ROOT: privateRoot,
        CI1_RESULTS_FILE: invocation.resultPath, CI1_COMMAND_ID: invocation.commandId,
        CI1_INVOCATION_SHA: invocation.invocationSHA, CI1_SOURCE_FINGERPRINT: invocation.sourceFingerprint,
        CI1_LOCK_SHA: invocation.lockSHA, CI1_CONFIG_SHA: invocation.configSHA, NO_COLOR: '1' });
      const log = join(privateRoot, `${invocation.id}-private.log`);
      const { createWriteStream } = await import('node:fs');
      const output = createWriteStream(log, { flags: 'wx', mode: 0o600 });
      let guardFailed = false;
      const result = await new Promise(resolveRun => {
        const proc = spawn(process.execPath, invocation.argv, { cwd: source, env, stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.pipe(output, { end: false }); proc.stderr.pipe(output, { end: false });
        let killTimer;
        const running = () => proc.pid && proc.exitCode === null && proc.signalCode === null;
        const stopChild = () => { guardFailed = true; if (!running()) return;
          proc.kill('SIGTERM'); killTimer ??= setTimeout(() => { if (running()) proc.kill('SIGKILL'); }, 1000); };
        const timer = setTimeout(stopChild, CI1_LIMITS.phaseTimeoutMs);
        const monitor = setInterval(() => {
          try { assertCi1Envelope(readCi1LinuxEnvelope(root, identity), identity); }
          catch { stopChild(); }
        }, 1000);
        proc.on('error', () => { guardFailed = true; });
        proc.on('close', code => { clearTimeout(timer); clearTimeout(killTimer); clearInterval(monitor); output.end(); resolveRun(code); });
        output.on('error', stopChild);
      });
      if (guardFailed) return { exitCode: null, result: null, observation: null };
      try { return { exitCode: result, result: readJSON(invocation.resultPath), observation: readJSON(invocation.observationPath) }; }
      catch { return { exitCode: result, result: null, observation: null }; }
    },
  };
  return adapter;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let phase = 1;
  try {
    if (process.argv[2] === 'plan' && process.argv.length === 5) {
      console.log(JSON.stringify(ci1LinuxRecipe(process.argv[3], Number(process.argv[4])), null, 2));
    } else if (process.argv[2] === 'run' && process.argv.length === 4) {
      const identity = ci1Identity(process.env.GITHUB_RUN_ID, Number(process.env.GITHUB_RUN_ATTEMPT));
      if (!/^[a-f0-9]{40}$/.test(process.env.GITHUB_WORKFLOW_SHA ?? '') || process.env.GITHUB_WORKFLOW_SHA.length !== 40) refused();
      const root = realpathSync(process.argv[3]), adapter = await realAdapter(root, identity, value=>{phase=value;});
      phase = 10;
      const sourceSHA = child('git', ['rev-parse', 'HEAD']).trim();
      phase = 11;
      const sourceFingerprint = await adapter.sourceFingerprint();
      phase = 12;
      const npm = child('npm', ['--version']).trim();
      const metadata = { repository: process.env.GITHUB_REPOSITORY, runId: identity.runId, attempt: identity.attempt,
        workflowSHA: process.env.GITHUB_WORKFLOW_SHA, sourceSHA,
        sourceFingerprint, lockSHA: ci1Hash(readFileSync('package-lock.json', 'utf8')),
        versions: { node: process.versions.node, npm, supabase: '2.117.0' } };
      phase = 13;
      const output = await runCi1Pilot(adapter, metadata, marker=>console.error(marker));
      phase = 14;
      writeFileSync(join(root, 'private', 'public-evidence.json'), output.json, { flag: 'wx', mode: 0o600 });
      phase = 15;
      writeFileSync(join(root, 'private', 'public-summary.md'), output.markdown, { flag: 'wx', mode: 0o600 });
      // Export/publish belongs to the separately approved future workflow.
      if (JSON.parse(output.json).overallStatus !== 'PASS') process.exitCode = 1;
    } else refused();
  } catch (error) { console.error(ci1HarnessFailureMarker(phase, error)); console.error('CI1_HARNESS_BLOCKED'); process.exitCode = 78; }
}
