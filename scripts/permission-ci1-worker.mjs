// Local preparation source. Every effectful entry point requires future explicit
// execution authorization on a public standard GitHub Linux runner.
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, lstatSync, statSync, statfsSync,
  readdirSync, readlinkSync, chmodSync, symlinkSync, unlinkSync, openSync, closeSync, writeSync } from 'node:fs';
import { resolve, join, dirname, basename, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpus, totalmem } from 'node:os';
import { coreDumpDisabled } from './project-ci-launch.mjs';
import { CI1_LIMITS, CI1_PROJECT, CI1_RUNTIME, ci1ProcessEnvironment, assertCi1Envelope, ci1TrustedRepository } from './permission-ci1-policy.mjs';
import { ci1LinuxRecipe, readCi1LinuxEnvelope, ci1SystemdProperty, ci1HarnessFailureFacts } from './permission-ci1-harness.mjs';
import { renderCi1Evidence } from './permission-ci1-evidence.mjs';
import { CI1_SETUP, ci1BytesHash, ci1NpmIntake, ci1ToolsIntake, ci1CheckTarListing, ci1EdgeIntake,
  assertCi1Supervisor, ci1WorkerLayout, ci1ImagesIntake } from './permission-ci1-intake.mjs';

const refused = () => { throw new Error('CI1_WORKER_REFUSED'); };
const parse = path => { if (statSync(path).size > 32 * 1024 ** 2) refused(); return JSON.parse(readFileSync(path, 'utf8')); };
const names = ['db', 'auth', 'rest', 'kong', 'storage', 'realtime', 'edge_runtime', 'studio', 'pg_meta', 'inbucket', 'vector', 'analytics'];
const fixedEnv = (root, env) => ({ ...ci1ProcessEnvironment(root, env), LANG: 'C.UTF-8', LC_ALL: 'C',
  PATH: `${root}/runtime/node/bin:${root}/runtime/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
  NPM_CONFIG_USERCONFIG: `${root}/run/npm-user.conf`, NPM_CONFIG_GLOBALCONFIG: `${root}/run/npm-global.conf`,
  NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false', NPM_CONFIG_FETCH_RETRIES: '0', NPM_CONFIG_FETCH_TIMEOUT: '60000',
  CI: 'true', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' });
const ghKeys = ['GITHUB_ACTIONS', 'RUNNER_ENVIRONMENT', 'GITHUB_REPOSITORY', 'GITHUB_EVENT_NAME', 'GITHUB_EVENT_PATH',
  'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_WORKFLOW_SHA', 'GITHUB_SHA', 'CI1_EXECUTION_AUTHORIZED'];
const githubEnv = env => Object.fromEntries(ghKeys.filter(key => env[key]).map(key => [key, env[key]]));

const failureStages = ['supervisor', 'loop', 'source-tools', 'npm-images', 'edge-network-warm', 'stop-prefetch',
  'private-namespaces', 'offline-edge', 'stack', 'harness', 'export', 'cleanup'];
const failureOperations = ['SOURCE_INTAKE', 'SOURCE_CLONE', 'SOURCE_REF', 'SOURCE_CONFIG', 'TOOL_MANIFEST',
  'DOWNLOAD_NODE', 'INSPECT_NODE', 'EXTRACT_NODE', 'DOWNLOAD_SUPABASE', 'INSPECT_SUPABASE', 'EXTRACT_SUPABASE',
  'PLACE_TOOLS', 'TOOL_VERSIONS', 'STACK_TEMPLATE', 'FORMAT_VOLUME', 'RESERVE_VOLUME',
  'NPM_DOWNLOAD', 'NPM_INSPECT', 'NPM_CACHE', 'PREFETCH_DAEMONS', 'PREFETCH_READY',
  'IMAGE_PULL', 'IMAGE_TAG', 'IMAGE_INSPECT', 'EDGE_VOLUME_CHECK', 'EDGE_VOLUME_CREATE', 'EDGE_VOLUME_EMPTY',
  'EDGE_BUNDLE', 'EDGE_CACHE_PROOF', 'EDGE_PROOF_WRITE', 'CLEANUP_EXPORT', 'CLEANUP_DAEMONS', 'CLEANUP_UNMOUNT', 'CLEANUP_DETACH',
  'OFFLINE_SUPERVISOR', 'OFFLINE_LOOP', 'OFFLINE_NAMESPACES', 'OFFLINE_MOUNT_PRIVATE', 'OFFLINE_RUNTIME_BIND', 'OFFLINE_NETWORK',
  'OFFLINE_IMAGE', 'OFFLINE_DAEMONS', 'OFFLINE_READY', 'OFFLINE_CACHE_BEFORE', 'OFFLINE_BUNDLE1', 'OFFLINE_BUNDLE2',
  'OFFLINE_CACHE_AFTER', 'OFFLINE_PROOF_WRITE', 'STACK_START', 'STACK_ENVELOPE', 'STACK_STATUS',
  'EDGE_HEALTH_PUBLIC', 'EDGE_HEALTH_GATEWAY', 'OFFLINE_CACHE_FINAL', 'PILOT_HARNESS', 'ISOLATED_STOP_DAEMONS'];
const failureCommands = ['git', 'tar', 'node', 'npm', 'supabase', 'fallocate', 'losetup', 'mkfs.ext4', 'mount', 'umount',
  'cp', 'mv', 'docker', 'unshare', 'systemd-run', 'systemctl', 'findmnt', 'containerd', 'dockerd', 'ip', 'busctl'];
const failureCodes = ['GUARD_REFUSED', 'INTAKE_REFUSED', 'COMMAND_FAILED', 'COMMAND_TIMEOUT', 'OUTPUT_LIMIT',
  'IO_MISSING', 'IO_NOTDIR', 'IO_DENIED', 'JS_TYPE_ERROR', 'SUPERVISOR_REFUSED', 'LOOP_REFUSED', 'CONTROL_REFUSED',
  'DOCKER_DAEMON_UNAVAILABLE', 'DOCKER_NO_SPACE', 'DOCKER_PERMISSION', 'DOCKER_TLS', 'DOCKER_REGISTRY_AUTH',
  'DOCKER_REGISTRY_NOT_FOUND', 'DOCKER_REGISTRY_RATE_LIMIT', 'DOCKER_NETWORK', 'DOCKER_API_VERSION', 'DOCKER_UNPACK',
  'EDGE_CACHE_ENTRY', 'EDGE_CACHE_TYPE', 'EDGE_CACHE_PACKAGE', 'EDGE_CACHE_VERSION', 'EDGE_CACHE_PIN',
  'EDGE_CACHE_METADATA', 'EDGE_CACHE_NAME', 'EDGE_CACHE_SRI', 'EDGE_CACHE_TARBALL', 'EDGE_CACHE_DEPENDENCIES',
  'EDGE_CACHE_BOUND', 'EDGE_CACHE_INCOMPLETE', 'UNMOUNT_BUSY', 'UNMOUNT_PERMISSION', 'UNMOUNT_NOT_MOUNTED', 'UNKNOWN'];
const failureMetrics = ['hostFreeBytes', 'memoryBytes', 'oom', 'pidsEvents', 'memoryCurrentBytes', 'pidsCurrent',
  'cpuMatches', 'memoryLimitMatches', 'swapLimitMatches', 'pidsLimitMatches', 'cgroupMatches', 'runtimeMatches', 'loggingMatches',
  'loopImageBytes', 'loopAllocatedBytes', 'loopFilesystemBytes', 'loopFreeBytes', 'loopOffset', 'loopSizeLimit', 'mountMatches', 'ownerMatches', 'imageOrdinal', 'edgePackageOrdinal',
  'edgeVersionMajor', 'edgeVersionMinor', 'edgeVersionPatch', 'edgeVersionCopy', 'edgeCacheEntryCount', 'edgeRegistryMetadataPresent', 'loopNestedMounts',
  'isolatedFailureSeen', 'isolatedCleanupFailed', 'systemdPropertyOrdinal', 'imagePullAttempt', 'imageRegistryOrdinal',
  'harnessPhaseOrdinal', 'harnessFailureOrdinal', 'harnessExitOrdinal', 'harnessNpmFailureOrdinal',
  'suiteOrdinal','suiteHookErrorCount','suiteRunErrorCount','suiteErrorOriginOrdinal',
  'suiteCleanupPhaseOrdinal','suiteCleanupStepOrdinal','suiteCleanupCodeOrdinal','suiteCleanupSqlstateOrdinal',
  'preservationComponentDriftMask','preservationFinancialDriftMask'];

export async function ci1PullImage(run, reference, guard = () => {}, wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)), onAttempt = () => {}) {
  if (typeof reference !== 'string' || !/^public\.ecr\.aws\/supabase\/[a-z0-9._-]+@sha256:[a-f0-9]{64}$/.test(reference)) refused();
  for (let attempt = 1; attempt <= 3; attempt++) {
    guard(); onAttempt(attempt);
    try { run('docker', ['pull', '--quiet', '--platform', 'linux/amd64', reference]); return reference; }
    catch (error) {
      if (error?.ci1FailureCode !== 'DOCKER_REGISTRY_RATE_LIMIT') throw error;
      if (attempt === 3) {
        // Supabase's own CLI supports this public mirror. Keep the exact OCI
        // manifest digest: no tag resolution, new version or credentials.
        const mirror = reference.replace(/^public\.ecr\.aws\//, 'ghcr.io/');
        guard(); onAttempt(4);
        run('docker', ['pull', '--quiet', '--platform', 'linux/amd64', mirror]);
        return mirror;
      }
    }
    await wait(attempt === 1 ? 10000 : 30000);
    guard();
  }
}
export function ci1UnmountFailureCode(stderr) {
  if (typeof stderr !== 'string' || Buffer.byteLength(stderr) > 1024 ** 2) return null;
  for (const [code, pattern] of Object.entries({ UNMOUNT_BUSY: /target is busy|device or resource busy/i,
    UNMOUNT_PERMISSION: /must be superuser|not superuser|permission denied|operation not permitted/i,
    UNMOUNT_NOT_MOUNTED: /not mounted|no mount point specified/i })) if (pattern.test(stderr)) return code;
  return null;
}

export function ci1OwnedMountCount(tree, root, loop) {
  if (typeof root !== 'string' || /[\r\n\0]/.test(root) || posix.resolve(root) !== root || root === '/'
    || !/^\/dev\/loop[0-9]+$/.test(loop) || tree?.target !== root || tree.source !== loop) refused();
  const queue = [tree]; let count = 0;
  while (queue.length) {
    const item = queue.shift();
    if (++count > 4096 || typeof item?.target !== 'string' || /[\r\n\0]/.test(item.target)
      || posix.resolve(item.target) !== item.target || (item.target !== root && !item.target.startsWith(root + '/'))
      || (item.children !== undefined && !Array.isArray(item.children))) refused();
    if (item.children) queue.push(...item.children);
  }
  return count - 1;
}
export function ci1DockerFailureCode(stderr) {
  if (typeof stderr !== 'string' || Buffer.byteLength(stderr) > 1024 ** 2) return null;
  for (const [code, pattern] of Object.entries({
    DOCKER_NO_SPACE: /no space left on device|disk quota exceeded/i,
    DOCKER_API_VERSION: /client version .*too (?:old|new)|minimum supported API version|maximum supported API version/i,
    DOCKER_REGISTRY_RATE_LIMIT: /toomanyrequests|too many requests|status(?: code)?[: ]+429/i,
    DOCKER_REGISTRY_AUTH: /unauthorized|authentication required|authorization token.*invalid|access denied/i,
    DOCKER_REGISTRY_NOT_FOUND: /manifest unknown|manifest.*not found|name unknown/i,
    DOCKER_TLS: /x509:|certificate.*(?:expired|unknown|invalid)|TLS handshake/i,
    DOCKER_DAEMON_UNAVAILABLE: /cannot connect to the docker daemon|is the docker daemon running/i,
    DOCKER_PERMISSION: /operation not permitted|permission denied/i,
    DOCKER_NETWORK: /i\/o timeout|context deadline exceeded|connection refused|no such host|network is unreachable/i,
    DOCKER_UNPACK: /failed to register layer|failed to extract layer|failed to unpack/i,
  })) if (pattern.test(stderr)) return code;
  return null;
}
export function ci1FailureExport(value) {
  if (!value || typeof value !== 'object') return null;
  const output = {
    stage: failureStages.includes(value.stage) ? value.stage : 'supervisor',
    operation: failureOperations.includes(value.operation) ? value.operation : null,
    code: failureCodes.includes(value.code) ? value.code : 'UNKNOWN',
    command: failureCommands.includes(value.command) ? value.command : null,
    exitCode: Number.isSafeInteger(value.exitCode) && value.exitCode >= 0 && value.exitCode <= 255 ? value.exitCode : null,
  };
  const facts = Object.fromEntries(Object.entries(value.facts ?? {}).filter(([key, number]) =>
    failureMetrics.includes(key) && Number.isSafeInteger(number) && number >= 0));
  if (Object.keys(facts).length) output.facts = facts;
  return output;
}
export function ci1IsolatedFailure(value, identity, sourceSHA) {
  if (value?.schemaVersion !== 'permission-ci1-isolated-failure-v1'
    || Object.keys(value).sort().join(',') !== ['schemaVersion','runId','attempt','sourceSHA','failure','cleanupFailure'].sort().join(',')
    || value.runId !== identity.runId || value.attempt !== identity.attempt || value.sourceSHA !== sourceSHA
    || !/^[a-f0-9]{40}$/.test(sourceSHA) || (!value.failure && !value.cleanupFailure)) refused();
  const failure = ci1FailureExport(value.failure), cleanupFailure = ci1FailureExport(value.cleanupFailure);
  if (JSON.stringify(failure) !== JSON.stringify(value.failure) || JSON.stringify(cleanupFailure) !== JSON.stringify(value.cleanupFailure)
    || (failure && failure.stage !== 'offline-edge') || (cleanupFailure && cleanupFailure.stage !== 'cleanup')) refused();
  return { failure, cleanupFailure };
}
export function ci1IsolatedError(value, identity, sourceSHA) {
  const inner = ci1IsolatedFailure(value, identity, sourceSHA), cause = inner.failure ?? inner.cleanupFailure;
  return { operation: cause.operation, error: Object.assign(new Error('CI1_WORKER_REFUSED'), {
    ci1FailureCode: cause.code, ci1Command: cause.command, status: cause.exitCode,
    ci1Facts: { ...cause.facts, isolatedFailureSeen: 1, isolatedCleanupFailed: inner.cleanupFailure ? 1 : 0 },
  }) };
}
const failureDetails = (error, stage, operation, facts = {}) => ci1FailureExport({stage, operation,
  code: failureCodes.includes(error?.ci1FailureCode) ? error.ci1FailureCode
    : ({ENOENT:'IO_MISSING',ENOTDIR:'IO_NOTDIR',EACCES:'IO_DENIED',ETIMEDOUT:'COMMAND_TIMEOUT',
    ENOBUFS:'OUTPUT_LIMIT',ERR_CHILD_PROCESS_STDIO_MAXBUFFER:'OUTPUT_LIMIT'})[error?.code]
    ?? (error?.message === 'CI1_WORKER_REFUSED' ? 'GUARD_REFUSED' : error?.message === 'CI1_INTAKE_REFUSED'
      ? 'INTAKE_REFUSED' : error?.name === 'TypeError' ? 'JS_TYPE_ERROR' : Number.isInteger(error?.status) ? 'COMMAND_FAILED' : 'UNKNOWN'),
  command:error?.ci1Command,exitCode:error?.status,facts:{...facts,...error?.ci1Facts}});

function taskControl(layout, env) {
  const directory = lstatSync(layout.task), path = `${layout.task}/run-control.json`, info = lstatSync(path);
  if (!directory.isDirectory() || directory.isSymbolicLink() || directory.uid !== 0 || (directory.mode & 0o077)
    || !info.isFile() || info.isSymbolicLink() || info.uid !== 0 || (info.mode & 0o077) || info.size > 4096) refused();
  const control = parse(path);
  if (control.runId !== layout.identity.runId || control.attempt !== layout.identity.attempt || control.sourceSHA !== env.GITHUB_SHA
    || control.unit !== layout.identity.unit || control.workerSHA !== ci1BytesHash(readFileSync(new URL(import.meta.url)))) refused();
  return control;
}

function loopControl(layout) {
  const facts = {};
  try {
  const root = layout.volume, options = { encoding: 'utf8', timeout: 10000, maxBuffer: 8192, stdio: ['ignore', 'pipe', 'pipe'] };
  const mount = JSON.parse(execFileSync('findmnt', ['--json', '--target', root, '--output', 'TARGET,SOURCE,FSTYPE'], options)).filesystems[0];
  if (mount.target !== root || mount.fstype !== 'ext4' || !/^\/dev\/loop[0-9]+$/.test(mount.source)) refused();
  const loop = JSON.parse(execFileSync('losetup', ['--json', '--list', '--output', 'BACK-FILE,OFFSET,SIZELIMIT', mount.source], options)).loopdevices[0];
  const image = lstatSync(layout.image), filesystem = statfsSync(root);
  Object.assign(facts, {loopImageBytes:image.size,loopAllocatedBytes:image.blocks*512,
    loopFilesystemBytes:filesystem.blocks*filesystem.bsize,loopFreeBytes:filesystem.bavail*filesystem.bsize,
    loopOffset:Number(loop.offset),loopSizeLimit:Number(loop.sizelimit),
    mountMatches:mount.target===root&&mount.fstype==='ext4'?1:0,ownerMatches:image.uid===0?1:0});
  if (!image.isFile() || image.isSymbolicLink() || image.uid !== 0 || realpathSync(loop['back-file']) !== layout.image
    || Number(loop.offset) !== 0 || Number(loop.sizelimit) !== CI1_LIMITS.filesystemBytes || image.size !== CI1_LIMITS.filesystemBytes
    || image.blocks * 512 < CI1_LIMITS.filesystemBytes || image.blocks * 512 > CI1_LIMITS.filesystemBytes + 1024 ** 2
    || filesystem.blocks * filesystem.bsize > CI1_LIMITS.filesystemBytes
    || filesystem.bavail * filesystem.bsize < CI1_LIMITS.filesystemReserveBytes) refused();
  return true;
  } catch (error) { error.ci1FailureCode='LOOP_REFUSED';error.ci1Facts=facts;throw error; }
}

export function ci1WorkerPlan(runId, attempt) {
  const layout = ci1WorkerLayout(runId, attempt);
  return { schemaVersion: 'permission-ci1-worker-plan-v1', mode: 'LOCAL_PREPARATION_ONLY', layout,
    limits: CI1_LIMITS, intakeLimits: CI1_SETUP,
    stages: ['supervisor', 'loop', 'source-tools', 'npm-images', 'edge-network-warm', 'stop-prefetch',
      'private-namespaces', 'offline-edge', 'stack', 'harness', 'export'],
    launchPrefix: ci1LinuxRecipe(runId, attempt).systemdArgv,
    executionAuthorized: false, publicationAuthorized: false,
    futureEffects: ['exclusive preallocated loop', 'verified tool/tar download inside volume', 'owned daemon/cache warm',
      'temporary download unlink only after owned verified ingestion', 'synthetic local stack only', 'owned shutdown/unmount/detach'],
  };
}

// Adapter tests assert order and abort behavior, without executing any Linux command.
export async function runCi1Worker(adapter, identity) {
  const completed = [];
  let status = 'ERROR', activeStage = 'supervisor', entered = false, failure = null, cleanup = false, cleanupFailure = null;
  try {
    assertCi1Supervisor(await adapter.supervisor(), identity);
    for (const stage of ['loop', 'source-tools', 'npm-images', 'edge-network-warm', 'stop-prefetch',
      'private-namespaces', 'offline-edge', 'stack', 'harness', 'export']) {
      activeStage = stage; entered = false;
      assertCi1Supervisor(await adapter.supervisor(), identity);
      entered = true;
      if (await adapter.stage(stage) !== true) refused();
      completed.push(stage);
    }
    status = 'COMPLETE';
  } catch (error) { failure = failureDetails(error, activeStage, entered ? adapter.operation?.() : null, adapter.failureFacts?.()); }
  finally { try { cleanup = await adapter.close() === true; if (!cleanup) status = 'ERROR'; }
    catch (error) { status = 'ERROR'; cleanupFailure = failureDetails(error, 'cleanup', null); failure ??= cleanupFailure; }
    cleanupFailure ??= ci1FailureExport(adapter.cleanupFailure?.());
    if (cleanupFailure) { cleanup = false; status = 'ERROR'; failure ??= cleanupFailure; }
  }
  return { schemaVersion: 'permission-ci1-worker-status-v1', status, completed,
    businessCounts: null, evidence: status === 'COMPLETE' ? 'D12_PUBLIC_EVIDENCE_REQUIRED' : 'NOT_RUN_OR_PARTIAL', failure, cleanup, cleanupFailure };
}

function runnerGuard(env) {
  if (process.platform !== 'linux' || process.arch !== 'x64' || process.getuid?.() !== 0
    || env.CI1_EXECUTION_AUTHORIZED !== 'yes' || env.GITHUB_ACTIONS !== 'true'
    || env.RUNNER_ENVIRONMENT !== 'github-hosted' || !ci1TrustedRepository(env.GITHUB_REPOSITORY)
    || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || cpus().length !== 4 || totalmem() < 14 * 1024 ** 3
    || /microsoft/i.test(readFileSync('/proc/version', 'utf8')) || parse(env.GITHUB_EVENT_PATH)?.repository?.private !== false
    || typeof env.GITHUB_SHA !== 'string' || env.GITHUB_SHA.length !== 40
    || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA) || env.GITHUB_SHA !== env.GITHUB_WORKFLOW_SHA) refused();
}

function commandRunner(env, guard = () => {}) {
  return (command, args, options = {}) => {
    guard();
    try { return execFileSync(command, args, { env, encoding: 'utf8', timeout: CI1_SETUP.commandTimeoutMs,
      maxBuffer: 1024 ** 2, stdio: ['ignore', 'pipe', 'pipe'], ...options }); }
    catch (error) {
      error.ci1Command = failureCommands.includes(basename(command)) ? basename(command) : null;
      if (basename(command) === 'docker') error.ci1FailureCode = ci1DockerFailureCode(error.stderr);
      if (basename(command) === 'umount') error.ci1FailureCode = ci1UnmountFailureCode(error.stderr);
      throw error;
    }
  };
}

function supervisor(layout, env) {
  runnerGuard(env);
  if (!coreDumpDisabled(readFileSync('/proc/self/limits', 'utf8'), readFileSync('/proc/sys/kernel/core_pattern', 'utf8'))) refused();
  try { taskControl(layout, env); } catch (error) { error.ci1FailureCode='CONTROL_REFUSED';throw error; }
  const cgroup = `/system.slice/${layout.identity.unit}`, cg = '/sys/fs/cgroup' + cgroup;
  const scalar = name => readFileSync(`${cg}/${name}`, 'utf8').trim();
  const metric = (file, name) => Number(scalar(file).split('\n').find(line => line.startsWith(name + ' '))?.split(' ')[1] ?? -1);
  const show = name => ci1SystemdProperty(layout.identity, name);
  const host = statfsSync(layout.task);
  const proof = { platform: process.platform, arch: process.arch, root: process.getuid() === 0, wsl: false, authorized: true,
    githubHosted: true, publicRepository: true, manual: true, repository: env.GITHUB_REPOSITORY, cpus: cpus().length,
    memoryBytes: totalmem(), cgroup: readFileSync('/proc/self/cgroup', 'utf8').trim().split('\n').find(line => line.startsWith('0::'))?.slice(3),
    cpuMax: scalar('cpu.max'), memoryMax: scalar('memory.max'), swapMax: scalar('memory.swap.max'), pidsMax: scalar('pids.max'),
    runtime: show('RuntimeMaxUSec'), stop: show('TimeoutStopUSec'), kill: show('KillMode'),
    stdout: show('StandardOutput'), stderr: show('StandardError'),
    oom: metric('memory.events', 'oom') + metric('memory.events', 'oom_kill'), pidsEvents: metric('pids.events', 'max'),
    hostFreeBytes: host.bavail * host.bsize };
  const memoryCurrentBytes=Number(scalar('memory.current')),pidsCurrent=Number(scalar('pids.current'));
  try {
    assertCi1Supervisor(proof, layout.identity);
    if (memoryCurrentBytes >= CI1_LIMITS.memoryBytes || pidsCurrent >= CI1_LIMITS.pids) refused();
  } catch (error) {
    error.ci1FailureCode='SUPERVISOR_REFUSED';
    error.ci1Facts={hostFreeBytes:proof.hostFreeBytes,memoryBytes:proof.memoryBytes,oom:proof.oom,pidsEvents:proof.pidsEvents,memoryCurrentBytes,pidsCurrent,
      cpuMatches:proof.cpuMax===`${CI1_LIMITS.cpuQuota} ${CI1_LIMITS.cpuPeriod}`?1:0,memoryLimitMatches:proof.memoryMax===String(CI1_LIMITS.memoryBytes)?1:0,
      swapLimitMatches:proof.swapMax==='0'?1:0,pidsLimitMatches:proof.pidsMax===String(CI1_LIMITS.pids)?1:0,
      cgroupMatches:proof.cgroup===`${cgroup}/supervisor`?1:0,runtimeMatches:proof.runtime==='30min'?1:0,
      loggingMatches:proof.stdout==='null'&&proof.stderr==='null'?1:0};
    throw error;
  }
  if (existsSync(layout.volume) && statSync(layout.volume).dev !== statSync(layout.task).dev) {
    loopControl(layout);
  }
  return proof;
}

function boundedTree(root, maximum, countMaximum = 100000) {
  root = realpathSync(root); const device = statSync(root).dev;
  const output = []; let bytes = 0;
  const visit = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name), name = prefix + entry.name, info = lstatSync(path);
      if (info.isSymbolicLink() || info.dev !== device || /[\r\n\0]/.test(name)) refused();
      if (info.isDirectory()) visit(path, name + '/');
      else if (info.isFile()) {
        bytes += info.size;
        if (bytes > maximum || output.length >= countMaximum) refused();
        output.push({ path: name, bytes: info.size, sha256: ci1BytesHash(readFileSync(path)) });
      } else refused();
    }
  }; visit(root);
  return { files: output, bytes, sha256: ci1BytesHash(JSON.stringify(output)) };
}

async function download(item, destination, algorithm, guard) {
  guard();
  if (!Number.isSafeInteger(item.maxBytes) || item.maxBytes < 1) refused();
  let url = new URL(item.url), response;
  for (let redirects = 0; redirects < 5; redirects++) {
    if (url.protocol !== 'https:' || !['nodejs.org', 'github.com', 'release-assets.githubusercontent.com', 'registry.npmjs.org'].includes(url.hostname)) refused();
    response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(120000), headers: { 'User-Agent': 'pos-cafe-ci1' } });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    url = new URL(response.headers.get('location'), url);
  }
  if (response?.status !== 200 || !response.body) refused();
  const fd = openSync(destination, 'wx', 0o600), hash = createHash(algorithm); let bytes = 0;
  let lastGuard = Date.now();
  try {
    for await (const chunk of response.body) { bytes += chunk.length;
      if (bytes > item.maxBytes || (item.bytes && bytes > item.bytes)) refused();
      hash.update(chunk); let offset = 0;
      while (offset < chunk.length) offset += writeSync(fd, chunk, offset, chunk.length - offset);
      if (Date.now() - lastGuard >= 1000) { guard(); lastGuard = Date.now(); }
    }
  } finally { closeSync(fd); }
  if ((item.bytes && bytes !== item.bytes) || statSync(destination).size !== bytes) refused();
  const digest = hash.digest(algorithm === 'sha512' ? 'base64' : 'hex');
  if (digest !== (algorithm === 'sha512' ? item.integrity.slice(7) : item.sha256)) refused();
  guard(); return bytes;
}

function processProof(root, name, cgroup, retainedPid) {
  const pid = retainedPid === undefined ? readFileSync(`${root}/run/${name}.pid`, 'utf8').trim() : String(retainedPid);
  if (!/^[1-9][0-9]*$/.test(pid)) refused();
  const argv = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
  if (!argv.includes(`--${name === 'containerd' ? 'root' : 'data-root'}=${root}/${name === 'containerd' ? 'containerd' : 'docker'}`)
    || !readFileSync(`/proc/${pid}/cgroup`, 'utf8').split('\n').some(line => line.startsWith(`0::${cgroup}/`))) refused();
  return Number(pid);
}

async function daemonPair(layout, env, run, prefetch) {
  const root = layout.volume, cgroup = `/system.slice/${layout.identity.unit}`;
  writeFileSync(`${root}/run/containerd.toml`, 'version = 3\n', { mode: 0o600 });
  writeFileSync(`${root}/run/docker.json`, '{}\n', { mode: 0o600 });
  const start = (binary, args) => {
    const child = spawn(binary, args, { env, stdio: 'ignore' });
    child.on('error', () => {});
    if (!child.pid) refused();
    return child;
  };
  const argumentsByName = {
    containerd: [`--config=${root}/run/containerd.toml`, `--root=${root}/containerd`,
      `--state=${root}/run/containerd-state`, `--address=${root}/run/containerd.sock`],
    dockerd: [`--config-file=${root}/run/docker.json`, `--host=unix://${root}/docker.sock`,
    `--data-root=${root}/docker`, `--exec-root=${root}/run/docker`, `--pidfile=${root}/run/dockerd.pid`,
    `--containerd=${root}/run/containerd.sock`, `--cgroup-parent=${cgroup}`, '--exec-opt=native.cgroupdriver=cgroupfs',
    '--default-ulimit=core=0:0',
    '--default-network-opt=bridge=com.docker.network.bridge.host_binding_ipv4=127.0.0.1',
    ...(prefetch ? ['--bridge=none', '--iptables=false', '--ip-masq=false'] : [])],
  };
  return ci1AcquireDaemons({
    start: name => start(name, argumentsByName[name]),
    prepareContainerd: child => {
      // Retain the child before writing a PID file: even a write failure must
      // enter ownership-checked cleanup. dockerd creates its own --pidfile.
      writeFileSync(`${root}/run/containerd.pid`, String(child.pid), { mode: 0o600 });
    },
    ready: () => ready(() => { processProof(root, 'containerd', cgroup); return existsSync(`${root}/run/containerd.sock`); },
      () => supervisor(layout, env)),
    stop: pair => stopDaemons(layout, pair),
  });
}

export async function ci1AcquireDaemons(adapter) {
  const pair = {};
  try {
    pair.containerd = adapter.start('containerd');
    await adapter.prepareContainerd(pair.containerd);
    await adapter.ready();
    pair.dockerd = adapter.start('dockerd');
    return pair;
  } catch {
    try { await adapter.stop(pair); } catch { /* Caller remains ERROR; unit KillMode is the final boundary. */ }
    refused();
  }
}

export async function ci1CloseDaemons(pair, stop) {
  let failed = false;
  for (const name of ['dockerd', 'containerd']) {
    if (!pair?.[name]) continue;
    try { await stop(name, pair[name]); } catch { failed = true; }
  }
  if (failed) refused();
  return true;
}

export async function ci1TerminateDaemon(adapter) {
  if (adapter.exited()) return true;
  adapter.prove(); adapter.signal('SIGTERM');
  if (await adapter.wait(10000)) return true;
  // A stale PID file or a quota failure must never authorize killing a process.
  // Re-read live ownership immediately before escalation.
  adapter.prove(); adapter.signal('SIGKILL');
  if (!await adapter.wait(5000)) refused();
  return true;
}

async function ready(check, guard, seconds = 60) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) { guard(); try { if (check()) return; } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  } refused();
}

async function stopDaemons(layout, pair) {
  const cgroup = `/system.slice/${layout.identity.unit}`;
  return ci1CloseDaemons(pair, async (name, child) => {
    const exited = () => child.exitCode !== null || child.signalCode !== null;
    await ci1TerminateDaemon({ exited,
      // Retained handles survive PID-file write failures; live argv + cgroup
      // must still match before each signal.
      prove: () => { if (processProof(layout.volume, name, cgroup, child.pid) !== child.pid) refused(); },
      signal: signal => child.kill(signal),
      wait: milliseconds => {
        if (exited()) return Promise.resolve(true);
        return new Promise(done => {
          const onExit = () => { clearTimeout(timer); done(true); };
          const timer = setTimeout(() => { child.removeListener('exit', onExit); done(false); }, milliseconds);
          child.once('exit', onExit);
        });
      },
    });
  });
}

export function ci1EdgeCacheProof(cacheRoot, expected, read = { list: readdirSync, stat: lstatSync, read: readFileSync }) {
  // Fresh owned volume + pinned Edge runtime verifies fetched tar SRI. Existing
  // cache bytes are never accepted from a host cache or a previous job.
  const allowed = new Map(ci1EdgeIntake(expected).map(item => [`${item.name}@${item.version}`, item]));
  const allowedNames = new Set([...allowed.values()].map(item => item.name));
  let packageOrdinal = 0, versionFacts = {};
  const cacheRefuse = code => { throw Object.assign(new Error('CI1_WORKER_REFUSED'), {
    ci1FailureCode: code, ci1Facts: { edgePackageOrdinal: packageOrdinal, ...versionFacts },
  }); };
  const observed = [], metadataOnly = [], files = []; let bytes = 0, rootFiles = 0;
  const metadata = (folder, name, version, pin) => {
    const path = `${folder}/registry.json`, info = read.stat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 32 * 1024 ** 2) cacheRefuse('EDGE_CACHE_METADATA');
    const raw = read.read(path), packument = JSON.parse(raw), item = packument.versions?.[version];
    if (packument.name !== name) cacheRefuse('EDGE_CACHE_NAME');
    if (item?.version !== version) cacheRefuse('EDGE_CACHE_VERSION');
    if (item.dist?.integrity !== pin.integrity) cacheRefuse('EDGE_CACHE_SRI');
    if (item.dist?.tarball !== pin.tarball) cacheRefuse('EDGE_CACHE_TARBALL');
    if (JSON.stringify(Object.entries(item.dependencies ?? {}).sort()) !== JSON.stringify(Object.entries(pin.dependencies).sort())) cacheRefuse('EDGE_CACHE_DEPENDENCIES');
    return raw;
  };
  const registry = `${cacheRoot}/npm/registry.npmjs.org`;
  const packages = [];
  for (const name of read.list(registry)) {
    if (typeof name !== 'string' || /[\r\n\0/\\]/.test(name) || !/^@?[a-z0-9._-]+$/.test(name)) cacheRefuse('EDGE_CACHE_ENTRY');
    const info = read.stat(`${registry}/${name}`);
    if (!info.isDirectory() || info.isSymbolicLink()) cacheRefuse('EDGE_CACHE_TYPE');
    if (name.startsWith('@')) { for (const child of read.list(`${registry}/${name}`)) {
      if (typeof child !== 'string' || /[\r\n\0/\\]/.test(child) || !/^[a-z0-9._-]+$/.test(child)) cacheRefuse('EDGE_CACHE_ENTRY');
      packages.push(`${name}/${child}`);
    } }
    else packages.push(name);
  }
  for (const name of packages) {
    packageOrdinal = expected.packages.findIndex(item => item.name === name) + 1;
    versionFacts = {};
    const folder = `${registry}/${name}`;
    const folderInfo = read.stat(folder);
    if (!allowedNames.has(name)) cacheRefuse('EDGE_CACHE_PACKAGE');
    if (!folderInfo.isDirectory() || folderInfo.isSymbolicLink()) cacheRefuse('EDGE_CACHE_TYPE');
    const entries = read.list(folder);
    versionFacts = { edgeCacheEntryCount: entries.length, edgeRegistryMetadataPresent: entries.includes('registry.json') ? 1 : 0 };
    if (entries.length === 1 && entries[0] === 'registry.json') {
      const candidates = [...allowed.values()].filter(pin => pin.name === name);
      if (candidates.length !== 1 || !expected.metadataOnlyAllowed?.includes(`${name}@${candidates[0].version}`)) cacheRefuse('EDGE_CACHE_METADATA');
      const pin = candidates[0], raw = metadata(folder, name, pin.version, pin), size = Buffer.byteLength(raw);
      bytes += size;
      if (bytes > CI1_SETUP.edgeBytes || files.length >= 100000) cacheRefuse('EDGE_CACHE_BOUND');
      files.push({ path: `${name}/registry.json`, sha256: ci1BytesHash(raw), bytes: size });
      metadataOnly.push(`${name}@${pin.version}`);
      continue; // Accounted optional metadata is never an installed package.
    }
    if (!entries.includes('registry.json') || entries.length < 2) cacheRefuse('EDGE_CACHE_METADATA');
    for (const version of entries) {
      if (version === 'registry.json') continue;
      versionFacts = {};
      if (typeof version === 'string') {
        const numeric = /^(\d+)\.(\d+)\.(\d+)(?:_(\d+))?$/.exec(version);
        if (numeric && numeric.slice(1).filter(Boolean).every(n => Number.isSafeInteger(Number(n)) && Number(n) <= 1000000))
          versionFacts = {edgeVersionMajor:Number(numeric[1]),edgeVersionMinor:Number(numeric[2]),edgeVersionPatch:Number(numeric[3]),edgeVersionCopy:Number(numeric[4]??0)};
      }
      // Deno peer copies use e.g. 2.45.0_1. Until a specific copy is reviewed,
      // refuse it (and every other unknown entry), rather than skip its bytes.
      if (typeof version !== 'string' || /[\r\n\0/\\]/.test(version) || !/^\d+\.\d+\.\d+$/.test(version)) cacheRefuse('EDGE_CACHE_VERSION');
      const pin = allowed.get(`${name}@${version}`); if (!pin) cacheRefuse('EDGE_CACHE_PIN');
      metadata(folder, name, version, pin);
      const packageRoot = `${folder}/${version}`;
      const packageInfo = read.stat(packageRoot);
      if (!packageInfo.isDirectory() || packageInfo.isSymbolicLink()) cacheRefuse('EDGE_CACHE_TYPE');
      const visit = (directory, prefix = '') => {
        for (const entry of read.list(directory).sort()) {
          if (typeof entry !== 'string' || !entry || ['.', '..', '.deno_sync_lock'].includes(entry) || /[\r\n\0/\\]/.test(entry)) cacheRefuse('EDGE_CACHE_ENTRY');
          const path = `${directory}/${entry}`, info = read.stat(path);
          if (info.isSymbolicLink()) cacheRefuse('EDGE_CACHE_TYPE');
          if (info.isDirectory()) visit(path, prefix + entry + '/');
          else if (info.isFile()) { bytes += info.size;
            if (bytes > CI1_SETUP.edgeBytes || files.length >= 100000) cacheRefuse('EDGE_CACHE_BOUND');
            if (`${name}@${version}` === expected.root) rootFiles++;
            files.push({ path: `${name}/${version}/${prefix}${entry}`, sha256: ci1BytesHash(read.read(path)), bytes: info.size });
          } else cacheRefuse('EDGE_CACHE_TYPE');
        }
      }; visit(packageRoot);
      observed.push(`${name}@${version}`);
    }
  }
  if (!observed.includes(expected.root) || rootFiles < 1) cacheRefuse('EDGE_CACHE_INCOMPLETE');
  return { observed: observed.sort(), metadataOnly: metadataOnly.sort(), files, bytes,
    sha256: ci1BytesHash(JSON.stringify(files.sort((a, b) => a.path.localeCompare(b.path)))) };
}

export function ci1PublicExport(evidence) {
  const keys = ['repository', 'runId', 'attempt', 'workflowSHA', 'sourceSHA', 'sourceFingerprint', 'lockSHA', 'versions',
    'startedAt', 'finishedAt', 'checks'];
  if (!evidence || !Array.isArray(evidence.suites)) refused();
  const input = Object.fromEntries(keys.map(key => [key, evidence[key]]));
  input.suites = evidence.suites.map(item => ({ id: item.id, status: item.status, exitCode: item.exitCode, counts: item.counts }));
  const rendered = renderCi1Evidence(input);
  // Reject raw/extra fields or tampered derived status, instead of merely
  // stripping them. Markdown is regenerated, never copied from a raw file.
  if (JSON.stringify(JSON.parse(rendered.json)) !== JSON.stringify(evidence)) refused();
  return rendered;
}

function exportProof(layout, env) {
  const root = layout.volume, file = `${root}/private/public-evidence.json`;
  if (!existsSync(file)) return false; // No invented counts when setup/kernel failed early.
  const evidence = parse(file), output = ci1PublicExport(evidence);
  if (evidence.runId !== layout.identity.runId || evidence.attempt !== layout.identity.attempt || evidence.sourceSHA !== env.GITHUB_SHA
    || evidence.workflowSHA !== env.GITHUB_WORKFLOW_SHA || Buffer.byteLength(output.json) + Buffer.byteLength(output.markdown) > CI1_SETUP.exportBytes) refused();
  mkdirSync(`${layout.task}/export`, { mode: 0o700, recursive: true });
  for (const [name, text] of [['public-evidence.json', output.json], ['public-summary.md', output.markdown]]) {
    const target = `${layout.task}/export/${name}`;
    if (lstatSync(target, { throwIfNoEntry: false })) {
      if (lstatSync(target).isSymbolicLink() || readFileSync(target, 'utf8') !== text) refused();
    } else writeFileSync(target, text, { flag: 'wx', mode: 0o600 });
  }
  return true;
}

export function ci1EdgeBundleArguments(layout, image, network, index, name, number) {
  const root = layout.volume, functions = `${root}/runtime/stack/supabase/functions`;
  if (!['host', 'none'].includes(network) || !['warm', 'offline1', 'offline2'].includes(index)
    || !['menu-image-public', 'menu-image-gateway'].includes(name) || ![0, 1].includes(number)) refused();
  return ['run', '--rm', '--ulimit', 'core=0:0', '--name', `ci1-${layout.identity.runId}-${layout.identity.attempt}-${index}-${number}`,
      '--network', network, '--cgroup-parent', `/system.slice/${layout.identity.unit}`,
      '--mount', `type=volume,source=${layout.edgeVolume},target=/root/.cache/deno,volume-nocopy`,
      '--mount', `type=bind,source=${functions},target=${functions},readonly`,
      '--mount', `type=bind,source=${root}/private,target=/output`,
      '--env', 'DENO_DIR=/root/.cache/deno', '--env', 'DENO_NO_PACKAGE_JSON=1', image,
      'bundle', '--entrypoint', `${functions}/${name}/index.ts`, '--output', `/output/${index}-${name}.eszip`];
}
function edgeBundle(layout, run, image, network, index) {
  for (const [number, name] of ['menu-image-public', 'menu-image-gateway'].entries())
    run('docker', ci1EdgeBundleArguments(layout, image, network, index, name, number));
}
function ownedDaemonReady(layout, pair, run) {
  const root = layout.volume, cgroup = `/system.slice/${layout.identity.unit}`;
  if (processProof(root, 'containerd', cgroup) !== pair.containerd.pid || processProof(root, 'dockerd', cgroup) !== pair.dockerd.pid) refused();
  const info = JSON.parse(run('docker', ['info', '--format', '{{json .}}']));
  return info.DockerRootDir === `${root}/docker` && info.CgroupDriver === 'cgroupfs' && typeof info.ID === 'string' && info.ID.length > 0;
}

async function offlinePhase(layout, source, env) {
  const root = layout.volume, guard = () => supervisor(layout, env), run = commandRunner(env, guard);
  let pair, operation = 'OFFLINE_SUPERVISOR', failure = null, cleanupFailure = null;
  try {
    guard(); operation = 'OFFLINE_LOOP'; loopControl(layout);
    operation = 'OFFLINE_NAMESPACES';
    const origin = parse(`${layout.task}/host-namespaces.json`);
    if (['mnt', 'net', 'pid'].some(name => readlinkSync(`/proc/self/ns/${name}`) === origin[name])) refused();
    operation = 'OFFLINE_MOUNT_PRIVATE'; run('mount', ['--make-rprivate', '/']);
    operation = 'OFFLINE_RUNTIME_BIND';
    if (lstatSync(CI1_RUNTIME, { throwIfNoEntry: false })) refused();
    mkdirSync(CI1_RUNTIME, { mode: 0o700 }); run('mount', ['--bind', `${root}/runtime`, CI1_RUNTIME]);
    operation = 'OFFLINE_NETWORK'; run('ip', ['link', 'set', 'lo', 'up']);
    if (run('ip', ['route', 'show', 'default']).trim()) refused();
    operation = 'OFFLINE_IMAGE';
    const image = ci1ImagesIntake(parse(`${source}/tests/permissions/runtime/ci1-images.json`)).find(item => item.ref.includes('/edge-runtime:'))?.ref;
    if (!image) refused();
    const expected = parse(`${source}/tests/permissions/runtime/ci1-edge.json`);
    operation = 'OFFLINE_DAEMONS';
    pair = await daemonPair(layout, env, run, false);
    operation = 'OFFLINE_READY';
    await ready(() => ownedDaemonReady(layout, pair, run), guard);
    operation = 'OFFLINE_CACHE_BEFORE';
    const cacheRoot = JSON.parse(run('docker', ['volume', 'inspect', layout.edgeVolume]))[0].Mountpoint;
    if (statSync(cacheRoot).dev !== statSync(root).dev) refused();
    const before = ci1EdgeCacheProof(cacheRoot, expected);
    operation = 'OFFLINE_BUNDLE1'; edgeBundle(layout, run, image, 'none', 'offline1');
    operation = 'OFFLINE_BUNDLE2'; edgeBundle(layout, run, image, 'none', 'offline2');
    operation = 'OFFLINE_CACHE_AFTER';
    if (ci1EdgeCacheProof(cacheRoot, expected).sha256 !== before.sha256) refused();
    operation = 'OFFLINE_PROOF_WRITE';
    writeFileSync(`${root}/private/edge-cache-proof.json`, JSON.stringify(before), { flag: 'wx', mode: 0o600 });
    operation = 'STACK_START';
    run(`${CI1_RUNTIME}/bin/supabase`, ['start', '--workdir', `${CI1_RUNTIME}/stack`]);
    operation = 'STACK_ENVELOPE';
    assertCi1Envelope(readCi1LinuxEnvelope(root, layout.identity, env), layout.identity);
    operation = 'STACK_STATUS';
    const status = JSON.parse(run(`${CI1_RUNTIME}/bin/supabase`, ['status', '--workdir', `${CI1_RUNTIME}/stack`, '-o', 'json']));
    if (status.API_URL !== 'http://127.0.0.1:62421') refused();
    for (const [name, path, code, message] of [
      ['menu-image-public', '/not-a-uuid', 404, 'NOT_FOUND'], ['menu-image-gateway', '', 401, 'EMPLOYEE_SESSION_REQUIRED']]) {
      operation = name === 'menu-image-public' ? 'EDGE_HEALTH_PUBLIC' : 'EDGE_HEALTH_GATEWAY';
      const response = await fetch(`${status.API_URL}/functions/v1/${name}${path}`, {
        headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${status.ANON_KEY}` }, signal: AbortSignal.timeout(30000) });
      if (response.status !== code || (await response.json())?.error?.code !== message) refused();
    }
    operation = 'OFFLINE_CACHE_FINAL';
    if (ci1EdgeCacheProof(cacheRoot, expected).sha256 !== before.sha256) refused();
    operation = 'PILOT_HARNESS';
    try { run(`${root}/runtime/node/bin/node`, [`${source}/scripts/permission-ci1-harness.mjs`, 'run', root],
      { cwd: source, timeout: 900000 }); }
    catch (error) { error.ci1Facts = {...error.ci1Facts, ...ci1HarnessFailureFacts(error.stderr)}; throw error; }
  } catch (error) { failure = failureDetails(error, 'offline-edge', operation); }
  finally {
    if (pair) {
      try { const ids = JSON.parse(run('docker', ['inspect', ...names.map(name => `supabase_${name}_${CI1_PROJECT}`)]))
        .map(item => { if (item.Config?.Labels?.['com.supabase.cli.project'] !== CI1_PROJECT) refused(); return item.Id; });
        run('docker', ['stop', '--time', '10', ...ids]); } catch { /* Unit KillMode stops all remaining descendants. */ }
      try { await stopDaemons(layout, pair); }
      catch (error) { cleanupFailure = failureDetails(error, 'cleanup', 'ISOLATED_STOP_DAEMONS'); }
    }
  }
  if (failure || cleanupFailure) {
    const record = { schemaVersion: 'permission-ci1-isolated-failure-v1', runId: layout.identity.runId,
      attempt: layout.identity.attempt, sourceSHA: env.GITHUB_SHA, failure, cleanupFailure };
    ci1IsolatedFailure(record, layout.identity, env.GITHUB_SHA);
    writeFileSync(`${root}/private/isolated-failure.json`, JSON.stringify(record), { flag: 'wx', mode: 0o600 });
    refused();
  }
}

async function setup(layout, input, parentEnv) {
  const root = layout.volume, baseEnv = { ...fixedEnv(root, parentEnv), ...githubEnv(parentEnv) };
  const guard = () => supervisor(layout, baseEnv);
  const run = commandRunner(baseEnv, guard);
  let loop, mounted = false, pair, source, operation = null, imageOrdinal = 0, imagePullAttempt = 0, cleanupFailure = null, cleanupMountFacts = {};
  const pinPath = suffix => `${source}/tests/permissions/runtime/${suffix}`;
  const adapter = {
    supervisor: guard,
    operation: () => operation,
    failureFacts: () => ({ imageOrdinal, ...(imagePullAttempt ? { imagePullAttempt, imageRegistryOrdinal: imagePullAttempt === 4 ? 2 : 1 } : {}) }),
    cleanupFailure: () => cleanupFailure,
    stage: async stage => {
      operation = null;
      if (stage === 'loop') {
        const free = statfsSync(layout.task);
        if (free.bavail * free.bsize < CI1_LIMITS.hostReserveBytes + CI1_LIMITS.taskBytes) refused();
        if (lstatSync(layout.image, { throwIfNoEntry: false }) || lstatSync(root, { throwIfNoEntry: false })) refused();
        closeSync(openSync(layout.image, 'wx', 0o600));
        run('fallocate', ['-l', String(CI1_LIMITS.filesystemBytes), layout.image]);
        loop = run('losetup', ['--find', '--show', '--nooverlap', '--sizelimit', String(CI1_LIMITS.filesystemBytes), layout.image]).trim();
        if (!/^\/dev\/loop[0-9]+$/.test(loop)) refused();
        const proof = JSON.parse(run('losetup', ['--json', '--list', '--output', 'NAME,BACK-FILE,OFFSET,SIZELIMIT', loop])).loopdevices[0];
        if (realpathSync(proof['back-file']) !== layout.image || Number(proof.offset) !== 0 || Number(proof.sizelimit) !== CI1_LIMITS.filesystemBytes) refused();
        const image = statSync(layout.image);
        if (image.size !== CI1_LIMITS.filesystemBytes || image.blocks * 512 < CI1_LIMITS.filesystemBytes) refused();
        operation = 'FORMAT_VOLUME';
        run('mkfs.ext4', ['-E', 'nodiscard,lazy_itable_init=0,lazy_journal_init=0', loop]);
        // Formatting/zeroing may punch holes in a loop backing file. Complete
        // inode/journal initialization first, then restore the full reservation
        // before mount. The continuous allocation proof remains unchanged.
        operation = 'RESERVE_VOLUME';
        const formatted = statSync(layout.image), missing = Math.max(0, CI1_LIMITS.filesystemBytes - formatted.blocks * 512);
        const host = statfsSync(layout.task);
        if (host.bavail * host.bsize < CI1_LIMITS.hostReserveBytes + missing) refused();
        run('fallocate', ['-l', String(CI1_LIMITS.filesystemBytes), layout.image]);
        mkdirSync(root, { mode: 0o700 });
        run('mount', ['-o', 'nodiscard', loop, root]); mounted = true;
        if (statSync(layout.image).blocks * 512 < CI1_LIMITS.filesystemBytes) refused();
        for (const name of ['private', 'docker', 'containerd', 'run', 'tmp', 'home/.cache', 'npm-cache', 'runtime/bin', 'downloads']) mkdirSync(`${root}/${name}`, { recursive: true, mode: 0o700 });
        for (const file of ['npm-user.conf', 'npm-global.conf']) writeFileSync(`${root}/run/${file}`, '', { mode: 0o600 });
      } else if (stage === 'source-tools') {
        operation = 'SOURCE_INTAKE';
        if (boundedTree(input, CI1_SETUP.sourceBytes).bytes > CI1_SETUP.sourceBytes || run('git', ['-c', `safe.directory=${input}`, '-C', input, 'rev-parse', 'HEAD']).trim() !== baseEnv.GITHUB_SHA
          || run('git', ['-c', `safe.directory=${input}`, '-C', input, 'status', '--porcelain', '--untracked-files=all']).trim()) refused();
        source = `${root}/source`;
        operation = 'SOURCE_CLONE';
        run('git', ['-c', `safe.directory=${input}`, '-c', 'core.hooksPath=/dev/null', 'clone', '--no-hardlinks', '--depth=1', '--no-local', '--', 'file://' + input, source]);
        operation = 'SOURCE_REF';
        if (run('git', ['-C', source, 'rev-parse', 'HEAD']).trim() !== baseEnv.GITHUB_SHA) refused();
        // No checkout credentials are accepted in the clone; actual published Git
        // commit is sourceSHA, never fabricated as the POS working-tree baseline.
        operation = 'SOURCE_CONFIG';
        const config = readFileSync(`${source}/.git/config`, 'utf8');
        if (/extraheader|credential|https?:\/\/[^\s/]+@/i.test(config)) refused();
        operation = 'TOOL_MANIFEST';
        for (const tool of ci1ToolsIntake(parse(pinPath('ci1-tools.json')))) {
          const archive = `${root}/downloads/${tool.id}.tar.gz`;
          operation = `DOWNLOAD_${tool.id.toUpperCase()}`;
          await download({ ...tool, maxBytes: CI1_SETUP.toolBytes }, archive, 'sha256', guard);
          operation = `INSPECT_${tool.id.toUpperCase()}`;
          ci1CheckTarListing(run('tar', ['-tvf', archive, '--numeric-owner', '--utc']), tool.id);
          operation = `EXTRACT_${tool.id.toUpperCase()}`;
          run('tar', ['-xf', archive, '--no-same-owner', '--no-same-permissions', '-C', `${root}/runtime`]);
          unlinkSync(archive); // Only this freshly created, checksum-verified transfer file.
        }
        operation = 'PLACE_TOOLS';
        run('mv', [`${root}/runtime/node-v24.16.0-linux-x64`, `${root}/runtime/node`]);
        for (const name of ['supabase', 'supabase-go']) {
          run('mv', [`${root}/runtime/${name}`, `${root}/runtime/bin/${name}`]);
          chmodSync(`${root}/runtime/bin/${name}`, 0o700);
        }
        operation = 'TOOL_VERSIONS';
        if (run(`${root}/runtime/node/bin/node`, ['--version']).trim() !== 'v24.16.0'
          || run(`${root}/runtime/node/bin/npm`, ['--version']).trim() !== '11.13.0'
          || run(`${root}/runtime/bin/supabase`, ['--version']).trim() !== '2.117.0') refused();
        operation = 'STACK_TEMPLATE';
        mkdirSync(`${root}/runtime/stack/supabase/migrations`, { recursive: true, mode: 0o700 });
        writeFileSync(`${root}/runtime/stack/supabase/config.toml`, readFileSync(`${source}/tests/permissions/runtime/identity.toml`), { mode: 0o600 });
        writeFileSync(`${root}/runtime/stack/supabase/seed.sql`, '', { mode: 0o600 });
        run('cp', ['-R', '--no-preserve=ownership', `${source}/supabase/functions`, `${root}/runtime/stack/supabase/functions`]);
      } else if (stage === 'npm-images') {
        let total = 0;
        for (const [index, item] of ci1NpmIntake(parse(`${source}/package-lock.json`)).entries()) {
          const file = `${root}/downloads/npm-${index}.tgz`;
          operation = 'NPM_DOWNLOAD';
          total += await download({ ...item, maxBytes: Math.min(item.maxBytes, CI1_SETUP.npmBytes - total) }, file, 'sha512', guard);
          // npm cache add extracts a temporary package to read its manifest.
          // Inspect the expanded bound before permitting that extraction.
          operation = 'NPM_INSPECT';
          ci1CheckTarListing(run('tar', ['-tvf', file, '--numeric-owner', '--utc']), 'npm', item.url);
          operation = 'NPM_CACHE';
          run(`${root}/runtime/node/bin/npm`, ['cache', 'add', file, '--cache', `${root}/npm-cache`, '--loglevel=error']); unlinkSync(file);
        }
        operation = 'PREFETCH_DAEMONS';
        pair = await daemonPair(layout, baseEnv, run, true);
        operation = 'PREFETCH_READY';
        await ready(() => ownedDaemonReady(layout, pair, run), guard);
        for (const image of ci1ImagesIntake(parse(pinPath('ci1-images.json')))) {
          imageOrdinal++;
          const repository = image.ref.slice(0, image.ref.lastIndexOf(':'));
          operation = 'IMAGE_PULL';
          imagePullAttempt = 0;
          const pulledReference = await ci1PullImage(run, `${repository}@${image.manifestDigest}`, guard, undefined, attempt => { imagePullAttempt = attempt; });
          imagePullAttempt = 0;
          operation = 'IMAGE_TAG';
          run('docker', ['tag', pulledReference, image.ref]);
          operation = 'IMAGE_INSPECT';
          const actual = JSON.parse(run('docker', ['image', 'inspect', image.ref]))[0];
          if (actual.Id !== image.configDigest || actual.Os !== 'linux' || actual.Architecture !== 'amd64') refused();
        }
      } else if (stage === 'edge-network-warm') {
        operation = 'EDGE_VOLUME_CHECK';
        const image = ci1ImagesIntake(parse(pinPath('ci1-images.json'))).find(item => item.ref.includes('/edge-runtime:'))?.ref;
        if (!image || run('docker', ['volume', 'ls', '--filter', `name=^${layout.edgeVolume}$`, '--format', '{{.Name}}']).trim()) refused();
        operation = 'EDGE_VOLUME_CREATE';
        run('docker', ['volume', 'create', '--label', `com.supabase.cli.project=${CI1_PROJECT}`, layout.edgeVolume]);
        const cacheRoot = JSON.parse(run('docker', ['volume', 'inspect', layout.edgeVolume]))[0].Mountpoint;
        operation = 'EDGE_VOLUME_EMPTY';
        if (statSync(cacheRoot).dev !== statSync(root).dev || readdirSync(cacheRoot).length) refused();
        operation = 'EDGE_BUNDLE';
        edgeBundle(layout, run, image, 'host', 'warm');
        operation = 'EDGE_CACHE_PROOF';
        const proof = ci1EdgeCacheProof(cacheRoot, parse(pinPath('ci1-edge.json')));
        operation = 'EDGE_PROOF_WRITE';
        writeFileSync(`${root}/private/edge-warm-proof.json`, JSON.stringify(proof), { flag: 'wx', mode: 0o600 });
      } else if (stage === 'stop-prefetch') { await stopDaemons(layout, pair); pair = undefined;
      } else if (stage === 'private-namespaces') {
        writeFileSync(`${layout.task}/host-namespaces.json`, JSON.stringify(Object.fromEntries(['mnt', 'net', 'pid'].map(name => [name, readlinkSync(`/proc/self/ns/${name}`)]))), { flag: 'wx', mode: 0o600 });
      } else if (stage === 'offline-edge') {
        try {
          run('unshare', ['--mount', '--net', '--pid', '--fork', '--mount-proc', `${root}/runtime/node/bin/node`,
            `${source}/scripts/permission-ci1-worker.mjs`, 'isolated'], { cwd: source, timeout: 1200000 });
        } catch (error) {
          const file = `${root}/private/isolated-failure.json`, info = lstatSync(file, { throwIfNoEntry: false });
          if (info?.isFile() && !info.isSymbolicLink() && info.uid === 0 && !(info.mode & 0o077)
            && info.size <= 8192 && realpathSync(file) === file) {
            const inner = ci1IsolatedError(parse(file), layout.identity, baseEnv.GITHUB_SHA);
            operation = inner.operation; throw inner.error;
          }
          throw error;
        }
      } else if (stage === 'stack' || stage === 'harness') {
        // The child carries its namespace through stack→harness. It must publish
        // an exact completion receipt; a successful unshare alone is not proof.
        const done = parse(`${root}/private/isolated-completion.json`);
        if (done.runId !== layout.identity.runId || done.attempt !== layout.identity.attempt || done.sourceSHA !== baseEnv.GITHUB_SHA || done.complete !== true) refused();
      } else if (stage === 'export') {
        if (!exportProof(layout, baseEnv) || parse(`${layout.task}/export/public-evidence.json`).overallStatus !== 'PASS') refused();
      } else refused();
      return true;
    },
    close: async () => {
      // A quota refusal must not itself prevent ownership-checked shutdown.
      const control = commandRunner(baseEnv);
      let valid = true;
      const failed = (error, op) => { valid = false; cleanupFailure ??= failureDetails(error, 'cleanup', op, op === 'CLEANUP_UNMOUNT' ? cleanupMountFacts : {}); };
      try { if (mounted) exportProof(layout, baseEnv); } catch (error) { failed(error, 'CLEANUP_EXPORT'); }
      try { await stopDaemons(layout, pair); } catch (error) { failed(error, 'CLEANUP_DAEMONS'); }
      try {
        if (mounted) {
          const mount = JSON.parse(control('findmnt', ['--json', '--submounts', '--target', root, '--output', 'TARGET,SOURCE'])).filesystems[0];
          cleanupMountFacts = { loopNestedMounts: ci1OwnedMountCount(mount, root, loop) };
          const attached = JSON.parse(control('losetup', ['--json', '--list', '--output', 'BACK-FILE', loop])).loopdevices[0];
          if (realpathSync(attached['back-file']) !== layout.image) refused();
          // All current targets must belong to this exact owned loop tree.
          // Regular recursive unmount still refuses busy mounts; never lazy/force.
          control('umount', ['--recursive', root]); mounted = false;
        }
      } catch (error) { failed(error, 'CLEANUP_UNMOUNT'); }
      try {
        if (loop && !mounted) { const attached = JSON.parse(control('losetup', ['--json', '--list', '--output', 'BACK-FILE', loop])).loopdevices[0];
          if (realpathSync(attached['back-file']) !== layout.image) refused(); control('losetup', ['--detach', loop]); }
      } catch (error) { failed(error, 'CLEANUP_DETACH'); }
      return valid;
    },
  };
  return runCi1Worker(adapter, layout.identity);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] === 'plan' && process.argv.length === 5) {
      console.log(JSON.stringify(ci1WorkerPlan(process.argv[3], Number(process.argv[4])), null, 2));
    } else {
      runnerGuard(process.env);
      const layout = ci1WorkerLayout(process.env.GITHUB_RUN_ID, Number(process.env.GITHUB_RUN_ATTEMPT));
      if (process.argv[2] === 'launch' && process.argv.length === 4) {
        const input = realpathSync(process.argv[3]);
        if (lstatSync(layout.task, { throwIfNoEntry: false })) refused();
        mkdirSync(layout.task, { mode: 0o700 });
        writeFileSync(`${layout.task}/run-control.json`, JSON.stringify({ runId: layout.identity.runId, attempt: layout.identity.attempt,
          unit: layout.identity.unit, sourceSHA: process.env.GITHUB_SHA, workerSHA: ci1BytesHash(readFileSync(new URL(import.meta.url))) }), { flag: 'wx', mode: 0o400 });
        const env = githubEnv(process.env), run = commandRunner({ PATH: process.env.PATH, ...env });
        const worker = realpathSync(process.argv[1]);
        const prefix = ci1LinuxRecipe(layout.identity.runId, layout.identity.attempt).systemdArgv;
        run(prefix[0], [...prefix.slice(1), ...Object.entries(env).map(([key, value]) => `--setenv=${key}=${value}`),
          process.execPath, worker, 'setup', input], { timeout: 1840000 });
      } else if (process.argv[2] === 'setup' && process.argv.length === 4) {
        const result = await setup(layout, realpathSync(process.argv[3]), process.env);
        writeFileSync(`${layout.task}/worker-status.json`, JSON.stringify(result), { flag: 'wx', mode: 0o600 });
        if (result.status !== 'COMPLETE') process.exitCode = 78;
      } else if (process.argv[2] === 'isolated' && process.argv.length === 3) {
        const source = realpathSync(process.cwd()), env = { ...fixedEnv(layout.volume, process.env), ...githubEnv(process.env) };
        process.chdir(source); await offlinePhase(layout, source, env);
        writeFileSync(`${layout.volume}/private/isolated-completion.json`, JSON.stringify({ runId: layout.identity.runId,
          attempt: layout.identity.attempt, sourceSHA: env.GITHUB_SHA, complete: true }), { flag: 'wx', mode: 0o600 });
      } else refused();
    }
  } catch { console.error('CI1_WORKER_BLOCKED'); process.exitCode = 78; }
}
