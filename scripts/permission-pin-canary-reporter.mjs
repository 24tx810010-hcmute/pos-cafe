import { writeFileSync } from 'node:fs';

// Playwright errors can contain SQL rows and request bodies. Never serialize them.
export function projectPinCanaryResults(tests, runStatus, fatalCount = 0) {
  const results = tests.map(test => ({
    status: test.status === 'expected' && test.outcome === 'passed' ? 'passed' : 'failed',
    attempts: Number.isInteger(test.attempts) ? test.attempts : 0,
  }));
  const summary = {
    status: runStatus === 'passed' && fatalCount === 0 && results.length > 0
      && results.every(result => result.status === 'passed' && result.attempts === 1) ? 'PASS' : 'FAIL',
    total: results.length,
    passed: results.filter(result => result.status === 'passed' && result.attempts === 1).length,
    failed: results.filter(result => result.status !== 'passed').length,
    retried: results.filter(result => result.attempts > 1).length,
    missing: results.filter(result => result.attempts === 0).length,
    fatalCount,
  };
  return summary;
}

export default class PinCanaryReporter {
  constructor(options = {}) { this.path = options.outputFile ?? process.env.PIN_CANARY_SAFE_FILE ?? 'artifacts/permission-pin-tc18-browser-safe.json'; this.fatalCount = 0; }
  onBegin(_config, suite) { this.tests = suite.allTests(); }
  onError() { this.fatalCount += 1; }
  onEnd(result) {
    const rows = (this.tests ?? []).map(test => ({
      status: test.expectedStatus === 'passed' ? 'expected' : 'unexpected',
      outcome: test.results.at(-1)?.status,
      attempts: test.results.length,
    }));
    const summary = projectPinCanaryResults(rows, result.status, this.fatalCount);
    summary.failureLines = (this.tests ?? []).flatMap(test => test.results.flatMap(attempt =>
      (attempt.errors ?? []).map(error => Number.isInteger(error.location?.line) ? error.location.line : null)));
    writeFileSync(this.path, JSON.stringify(summary, null, 2) + '\n');
    process.stdout.write(`PIN_CANARY_${summary.status} ${summary.passed}/${summary.total}\n`);
  }
}
