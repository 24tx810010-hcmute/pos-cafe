import { spawnSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { withLightCorePattern, linuxCorePatternAdapter } from './project-ci-launch.mjs';
import { ci1WorkerLayout } from './permission-ci1-intake.mjs';
import { ci1WorkerPlan, ci1PublicExport, ci1FailureExport } from './permission-ci1-worker.mjs';

export function backendInvocation(env, node, root) {
  if (env.GITHUB_REPOSITORY !== 'nguyentronglinh045/pos-cafe' || env.GITHUB_REPOSITORY_ID !== '1263057386' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch'
    || env.CI1_CONFIRMATION !== 'RUN_SYNTHETIC_PILOT' || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '')
    || env.GITHUB_WORKFLOW_SHA !== env.GITHUB_SHA || !node.startsWith('/') || !root.startsWith('/')) throw new Error('BACKEND_DISPATCH_REFUSED');
  const layout = ci1WorkerLayout(env.GITHUB_RUN_ID, Number(env.GITHUB_RUN_ATTEMPT));
  const keys = ['PATH', 'GITHUB_ACTIONS', 'RUNNER_ENVIRONMENT', 'GITHUB_REPOSITORY', 'GITHUB_REPOSITORY_ID', 'GITHUB_EVENT_NAME', 'GITHUB_EVENT_PATH',
    'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_WORKFLOW_SHA', 'GITHUB_SHA'];
  const argv = ['--', 'env', ...keys.filter(key => env[key]).map(key => `${key}=${env[key]}`),
    'CI1_EXECUTION_AUTHORIZED=yes', node, resolve(root, 'scripts/permission-ci1-worker.mjs'), 'launch', root];
  if (argv.some(arg => /[\r\n\0]/.test(arg))) throw new Error('BACKEND_DISPATCH_REFUSED');
  return { argv, layout };
}

export function backendEvidence(worker, evidence, env) {
  const stages = ci1WorkerPlan(env.GITHUB_RUN_ID, Number(env.GITHUB_RUN_ATTEMPT)).stages.slice(1);
  const rendered = ci1PublicExport(evidence);
  const safe = JSON.parse(rendered.json);
  if (worker.schemaVersion !== 'permission-ci1-worker-status-v1' || worker.status !== 'COMPLETE'
    || worker.cleanup !== true || worker.cleanupFailure !== null
    || JSON.stringify(worker.completed) !== JSON.stringify(stages) || worker.businessCounts !== null
    || safe.overallStatus !== 'PASS' || safe.repository !== env.GITHUB_REPOSITORY || safe.runId !== env.GITHUB_RUN_ID
    || safe.attempt !== Number(env.GITHUB_RUN_ATTEMPT) || safe.sourceSHA !== env.GITHUB_SHA
    || safe.workflowSHA !== env.GITHUB_WORKFLOW_SHA) throw new Error('BACKEND_PROOF_REFUSED');
  return rendered;
}

// Diagnostics only: a failed harness may have written valid finite D12 counts.
// This path never satisfies backendEvidence or changes the failed job's exit.
export function backendFailureEvidence(worker, evidence, env) {
  const rendered = ci1PublicExport(evidence), safe = JSON.parse(rendered.json);
  const completed = ci1WorkerPlan(env.GITHUB_RUN_ID, Number(env.GITHUB_RUN_ATTEMPT)).stages.slice(1, 7);
  if (worker.schemaVersion !== 'permission-ci1-worker-status-v1' || worker.status !== 'ERROR'
    || worker.businessCounts !== null || worker.cleanup !== true || worker.cleanupFailure !== null
    || JSON.stringify(worker.completed) !== JSON.stringify(completed)
    || worker.failure?.stage !== 'offline-edge' || worker.failure?.operation !== 'PILOT_HARNESS'
    || worker.failure?.code !== 'COMMAND_FAILED' || worker.failure?.command !== 'node' || worker.failure?.exitCode !== 1
    || !['FAIL', 'ERROR', 'NOT_RUN'].includes(safe.overallStatus)
    || safe.repository !== env.GITHUB_REPOSITORY || safe.runId !== env.GITHUB_RUN_ID
    || safe.attempt !== Number(env.GITHUB_RUN_ATTEMPT) || safe.sourceSHA !== env.GITHUB_SHA
    || safe.workflowSHA !== env.GITHUB_WORKFLOW_SHA) throw new Error('BACKEND_FAILURE_PROOF_REFUSED');
  return rendered;
}

function main() {
  if (process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') throw new Error();
  const { argv, layout } = backendInvocation(process.env, process.execPath, process.cwd());
  const child = withLightCorePattern(linuxCorePatternAdapter(layout.identity.unit),
    () => spawnSync('sudo', argv, { encoding: 'utf8', timeout: 1900000, maxBuffer: 1024 ** 2 }));
  console.log('PROJECT_BACKEND_CORE_PATTERN_RESTORED');
  const read = path => {
    const result = spawnSync('sudo', ['--', 'cat', path], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 ** 2 });
    if (result.status !== 0) throw new Error();
    return JSON.parse(result.stdout);
  };
  const worker = read(`${layout.task}/worker-status.json`);
  if (child.status !== 0) {
    const permitted = ci1WorkerPlan(process.env.GITHUB_RUN_ID, Number(process.env.GITHUB_RUN_ATTEMPT)).stages;
    console.log(JSON.stringify({ schemaVersion: 'pos-backend-failure-v1', verificationScope: 'CI1_PILOT_ONLY',
      status: 'FAIL', completed: Array.isArray(worker.completed) ? worker.completed.filter(value => permitted.includes(value)) : [],
      failure: ci1FailureExport(worker.failure), cleanup: worker.cleanup === true,
      cleanupFailure: ci1FailureExport(worker.cleanupFailure) }));
    try {
      const diagnostic = backendFailureEvidence(worker, read(`${layout.task}/export/public-evidence.json`), process.env);
      console.log(diagnostic.json);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, diagnostic.markdown);
    } catch { console.log('BACKEND_FAILURE_EVIDENCE_UNAVAILABLE'); }
    throw new Error();
  }
  const evidence = backendEvidence(worker, read(`${layout.task}/export/public-evidence.json`), process.env);
  console.log(evidence.json);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, evidence.markdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch { console.log('PROJECT_BACKEND_BLOCKED'); process.exitCode = 1; }
}
