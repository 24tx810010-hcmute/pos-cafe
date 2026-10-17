import fs from 'node:fs';
import path from 'node:path';
import {strictJson,assert} from './permission-hosted-schema.mjs';
import {requireHostedCutover} from './permission-hosted-compare.mjs';

// Called before a release/rehearsal controller is constructed or connected.
// No release trust channel/profile/action has been authorized for schema3 yet.
export function guardHostedBackupForRelease(ref,config){
 const bytes=fs.readFileSync(ref.path),value=strictJson(bytes);
 assert(value!==null&&typeof value==='object'&&!Array.isArray(value),'HOSTED_PROOF_INVALID');
 // Historical legacy proofs were unversioned. Only the exact v2 pair may
 // reach its separately pinned strict loader; unknown version/kind never
 // falls back to legacy validation.
 if(value.schemaVersion===undefined&&value.kind===undefined)return false;
 if(value.schemaVersion===2&&value.kind==='permission-logical-backup')return false;
 assert(value.schemaVersion===3&&value.kind==='permission-hosted-logical-backup','HOSTED_PROOF_INVALID');
 const expectedBinding={...value.binding,projectRef:config.projectRef,backendOrigin:'https://'+config.backendHost,database:config.database,actor:config.executionRole,sessionUser:config.executionRole,permissionFingerprint:config.sourceFingerprint,bundleSha256:config.bundleHash};
 requireHostedCutover({path:path.basename(ref.path),sha256:ref.sha256,bytes:bytes.length},{packageRoot:path.dirname(path.resolve(ref.path)),expectedBinding,externalTrust:null});
 assert(false,'HOSTED_ACTION_UNAUTHORIZED');
}
