import fs from 'node:fs';
import {hash,stable,assert,exact,SHA,UUID,utc} from './permission-hosted-schema.mjs';

// Implementation is available for local rehearsals. Certification can only be
// added by a separately authorized matching-provider capability task.
export const CERTIFIED_HOSTED_PROFILES=Object.freeze([]);
export const IMPLEMENTED_ADAPTERS=Object.freeze([Object.freeze({schemaVersion:3,kind:'permission-hosted-logical-backup',profileId:'supabase-hosted-logical-v1',provenance:'LOCAL_SYNTHETIC'})]);
export const ADAPTER_FILES=Object.freeze(['permission-hosted-schema.mjs','permission-hosted-profile.mjs','permission-hosted-controls.mjs','permission-hosted-backup.mjs','permission-hosted-catalog.mjs','permission-hosted-runtime.mjs','permission-hosted-globals.mjs','permission-backup-dispatch.mjs','permission-backup-v2-local.mjs','permission-backup-v2-catalog.mjs','permission-backup-v2-queries.json']);
export const VERIFIER_FILES=Object.freeze(['permission-hosted-compare.mjs','permission-hosted-schema.mjs','permission-hosted-source.mjs','permission-hosted-controls.mjs','permission-backup-v2-core.mjs']);
const pins=names=>names.map(name=>({name,sha256:hash(fs.readFileSync(new URL(name,import.meta.url)))}));
export const adapterHash=()=>hash(stable(pins(ADAPTER_FILES)));
export const verifierHash=()=>hash(stable(pins(VERIFIER_FILES)));
export const hostedMethodHash=()=>hash(stable({version:3,adapter:adapterHash(),verifier:verifierHash(),catalog:hash(fs.readFileSync(new URL('permission-backup-v2-queries.json',import.meta.url)))}));
export function checkImplementation(binding){assert(binding.methodSha256===hostedMethodHash()&&binding.adapterSha256===adapterHash()&&binding.verifierSha256===verifierHash());}
export function requireImplementedEnvironment(manifest){assert(IMPLEMENTED_ADAPTERS.some(p=>p.schemaVersion===manifest.schemaVersion&&p.kind===manifest.kind&&p.profileId===manifest.profileId&&p.provenance===manifest.environment.provenance),'HOSTED_PROFILE_UNSUPPORTED');}
export function verifyExternalTrust(manifest,manifestSha,external,receipt,{now=Date.now()}={}){
 if(manifest?.trustAnchorRef!==undefined&&manifest.trustAnchorRef!==null)assert(receipt!==null,'HOSTED_PROOF_INVALID');
 if(receipt!==null){
  exact(receipt,['issuer','keyFingerprint','projectRef','runId','sourceManifestSha256','configGeneration','nonce','issuedUtc','expiresUtc','assurance']);
  assert(typeof receipt.issuer==='string'&&receipt.issuer.length>0&&receipt.issuer.length<=128&&SHA.test(receipt.keyFingerprint)&&UUID.test(receipt.runId)&&UUID.test(receipt.nonce)&&SHA.test(receipt.sourceManifestSha256)&&['LOCAL_SYNTHETIC','AUTHENTICATED_OPERATOR_OBSERVATION'].includes(receipt.assurance),'HOSTED_RECEIPT_INVALID');
  assert(utc(receipt.issuedUtc)<utc(receipt.expiresUtc),'HOSTED_RECEIPT_INVALID');
  assert(receipt.projectRef===manifest?.binding?.projectRef&&receipt.runId===manifest?.runId&&receipt.sourceManifestSha256===manifest?.binding?.sourceManifestSha256&&receipt.configGeneration===manifest?.environment?.configRevision,'HOSTED_RECEIPT_INVALID');
 }
 if(!external)return {status:'BLOCKED_TRUST',assurance:'NONE',reason:'HOSTED_TRUST_ANCHOR_REQUIRED'};
 exact(external,['expectedManifestSha256','channel','issuer','keyFingerprint','configGeneration','nonce','receiptSha256','assurance']);
 assert(SHA.test(external.expectedManifestSha256)&&external.expectedManifestSha256===manifestSha,'HOSTED_INPUT_INVALID');
 assert(['LOCAL_HARNESS','OWNER_ACCEPTED_INDEPENDENT_CHANNEL'].includes(external.channel),'HOSTED_RECEIPT_INVALID');
 assert(['LOCAL_SYNTHETIC','AUTHENTICATED_OPERATOR_OBSERVATION'].includes(external.assurance),'HOSTED_RECEIPT_INVALID');
 assert(SHA.test(external.keyFingerprint)&&UUID.test(external.nonce)&&typeof external.issuer==='string'&&external.issuer.length>0,'HOSTED_RECEIPT_INVALID');
 if(external.channel==='LOCAL_HARNESS')assert(manifest.environment.provenance==='LOCAL_SYNTHETIC'&&external.assurance==='LOCAL_SYNTHETIC','HOSTED_RECEIPT_INVALID');
 if(!receipt)return {status:'BLOCKED_TRUST',assurance:'NONE',reason:'HOSTED_TRUST_ANCHOR_REQUIRED'};
 exact(receipt,['issuer','keyFingerprint','projectRef','runId','sourceManifestSha256','configGeneration','nonce','issuedUtc','expiresUtc','assurance']);
 assert(manifest.trustAnchorRef?.sha256===external.receiptSha256&&receipt.issuer===external.issuer&&receipt.keyFingerprint===external.keyFingerprint&&receipt.configGeneration===external.configGeneration&&receipt.configGeneration===manifest.environment.configRevision&&receipt.nonce===external.nonce&&receipt.runId===manifest.runId&&receipt.projectRef===manifest.binding.projectRef&&receipt.sourceManifestSha256===manifest.binding.sourceManifestSha256&&receipt.assurance===external.assurance,'HOSTED_RECEIPT_INVALID');
 assert(utc(receipt.issuedUtc)<=utc(manifest.createdUtc)&&utc(receipt.expiresUtc)>now,'HOSTED_RECEIPT_INVALID');
 return {status:external.channel==='LOCAL_HARNESS'?'LOCAL_HARNESS_PINNED':'OPERATOR_OBSERVED',assurance:external.assurance,reason:'HOSTED_PROVIDER_PROFILE_UNCERTIFIED'};
}
