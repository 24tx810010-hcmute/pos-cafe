import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { artifactPath, candidateFingerprint, hashFile } from './idempotency-artifacts.mjs';
import { loadTestEnvironmentFile } from '../tests/contracts/preflight.ts';
import { redactTestArtifacts } from './idempotency-redact-artifacts.mjs';

const stage = process.argv[2];
if(stage==='contracts'||stage==='e2e'||stage==='tools')loadTestEnvironmentFile();
const commands = {
  unit:['node_modules/vitest/vitest.mjs','run','--config','vitest.config.ts'],
  contracts:['node_modules/vitest/vitest.mjs','run','--config','vitest.contract.config.ts'],
  tools:['node_modules/vitest/vitest.mjs','run','--config','tests/contracts/tooling.config.ts'],
  e2e:['node_modules/@playwright/test/cli.js','test','--config','playwright.idempotency.config.ts'],
};
if (!(stage in commands)) throw new Error('Unknown test stage');
mkdirSync('artifacts',{recursive:true});
const output=artifactPath(stage), metadata=output+'.meta.json',attestation=output+'.options.json';
for(const path of [output,metadata,attestation]) if(existsSync(path)) unlinkSync(path);
const before=candidateFingerprint();
const args=[...commands[stage],...(stage==='e2e'?[]:['--reporter=json','--reporter=./scripts/idempotency-vitest-reporter.mjs',`--outputFile=${output}`]),...process.argv.slice(3),...(stage==='e2e'?['--forbid-only']:['--allowOnly=false'])];
const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,IDEM_ATTESTATION_FILE:attestation}});
redactTestArtifacts();
const after=candidateFingerprint();
writeFileSync(metadata,JSON.stringify({stage,startedCandidate:before,finishedCandidate:after,exitCode:result.status,signal:result.signal,reportSha256:existsSync(output)?hashFile(output):null,optionsSha256:existsSync(attestation)?hashFile(attestation):null,finishedAt:new Date().toISOString()},null,2)+'\n');
process.exitCode=result.status===0&&before===after&&existsSync(output)?0:1;
