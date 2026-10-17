import { assertNoCanaryLeaks, CANARY_SINKS, type CanaryCapture, type CanarySink } from './permissionCanaryOracle.ts';

export const CANARY_SCENARIOS = Object.freeze([
  'complete:success', 'complete:denial', 'complete:fault', 'complete:lostAck', 'complete:replay',
  'recovery:success', 'recovery:denial', 'recovery:fault', 'recovery:lostAck', 'recovery:replay',
  'bootstrap:success', 'bootstrap:denial', 'bootstrap:fault', 'bootstrap:lostAck', 'bootstrap:replay',
  'seed:success', 'seed:denial', 'seed:fault', 'seed:lostAck', 'seed:replay',
] as const);

export type CanaryScenario = typeof CANARY_SCENARIOS[number];
type NoClientSurface = { notApplicable: true; reason: 'NO_CLIENT_SURFACE' };
type ScenarioSink = CanaryCapture | NoClientSurface;
export type CanaryScenarioCapture = {
  scenario: CanaryScenario;
  canaries: readonly string[];
  sinks: Partial<Record<CanarySink, ScenarioSink>>;
};

const CLIENT_SINKS = new Set<CanarySink>(['browserStorage', 'url', 'console', 'screenshotText']);
const fail = (code: string): never => { throw new Error(code); };

/** Finite, fail-closed coverage oracle. The caller must supply real captures; this does not collect them. */
export function assertCanaryScenarioMatrix(reports: readonly CanaryScenarioCapture[]) {
  if (!Array.isArray(reports) || reports.length !== CANARY_SCENARIOS.length) fail('CANARY_SCENARIO_SET_INCOMPLETE');
  const seen = new Set<string>();
  let captureCount = 0;
  let notApplicableCount = 0;
  let inspectedNodeCount = 0;
  for (const report of reports) {
    if (!report || !CANARY_SCENARIOS.includes(report.scenario) || seen.has(report.scenario))
      fail('CANARY_SCENARIO_SET_INCOMPLETE');
    seen.add(report.scenario);
    if (!report.sinks || typeof report.sinks !== 'object' || Array.isArray(report.sinks))
      fail('CANARY_SCENARIO_SINKS_INVALID');
    if (Reflect.ownKeys(report.sinks).some(key => typeof key !== 'string' || !CANARY_SINKS.includes(key as CanarySink)))
      fail('CANARY_SCENARIO_SINKS_INVALID');
    const captures: Partial<Record<CanarySink, CanaryCapture>> = {};
    const required: CanarySink[] = [];
    for (const sink of CANARY_SINKS) {
      if (!Object.hasOwn(report.sinks, sink)) fail('CANARY_SCENARIO_SINK_MISSING');
      const value = report.sinks[sink];
      if (value && 'notApplicable' in value) {
        if (value.notApplicable !== true || value.reason !== 'NO_CLIENT_SURFACE'
          || Reflect.ownKeys(value).length !== 2
          || !report.scenario.startsWith('recovery:') || !CLIENT_SINKS.has(sink))
          fail('CANARY_SCENARIO_NA_REFUSED');
        notApplicableCount += 1;
      } else {
        required.push(sink);
        captures[sink] = value as CanaryCapture;
        captureCount += 1;
      }
    }
    const scan = assertNoCanaryLeaks({ canaries: report.canaries, requiredSinks: required, observations: captures });
    inspectedNodeCount += scan.inspectedNodeCount;
  }
  if (seen.size !== CANARY_SCENARIOS.length) fail('CANARY_SCENARIO_SET_INCOMPLETE');
  return { scenarioCount: seen.size, captureCount, notApplicableCount, inspectedNodeCount };
}
