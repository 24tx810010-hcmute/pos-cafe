import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { CI1_LIMITS, CI1_PROJECT, ci1Identity, ci1TrustedRepository } from './permission-ci1-policy.mjs';

export const CI1_SETUP = Object.freeze({ sourceBytes: 64 * 1024 ** 2, npmBytes: 512 * 1024 ** 2,
  npmTarBytes: 32 * 1024 ** 2, toolBytes: 128 * 1024 ** 2, unpackBytes: 256 * 1024 ** 2,
  edgeBytes: 512 * 1024 ** 2, exportBytes: 1024 ** 2, cacheConcurrency: 2, commandTimeoutMs: 300000 });
export const ci1BytesHash = bytes => createHash('sha256').update(bytes).digest('hex');
const refuse = () => { throw new Error('CI1_INTAKE_REFUSED'); };
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) && value.length === 64;
const sri = value => typeof value === 'string' && value.length === 95 && /^sha512-[A-Za-z0-9+/]{86}==$/.test(value);
export function ci1RegistryTarball(value) {
  let url; try { url = new URL(value); } catch { refuse(); }
  if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org' || url.username || url.password
    || url.port || url.search || url.hash || !url.pathname.endsWith('.tgz') || /[\r\n\0]/.test(value)) refuse();
  return url.href;
}

export function ci1NpmIntake(lock) {
  if (lock?.lockfileVersion !== 3 || !lock.packages?.[''] || Object.keys(lock.packages).length > 2000) refuse();
  const packages = new Map();
  for (const [path, item] of Object.entries(lock.packages)) {
    if (!path) continue;
    if (!path.startsWith('node_modules/') || path.includes('..') || item.link || !sri(item.integrity)
      || typeof item.version !== 'string' || /[\r\n\0]/.test(item.version) || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(item.version)) refuse();
    const url = ci1RegistryTarball(item.resolved);
    if (packages.has(url) && packages.get(url).integrity !== item.integrity) refuse();
    packages.set(url, { url, integrity: item.integrity, maxBytes: CI1_SETUP.npmTarBytes });
  }
  if (!packages.size) refuse();
  // Cache all exact-lock tarballs, including optional platforms. This makes the
  // Linux offline install independent of the Windows installation's eligibility.
  return [...packages.values()].sort((a, b) => a.url.localeCompare(b.url));
}

export function ci1ToolsIntake(manifest) {
  if (manifest?.schemaVersion !== 'permission-ci1-tools-v1' || manifest.platform !== 'linux/x64'
    || manifest.nodeVersion !== '24.16.0' || manifest.npmVersion !== '11.13.0' || manifest.cliVersion !== '2.117.0'
    || !Array.isArray(manifest.tools) || manifest.tools.length !== 2) refuse();
  const expected = {
    node: 'https://nodejs.org/dist/v24.16.0/node-v24.16.0-linux-x64.tar.gz',
    supabase: 'https://github.com/supabase/cli/releases/download/v2.117.0/supabase_2.117.0_linux_amd64.tar.gz',
  };
  const names = new Set();
  for (const item of manifest.tools) {
    if (!exactKeys(item, ['id', 'url', 'sha256', 'bytes']) || names.has(item.id)
      || item.url !== expected[item.id] || !sha256(item.sha256) || !Number.isSafeInteger(item.bytes)
      || item.bytes < 1 || item.bytes > CI1_SETUP.toolBytes) refuse();
    names.add(item.id);
  }
  if (names.size !== 2) refuse();
  return manifest.tools;
}

export function ci1CheckTarListing(text, id, npmTarball = null) {
  if (!['node', 'supabase', 'npm'].includes(id) || typeof text !== 'string' || text.length > 1024 ** 2) refuse();
  const lines = text.trim().split('\n');
  let size = 0, npmRoot = null; const binaries = new Set(), npmRoots = new Set(['package']);
  if (id === 'npm' && npmTarball !== null) {
    const path = new URL(ci1RegistryTarball(npmTarball)).pathname;
    // DefinitelyTyped publishes a named root, sometimes with its major/minor
    // suffix. Bind that exception to the exact @types registry tarball URL;
    // every archive still has one root and the same traversal/type/size checks.
    const types = path.match(/^\/@types\/([a-z0-9][a-z0-9.-]*)\/-\/\1-(\d+)\.(\d+)\.\d+(?:-[A-Za-z0-9.-]+)?\.tgz$/);
    if (types) { npmRoots.add(types[1]); npmRoots.add(`${types[1]} v${types[2]}.${types[3]}`); }
  }
  for (const line of lines) {
    // GNU tar -tvf; reject unusual records, devices, hardlinks and escaping names.
    const match = line.match(/^([-dl])[rwxstST-]{9}\s+\S+\s+(\d+)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+)$/);
    if (!match) refuse();
    const [name, target] = match[3].split(' -> ');
    const parts = name.replace(/\/$/, '').split('/');
    if (name.startsWith('/') || parts.some(part => !part || part === '..' || /[\r\n\0]/.test(part))) refuse();
    if (id === 'node' && parts[0] !== 'node-v24.16.0-linux-x64') refuse();
    if (id === 'supabase') {
      if (parts.length !== 1 || !['supabase', 'supabase-go'].includes(parts[0]) || match[1] !== '-' || binaries.has(parts[0])) refuse();
      binaries.add(parts[0]);
    }
    if (id === 'npm') {
      if (!npmRoots.has(parts[0]) || (npmRoot !== null && npmRoot !== parts[0])) refuse();
      npmRoot = parts[0];
    }
    if (target !== undefined) {
      const destination = posix.normalize(posix.join(posix.dirname(name), target));
      if (id !== 'node' || match[1] !== 'l' || target.startsWith('/') || /[\r\n\0\\]/.test(target)
        || !destination.startsWith('node-v24.16.0-linux-x64/')) refuse();
    } else if (match[1] === 'l') refuse();
    size += Number(match[2]);
    if (!Number.isSafeInteger(size) || size > CI1_SETUP.unpackBytes) refuse();
  }
  if (id === 'supabase' && (binaries.size !== 2 || !binaries.has('supabase') || !binaries.has('supabase-go'))) refuse();
  return { entries: lines.length, unpackedBytes: size };
}

export function ci1EdgeIntake(manifest) {
  if (manifest?.schemaVersion !== 'permission-ci1-edge-v1' || manifest.root !== '@supabase/supabase-js@2.45.0'
    || !Array.isArray(manifest.packages) || !manifest.packages.length || manifest.packages.length > 100) refuse();
  const keys = new Set();
  for (const item of manifest.packages) {
    if (!exactKeys(item, ['name', 'version', 'integrity', 'tarball', 'dependencies'])
      || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(item.name) || /[\r\n\0]/.test(item.name + item.version) || !/^\d+\.\d+\.\d+$/.test(item.version)
      || !sri(item.integrity) || !item.dependencies || typeof item.dependencies !== 'object' || Array.isArray(item.dependencies)) refuse();
    ci1RegistryTarball(item.tarball);
    const key = `${item.name}@${item.version}`;
    if (keys.has(key)) refuse(); keys.add(key);
    if (Object.values(item.dependencies).some(value => typeof value !== 'string' || /[\r\n\0]/.test(value))) refuse();
  }
  if (!keys.has(manifest.root)) refuse();
  if (manifest.metadataOnlyAllowed !== undefined && (!Array.isArray(manifest.metadataOnlyAllowed)
    || new Set(manifest.metadataOnlyAllowed).size !== manifest.metadataOnlyAllowed.length
    || manifest.metadataOnlyAllowed.some(key => !['bufferutil@4.1.0', 'utf-8-validate@6.0.6', 'node-gyp-build@4.8.4'].includes(key) || !keys.has(key)))) refuse();
  return manifest.packages;
}

export function assertCi1Supervisor(proof, identity) {
  const expected = ci1Identity(identity.runId, identity.attempt);
  if (proof?.platform !== 'linux' || proof.arch !== 'x64' || proof.root !== true || proof.wsl !== false
    || proof.authorized !== true || proof.githubHosted !== true || proof.publicRepository !== true || proof.manual !== true
    || !ci1TrustedRepository(proof.repository) || proof.cpus !== 4
    || !Number.isSafeInteger(proof.memoryBytes) || proof.memoryBytes < 14 * 1024 ** 3 || proof.memoryBytes > 18 * 1024 ** 3
    || proof.cgroup !== `/system.slice/${expected.unit}/supervisor`
    || proof.cpuMax !== `${CI1_LIMITS.cpuQuota} ${CI1_LIMITS.cpuPeriod}` || proof.memoryMax !== String(CI1_LIMITS.memoryBytes)
    || proof.swapMax !== '0' || proof.pidsMax !== String(CI1_LIMITS.pids) || proof.runtime !== '30min'
    || proof.stop !== '30s' || proof.kill !== 'control-group' || proof.stdout !== 'null' || proof.stderr !== 'null'
    || proof.oom !== 0 || proof.pidsEvents !== 0 || !Number.isSafeInteger(proof.hostFreeBytes)
    || proof.hostFreeBytes < CI1_LIMITS.hostReserveBytes) refuse();
  return true;
}

export function ci1WorkerLayout(runId, attempt) {
  // systemd PrivateTmp hides host /tmp and /var/tmp. Keep the shared task and
  // final tiny export outside those mounts; only the compatibility alias uses it.
  const identity = ci1Identity(runId, attempt), task = `/var/lib/pos-cafe-ci1-r${runId}-a${attempt}`;
  return { identity, task, volume: `${task}/volume`, image: `${task}/data.img`,
    edgeVolume: `supabase_edge_runtime_${CI1_PROJECT}` };
}

const validImagePin = image => image && typeof image.ref === 'string'
  && /^public\.ecr\.aws\/supabase\/[a-z0-9-]+:[a-zA-Z0-9_.-]+$/.test(image.ref) && !/[\r\n\0]/.test(image.ref)
  && ['indexDigest', 'manifestDigest', 'configDigest'].every(key => typeof image[key] === 'string'
    && image[key].length === 71 && /^sha256:[a-f0-9]{64}$/.test(image[key]));

export function ci1PinnedImageProof(pin, container, image) {
  const fail = ordinal => { throw Object.assign(new Error('CI1_PINNED_IMAGE_REFUSED'), {ci1ImageProofOrdinal:ordinal}); };
  if (!validImagePin(pin) || container?.image !== pin.ref) fail(1);
  if (image?.Os !== 'linux' || image.Architecture !== 'amd64') fail(2);
  // Docker image/container IDs identify the config object, not the OCI index.
  if (image.Id !== pin.configDigest || container.imageId !== pin.configDigest) fail(3);
  const repository = pin.ref.slice(0, pin.ref.lastIndexOf(':'));
  const repositories = [repository, repository.replace(/^public\.ecr\.aws\//, 'ghcr.io/')];
  if (!Array.isArray(image.RepoDigests) || !image.RepoDigests.some(value =>
    repositories.some(repo => value === `${repo}@${pin.indexDigest}` || value === `${repo}@${pin.manifestDigest}`))) fail(4);
  return true;
}

export function ci1ImagesIntake(manifest) {
  if (manifest?.schemaVersion !== 'permission-ci1-images-v1' || manifest.platform !== 'linux/amd64'
    || !Array.isArray(manifest.images) || manifest.images.length !== 12) refuse();
  const names = new Set();
  for (const image of manifest.images) {
    if (!validImagePin(image) || names.has(image.ref)) refuse();
    names.add(image.ref);
  }
  return manifest.images;
}
