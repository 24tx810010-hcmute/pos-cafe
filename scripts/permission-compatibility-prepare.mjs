import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const EXPECTED_PRE_REQUEST = 'public.permission_contract_pre_request';
export const PREPARE_SQL_PATH = 'supabase/candidate/permission-compatibility-prepare.sql';

export function classifyPreRequestSetting(rows) {
  const values = rows.map(row => row.value).filter(value => value != null && value !== '');
  if (values.length > 1 || values.some(value => value !== EXPECTED_PRE_REQUEST))
    throw new Error('UNEXPECTED_DB_PRE_REQUEST');
  return values.length === 1 ? 'PREPARED' : 'ABSENT';
}

export async function inspectCompatibilityPreparation(db) {
  const result = await db.query(`select split_part(setting,'=',2) value
    from pg_db_role_setting s join pg_roles r on r.oid=s.setrole,
    lateral unnest(s.setconfig) setting
    where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%'`);
  return classifyPreRequestSetting(result.rows);
}

export async function prepareCompatibilityHook(db, root = process.cwd()) {
  const state = await inspectCompatibilityPreparation(db);
  // Recreate the owned objects even when the expected role setting is already
  // present; a matching setting alone does not prove the function/table body.
  await db.query(readFileSync(resolve(root, PREPARE_SQL_PATH), 'utf8'));
  const verified = await inspectCompatibilityPreparation(db);
  if (verified !== 'PREPARED') throw new Error('PERMISSION_CONTRACT_HOOK_NOT_PREPARED');
  return { status: verified, installedByCaller: state === 'ABSENT', requiresRestProbe: true };
}

export async function verifyCompatibilityRestRouting({ restUrl, anonKey, fetchImpl = fetch }) {
  if (typeof restUrl !== 'string' || !restUrl.startsWith('http') || typeof anonKey !== 'string' || !anonKey)
    throw new Error('INVALID_COMPATIBILITY_REST_PROBE');
  let observed;
  for(let attempt=0;attempt<20;attempt++) {
    const response = await fetchImpl(`${restUrl.replace(/\/$/,'')}/rpc/permission_contract_probe`, {
      method: 'POST', headers: { apikey: anonKey, 'content-type': 'application/json' }, body: '{}',
      signal: AbortSignal.timeout(5_000),
    });
    observed={status:response.status,hook:response.headers.get('x-pos-permission-hook')};
    if (response.ok && observed.hook?.split(',').map(value=>value.trim()).includes('pass-through')) return true;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  const error=new Error('PERMISSION_CONTRACT_REST_ROUTING_UNVERIFIED');error.observed=observed;throw error;
}

export async function restoreCompatibilityPreparation(db, receipt) {
  if (!receipt?.installedByCaller) return { status: 'UNCHANGED' };
  if (await inspectCompatibilityPreparation(db) !== 'PREPARED') throw new Error('PERMISSION_CONTRACT_HOOK_DRIFT');
  await db.query(`update private.permission_contract_gate set strict=false where singleton;
    alter role authenticator reset pgrst.db_pre_request;
    notify pgrst,'reload config';`);
  if (await inspectCompatibilityPreparation(db) !== 'ABSENT') throw new Error('PERMISSION_CONTRACT_HOOK_RESTORE_FAILED');
  return { status: 'RESTORED' };
}
