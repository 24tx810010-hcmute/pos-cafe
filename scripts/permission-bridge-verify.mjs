import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { permissionFingerprint } from './permission-preflight-core.mjs';
import { parseBridgeEnvironment } from './permission-bridge-runtime.mjs';
import { verifySuite } from './permission-verify.mjs';
import { hashFile } from './idempotency-artifacts.mjs';
import { createBridgeOracle } from './permission-bridge-oracle.mjs';

// Metadata-only verification reports: no runner stacks, SQL rows or credentials.
parseBridgeEnvironment();
const sourceFingerprint=permissionFingerprint(),runId=randomUUID();
const directory=resolve('artifacts/permissions/t02',runId); mkdirSync(directory,{recursive:true});
const files=Object.fromEntries(['discovery','results','options','evidence'].map(k=>[k,resolve(directory,k+'.json')]));
const lock=JSON.parse(readFileSync('package-lock.json','utf8')),pkg=JSON.parse(readFileSync('package.json','utf8'));
const dependencies={};
for(const name of Object.keys({...pkg.dependencies,...pkg.devDependencies})) {
 const version=JSON.parse(readFileSync('node_modules/'+name+'/package.json','utf8')).version;
 if(version!==lock.packages['node_modules/'+name]?.version) throw new Error('DEPENDENCY_LOCK_MISMATCH: '+name);
 dependencies[name]=version;
}
if(process.version!=='v24.16.0') throw new Error('NODE_RUNTIME_MISMATCH');
const required=JSON.parse(readFileSync('tests/contracts/permissionBridgeCases.json','utf8'));
const childEnv={...process.env,NO_COLOR:'1',PERM_RUN_ID:runId,PERM_RESULTS_FILE:files.results,
 IDEM_ATTESTATION_FILE:files.options,PERM_BRIDGE_EVIDENCE_FILE:files.evidence};
const invoke=args=>spawnSync(process.execPath,['node_modules/vitest/vitest.mjs',...args],{env:childEnv,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
const discovery=invoke(['list','--config','vitest.permission-bridge.config.ts','--json='+files.discovery]);
const execution=discovery.status===0?invoke(['run','--config','vitest.permission-bridge.config.ts','--allowOnly=false','--retry=0','--reporter=./scripts/permission-vitest-reporter.mjs']):null;
const read=k=>existsSync(files[k])?JSON.parse(readFileSync(files[k],'utf8')):null;
let suite={valid:false,errors:['RUNNER_FAILED']};
if(discovery.status===0 && execution?.status===0 && ['discovery','results','options'].every(k=>existsSync(files[k]))) {
 suite=verifySuite(read('discovery'),read('results'),read('options'),['permissionBridge.contract.test.ts'],required);
}
const evidence=read('evidence');
const ids=new Set((evidence?.comparisons??[]).map(p=>p.id));
const evidenceValid=evidence?.runId===runId && evidence.sourceFingerprint===sourceFingerprint && evidence.sourceAfter===sourceFingerprint
 && evidence.revert?.passed===true && evidence.revert.profilesCompared===6144
 && evidence.preexistingKinds?.pending>0 && evidence.preexistingKinds?.terminal>0
 && evidence.comparisons.length===6144 && ids.size===6144 && evidence.comparisons.every(p=>p.passed===true)
 && createBridgeOracle().profiles.every(p=>ids.has(p.id))
 && evidence.checks.includes('real Auth/REST protocol v1: create/update/split/pay/void/replay/session revoke')
 && evidence.runtime.containers.length===12 && evidence.runtimeAfter.containers.every(c=>evidence.runtime.containers.some(b=>b.id===c.id && b.imageId===c.imageId));
const runtimeStable=evidence && ['cli','docker','configHash','project'].every(k=>evidence.runtime[k]===evidence.runtimeAfter[k]);
const valid=suite.valid && evidenceValid && runtimeStable && permissionFingerprint()===sourceFingerprint;
const report={schemaVersion:1,runId,sourceFingerprint,finishedAt:new Date().toISOString(),valid,suite,evidenceValid,
 runtime:{node:process.version,dependencies,packageLockHash:hashFile('package-lock.json'),pnpmLockHash:hashFile('pnpm-lock.yaml'),install:'npm ci; pnpm lock preserved but not used for install'},
 artifacts:Object.fromEntries(Object.entries(files).filter(([,p])=>existsSync(p)).map(([k,p])=>[k,{path:p,sha256:hashFile(p)}])),
 scope:{TC01:'SQL catalog/default/constraint assertions; domain follows T03',TC04:'SQL normalization; patch and UI handling follow T03/T05',TC50:'6144 actual bridge comparisons, legacy UI guards, Auth/REST writes and revert',
  Storage:'service health only; gateway behavior NOT_RUN until T09',Realtime:'service health only; two-client event timing NOT_RUN until T10',activation:'NOT_RUN',UI:'legacy guard parity only; no candidate UI implemented'}};
writeFileSync(resolve(directory,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({valid,directory,sourceFingerprint,executed:suite.executedCount,profiles:ids.size,errors:suite.errors}));
process.exitCode=valid?0:1;
