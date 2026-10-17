import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CI1_SUITES } from './permission-ci1-policy.mjs';

import { ci1SuiteDiagnostic } from './permission-ci1-diagnostics.mjs';

// A finite projection for the private harness; it never serializes errors/stacks.
export function summarizeCi1Modules(modules, errors, reason, expectedModule) {
  if (!Array.isArray(modules) || modules.length !== 1 || resolve(modules[0].moduleId) !== resolve(expectedModule)
    || !Array.isArray(errors)) throw new Error('CI1_REPORTER_REFUSED');
  const suites = [modules[0], ...(modules[0].children.allSuites?.() ?? [])];
  const hookErrorCount = suites.reduce((sum, suite) => {
    const errors = typeof suite.errors === 'function' ? suite.errors() : suite.errors;
    if (!Array.isArray(errors)) throw new Error('CI1_REPORTER_REFUSED');
    return sum + errors.length;
  }, 0);
  const states = [...modules[0].children.allTests()].map(value => value.result().state);
  if (states.some(value => !['passed', 'failed', 'skipped', 'pending'].includes(value))) throw new Error('CI1_REPORTER_REFUSED');
  const pass = states.filter(value => value === 'passed').length;
  const fail = states.filter(value => value === 'failed').length;
  return { success: reason === 'passed' && errors.length === 0 && hookErrorCount === 0,
    run: pass + fail, pass, fail, skip: states.length - pass - fail, errorCount: errors.length, hookErrorCount };
}

export default class Ci1VitestReporter {
  onTestRunEnd(modules, errors, reason) {
    const env = process.env;
    const suite = CI1_SUITES.find(item => item.commandId === env.CI1_COMMAND_ID);
    if (!suite || !env.CI1_PRIVATE_ROOT || env.CI1_RESULTS_FILE !== `${env.CI1_PRIVATE_ROOT}/${suite.id}-results.json`
      || !/^[1-9][0-9]{0,19}$/.test(env.PERM_RUN_ID ?? '')
      || ['CI1_INVOCATION_SHA', 'CI1_SOURCE_FINGERPRINT', 'CI1_LOCK_SHA', 'CI1_CONFIG_SHA'].some(key => !/^[a-f0-9]{64}$/.test(env[key] ?? '') || env[key].length !== 64)) {
      throw new Error('CI1_REPORTER_REFUSED');
    }
    const result = { schemaVersion: 'permission-ci1-suite-v1', runId: env.PERM_RUN_ID,
      commandId: suite.commandId, invocationSHA: env.CI1_INVOCATION_SHA,
      sourceFingerprint: env.CI1_SOURCE_FINGERPRINT, lockSHA: env.CI1_LOCK_SHA, configSHA: env.CI1_CONFIG_SHA,
      ...summarizeCi1Modules(modules, errors, reason, suite.module), diagnostic:ci1SuiteDiagnostic(modules,errors) };
    writeFileSync(env.CI1_RESULTS_FILE, `${JSON.stringify(result)}\n`, { flag: 'wx', mode: 0o600 });
  }
}
