import { mkdirSync,writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
export default class IdempotencyExecutionReporter {
  onTestRunEnd(modules,errors,reason){
    const path=process.env.IDEM_ATTESTATION_FILE;if(!path)throw new Error('IDEM_ATTESTATION_FILE_REQUIRED');
    const tests=[];for(const module of modules)for(const test of module.children.allTests())tests.push({name:test.fullName,file:test.module.moduleId,options:{fails:test.options.fails===true,retry:test.options.retry??0,repeats:test.options.repeats??0,mode:test.options.mode},state:test.result().state});
    mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify({runner:'vitest-actual-options-v1',reason,errorCount:errors.length,tests},null,2)+'\n');
  }
}
