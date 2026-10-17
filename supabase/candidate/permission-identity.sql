-- PERM-T04 candidate fragment. NOT an automatic migration or activation launcher.
-- Install transactionally only after approved role mapping to text (T16).
-- No grants to legacy functions are restored. Fixture staging is separate.
do $$ begin
 if (select udt_name from information_schema.columns where table_schema='public' and table_name='employees' and column_name='role') <> 'text'
 or exists(select 1 from public.employees e left join public.permission_roles r on r.code=e.role where r.code is null)
 or exists(select 1 from public.stores s where (select count(*) from public.employees e where e.store_id=s.id and e.role='owner' and e.is_active)<>1)
 then raise exception 'OWNER_MIGRATION_REVIEW_REQUIRED'; end if;
end $$;

alter table public.employees add constraint employees_permission_role_fk foreign key(role) references public.permission_roles(code);
alter table public.employees add constraint employees_owner_active check(role<>'owner' or is_active);
alter table public.employees add column pin_change_required boolean not null default false;
alter table public.employees add constraint employees_pin_change_owner check(not pin_change_required or role='owner');
alter table private.employee_sessions drop constraint employee_sessions_check;
alter table private.employee_sessions add column purpose text not null default 'normal'
 check(purpose in ('normal','required_pin_change'));
alter table private.employee_sessions add column employee_revision bigint not null default 0
 check(employee_revision between 0 and 9007199254740991);
alter table private.employee_sessions add constraint employee_sessions_purpose_ttl check(
 (purpose='normal' and expires_at=issued_at+interval '12 hours') or
 (purpose='required_pin_change' and expires_at=issued_at+interval '5 minutes'));
create unique index employees_one_owner on public.employees(store_id) where role='owner';
create function private.assert_store_owner() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare sid uuid; stores uuid[];
begin
 if tg_table_name='stores' then
  stores:=array[case when tg_op<>'DELETE' then new.id end,case when tg_op<>'INSERT' then old.id end];
 else
  stores:=array[case when tg_op<>'DELETE' then new.store_id end,case when tg_op<>'INSERT' then old.store_id end];
 end if;
 for sid in select distinct x from unnest(stores) x where x is not null loop
  if exists(select 1 from public.stores where id=sid) and
     (select count(*) from public.employees where store_id=sid and role='owner' and is_active)<>1 then
   raise exception 'OWNER_PROTECTED' using errcode='23514';
  end if;
 end loop;
 return null;
end $$;
create constraint trigger employees_owner_boundary after insert or update or delete on public.employees
 deferrable initially deferred for each row execute function private.assert_store_owner();
create constraint trigger stores_owner_boundary after insert or update or delete on public.stores
 deferrable initially deferred for each row execute function private.assert_store_owner();

-- Audit has no cascading business/employee FK. No secret, PIN digest or request MAC.
create table public.employee_admin_audit (
 store_id uuid not null, actor_type text not null check(actor_type in ('employee','operator')),
 actor_key text not null, request_id uuid not null, target_id uuid not null,
 kind text not null, outcome text not null check(outcome in ('applied','noop','denied')), reason text,
 before_snapshot jsonb, proposed_after jsonb, actual_after jsonb, actor_effective text[] not null,
 catalog_revision bigint not null, credential_changed boolean not null default false,
 operator_case_ref text, operator_proof_ref text, occurred_at timestamptz not null,
 primary key(store_id,actor_type,actor_key,request_id,target_id)
);
create table public.store_change_signals (
 store_id uuid not null, topic text not null, revision bigint not null check(revision>=0),
 event_id uuid not null, target_id uuid, primary key(store_id,topic)
);
alter table public.employee_admin_audit enable row level security;
alter table public.store_change_signals enable row level security;
revoke all on public.employee_admin_audit,public.store_change_signals from public,anon,authenticated,service_role;
alter table private.employee_admin_requests drop constraint employee_admin_requests_actor_type_check;
alter table private.employee_admin_requests add check(actor_type in ('employee','operator'));

-- Reservation exists before Auth/signup and therefore contains no tenant secret.
create table private.store_no_reservations (
 request_id uuid primary key,
 store_no integer not null unique check(store_no between 1 and 2147483647),
 created_at timestamptz not null
);
create table private.initial_seed_workflows (
 workflow_id uuid primary key,
 store_id uuid not null unique references public.stores(id) on delete cascade,
 requested boolean not null,
 template_version integer not null check(template_version=1),
 status text not null check(status in ('skipped','pending','in_progress','needs_retry','completed')),
 workflow_revision bigint not null default 0 check(workflow_revision between 0 and 9007199254740991),
 auto_claimed_at timestamptz,
 run_generation bigint not null default 0 check(run_generation between 0 and 9007199254740991),
 last_error_code text check(last_error_code in ('ENTITY_ID_CONFLICT','PERMISSION_UPDATE_UNAVAILABLE')),
 created_at timestamptz not null,
 updated_at timestamptz not null
);
create table private.initial_seed_stages (
 workflow_id uuid not null references private.initial_seed_workflows(workflow_id) on delete cascade,
 stage text not null check(stage in ('employee','menu','floor')),
 stage_id uuid not null unique,
 status text not null default 'pending' check(status in ('pending','committed')),
 committed_at timestamptz,
 receipt jsonb,
 primary key(workflow_id,stage),
 check((status='pending' and committed_at is null and receipt is null) or
       (status='committed' and committed_at is not null and jsonb_typeof(receipt)='object'))
);

-- Match ECMAScript trim in the candidate input parser, including non-ASCII spaces.
create function private.permission_trim(value text) returns text
language sql immutable set search_path=pg_catalog as $$
 select btrim(value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;
create function private.permission_stable_uuid(namespace uuid,value text) returns uuid
language plpgsql immutable strict set search_path=pg_catalog as $$
declare h text:=encode(extensions.digest(convert_to(namespace::text||':'||value,'UTF8'),'sha256'),'hex');
begin
 h:=substr(h,1,12)||'5'||substr(h,14,3)||case when substr(h,17,1) in ('0','1','2','3') then '8' when substr(h,17,1) in ('4','5','6','7') then '9' when substr(h,17,1) in ('8','9','a','b') then 'a' else 'b' end||substr(h,18,15);
 return (substr(h,1,8)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||substr(h,17,4)||'-'||substr(h,21,12))::uuid;
end $$;
create function private.permission_failure(code text,context text default null) returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select case when code='INVALID_PIN' and context='self_pin' then
  jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'message','PIN hiện tại không đúng.','details',null))
 else jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'details',null,'message',case code
  when 'INVALID_EMPLOYEE_REQUEST' then 'Thông tin nhân viên không hợp lệ. Kiểm tra các trường được đánh dấu.'
  when 'EMPLOYEE_ROLE_UNAVAILABLE' then 'Vai trò này chưa được hỗ trợ trên ứng dụng.'
  when 'OWNER_PROTECTED' then 'Không thể thay đổi chủ quán bằng thao tác này.'
   when 'EMPLOYEE_VERSION_CONFLICT' then 'PIN hoặc trạng thái tài khoản đã thay đổi. Vui lòng đăng nhập lại.'
   when 'ADMIN_REQUEST_REUSED' then 'Mã yêu cầu đã được dùng cho nội dung khác.'
   when 'PIN_CHANGE_REQUIRED' then 'Bạn cần đổi PIN tạm trước khi sử dụng quán.'
   when 'PIN_REUSE_NOT_ALLOWED' then 'PIN mới phải khác PIN tạm đang dùng.'
   when 'INITIAL_SEED_ATTEMPT_STALE' then 'Tiến trình dữ liệu mẫu đã thay đổi. Kiểm tra trạng thái trước khi thử lại.'
   when 'ENTITY_ID_CONFLICT' then 'Dữ liệu hiện có trùng với dữ liệu mẫu. Đã dừng để giữ các thay đổi của quán.'
  when 'PERMISSION_UPDATE_UNAVAILABLE' then 'Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại.'
  when 'OWNER_RECOVERY_REVIEW_REQUIRED' then 'Chưa đủ căn cứ khôi phục chủ quán. Cần xác minh hồ sơ hỗ trợ.'
  when 'BOOTSTRAP_CONFLICT' then 'Cửa hàng đã được khởi tạo; không thể thay chủ quán bằng thao tác này.'
  else private.write_error(code)->>'message' end)) end
$$;

create function private.permission_store_mutex(sid uuid) returns void
language plpgsql volatile set search_path=pg_catalog as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('store-authority:'||sid::text,0));
 -- Prelock the FK parent before employee/session/catalog locks and the final checkpoint.
 perform 1 from public.stores where id=sid for share;
end $$;
create function private.permission_catalog_share() returns void
language sql volatile set search_path=pg_catalog as $$
 select pg_advisory_xact_lock_shared(hashtextextended('permission-catalog',0))
$$;
create or replace function private.permission_catalog_lock() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('permission-catalog',0));
 perform 1 from public.permission_catalog_state where singleton for update;
 if not found then raise exception 'PERMISSION_CATALOG_INVALID' using errcode='23514'; end if;
 return null;
end $$;
create function private.permission_identity_lock(sid uuid,eid uuid,all_sessions boolean) returns void
language plpgsql volatile set search_path=pg_catalog as $$ begin
 perform private.permission_store_mutex(sid);
 if all_sessions then
  perform 1 from public.employees where store_id=sid and id=eid for update;
  perform 1 from private.employee_sessions where store_id=sid and employee_id=eid order by token_hash for update;
 else
  perform 1 from public.employees where store_id=sid and id=eid for share;
 end if;
 perform private.permission_catalog_share();
end $$;

-- VOLATILE and a new statement after every possible wait. Identification is not authorization.
create function private.permission_current_employee(p_lock boolean default true) returns public.employees
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); eid uuid; e public.employees; s private.employee_sessions;
begin
 if sid is null then raise exception 'AUTH_REQUIRED' using errcode='P0401'; end if;
 select employee_id into eid from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash();
 if p_lock then
  perform 1 from public.employees where store_id=sid and id=eid for share;
  perform 1 from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash() for share;
  perform private.permission_catalog_share();
 end if;
 select * into e from public.employees where store_id=sid and id=eid;
 select * into s from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash();
  if e.id is null or not e.is_active or s.token_hash is null or s.revoked_at is not null or s.expires_at<=private.write_clock() then
   raise exception 'EMPLOYEE_SESSION_REQUIRED' using errcode='P0401';
  end if;
  if s.purpose<>'normal' or e.pin_change_required then
   raise exception 'PIN_CHANGE_REQUIRED' using errcode='P0401';
  end if;
 if not exists(select 1 from public.permission_roles where code=e.role and enabled) then
  raise exception 'EMPLOYEE_ROLE_UNAVAILABLE' using errcode='P0401';
 end if;
 return e;
end $$;
create function private.permission_catalog_json() returns jsonb
language sql volatile set search_path=pg_catalog as $$
 select jsonb_build_object('contractVersion',1,'revision',(select revision from public.permission_catalog_state where singleton),
  'roles',(select jsonb_agg(jsonb_build_object('code',code,'labelVi',label_vi,'enabled',enabled,'selectable',selectable) order by code) from public.permission_roles),
  'permissions',(select jsonb_agg(jsonb_build_object('code',code,'labelVi',label_vi,'module',module,'ownerOnly',owner_only,'baseline',baseline) order by code) from public.permission_catalog),
  'defaults',(select jsonb_agg(jsonb_build_object('roleCode',role_code,'permissionCode',permission_code) order by role_code,permission_code) from public.role_permission_defaults))
$$;
create function private.permission_employee_snapshot(e public.employees) returns jsonb
language sql volatile set search_path=pg_catalog as $$
 select jsonb_build_object('id',e.id,'name',e.name,'role',e.role,'isActive',e.is_active,'pinChangeRequired',e.pin_change_required,'permissionRevision',e.permission_revision,
  'overrides',private.normalize_permission_overrides(e.role,e.permission_overrides),'effective',private.configured_employee_permissions(e.role,e.permission_overrides))
$$;
create function private.permission_authority_json(e public.employees) returns jsonb
language plpgsql volatile set search_path=pg_catalog as $$
declare ov jsonb:=private.normalize_permission_overrides(e.role,e.permission_overrides); perms text[]:=private.configured_employee_permissions(e.role,e.permission_overrides); sources jsonb;
begin
 select jsonb_agg(jsonb_build_object('permission',p.code,'effective',p.code=any(perms),'sources',
  to_jsonb(array_remove(array[case when d.permission_code is not null then 'default' end,
    case when ov->'grants' ? p.code then 'grant' end,case when ov->'denies' ? p.code then 'deny' end,
    case when p.baseline and d.permission_code is not null then 'baseline' end],null))) order by p.code)
 into sources from public.permission_catalog p left join public.role_permission_defaults d on d.permission_code=p.code and d.role_code=e.role;
 return jsonb_build_object('storeId',e.store_id,'employeeId',e.id,'role',e.role,'active',true,
  'employeeRevision',e.permission_revision,'catalogRevision',(select revision from public.permission_catalog_state where singleton),'permissions',perms,'sources',sources);
end $$;
create function public.permission_get_authority() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; begin
 e:=private.permission_current_employee();
 return jsonb_build_object('ok',true,'data',jsonb_build_object('catalog',private.permission_catalog_json(),'snapshot',private.permission_authority_json(e)));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm); end $$;
create function public.permission_get_revision() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; begin
 e:=private.permission_current_employee();
 return jsonb_build_object('ok',true,'data',jsonb_build_object('employeeRevision',e.permission_revision,
 'catalogRevision',(select revision from public.permission_catalog_state where singleton),'serverTime',private.write_clock()));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm); end $$;
create function public.permission_list_roster() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$ begin
 if auth.uid() is null then return private.permission_failure('AUTH_REQUIRED'); end if;
 return jsonb_build_object('ok',true,'data',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name) order by e.name,e.id)
 from public.employees e join public.permission_roles r on r.code=e.role and r.enabled where e.store_id=auth.uid() and e.is_active),'[]'));
end $$;
create function public.permission_start_session(p_employee_id uuid,p_pin text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; token text; issued timestamptz; purpose text; ttl interval;
begin
 if auth.uid() is null then return private.permission_failure('AUTH_REQUIRED'); end if;
 if p_pin is null or p_pin !~ '^[0-9]{6}$' then return private.permission_failure('INVALID_PIN'); end if;
 perform private.permission_identity_lock(auth.uid(),p_employee_id,false);
 select * into e from public.employees where store_id=auth.uid() and id=p_employee_id;
 if e.id is null or not e.is_active or e.passcode_hash<>extensions.crypt(p_pin,e.passcode_hash) then return private.permission_failure('INVALID_PIN'); end if;
 if not exists(select 1 from public.permission_roles where code=e.role and enabled) then return private.permission_failure('EMPLOYEE_ROLE_UNAVAILABLE'); end if;
  if e.pin_change_required and e.role<>'owner' then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end if;
  purpose:=case when e.pin_change_required then 'required_pin_change' else 'normal' end;
  ttl:=case when purpose='required_pin_change' then interval '5 minutes' else interval '12 hours' end;
  token:=rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'='); issued:=private.write_clock();
  insert into private.employee_sessions(token_hash,store_id,employee_id,issued_at,expires_at,purpose,employee_revision)
  values(extensions.digest(convert_to(token,'UTF8'),'sha256'),auth.uid(),e.id,issued,issued+ttl,purpose,e.permission_revision);
  if purpose='required_pin_change' then
   return jsonb_build_object('ok',true,'token',token,'kind','required_pin_change','pinChangeRequired',true,
    'storeId',e.store_id,'employeeId',e.id,'name',e.name,'employeeRevision',e.permission_revision,
    'issuedAt',issued,'expiresAt',issued+ttl);
  end if;
  return jsonb_build_object('ok',true,'token',token,'kind','normal','pinChangeRequired',false,'issuedAt',issued,'expiresAt',issued+ttl,
   'authority',jsonb_build_object('catalog',private.permission_catalog_json(),'snapshot',private.permission_authority_json(e)));
end $$;
create function public.permission_revoke_session() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare eid uuid; begin
 if auth.uid() is null then return private.permission_failure('AUTH_REQUIRED'); end if;
 perform private.permission_store_mutex(auth.uid());
 select employee_id into eid from private.employee_sessions where store_id=auth.uid() and token_hash=private.employee_token_hash();
 perform 1 from public.employees where store_id=auth.uid() and id=eid for share;
 perform 1 from private.employee_sessions where store_id=auth.uid() and token_hash=private.employee_token_hash() for update;
 update private.employee_sessions set revoked_at=coalesce(revoked_at,private.write_clock()) where store_id=auth.uid() and token_hash=private.employee_token_hash();
 return jsonb_build_object('ok',true);
end $$;

-- Common atomic credential mutation. Caller holds mutex, target UPDATE, every
-- target session UPDATE, and catalog SHARE. Only private trusted entry points.
create function private.permission_pin_change(sid uuid,e public.employees,p jsonb,actor_type text,actor_key text,kind text,denial text) returns jsonb
language plpgsql volatile set search_path=pg_catalog as $$
declare req uuid:=(p->>'requestId')::uuid; old_request private.employee_admin_requests; key private.permission_request_mac_keys;
 mac bytea; result jsonb; before_json jsonb:=private.permission_employee_snapshot(e); after_json jsonb;
 changed boolean:=false; outcome text; why text:=denial; actor_rights text[]; catrev bigint;
begin
 select * into old_request from private.employee_admin_requests r where r.store_id=sid and r.actor_type=permission_pin_change.actor_type and r.actor_key=permission_pin_change.actor_key and request_id=req;
 select * into key from private.permission_request_mac_keys where key_version=coalesce(old_request.mac_key_version,(select max(key_version) from private.permission_request_mac_keys));
 mac:=extensions.hmac(convert_to(jsonb_build_object('kind',kind,'targetId',e.id,'payload',p)::text,'UTF8'),key.secret_bytes,'sha256');
 if old_request.request_id is not null then
  if old_request.payload_mac<>mac then return private.permission_failure('ADMIN_REQUEST_REUSED'); end if;
  if old_request.terminal_outcome->>'ok'='true' then return old_request.terminal_outcome||jsonb_build_object('outcome','replayed'); end if;
  return old_request.terminal_outcome;
 end if;
 if why is null and actor_type='employee' and (p->>'expectedRevision')::bigint<>e.permission_revision then why:='EMPLOYEE_VERSION_CONFLICT'; end if;
 if why is null and actor_type='employee' and e.passcode_hash<>extensions.crypt(p->>'currentPin',e.passcode_hash) then why:='INVALID_PIN'; end if;
 catrev:=(select revision from public.permission_catalog_state where singleton);
 actor_rights:=case when actor_type='employee' then private.configured_employee_permissions(e.role,e.permission_overrides) else array[]::text[] end;
 if why is not null then outcome:='denied'; result:=private.permission_failure(why,kind);
  else
   changed:=e.passcode_hash<>extensions.crypt(p->>'newPin',e.passcode_hash);
   outcome:=case when kind='owner_recovery' or changed then 'applied' else 'noop' end;
   if kind='owner_recovery' then
    update public.employees set
     passcode_hash=case when changed then extensions.crypt(p->>'newPin',extensions.gen_salt('bf')) else passcode_hash end,
     pin_change_required=true,permission_revision=permission_revision+1
    where store_id=sid and id=e.id returning * into e;
    update private.employee_sessions set revoked_at=coalesce(revoked_at,private.write_clock()) where store_id=sid and employee_id=e.id;
    insert into public.store_change_signals values(sid,'permission',1,req,e.id)
    on conflict(store_id,topic) do update set revision=public.store_change_signals.revision+1,event_id=req,target_id=e.id;
   elsif changed then
    update public.employees set passcode_hash=extensions.crypt(p->>'newPin',extensions.gen_salt('bf')),permission_revision=permission_revision+1
    where store_id=sid and id=e.id returning * into e;
    insert into public.store_change_signals values(sid,'permission',1,req,e.id)
    on conflict(store_id,topic) do update set revision=public.store_change_signals.revision+1,event_id=req,target_id=e.id;
   end if;
   result:=jsonb_build_object('ok',true,'outcome',outcome,'data',jsonb_build_object('credentialChanged',changed,
    'pinChangeRequired',e.pin_change_required,'employeeRevision',e.permission_revision));
 end if;
 after_json:=private.permission_employee_snapshot(e);
 insert into public.employee_admin_audit values(sid,actor_type,actor_key,req,e.id,kind,outcome,why,before_json,
  before_json,after_json,actor_rights,catrev,changed,p->>'caseRef',p->>'proofRef',private.write_clock());
 insert into private.employee_admin_requests values(sid,actor_type,actor_key,req,kind,mac,key.key_version,result,
  jsonb_build_array(jsonb_build_array(sid,actor_type,actor_key,req,e.id)));
 return result;
end $$;

create function public.permission_check_required_pin_session() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); eid uuid; e public.employees; s private.employee_sessions;
begin
 if sid is null then return private.permission_failure('AUTH_REQUIRED'); end if;
 select employee_id into eid from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash();
 perform private.permission_store_mutex(sid);
 perform 1 from public.employees where store_id=sid and id=eid for share;
 perform 1 from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash() for share;
 perform private.permission_catalog_share();
 select * into e from public.employees where store_id=sid and id=eid;
 select * into s from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash();
 if e.id is null or not e.is_active or e.role<>'owner' or not e.pin_change_required or s.token_hash is null
  or s.purpose<>'required_pin_change' or s.revoked_at is not null or s.expires_at<=private.write_clock()
  or s.employee_id<>e.id or s.employee_revision<>e.permission_revision then return private.permission_failure('EMPLOYEE_SESSION_REQUIRED'); end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('valid',true,'purpose','required_pin_change',
  'employeeRevision',e.permission_revision,'expiresAt',s.expires_at));
exception when others then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end $$;

create function public.permission_complete_required_pin_change(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); eid uuid; e public.employees; s private.employee_sessions; req uuid;
 prior private.employee_admin_requests; key private.permission_request_mac_keys; mac bytea; result jsonb;
 before_json jsonb; after_json jsonb; catrev bigint; receipt_payload jsonb; why text; occurred timestamptz;
begin
 if sid is null then return private.permission_failure('AUTH_REQUIRED'); end if;
 if jsonb_typeof(p_request) is distinct from 'object' or
  not p_request ?& array['requestId','expectedRevision','newPin'] or
  p_request-array['requestId','expectedRevision','newPin']<>'{}' or
  not private.valid_uuid(p_request->'requestId') or
  jsonb_typeof(p_request->'expectedRevision') is distinct from 'number' or (p_request->>'expectedRevision') !~ '^[0-9]+$' or
  (p_request->>'expectedRevision')::numeric>9007199254740991 or
  jsonb_typeof(p_request->'newPin') is distinct from 'string' or (p_request->>'newPin') !~ '^[0-9]{6}$'
 then return private.permission_failure('INVALID_EMPLOYEE_REQUEST'); end if;
 req:=(p_request->>'requestId')::uuid;
 select employee_id into eid from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash();
 perform private.permission_identity_lock(sid,eid,true);
 select * into e from public.employees where store_id=sid and id=eid;
 select * into s from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash();
 -- Session validity deliberately precedes receipt lookup: a completed request
 -- revokes its own credential and can never be replayed into authority.
 if e.id is null or not e.is_active or e.role<>'owner' or not e.pin_change_required or s.token_hash is null
  or s.purpose<>'required_pin_change' or s.revoked_at is not null or s.expires_at<=private.write_clock()
  or s.employee_id<>e.id or s.employee_revision<>e.permission_revision then return private.permission_failure('EMPLOYEE_SESSION_REQUIRED'); end if;
 select * into prior from private.employee_admin_requests r where r.store_id=sid and r.actor_type='employee' and r.actor_key=e.id::text and r.request_id=req;
 select * into key from private.permission_request_mac_keys where key_version=coalesce(prior.mac_key_version,(select max(key_version) from private.permission_request_mac_keys)) for share;
 if key.key_version is null then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end if;
 receipt_payload:=jsonb_build_object('kind','complete_required_pin_change','targetId',e.id,'requestId',req,
  'expectedRevision',p_request->'expectedRevision','newPinMac',encode(extensions.hmac(convert_to(p_request->>'newPin','UTF8'),key.secret_bytes,'sha256'),'hex'));
 mac:=extensions.hmac(convert_to(receipt_payload::text,'UTF8'),key.secret_bytes,'sha256');
 if prior.request_id is not null then
  if prior.payload_mac<>mac then return private.permission_failure('ADMIN_REQUEST_REUSED'); end if;
  return prior.terminal_outcome;
 end if;
 if (p_request->>'expectedRevision')::bigint<>e.permission_revision then why:='EMPLOYEE_VERSION_CONFLICT';
 elsif e.passcode_hash=extensions.crypt(p_request->>'newPin',e.passcode_hash) then why:='PIN_REUSE_NOT_ALLOWED'; end if;
 before_json:=private.permission_employee_snapshot(e); catrev:=(select revision from public.permission_catalog_state where singleton); occurred:=private.write_clock();
 if why is not null then
  result:=private.permission_failure(why); after_json:=before_json;
  insert into public.employee_admin_audit(store_id,actor_type,actor_key,request_id,target_id,kind,outcome,reason,before_snapshot,proposed_after,actual_after,actor_effective,catalog_revision,credential_changed,occurred_at)
  values(sid,'employee',e.id::text,req,e.id,'complete_required_pin_change','denied',why,before_json,before_json,after_json,array[]::text[],catrev,false,occurred);
  insert into private.employee_admin_requests(store_id,actor_type,actor_key,request_id,kind,payload_mac,mac_key_version,terminal_outcome,audit_keys)
  values(sid,'employee',e.id::text,req,'complete_required_pin_change',mac,key.key_version,result,jsonb_build_array(jsonb_build_array(sid,'employee',e.id,req,e.id)));
  return result;
 end if;
 update public.employees set passcode_hash=extensions.crypt(p_request->>'newPin',extensions.gen_salt('bf')),
  pin_change_required=false,permission_revision=permission_revision+1 where store_id=sid and id=e.id returning * into e;
 update private.employee_sessions set revoked_at=coalesce(revoked_at,occurred) where store_id=sid and employee_id=e.id;
 insert into public.store_change_signals values(sid,'permission',1,req,e.id)
 on conflict(store_id,topic) do update set revision=public.store_change_signals.revision+1,event_id=req,target_id=e.id;
 result:=jsonb_build_object('ok',true,'outcome','applied','data',jsonb_build_object('credentialChanged',true,
  'pinChangeRequired',false,'employeeRevision',e.permission_revision));
 after_json:=private.permission_employee_snapshot(e);
 insert into public.employee_admin_audit(store_id,actor_type,actor_key,request_id,target_id,kind,outcome,before_snapshot,proposed_after,actual_after,actor_effective,catalog_revision,credential_changed,occurred_at)
 values(sid,'employee',e.id::text,req,e.id,'complete_required_pin_change','applied',before_json,after_json,after_json,array[]::text[],catrev,true,occurred);
 insert into private.employee_admin_requests(store_id,actor_type,actor_key,request_id,kind,payload_mac,mac_key_version,terminal_outcome,audit_keys)
 values(sid,'employee',e.id::text,req,'complete_required_pin_change',mac,key.key_version,result,jsonb_build_array(jsonb_build_array(sid,'employee',e.id,req,e.id)));
 return result;
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
 when others then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end $$;
create function private.permission_pin_input(p jsonb,recovery boolean) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$ begin
 if jsonb_typeof(p) is distinct from 'object' or not private.valid_uuid(p->'requestId') then return false; end if;
 if recovery then
  if not p ?& array['requestId','storeId','targetId','operatorRef','caseRef','proofRef','newPin'] or
   p - array['requestId','storeId','targetId','operatorRef','caseRef','proofRef','newPin'] <> '{}' or
   not private.valid_uuid(p->'storeId') or not private.valid_uuid(p->'targetId') then return false; end if;
 else
  if not p ?& array['requestId','currentPin','newPin','expectedRevision'] or p-array['requestId','currentPin','newPin','expectedRevision']<>'{}'
   or jsonb_typeof(p->'expectedRevision')<>'number' or (p->>'expectedRevision') !~ '^[0-9]+$'
   or (p->>'expectedRevision')::numeric>9007199254740991 then return false; end if;
 end if;
 return true;
end $$;
create function public.permission_change_own_pin(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare eid uuid; e public.employees; why text;
begin
 if auth.uid() is null then return private.permission_failure('AUTH_REQUIRED'); end if;
 select employee_id into eid from private.employee_sessions where store_id=auth.uid() and token_hash=private.employee_token_hash();
 perform private.permission_identity_lock(auth.uid(),eid,true);
 e:=private.permission_current_employee(false);
 if e.role<>'owner' then return private.permission_failure('FORBIDDEN'); end if;
 if not private.permission_pin_input(p_request,false) then return private.permission_failure('INVALID_EMPLOYEE_REQUEST'); end if;
 if jsonb_typeof(p_request->'currentPin') is distinct from 'string' or (p_request->>'currentPin') !~ '^[0-9]{6}$'
 or jsonb_typeof(p_request->'newPin') is distinct from 'string' or (p_request->>'newPin') !~ '^[0-9]{6}$' then why:='INVALID_EMPLOYEE_REQUEST'; end if;
 return private.permission_pin_change(auth.uid(),e,p_request,'employee',e.id::text,'self_pin',why);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
 when others then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end $$;

do $$ begin
 if not exists(select 1 from pg_roles where rolname='pos_owner_recovery') then create role pos_owner_recovery nologin noinherit; end if;
 if exists(select 1 from pg_roles where rolname='pos_owner_recovery' and (rolcanlogin or rolsuper or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls))
 or pg_has_role('anon','pos_owner_recovery','MEMBER') or pg_has_role('authenticated','pos_owner_recovery','MEMBER') or pg_has_role('service_role','pos_owner_recovery','MEMBER') then
  raise exception 'OWNER_MIGRATION_REVIEW_REQUIRED';
 end if;
end $$;
create function private.permission_recover_owner(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid; eid uuid; e public.employees; k text;
begin
 -- The invoker must explicitly assume the dedicated role. service_role and an
 -- employee token, including owner, are never sufficient.
 if current_setting('role',true)<>'pos_owner_recovery' and not(current_setting('role',true)='none' and session_user='pos_owner_recovery') then return private.permission_failure('FORBIDDEN'); end if;
 if not private.permission_pin_input(p_request,true) then return private.permission_failure('OWNER_RECOVERY_REVIEW_REQUIRED'); end if;
 foreach k in array array['operatorRef','caseRef','proofRef'] loop
  if jsonb_typeof(p_request->k) is distinct from 'string' or char_length(private.permission_trim(p_request->>k)) not between 1 and 200 then return private.permission_failure('OWNER_RECOVERY_REVIEW_REQUIRED'); end if;
 end loop;
 if jsonb_typeof(p_request->'newPin') is distinct from 'string' or (p_request->>'newPin') !~ '^[0-9]{6}$' then return private.permission_failure('INVALID_EMPLOYEE_REQUEST'); end if;
 sid:=(p_request->>'storeId')::uuid; eid:=(p_request->>'targetId')::uuid;
 perform private.permission_identity_lock(sid,eid,true);
 select * into e from public.employees where store_id=sid and id=eid;
 if e.id is null then return private.permission_failure('NOT_FOUND'); end if;
 if e.role<>'owner' or not e.is_active then return private.permission_failure('OWNER_PROTECTED'); end if;
 return private.permission_pin_change(sid,e,p_request,'operator',p_request->>'operatorRef','owner_recovery',null);
exception when others then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end $$;

create function public.permission_reserve_store_no(p_create_attempt_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare reserved integer; candidate bigint;
begin
 if p_create_attempt_id is null or p_create_attempt_id='00000000-0000-0000-0000-000000000000'::uuid then
  return private.permission_failure('INVALID_WRITE_REQUEST');
 end if;
 perform pg_advisory_xact_lock(hashtextextended('store-number-reservation:'||p_create_attempt_id::text,0));
 select store_no into reserved from private.store_no_reservations where request_id=p_create_attempt_id;
 if reserved is not null then return jsonb_build_object('ok',true,'data',jsonb_build_object('storeNo',reserved)); end if;
 loop
  candidate:=nextval('public.store_no_seq');
  if candidate not between 1 and 2147483647 then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end if;
  exit when not exists(select 1 from public.stores where store_no=candidate)
   and not exists(select 1 from private.store_no_reservations where store_no=candidate);
 end loop;
 insert into private.store_no_reservations(request_id,store_no,created_at) values(p_create_attempt_id,candidate::integer,private.write_clock());
 return jsonb_build_object('ok',true,'data',jsonb_build_object('storeNo',candidate::integer));
exception when others then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end $$;

create function public.permission_bootstrap_store(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); req uuid; eid uuid; sn integer; name text; addr text; seed_demo boolean; input jsonb;
 prior private.bootstrap_requests; result jsonb; email text; workflow_id uuid; stage_name text;
begin
 if sid is null then return private.permission_failure('AUTH_REQUIRED'); end if;
 if jsonb_typeof(p_request) is distinct from 'object' or not p_request ?& array['requestId','ownerId','storeNo','displayName','address','seedDemo']
 or p_request-array['requestId','ownerId','storeNo','displayName','address','seedDemo']<>'{}' or not private.valid_uuid(p_request->'requestId') or not private.valid_uuid(p_request->'ownerId')
 or jsonb_typeof(p_request->'storeNo') is distinct from 'number' or (p_request->>'storeNo') !~ '^[0-9]+$'
 or (p_request->>'storeNo')::numeric not between 1 and 2147483647
 or jsonb_typeof(p_request->'displayName') is distinct from 'string' or char_length(private.permission_trim(p_request->>'displayName')) not between 1 and 120
 or jsonb_typeof(p_request->'address') is distinct from 'string' or char_length(private.permission_trim(p_request->>'address'))>500
 or jsonb_typeof(p_request->'seedDemo') is distinct from 'boolean' then return private.permission_failure('INVALID_WRITE_REQUEST'); end if;
 req:=(p_request->>'requestId')::uuid; eid:=(p_request->>'ownerId')::uuid; sn:=(p_request->>'storeNo')::integer;
 name:=private.permission_trim(p_request->>'displayName'); addr:=private.permission_trim(p_request->>'address'); seed_demo:=(p_request->>'seedDemo')::boolean;
 perform private.permission_store_mutex(sid);
 perform pg_advisory_xact_lock(hashtext(sid::text||':bootstrap'));
 select u.email into email from auth.users u where u.id=sid for share;
 if email is distinct from 'store'||sn::text||'@store.pos.local' then return private.permission_failure('FORBIDDEN'); end if;
 perform private.permission_catalog_share();
 input:=jsonb_build_object('ownerId',eid,'storeNo',sn,'displayName',name,'address',addr,'seedDemo',seed_demo);
 select * into prior from private.bootstrap_requests where store_id=sid and request_id=req;
 if prior.request_id is not null then
  if prior.canonical_input<>input then return private.permission_failure('BOOTSTRAP_CONFLICT'); end if;
  return prior.outcome||jsonb_build_object('outcome','replayed');
 end if;
 if exists(select 1 from public.stores where id=sid or store_no=sn) or exists(select 1 from public.employees where id=eid) then return private.permission_failure('BOOTSTRAP_CONFLICT'); end if;
 workflow_id:=private.permission_stable_uuid(sid,'initial-seed.workflow.v1');
 insert into public.stores(id,store_no,name,email,seed_status) values(sid,sn,name,null,(case when seed_demo then 'pending' else 'seeded' end)::public.seed_status);
 insert into public.store_settings(store_id,display_name,address) values(sid,name,addr);
 insert into public.employees(id,store_id,name,role,passcode_hash,pin_change_required) values(eid,sid,'Chủ quán','owner',extensions.crypt('123456',extensions.gen_salt('bf')),true);
 insert into private.initial_seed_workflows(workflow_id,store_id,requested,template_version,status,created_at,updated_at)
 values(workflow_id,sid,seed_demo,1,case when seed_demo then 'pending' else 'skipped' end,private.write_clock(),private.write_clock());
 if seed_demo then
  foreach stage_name in array array['employee','menu','floor'] loop
   insert into private.initial_seed_stages(workflow_id,stage,stage_id)
   values(workflow_id,stage_name,private.permission_stable_uuid(sid,'initial-seed.v1.'||stage_name));
  end loop;
 end if;
 result:=jsonb_build_object('ok',true,'outcome','applied','data',jsonb_build_object('storeId',sid,'storeNo',sn,'ownerId',eid,
  'seedRequested',seed_demo,'seedWorkflowId',workflow_id));
 insert into private.bootstrap_requests values(sid,req,eid,input,result);
 -- Initial PIN policy stays baseline. It is never returned or replayed here.
 return result;
exception when unique_violation then return private.permission_failure('BOOTSTRAP_CONFLICT');
 when others then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end $$;

-- Public compatibility metadata only; safe before pairing or creating Auth users.
create function public.permission_get_contract() returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_object('permissionContractVersion',2,'writeProtocolVersion',1)
$$;
revoke all on function public.permission_get_contract() from public,anon,authenticated,service_role;
grant execute on function public.permission_get_contract() to anon,authenticated;

create function public.permission_get_store_session() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); s public.stores;
begin
 if sid is null then return private.permission_failure('AUTH_REQUIRED'); end if;
 select * into s from public.stores where id=sid;
 if s.id is null then return private.permission_failure('AUTH_REQUIRED'); end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('storeId',s.id,'storeNo',s.store_no));
exception when others then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end $$;

-- Default privileges in Supabase may expose new functions: always revoke first.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='private' and (p.proname like 'permission_%' or p.proname='assert_store_owner'))
   or (n.nspname='public' and p.proname in ('permission_start_session','permission_revoke_session','permission_get_authority','permission_get_revision','permission_list_roster','permission_change_own_pin','permission_check_required_pin_session','permission_complete_required_pin_change','permission_reserve_store_no','permission_bootstrap_store','permission_get_store_session')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
grant execute on function public.permission_start_session(uuid,text),public.permission_revoke_session(),public.permission_get_authority(),
 public.permission_get_revision(),public.permission_list_roster(),public.permission_change_own_pin(jsonb),public.permission_check_required_pin_session(),
 public.permission_complete_required_pin_change(jsonb),public.permission_bootstrap_store(jsonb) to authenticated;
grant execute on function public.permission_reserve_store_no(uuid) to anon,authenticated;
-- New clients use a stable creation UUID. Retire the non-idempotent allocator.
revoke all on function public.get_next_store_no() from public,anon,authenticated,service_role;
grant execute on function public.permission_get_store_session() to authenticated;
grant usage on schema private to pos_owner_recovery;
grant execute on function private.permission_recover_owner(jsonb) to pos_owner_recovery;
