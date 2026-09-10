import { executionId, requiredExecutions, type RequiredExecution } from './caseManifest.ts';

export type DiscoveredTest = { name: string; file: string; backend: string };
export type ExecutionResult = DiscoveredTest & { status: string; durationMs?: number };

function backendForFile(file: string, name: string) {
  const normalized = file.replaceAll('\\', '/');
  if (normalized.includes('/contracts/') && normalized.endsWith('.contract.test.ts')) return 'db';
  if (normalized.includes('/contracts/') && normalized.endsWith('.tool.test.ts')) return 'tool';
  return normalized.includes('/mock/') ? 'mock' : 'core';
}

export function checkDiscovery(discovered: DiscoveredTest[], required: Pick<RequiredExecution, 'name' | 'backend'>[] = requiredExecutions) {
  const byName = new Map<string, DiscoveredTest[]>();
  for (const entry of discovered) {
    const id = executionId(entry.name);
    if (!id) continue;
    const matches = byName.get(id) ?? [];
    matches.push(entry); byName.set(id, matches);
  }
  const missing = required.filter((entry) => !byName.has(entry.name)).map((entry) => entry.name);
  const duplicated = [...byName].filter(([, entries]) => entries.length > 1).map(([name]) => name);
  const wrongBackend = required.filter((entry) => byName.get(entry.name)?.some((found) => found.backend !== entry.backend)).map((entry) => entry.name);
  return { valid: missing.length === 0 && duplicated.length === 0 && wrongBackend.length === 0, missing, duplicated, wrongBackend };
}

export function checkResults(results: ExecutionResult[], required: Pick<RequiredExecution, 'name' | 'backend'>[] = requiredExecutions) {
  const discovery = checkDiscovery(results, required);
  const byName = new Map(results.map((entry) => [executionId(entry.name), entry]));
  const notPassed = required.filter((entry) => byName.has(entry.name) && byName.get(entry.name)?.status !== 'passed').map((entry) => ({ name: entry.name, status: byName.get(entry.name)!.status }));
  return { ...discovery, valid: discovery.valid && notPassed.length === 0, notPassed };
}

export function checkExecutionOptions(attestation:any,results:ExecutionResult[]) {
  if(attestation?.runner!=='vitest-actual-options-v1'||!Array.isArray(attestation.tests)||attestation.errorCount!==0||attestation.reason!=='passed')return {valid:false,invalid:['RUNNER_OPTIONS_NOT_ATTESTED']};
  const actual=new Map<string,any[]>();for(const test of attestation.tests){const key=`${test.file.replaceAll('\\','/')}|${executionId(test.name)}`;actual.set(key,[...(actual.get(key)??[]),test]);}
  const invalid:string[]=[];
  for(const result of results){const id=executionId(result.name);if(!id)continue;const matches=actual.get(`${result.file.replaceAll('\\','/')}|${id}`);if(matches?.length!==1){invalid.push(`${id}:MISSING_OR_DUPLICATE_OPTIONS`);continue;}const entry=matches[0],o=entry.options;
    if(entry.state!=='passed'||o.fails!==false||o.retry!==0||o.repeats!==0||o.mode!=='run')invalid.push(`${id}:NONSTANDARD_PASS_OPTIONS`);
  }
  return {valid:invalid.length===0,invalid};
}

export function readVitestTests(report: any, discovered = false): ExecutionResult[] {
  if (discovered) {
    if (!Array.isArray(report)) throw new Error('INVALID_VITEST_DISCOVERY');
    return report.map((entry: any) => {
      const name = entry.name ?? entry.fullName;
      const file = String(entry.file ?? entry.filepath ?? '');
      return { name: String(name), file, backend: backendForFile(file, String(name)), status: 'notrun' };
    });
  }
  if (!Array.isArray(report.testResults)) throw new Error('INVALID_VITEST_REPORT');
  return report.testResults.flatMap((file: any) => (file.assertionResults ?? []).map((entry: any) => {
    const name = entry.fullName ?? entry.title;
    return { name: String(name), file: String(file.name), backend: backendForFile(String(file.name), String(name)), status: String(entry.status), durationMs: entry.duration };
  }));
}

export function readPlaywrightTests(report: any, discovered = false): ExecutionResult[] {
  if (!Array.isArray(report.suites)) throw new Error('INVALID_PLAYWRIGHT_REPORT');
  const out: ExecutionResult[] = [];
  function walk(suite: any) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      const attempts = test.results ?? [];
      // An expected failure, skip, retry or flaky pass does not satisfy a required case.
      const passed = attempts.length === 1 && attempts[0].status === 'passed' && test.expectedStatus === 'passed';
      const status=passed?'passed':attempts.some((attempt:any)=>attempt.status==='passed')?'invalid-pass':String(attempts.at(-1)?.status??'unexecuted');
      out.push({ name: String(spec.title), file: String(spec.file ?? suite.file), backend: 'e2e', status: discovered ? 'notrun' : status, durationMs: attempts.at(-1)?.duration });
    }
    for (const child of suite.suites ?? []) walk(child);
  }
  report.suites.forEach(walk);
  return out;
}
