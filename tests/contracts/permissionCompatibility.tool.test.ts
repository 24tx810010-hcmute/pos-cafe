import { describe,expect,test,vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ACTIVATION_SQL_ORDER } from '../../scripts/permission-activation-bundle.mjs';
import { classifyPreRequestSetting,prepareCompatibilityHook,restoreCompatibilityPreparation,verifyCompatibilityRestRouting } from '../../scripts/permission-compatibility-prepare.mjs';

describe('PERM-30 Data API compatibility preparation',()=>{
 test('refuses an existing unrelated or ambiguous PostgREST hook',()=>{
  expect(()=>classifyPreRequestSetting([{value:'private.other_hook'}])).toThrow('UNEXPECTED_DB_PRE_REQUEST');
  expect(()=>classifyPreRequestSetting([{value:'public.permission_contract_pre_request'},{value:'private.other'}])).toThrow('UNEXPECTED_DB_PRE_REQUEST');
 });
 test('installs only from an absent setting and requires a REST routing probe',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{value:'public.permission_contract_pre_request'}]});
  await expect(prepareCompatibilityHook({query} as never)).resolves.toEqual({status:'PREPARED',installedByCaller:true,requiresRestProbe:true});
  expect(query).toHaveBeenCalledTimes(3);expect(String(query.mock.calls[1][0])).toContain('permission_contract_gate');
 });
 test('proves PostgREST routing and restores a hook installed by this lifecycle',async()=>{
  const fetchImpl=vi.fn().mockResolvedValue({ok:true,headers:new Headers({'x-pos-permission-hook':'pass-through'})});
  await expect(verifyCompatibilityRestRouting({restUrl:'http://127.0.0.1:54321/rest/v1/',anonKey:'test',fetchImpl})).resolves.toBe(true);
  expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:54321/rest/v1/rpc/permission_contract_probe',expect.objectContaining({method:'POST'}));
  const query=vi.fn().mockResolvedValueOnce({rows:[{value:'public.permission_contract_pre_request'}]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]});
  await expect(restoreCompatibilityPreparation({query} as never,{installedByCaller:true})).resolves.toEqual({status:'RESTORED'});
  expect(String(query.mock.calls[1][0])).toContain('alter role authenticator reset pgrst.db_pre_request');
 });
 test('keeps preparation pass-through and activation strict in the atomic bundle',()=>{
  const prepare=readFileSync('supabase/candidate/permission-compatibility-prepare.sql','utf8');
  const activate=readFileSync('supabase/candidate/permission-compatibility-activate.sql','utf8');
  expect(prepare).toContain('strict boolean not null default false');
  expect(activate).toContain('set strict=true');
  expect(ACTIVATION_SQL_ORDER.at(-1)).toBe('supabase/candidate/permission-compatibility-activate.sql');
 });
 test('fixture reset restores the global role setting before dropping hook objects',()=>{
  const reset=readFileSync('scripts/permission-reset-fixture.mjs','utf8');
  expect(reset).toContain('RESET_UNEXPECTED_DB_PRE_REQUEST');
  expect(reset.indexOf('alter role authenticator reset pgrst.db_pre_request')).toBeLessThan(reset.indexOf('drop schema public cascade'));
 });
 test('guards anon/authenticated Data API calls, preserves metadata and emits the typed upgrade error',()=>{
  const sql=readFileSync('supabase/candidate/permission-compatibility-prepare.sql','utf8');
  expect(sql).toContain("request_role not in ('anon','authenticated')");
  expect(sql).toContain("current_setting('request.jwt.claims',true)");
  expect(sql).toContain("path='/rpc/permission_get_contract'");
  expect(sql).toContain("headers->>'x-pos-permission-contract'");
  expect(sql).toContain('if strict_mode=false then return');
  expect(sql).toContain('WRITE_PROTOCOL_UNSUPPORTED');expect(sql).toContain('"status":426');
 });
});
