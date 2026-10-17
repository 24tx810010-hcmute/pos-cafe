-- Final PERM-30 cutover. This fragment belongs in the atomic activation bundle.
do $$
declare configured text;
begin
 select split_part(setting,'=',2) into configured
 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole,
 lateral unnest(s.setconfig) setting
 where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%';
 if configured is distinct from 'public.permission_contract_pre_request' then
  raise exception 'PERMISSION_CONTRACT_HOOK_NOT_PREPARED';
 end if;
 if to_regprocedure('private.assert_permission_contract()') is null or
    to_regprocedure('public.permission_contract_pre_request()') is null then
  raise exception 'PERMISSION_CONTRACT_HOOK_NOT_PREPARED';
 end if;
 if exists(select 1 from private.permission_contract_gate where contract_version<>2) then
  raise exception 'PERMISSION_CONTRACT_VERSION_MISMATCH';
 end if;
 update private.permission_contract_gate set strict=true where singleton and contract_version=2;
 if not found then raise exception 'PERMISSION_CONTRACT_HOOK_NOT_PREPARED'; end if;
end $$;
