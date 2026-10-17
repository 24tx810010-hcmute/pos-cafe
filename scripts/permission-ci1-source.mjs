import { readFileSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { CI1_SETUP, ci1BytesHash } from './permission-ci1-intake.mjs';

const refused = () => { throw new Error('CI1_SOURCE_REFUSED'); };
export function ci1PublicationPath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || /[\r\n\0\\:]/.test(path)
    || path.split('/').some(part => !part || part === '..' || part === '.')) refused();
  if (/^(?:artifacts|test-results|node_modules|\.git|dist|coverage|playwright-report)\//.test(path)
    || path.endsWith('.tsbuildinfo')) return false;
  const name = path.split('/').at(-1).toLowerCase();
  if ((name.startsWith('.env') && name !== '.env.example') || ['.npmrc', '.netrc', 'id_rsa', 'id_ed25519'].includes(name)
    || /\.(?:pem|p12|pfx|key|tar|tgz|zip|vhdx|dump|bak)$/.test(name)) refused();
  return true;
}

export function ci1PublicationInventory(root) {
  root = realpathSync(resolve(root));
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 8 * 1024 ** 2,
    timeout: 30000, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
  const head = git(['rev-parse', 'HEAD']).trim();
  if (!/^[a-f0-9]{40}$/.test(head)) refused();
  const paths = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean).sort();
  const files = [], hash = createHash('sha256'); let bytes = 0;
  for (const path of paths) {
    const allowed = ci1PublicationPath(path);
    if (!allowed) continue;
    const absolute = resolve(root, path);
    if (!absolute.startsWith(root + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) refused();
    const info = lstatSync(absolute, { throwIfNoEntry: false });
    if (info && (!info.isFile() || info.isSymbolicLink()
      || !realpathSync(absolute).startsWith(root + (process.platform === 'win32' ? '\\' : '/')))) refused();
    const content = info ? readFileSync(absolute) : '[deleted]';
    if (info) { bytes += info.size; if (bytes > CI1_SETUP.sourceBytes) refused();
      files.push({ path, bytes: info.size, sha256: ci1BytesHash(content) }); }
    else files.push({ path, deleted: true });
    if (path !== 'pnpm-lock.yaml') { hash.update(path); hash.update('\0'); hash.update(content); hash.update('\0'); }
  }
  const pnpm = resolve(root, 'pnpm-lock.yaml');
  const fingerprint = ci1BytesHash(JSON.stringify({ head, source: hash.digest('hex'), pnpmLock: existsSync(pnpm) ? ci1BytesHash(readFileSync(pnpm)) : null }));
  return { schemaVersion: 'permission-ci1-publication-inventory-v1', originalPOSBaseSHA: head,
    permissionFingerprint: fingerprint, sourceBytes: bytes, entries: files.length, files,
    publicationAuthorized: false, payloadType: 'CURRENT_POS_WORKING_TREE_CANDIDATE',
    note: 'Git metadata is not copied here. Future CI sourceSHA is the actual reviewed publication commit, not this dirty baseline. Workflow payload needs separate review.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] !== 'inventory' || !process.argv[3] || process.argv.length !== 4) refused();
    console.log(JSON.stringify(ci1PublicationInventory(process.argv[3]), null, 2));
  } catch { console.error('CI1_SOURCE_BLOCKED'); process.exitCode = 78; }
}
