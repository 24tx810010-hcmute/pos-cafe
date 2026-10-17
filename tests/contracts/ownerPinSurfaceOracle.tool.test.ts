import { describe, expect, test, vi } from 'vitest';
import { probeRestrictedDenial } from './ownerPinSurfaceOracle';

const denial = { ok: false, error: { code: 'PIN_CHANGE_REQUIRED' } };
const canary = 'SYNTHETIC_PRIVATE_CANARY';

// Inspect only sanitized error metadata; a failed assertion never prints the
// synthetic payload, snapshot or original callback error.
async function failureMessage(action: () => Promise<boolean>): Promise<string> {
  try {
    await action();
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(error, 'cause')).toBe(false);
    expect(String(error).includes(canary)).toBe(false);
    return (error as Error).message;
  }
  throw new Error('EXPECTED_RESTRICTED_PROBE_FAILURE');
}

describe('TC-PIN-03/tool restricted denial oracle', () => {
  test('detects mutation plus denial before cleanup restores the baseline', async () => {
    const baseline = `${canary}:before`;
    let state = baseline;
    const events: string[] = [];
    const cleanup = vi.fn(async () => {
      events.push('cleanup');
      state = baseline;
    });
    const message = await failureMessage(() => probeRestrictedDenial({
      readSnapshot: async () => {
        events.push('snapshot');
        return state;
      },
      invoke: async () => {
        events.push('invoke');
        state = `${canary}:mutated`;
        return denial;
      },
      cleanup,
    }));
    expect(message).toBe('PIN_RESTRICTED_ROUTE_MUTATION');
    expect(events).toEqual(['snapshot', 'invoke', 'snapshot', 'cleanup']);
    expect(cleanup).toHaveBeenCalledTimes(1);
    // The old post-rollback comparison would accept this same mutation.
    expect(state === baseline).toBe(true);
  });

  test('accepts a structural denial without effects and returns only a boolean', async () => {
    const cleanup = vi.fn(async () => {});
    const readSnapshot = vi.fn(async () => canary);
    const result = await probeRestrictedDenial({
      readSnapshot,
      invoke: async () => ({ ...denial, hidden: canary }),
      cleanup,
    });
    expect(result).toBe(true);
    expect(readSnapshot).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test.each([
    { label: 'null', result: null },
    { label: 'string', result: canary },
    { label: 'array', result: [] },
    { label: 'success', result: { ok: true, error: { code: 'PIN_CHANGE_REQUIRED' } } },
    { label: 'missing error', result: { ok: false } },
    { label: 'wrong code', result: { ok: false, error: { code: canary } } },
  ])('rejects $label response without exposing it', async ({ result }) => {
    const cleanup = vi.fn(async () => {});
    const message = await failureMessage(() => probeRestrictedDenial({
      readSnapshot: async () => canary,
      invoke: async () => result,
      cleanup,
    }));
    expect(message).toBe('PIN_RESTRICTED_DENIAL_MISMATCH');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test.each(['before snapshot', 'invoke', 'after snapshot'] as const)(
    'sanitizes %s failure and cleans up exactly once', async stage => {
      let snapshots = 0;
      const cleanup = vi.fn(async () => {});
      const invoke = vi.fn(async () => {
        if (stage === 'invoke') throw new Error(canary);
        return denial;
      });
      const message = await failureMessage(() => probeRestrictedDenial({
        readSnapshot: async () => {
          snapshots += 1;
          if ((stage === 'before snapshot' && snapshots === 1)
            || (stage === 'after snapshot' && snapshots === 2)) throw new Error(canary);
          return canary;
        },
        invoke,
        cleanup,
      }));
      expect(message).toBe('PIN_RESTRICTED_ROUTE_PROBE_FAILED');
      expect(invoke).toHaveBeenCalledTimes(stage === 'before snapshot' ? 0 : 1);
      expect(cleanup).toHaveBeenCalledTimes(1);
    },
  );

  test.each(['valid denial', 'wrong response', 'callback failure'] as const)(
    'rejects cleanup failure after %s', async stage => {
      const cleanup = vi.fn(async () => { throw new Error(canary); });
      const message = await failureMessage(() => probeRestrictedDenial({
        readSnapshot: async () => canary,
        invoke: async () => {
          if (stage === 'callback failure') throw new Error(canary);
          return stage === 'valid denial' ? denial : { ok: true, hidden: canary };
        },
        cleanup,
      }));
      expect(message).toBe('PIN_RESTRICTED_ROUTE_ROLLBACK_FAILED');
      expect(cleanup).toHaveBeenCalledTimes(1);
    },
  );
});
