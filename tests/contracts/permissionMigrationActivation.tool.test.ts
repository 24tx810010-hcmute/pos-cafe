import { afterEach, describe, expect, test, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACTIVATION_SQL_ORDER, activationBundleManifest, assertActivationEligibility } from '../../scripts/permission-activation-bundle.mjs';
import { parseReleaseTargetConfig, readReleaseMappings, buildReleaseReview } from '../../scripts/permission-release-preflight.mjs';
import { stripTopLevelTransactions, validateActivationConfig } from '../../scripts/permission-activate.mjs';

afterEach(() => vi.restoreAllMocks());
describe('T16 activation package and release preflight target binding', () => {
  test('packages every candidate once in dependency order with immutable hashes', () => {
    expect(ACTIVATION_SQL_ORDER).toEqual([
      'supabase/migrations/017_permission_catalog_bridge.sql','supabase/candidate/permission-identity.sql',
      'supabase/candidate/permission-administration.sql','supabase/candidate/permission-financial.sql',
      'supabase/candidate/permission-read.sql','supabase/candidate/permission-changes.sql','supabase/candidate/permission-images.sql',
      'supabase/candidate/permission-signals.sql','supabase/candidate/permission-print.sql','supabase/candidate/permission-seed.sql',
      'supabase/candidate/permission-compatibility-activate.sql']);
    const manifest=activationBundleManifest(); expect(manifest.atomic).toBe(true); expect(manifest.transactionBoundary).toContain('single-transaction');
    expect(manifest.isolation).toEqual({mapped:'serializable',explicitEmpty:'read committed'});
    expect(manifest.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)&&file.bytes>0)).toBe(true);
  });
  test('locked recheck rejects review, source drift, incomplete and stale mappings', () => {
    const hash='a'.repeat(64),preflight={status:'READY',safety:{before:{hash}},stores:[{storeId:'s1',status:'READY',candidateOwnerId:'e1'}]};
    expect(assertActivationEligibility({preflight,mappings:[{storeId:'s1',ownerId:'e1',sourceSnapshotHash:hash}],sourceFingerprint:hash,expectedSourceFingerprint:hash})).toBe(true);
    expect(()=>assertActivationEligibility({preflight:{...preflight,status:'BLOCKED'},mappings:[],sourceFingerprint:hash,expectedSourceFingerprint:hash})).toThrow('OWNER_MIGRATION_REVIEW_REQUIRED');
    expect(()=>assertActivationEligibility({preflight,mappings:[],sourceFingerprint:hash,expectedSourceFingerprint:hash})).toThrow('MAPPING_SET_INCOMPLETE');
    expect(()=>assertActivationEligibility({preflight,mappings:[{storeId:'s1',ownerId:'e1',sourceSnapshotHash:'b'.repeat(64)}],sourceFingerprint:hash,expectedSourceFingerprint:hash})).toThrow('LOCKED_MAPPING_RECHECK_FAILED');
  });
  test('requires explicit strict target config and never accepts env files as target config', () => {
    const dir=mkdtempSync(join(tmpdir(),'perm-t16-')),env=join(dir,'target.env'),mapping=join(dir,'mapping.json'),config=join(dir,'target.json');
    writeFileSync(env,'');writeFileSync(mapping,'{}');writeFileSync(config,JSON.stringify({schemaVersion:1,mode:'release-read-only-preflight',connectionString:'postgresql://reader@db.example/db',projectRef:'project-x',backendHost:'db.example',database:'db',storeIds:['10000000-0000-4000-8000-000000000001'],catalogHash:'b'.repeat(64),sourceFingerprint:'a'.repeat(64),bundleHash:'c'.repeat(64),mappingFiles:[mapping]}));
    expect(parseReleaseTargetConfig(config)).toMatchObject({projectRef:'project-x',mappingFiles:[mapping]});
    expect(()=>parseReleaseTargetConfig()).toThrow('EXPLICIT_TARGET_CONFIG_REQUIRED');
    expect(()=>parseReleaseTargetConfig(join(dir,'.env.local'))).toThrow('APPLICATION_ENV_REFUSED');
    writeFileSync(config,JSON.stringify({schemaVersion:1,mode:'release-read-only-preflight',connectionString:'postgresql://reader@db.example/db',projectRef:'project-x',backendHost:'db.example',database:'db',storeIds:['10000000-0000-4000-8000-000000000001'],catalogHash:'b'.repeat(64),sourceFingerprint:'a'.repeat(64),mappingFiles:[mapping],fallback:'live'}));
    expect(()=>parseReleaseTargetConfig(config)).toThrow('INVALID_TARGET_CONFIG');
  });
  test('strips only top-level transaction wrappers after comments and preserves PL/pgSQL bodies',()=>{
    const sql=`-- header\nBEGIN;\ncreate function x() returns void language plpgsql as $$ begin perform 1; end $$;\nCOMMIT;`;
    const body=stripTopLevelTransactions(sql);expect(body).not.toMatch(/\nBEGIN;/);expect(body).not.toMatch(/COMMIT;/);expect(body).toContain('$$ begin perform 1; end $$');
    expect(()=>stripTopLevelTransactions('begin; savepoint unsafe; commit;')).toThrow('NESTED_TRANSACTION_COMMAND_REFUSED');
  });
  test('validates imported activation callers, not only CLI main',()=>{
    expect(()=>validateActivationConfig({})).toThrow('INVALID_ACTIVATION_CONFIG');
  });
  test('release review requires bound human mapping and rejects synthetic proof or wrong target', () => {
    const dir=mkdtempSync(join(tmpdir(),'perm-live-review-')),file=join(dir,'mapping.json');
    const sid='10000000-0000-4000-8000-000000000001',eid='20000000-0000-4000-8000-000000000001',snapshot='d'.repeat(64);
    const binding={projectRef:'project-x',backendHost:'db.example',database:'db',sourceFingerprint:'a'.repeat(64),bundleHash:'c'.repeat(64)};
    const target={...binding,catalogHash:'b'.repeat(64),mappingFiles:[file]};
    const mapping={schemaVersion:1,storeId:sid,ownerId:eid,verifiedByRef:'release:operator:case-1',evidenceRefs:['release:case:1'],sourceSnapshotHash:snapshot};
    const envelope={schemaVersion:1,kind:'release-owner-mapping',binding,mapping};
    writeFileSync(file,JSON.stringify(envelope));expect(readReleaseMappings(target)).toEqual([mapping]);
    for (const value of [mapping,{...envelope,binding:{...binding,projectRef:'wrong-project'}},{...envelope,binding:{...binding,bundleHash:'e'.repeat(64)}},{...envelope,mapping:{...mapping,verifiedByRef:'synthetic:operator'}}]) {
      writeFileSync(file,JSON.stringify(value));expect(()=>readReleaseMappings(target)).toThrow('INVALID_RELEASE_MAPPING');
    }
    const stores=[{id:sid,name:'Store'}],employees=[{id:eid,storeId:sid,name:'Owner candidate',role:'admin',isActive:true,createdAt:'2026-01-01T00:00:00Z',permissionOverrides:null}];
    expect(buildReleaseReview(target,stores,employees,snapshot,[])).toMatchObject({status:'NEEDS_REVIEW',missingMappingStoreIds:[sid],humanIdentityVerifiedByTool:false});
    expect(buildReleaseReview(target,stores,employees,snapshot,[mapping])).toMatchObject({status:'READY',missingMappingStoreIds:[],humanIdentityVerifiedByTool:false});
    const stale=buildReleaseReview(target,stores,employees,'e'.repeat(64),[mapping]);
    expect(stale.status).toBe('NEEDS_REVIEW');expect(stale.stores[0].blockers).toContainEqual(expect.objectContaining({reason:'STALE_MAPPING'}));
  });
  test('release discovery accepts no mapping yet but never guesses a different project or database', () => {
    const dir=mkdtempSync(join(tmpdir(),'perm-release-config-')),file=join(dir,'target.json');
    const config={schemaVersion:1,mode:'release-read-only-preflight',connectionString:'postgresql://reader@db.projectx.supabase.co/postgres',projectRef:'projectx',backendHost:'db.projectx.supabase.co',database:'postgres',storeIds:['10000000-0000-4000-8000-000000000001'],catalogHash:'b'.repeat(64),sourceFingerprint:'a'.repeat(64),bundleHash:'c'.repeat(64),mappingFiles:[]};
    writeFileSync(file,JSON.stringify(config));expect(parseReleaseTargetConfig(file).mappingFiles).toEqual([]);
    for (const patch of [{projectRef:'projecty'},{database:'wrong'},{connectionString:'https://reader@db.projectx.supabase.co/postgres'},{connectionString:'postgresql://postgres.projecty@aws-0.pooler.supabase.com/postgres',backendHost:'aws-0.pooler.supabase.com'},
      ...['?host=other.invalid','?user=other','?port=9999','?options=unsafe','#fragment','?sslmode=require&sslmode=disable'].map(suffix=>({connectionString:config.connectionString+suffix}))]) {
      writeFileSync(file,JSON.stringify({...config,...patch}));expect(()=>parseReleaseTargetConfig(file)).toThrow('TARGET_BINDING_MISMATCH');
    }
    writeFileSync(file,JSON.stringify({...config,connectionString:config.connectionString+'?sslmode=require'}));
    expect(parseReleaseTargetConfig(file).projectRef).toBe('projectx');
    const local={schemaVersion:1,mode:'synthetic-activation',connectionString:'postgresql://tester@127.0.0.1/postgres',database:'postgres',marker:'isolated',storeIds:config.storeIds,sourceFingerprint:config.sourceFingerprint,bundleHash:config.bundleHash,mappingFiles:['mapping.json']};
    expect(validateActivationConfig(local).database).toBe('postgres');
    for (const suffix of ['?host=other.invalid','?user=other','?port=9999','?options=unsafe','#fragment']) {
      expect(()=>validateActivationConfig({...local,connectionString:local.connectionString+suffix})).toThrow('INVALID_ACTIVATION_CONFIG');
    }
  });
});
