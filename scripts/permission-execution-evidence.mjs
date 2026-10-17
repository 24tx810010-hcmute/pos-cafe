import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { digest } from './permission-preflight-core.mjs';

const hex64 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sha256File = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const requiredText = (value, field) => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`EVIDENCE_${field}_MISSING`);
  return value;
};

export async function captureExecutionProfile({ profile, stage, executionKind, configId, observer, appliedArtifacts = [] }) {
  requiredText(profile, 'PROFILE'); requiredText(stage, 'STAGE'); requiredText(configId, 'CONFIG_ID');
  if (!['unit', 'static', 'service'].includes(executionKind)) throw new Error('EVIDENCE_EXECUTION_KIND_INVALID');
  if (executionKind !== 'service') {
    if (observer) throw new Error('EVIDENCE_UNIT_OBSERVER_FORBIDDEN');
    return { profile, stage, executionKind, configId, backend: { applicable: false } };
  }
  if (!observer || typeof observer.observe !== 'function') throw new Error('EVIDENCE_SERVICE_OBSERVER_REQUIRED');
  const observed = await observer.observe();
  const observerOnly = profile === 'legacy' && observed?.apiBinding?.observerOnly === true;
  if (!observerOnly && observed?.apiBinding?.verified !== true) throw new Error('EVIDENCE_API_BINDING_UNVERIFIED');
  const backend = {
    reference: requiredText(observed?.backend?.reference, 'BACKEND_REFERENCE'),
    host: requiredText(observed?.backend?.host, 'BACKEND_HOST'),
    port: observed?.backend?.port,
    database: requiredText(observed?.backend?.database, 'BACKEND_DATABASE'),
    engine: requiredText(observed?.backend?.engine, 'BACKEND_ENGINE'),
  };
  if (!Number.isInteger(backend.port) || backend.port <= 0) throw new Error('EVIDENCE_BACKEND_PORT_INVALID');
  if (!Array.isArray(observed.fixtureIds) || observed.fixtureIds.length === 0 || observed.fixtureIds.some(value => typeof value !== 'string' || !value))
    throw new Error('EVIDENCE_FIXTURES_INVALID');
  for (const field of ['markerProof', 'catalogHash', 'schemaHash']) if (!hex64(observed[field])) throw new Error(`EVIDENCE_${field.toUpperCase()}_INVALID`);
  if (!Array.isArray(appliedArtifacts) || appliedArtifacts.length === 0) throw new Error('EVIDENCE_APPLIED_ARTIFACTS_MISSING');
  const applied = appliedArtifacts.map(value => ({ id: requiredText(value.id, 'APPLIED_ID'), hash: sha256File(resolve(value.path)) }));
  return { profile, stage, executionKind, configId, backend, fixtureIds: [...observed.fixtureIds], markerProof: observed.markerProof,
    catalogHash: observed.catalogHash, schemaHash: observed.schemaHash, appliedArtifacts: applied,
    apiBinding: observerOnly ? 'OBSERVER_ONLY' : { baseUrl: requiredText(observed.apiBinding.baseUrl, 'API_BASE_URL'), projectRef: requiredText(observed.apiBinding.projectRef, 'API_PROJECT_REF') } };
}

export function emitExecutionAttestation({ runId, sourceFingerprint, executionProfile, startedAt, finishedAt, artifactPaths, outputPath }) {
  requiredText(runId, 'RUN_ID');
  if (!hex64(sourceFingerprint)) throw new Error('EVIDENCE_SOURCE_FINGERPRINT_INVALID');
  const artifacts = {};
  const artifactByteHashes = {};
  for (const name of ['discovery', 'results', 'options']) {
    const path = resolve(requiredText(artifactPaths?.[name], `ARTIFACT_${name.toUpperCase()}`));
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    artifacts[name] = digest(parsed); artifactByteHashes[name] = sha256File(path);
  }
  if (!Number.isFinite(Date.parse(startedAt)) || !Number.isFinite(Date.parse(finishedAt)) || Date.parse(finishedAt) < Date.parse(startedAt))
    throw new Error('EVIDENCE_TIME_INVALID');
  const attestation = { schemaVersion: 'permission-execution-profile-v1', runner: 'permission-execution-profile-v1', runId,
    sourceFingerprint, executionProfile, startedAt, finishedAt, artifactHashes: artifacts, artifactByteHashes };
  if (outputPath) writeFileSync(resolve(outputPath), `${JSON.stringify(attestation, null, 2)}\n`);
  return attestation;
}

export function collectVerifiedExecution({ reportPath, attestationPath, currentSourceFingerprint }) {
  const report = JSON.parse(readFileSync(resolve(reportPath), 'utf8'));
  const resolvedAttestation = resolve(attestationPath);
  const attestation = JSON.parse(readFileSync(resolvedAttestation, 'utf8'));
  if (report?.schemaVersion !== 'permission-execution-report-v1' || report.valid !== true || report.exitCode !== 0) throw new Error('EVIDENCE_REPORT_INVALID');
  if (resolve(report.attestation?.path ?? '') !== resolvedAttestation || !hex64(report.attestation?.sha256)
    || report.attestation.sha256 !== sha256File(resolvedAttestation)) throw new Error('EVIDENCE_ATTESTATION_HASH_MISMATCH');
  if (!hex64(currentSourceFingerprint) || report.sourceFingerprint !== currentSourceFingerprint || attestation.sourceFingerprint !== currentSourceFingerprint)
    throw new Error('EVIDENCE_SOURCE_DRIFT');
  if (attestation.schemaVersion !== 'permission-execution-profile-v1' || attestation.runner !== 'permission-execution-profile-v1'
    || attestation.runId !== report.runId) throw new Error('EVIDENCE_ATTESTATION_INVALID');
  const parsed = {};
  for (const name of ['discovery', 'results', 'options']) {
    const descriptor = report.artifacts?.[name];
    const path = resolve(requiredText(descriptor?.path, `REPORT_${name.toUpperCase()}_PATH`));
    const bytes = sha256File(path);
    if (!hex64(descriptor?.sha256) || descriptor.sha256 !== bytes || attestation.artifactByteHashes?.[name] !== bytes)
      throw new Error(`EVIDENCE_${name.toUpperCase()}_BYTE_HASH_MISMATCH`);
    parsed[name] = JSON.parse(readFileSync(path, 'utf8'));
    if (attestation.artifactHashes?.[name] !== digest(parsed[name])) throw new Error(`EVIDENCE_${name.toUpperCase()}_CONTENT_HASH_MISMATCH`);
  }
  const binding = attestation.executionProfile;
  if (binding?.profile !== report.profile || binding?.stage !== report.stage || binding?.executionKind !== report.executionKind)
    throw new Error('EVIDENCE_PROFILE_REPORT_MISMATCH');
  return { id: report.runId, profile: report.profile, stage: report.stage, runner: report.runner, exitCode: report.exitCode,
    sourceFingerprint: report.sourceFingerprint, serviceBinding: binding, ...parsed, profileAttestation: {
      runner: attestation.runner, sourceFingerprint: attestation.sourceFingerprint, executionProfile: binding,
      startedAt: attestation.startedAt, finishedAt: attestation.finishedAt, artifactHashes: attestation.artifactHashes } };
}
