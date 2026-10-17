import { createHash } from 'node:crypto';

const GiB = 1024 ** 3;
export const CI1_REPOSITORIES = Object.freeze(['nguyentronglinh045/pos-cafe-ci-preflight', 'nguyentronglinh045/pos-cafe']);
export const ci1TrustedRepository = value => CI1_REPOSITORIES.includes(value);
export const CI1_LIMITS = Object.freeze({
  cpuQuota: 300000, cpuPeriod: 100000, memoryBytes: 10 * GiB, swapBytes: 0,
  pids: 2048, runtimeSeconds: 1800, stopGraceSeconds: 30,
  filesystemBytes: 18 * GiB, taskBytes: 20 * GiB, hostReserveBytes: 30 * GiB,
  filesystemReserveBytes: GiB, outputBytes: 1024 ** 2, phaseTimeoutMs: 300000,
});
export const CI1_PROJECT = 'pos-cafe-perm-s31-t04-20261013';
export const CI1_RUNTIME = `/var/tmp/${CI1_PROJECT}`;
export const CI1_SUITES = Object.freeze([
  Object.freeze({ id: 'T09', commandId: 'T09_STORAGE_EDGE', required: 1,
    config: 'vitest.permission-images-runtime.config.ts', module: 'tests/contracts/permissionImagesRuntime.contract.test.ts',
    stage: 'candidate-images-service' }),
  Object.freeze({ id: 'T10', commandId: 'T10_REALTIME', required: 3,
    config: 'vitest.permission-signals.config.ts', module: 'tests/contracts/permissionSignals.contract.test.ts',
    stage: 'candidate-signals-database' }),
]);
export const ci1Hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const refuse = () => { throw new Error('CI1_GUARD_REFUSED'); };
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value)
  && value.length === length;

// Facts come from lstat/stat/realpath/findmnt and /proc, not a setup receipt.
// Kept pure so path escapes and incorrect daemon flags can be tested on Windows.
export function assertCi1WriteBoundary({ root, environment, paths, runtimeMount, dockerd, containerd }, identity) {
  if (typeof root !== 'string' || !root.startsWith('/') || /[\r\n\0]/.test(root)
    || root.endsWith('/') || !paths?.root?.directory || paths.root.realpath !== root || paths.root.symlink) refuse();
  const device = paths.root.device;
  const ownedDirectory = (fact, expected) => fact?.directory === true && fact.symlink === false
    && fact.realpath === expected && fact.device === device;
  for (const name of ['source', 'private', 'docker', 'containerd', 'run', 'tmp', 'home', 'npm-cache', 'runtime', 'home/.cache']) {
    if (!ownedDirectory(paths[name], `${root}/${name}`)) refuse();
  }
  if (paths.nodeModules && !ownedDirectory(paths.nodeModules, `${root}/source/node_modules`)) refuse();
  const fixed = { HOME: `${root}/home`, TMPDIR: `${root}/tmp`, XDG_CACHE_HOME: `${root}/home/.cache`, NPM_CONFIG_CACHE: `${root}/npm-cache` };
  if (!environment || Object.entries(fixed).some(([key, value]) => environment[key] !== value)
    || environment.DOCKER_HOST !== `unix://${root}/docker.sock` || environment.DOCKER_CONTEXT) refuse();
  for (const [key, suffix] of Object.entries({ TMP: 'tmp', TEMP: 'tmp', npm_config_cache: 'npm-cache',
    XDG_CONFIG_HOME: 'home/.config', DENO_DIR: 'home/.cache/deno' })) {
    if (environment[key] !== undefined && (environment[key] !== `${root}/${suffix}`
      || !ownedDirectory(paths[suffix], `${root}/${suffix}`))) refuse();
  }
  // A bind mount keeps its alias path under realpath(); inode/device identify the
  // actual backing directory, while findmnt proves the exact mount boundary.
  if (runtimeMount?.target !== CI1_RUNTIME || runtimeMount.filesystem !== 'ext4'
    || !ownedDirectory(paths.compatibility, CI1_RUNTIME)
    || paths.compatibility.inode !== paths.runtime.inode) refuse();
  const cgroup = `/system.slice/${ci1Identity(identity.runId, identity.attempt).unit}`;
  const matches = (daemon, flags) => daemon?.inCgroup === true && Array.isArray(daemon.argv)
    && flags.every(flag => { const key = flag.slice(0, flag.indexOf('='));
      return daemon.argv.includes(flag) && daemon.argv.filter(arg => arg === key || arg.startsWith(key + '=')).length === 1; });
  if (!matches(dockerd, [`--host=unix://${root}/docker.sock`, `--data-root=${root}/docker`,
    `--exec-root=${root}/run/docker`, `--pidfile=${root}/run/dockerd.pid`, `--containerd=${root}/run/containerd.sock`,
    `--cgroup-parent=${cgroup}`, '--exec-opt=native.cgroupdriver=cgroupfs', '--default-ulimit=core=0:0'])
    || !matches(containerd, [`--root=${root}/containerd`, `--state=${root}/run/containerd-state`,
      `--address=${root}/run/containerd.sock`])) refuse();
  return true;
}

export function ci1ProcessEnvironment(root, environment) {
  const output = Object.fromEntries(['PATH', 'LANG', 'TZ'].filter(key => environment[key]).map(key => [key, environment[key]]));
  return Object.assign(output, { HOME: `${root}/home`, TMPDIR: `${root}/tmp`, TMP: `${root}/tmp`, TEMP: `${root}/tmp`,
    XDG_CACHE_HOME: `${root}/home/.cache`, NPM_CONFIG_CACHE: `${root}/npm-cache`, DOCKER_HOST: `unix://${root}/docker.sock`, NO_COLOR: '1' });
}

export function ci1Identity(runId, attempt) {
  if (typeof runId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(runId) || /\s/.test(runId)
    || !Number.isSafeInteger(attempt) || attempt < 1 || attempt > 1000) refuse();
  return { runId, attempt, unit: `pos-cafe-ci1-r${runId}-a${attempt}.service` };
}

// An assertion over read-back facts, never a receipt saying limits were applied.
// The real adapter below the harness must obtain these from Linux, not CLI input.
export function assertCi1Envelope(proof, identity) {
  const expected = ci1Identity(identity.runId, identity.attempt);
  if (!proof || proof.platform !== 'linux' || proof.arch !== 'x64' || proof.githubHosted !== true
    || proof.publicRepository !== true || proof.hostCPUs !== 4 || proof.hostMemoryBytes < 14 * GiB || proof.hostMemoryBytes > 18 * GiB
    || !ci1TrustedRepository(proof.repository) || proof.manual !== true
    || proof.unit !== expected.unit || proof.cgroup !== `/system.slice/${expected.unit}` || proof.delegatedSupervisor !== true) refuse();
  if (proof.cpuMax !== `${CI1_LIMITS.cpuQuota} ${CI1_LIMITS.cpuPeriod}`
    || proof.memoryMax !== String(CI1_LIMITS.memoryBytes) || proof.swapMax !== '0'
    || proof.pidsMax !== String(CI1_LIMITS.pids) || proof.runtimeSeconds !== CI1_LIMITS.runtimeSeconds
    || proof.killMode !== 'control-group' || proof.stopGraceSeconds !== CI1_LIMITS.stopGraceSeconds
    || proof.standardOutput !== 'null' || proof.standardError !== 'null') refuse();
  if (proof.filesystem !== 'ext4' || proof.loopBacked !== true
    || proof.imageBytes !== CI1_LIMITS.filesystemBytes || proof.filesystemBytes > CI1_LIMITS.filesystemBytes
    || proof.imageAllocatedBytes < CI1_LIMITS.filesystemBytes || proof.imageAllocatedBytes > CI1_LIMITS.filesystemBytes + 1024 ** 2
    || proof.filesystemBytes <= 0 || proof.filesystemFreeBytes < CI1_LIMITS.filesystemReserveBytes
    || proof.hostFreeBytes < CI1_LIMITS.hostReserveBytes || proof.mutablePathsOnVolume !== true) refuse();
  for (const key of ['hostMemoryBytes', 'imageAllocatedBytes', 'filesystemBytes', 'filesystemFreeBytes', 'hostFreeBytes', 'memoryCurrent', 'pidsCurrent']) {
    if (!Number.isSafeInteger(proof[key]) || proof[key] < 0) refuse();
  }
  if (proof.filesystemFreeBytes > proof.filesystemBytes) refuse();
  if (proof.memoryCurrent >= CI1_LIMITS.memoryBytes || proof.pidsCurrent >= CI1_LIMITS.pids
    || proof.oomEvents !== 0 || proof.pidsLimitEvents !== 0 || proof.privateNamespaces !== true
    || proof.noDefaultRoute !== true || proof.ownedDaemon !== true || proof.containersInCgroup !== true
    || proof.containersCoreDisabled !== true) refuse();
  return true;
}

export function ci1Invocation(suite, { source, privateRoot, runId, sourceFingerprint, lockSHA, configSHA }) {
  const expected = CI1_SUITES.find(value => value.id === suite);
  if (!expected || !hex(sourceFingerprint, 64) || !hex(lockSHA, 64) || !hex(configSHA, 64)
    || !source?.startsWith('/') || !privateRoot?.startsWith('/') || /[\r\n\0]/.test(source + privateRoot)) refuse();
  ci1Identity(runId, 1);
  const argv = ['node_modules/vitest/vitest.mjs', 'run', '--config', expected.config,
    '--allowOnly=false', '--retry=0', '--reporter', './scripts/permission-ci1-vitest-reporter.mjs'];
  return { ...expected, argv, cwd: source, runId, sourceFingerprint, lockSHA, configSHA,
    invocationSHA: ci1Hash({ commandId: expected.commandId, argv, sourceFingerprint, lockSHA, configSHA }),
    resultPath: `${privateRoot}/${suite}-results.json`, observationPath: `${privateRoot}/${suite}-observation.json` };
}

// No raw names, failure messages or error text are accepted into public evidence.
export function ci1SuiteResult(invocation, { exitCode, result, observation, markerProof }) {
  const failure = { id: invocation.id, status: 'ERROR', exitCode: Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 255 ? exitCode : null, counts: null };
  if (!result || result.schemaVersion !== 'permission-ci1-suite-v1' || result.runId !== invocation.runId
    || result.commandId !== invocation.commandId || result.invocationSHA !== invocation.invocationSHA
    || result.sourceFingerprint !== invocation.sourceFingerprint || result.lockSHA !== invocation.lockSHA
    || result.configSHA !== invocation.configSHA) return failure;
  if (!observation || observation.schemaVersion !== 'permission-stage-observation-v1'
    || observation.runId !== invocation.runId || observation.stage !== invocation.stage
    || observation.sourceFingerprint !== invocation.sourceFingerprint
    || observation.executionProfile?.stage !== invocation.stage || observation.executionProfile?.executionKind !== 'service'
    || observation.executionProfile?.profile !== 'candidate'
    || observation.executionProfile?.configId !== invocation.configSHA
    || observation.executionProfile?.markerProof !== markerProof
    || observation.executionProfile?.backend?.reference !== CI1_PROJECT
    || observation.executionProfile?.backend?.host !== '127.0.0.1'
    || observation.executionProfile?.backend?.port !== 62422
    || observation.executionProfile?.backend?.database !== 'postgres'
    || observation.executionProfile?.backend?.engine !== 'supabase-cli-2.117.0'
    || observation.executionProfile?.apiBinding?.projectRef !== CI1_PROJECT
    || observation.executionProfile?.apiBinding?.baseUrl !== 'http://127.0.0.1:62421') return failure;
  const values = ['run', 'pass', 'fail', 'skip', 'errorCount', 'hookErrorCount'];
  if (values.some(key => !Number.isSafeInteger(result[key]) || result[key] < 0)
    || result.run !== result.pass + result.fail || result.run + result.skip > invocation.required
    || !Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) return failure;
  const pass = exitCode === 0 && result.success === true && result.run === invocation.required
    && result.pass === invocation.required && result.fail === 0 && result.skip === 0
    && result.errorCount === 0 && result.hookErrorCount === 0;
  if (!pass && exitCode === 0 && result.run === invocation.required && result.pass === invocation.required
    && result.fail === 0 && result.skip === 0) return failure;
  // Success=true with contradictory counts is malformed, not a partial PASS.
  if (result.success === true && !pass && exitCode === 0 && !result.skip
    && result.errorCount === 0 && result.hookErrorCount === 0) return failure;
  return { id: invocation.id, status: pass ? 'PASS' : 'FAIL', exitCode,
    counts: { required: invocation.required, run: result.run, pass: result.pass, fail: result.fail, skip: result.skip } };
}
