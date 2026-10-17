import { randomBytes } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { assertNoCanaryLeaks, type CanaryCapture, type CanarySink } from './permissionCanaryOracle.ts';

const sinks: CanarySink[] = ['audit', 'registry', 'signal', 'realtime', 'browserStorage', 'url',
  'console', 'telemetry', 'artifact', 'errorMessage', 'screenshotText'];
const safe = () => Object.fromEntries(sinks.map(sink => [sink, { captured: true, data: [] }])) as Record<CanarySink, CanaryCapture>;
const code = (run: () => unknown) => { try { run(); return 'NO_ERROR'; } catch (error) { return (error as Error).message; } };

describe('TC-PIN-18 finite canary oracle controls', () => {
  test('requires each named sink and emits only counts for clean evidence', () => {
    const secret = randomBytes(20).toString('hex');
    const result = assertNoCanaryLeaks({ canaries: [secret], requiredSinks: sinks, observations: safe() });
    expect(result.checkedSinkCount).toBe(sinks.length);
    expect(result.inspectedNodeCount).toBeGreaterThan(0);
    const missing = safe(); delete (missing as Partial<Record<CanarySink, CanaryCapture>>).url;
    expect(code(() => assertNoCanaryLeaks({ canaries: [secret], requiredSinks: sinks, observations: missing })))
      .toBe('CANARY_REQUIRED_SINK_MISSING');
    for (const value of [null, undefined, { captured: true, data: null }, { captured: true, data: undefined }]) {
      const uncaptured = safe(); (uncaptured as Record<string, unknown>).url = value;
      expect(code(() => assertNoCanaryLeaks({ canaries: [secret], requiredSinks: sinks, observations: uncaptured })))
        .toBe('CANARY_REQUIRED_SINK_NOT_CAPTURED');
    }
  });

  test('negative control detects a raw canary in every sink without echoing it', () => {
    const secret = randomBytes(20).toString('hex');
    for (const sink of sinks) {
      const observations = safe(); observations[sink] = { captured: true, data: { nested: ['safe', `prefix:${secret}:suffix`] } };
      const failure = code(() => assertNoCanaryLeaks({ canaries: [secret], requiredSinks: sinks, observations }));
      expect(failure).toBe(`CANARY_LEAK_${sink}`);
      expect(failure.includes(secret)).toBe(false);
    }
  });

  test.each(sinks)('detects the submitted, rejected six-digit PIN in %s', sink => {
    // Same input as complete:denial, rather than the different PIN used later.
    const submittedPin = '123456';
    const observations = safe();
    observations[sink] = { captured: true, data: { rejectedInput: submittedPin } };
    const failure = code(() => assertNoCanaryLeaks({ canaries: [submittedPin], requiredSinks: sinks, observations }));
    expect(failure).toBe(`CANARY_LEAK_${sink}`);
    expect(failure.includes(submittedPin)).toBe(false);
  });

  test.each(sinks)('detects numeric PINs including leading-zero coercion in %s', sink => {
    for (const pin of ['123456', '012345', '000001', '000000']) {
      for (const value of [Number(pin), BigInt(pin)]) {
        const observations = safe();
        observations[sink] = { captured: true, data: { rejectedInput: value } };
        const failure = code(() => assertNoCanaryLeaks({ canaries: [pin], requiredSinks: sinks, observations }));
        expect(failure).toBe(`CANARY_LEAK_${sink}`);
        expect(failure.includes(pin)).toBe(false);
      }
    }
  });

  test('scans array data but does not treat array length as a numeric PIN', () => {
    expect(assertNoCanaryLeaks({ canaries: ['000000'], requiredSinks: sinks, observations: safe() })
      .checkedSinkCount).toBe(sinks.length);
    const observations = safe(); observations.audit = { captured: true, data: [0] };
    expect(code(() => assertNoCanaryLeaks({ canaries: ['000000'], requiredSinks: sinks, observations })))
      .toBe('CANARY_LEAK_audit');
  });

  test('detects encoded URL, binary bytes, Error stack and cyclic nested values', () => {
    const secret = `PIN+${randomBytes(12).toString('hex')}`;
    const encoded = safe(); encoded.url = { captured: true, data: `https://local.test/?key=${encodeURIComponent(secret)}` };
    expect(code(() => assertNoCanaryLeaks({ canaries: [secret], requiredSinks: sinks, observations: encoded })))
      .toBe('CANARY_LEAK_url');
    const base64 = safe(); base64.telemetry = { captured: true, data: Buffer.from(secret).toString('base64') };
    expect(code(() => assertNoCanaryLeaks({ canaries: [secret], requiredSinks: sinks, observations: base64 })))
      .toBe('CANARY_LEAK_telemetry');
    const binary = safe(); binary.artifact = { captured: true, data: Buffer.from(`before${secret}after`) };
    expect(code(() => assertNoCanaryLeaks({ canaries: [secret], requiredSinks: sinks, observations: binary })))
      .toBe('CANARY_LEAK_artifact');
    const failure = new Error('fixed'); failure.stack = `stack:${secret}`;
    const errors = safe(); errors.console = { captured: true, data: failure };
    expect(code(() => assertNoCanaryLeaks({ canaries: [secret], requiredSinks: sinks, observations: errors })))
      .toBe('CANARY_LEAK_console');
    const cyclic: { self?: unknown; text?: string } = {}; cyclic.self = cyclic; cyclic.text = 'safe';
    const clean = safe(); clean.registry = { captured: true, data: cyclic };
    expect(assertNoCanaryLeaks({ canaries: [secret], requiredSinks: sinks, observations: clean }).checkedSinkCount)
      .toBe(sinks.length);
  });
});
