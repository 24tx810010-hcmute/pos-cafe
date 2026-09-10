import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export function candidateFingerprint() {
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).split('\0').filter(Boolean)
    .filter((path) => !path.startsWith('artifacts/') && !path.startsWith('test-results/') && !path.endsWith('.tsbuildinfo') && path !== 'pnpm-lock.yaml').sort();
  const hash = createHash('sha256');
  for (const path of paths) { hash.update(path); hash.update('\0'); hash.update(existsSync(path) ? readFileSync(path) : '[deleted]'); hash.update('\0'); }
  return hash.digest('hex');
}

export const artifactPath = (stage) => resolve(`artifacts/idempotency-${stage}.json`);
export const hashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
