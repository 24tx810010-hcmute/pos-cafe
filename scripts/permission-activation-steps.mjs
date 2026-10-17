import { readFileSync } from 'node:fs';
import { ACTIVATION_SQL_ORDER, inspectAllTenantRows } from './permission-activation-bundle.mjs';

export class ActivationError extends Error { constructor(code){super(code);this.name='ActivationError';this.code=code;} }
const fail=code=>{throw new ActivationError(code);};
export function stripTopLevelTransactions(sql){
  let mask='',i=0,state='code',tag='';
  while(i<sql.length){const two=sql.slice(i,i+2);
    if(state==='code'&&two==='--'){state='line';mask+='  ';i+=2;continue;} if(state==='code'&&two==='/*'){state='block';mask+='  ';i+=2;continue;}
    if(state==='line'){mask+=sql[i]==='\n'?'\n':' ';if(sql[i++]==='\n')state='code';continue;} if(state==='block'){if(two==='*/'){mask+='  ';i+=2;state='code';}else{mask+=sql[i++]==='\n'?'\n':' ';}continue;}
    if(state==='code'&&sql[i]==="'"){state='quote';mask+=' ';i++;continue;} if(state==='quote'){if(two==="''"){mask+='  ';i+=2;}else{mask+=sql[i]==='\n'?'\n':' ';if(sql[i++]==="'")state='code';}continue;}
    if(state==='code'&&sql[i]==='$'){const m=sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);if(m){tag=m[0];state='dollar';mask+=' '.repeat(tag.length);i+=tag.length;continue;}}
    if(state==='dollar'){if(sql.startsWith(tag,i)){mask+=' '.repeat(tag.length);i+=tag.length;state='code';}else{mask+=sql[i++]==='\n'?'\n':' ';}continue;}
    mask+=sql[i++];
  }
  const matches=[...mask.matchAll(/\b(begin|commit|rollback|start\s+transaction)\b\s*;|\b(savepoint|release\s+savepoint)\s+[A-Za-z_][A-Za-z0-9_]*\s*;/ig)];
  if(matches.some(m=>!['begin','commit'].includes((m[1]??m[2]).toLowerCase())))fail('NESTED_TRANSACTION_COMMAND_REFUSED');
  let result=sql;for(const m of matches.reverse())result=result.slice(0,m.index)+result.slice(m.index+m[0].length);return result;
}
function sqlBody(path,sqlFiles){
  const sql=sqlFiles?.get(path)??readFileSync(path,'utf8');
  const visible=stripTopLevelTransactions(sql);
  if(/\b(?:vacuum|create\s+database|alter\s+system|reindex\s+concurrently|create\s+index\s+concurrently)\b/i.test(visible))fail('NONTRANSACTIONAL_SQL_REFUSED');return visible;
}

// Callers own the connection, transaction, target checks and locked preflight.
// These shared steps never connect, BEGIN, COMMIT or ROLLBACK.
export async function applyActivationSteps(db, { plan, storeIds, expectedEmptyStoreSet = false, failAfterFragment, sqlFiles } = {}) {
    if(sqlFiles!==undefined&&(!(sqlFiles instanceof Map)||ACTIVATION_SQL_ORDER.some(path=>typeof sqlFiles.get(path)!=='string')))fail('PINNED_ACTIVATION_SQL_REQUIRED');
    const hooks=(await db.query(`select split_part(setting,'=',2) value from pg_db_role_setting s join pg_roles r on r.oid=s.setrole,
      lateral unnest(s.setconfig) setting where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%'`)).rows.map(row=>row.value).filter(Boolean);
    if(hooks.length!==1||hooks[0]!=='public.permission_contract_pre_request')fail('PERMISSION_CONTRACT_HOOK_NOT_PREPARED');
    await db.query(sqlBody(ACTIVATION_SQL_ORDER[0],sqlFiles));
    if(failAfterFragment===0)fail('SYNTHETIC_FRAGMENT_FAULT');
    await db.query('alter table public.employees alter column role type text using role::text');
    for(const store of plan.stores){
      await db.query("update public.employees set role=case when id=$2 then 'owner' when role='admin' then 'manager' else role end where store_id=$1",[store.storeId,store.candidateOwnerId]);
    }
    let fragment=0;for(const path of ACTIVATION_SQL_ORDER.slice(1)){await db.query(sqlBody(path,sqlFiles));fragment++;if(failAfterFragment===fragment)fail('SYNTHETIC_FRAGMENT_FAULT');}
    await db.query(`revoke all on function public.create_employee(uuid,text,public.employee_role,text,text),public.seed_employee(uuid,text,public.employee_role,text,text),
      public.verify_employee_pin(uuid,text),public.has_employee_permission(public.employee_role,jsonb,text),
      private.legacy_has_employee_permission(public.employee_role,jsonb,text),private.legacy_permission_snapshot(public.employee_role,jsonb,boolean) from public,anon,authenticated,service_role;
      drop function public.create_employee(uuid,text,public.employee_role,text,text);
      drop function public.seed_employee(uuid,text,public.employee_role,text,text);
      drop function public.verify_employee_pin(uuid,text);
      drop function public.has_employee_permission(public.employee_role,jsonb,text);
      drop function private.legacy_has_employee_permission(public.employee_role,jsonb,text);
      drop function private.legacy_permission_snapshot(public.employee_role,jsonb,boolean);
      drop table private.legacy_permission_defaults;
      drop table private.legacy_permission_roles;
      drop table private.legacy_permission_catalog;
      drop type public.employee_role;`);
    const post=(await db.query(`select s.id,count(*) filter(where e.role='owner' and e.is_active)::int owners from public.stores s left join public.employees e on e.store_id=s.id where s.id=any($1::uuid[]) group by s.id order by s.id`,[storeIds])).rows;
    let postEmptyTargetEvidence=null;
    if(expectedEmptyStoreSet===true){
      postEmptyTargetEvidence=await inspectAllTenantRows(db);
      if(postEmptyTargetEvidence.storeIds.length!==0)fail('ACTIVATION_STORE_SET_MISMATCH');
      if(!postEmptyTargetEvidence.empty)fail('ACTIVATION_TARGET_NOT_EMPTY');
    }
    if(post.some(row=>row.owners!==1))fail('OWNER_POSTFLIGHT_FAILED');
    const capability=(await db.query("select pg_get_functiondef('public.get_write_capabilities()'::regprocedure) definition")).rows[0]?.definition??'';if(!capability.includes("'writeProtocolVersion',1")||!capability.includes("'permissionContractVersion',2"))fail('CAPABILITY_POSTFLIGHT_FAILED');
    const enumDependencies=(await db.query(`select count(*)::int count from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='employee_role'`)).rows[0].count;
    return { post, postEmptyTargetEvidence, enumDependencies };
}
