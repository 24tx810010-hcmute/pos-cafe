import { expect, test } from 'vitest';
import { runMutation, mutationNames } from '../../scripts/idempotency-mutations.mjs';

// Actual isolated SUT edits with passing baselines and failing literal oracles.
// These certify oracle sensitivity on the memory backend, not a real DB run.
test.each(mutationNames)('TC-IDEM-088/tool/%s', (name) => {
  expect(runMutation(name)).toMatchObject({ name, baselinePassed: true, killed: true, mutantExit: 1, assertionStatus: 'failed' });
}, 120_000);
