import { describe, expect, test } from 'vitest';
import { assertReleaseExecutionRole } from '../../scripts/permission-release-cutover.mjs';

const values = {
  'supautils.privileged_role': 'supabase_privileged_role',
  'supautils.privileged_role_allowed_configs': 'pgrst.*',
  'supautils.reserved_roles': 'authenticator*',
  'supautils.policy_grants': '{"postgres":["storage.objects"]}',
};
const profile = () => ({ role: 'postgres', superuser: false, bypass_rls: true, can_alter_roles: true,
  can_set_pgrst_hook: false, can_manage_storage_objects: false, storage_objects_owner: 'supabase_storage_admin',
  shared_preload: '', session_preload: 'supautils', provider_role_usable: true,
  provider_settings: Object.entries(values).map(([name, setting]) => ({ name, setting, context: 'sighup',
    source: 'configuration file', pending_restart: false })),
});
type Row = ReturnType<typeof profile>;
const config = { executionRole: 'postgres' };
async function run(row: Row | undefined, code?: string) {
  const queries: string[] = [];
  const db = { query: async (sql: string) => { queries.push(sql); return { rows: row ? [row] : [] }; } };
  const result = assertReleaseExecutionRole(db as any, config as any);
  if (code) await expect(result).rejects.toMatchObject({ code });
  else await expect(result).resolves.toBeUndefined();
  expect(queries).toHaveLength(1);
  expect(queries[0].trim().startsWith('select ')).toBe(true);
  expect(queries[0]).toContain('from pg_settings');
  expect(queries[0]).toContain("pg_has_role(current_user,p.oid,'USAGE')");
}
const hookError = 'PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED';
const policyError = 'STORAGE_OBJECTS_OWNERSHIP_REQUIRED';
const change = (row: Row, name: string, setting: string) => {
  row.provider_settings.find(item => item.name === name)!.setting = setting;
  return row;
};

describe('permission provider capability guard — conservative, read-only catalog preflight', () => {
  test.each([
    ['wrong actor', { role: 'another_actor' }, 'PRODUCTION_EQUIVALENT_ROLE_REQUIRED'],
    ['superuser', { superuser: true }, 'PRODUCTION_EQUIVALENT_ROLE_REQUIRED'],
    ['no bypass', { bypass_rls: false }, 'PRODUCTION_EQUIVALENT_ROLE_REQUIRED'],
    ['no createrole', { can_alter_roles: false }, 'ALTER_ROLE_PRIVILEGE_REQUIRED'],
  ])('preserves actor invariant: %s', async (_name, fields, code) => run({ ...profile(), ...fields } as Row, code as string));
  test('rejects absent actor', () => run(undefined, 'PRODUCTION_EQUIVALENT_ROLE_REQUIRED'));
  test('accepts native rights without a provider', () => run({ ...profile(), can_set_pgrst_hook: true,
    can_manage_storage_objects: true, session_preload: '', provider_settings: [] }));
  test.each([[false, false], [true, false], [false, true]])('accepts provider with native hook=%s policy=%s',
    (hook, policy) => run({ ...profile(), can_set_pgrst_hook: hook, can_manage_storage_objects: policy }));
  test.each([[true, false, policyError], [false, true, hookError]])('rejects incomplete provider with native hook=%s policy=%s',
    (hook, policy, code) => run({ ...profile(), can_set_pgrst_hook: hook as boolean,
      can_manage_storage_objects: policy as boolean, session_preload: '' }, code as string));
  test('keeps the native path with malformed provider JSON', () => run(change({ ...profile(), can_set_pgrst_hook: true,
    can_manage_storage_objects: true }, 'supautils.policy_grants', '{')));
  test('requires actual preload and effective inherited membership', async () => {
    await run({ ...profile(), session_preload: '' }, hookError);
    await run({ ...profile(), provider_role_usable: false }, hookError);
    await run(change(profile(), 'supautils.privileged_role', 'another_role'), hookError);
  });
  test('accepts supported whitespace and exact config token', () => run(change(change({ ...profile(), session_preload: ' supautils ' },
    'supautils.privileged_role_allowed_configs', ' pgrst.db_pre_request , log_duration '), 'supautils.reserved_roles', ' anon*, authenticator* ')));
  test('accepts a shared preload and trusted command-line config', () => run({ ...profile(), shared_preload: 'supautils', session_preload: '',
    provider_settings: profile().provider_settings.map(row => ({ ...row, source: 'command line' })) }));
  for (const name of Object.keys(values)) {
    test(`rejects missing/duplicate registered GUC ${name}`, async () => {
      await run({ ...profile(), provider_settings: profile().provider_settings.filter(row => row.name !== name) }, hookError);
      const row = profile(); row.provider_settings = row.provider_settings.map(item => item.name === name ? row.provider_settings[0] : item);
      if (name === row.provider_settings[0].name) row.provider_settings[0] = row.provider_settings[1];
      await run(row, hookError);
    });
    test.each([{ context: 'user' }, { source: 'session' }, { pending_restart: true }])(`rejects untrusted GUC ${name}: %o`, async fields => {
      const row = profile(); Object.assign(row.provider_settings.find(item => item.name === name)!, fields); await run(row, hookError);
    });
  }
  test.each(['log_duration', 'pgrstx.*'])('rejects wrong config whitelist %s', value => run(change(profile(), 'supautils.privileged_role_allowed_configs', value), hookError));
  test.each(['authenticator', 'authenticator_extra*'])('rejects reserved role token %s', value => run(change(profile(), 'supautils.reserved_roles', value), hookError));
  test.each(['{', 'null', '[]', '{"other_role":["storage.objects"]}', '{"postgres":"storage.objects"}',
    '{"postgres":["storage.objects_extra"]}', '{"postgres":[null,"storage.objects"]}'])('rejects wrong policy JSON %s',
    value => run(change(profile(), 'supautils.policy_grants', value), hookError));
  test('DML privileges and qualified lookalikes cannot replace policy capability', () => run({
    ...change(profile(), 'supautils.policy_grants', '{"postgres":["public.storage.objects"]}'), can_set_pgrst_hook: true,
    storage_objects_select: true, storage_objects_insert: true, storage_objects_update: true, storage_objects_delete: true,
  } as Row, policyError));
});
