import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertManifest, requiredExecutions, caseCatalog } from '../tests/contracts/caseManifest.ts';
import { checkDiscovery, readVitestTests, readPlaywrightTests } from '../tests/contracts/resultVerifier.ts';
import { candidateFingerprint } from './idempotency-artifacts.mjs';
import { loadTestEnvironmentFile } from '../tests/contracts/preflight.ts';

assertManifest();
loadTestEnvironmentFile();
mkdirSync('artifacts', { recursive: true });
const manifestOnly = process.argv.includes('--manifest-only');
const actual = [], errors = [];
if (!manifestOnly) {
  for (const [label, args, output, parser] of [
    ['unit', ['node_modules/vitest/vitest.mjs','list','--config','vitest.config.ts','--json=artifacts/idempotency-list-unit.json'], 'artifacts/idempotency-list-unit.json', readVitestTests],
    ['contracts', ['node_modules/vitest/vitest.mjs','list','--config','vitest.contract.config.ts','--json=artifacts/idempotency-list-contracts.json'], 'artifacts/idempotency-list-contracts.json', readVitestTests],
    ['tools', ['node_modules/vitest/vitest.mjs','list','--config','tests/contracts/tooling.config.ts','--json=artifacts/idempotency-list-tools.json'], 'artifacts/idempotency-list-tools.json', readVitestTests],
    ['e2e', ['node_modules/@playwright/test/cli.js','test','--config','playwright.idempotency.config.ts','--list','--reporter=json'], null, readPlaywrightTests],
  ]) {
    const result = spawnSync(process.execPath, args, { encoding:'utf8', timeout:120000, maxBuffer:16*1024*1024, env:{...process.env,NO_COLOR:'1'} });
    if (result.status !== 0) { errors.push(`${label}: RUNNER_DISCOVERY_FAILED`); continue; }
    try { actual.push(...parser(JSON.parse(output ? readFileSync(output,'utf8') : result.stdout), true)); }
    catch { errors.push(`${label}: INVALID_DISCOVERY_OUTPUT`); }
  }
}
const checked = checkDiscovery(actual);
const report = {
  generatedAt:new Date().toISOString(), candidateFingerprint:candidateFingerprint(), mode:manifestOnly?'requirements-only':'runner-discovery',
  baseCases:caseCatalog.length, requiredExecutions, discovered:actual, errors,
  ...checked, valid:!manifestOnly && errors.length===0 && checked.valid,
};
writeFileSync('artifacts/idempotency-manifest.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({mode:report.mode,baseCases:caseCatalog.length,required:requiredExecutions.length,discovered:actual.length,missing:checked.missing.length,errors,valid:report.valid}));
if (!report.valid && !manifestOnly) process.exitCode=1;
