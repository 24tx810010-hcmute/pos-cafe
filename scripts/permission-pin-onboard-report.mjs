import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'artifacts/owner-pin-onboarding-closeout-e2e.json';
const source = readFileSync(path);
const report = JSON.parse(source.toString('utf8'));
const entries = [];
function walk(suites = []) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      entries.push({ expectedStatus: test.expectedStatus, results: test.results?.map(result => result.status) ?? [] });
    }
    walk(suite.suites);
  }
}
walk(report.suites);
const summary = {
  sourceReportSha256: createHash('sha256').update(source).digest('hex'),
  project: 'pin-onboard-closeout-isolated',
  total: entries.length,
  passed: entries.filter(entry => entry.results.length === 1 && entry.results[0] === 'passed' && entry.expectedStatus === 'passed').length,
  failed: entries.filter(entry => entry.results.includes('failed')).length,
  skipped: entries.filter(entry => entry.results.includes('skipped') || entry.results.length === 0).length,
  retried: entries.filter(entry => entry.results.length > 1).length,
  expectedFailure: entries.filter(entry => entry.expectedStatus !== 'passed').length,
  reporterErrors: report.errors?.length ?? 0,
};
if (summary.total !== 16 || summary.passed !== 16 || summary.failed || summary.skipped || summary.retried || summary.expectedFailure
  || summary.reporterErrors) {
  console.error(JSON.stringify(summary));
  throw new Error('PIN_ONBOARD_REPORT_INCOMPLETE');
}
writeFileSync('artifacts/permission-pin-onboard-browser-safe.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
