import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

export const CANARY_SINKS = Object.freeze([
  'audit', 'registry', 'signal', 'realtime', 'browserStorage', 'url',
  'console', 'telemetry', 'artifact', 'errorMessage', 'screenshotText',
] as const);

export type CanarySink = typeof CANARY_SINKS[number];
type Observation = unknown;
export type CanaryCapture = { captured: true; data: Observation };

/** Reads persisted output, including decoded JSON strings; never substitutes a test-built projection. */
export function readCanaryArtifactFiles(paths: readonly string[]) {
  if (!Array.isArray(paths) || paths.length === 0 || new Set(paths).size !== paths.length)
    fail('CANARY_ARTIFACT_INPUT_INVALID');
  return paths.map(path => {
    try {
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 * 1024)
        fail('CANARY_ARTIFACT_UNREADABLE');
      const bytes = readFileSync(path);
      const text = bytes.toString('utf8');
      const decoded: unknown = extname(path).toLowerCase() === '.json' ? JSON.parse(text) : text;
      return { path, bytes, decoded };
    } catch { fail('CANARY_ARTIFACT_UNREADABLE'); }
  });
}

/** Called after the child runner and reporter have closed their output streams. */
export function scanCanaryArtifactDirectory(input: { root: string; canaries: readonly string[] }) {
  const paths: string[] = [];
  try {
    const visit = (path: string) => {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) fail('CANARY_ARTIFACT_UNREADABLE');
      if (stat.isDirectory()) {
        for (const name of readdirSync(path).sort()) visit(join(path, name));
      } else if (stat.isFile()) paths.push(path);
      else fail('CANARY_ARTIFACT_UNREADABLE');
      if (paths.length > 1_000) fail('CANARY_ARTIFACT_SCAN_LIMIT');
    };
    visit(input.root);
  } catch { fail('CANARY_ARTIFACT_UNREADABLE'); }
  if (!paths.length) fail('CANARY_ARTIFACT_EMPTY');
  const captures = readCanaryArtifactFiles(paths);
  assertNoCanaryLeaks({ canaries: input.canaries, requiredSinks: ['artifact'],
    observations: { artifact: { captured: true, data: captures } } });
  return { fileCount: captures.length, files: captures.map(file => ({
    path: relative(input.root, file.path).replaceAll('\\', '/'), bytes: file.bytes.length,
    sha256: createHash('sha256').update(file.bytes).digest('hex'),
  })) };
}

function fail(code: string): never { throw new Error(code); }

function search(value: Observation, needles: readonly string[], seen: WeakSet<object>, budget: { nodes: number }): boolean {
  budget.nodes += 1;
  if (budget.nodes > 50_000) fail('CANARY_ORACLE_SCAN_LIMIT');
  if (typeof value === 'string') return needles.some(needle => value.includes(needle));
  if (value instanceof Uint8Array) return needles.some(needle => Buffer.from(value).includes(Buffer.from(needle)));
  if (typeof value === 'number' || typeof value === 'bigint') {
    const rendered = String(value);
    // JSONB/IndexedDB may coerce a six-digit PIN to a numeric scalar. Preserve
    // detection when that coercion also removes leading zeroes.
    return needles.some(needle => rendered.includes(needle)
      || (/^\d{6}$/.test(needle) && String(Number(needle)) === rendered));
  }
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (value instanceof Error && (search(value.message, needles, seen, budget) || search(value.stack, needles, seen, budget)))
    return true;
  if (value instanceof Map) {
    for (const [key, item] of value) if (search(key, needles, seen, budget) || search(item, needles, seen, budget)) return true;
    return false;
  }
  if (value instanceof Set) {
    for (const item of value) if (search(item, needles, seen, budget)) return true;
    return false;
  }
  for (const key of Reflect.ownKeys(value)) {
    // Array.length is implementation metadata, absent from persisted JSON.
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key === 'string' && search(key, needles, seen, budget)) return true;
    let item: unknown;
    try { item = Reflect.get(value, key); } catch { fail('CANARY_ORACLE_UNREADABLE_VALUE'); }
    if (search(item, needles, seen, budget)) return true;
  }
  return false;
}

/** Throws only fixed codes. Never returns a secret, inspected row, or diagnostic body. */
export function assertNoCanaryLeaks(input: {
  canaries: readonly string[];
  requiredSinks: readonly CanarySink[];
  observations: Partial<Record<CanarySink, CanaryCapture>>;
}) {
  const { canaries, requiredSinks, observations } = input;
  if (!Array.isArray(canaries) || canaries.length === 0 || canaries.some(value => typeof value !== 'string' || value.length < 6)
    || !Array.isArray(requiredSinks) || requiredSinks.length === 0 || new Set(requiredSinks).size !== requiredSinks.length
    || requiredSinks.some(sink => !CANARY_SINKS.includes(sink)) || !observations || typeof observations !== 'object')
    fail('CANARY_ORACLE_INVALID_INPUT');
  for (const sink of requiredSinks as readonly CanarySink[]) {
    if (!Object.hasOwn(observations, sink)) fail('CANARY_REQUIRED_SINK_MISSING');
    const capture = observations[sink];
    if (!capture || capture.captured !== true || !Object.hasOwn(capture, 'data')
      || capture.data === null || capture.data === undefined) fail('CANARY_REQUIRED_SINK_NOT_CAPTURED');
  }
  const needles = [...new Set(canaries.flatMap(value => [value, encodeURIComponent(value), Buffer.from(value).toString('base64')]))];
  const budget = { nodes: 0 };
  for (const sink of requiredSinks as readonly CanarySink[]) {
    if (search(observations[sink]!.data, needles, new WeakSet(), budget)) fail(`CANARY_LEAK_${sink}`);
  }
  return { checkedSinkCount: requiredSinks.length, inspectedNodeCount: budget.nodes };
}

