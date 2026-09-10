import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,readFileSync,writeFileSync,renameSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkDiscovery,checkResults,readVitestTests,checkExecutionOptions } from './resultVerifier.ts';
import { loadTestEnvironmentFile,parseTestEnvironment,preflight } from './preflight.ts';
import { ContractHarness } from './harness.ts';
import { createPayload,ids } from './fixtures.ts';

const root=process.cwd();
const vitest=resolve(root,'node_modules/vitest/vitest.mjs');
function isolatedRunner(){
  const dir=mkdtempSync(join(tmpdir(),'pos-cafe-idem-runner-'));const files=join(dir,'tests/contracts');mkdirSync(files,{recursive:true});
  const config=join(dir,'vitest.config.mjs');writeFileSync(config,`export default {root:${JSON.stringify(dir)},envDir:false,test:{include:['tests/contracts/*.contract.test.ts'],passWithNoTests:false}};`);
  const source=join(files,'fixture.contract.test.ts'),report=join(dir,'report.json');
  const write=(body:string)=>writeFileSync(source,`import {test,expect,describe} from ${JSON.stringify(pathToFileURL(resolve(root,'node_modules/vitest/dist/index.js')).href)};\n${body}\n`);
  const options=join(dir,'options.json');
  const run=(list:boolean)=>spawnSync(process.execPath,[vitest,list?'list':'run','--config',config,...(list?[`--json=${report}`]:['--reporter=json',`--reporter=${resolve(root,'scripts/idempotency-vitest-reporter.mjs')}`,`--outputFile=${report}`]),'--allowOnly=false'],{cwd:root,encoding:'utf8',timeout:30000,env:{...process.env,NO_COLOR:'1',IDEM_ATTESTATION_FILE:options}});
  return {dir,source,report,options,write,run,close:()=>{if(!resolve(dir).startsWith(resolve(tmpdir(),'pos-cafe-idem-runner-')))throw new Error('TEMP_CLEANUP_OUTSIDE_OWNED_RUNNER');rmSync(dir,{recursive:true,force:true});}};
}

test('TC-IDEM-086/tool actual runner discovery rejects a moved file and a missing parameter suffix',()=>{
  const f=isolatedRunner();const required=[{name:'TC-IDEM-078/db/bytes=262144',backend:'db'},{name:'TC-IDEM-078/db/bytes=262145',backend:'db'}];
  const original="test('TC-IDEM-078/db/bytes=262144',()=>expect(1).toBe(1));test('TC-IDEM-078/db/bytes=262145',()=>expect(2).toBe(2));";
  const gate=(requiredCases:any[])=>{const child=spawnSync(process.execPath,['--input-type=module','-e',`import fs from 'node:fs';import {checkDiscovery,readVitestTests} from ${JSON.stringify(pathToFileURL(resolve(root,'tests/contracts/resultVerifier.ts')).href)};const r=JSON.parse(fs.readFileSync(${JSON.stringify(f.report)},'utf8'));process.exit(checkDiscovery(readVitestTests(r,true),${JSON.stringify(requiredCases)}).valid?0:1);`],{cwd:root,encoding:'utf8',timeout:10000});return child.status;};
  try{
    f.write(original);expect(f.run(true).status).toBe(0);expect(gate(required)).toBe(0);expect(readVitestTests(JSON.parse(readFileSync(f.report,'utf8')),true).every(x=>x.status==='notrun')).toBe(true);
    renameSync(f.source,join(f.dir,'outside.contract.test.ts'));expect(f.run(true).status).toBe(0);expect(gate(required)).not.toBe(0);
    f.write("test('TC-IDEM-078/db/bytes=262144',()=>expect(1).toBe(1));test('legacy old test passes',()=>expect(true).toBe(true));");expect(f.run(true).status).toBe(0);expect(gate(required)).not.toBe(0);
    f.write(original);expect(f.run(true).status).toBe(0);expect(gate(required)).toBe(0);
  }finally{f.close();}
});

test('Actual Vitest fails and retry options cannot impersonate an ordinary passing requirement',()=>{
  const f=isolatedRunner();try{
    for(const source of ["test.fails('TC-IDEM-014/db',()=>expect(1).toBe(2));","test('TC-IDEM-014/db',{retry:1},()=>expect(1).toBe(1));"]){
      f.write(source);expect(f.run(false).status).toBe(0);const results=readVitestTests(JSON.parse(readFileSync(f.report,'utf8')));expect(results[0].status).toBe('passed');expect(checkExecutionOptions(JSON.parse(readFileSync(f.options,'utf8')),results).valid).toBe(false);
    }
    f.write("test('TC-IDEM-014/db',()=>expect(1).toBe(1));");expect(f.run(false).status).toBe(0);expect(checkExecutionOptions(JSON.parse(readFileSync(f.options,'utf8')),readVitestTests(JSON.parse(readFileSync(f.report,'utf8')))).valid).toBe(true);
  }finally{f.close();}
});

test('Actual test.only and describe.only fail before an ordinary-looking JSON pass can certify them',()=>{
  const f=isolatedRunner();try{
    for(const source of ["test.only('TC-IDEM-014/db',()=>expect(1).toBe(1));","describe.only('exclusive suite',()=>test('TC-IDEM-014/db',()=>expect(1).toBe(1)));"]){f.write(source);const run=f.run(false);expect(run.status).not.toBe(0);const report=JSON.parse(readFileSync(f.report,'utf8'));expect(report.success).toBe(false);expect(checkExecutionOptions(JSON.parse(readFileSync(f.options,'utf8')),readVitestTests(report)).valid).toBe(false);}
    f.write("test('TC-IDEM-014/db',()=>expect(1).toBe(1));");expect(f.run(false).status).toBe(0);
  }finally{f.close();}
});

test('TC-IDEM-087/tool real preflight fails before test entry and verifies a positive database write',async()=>{
  loadTestEnvironmentFile();const env=parseTestEnvironment();const moduleUrl=pathToFileURL(resolve(root,'tests/contracts/preflight.ts')).href;
  const child=(changes:Record<string,string|undefined>)=>{
    const childEnv={...process.env,...changes};delete childEnv.IDEM_ENV_FILE;
    return spawnSync(process.execPath,['--input-type=module','-e',`import {preflight} from ${JSON.stringify(moduleUrl)};try{await preflight({requireBrowserStack:true});console.log('SUITE_ENTERED');}catch(e){console.error(e.message);process.exitCode=1;}`],{cwd:root,env:childEnv,encoding:'utf8',timeout:15000});
  };
  for(const key of ['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','IDEM_OBSERVER_DSN']){
    const result=child({[key]:undefined});expect(result.status).not.toBe(0);expect(result.stdout).not.toContain('SUITE_ENTERED');expect(result.stderr).toContain(`MISSING_${key}`);
    for(const secret of [env.anonKey,env.storeJwt,env.observerDsn])if(result.stderr.includes(secret))throw new Error('PREFLIGHT_LOGGED_A_CREDENTIAL');
  }
  expect(child({VITE_DATA_MODE:'mock'}).status).not.toBe(0);
  expect(child({IDEM_TEST_MARKER:'pos-cafe-idem-wrong-marker-1234567890abcdef'}).status).not.toBe(0);
  const h=new ContractHarness();let checksums:any;
  try{
    await h.observer(async db=>{await h.assertIsolation(db);checksums=(await db.query('select migration_checksums from private.idempotency_test_environment')).rows[0].migration_checksums;await db.query("update private.idempotency_test_environment set migration_checksums='{}'::jsonb");});
    const result=child({});expect(result.status).not.toBe(0);expect(result.stderr).toContain('MIGRATION_CHECKSUM_MISMATCH');expect(result.stdout).not.toContain('SUITE_ENTERED');
  }finally{if(checksums)await h.observer(db=>db.query('update private.idempotency_test_environment set migration_checksums=$1',[checksums]));}
  await preflight({requireBrowserStack:true});await h.reset();
  try{const token=await h.login();expect((await h.rpc('get_write_capabilities',{},token)).writeProtocolVersion).toBe(1);await h.register(createPayload(),token);expect((await h.execute(createPayload(),token)).status).toBe('applied');const raw=await h.snapshot();expect(raw.orders).toHaveLength(1);expect(raw.orders[0]).toMatchObject({id:ids.O1,store_id:ids.S1,total:60000});}finally{await h.clock(null);}
  const f=isolatedRunner();try{f.write("test.skip('TC-IDEM-014/db',()=>expect(1).toBe(1));");expect(f.run(false).status).toBe(0);const results=readVitestTests(JSON.parse(readFileSync(f.report,'utf8')));expect(checkResults(results,[{name:'TC-IDEM-014/db',backend:'db'}]).valid).toBe(false);}finally{f.close();}
});
