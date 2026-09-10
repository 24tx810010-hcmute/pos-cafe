import { describe, expect, test } from 'vitest';
import { assertManifest, caseCatalog, requiredExecutions } from './caseManifest.ts';
import { checkDiscovery, checkResults, readPlaywrightTests, readVitestTests } from './resultVerifier.ts';
import { parseTestEnvironment, PreflightError } from './preflight.ts';

// These checks verify the harness. They do not stand in for DB-positive or mutation executions in TC 087/088.
const required = [{ name: 'TC-IDEM-014/db', backend: 'db' as const }];
const onePass = { name: 'TC-IDEM-014/db creates exactly one order', backend: 'db', file: '/tests/contracts/writeOperations.contract.test.ts', status: 'passed' };
const unsignedFixtureJwt = (claims: object) => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.fixture_signature_only`;
const environment = (): NodeJS.ProcessEnv => ({
  VITE_DATA_MODE:'supabase', VITE_SUPABASE_URL:'http://127.0.0.1:55440',
  VITE_SUPABASE_ANON_KEY:unsignedFixtureJwt({role:'anon'}),
  IDEM_STORE_JWT:unsignedFixtureJwt({role:'authenticated',sub:'00000000-0000-4000-8000-000000000001',exp:Date.now()/1000+3600}),
  IDEM_OBSERVER_DSN:'postgresql://observer@127.0.0.1:55439/pos_cafe_idem_test_unit',
  IDEM_TEST_MARKER:'pos-cafe-idem-1234567890abcdef',IDEM_TEST_ENGINE:'postgres-postgrest',
  IDEM_FIXTURE_STORE_IDS:'00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000002',
});

test('Manifest contains 93 distinct approved oracles and each parameterized requirement', () => {
  assertManifest(); expect(caseCatalog).toHaveLength(93);
  expect(requiredExecutions.filter((entry) => entry.id==='TC-IDEM-006')).toHaveLength(102);
  expect(requiredExecutions.some((entry)=>entry.name==='TC-IDEM-062/db/validation_session_expiry')).toBe(true);
});

describe('Discovery and execution gates reject incomplete evidence', () => {
  test('moving the required test outside discovery cannot pass', () => expect(checkDiscovery([],required).valid).toBe(false));
  test('complete discovered names are not behavior passes', () => {
    expect(checkDiscovery([onePass],required).valid).toBe(true);
    expect(checkResults([{...onePass,status:'notrun'}],required).valid).toBe(false);
  });
  test.each(['skipped','pending','todo','failed','timedOut','unexecuted'])('%s is never a required pass', (status) => expect(checkResults([{...onePass,status}],required).valid).toBe(false));
  test('mock results cannot satisfy DB requirements', () => expect(checkResults([{...onePass,backend:'mock'}],required).valid).toBe(false));
  test('duplicate executions do not silently replace a failure', () => expect(checkResults([{...onePass,status:'failed'},onePass],required).valid).toBe(false));
  test('a unit test cannot claim DB provenance by putting /db in its title', () => {
    const report={testResults:[{name:'/src/core/fake.test.ts',assertionResults:[{fullName:onePass.name,status:'passed'}]}]};
    expect(checkResults(readVitestTests(report),required).valid).toBe(false);
  });
  test('literal matching excludes a testcase with only a common prefix', () => expect(checkDiscovery([{...onePass,name:'TC-IDEM-014/db/other'}],required).valid).toBe(false));
  test('a valid single pass satisfies only the requested execution', () => expect(checkResults([onePass],required).valid).toBe(true));
  test('a Playwright expected failure cannot be represented as a passing requirement', () => {
    const report={suites:[{file:'a.ts',specs:[{title:'TC-IDEM-014/e2e',tests:[{expectedStatus:'failed',results:[{status:'failed'}]}]}]}]};
    expect(readPlaywrightTests(report)[0].status).toBe('failed');
  });
});

describe('Configuration gate rejects remote and ambiguous fixtures before connecting', () => {
  test.each(['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','IDEM_OBSERVER_DSN','IDEM_STORE_JWT','IDEM_TEST_MARKER','IDEM_FIXTURE_STORE_IDS'])('missing %s fails without printing values', (key) => {
    const env=environment(); delete env[key];
    expect(()=>parseTestEnvironment(env)).toThrow(PreflightError);
  });
  test('mock mode is rejected',()=>expect(()=>parseTestEnvironment({...environment(),VITE_DATA_MODE:'mock'})).toThrow('VITE_DATA_MODE_MUST_BE_SUPABASE'));
  test('remote URL fails without printing a credential embedded in it',()=> {
    expect(()=>parseTestEnvironment({...environment(),VITE_SUPABASE_URL:'https://secret-user:secret-password@example.com'})).toThrow('NONLOCAL_VITE_SUPABASE_URL_REFUSED');
  });
  test('remote observer and a local non-test database are rejected',()=> {
    expect(()=>parseTestEnvironment({...environment(),IDEM_OBSERVER_DSN:'postgres://secret:password@example.com/postgres'})).toThrow('NONLOCAL_IDEM_OBSERVER_DSN_REFUSED');
    expect(()=>parseTestEnvironment({...environment(),IDEM_OBSERVER_DSN:'postgres://observer@localhost/postgres'})).toThrow('DATABASE_NAME_IS_NOT_ISOLATED');
  });
  test('service-role cannot act as the business caller',()=>expect(()=>parseTestEnvironment({...environment(),IDEM_STORE_JWT:unsignedFixtureJwt({role:'service_role'})})).toThrow('STORE_JWT_MUST_BE_AUTHENTICATED'));
  test('expired store JWT cannot reach the suite',()=>expect(()=>parseTestEnvironment({...environment(),IDEM_STORE_JWT:unsignedFixtureJwt({role:'authenticated',sub:'00000000-0000-4000-8000-000000000001',exp:1})})).toThrow('STORE_JWT_EXPIRED'));
  test('local complete config passes syntax validation, which is not a DB preflight pass',()=>expect(parseTestEnvironment(environment()).engine).toBe('postgres-postgrest'));
});
