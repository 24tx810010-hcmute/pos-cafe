import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, linkSync } from 'node:fs';
import { crc32 } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import SmokeFailureReporter, { smokeStepDiagnostic, smokeTraceDiagnostics, smokeTraceEvents, smokeTraceSnapshotFacts, smokeTraceExpectFacts, sourceBinding, vitestCounts, nodeCounts, smokeCounts, smokePreflightCounts, uiCounts, publicSummary, privateDiagnostics, guardFailureCode, PROJECTS, PROJECT_PHASES, hash } from './project-ci-results.mjs';
import { capturedCommand, trackedFingerprint, lightEnvironment, checkoutGit, allocatedBytes, coreLimitDisabled, browserRuntimeControlCanStart } from './project-ci.mjs';
import { lightService, lightOwnerMatches, withLightCorePattern, stopLightUnit, coreDumpDisabled, linuxCorePatternAdapter } from './project-ci-launch.mjs';
import { backendInvocation } from './project-backend.mjs';
import { verifyReleaseRun, verifyReleaseEnvironment, verifyReleaseFiles, productionCommands, PRODUCTION_ENABLED } from './project-release.mjs';
import { ci1TrustedRepository } from './permission-ci1-policy.mjs';
import { renderCi1Evidence } from './permission-ci1-evidence.mjs';

const sha = '1'.repeat(40), other = '2'.repeat(40), digest = '3'.repeat(64);
const env = { GITHUB_REPOSITORY: 'nguyentronglinh045/pos-cafe', GITHUB_REPOSITORY_ID: '1263057386', GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted',
  GITHUB_EVENT_NAME: 'push', GITHUB_SHA: sha, GITHUB_WORKFLOW_SHA: sha, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1' };
const binding = sourceBinding(env, { after: sha, repository: { full_name: env.GITHUB_REPOSITORY, id: 1263057386 } }, sha);

const traceLines = events => [{type:'context-options',version:8,playwrightVersion:'1.60.0',browserName:'chromium'},
  ...events].map(event => JSON.stringify(event)).join('\n') + '\n';
function storedTraceZip(entries) {
  const files = [], central = []; let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const filename = Buffer.from(name), bytes = Buffer.from(text), local = Buffer.alloc(30), directory = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc32(bytes), 14);
    local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(crc32(bytes), 16); directory.writeUInt32LE(bytes.length, 20); directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    files.push(local, filename, bytes); central.push(directory, filename); offset += local.length + filename.length + bytes.length;
  }
  const end = Buffer.alloc(22), directory = Buffer.concat(central), count = Object.keys(entries).length;
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, directory, end]);
}
const traceReport = path => ({suites:[{specs:[{tests:[{results:[{status:'timedOut',attachments:[{name:'trace',contentType:'application/zip',path}]}]}]}]}]});

test('trace observes browser JS errors without exporting messages, URLs, secrets or unmapped paths', () => {
  const secret = 'FAKE_TRACE_PRIVATE_TOKEN', file = 'src/app/App.tsx';
  const result = smokeTraceEvents(traceLines([
    {type:'event',class:'BrowserContext',method:'pageError',params:{error:{error:{name:'TypeError',message:secret,
      stack:`TypeError ${secret}\n at http://127.0.0.1:5175/${file}?t=123:89:7\n at http://private/${secret}.js:1:1`}}}},
    {type:'console',messageType:'error',text:`Maximum update depth exceeded ${secret}`},
    {type:'console',messageType:'warning',text:`The result of getSnapshot should be cached ${secret}`},
    {type:'resource-snapshot',snapshot:{request:{url:`http://private/${secret}`},response:{status:404}}},
    {type:'resource-snapshot',snapshot:{response:{status:503}}},
  ]), [file]);
  assert.deepEqual(result.codes,['JS_TYPE_ERROR','REACT_UPDATE_DEPTH','REACT_UNSTABLE_SNAPSHOT']);
  assert.deepEqual(result.failedFiles,[file]);
  assert.deepEqual(result.metrics,{traceReadable:1,tracePageErrors:1,traceConsoleErrors:1,traceConsoleWarnings:1,
    traceHttp4xx:1,traceHttp5xx:1,traceHttp2xx:0,traceModuleLine:89,traceModuleColumn:7,
    traceMainFrameSnapshots:0,traceSnapshotComplete:0,traceExpectCalls:0});
  const row = {id:'install',status:'FAIL',exitCode:1,elapsedMs:1,invocationSHA:digest,reportSHA:digest,diagnostic:result};
  const safe=publicSummary(binding,[row],{source:digest,lock:digest});
  assert.equal(safe.overallStatus,'FAIL');assert.deepEqual(safe.phases[0].diagnostic,result);
  assert.equal(JSON.stringify(safe).includes(secret),false);
  assert.equal(JSON.stringify(result).includes('http'),false);
  assert.equal(smokeTraceEvents(traceLines([{type:'event',class:'BrowserContext',method:'pageError',params:{error:{error:{stack:
    'at http://127.0.0.1:5175/src/unknown.ts:1:1\n at http://127.0.0.1:5175/src/../private.ts:1:1'}}}}]),[file]).failedFiles.length,0);
});

test('trace snapshot counts resolve post-order references and expose only fixed screen observations', () => {
  const event=html=>({type:'frame-snapshot',snapshot:{isMainFrame:true,pageId:'FAKE_PRIVATE_PAGE',frameId:'FAKE_PRIVATE_FRAME',
    frameUrl:'http://127.0.0.1:5175/',html}});
  const first=event(['HTML',{},['BODY',{},['DIV',{id:'root'},['MAIN',{'data-testid':'landing-screen'},'FAKE_TRACE_PRIVATE_TOKEN']]]]);
  const second=event([[1,4]]); // text0, main1, div2, body3, html4
  assert.deepEqual(smokeTraceSnapshotFacts([first,second]),{traceMainFrameSnapshots:2,traceSnapshotComplete:1,
    traceScreenMask:1,traceLandingNodes:1,traceAppRootNodes:1});
  const paired=event(['HTML',{},['DIV',{id:'root'},['MAIN',{'data-testid':'passcode-screen'}],['P',{},'private']]]);
  const result=smokeTraceEvents(traceLines([first,second,paired]),[]);
  assert.equal(result.metrics.traceScreenMask,4);assert.equal(result.metrics.traceLandingNodes,0);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.equal(JSON.stringify(result).includes('http'),false);
  const duplicate=event(['DIV',{id:'root'},['MAIN',{'data-testid':'landing-screen'}],['MAIN',{'data-testid':'landing-screen'}]]);
  assert.equal(smokeTraceSnapshotFacts([duplicate]).traceLandingNodes,2);
  const incomplete=smokeTraceSnapshotFacts([first,event([[4,999]])]);
  assert.equal(incomplete.traceSnapshotComplete,0);assert.equal(incomplete.traceScreenMask,undefined);
  const external=event(['MAIN',{'data-testid':'landing-screen'}]);external.snapshot.frameUrl='http://private/FAKE_TRACE_PRIVATE_TOKEN';
  assert.equal(smokeTraceSnapshotFacts([external]).traceMainFrameSnapshots,0);
  for(const frameUrl of ['http://private/FAKE_TRACE_PRIVATE_TOKEN','not a URL','http://127.0.0.1:5175/other']) {
    const outside=event(['MAIN',{'data-testid':'landing-screen'}]);outside.snapshot.frameUrl=frameUrl;
    const last=smokeTraceSnapshotFacts([first,outside]);
    assert.equal(last.traceSnapshotComplete,0);assert.equal(last.traceScreenMask,undefined);assert.equal(last.traceLandingNodes,undefined);
  }
  assert.equal(smokeTraceSnapshotFacts([first,external,second]).traceSnapshotComplete,0);
  assert.equal(smokeTraceSnapshotFacts([first,event([[1,4,99]])]).traceSnapshotComplete,0);
  for(const attrs of [{id:'root','data-testid':123},{id:{}},{title:{private:'FAKE_TRACE_PRIVATE_TOKEN'}},
    {id:'root','data-testid':'landing-screen',class:42}]) {
    const malformed=smokeTraceSnapshotFacts([event(['DIV',attrs])]);
    assert.equal(malformed.traceSnapshotComplete,0);assert.equal(malformed.traceScreenMask,undefined);
  }
  const deep=event(Array.from({length:260}).reduce(node=>['DIV',{},node],['MAIN',{'data-testid':'landing-screen'}]));
  assert.equal(smokeTraceSnapshotFacts([deep]).traceSnapshotComplete,0);
  const wide=event(['DIV',{id:'root'},...Array(100001).fill('private')]);
  assert.equal(smokeTraceSnapshotFacts([wide]).traceSnapshotComplete,0);
  const safe=publicSummary(binding,[{id:'install',status:'FAIL',exitCode:1,elapsedMs:1,invocationSHA:digest,reportSHA:digest,diagnostic:result}],{source:digest,lock:digest});
  assert.equal(safe.phases[0].diagnostic.metrics.traceScreenMask,4);assert.equal(safe.overallStatus,'FAIL');
});

test('fixed selector and browser protocol errors never reflect error text', () => {
  for(const [message,code] of [
    ['strict mode violation: FAKE_TRACE_PRIVATE_TOKEN resolved to 2 elements','SELECTOR_STRICT'],
    ['Invalid selector FAKE_TRACE_PRIVATE_TOKEN','SELECTOR_INVALID'],
    ['toBeVisible can be only used with Locator object FAKE_TRACE_PRIVATE_TOKEN','EXPECT_LOCATOR_REQUIRED'],
    ['Target page, context or browser has been closed FAKE_TRACE_PRIVATE_TOKEN','BROWSER_CLOSED'],
    ['Execution context was destroyed FAKE_TRACE_PRIVATE_TOKEN','CONTEXT_DESTROYED'],
    ['Protocol error FAKE_TRACE_PRIVATE_TOKEN','PROTOCOL_ERROR']]) {
    const result=privateDiagnostics(message,null);
    assert.ok(result.codes.includes(code));assert.equal(JSON.stringify(result).includes('FAKE_TRACE_PRIVATE_TOKEN'),false);
  }
});

test('trace distinguishes configured timeout from observed fixed-locator expect results without raw values', () => {
  const before={type:'before',class:'Frame',method:'expect',callId:'FAKE_PRIVATE_CALL',startTime:100,
    params:{selector:'internal:testid=[data-testid="landing-screen"s]',expression:'to.be.visible',timeout:5000,timeoutForLogs:5000}};
  const after={type:'after',callId:before.callId,endTime:111.4,error:{name:'Expect',message:'FAKE_TRACE_PRIVATE_TOKEN'},
    result:{matches:false,timedOut:false,received:{value:'FAKE_TRACE_PRIVATE_TOKEN'}}};
  const result=smokeTraceEvents(traceLines([before,after]),[]);
  assert.deepEqual(smokeTraceExpectFacts([before,after]),{traceExpectCalls:1,traceExpectTimeoutMs:5000,traceExpectLogTimeoutMs:5000,
    traceExpectMatches:0,traceExpectTimedOut:0,traceExpectReceivedOrdinal:3,traceExpectErrorOrdinal:1,traceExpectDurationMs:11});
  const safe=publicSummary(binding,[{id:'install',status:'FAIL',exitCode:1,elapsedMs:1,invocationSHA:digest,reportSHA:digest,diagnostic:result}],{source:digest,lock:digest});
  assert.equal(safe.phases[0].diagnostic.metrics.traceExpectMatches,0);assert.equal(JSON.stringify(safe).includes('PRIVATE'),false);
  assert.deepEqual(smokeTraceExpectFacts([{...before,params:{...before.params,selector:'FAKE_PRIVATE_SELECTOR'}},after]),{traceExpectCalls:0});
  assert.equal(smokeTraceExpectFacts(Array(100).fill(before)).traceExpectCalls,1);
  const next={...before,callId:'second'}, missing={type:'after',callId:'second',endTime:112};
  assert.equal(smokeTraceExpectFacts([before,after,next,missing]).traceExpectMatches,undefined);
  for(const [value,ordinal] of [[{s:'visible'},1],[{s:'hidden'},2],[{s:'FAKE_TRACE_PRIVATE_TOKEN'},3],
    [{v:'undefined'},0],[{n:42},3],[{s:'visible',raw:'FAKE_TRACE_PRIVATE_TOKEN'},3],['visible',3],[undefined,0]]) {
    const facts=smokeTraceExpectFacts([before,{...after,result:{matches:false,received:{value}}}]);
    assert.equal(facts.traceExpectReceivedOrdinal,ordinal);assert.equal(JSON.stringify(facts).includes('PRIVATE'),false);
  }
  assert.equal(privateDiagnostics('expect.toBeVisible with timeout 5000ms; FAKE_TRACE_PRIVATE_TOKEN',null).codes.includes('TEST_TIMEOUT'),false);
  for(const text of ['Timed out 5000ms','Test timeout of 60000ms exceeded','Timeout: 5000ms','Timeout 5000ms exceeded'])
    assert.ok(privateDiagnostics(text,null).codes.includes('TEST_TIMEOUT'));
});

test('renderer crash protocol signals stay finite and never expose captured protocol content', () => {
  for(const line of ['pw:protocol RECV {"method":"Inspector.targetCrashed","private":"FAKE_TRACE_PRIVATE_TOKEN"}',
    'pw:api Page crashed FAKE_TRACE_PRIVATE_TOKEN','pw:browser [pid=123][err] Received signal 11 FAKE_TRACE_PRIVATE_TOKEN']) {
    const diagnostic=privateDiagnostics(line,null);
    assert.ok(diagnostic.codes.includes('BROWSER_RENDERER_CRASH'));
    const safe=publicSummary(binding,[{id:'install',status:'FAIL',exitCode:1,elapsedMs:1,invocationSHA:digest,reportSHA:digest,diagnostic}],{source:digest,lock:digest});
    assert.equal(safe.overallStatus,'FAIL');assert.ok(safe.phases[0].diagnostic.codes.includes('BROWSER_RENDERER_CRASH'));
    assert.equal(JSON.stringify(safe).includes('PRIVATE'),false);
  }
  assert.equal(privateDiagnostics('Target.detachedFromTarget on normal cleanup',null).codes.includes('BROWSER_RENDERER_CRASH'),false);
  assert.equal(privateDiagnostics('pw:protocol RECV {"id":1,"result":{"body":"Inspector.targetCrashed"}}',null).codes.includes('BROWSER_RENDERER_CRASH'),false);
  for(const line of ['pw:protocol RECV {"id":1,"result":{"method":"Inspector.targetCrashed"}}',
    'pw:protocol SEND {"method":"Inspector.targetCrashed"}',
    'pw:protocol RECV {"id":1,"result":{"body":"pw:api Page crashed"}}',
    'pw:protocol RECV {"id":1,"result":{"body":"pw:browser Received signal 11"}}',
    'pw:protocol RECV {"id":1,"result":{"body":"\\\"method\\\":\\\"Inspector.targetCrashed\\\""}}'])
    assert.equal(privateDiagnostics(line,null).codes.includes('BROWSER_RENDERER_CRASH'),false);
});

test('protocol source strings do not become application errors and only top-level crash facts survive', () => {
  const payload='pw:protocol SEND '+JSON.stringify({method:'Runtime.callFunctionOn',params:{functionDeclaration:'TypeError ReferenceError Timed out FAKE_PRIVATE'}});
  const nested='pw:protocol RECV '+JSON.stringify({id:1,result:{method:'Target.targetCrashed',params:{errorCode:99}}});
  const clean=privateDiagnostics(payload+'\n'+nested,null);
  for(const code of ['TYPE_ERROR','REFERENCE_ERROR','TEST_TIMEOUT','BROWSER_RENDERER_CRASH']) assert.equal(clean.codes.includes(code),false);
  const event='2026-10-17T00:00:00Z pw:protocol RECV ◀ '+JSON.stringify({method:'Target.targetCrashed',params:{status:'crashed',errorCode:139,targetId:'FAKE_PRIVATE'}});
  const marker='PROJECT_SMOKE_FAILED_STEP {}';
  const observed=privateDiagnostics(event+'\n'+marker+'\npw:browser [pid=123][err] Received signal 11 FAKE_PRIVATE',null);
  assert.equal(observed.metrics.browserTargetCrashStatusOrdinal,1); assert.equal(observed.metrics.browserTargetCrashErrorCode,139);
  assert.equal(observed.metrics.browserCrashBeforeFailedStep,1); assert.equal(observed.metrics.browserCrashSignal,11);
  assert.equal(privateDiagnostics(marker+'\n'+event,null).metrics.browserCrashBeforeFailedStep,0);
  const safe=publicSummary(binding,[{id:'install',status:'FAIL',exitCode:1,elapsedMs:1,invocationSHA:digest,reportSHA:digest,diagnostic:observed}],{source:digest,lock:digest});
  assert.equal(safe.overallStatus,'FAIL'); assert.equal(safe.phases[0].diagnostic.metrics.browserTargetCrashErrorCode,139);
  assert.equal(JSON.stringify(safe).includes('PRIVATE'),false);
  const unknown=privateDiagnostics('pw:protocol RECV '+JSON.stringify({method:'Target.targetCrashed',params:{status:'FAKE_PRIVATE',errorCode:-1}}),null);
  assert.equal(unknown.metrics.browserTargetCrashStatusOrdinal,undefined); assert.equal(unknown.metrics.browserTargetCrashErrorCode,undefined);
});

test('static browser runtime control has strict finite facts and cannot replace failed application acceptance', () => {
  const record={schemaVersion:'pos-browser-runtime-control-v1',stage:9,crashed:0,complete:1,cleanup:1};
  const line=value=>'PROJECT_BROWSER_RUNTIME_CONTROL '+JSON.stringify(value);
  const diagnostic=privateDiagnostics(line(record),null);
  assert.equal(diagnostic.metrics.browserProbeComplete,1); assert.equal(diagnostic.metrics.browserProbeStageOrdinal,9);
  const safe=publicSummary(binding,[{id:'install',status:'FAIL',exitCode:1,elapsedMs:1,invocationSHA:digest,reportSHA:digest,diagnostic}],{source:digest,lock:digest});
  assert.equal(safe.overallStatus,'FAIL');
  for(const bad of [{...record,raw:'FAKE_PRIVATE'},{...record,stage:10},{...record,crashed:1},{...record,stage:8},{...record,complete:2}])
    assert.equal(privateDiagnostics(line(bad),null).metrics.browserProbeComplete,undefined);
  assert.equal(privateDiagnostics(line(record)+'\n'+line(record),null).metrics.browserProbeComplete,undefined);
  assert.equal(privateDiagnostics('pw:browser [err] '+line(record),null).metrics.browserProbeComplete,undefined);
  const failed=privateDiagnostics(line({...record,stage:8,crashed:1,complete:0}),null);
  assert.equal(failed.metrics.browserProbeStageOrdinal,8); assert.equal(failed.metrics.browserProbeCrashed,1);
});

test('static browser control refuses attribution while previous cgroup processes or descendants remain', () => {
  assert.equal(browserRuntimeControlCanStart('123\n','nr_descendants 0\nnr_dying_descendants 0\n',123),true);
  for(const [procs,stat] of [['123\n124\n','nr_descendants 0'],['123\n','nr_descendants 1'],['123\n',''],['','nr_descendants 0'],['0123','nr_descendants 0']])
    assert.equal(browserRuntimeControlCanStart(procs,stat,123),false);
});

test('actual debug formatter CR prefixes and colored duration suffixes preserve crash facts without source-string errors', () => {
  for (const colored of [false,true]) {
    const prefix=colored?'\u001b[32m  pw:protocol\u001b[0m ':'2026-10-17T00:00:00.000Z pw:protocol ';
    const suffix=colored?' \u001b[32m+0ms\u001b[0m':'';
    const send=prefix+'SEND ► '+JSON.stringify({method:'Runtime.callFunctionOn',params:{functionDeclaration:'TypeError ReferenceError Timed out FAKE_PRIVATE'}})+suffix;
    const receive=prefix+'◀ RECV '+JSON.stringify({method:'Inspector.targetCrashed',params:{}})+suffix;
    const observed=privateDiagnostics('\r'+send+'\r\n'+receive+'\rPROJECT_SMOKE_FAILED_STEP {}',null);
    for(const code of ['TYPE_ERROR','REFERENCE_ERROR','TEST_TIMEOUT']) assert.equal(observed.codes.includes(code),false);
    assert.equal(observed.metrics.browserInspectorCrashObserved,1); assert.equal(observed.metrics.browserCrashBeforeFailedStep,1);
    assert.equal(privateDiagnostics(receive+' FAKE_PRIVATE',null).metrics.browserInspectorCrashObserved,undefined);
  }
});

test('partial browser control progress survives forced timeout without inventing completion or cleanup', () => {
  const stages=n=>Array.from({length:n},(_,i)=>'PROJECT_BROWSER_RUNTIME_STAGE '+(i+1)).join('\n');
  const partial=privateDiagnostics(stages(8)+'\nPROJECT_BROWSER_RUNTIME_FAILURE 1\nPROJECT_BROWSER_RUNTIME_CRASH 1\n',null).metrics;
  assert.equal(partial.browserProbeStageOrdinal,8); assert.equal(partial.browserProbeFailureNameOrdinal,1); assert.equal(partial.browserProbeCrashed,1);
  assert.equal(partial.browserProbeComplete,undefined); assert.equal(partial.browserProbeCleanup,undefined);
  for(const raw of ['PROJECT_BROWSER_RUNTIME_STAGE 2',stages(2)+'\nPROJECT_BROWSER_RUNTIME_STAGE 2',stages(9)+'\nPROJECT_BROWSER_RUNTIME_STAGE 10',
    stages(2)+'\nPROJECT_BROWSER_RUNTIME_FAILURE 9',stages(2)+'\nPROJECT_BROWSER_RUNTIME_CRASH FAKE_PRIVATE'])
    assert.equal(privateDiagnostics(raw,null).metrics.browserProbeStageOrdinal,undefined);
  const final={schemaVersion:'pos-browser-runtime-control-v1',stage:9,crashed:0,complete:1,cleanup:1};
  assert.equal(privateDiagnostics(stages(9)+'\nPROJECT_BROWSER_RUNTIME_CONTROL '+JSON.stringify(final),null).metrics.browserProbeComplete,1);
  assert.equal(privateDiagnostics(stages(8)+'\nPROJECT_BROWSER_RUNTIME_CONTROL '+JSON.stringify(final),null).metrics.browserProbeComplete,undefined);
});

test('native browser fatal diagnostics export known source ordinals and numeric facts without paths or messages', () => {
  const lines=['2026 pw:browser [pid=123][err] # Fatal error in ../../v8/src/base/platform/platform-posix.cc, line 42',
    '2026 pw:browser [pid=123][err] # Check failed: mmap reserve virtual address space FAKE_PRIVATE',
    '2026 pw:browser [pid=123][err] native stack FAKE_PRIVATE'];
  const diagnostic=privateDiagnostics(lines.join('\n'),null);
  assert.equal(diagnostic.metrics.browserNativeFatalSourceOrdinal,1);assert.equal(diagnostic.metrics.browserNativeFatalLine,42);
  assert.equal(diagnostic.metrics.browserNativeFatalReasonMask,1+4+2048);
  const safe=publicSummary(binding,[{id:'install',status:'FAIL',exitCode:1,elapsedMs:1,invocationSHA:digest,reportSHA:digest,diagnostic}],{source:digest,lock:digest});
  assert.equal(JSON.stringify(safe).includes('PRIVATE'),false);assert.equal(JSON.stringify(safe).includes('platform-posix'),false);
  const native=privateDiagnostics('pw:browser [pid=1][err] [123:456:1017/090000:FATAL:sandbox_linux.cc:123] Check failed: operation not permitted',null);
  assert.equal(native.metrics.browserNativeFatalSourceOrdinal,16);assert.equal(native.metrics.browserNativeFatalLine,123);
  for(const text of ['FATAL:platform-posix.cc:42 FAKE_PRIVATE','pw:protocol RECV '+JSON.stringify({result:{body:lines[0]}}),
    'pw:browser [pid=1][err] [123:456:ERROR:CONSOLE:1] "# Fatal error in platform-posix.cc, line 42"'])
    assert.equal(privateDiagnostics(text,null).metrics.browserNativeFatalObserved,undefined);
  const unknown=privateDiagnostics('pw:browser [pid=1][err] # Fatal error in ../../FAKE_PRIVATE.cc, line 43',null);
  assert.equal(unknown.metrics.browserNativeFatalObserved,1);assert.equal(unknown.metrics.browserNativeFatalSourceOrdinal,undefined);
});

test('target crash markers expose only finite status and exit code for the static control', () => {
  const base='PROJECT_BROWSER_RUNTIME_STAGE 1\nPROJECT_BROWSER_RUNTIME_STAGE 2\n';
  const diagnostic=privateDiagnostics(base+'PROJECT_BROWSER_RUNTIME_TARGET_CRASH 1 133',null);
  assert.equal(diagnostic.metrics.browserProbeTargetStatusOrdinal,1);assert.equal(diagnostic.metrics.browserProbeTargetErrorCode,133);
  for(const value of ['1 -1','5 133','1 65536','1 133 FAKE_PRIVATE','1 133\nPROJECT_BROWSER_RUNTIME_TARGET_CRASH 1 133'])
    assert.equal(privateDiagnostics(base+'PROJECT_BROWSER_RUNTIME_TARGET_CRASH '+value,null).metrics.browserProbeTargetErrorCode,undefined);
});

test('real unzip streams only owned failed trace JSONL and never extracts resource files', () => {
  const root=mkdtempSync(join(tmpdir(),'pos-trace-')), folder=join(root,'test-results','case');mkdirSync(folder,{recursive:true});
  const file=join(folder,'trace.zip'), source='src/app/App.tsx';
  writeFileSync(file,storedTraceZip({'0-trace.trace':traceLines([{type:'console',messageType:'error',text:'ReferenceError FAKE_TRACE_PRIVATE_TOKEN'}]),
    '0-trace.network':traceLines([{type:'resource-snapshot',snapshot:{response:{status:500}}}]),'resources/private.txt':'FAKE_TRACE_PRIVATE_TOKEN'}));
  const calls=[], unzip=process.platform==='win32'?'D:/Git/usr/bin/unzip.exe':'unzip';
  const result=smokeTraceDiagnostics(traceReport(file),root,[source],(command,args,options)=>{
    assert.equal(command,'unzip');calls.push(args);return execFileSync(unzip,args,options);
  });
  assert.equal(result.metrics.traceReadable,1);assert.equal(result.metrics.traceConsoleErrors,1);assert.equal(result.metrics.traceHttp5xx,1);
  assert.deepEqual(result.codes,['JS_REFERENCE_ERROR']);assert.equal(calls.length,3);
  assert.deepEqual(calls.slice(1),[['-p',file,'0-trace.trace'],['-p',file,'0-trace.network']]);
  assert.equal(existsSync(join(folder,'resources')),false);assert.equal(JSON.stringify(result).includes('FAKE_TRACE_PRIVATE_TOKEN'),false);
});

test('real unzip preserves JSONL boundaries after Playwright test.trace without a final newline', () => {
  const root=mkdtempSync(join(tmpdir(),'pos-trace-boundary-')), folder=join(root,'test-results','case');mkdirSync(folder,{recursive:true});
  const file=join(folder,'trace.zip'), secret='FAKE_TRACE_PRIVATE_TOKEN';
  const runner=JSON.stringify({type:'context-options',origin:'testRunner',version:8,playwrightVersion:'1.60.0',browserName:''});
  const library=traceLines([{type:'console',messageType:'error',text:`ReferenceError ${secret}`}]).trimEnd();
  const network=JSON.stringify({type:'resource-snapshot',snapshot:{response:{status:503}}});
  writeFileSync(file,storedTraceZip({'test.trace':runner,'0-trace.trace':library,'0-trace.network':network}));
  const unzip=process.platform==='win32'?'D:/Git/usr/bin/unzip.exe':'unzip';
  assert.throws(()=>smokeTraceEvents(execFileSync(unzip,['-p',file,'test.trace','0-trace.trace','0-trace.network'],{encoding:'utf8'}),[]));
  const result=smokeTraceDiagnostics(traceReport(file),root,[],(_command,args,options)=>execFileSync(unzip,args,options));
  assert.equal(result.metrics.traceReadable,1);assert.equal(result.metrics.traceContextCount,2);
  assert.equal(result.metrics.traceConsoleErrors,1);assert.equal(result.metrics.traceHttp5xx,1);
  assert.deepEqual(result.codes,['JS_REFERENCE_ERROR']);assert.equal(JSON.stringify(result).includes(secret),false);
});

test('separate trace members retain aggregate decoded bounds and reject malformed member JSON', () => {
  const root=mkdtempSync(join(tmpdir(),'pos-trace-total-')), folder=join(root,'test-results');mkdirSync(folder);
  const file=join(folder,'trace.zip');writeFileSync(file,'fake owned zip');
  const big=' '.repeat(8*1024**2), optionsSeen=[];
  const over=smokeTraceDiagnostics(traceReport(file),root,[],(_command,args,options)=>{
    if(args[0]==='-Z1')return 'test.trace\n0-trace.trace\n';optionsSeen.push(options);return big;
  });
  assert.deepEqual(over.codes,['TRACE_UNAVAILABLE']);assert.equal(over.metrics.traceRefusalOrdinal,8);
  assert.ok(optionsSeen.every(options=>options.timeout>0&&options.timeout<=10000));
  assert.ok(optionsSeen[1].maxBuffer<optionsSeen[0].maxBuffer);
  const bad=smokeTraceDiagnostics(traceReport(file),root,[],(_command,args)=>
    args[0]==='-Z1'?'test.trace\n0-trace.trace\n':args[2]==='test.trace'?'not JSON':traceLines([]));
  assert.deepEqual(bad.codes,['TRACE_UNAVAILABLE']);assert.equal(bad.metrics.traceRefusalOrdinal,8);
});

test('missing, outside, duplicate, corrupt or oversized trace data remains unavailable and cannot change failure', () => {
  const root=mkdtempSync(join(tmpdir(),'pos-trace-refuse-')), folder=join(root,'test-results');mkdirSync(folder);
  const file=join(folder,'trace.zip');writeFileSync(file,'not a zip');
  const unavailable=(actual,ordinal)=>{
    assert.deepEqual(actual.codes,['TRACE_UNAVAILABLE']);assert.deepEqual(actual.failedFiles,[]);
    assert.equal(actual.metrics.traceRefusalOrdinal,ordinal);assert.equal(JSON.stringify(actual).includes('FAKE_TRACE_PRIVATE_TOKEN'),false);
  };
  const never=()=>{throw new Error('FAKE_TRACE_PRIVATE_TOKEN');};
  unavailable(smokeTraceDiagnostics(null,root,[],never),2);
  unavailable(smokeTraceDiagnostics(traceReport(join(root,'outside.zip')),root,[],never),3);
  const duplicate=traceReport(file);duplicate.suites[0].specs[0].tests[0].results[0].attachments.push({name:'trace',contentType:'application/zip',path:file});
  unavailable(smokeTraceDiagnostics(duplicate,root,[],never),2);
  const unzip=process.platform==='win32'?'D:/Git/usr/bin/unzip.exe':'unzip';
  unavailable(smokeTraceDiagnostics(traceReport(file),root,[],(_command,args,options)=>execFileSync(unzip,args,options)),5);
  for(const data of ['not json\n','{}\n'.repeat(10001),'x'.repeat(16*1024**2+1)])
    unavailable(smokeTraceDiagnostics(traceReport(file),root,[],(_command,args)=>args[0]==='-Z1'?'0-trace.trace\n':data),8);
  for(const delta of [{version:7},{playwrightVersion:'1.59.0'},{browserName:'firefox'}])
    assert.throws(()=>smokeTraceEvents(JSON.stringify({type:'context-options',version:8,playwrightVersion:'1.60.0',browserName:'chromium',...delta}),[]));
  unavailable(smokeTraceDiagnostics(traceReport(file),root,[],()=> '../private.trace\n'),6);
});

test('trace refusal stages and known locator outcomes stay finite in public diagnostics', () => {
  const root=mkdtempSync(join(tmpdir(),'pos-trace-stages-')), folder=join(root,'test-results');mkdirSync(folder);
  const file=join(folder,'trace.zip');writeFileSync(file,'fake owned zip');
  const wrong=JSON.stringify({type:'context-options',origin:'library',version:7,playwrightVersion:'1.59.2',browserName:'chromium'})+'\n';
  const diagnostic=smokeTraceDiagnostics(traceReport(file),root,[],(_command,args)=>args[0]==='-Z1'?'0-trace.trace\n':wrong);
  assert.equal(diagnostic.metrics.traceRefusalOrdinal,9);assert.equal(diagnostic.metrics.traceContextVersion,7);
  assert.equal(diagnostic.metrics.traceVersionMinor,59);assert.equal(diagnostic.metrics.traceBrowserOrdinal,1);
  const timed=smokeTraceDiagnostics(traceReport(file),root,[],()=>{throw Object.assign(new Error('FAKE_TRACE_PRIVATE_TOKEN'),{code:'ETIMEDOUT',raw:'FAKE_TRACE_PRIVATE_TOKEN'});});
  assert.equal(timed.metrics.traceRefusalOrdinal,5);assert.equal(timed.metrics.traceToolTimedOut,1);
  const safe=publicSummary(binding,[{id:'install',status:'FAIL',exitCode:1,elapsedMs:1,invocationSHA:digest,reportSHA:digest,
    diagnostic:{...timed,metrics:{...timed.metrics,raw:'FAKE_TRACE_PRIVATE_TOKEN'}}}],{source:digest,lock:digest});
  assert.equal(safe.overallStatus,'FAIL');assert.equal(safe.phases[0].diagnostic.metrics.traceToolTimedOut,1);
  assert.equal(JSON.stringify(safe).includes('FAKE_TRACE_PRIVATE_TOKEN'),false);
  assert.ok(privateDiagnostics('Received: <element(s) not found>',null).codes.includes('LOCATOR_NOT_FOUND'));
  assert.ok(privateDiagnostics('Received: hidden',null).codes.includes('LOCATOR_HIDDEN'));
});

test('temporary core handler is restored after success, action failure and failed setup; unsafe cleanup keeps it disabled', () => {
  const original='|/private/FAKE_UNIT_HANDLER\n';
  const fake=()=>{const state={value:original,writes:[],actions:0};return {state,
    read:()=>state.value,write:value=>{state.writes.push(value);state.value=value;}};};
  const success=fake();assert.equal(withLightCorePattern(success,()=>{success.state.actions++;return 17;}),17);
  assert.deepEqual(success.state.writes,['core\n',original]);assert.equal(success.state.value,original);
  const failed=fake();assert.throws(()=>withLightCorePattern(failed,()=>{throw new Error('ACTION_FAILED');}),{message:'ACTION_FAILED'});
  assert.equal(failed.state.value,original);
  const setup=fake(),write=setup.write;setup.write=value=>{write(value);if(value==='core\n')setup.state.value='wrong\n';};
  assert.throws(()=>withLightCorePattern(setup,()=>{setup.state.actions++;}),{message:'PROJECT_CI_CORE_PATTERN_INVALID'});
  assert.equal(setup.state.actions,0);assert.equal(setup.state.value,original);
  const unsafe=fake();unsafe.beforeRestore=()=>{throw new Error('PROJECT_CI_CORE_PATTERN_RESTORE_FAILED');};
  assert.throws(()=>withLightCorePattern(unsafe,()=>0),{message:'PROJECT_CI_CORE_PATTERN_RESTORE_FAILED'});
  assert.equal(unsafe.state.value,'core\n');
  const invalid=fake();invalid.read=()=> 'bad\nsecond\n';
  assert.throws(()=>withLightCorePattern(invalid,()=>0));assert.equal(invalid.state.writes.length,0);
});

test('browser setup signatures become finite diagnostics without exporting private output', () => {
  const result=privateDiagnostics('browserType.launch: FAKE_UNIT_SECRET https://private.example\nHost system is missing dependencies\nNo usable sandbox\nchrome_crashpad_handler: --database is required\nsignal=SIGILL',null);
  for(const code of ['BROWSER_LAUNCH','BROWSER_DEPENDENCIES','BROWSER_SANDBOX','BROWSER_CRASHPAD','BROWSER_EXECUTION'])assert.ok(result.codes.includes(code));
  assert.equal(JSON.stringify(result).includes('FAKE_UNIT_SECRET'),false);
  assert.equal(JSON.stringify(result).includes('private.example'),false);
  for(const code of ['RESOURCE_CORE_PATTERN','RESOURCE_HOST_GROWTH'])assert.equal(guardFailureCode({code}),code);
});

test('smoke timeout exposes only finite API stage and a known failing source location', () => {
  const messages = ['browser.newContext:', 'browserContext.newPage:', 'page.goto:', 'locator.click:',
    'expect(locator).toBeVisible()', 'while setting up "page"', 'while tearing down "context"'];
  const codes = ['BROWSER_CONTEXT', 'BROWSER_PAGE', 'PAGE_NAVIGATION', 'LOCATOR_ACTION', 'ASSERTION_VISIBLE', 'FIXTURE_SETUP', 'FIXTURE_TEARDOWN'];
  for (const [i, message] of messages.entries()) {
    const report = { suites: [{ specs: [{ file: 'pos-cafe.spec.ts', line: 119, tests: [{ projectName: 'desktop',
      results: [{ status: 'timedOut', error: { message: message + ' FAKE_PRIVATE_TOKEN https://private.example',
        stack: 'at /private/source/tests/smoke/pos-cafe.spec.ts:121:14' } }] }] }] }] };
    const info = privateDiagnostics('', report, ['tests/smoke/pos-cafe.spec.ts']);
    assert.ok(info.codes.includes(codes[i]));
    assert.equal(info.metrics.smokeFailureLine, 121); assert.equal(info.metrics.smokeFailureColumn, 14);
    const safe = publicSummary(binding, [{ id: 'install', status: 'FAIL', elapsedMs: 1, exitCode: 1,
      invocationSHA: digest, reportSHA: digest, diagnostic: info }], { source: digest, lock: digest });
    assert.equal(safe.phases[0].diagnostic.metrics.smokeFailureLine, 121);
    for (const secret of ['FAKE_PRIVATE_TOKEN', 'private.example', '/private/source']) assert.equal(JSON.stringify(safe).includes(secret), false);
    assert.equal(privateDiagnostics('', report, []).metrics.smokeFailureLine, undefined);
    report.suites[0].specs[0].tests[0].results[0].error.stack = 'at /private/source/tests/smoke/pos-cafe.spec.ts:1000001:14';
    assert.equal(privateDiagnostics('', report, ['tests/smoke/pos-cafe.spec.ts']).metrics.smokeFailureLine, undefined);
  }
});

test('shared core adapter rejects arbitrary units and requires zero limits plus non-piped pattern', () => {
  const limits='Max core file size        0                    0                    bytes';
  assert.equal(coreDumpDisabled(limits,'core\n'),true);
  assert.equal(coreDumpDisabled(limits,'|handler\n'),false);
  assert.equal(coreDumpDisabled(limits.replace(/0/g,'unlimited'),'core\n'),false);
  for(const unit of ['pos-cafe-light-r123-a1.service','pos-cafe-ci1-r123-a1.service']) assert.equal(typeof linuxCorePatternAdapter(unit).beforeRestore,'function');
  for(const unit of ['ssh.service','pos-cafe-ci1-r123-a1.service\n','../arbitrary']) assert.throws(()=>linuxCorePatternAdapter(unit));
});

test('failure reporter retains the actual failed step location and finite locator while removing raw data', t => {
  const step = { title: 'expect.toBeVisible', category: 'expect', duration: 5000,
    location: { file: process.cwd() + '/tests/smoke/pos-cafe.spec.ts', line: 122, column: 49 },
    error: { message: "FAKE_PRIVATE_TOKEN\nLocator: getByTestId('landing-screen')\nhttps://private.example" }, raw: 'FAKE_PRIVATE_TOKEN' };
  const lines = []; t.mock.method(console, 'log', line => lines.push(line));
  const reporter = new SmokeFailureReporter();
  reporter.onStepEnd({}, {}, { ...step, error: undefined }); assert.equal(lines.length, 0);
  reporter.onStepEnd({}, {}, step);
  reporter.onTestEnd({}, { duration: 60000, errors: [{ ...step.error, location: step.location }] });
  assert.equal(reporter.onEnd, undefined);
  const info = privateDiagnostics('tests/smoke/pos-cafe.spec.ts:119:1\n' + lines.join('\n'), null, ['tests/smoke/pos-cafe.spec.ts']);
  assert.equal(info.metrics.smokeFailureLine, 122); assert.equal(info.metrics.smokeStepSourceOrdinal, 1);
  assert.equal(info.metrics.smokeStepLocatorOrdinal, 1); assert.equal(info.metrics.smokeStepCategoryOrdinal, 2);
  assert.equal(info.metrics.smokeStepApiOrdinal, 7);
  assert.equal(info.metrics.smokeStepDurationMs, 5000);
  const safe = publicSummary(binding, [{ id: 'install', status: 'FAIL', elapsedMs: 1, exitCode: 1,
    invocationSHA: digest, reportSHA: digest, diagnostic: info }], { source: digest, lock: digest });
  assert.equal(safe.overallStatus, 'FAIL'); assert.equal(safe.phases[0].diagnostic.metrics.smokeStepLocatorOrdinal, 1);
  for (let i = 0; i < 40; i++) reporter.onStepEnd({}, {}, step);
  assert.equal(lines.length, 32);
  for (const value of ['FAKE_PRIVATE_TOKEN', 'private.example', process.cwd()]) assert.equal(lines.join('\n').includes(value), false);
  const unknown = smokeStepDiagnostic({ ...step, title: 'FAKE_PRIVATE_TOKEN', category: 'FAKE_PRIVATE_TOKEN', duration: Infinity,
    location: { file: '/private/unknown.ts', line: 1, column: 1 }, error: { message: "Locator: getByTestId('FAKE_PRIVATE_TOKEN')" } }, process.cwd());
  assert.equal(unknown.file, null); assert.equal(unknown.categoryOrdinal, 0); assert.equal(unknown.locatorOrdinal, 0); assert.equal(unknown.durationMs, null);
  const hostile = privateDiagnostics('PROJECT_SMOKE_FAILED_STEP ' + JSON.stringify({ ...unknown, categoryOrdinal: 999, apiOrdinal: 999,
    locatorOrdinal: 999, file: '/private/unknown.ts', line: 1, column: 1, raw: 'FAKE_PRIVATE_TOKEN' }), null, []);
  assert.equal(hostile.metrics.smokeStepLocatorOrdinal, undefined); assert.equal(hostile.metrics.smokeStepSourceOrdinal, undefined);
  assert.equal(JSON.stringify(hostile).includes('FAKE_PRIVATE_TOKEN'), false);
});

test('core restore requires stopped unit plus recursively empty or confirmed absent cgroup', () => {
  const fake=()=>({stop:()=>({status:0}),state:()=>({load:'loaded',active:'inactive'}),populated:()=>0});
  assert.doesNotThrow(()=>stopLightUnit(fake()));
  const gone=fake();gone.stop=()=>({status:5});gone.state=()=>({load:'not-found',active:'inactive'});gone.populated=()=>null;
  assert.doesNotThrow(()=>stopLightUnit(gone));
  for(const change of [a=>{a.stop=()=>({status:1});},a=>{a.state=()=>({load:'loaded',active:'active'});a.populated=()=>null;},
    a=>{a.populated=()=>1;},a=>{a.populated=()=>{throw Object.assign(new Error(),{code:'EACCES'});};},
    a=>{a.state=()=>{throw new Error('READ_FAILED');};},a=>{a.stop=()=>{throw new Error('STOP_FAILED');};}]) {
    const a=fake();change(a);assert.throws(()=>stopLightUnit(a));
  }
});

test('source binding distinguishes tested PR merge from head and refuses mismatched SHA/event/repo', () => {
  const event = { repository: { full_name: env.GITHUB_REPOSITORY, id: 1263057386 }, pull_request: { head: { sha: other }, merge_commit_sha: sha } };
  assert.equal(sourceBinding({ ...env, GITHUB_EVENT_NAME: 'pull_request' }, event, sha).prHeadSHA, other);
  assert.throws(() => sourceBinding({ ...env, GITHUB_EVENT_NAME: 'pull_request' }, event, other));
  assert.throws(() => sourceBinding({ ...env, GITHUB_EVENT_NAME: 'pull_request_target' }, event, sha));
  assert.throws(() => sourceBinding(env, { after: other }, sha));
  assert.throws(() => sourceBinding({ ...env, GITHUB_REPOSITORY_ID: '1' }, event, sha));
  assert.throws(() => sourceBinding(env, { ...event, repository: {...event.repository, id:1} }, sha));
});

test('Vitest requires exact discovered file set, totals and zero pending/fail/hook errors', () => {
  const report = { numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, success: true,
    testResults: [{ name: '/source/src/a.test.ts', status: 'passed', assertionResults: [{ status: 'passed' }] }] };
  assert.equal(vitestCounts(report, ['src/a.test.ts'], '/source').pass, 1);
  assert.throws(() => vitestCounts(report, ['src/a.test.ts', 'src/b.test.ts'], '/source'));
  assert.throws(() => vitestCounts({ ...report, numTotalTests: 2 }, ['src/a.test.ts'], '/source'));
  assert.throws(() => vitestCounts({ ...report, numRuntimeErrorTestSuites: 1 }, ['src/a.test.ts'], '/source'));
});

test('light tooling accounts for exactly the declared real-backend case without accepting any other skip or failure', () => {
  const manual = [{file:'tests/contracts/gates.tool.test.ts',fullName:'TC-IDEM-087/tool real backend'}];
  const report = {numTotalTests:2,numPassedTests:1,numFailedTests:0,numPendingTests:1,success:true,
    testResults:[{name:'/source/tests/contracts/gates.tool.test.ts',status:'passed',assertionResults:[
      {fullName:'pure runner gate',status:'passed'}, {fullName:manual[0].fullName,status:'pending'}]}]};
  const files = [manual[0].file];
  assert.deepEqual(vitestCounts(report,files,'/source',manual),{discovered:2,run:1,pass:1,fail:0,skip:1,manualDeferred:1});
  assert.throws(()=>vitestCounts(report,files,'/source'));
  const extra = structuredClone(report);extra.testResults[0].assertionResults[0].status='pending';
  assert.throws(()=>vitestCounts(extra,files,'/source',manual));
  const missing = structuredClone(report);missing.testResults[0].assertionResults[1].fullName='another case';
  assert.throws(()=>vitestCounts(missing,files,'/source',manual));
  const accidentalRun = structuredClone(report);accidentalRun.testResults[0].assertionResults[1].status='passed';
  assert.throws(()=>vitestCounts(accidentalRun,files,'/source',manual));
  assert.throws(()=>vitestCounts(report,files,'/source',[...manual,...manual]));
  assert.throws(()=>vitestCounts({...report,numPendingTests:0,numTodoTests:1},files,'/source',manual));
});

test('Node TAP pending/cancelled/malformed counts cannot become a pass', () => {
  const tap = '# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(nodeCounts(tap).run, 2);
  assert.throws(() => nodeCounts(tap.replace('# skipped 0', '# skipped 1')));
  assert.throws(() => nodeCounts('FAKE_PRIVATE_TOKEN'));
});

test('smoke requires every project/case and exact applicability skips without retries or expected failures', () => {
  const report = { suites: [{ specs: PROJECTS.map(projectName => ({ file: 'a.ts', line: 1, title: 'case', tests: [
    { projectName, expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed', retry: 0, errors: [] }] }] })) }],
    errors: [], stats: { expected: 6, skipped: 0, unexpected: 0, flaky: 0 } };
  assert.equal(smokeCounts(report, report, []).pass, 6);
  const missing = structuredClone(report); missing.suites[0].specs.pop();
  assert.throws(() => smokeCounts(missing, report, []));
  const retry = structuredClone(report); retry.suites[0].specs[0].tests[0].results[0].retry = 1;
  assert.throws(() => smokeCounts(retry, report, []));
});

test('smoke preflight requires the one original desktop case and never substitutes for full matrix', () => {
  const spec=projectName=>({file:'pos-cafe.spec.ts',line:119,title:'POS mock flow keeps primary actions visible on landscape viewports',
    tests:[{projectName,expectedStatus:'passed',status:'expected',results:[{status:'passed',retry:0,errors:[]}]}]});
  const discovery={suites:[{specs:PROJECTS.map(spec)}],errors:[]};
  const report={suites:[{specs:[spec('desktop')]}],errors:[],stats:{expected:1,unexpected:0,skipped:0,flaky:0}};
  assert.equal(smokePreflightCounts(report,discovery).pass,1);
  assert.throws(()=>smokeCounts(report,discovery,[]));
  for(const change of [r=>{r.suites[0].specs[0].line=120;},r=>{r.suites[0].specs.push(spec('desktop'));},
    r=>{r.suites[0].specs[0].tests[0].results[0].status='skipped';},r=>{r.stats.unexpected=1;},
    r=>{r.suites[0].specs[0].tests[0].results[0].retry=1;},r=>{r.errors=['FAKE_UNIT_SECRET'];}]) {
    const bad=structuredClone(report);change(bad);assert.throws(()=>smokePreflightCounts(bad,discovery));
  }
});

test('failed Playwright diagnostics expose known source locations and counts without raw errors or titles', () => {
  const report={suites:[{specs:[{file:'pos-cafe.spec.ts',line:119,title:'FAKE_UNIT_SECRET',tests:[{projectName:'desktop',results:[{
    status:'timedOut',errors:[{message:'Test timeout FAKE_UNIT_SECRET',stack:'/source/tests/smoke/helpers.ts:19:3'}]}]}]}]}],
    stats:{expected:0,unexpected:1,skipped:0,flaky:0}};
  const d=privateDiagnostics('[9/81] FAKE_UNIT_SECRET',report,['tests/smoke/pos-cafe.spec.ts','tests/smoke/helpers.ts'],'/source');
  assert.deepEqual(d.failedFiles,['tests/smoke/pos-cafe.spec.ts']);
  assert.equal(d.metrics.smokeUnexpected,1);assert.equal(d.metrics.smokeHelperLine,19);assert.equal(d.metrics.smokeTestLine,119);
  assert.equal(d.metrics.smokeFailureProjectOrdinal,1);assert.equal(d.metrics.smokeProgressIndex,9);
  assert.equal(JSON.stringify(d).includes('FAKE_UNIT_SECRET'),false);
  const bad=structuredClone(report);bad.suites[0].specs[0].file='../private/FAKE_UNIT_SECRET';bad.stats.unexpected=-1;
  const safe=privateDiagnostics('',bad,[]);assert.deepEqual(safe.failedFiles,[]);assert.equal(safe.metrics.smokeUnexpected,undefined);
});

test('UI gate requires every target/viewport and rejects fresh or incomplete findings', () => {
  const cfg = { states: [{ name: 'floor' }], viewports: [{ name: 'tablet' }] };
  const output = ' ok   tablet floor 0 finding(s), 0 new\nno new UI anomalies';
  assert.equal(uiCounts(output, [], cfg).run, 1);
  assert.throws(() => uiCounts('no new UI anomalies', [], cfg));
  assert.throws(() => uiCounts(output, [{ known: false }], cfg));
});

test('public evidence excludes arbitrary binding/count/raw fields and incomplete phase sets fail', () => {
  const rows = PROJECT_PHASES.map(id => ({ id, status: 'PASS', elapsedMs: 1, exitCode: 0, invocationSHA: digest, reportSHA: digest,
    counts: { pass: 1, raw: 'FAKE_PRIVATE_TOKEN' } }));
  const result = publicSummary({ ...binding, raw: 'FAKE_PRIVATE_TOKEN' }, rows, { source: digest, lock: digest });
  assert.equal(result.overallStatus, 'PASS');
  assert.equal(JSON.stringify(result).includes('FAKE_PRIVATE_TOKEN'), false);
  assert.equal(publicSummary(binding, rows.slice(0, -1), { source: digest, lock: digest }).overallStatus, 'FAIL');
});

test('failed Vitest diagnostics retain known counters and source paths without raw messages or credentials', () => {
  const report = { numTotalTests: 2, numPassedTests: 1, numFailedTests: 1, numPendingTests: 0, success: false,
    secret: 'FAKE_PRIVATE_TOKEN', testResults: [{ name: '/source/src/a.test.ts', status: 'failed',
      failureMessage: 'AssertionError: FAKE_PRIVATE_TOKEN test \u001b[31mtimed\u001b[39m out' }, { name: '/private/FAKE_PRIVATE_TOKEN', status: 'failed' }] };
  const diagnostic = privateDiagnostics('FAKE_PRIVATE_TOKEN', report, ['src/a.test.ts'], '/source');
  assert.equal(diagnostic.metrics.numFailedTests, 1);
  assert.deepEqual(diagnostic.failedFiles, ['src/a.test.ts']);
  assert.ok(diagnostic.codes.includes('TEST_TIMEOUT'));
  assert.equal(JSON.stringify(diagnostic).includes('FAKE_PRIVATE_TOKEN'), false);
  const row = { id: 'install', status: 'FAIL', exitCode: 1, elapsedMs: 1, invocationSHA: digest, reportSHA: digest,
    diagnostic: { ...diagnostic, codes: [...diagnostic.codes, 'FAKE_PRIVATE_TOKEN'], metrics: { ...diagnostic.metrics, raw: 'FAKE_PRIVATE_TOKEN' } } };
  assert.equal(JSON.stringify(publicSummary(binding, [row], {source:digest,lock:digest})).includes('FAKE_PRIVATE_TOKEN'), false);
  assert.ok(privateDiagnostics('ERROR: Coverage for lines (89%) does not meet global threshold (90%)', null).codes.includes('COVERAGE_LINES'));
  const architectureReport = { testResults: [{ name: '/source/src/architectureBoundaries.test.ts', status: 'failed',
    assertionResults: [{status:'passed'}, {status:'failed', message:'FAKE_PRIVATE_TOKEN'}] }] };
  const precise = privateDiagnostics('', architectureReport, ['src/architectureBoundaries.test.ts'], '/source');
  assert.equal(precise.metrics.architectureAssertion, 2);
  assert.equal(JSON.stringify(precise).includes('FAKE_PRIVATE_TOKEN'), false);
  const passedText = {testResults:[{name:'/source/src/a.test.ts',status:'passed',assertionResults:[{status:'passed',failureMessages:['Test timed out FAKE_PRIVATE_TOKEN']}]}]};
  assert.equal(privateDiagnostics('',passedText,['src/a.test.ts'],'/source').codes.includes('TEST_TIMEOUT'), false);
});

test('fresh capture retains output privately; guard refusal stops dependent process and never echoes output', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pos-ci-test-'));
  const result = await capturedCommand(process.execPath, ['-e', 'process.stdout.write("FAKE_PRIVATE_TOKEN"); process.exit(7)'],
    { cwd: root, env: process.env, output: join(root, 'out'), guard() {} });
  assert.equal(result.exitCode, 7); assert.equal(readFileSync(join(root, 'out'), 'utf8'), 'FAKE_PRIVATE_TOKEN');
  await assert.rejects(capturedCommand(process.execPath, [], { cwd: root, env: {}, output: join(root, 'blocked'), guard() { throw new Error(); } }));
  writeFileSync(join(root, 'source'), 'before'); const initial = trackedFingerprint(root, ['source']);
  writeFileSync(join(root, 'source'), 'after'); assert.notEqual(trackedFingerprint(root, ['source']), initial);
});

test('light supervisor constrains descendants and passes no credential environment', () => {
  const args = lightService({ ...env, GITHUB_TOKEN: 'FAKE_PRIVATE_TOKEN' }, '/node', '/source', 1001);
  assert.ok(args.includes('--property=User=1001'));
  assert.equal(lightOwnerMatches(1001,1001),true);assert.equal(lightOwnerMatches(0,0),false);assert.equal(lightOwnerMatches(1001,1002),false);
  for(const uid of [0,-1,1.5,NaN,'1001','1001\nUser=0']) assert.throws(()=>lightService(env,'/node','/source',uid));
  assert.ok(args.includes('--property=KillMode=control-group'));
  assert.ok(args.includes('--property=MemorySwapMax=0'));
  assert.ok(args.includes('--property=LimitCORE=0'));
  assert.equal(coreLimitDisabled('Max core file size        0        0        bytes\n'), true);
  assert.equal(coreLimitDisabled('Max core file size        0        unlimited        bytes\n'), false);
  assert.equal(coreLimitDisabled('Max core file size        unlimited        unlimited        bytes\n'), false);
  assert.equal(args.join(' ').includes('FAKE_PRIVATE_TOKEN'), false);
});

test('allocation facts deduplicate overlapping roots and hardlinks without treating logical bytes as allocated bytes', () => {
  const root=mkdtempSync(join(tmpdir(),'pos-ci-owned-'));
  writeFileSync(join(root,'core.1'),Buffer.alloc(32));linkSync(join(root,'core.1'),join(root,'core.2'));
  const facts={},bytes=allocatedBytes([root,root],facts);
  assert.equal(facts.coreFileCount,1);
  assert.equal(facts.ownedBytesAtCheckpoint,bytes);
  assert.ok(facts.coreAllocatedBytes>=0&&facts.coreAllocatedBytes<=bytes);
  assert.equal(Object.values(facts).every(Number.isSafeInteger),true);
});

test('light npm loads two separate empty configs and ignores inherited credentials', () => {
  const root = mkdtempSync(join(tmpdir(), 'pos-ci-npm-'));
  const childEnv = lightEnvironment(root, { ...process.env, GITHUB_TOKEN: 'FAKE_PRIVATE_TOKEN', NPM_TOKEN: 'FAKE_PRIVATE_TOKEN' });
  assert.notEqual(childEnv.NPM_CONFIG_USERCONFIG, childEnv.NPM_CONFIG_GLOBALCONFIG);
  assert.equal(readFileSync(childEnv.NPM_CONFIG_USERCONFIG, 'utf8'), '');
  assert.equal(readFileSync(childEnv.NPM_CONFIG_GLOBALCONFIG, 'utf8'), '');
  const npm = [join(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(process.execPath, '..', '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')].find(existsSync);
  assert.ok(npm, 'npm bundled with the pinned Node runtime must exist');
  const version = execFileSync(process.execPath, [npm, '--version'], { env: childEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(version.trim(), /^\d+\.\d+\.\d+$/);
  assert.equal(JSON.stringify(childEnv).includes('FAKE_PRIVATE_TOKEN'), false);
});

test('checkout Git trusts only its exact directory and captures command errors', () => {
  const root = mkdtempSync(join(tmpdir(), 'pos-ci-git-'));
  assert.match(checkoutGit(root, ['init', '--quiet', '--initial-branch=main']), /^$/);
  assert.equal(checkoutGit(root, ['rev-parse', '--show-toplevel']).trim().replaceAll('\\', '/'), root.replaceAll('\\', '/'));
  assert.throws(() => checkoutGit(root, ['rev-parse', '--verify', 'missing']), error => Boolean(error.stderr?.length));
});

test('output overflow terminates the owned child and reusing an old capture cannot pass', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pos-ci-overflow-'));
  const output = join(root, 'out');
  const result = await capturedCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(2048)); setInterval(()=>{},1000)'],
    { cwd: root, env: process.env, output, guard() {}, maxBytes: 32, timeoutMs: 2000 });
  assert.equal(result.blocked, true);
  assert.equal(result.blockCode, 'OUTPUT_LIMIT');
  await assert.rejects(capturedCommand(process.execPath, [], { cwd: root, env: process.env, output, guard() {} }));
});

test('monitor failure and timeout remain distinct finite signals without reflecting arbitrary errors', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pos-ci-monitor-'));
  let calls = 0;
  const monitored = await capturedCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    cwd: root, env: process.env, output: join(root, 'monitor'), monitorMs: 20,
    guard() { if (++calls > 1) throw Object.assign(new Error('FAKE_PRIVATE_TOKEN'), { code: 'ENOENT' }); },
  });
  assert.equal(monitored.blocked, true); assert.equal(monitored.blockCode, 'GUARD_IO_ENOENT');
  assert.equal(JSON.stringify(monitored).includes('FAKE_PRIVATE_TOKEN'), false);
  const timeout = await capturedCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    cwd: root, env: process.env, output: join(root, 'timeout'), timeoutMs: 50, guard() {},
  });
  assert.equal(timeout.blockCode, 'COMMAND_TIMEOUT');
  for (const code of ['RESOURCE_FREE_SPACE', 'RESOURCE_OWNED_CAP', 'RESOURCE_CGROUP_DRIFT'])
    assert.equal(guardFailureCode({code}), code);
  assert.equal(guardFailureCode({code:'FAKE_PRIVATE_TOKEN',message:'FAKE_PRIVATE_TOKEN'}), 'GUARD_REFUSED');
  const row = { id:'install', status:'FAIL', exitCode:null, elapsedMs:1, invocationSHA:digest, reportSHA:null,
    diagnostic:{codes:['RESOURCE_FREE_SPACE','PROCESS_SIGTERM','FAKE_PRIVATE_TOKEN'],
      metrics:{minimumObservedFreeBytes:123,oomKills:1,raw:'FAKE_PRIVATE_TOKEN'},failedFiles:[]} };
  const safe = publicSummary(binding,[row],{source:digest,lock:digest});
  assert.deepEqual(safe.phases[0].diagnostic.codes,['RESOURCE_FREE_SPACE','PROCESS_SIGTERM']);
  assert.equal(safe.phases[0].diagnostic.metrics.oomKills,1);
  assert.equal(JSON.stringify(safe).includes('FAKE_PRIVATE_TOKEN'),false);
});

test('backend manual guard requires confirmation, immutable workflow/source and exact allowed repositories', () => {
  assert.ok(backendInvocation({ ...env, GITHUB_EVENT_NAME: 'workflow_dispatch', CI1_CONFIRMATION: 'RUN_SYNTHETIC_PILOT' }, '/node', '/source').argv.includes('CI1_EXECUTION_AUTHORIZED=yes'));
  assert.throws(() => backendInvocation({ ...env, CI1_CONFIRMATION: 'RUN_SYNTHETIC_PILOT' }, '/node', '/source'));
  assert.equal(ci1TrustedRepository(env.GITHUB_REPOSITORY), true);
  assert.equal(ci1TrustedRepository('nguyentronglinh045/pos-cafe-ci-preflight'), true);
  assert.equal(ci1TrustedRepository('attacker/pos-cafe'), false);
});

test('CD rejects PR/fork/failing/wrong-attempt runs and checker changes even with the same source SHA', () => {
  const input = { sourceSHA: sha, runId: '123', attempt: 1 };
  const policy = { allowedSourceBranches: ['main'], trustedFiles: { 'ci.yml': hash('trusted') } };
  const run = { repository: { full_name: env.GITHUB_REPOSITORY, id:1263057386 }, head_repository: { full_name: env.GITHUB_REPOSITORY, id:1263057386 },
    id: 123, run_attempt: 1, head_sha: sha, event: 'push', status: 'completed', conclusion: 'success', path: '.github/workflows/ci.yml', head_branch: 'main' };
  assert.equal(verifyReleaseRun(run, input, policy), true);
  for (const delta of [{ event: 'pull_request' }, { conclusion: 'failure' }, { run_attempt: 2 }, { head_repository: { full_name: 'attacker/fork' } }, { repository: {full_name:env.GITHUB_REPOSITORY,id:1} }]) {
    assert.throws(() => verifyReleaseRun({ ...run, ...delta }, input, policy));
  }
  assert.throws(() => verifyReleaseFiles({ 'ci.yml': Buffer.from('changed') }, policy));
});

test('CD requires the exact owner, branch restrictions and no admin bypass; production cannot be enabled by input/env', () => {
  const policy = { reviewers: ['nguyentronglinh045'] };
  const environment = { name: 'production', can_admins_bypass: false, deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
    protection_rules: [{ type: 'required_reviewers', prevent_self_review: false, reviewers: [{ type: 'User', reviewer: { login: 'nguyentronglinh045' } }] }] };
  assert.equal(verifyReleaseEnvironment(environment, [{ name: 'main', type: 'branch' }], policy), true);
  assert.equal(verifyReleaseEnvironment({ ...environment, name: 'Production' }, [{ name: 'main', type: 'branch' }], policy), true);
  assert.throws(() => verifyReleaseEnvironment({ ...environment, name: 'Preview' }, [{ name: 'main', type: 'branch' }], policy));
  assert.throws(() => verifyReleaseEnvironment({ ...environment, can_admins_bypass: true }, [{ name: 'main', type: 'branch' }], policy));
  assert.throws(() => verifyReleaseEnvironment(environment, [{ name: '*', type: 'branch' }], policy));
  assert.equal(PRODUCTION_ENABLED, false);
  assert.throws(() => productionCommands({ enable: true, VERCEL_TOKEN: 'FAKE_PRIVATE_TOKEN' }));
});

test('CD verifies canonical Git bytes across CRLF checkouts and rejects detector/fixture drift', () => {
  const root = mkdtempSync(join(tmpdir(), 'pos-ci-canonical-'));
  checkoutGit(root, ['init', '--quiet', '--initial-branch=main']);
  writeFileSync(join(root, 'checker.txt'), 'checker\r\nfixture\r\n');
  const blob = checkoutGit(root, ['-c', 'core.autocrlf=true', 'hash-object', '-w', '--path=checker.txt', 'checker.txt']).trim();
  const canonical = execFileSync('git', ['-C', root, 'cat-file', 'blob', blob], { stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(canonical.toString(), 'checker\nfixture\n');
  const policy = { trustedFiles: { 'ui-audit/audit.js': hash(canonical), 'ui-audit/demo-buggy.html': hash(canonical) } };
  const files = Object.fromEntries(Object.keys(policy.trustedFiles).map(path => [path, canonical]));
  assert.equal(verifyReleaseFiles(files, policy), true);
  for (const path of Object.keys(files)) assert.throws(() => verifyReleaseFiles({ ...files, [path]: Buffer.from('changed') }, policy));
  assert.throws(() => verifyReleaseFiles(Object.fromEntries(Object.keys(files).map(path => [path, readFileSync(join(root, 'checker.txt'))])), policy));
});
