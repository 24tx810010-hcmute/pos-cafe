import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureExecutionProfile, collectVerifiedExecution, emitExecutionAttestation } from '../../scripts/permission-execution-evidence.mjs';

const directories:string[]=[];
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
function fixture(){const dir=mkdtempSync(join(process.cwd(),'.execution-evidence-'));directories.push(dir);const paths:any={};
  for(const name of ['discovery','results','options']){paths[name]=join(dir,`${name}.json`);writeFileSync(paths[name],JSON.stringify({name}));}
  return {dir,paths};}
afterEach(()=>directories.splice(0).forEach(dir=>rmSync(dir,{recursive:true,force:true})));

describe('permission execution evidence',()=>{
  it('records unit/static backend as not applicable without calling a database observer',async()=>{
    const observer={observe:vi.fn()};
    await expect(captureExecutionProfile({profile:'candidate',stage:'candidate-unit',executionKind:'unit',configId:'unit-v1',observer:undefined})).resolves.toEqual({profile:'candidate',stage:'candidate-unit',executionKind:'unit',configId:'unit-v1',backend:{applicable:false}});
    await expect(captureExecutionProfile({profile:'candidate',stage:'candidate-unit',executionKind:'unit',configId:'unit-v1',observer})).rejects.toThrow('EVIDENCE_UNIT_OBSERVER_FORBIDDEN');
    expect(observer.observe).not.toHaveBeenCalled();
  });
  it('captures service identity and hashes the stage artifacts from an injected observer',async()=>{
    const f=fixture(),ddl=join(f.dir,'candidate.sql');writeFileSync(ddl,'select 1;');
    const observer={observe:vi.fn().mockResolvedValue({backend:{reference:'stack-1',host:'127.0.0.1',port:54321,database:'postgres',engine:'postgresql-17'},fixtureIds:['store-1'],markerProof:'a'.repeat(64),catalogHash:'b'.repeat(64),schemaHash:'c'.repeat(64),apiBinding:{verified:true,baseUrl:'http://127.0.0.1:54321',projectRef:'local'}})};
    const profile=await captureExecutionProfile({profile:'candidate',stage:'candidate-images-service',executionKind:'service',configId:'images-v1',observer,appliedArtifacts:[{id:'permission-images',path:ddl}]});
    expect(profile).toMatchObject({backend:{reference:'stack-1',port:54321},appliedArtifacts:[{id:'permission-images',hash:hash(ddl)}],apiBinding:{projectRef:'local'}});
    expect(observer.observe).toHaveBeenCalledOnce();
  });
  it('fails closed for an unverified API binding instead of converting DB metadata into service proof',async()=>{
    const f=fixture(),ddl=join(f.dir,'candidate.sql');writeFileSync(ddl,'select 1;');
    const observer={observe:vi.fn().mockResolvedValue({apiBinding:{verified:false}})};
    await expect(captureExecutionProfile({profile:'candidate',stage:'candidate-images-service',executionKind:'service',configId:'images-v1',observer,appliedArtifacts:[{id:'images',path:ddl}]})).rejects.toThrow('EVIDENCE_API_BINDING_UNVERIFIED');
  });
  it('collects only a current, byte-bound report and runner-issued attestation',async()=>{
    const f=fixture(),source='a'.repeat(64),profile={profile:'candidate',stage:'candidate-unit',executionKind:'unit',configId:'unit-v1',backend:{applicable:false}};
    const attestationPath=join(f.dir,'attestation.json');emitExecutionAttestation({runId:'run-1',sourceFingerprint:source,executionProfile:profile,startedAt:'2026-09-17T00:00:00Z',finishedAt:'2026-09-17T00:00:01Z',artifactPaths:f.paths,outputPath:attestationPath});
    const reportPath=join(f.dir,'report.json');writeFileSync(reportPath,JSON.stringify({schemaVersion:'permission-execution-report-v1',valid:true,exitCode:0,runId:'run-1',sourceFingerprint:source,profile:'candidate',stage:'candidate-unit',executionKind:'unit',runner:'vitest',artifacts:Object.fromEntries(Object.entries(f.paths).map(([name,path])=>[name,{path,sha256:hash(path as string)}])),attestation:{path:attestationPath,sha256:hash(attestationPath)}}));
    expect(collectVerifiedExecution({reportPath,attestationPath,currentSourceFingerprint:source})).toMatchObject({id:'run-1',stage:'candidate-unit',serviceBinding:profile});
    writeFileSync(f.paths.results,JSON.stringify({forged:true}));
    expect(()=>collectVerifiedExecution({reportPath,attestationPath,currentSourceFingerprint:source})).toThrow('EVIDENCE_RESULTS_BYTE_HASH_MISMATCH');
  });
  it('rejects legacy reports and source drift instead of upgrading historical evidence',()=>{
    const f=fixture(),reportPath=join(f.dir,'report.json'),attestationPath=join(f.dir,'attestation.json');
    writeFileSync(reportPath,JSON.stringify({valid:true}));writeFileSync(attestationPath,JSON.stringify({}));
    expect(()=>collectVerifiedExecution({reportPath,attestationPath,currentSourceFingerprint:'a'.repeat(64)})).toThrow('EVIDENCE_REPORT_INVALID');
  });
});
