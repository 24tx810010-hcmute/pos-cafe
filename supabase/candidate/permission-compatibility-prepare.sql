-- PERM-30 compatibility preparation. Install while the old client is still
-- allowed: the singleton starts in pass-through mode and activation flips it.

create table if not exists private.permission_contract_gate (
 singleton boolean primary key default true check (singleton),
 strict boolean not null default false,
 contract_version integer not null default 2 check (contract_version=2)
);
insert into private.permission_contract_gate(singleton,strict,contract_version)
values(true,false,2) on conflict(singleton) do nothing;

-- An older preparation must never silently accept its previous client marker.
-- Release preflight must resolve that drift before this candidate is activated.
do $$ begin
 if exists(select 1 from private.permission_contract_gate where contract_version<>2) then
  raise exception 'PERMISSION_CONTRACT_VERSION_MISMATCH';
 end if;
end $$;

create or replace function private.assert_permission_contract() returns void
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
 strict_mode boolean;
 required_version integer;
 headers jsonb;
 claims jsonb;
 request_role text;
 path text:=nullif(current_setting('request.path',true),'');
 marker text;
begin
 select g.strict,g.contract_version into strict_mode,required_version from private.permission_contract_gate g where singleton;
 perform set_config('response.headers',
  (coalesce(nullif(current_setting('response.headers',true),'')::jsonb,'[]'::jsonb)||
   jsonb_build_array(jsonb_build_object('X-Pos-Permission-Hook',case when strict_mode then 'strict' else 'pass-through' end)))::text,true);
 -- A missing/corrupt singleton must fail closed. Only the explicit prepared
 -- value false is pass-through.
 if strict_mode=false then return; end if;
 -- SECURITY DEFINER changes current_role. PostgREST's transaction-scoped JWT
 -- claims are populated only after signature verification and preserve the
 -- impersonated request role across this call.
 begin claims:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 exception when others then claims:='{}'::jsonb;
 end;
 request_role:=coalesce(claims->>'role','anon');
 if request_role not in ('anon','authenticated') then return; end if;
 -- Safe, public discovery is the only Data API exception.
 if path='/rpc/permission_get_contract' then return; end if;
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb;
 exception when others then headers:='{}'::jsonb;
 end;
 marker:=headers->>'x-pos-permission-contract';
 if strict_mode is null or marker is distinct from required_version::text then
  raise sqlstate 'PGRST' using
   message='{"code":"WRITE_PROTOCOL_UNSUPPORTED","message":"Phiên bản ứng dụng chưa tương thích. Vui lòng tải phiên bản mới trước khi tiếp tục.","details":null,"hint":null}',
   detail='{"status":426,"headers":{}}';
 end if;
end $$;

create or replace function public.permission_contract_pre_request() returns void
language sql volatile security definer set search_path=pg_catalog as $$
 select private.assert_permission_contract()
$$;

-- Deliberately inert: only PostgREST's configured pre-request hook may add the
-- routing marker. Calling the hook itself would produce a false-positive probe.
create or replace function public.permission_contract_probe() returns boolean
language sql stable security invoker set search_path=pg_catalog as $$ select true $$;

revoke all on table private.permission_contract_gate from public,anon,authenticated,service_role;
revoke all on function private.assert_permission_contract() from public,anon,authenticated,service_role;
revoke all on function public.permission_contract_pre_request() from public,anon,authenticated,service_role;
grant execute on function public.permission_contract_pre_request() to anon,authenticated,service_role;
revoke all on function public.permission_contract_probe() from public,anon,authenticated,service_role;
grant execute on function public.permission_contract_probe() to anon,authenticated,service_role;

do $$
declare configured text;
begin
 select split_part(setting,'=',2) into configured
 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole,
 lateral unnest(s.setconfig) setting
 where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%';
 if configured is not null and configured not in ('','public.permission_contract_pre_request') then
  raise exception 'UNEXPECTED_DB_PRE_REQUEST:%',configured;
 end if;
 execute 'alter role authenticator set pgrst.db_pre_request to ''public.permission_contract_pre_request''';
end $$;
notify pgrst,'reload config';
notify pgrst,'reload schema';
