// Setup release lock: this revision has no executable Vercel deployment path.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash, PROJECT_REPOSITORY } from './project-ci-results.mjs';

export const PRODUCTION_ENABLED = false;
const refuse = () => { throw new Error('FRONTEND_RELEASE_BLOCKED'); };
export function verifyReleaseRun(run, input, policy) {
  if (!/^[a-f0-9]{40}$/.test(input.sourceSHA ?? '') || !/^[1-9][0-9]*$/.test(String(input.runId ?? ''))
    || !Number.isSafeInteger(input.attempt) || input.attempt < 1
    || run.repository?.full_name !== PROJECT_REPOSITORY || run.head_repository?.full_name !== PROJECT_REPOSITORY
    || String(run.id) !== String(input.runId) || run.run_attempt !== input.attempt || run.head_sha !== input.sourceSHA
    || run.event !== 'push' || run.status !== 'completed' || run.conclusion !== 'success'
    || run.path !== '.github/workflows/ci.yml' || !policy.allowedSourceBranches.includes(run.head_branch)) refuse();
  return true;
}

export function verifyReleaseEnvironment(environment, branches, policy) {
  const review = environment.protection_rules?.find(rule => rule.type === 'required_reviewers');
  const reviewers = review?.reviewers?.map(entry => entry.type === 'User' ? entry.reviewer?.login : null);
  if (environment.name !== 'production' || environment.can_admins_bypass !== false || !reviewers
    || reviewers.length !== policy.reviewers.length || [...reviewers].sort().join(',') !== [...policy.reviewers].sort().join(',')
    || review.prevent_self_review !== false || environment.deployment_branch_policy?.protected_branches !== false
    || environment.deployment_branch_policy?.custom_branch_policies !== true
    || branches.length !== 1 || branches[0].name !== 'main' || branches[0].type !== 'branch') refuse();
  return true;
}

export function verifyReleaseFiles(files, policy) {
  if (Object.keys(files).sort().join('\0') !== Object.keys(policy.trustedFiles).sort().join('\0')) refuse();
  for (const [path, digest] of Object.entries(policy.trustedFiles)) if (hash(files[path]) !== digest) refuse();
  return true;
}

export function productionCommands() {
  // Neither environment variables nor workflow_dispatch inputs can open this.
  if (!PRODUCTION_ENABLED) refuse();
  return [];
}

async function main() {
  if (process.argv[2] === 'held') {
    if (PRODUCTION_ENABLED) refuse();
    console.log('FRONTEND_RELEASE_HELD_NO_DEPLOY'); return;
  }
  if (process.argv[2] !== 'verify' || process.env.GITHUB_REPOSITORY !== PROJECT_REPOSITORY
    || process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || process.env.GITHUB_REF !== 'refs/heads/main') refuse();
  const policy = JSON.parse(readFileSync(resolve('ci/release-policy.json'), 'utf8'));
  // Read dispatch fields privately; putting free-text inputs in a step env would
  // make the runner print them before validation.
  const supplied = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).inputs;
  const input = { sourceSHA: supplied?.source_sha, runId: supplied?.ci_run_id,
    attempt: Number(supplied?.ci_attempt) };
  if (!/^[a-f0-9]{40}$/.test(input.sourceSHA ?? '') || !/^[1-9][0-9]*$/.test(input.runId ?? '')
    || !Number.isSafeInteger(input.attempt) || input.attempt < 1) refuse();
  const get = async path => {
    const response = await fetch(`https://api.github.com/repos/${PROJECT_REPOSITORY}/${path}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 2 * 1024 ** 2) refuse();
    const text = await response.text(); if (text.length > 2 * 1024 ** 2) refuse();
    return JSON.parse(text);
  };
  const run = await get(`actions/runs/${input.runId}/attempts/${input.attempt}`);
  verifyReleaseRun(run, input, policy);
  const files = {};
  for (const path of Object.keys(policy.trustedFiles)) {
    if (!/^[.A-Za-z0-9_/-]+$/.test(path) || path.includes('..')) refuse();
    const file = await get(`contents/${path}?ref=${input.sourceSHA}`);
    if (file.encoding !== 'base64' || typeof file.content !== 'string' || file.size > 1024 ** 2) refuse();
    files[path] = Buffer.from(file.content, 'base64');
  }
  verifyReleaseFiles(files, policy);
  verifyReleaseEnvironment(await get('environments/production'),
    (await get('environments/production/deployment-branch-policies')).branch_policies, policy);
  if (PRODUCTION_ENABLED) refuse();
  console.log('FRONTEND_RELEASE_PREFLIGHT_VALID_PRODUCTION_HELD');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.log('FRONTEND_RELEASE_BLOCKED'); process.exitCode = 1; });
}
