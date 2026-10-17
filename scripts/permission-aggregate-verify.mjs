import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest, permissionFingerprint } from './permission-preflight-core.mjs';
import { verifySuite } from './permission-verify.mjs';

const pendingT16 = new Set(['TC48', 'TC51', 'TC52', 'TC53', 'TC54']);
const profiles = new Set(['legacy', 'bridge', 'candidate', 'transition']);
const normalize = value => value.replaceAll('\\', '/');
const hex64 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const executionKind = stage => stage.endsWith('-unit') ? 'unit' : stage.endsWith('-tools') ? 'static' : 'service';
const bindingValid = (binding, profile, kind, stage) => binding?.profile === profile && binding.executionKind === kind && binding.stage === stage
  && typeof binding.configId === 'string' && binding.configId.length > 0
  && (kind === 'unit' || kind === 'static' ? binding.backend?.applicable === false
    && binding.fixtureIds === undefined && binding.markerProof === undefined && binding.catalogHash === undefined && binding.apiBinding === undefined
    : binding.backend && typeof binding.backend === 'object' && typeof binding.backend.reference === 'string' && binding.backend.reference.length > 0
  && typeof binding.backend.host === 'string' && binding.backend.host.length > 0 && Number.isInteger(binding.backend.port) && binding.backend.port > 0
  && typeof binding.backend.database === 'string' && binding.backend.database.length > 0 && typeof binding.backend.engine === 'string' && binding.backend.engine.length > 0
  && Array.isArray(binding.fixtureIds) && binding.fixtureIds.length > 0 && binding.fixtureIds.every(value => typeof value === 'string' && value.length > 0)
  && hex64(binding.markerProof) && hex64(binding.catalogHash) && hex64(binding.schemaHash)
  && Array.isArray(binding.appliedArtifacts) && binding.appliedArtifacts.length > 0
  && binding.appliedArtifacts.every(value => typeof value?.id === 'string' && value.id.length > 0 && hex64(value.hash))
  && (profile === 'legacy' ? binding.apiBinding === 'OBSERVER_ONLY' : binding.apiBinding && typeof binding.apiBinding === 'object'
    && typeof binding.apiBinding.baseUrl === 'string' && /^https?:\/\//.test(binding.apiBinding.baseUrl)
    && typeof binding.apiBinding.projectRef === 'string' && binding.apiBinding.projectRef.length > 0));
const profileAttested = run => run.profileAttestation?.runner === 'permission-execution-profile-v1'
  && run.profileAttestation.sourceFingerprint === run.sourceFingerprint
  && JSON.stringify(run.profileAttestation.executionProfile) === JSON.stringify(run.serviceBinding)
  && run.profileAttestation.artifactHashes?.discovery === digest(run.discovery)
  && run.profileAttestation.artifactHashes?.results === digest(run.results)
  && run.profileAttestation.artifactHashes?.options === digest(run.options)
  && Number.isFinite(Date.parse(run.profileAttestation.startedAt)) && Number.isFinite(Date.parse(run.profileAttestation.finishedAt))
  && Date.parse(run.profileAttestation.finishedAt) >= Date.parse(run.profileAttestation.startedAt);
const playwrightProjects = value => Array.isArray(value?.config?.projects) ? value.config.projects : [];
const projectOptionsValid = projects => projects.length > 0 && projects.every(project => typeof project.id === 'string' && project.id.length > 0
  && project.retries === 0 && project.repeatEach === 1);
const projectIds = projects => projects.map(project => project.id).sort();
const sameStrings = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
const playwrightEntries = (report, discovered = false) => {
  const entries = [];
  const rootDir = String(report?.config?.rootDir ?? '');
  const walk = suite => {
    for (const spec of suite?.specs ?? []) for (const test of spec.tests ?? []) {
      const attempts = test.results ?? [];
      const passed = attempts.length === 1 && attempts[0].status === 'passed' && attempts[0].retry === 0 && test.expectedStatus === 'passed';
      entries.push({ file: normalize(resolve(rootDir, String(spec.file ?? suite.file ?? ''))), name: String(spec.title),
        project: String(test.projectName ?? ''), status: discovered ? 'notrun' : passed ? 'passed' : 'invalid' });
    }
    for (const child of suite?.suites ?? []) walk(child);
  };
  for (const suite of report?.suites ?? []) walk(suite);
  return entries;
};
const playwrightStrict = run => {
  const errors = [];
  if (run.runner !== 'playwright' || run.exitCode !== 0) errors.push('PLAYWRIGHT_RUNNER_OR_EXIT_INVALID');
  const optionsProjects = Array.isArray(run.options?.projects) ? run.options.projects : [];
  const optionTests = Array.isArray(run.options?.tests) ? run.options.tests : [];
  const discoveryProjects = playwrightProjects(run.discovery);
  const resultProjects = playwrightProjects(run.results);
  if (run.options?.runner !== 'playwright-actual-options-v1' || !projectOptionsValid(optionsProjects)
    || !sameStrings(projectIds(optionsProjects), projectIds(discoveryProjects)) || !sameStrings(projectIds(optionsProjects), projectIds(resultProjects)))
    errors.push('PLAYWRIGHT_OPTIONS_NOT_ATTESTED');
  if (!Array.isArray(run.discovery?.suites) || !Array.isArray(run.results?.suites)) errors.push('PLAYWRIGHT_DISCOVERY_RESULT_MISSING');
  if ((run.results?.errors?.length ?? 0) !== 0 || run.results?.stats?.unexpected !== 0 || run.results?.stats?.flaky !== 0
    || run.results?.stats?.skipped !== 0 || !projectOptionsValid(resultProjects) || !projectOptionsValid(discoveryProjects)) errors.push('PLAYWRIGHT_GLOBAL_STATUS_INVALID');
  const attempts = [];
  const walk = suite => { for (const spec of suite?.specs ?? []) for (const test of spec.tests ?? []) attempts.push(test);
    for (const child of suite?.suites ?? []) walk(child); };
  for (const suite of run.results?.suites ?? []) walk(suite);
  if (attempts.some(test => test.expectedStatus !== 'passed' || test.results?.length !== 1 || test.results[0]?.status !== 'passed' || test.results[0]?.retry !== 0))
    errors.push('PLAYWRIGHT_ATTEMPT_INVALID');
  const executed = playwrightEntries(run.results);
  const optionKeys = new Set();
  for (const test of optionTests) {
    const key = `${test.project}|${normalize(resolve(String(test.file ?? '')))}|${test.name}`;
    if (optionKeys.has(key) || test.retries !== 0 || test.repeatEachIndex !== 0 || test.expectedStatus !== 'passed') errors.push('PLAYWRIGHT_TEST_OPTIONS_INVALID');
    optionKeys.add(key);
  }
  const executedKeys = executed.map(test => `${test.project}|${test.file}|${test.name}`);
  if (optionKeys.size !== executedKeys.length || executedKeys.some(key => !optionKeys.has(key))) errors.push('PLAYWRIGHT_TEST_OPTIONS_INVALID');
  return errors;
};

export function verifyAggregate(manifest, executions, { mode = 't15', sourceFingerprint = permissionFingerprint() } = {}) {
  const errors = [];
  if (!['t15', 'full'].includes(mode)) errors.push('INVALID_MODE');
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.cases) || manifest.cases.length !== 60)
    errors.push('MANIFEST_CASE_SET_INVALID');
  const cases = new Map((manifest?.cases ?? []).map(entry => [entry.id, entry]));
  for (let n = 1; n <= 60; n++) if (!cases.has(`TC${String(n).padStart(2, '0')}`)) errors.push(`MISSING_CASE:TC${String(n).padStart(2, '0')}`);
  if (cases.size !== (manifest?.cases ?? []).length) errors.push('DUPLICATE_CASE');
  const runs = new Map((executions?.runs ?? []).map(run => [run.id, run]));
  if (runs.size !== (executions?.runs ?? []).length) errors.push('DUPLICATE_RUN');
  const candidateBindings = new Set();

  for (const item of cases.values()) {
    if (!profiles.has(item.profile)) errors.push(`INVALID_PROFILE:${item.id}`);
    if (!Array.isArray(item.sourceHints) || item.sourceHints.length === 0) errors.push(`SOURCE_MAPPING_MISSING:${item.id}`);
    for (const file of item.sourceHints ?? []) if (!existsSync(resolve(file))) errors.push(`SOURCE_FILE_MISSING:${item.id}:${file}`);
    if (item.status === 'PENDING_T16') {
      if (!pendingT16.has(item.id)) errors.push(`UNAPPROVED_PENDING:${item.id}`);
      if (mode === 'full') errors.push(`PENDING_IN_FULL_MODE:${item.id}`);
      continue;
    }
    if (item.status !== 'REQUIRED') { errors.push(`INVALID_STATUS:${item.id}`); continue; }
    if (!Array.isArray(item.variants) || item.variants.length === 0) errors.push(`MISSING_VARIANTS:${item.id}`);
    if (Array.isArray(item.missingVariants) && item.missingVariants.length) errors.push(`DECLARED_GAP:${item.id}:${item.missingVariants.join(',')}`);
    const variantKeys = new Set();
    for (const variant of item.variants ?? []) {
      const expectedProfile = variant.profile ?? item.profile;
      const variantKey = `${variant.stage}|${normalize(variant.file ?? '')}|${variant.name ?? ''}`;
      if (!variant.stage || !variant.file || !variant.name || !profiles.has(expectedProfile) || !['vitest', 'playwright'].includes(variant.runner)) errors.push(`INVALID_VARIANT:${item.id}`);
      if (variantKeys.has(variantKey)) errors.push(`DUPLICATE_VARIANT:${item.id}:${variantKey}`);
      variantKeys.add(variantKey);
      if (!existsSync(resolve(variant.file))) errors.push(`VARIANT_FILE_MISSING:${item.id}:${variant.file}`);
      const matchingRuns = [...runs.values()].filter(run => run.profile === expectedProfile && run.stage === variant.stage);
      if (matchingRuns.length !== 1) { errors.push(`MISSING_OR_DUPLICATE_RUN:${item.id}:${variant.stage}`); continue; }
      const run = matchingRuns[0];
      if (run.sourceFingerprint !== sourceFingerprint) errors.push(`SOURCE_DRIFT:${item.id}:${run.id}`);
      if (run.runner !== variant.runner || run.exitCode !== 0) errors.push(`RUNNER_OR_EXIT_MISMATCH:${item.id}:${run.id}`);
      const kind = executionKind(variant.stage);
      if (!bindingValid(run.serviceBinding, run.profile, kind, variant.stage))
        errors.push(`SERVICE_BINDING_INVALID:${item.id}:${run.id}`);
      if (!profileAttested(run)) errors.push(`PROFILE_ATTESTATION_INVALID:${item.id}:${run.id}`);
      if (run.profile === 'candidate' && kind === 'service') candidateBindings.add(JSON.stringify({ backend: run.serviceBinding.backend,
        fixtureIds: run.serviceBinding.fixtureIds, markerProof: run.serviceBinding.markerProof, apiBinding: run.serviceBinding.apiBinding }));
      if (run.runner === 'playwright') {
        errors.push(...playwrightStrict(run).map(error => `${item.id}:${run.id}:${error}`));
        const discovered = Array.isArray(run.discovery?.suites) ? playwrightEntries(run.discovery, true) : [];
        const executed = Array.isArray(run.results?.suites) ? playwrightEntries(run.results) : [];
        const discoveredKeys = new Set(discovered.map(entry => `${entry.project}|${entry.file}|${entry.name}`));
        const executedKeys = new Set(executed.map(entry => `${entry.project}|${entry.file}|${entry.name}`));
        if (discoveredKeys.size !== discovered.length || executedKeys.size !== executed.length || discoveredKeys.size !== executedKeys.size
          || [...discoveredKeys].some(key => !executedKeys.has(key))) errors.push(`${item.id}:${run.id}:PLAYWRIGHT_DISCOVERY_RESULT_MISMATCH`);
        const variantFile = normalize(resolve(variant.file));
        const found = executed.filter(entry => entry.file === variantFile && entry.name === variant.name && (!variant.project || entry.project === variant.project));
        if (found.length !== 1 || found[0].status !== 'passed') errors.push(`${item.id}:${run.id}:PLAYWRIGHT_VARIANT_NOT_STRICT_PASS`);
      } else {
        const checked = verifySuite(run.discovery, run.results, run.options, [normalize(variant.file)], [{ file: normalize(variant.file), name: variant.name }]);
        if (!checked.valid) errors.push(...checked.errors.map(error => `${item.id}:${run.id}:${error}`));
      }
    }
  }
  if (candidateBindings.size > 1) errors.push('CANDIDATE_BACKEND_MIXED');
  return { valid: errors.length === 0, mode, sourceFingerprint, errors, checkedCases: cases.size };
}

export function main(args = process.argv.slice(2)) {
  const modeIndex = args.indexOf('--mode');
  const evidenceIndex = args.indexOf('--evidence');
  if (evidenceIndex < 0 || !['t15', 'full'].includes(args[modeIndex + 1])) throw new Error('USAGE');
  const manifest = JSON.parse(readFileSync(resolve('tests/permissions/permissionAggregateCases.json'), 'utf8'));
  const executions = JSON.parse(readFileSync(resolve(args[evidenceIndex + 1]), 'utf8'));
  const result = verifyAggregate(manifest, executions, { mode: args[modeIndex + 1] });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.valid ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch { process.stderr.write('PERMISSION_AGGREGATE_BLOCKED\n'); process.exitCode = 1; }
}
