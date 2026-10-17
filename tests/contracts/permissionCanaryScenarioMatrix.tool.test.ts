import { randomBytes } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { CANARY_SINKS, type CanarySink } from './permissionCanaryOracle.ts';
import {
  assertCanaryScenarioMatrix, CANARY_SCENARIOS, type CanaryScenarioCapture,
} from './permissionCanaryScenarioMatrix.ts';

const failure = (run: () => unknown) => { try { run(); return 'NO_ERROR'; } catch (error) { return (error as Error).message; } };
const safeSinks = (): CanaryScenarioCapture['sinks'] =>
  Object.fromEntries(CANARY_SINKS.map(sink => [sink, { captured: true, data: [] }]));
const reports = (): CanaryScenarioCapture[] => CANARY_SCENARIOS.map(scenario => ({
  scenario,
  canaries: [randomBytes(20).toString('hex')],
  sinks: safeSinks(),
}));

describe('TC-PIN-18 finite scenario matrix oracle', () => {
  test('requires all 20 transition/outcome pairs and every named sink', () => {
    const complete = reports();
    expect(assertCanaryScenarioMatrix(complete)).toMatchObject({ scenarioCount: 20, captureCount: 220, notApplicableCount: 0 });
    expect(failure(() => assertCanaryScenarioMatrix(complete.slice(1)))).toBe('CANARY_SCENARIO_SET_INCOMPLETE');
    const duplicate = reports(); duplicate[1] = duplicate[0];
    expect(failure(() => assertCanaryScenarioMatrix(duplicate))).toBe('CANARY_SCENARIO_SET_INCOMPLETE');
    const missingSink = reports(); delete missingSink[0].sinks.audit;
    expect(failure(() => assertCanaryScenarioMatrix(missingSink))).toBe('CANARY_SCENARIO_SINK_MISSING');
    const uncaptured = reports();
    (uncaptured[0].sinks as Record<string, unknown>).registry = { captured: true, data: null };
    expect(failure(() => assertCanaryScenarioMatrix(uncaptured))).toBe('CANARY_REQUIRED_SINK_NOT_CAPTURED');
  });

  test('permits only explicit client-surface N/A for recovery paths', () => {
    const recovery = reports();
    for (const report of recovery.filter(item => item.scenario.startsWith('recovery:'))) {
      for (const sink of ['browserStorage', 'url', 'console', 'screenshotText'] as CanarySink[])
        report.sinks[sink] = { notApplicable: true, reason: 'NO_CLIENT_SURFACE' };
    }
    expect(assertCanaryScenarioMatrix(recovery)).toMatchObject({ scenarioCount: 20, captureCount: 200, notApplicableCount: 20 });
    const wrongPath = reports(); wrongPath[0].sinks.url = { notApplicable: true, reason: 'NO_CLIENT_SURFACE' };
    expect(failure(() => assertCanaryScenarioMatrix(wrongPath))).toBe('CANARY_SCENARIO_NA_REFUSED');
    const wrongSink = reports(); wrongSink[5].sinks.audit = { notApplicable: true, reason: 'NO_CLIENT_SURFACE' };
    expect(failure(() => assertCanaryScenarioMatrix(wrongSink))).toBe('CANARY_SCENARIO_NA_REFUSED');
    const wrongReason = reports();
    (wrongReason[5].sinks as Record<string, unknown>).url = { notApplicable: true, reason: 'UNVERIFIED' };
    expect(failure(() => assertCanaryScenarioMatrix(wrongReason))).toBe('CANARY_SCENARIO_NA_REFUSED');
    const disguisedCapture = reports();
    (disguisedCapture[5].sinks as Record<string, unknown>).url = {
      notApplicable: true, reason: 'NO_CLIENT_SURFACE', captured: true, data: [],
    };
    expect(failure(() => assertCanaryScenarioMatrix(disguisedCapture))).toBe('CANARY_SCENARIO_NA_REFUSED');
  });

  test('detects contaminated scenario capture without echoing the canary', () => {
    const contaminated = reports();
    const canary = contaminated[19].canaries[0];
    contaminated[19].sinks.artifact = { captured: true, data: { report: `prefix:${canary}:suffix` } };
    const code = failure(() => assertCanaryScenarioMatrix(contaminated));
    expect(code).toBe('CANARY_LEAK_artifact');
    expect(code.includes(canary)).toBe(false);
  });
});
