import { readFileSync, writeFileSync, existsSync,mkdirSync } from 'node:fs';
import { checkResults, readVitestTests, readPlaywrightTests,checkExecutionOptions } from '../tests/contracts/resultVerifier.ts';
import { assertManifest, requiredExecutions } from '../tests/contracts/caseManifest.ts';
import { artifactPath, candidateFingerprint, hashFile } from './idempotency-artifacts.mjs';

assertManifest();
const candidate=candidateFingerprint(), results=[], errors=[];
for(const stage of ['unit','contracts','tools','e2e']) {
  const path=artifactPath(stage);
  if(!existsSync(path)||!existsSync(path+'.meta.json')) {errors.push(`${stage}: MISSING_REPORT_OR_PROVENANCE`);continue;}
  try {
    const metadata=JSON.parse(readFileSync(path+'.meta.json','utf8'));
    if(metadata.stage!==stage||metadata.exitCode!==0||metadata.startedCandidate!==candidate||metadata.finishedCandidate!==candidate||metadata.reportSha256!==hashFile(path)) {errors.push(`${stage}: FAILED_OR_STALE_REPORT`);continue;}
    const report=JSON.parse(readFileSync(path,'utf8'));
    if(stage==='e2e'&&report.errors?.length) errors.push('e2e: GLOBAL_ERROR');
    if(stage!=='e2e'&&(report.success!==true||report.numFailedTests!==0||report.numFailedTestSuites!==0)) errors.push(`${stage}: RUNNER_NOT_SUCCESSFUL`);
    const parsed=stage==='e2e'?readPlaywrightTests(report):readVitestTests(report);
    if(stage!=='e2e'){
      const optionsPath=path+'.options.json';if(!existsSync(optionsPath)||metadata.optionsSha256!==hashFile(optionsPath))errors.push(`${stage}: OPTIONS_PROVENANCE_MISSING`);
      else{const optionCheck=checkExecutionOptions(JSON.parse(readFileSync(optionsPath,'utf8')),parsed);if(!optionCheck.valid)errors.push(...optionCheck.invalid.map(error=>`${stage}: ${error}`));}
    }
    results.push(...parsed);
  }catch{errors.push(`${stage}: INVALID_REPORT`);}
}
const checked=checkResults(results);
const report={candidateFingerprint:candidate,generatedAt:new Date().toISOString(),...checked,errors,valid:checked.valid&&errors.length===0,requiredCount:requiredExecutions.length};
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/idempotency-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({valid:report.valid,required:report.requiredCount,missing:report.missing.length,notPassed:report.notPassed.length,errors}));
process.exitCode=report.valid?0:1;
