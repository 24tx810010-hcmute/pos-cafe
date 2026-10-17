import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const sha = value => createHash('sha256').update(value).digest('hex');
const root = resolve('artifacts/permission-pin-ack-loss');
const label = process.argv[2];
if (!/^source-\d{2}$/.test(label ?? '')) throw new Error('PIN_ACK_FREEZE_LABEL_REQUIRED');
const target = resolve(root, label);
if (existsSync(target) || existsSync(`${target}.tar`) || existsSync(`${target}.json`)) throw new Error('PIN_ACK_FREEZE_EXISTS');
const main = process.cwd();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' }).split('\0').filter(Boolean))].sort();
mkdirSync(target, { recursive: true });
const entries = [];
for (const path of files) {
  if (/(^|\/)(private|raw|backups?)(\/|$)|(^|\/)\.env(?!\.example$)/i.test(path))
    throw new Error('PIN_ACK_PRIVATE_PATH_REFUSED');
  const source = resolve(main, path), output = resolve(target, path);
  if (!source.startsWith(main + '\\') || !output.startsWith(target + '\\')) throw new Error('PIN_ACK_PATH_ESCAPE');
  if (!existsSync(source)) { entries.push({ path, deleted: true }); continue; }
  const bytes = readFileSync(source);
  mkdirSync(dirname(output), { recursive: true }); copyFileSync(source, output);
  entries.push({ path, bytes: bytes.length, sha256: sha(bytes) });
}
for (const entry of entries) {
  if (entry.deleted) { if (existsSync(resolve(main, entry.path))) throw new Error('PIN_ACK_SOURCE_DRIFT'); }
  else if (sha(readFileSync(resolve(main, entry.path))) !== entry.sha256) throw new Error('PIN_ACK_SOURCE_DRIFT');
}
const tar = `${target}.tar`;
execFileSync('tar.exe', ['-cf', tar, '-C', target, '.'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
const manifest = { recordedUtc: new Date().toISOString(), head, label, entries,
  archive: { path: tar, sha256: sha(readFileSync(tar)) } };
writeFileSync(`${target}.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ label, head, files: entries.length,
  present: entries.filter(entry => !entry.deleted).length,
  deleted: entries.filter(entry => entry.deleted).length,
  archiveSha256: manifest.archive.sha256 }));
