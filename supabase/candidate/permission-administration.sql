-- PERM-T05 staged fragment, after permission-identity.sql. Not an activation launcher.
alter table public.employee_admin_audit add column details jsonb;
create index employee_admin_audit_page on public.employee_admin_audit(store_id,occurred_at desc);

-- Rotation appends a version. Old secrets/versions must remain stable for replay.
create function private.permission_mac_keys_immutable() returns trigger
language plpgsql set search_path=pg_catalog as $$ begin raise exception 'PERMISSION_MAC_KEY_IMMUTABLE'; end $$;
create trigger permission_mac_keys_immutable before update or delete or truncate on private.permission_request_mac_keys
 for each statement execute function private.permission_mac_keys_immutable();

create function private.permission_admin_failure(code text,details jsonb default null) returns jsonb
language plpgsql volatile set search_path=pg_catalog as $$
declare message text; labels text;
begin
 message:=case code
  when 'AUTH_REQUIRED' then 'Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.'
  when 'EMPLOYEE_SESSION_REQUIRED' then 'Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.'
  when 'NOT_FOUND' then 'Không tìm thấy dữ liệu được phép truy cập.'
  when 'SELF_PERMISSION_EDIT_FORBIDDEN' then 'Bạn không thể tự sửa vai trò hoặc quyền của mình.'
  when 'SELF_DISABLE_FORBIDDEN' then 'Bạn không thể tự tạm khóa tài khoản đang dùng.'
  when 'OWNER_ONLY_PERMISSION' then 'Quyền này chỉ dành cho chủ quán.'
  when 'PERMISSION_BASELINE_REQUIRED' then 'Quyền xem sơ đồ bàn luôn được cấp và không thể tắt.'
  when 'PERMISSION_CATALOG_STALE' then 'Danh mục quyền đã thay đổi. Tải lại trước khi lưu.'
  when 'PERMISSION_REFRESH_UNAVAILABLE' then 'Chưa xác minh được quyền. Kiểm tra kết nối và thử lại.'
  else private.permission_failure(code)->'error'->>'message' end;
 if code='PERMISSION_CEILING_EXCEEDED' then
  select string_agg(label_vi,', ' order by p.code) into labels from public.permission_catalog p where details->'missingPermissions' ? p.code;
  message:='Không thể quản lý nhân viên này vì vượt quyền của bạn. Quyền còn thiếu: '||coalesce(labels,'')||'.';
 end if;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'message',message,'details',details));
end $$;
create function private.permission_admin_view(e public.employees) returns jsonb
language sql volatile set search_path=pg_catalog as $$
 select private.permission_employee_snapshot(e)||jsonb_build_object('sources',private.permission_authority_json(e)->'sources')
$$;
create function private.permission_valid_revision(value jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$ begin
 if jsonb_typeof(value) is distinct from 'number' then return false; end if;
 if value::text !~ '^[0-9]+$' then return false; end if;
 return value::text::numeric<=9007199254740991;
end $$;

-- The request body is syntactically canonical JSONB for the MAC, independent of
-- catalog changes. Missing fields and explicit null remain different requests.
create function private.permission_admin_execute(kind text,p jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); aid uuid; tid uuid; req uuid; row_id uuid; session_row record;
 a public.employees; before_e public.employees; after_e public.employees; prior private.employee_admin_requests;
 mac_key private.permission_request_mac_keys; payload_mac bytea; patch jsonb; why text; details jsonb;
 actor_rights text[]; before_rights text[]; after_rights text[]; missing text[]; required text[]:=array[]::text[];
 catrev bigint; normalized jsonb; changed boolean:=false; credential_changed boolean:=false;
 before_json jsonb; proposed_json jsonb; actual_json jsonb; result jsonb; outcome text;
 has_read boolean; is_create boolean:=kind='create_employee'; audit_kind text;
 action_error text; candidate_valid boolean;
begin
 if sid is null then return private.permission_admin_failure('AUTH_REQUIRED'); end if;
 -- For malformed identity fields there is no honest request/target audit key.
 if kind not in ('create_employee','update_employee','reset_pin') or jsonb_typeof(p) is distinct from 'object'
 or not private.valid_uuid(p->'requestId') or not private.valid_uuid(p->case when is_create then 'id' else 'targetId' end) then
  perform private.permission_current_employee();
  return private.permission_admin_failure('INVALID_EMPLOYEE_REQUEST');
 end if;
 req:=(p->>'requestId')::uuid; tid:=(p->>case when is_create then 'id' else 'targetId' end)::uuid;
 select employee_id into aid from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash();
 perform private.permission_store_mutex(sid);
 -- A client-chosen global employee UUID can collide across stores. Serialize
 -- insert attempts before the final auth checkpoint, never lock foreign rows.
 if is_create then perform pg_advisory_xact_lock(hashtextextended('employee-create:'||tid::text,0)); end if;
 for row_id in select id from public.employees where store_id=sid and id in (aid,tid) order by id loop
  if row_id=tid then perform 1 from public.employees where store_id=sid and id=row_id for update;
  else perform 1 from public.employees where store_id=sid and id=row_id for share; end if;
 end loop;
 for session_row in select token_hash,employee_id from private.employee_sessions
  where store_id=sid and (employee_id=tid or token_hash=private.employee_token_hash()) order by token_hash loop
  if session_row.employee_id=tid then perform 1 from private.employee_sessions where token_hash=session_row.token_hash for update;
  else perform 1 from private.employee_sessions where token_hash=session_row.token_hash for share; end if;
 end loop;
 select * into prior from private.employee_admin_requests r where r.store_id=sid and r.actor_type='employee' and r.actor_key=aid::text and r.request_id=req;
 select * into mac_key from private.permission_request_mac_keys where key_version=coalesce(prior.mac_key_version,(select max(key_version) from private.permission_request_mac_keys)) for share;
 if mac_key.key_version is null then return private.permission_admin_failure('PERMISSION_UPDATE_UNAVAILABLE'); end if;
 perform private.permission_catalog_share();
 a:=private.permission_current_employee(false);
 select * into before_e from public.employees where store_id=sid and id=tid;
 actor_rights:=private.configured_employee_permissions(a.role,a.permission_overrides);
 catrev:=(select revision from public.permission_catalog_state where singleton);
 has_read:='employee.manage'=any(actor_rights) or 'employee.permission.edit'=any(actor_rights);
 patch:=case when kind='update_employee' then p->'patch' else p end;
 if kind in ('create_employee','reset_pin') then required:=array['employee.manage'];
 elsif jsonb_typeof(patch)='object' and patch ?| array['name','role','isActive'] then required:=array['employee.manage']; end if;
 if kind in ('create_employee','update_employee') and jsonb_typeof(patch)='object' and patch ? 'overrides' then required:=array_append(required,'employee.permission.edit'); end if;
 if not has_read or not required<@actor_rights then why:='FORBIDDEN'; end if;
 -- Scope errors reveal neither a foreign row nor audit of that row.
 if (not is_create and before_e.id is null) or (is_create and before_e.id is null and exists(select 1 from public.employees where id=tid)) then
  return private.permission_admin_failure(case when why is not null then why else 'NOT_FOUND' end);
 end if;
 payload_mac:=extensions.hmac(convert_to(jsonb_build_object('kind',kind,'targetId',tid,'payload',p)::text,'UTF8'),mac_key.secret_bytes,'sha256');
 if prior.request_id is not null then
  if why is not null then return private.permission_admin_failure(why); end if;
  if prior.payload_mac<>payload_mac then return private.permission_admin_failure('ADMIN_REQUEST_REUSED'); end if;
  if prior.terminal_outcome->>'ok'='true' then return prior.terminal_outcome||jsonb_build_object('outcome','replayed'); end if;
  return prior.terminal_outcome;
 end if;
 if before_e.id is not null then actual_json:=private.permission_employee_snapshot(before_e); end if;
 if not is_create then before_json:=actual_json; end if;
 after_e:=before_e;
 action_error:=why; why:=null;

 -- Shape/field validation is separate from catalog-dependent normalization.
 if why is null then
  if is_create then
   if not p ?& array['requestId','id','name','role','pin','expectedCatalogRevision']
    or p-array['requestId','id','name','role','pin','expectedCatalogRevision','overrides']<>'{}' then why:='INVALID_EMPLOYEE_REQUEST'; end if;
  elsif kind='update_employee' then
   if not p ?& array['requestId','targetId','expectedRevision','patch'] or p-array['requestId','targetId','expectedRevision','expectedCatalogRevision','patch']<>'{}'
    or jsonb_typeof(patch) is distinct from 'object' then why:='INVALID_EMPLOYEE_REQUEST';
   elsif patch-array['name','role','isActive','overrides']<>'{}' then why:='INVALID_EMPLOYEE_REQUEST'; end if;
  else
   if not p ?& array['requestId','targetId','expectedRevision','newPin'] or p-array['requestId','targetId','expectedRevision','newPin']<>'{}' then why:='INVALID_EMPLOYEE_REQUEST'; end if;
  end if;
 end if;
 if why is null then
  if (is_create or patch ? 'name') and (jsonb_typeof(patch->'name') is distinct from 'string' or char_length(private.permission_trim(patch->>'name')) not between 1 and 120) then
   why:='INVALID_EMPLOYEE_REQUEST'; details:=jsonb_build_object('fieldErrors',jsonb_build_object('name',case when char_length(private.permission_trim(patch->>'name'))>120 then 'Tên nhân viên tối đa 120 ký tự.' else 'Tên nhân viên không được để trống.' end));
  elsif (is_create or kind='reset_pin') and (jsonb_typeof(p->case when is_create then 'pin' else 'newPin' end) is distinct from 'string' or (p->>case when is_create then 'pin' else 'newPin' end) !~ '^[0-9]{6}$') then
   why:='INVALID_EMPLOYEE_REQUEST'; details:=jsonb_build_object('fieldErrors',jsonb_build_object('pin','PIN phải gồm đúng 6 chữ số.'));
  elsif kind='update_employee' and patch ? 'isActive' and jsonb_typeof(patch->'isActive') is distinct from 'boolean' then why:='INVALID_EMPLOYEE_REQUEST';
  elsif not is_create and not private.permission_valid_revision(p->'expectedRevision') then why:='INVALID_EMPLOYEE_REQUEST';
  elsif (is_create or (kind='update_employee' and patch ?| array['role','overrides']) or p ? 'expectedCatalogRevision') and not private.permission_valid_revision(p->'expectedCatalogRevision') then why:='INVALID_EMPLOYEE_REQUEST';
  end if;
 end if;
 candidate_valid:=why is null;
 if why is null then
  -- Presence, rather than difference, protects self permissions and explicit reset.
  if not is_create and aid=tid and kind='update_employee' and patch ?| array['role','overrides'] then why:='SELF_PERMISSION_EDIT_FORBIDDEN';
  elsif not is_create and aid=tid and kind='update_employee' and patch->'isActive'='false'::jsonb then why:='SELF_DISABLE_FORBIDDEN';
  elsif not is_create and aid=tid and kind='reset_pin' then why:='FORBIDDEN';
  elsif not is_create and before_e.role='owner' and aid<>tid then why:='OWNER_PROTECTED';
  elsif kind in ('create_employee','update_employee') and patch->>'role'='owner' then why:='OWNER_PROTECTED';
  elsif (is_create or (kind='update_employee' and patch ? 'role')) and (jsonb_typeof(patch->'role') is distinct from 'string' or not exists(select 1 from public.permission_roles where code=patch->>'role' and selectable and enabled)) then why:='INVALID_EMPLOYEE_REQUEST';
  end if;
 end if;
 if why is null then
  if not is_create and (p->>'expectedRevision')::bigint<>before_e.permission_revision then why:='EMPLOYEE_VERSION_CONFLICT';
  elsif p ? 'expectedCatalogRevision' and (p->>'expectedCatalogRevision')::bigint<>catrev then why:='PERMISSION_CATALOG_STALE'; end if;
 end if;
 if candidate_valid and (not (is_create or (kind='update_employee' and patch ? 'role'))
   or exists(select 1 from public.permission_roles where code=patch->>'role' and enabled))
   and (not (p ? 'expectedCatalogRevision') or case when private.permission_valid_revision(p->'expectedCatalogRevision') then (p->>'expectedCatalogRevision')::numeric=catrev else false end) then
  -- A denied but independently valid proposal is still useful audit evidence.
  -- Catalog-stale or unparseable input never gets a fabricated proposal.
  if is_create then
   after_e.id:=tid; after_e.store_id:=sid; after_e.name:=private.permission_trim(p->>'name'); after_e.role:=p->>'role'; after_e.is_active:=true; after_e.permission_revision:=0; after_e.permission_overrides:=null;
  elsif kind='update_employee' then
   if patch ? 'name' then after_e.name:=private.permission_trim(patch->>'name'); end if;
   if patch ? 'isActive' then after_e.is_active:=(patch->>'isActive')::boolean; end if;
   if patch ? 'role' and patch->>'role'<>before_e.role then after_e.role:=patch->>'role'; after_e.permission_overrides:=null; end if;
  end if;
  -- User decision T05: discard OLD overrides on role change, then apply an
  -- explicitly supplied NEW override set in that same atomic request.
  begin
   if kind in ('create_employee','update_employee') and patch ? 'overrides' then
    normalized:=private.normalize_permission_overrides(after_e.role,nullif(patch->'overrides','null'::jsonb));
    after_e.permission_overrides:=normalized;
   end if;
   proposed_json:=private.permission_employee_snapshot(after_e);
  exception when sqlstate 'P0001' or sqlstate '22023' then
   if sqlerrm in ('INVALID_EMPLOYEE_REQUEST','PERMISSION_BASELINE_REQUIRED','OWNER_ONLY_PERMISSION') then why:=coalesce(why,sqlerrm); else raise; end if;
  end;
 end if;
 why:=coalesce(action_error,why);
 if action_error is not null then details:=null; end if;
 if why is null and is_create and before_e.id is not null then why:='INVALID_EMPLOYEE_REQUEST'; end if;
 if why is null and a.role<>'owner' then
  before_rights:=case when is_create then array[]::text[] else private.configured_employee_permissions(before_e.role,before_e.permission_overrides) end;
  after_rights:=private.configured_employee_permissions(after_e.role,after_e.permission_overrides);
  select coalesce(array_agg(code order by code),array[]::text[]) into missing from (select unnest(before_rights||after_rights) code except select unnest(actor_rights)) m;
  if cardinality(missing)>0 then why:='PERMISSION_CEILING_EXCEEDED'; details:=jsonb_build_object('missingPermissions',missing); end if;
 end if;
 if why is null then
  if is_create then
   insert into public.employees(id,store_id,name,role,is_active,permission_overrides,permission_revision,passcode_hash)
   values(tid,sid,after_e.name,after_e.role,true,after_e.permission_overrides,0,extensions.crypt(p->>'pin',extensions.gen_salt('bf'))) returning * into after_e;
   changed:=true;
  elsif kind='reset_pin' then
   credential_changed:=before_e.passcode_hash<>extensions.crypt(p->>'newPin',before_e.passcode_hash); changed:=credential_changed;
   if changed then update public.employees set passcode_hash=extensions.crypt(p->>'newPin',extensions.gen_salt('bf')),permission_revision=permission_revision+1 where id=tid and store_id=sid returning * into after_e; end if;
  else
   changed:=row(after_e.name,after_e.role,after_e.is_active,after_e.permission_overrides) is distinct from row(before_e.name,before_e.role,before_e.is_active,before_e.permission_overrides);
   if changed then update public.employees set name=after_e.name,role=after_e.role,is_active=after_e.is_active,permission_overrides=after_e.permission_overrides,permission_revision=permission_revision+1 where id=tid and store_id=sid returning * into after_e; end if;
  end if;
  if changed then
   insert into public.store_change_signals values(sid,'permission',1,req,tid)
   on conflict(store_id,topic) do update set revision=public.store_change_signals.revision+1,event_id=req,target_id=tid;
  end if;
  outcome:=case when changed then 'applied' else 'noop' end;
  actual_json:=private.permission_employee_snapshot(after_e);
  result:=jsonb_build_object('ok',true,'outcome',outcome,'data',private.permission_admin_view(after_e));
 else outcome:='denied'; result:=private.permission_admin_failure(why,details);
 end if;
 audit_kind:=kind;
 insert into public.employee_admin_audit(store_id,actor_type,actor_key,request_id,target_id,kind,outcome,reason,before_snapshot,proposed_after,actual_after,actor_effective,catalog_revision,credential_changed,occurred_at,details)
 values(sid,'employee',aid::text,req,tid,audit_kind,outcome,why,before_json,proposed_json,actual_json,actor_rights,catrev,credential_changed,private.write_clock(),details);
 insert into private.employee_admin_requests(store_id,actor_type,actor_key,request_id,kind,payload_mac,mac_key_version,terminal_outcome,audit_keys)
 values(sid,'employee',aid::text,req,kind,payload_mac,mac_key.key_version,result,jsonb_build_array(jsonb_build_array(sid,'employee',aid,req,tid)));
 return result;
exception when sqlstate 'P0401' then return private.permission_admin_failure(sqlerrm);
 when others then return private.permission_admin_failure('PERMISSION_UPDATE_UNAVAILABLE');
end $$;
create function public.permission_admin_create(p_request jsonb) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $$ select private.permission_admin_execute('create_employee',p_request) $$;
create function public.permission_admin_update(p_request jsonb) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $$ select private.permission_admin_execute('update_employee',p_request) $$;
create function public.permission_admin_reset_pin(p_request jsonb) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $$ select private.permission_admin_execute('reset_pin',p_request) $$;

create function public.permission_admin_list() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare a public.employees; rights text[]; result jsonb;
begin
 a:=private.permission_current_employee(); rights:=private.configured_employee_permissions(a.role,a.permission_overrides);
 if not (rights && array['employee.manage','employee.permission.edit']) then return private.permission_admin_failure('FORBIDDEN'); end if;
 select coalesce(jsonb_agg(private.permission_admin_view(e) order by e.name,e.id),'[]') into result from public.employees e where store_id=a.store_id;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_admin_failure(sqlerrm);
 when others then return private.permission_admin_failure('PERMISSION_REFRESH_UNAVAILABLE'); end $$;
create function public.permission_admin_get(p_target_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare a public.employees; e public.employees; rights text[];
begin
 a:=private.permission_current_employee(); rights:=private.configured_employee_permissions(a.role,a.permission_overrides);
 if not (rights && array['employee.manage','employee.permission.edit']) then return private.permission_admin_failure('FORBIDDEN'); end if;
 select * into e from public.employees where store_id=a.store_id and id=p_target_id;
 if e.id is null then return private.permission_admin_failure('NOT_FOUND'); end if;
 return jsonb_build_object('ok',true,'data',private.permission_admin_view(e));
exception when sqlstate 'P0401' then return private.permission_admin_failure(sqlerrm);
 when others then return private.permission_admin_failure('PERMISSION_REFRESH_UNAVAILABLE'); end $$;

create function private.permission_base64url(value bytea) returns text
language sql immutable set search_path=pg_catalog as $$ select rtrim(translate(replace(encode(value,'base64'),E'\n',''),'+/','-_'),'=') $$;
create function private.permission_audit_key(a public.employee_admin_audit) returns text
language sql immutable set search_path=pg_catalog as $$
 select private.permission_base64url(convert_to(jsonb_build_array(a.store_id,a.actor_type,a.actor_key,a.request_id,a.target_id)::text,'UTF8'))
$$;
create function private.permission_audit_view(a public.employee_admin_audit) returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_object('auditKey',private.permission_audit_key(a),'storeId',a.store_id,'actorType',a.actor_type,'actorKey',a.actor_key,
  'requestId',a.request_id,'targetId',a.target_id,'occurredAt',a.occurred_at,'kind',a.kind,'outcome',a.outcome,'reason',a.reason,
  'actorEffective',a.actor_effective,'catalogRevision',a.catalog_revision,'before',a.before_snapshot,'proposedAfter',a.proposed_after,
  'actualAfter',a.actual_after,'credentialChanged',a.credential_changed,'details',a.details,'operatorCaseRef',a.operator_case_ref,'operatorProofRef',a.operator_proof_ref)
$$;
create function public.permission_admin_audit(p_filter jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare a public.employees; rights text[]; target uuid; outcome_filter text; page_limit integer:=50;
 key private.permission_request_mac_keys; cursor_body jsonb; cursor_bytes text; supplied_mac text; expected_mac text;
 last_at timestamptz; last_key text; next_cursor text; result jsonb:='[]'::jsonb; n integer:=0; entry record; last_returned public.employee_admin_audit;
begin
 a:=private.permission_current_employee(); rights:=private.configured_employee_permissions(a.role,a.permission_overrides);
 if a.role<>'owner' and not 'employee.permission.edit'=any(rights) then return private.permission_admin_failure('FORBIDDEN'); end if;
 if jsonb_typeof(p_filter) is distinct from 'object' or p_filter-array['cursor','limit','targetId','outcome']<>'{}' then return private.permission_admin_failure('INVALID_EMPLOYEE_REQUEST'); end if;
 if p_filter ? 'limit' then
  if not private.permission_valid_revision(p_filter->'limit') then return private.permission_admin_failure('INVALID_EMPLOYEE_REQUEST'); end if;
  if (p_filter->>'limit')::numeric not between 1 and 100 then return private.permission_admin_failure('INVALID_EMPLOYEE_REQUEST'); end if;
  page_limit:=(p_filter->>'limit')::integer;
 end if;
 if p_filter ? 'targetId' then
  if not private.valid_uuid(p_filter->'targetId') then return private.permission_admin_failure('INVALID_EMPLOYEE_REQUEST'); end if;
  target:=(p_filter->>'targetId')::uuid;
 end if;
 if p_filter ? 'outcome' then
  if jsonb_typeof(p_filter->'outcome') is distinct from 'string' or p_filter->>'outcome' not in ('applied','denied','noop') then return private.permission_admin_failure('INVALID_EMPLOYEE_REQUEST'); end if;
  outcome_filter:=p_filter->>'outcome';
 end if;
 if p_filter ? 'cursor' then
  begin
   if jsonb_typeof(p_filter->'cursor') is distinct from 'string' or length(p_filter->>'cursor')>8192 or (p_filter->>'cursor') !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$' then raise exception 'invalid cursor'; end if;
   cursor_bytes:=split_part(p_filter->>'cursor','.',1); supplied_mac:=split_part(p_filter->>'cursor','.',2);
   cursor_body:=convert_from(decode(translate(cursor_bytes,'-_','+/')||repeat('=',(4-length(cursor_bytes)%4)%4),'base64'),'UTF8')::jsonb;
   select * into key from private.permission_request_mac_keys where key_version=(cursor_body->>'keyVersion')::integer;
   expected_mac:=private.permission_base64url(extensions.hmac(convert_to('employee-audit-cursor:'||cursor_bytes,'UTF8'),key.secret_bytes,'sha256'));
   if key.key_version is null or expected_mac is distinct from supplied_mac or cursor_body->>'version'<>'1'
    or cursor_body->>'storeId' is distinct from a.store_id::text or cursor_body->>'targetId' is distinct from target::text or cursor_body->>'outcome' is distinct from outcome_filter then raise exception 'invalid cursor'; end if;
   last_at:=(cursor_body->>'lastAt')::timestamptz; last_key:=cursor_body->>'lastKey';
   if last_at is null or last_key is null then raise exception 'invalid cursor'; end if;
  exception when others then return private.permission_admin_failure('INVALID_EMPLOYEE_REQUEST'); end;
 end if;
 if target is not null and not exists(select 1 from public.employees where store_id=a.store_id and id=target)
 and not exists(select 1 from public.employee_admin_audit where store_id=a.store_id and target_id=target) then return private.permission_admin_failure('NOT_FOUND'); end if;
 for entry in select r as audit_row,private.permission_audit_key(r) as audit_key from public.employee_admin_audit r
  where r.store_id=a.store_id and (target is null or r.target_id=target) and (outcome_filter is null or r.outcome=outcome_filter)
  and (last_at is null or r.occurred_at<last_at or (r.occurred_at=last_at and private.permission_audit_key(r) collate "C"<last_key collate "C"))
  order by r.occurred_at desc,private.permission_audit_key(r) collate "C" desc limit page_limit+1 loop
  n:=n+1;
  if n<=page_limit then result:=result||jsonb_build_array(private.permission_audit_view(entry.audit_row)); last_returned:=entry.audit_row;
  else
   select * into key from private.permission_request_mac_keys order by key_version desc limit 1;
   cursor_body:=jsonb_build_object('version',1,'keyVersion',key.key_version,'storeId',a.store_id,'targetId',target,'outcome',outcome_filter,
    'lastAt',last_returned.occurred_at,'lastKey',private.permission_audit_key(last_returned));
   cursor_bytes:=private.permission_base64url(convert_to(cursor_body::text,'UTF8'));
   next_cursor:=cursor_bytes||'.'||private.permission_base64url(extensions.hmac(convert_to('employee-audit-cursor:'||cursor_bytes,'UTF8'),key.secret_bytes,'sha256'));
  end if;
 end loop;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('rows',result,'nextCursor',next_cursor));
exception when sqlstate 'P0401' then return private.permission_admin_failure(sqlerrm);
 when others then return private.permission_admin_failure('PERMISSION_REFRESH_UNAVAILABLE'); end $$;

-- The candidate fragment owns its ACL closure; tests must not rely on fixture
-- broad revokes to hide a missing production grant/revoke statement here.
revoke all on public.employees,public.employee_admin_audit from public,anon,authenticated,service_role;
-- A table-level REVOKE does not remove the column grants from migration 016.
do $$ declare c record; begin
 for c in select attname from pg_attribute where attrelid='public.employees'::regclass and attnum>0 and not attisdropped loop
  execute format('revoke select(%1$I),insert(%1$I),update(%1$I),references(%1$I) on public.employees from public,anon,authenticated,service_role',c.attname);
 end loop;
end $$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and (p.proname like 'permission_admin_%' or p.proname like 'permission_audit_%' or p.proname in ('permission_valid_revision','permission_base64url','permission_mac_keys_immutable')))
 or (n.nspname='public' and (p.proname like 'permission_admin_%' or p.proname in ('create_employee','update_employee','reset_employee_pin','seed_employee','verify_employee_pin','hash_employee_pin','start_employee_session','revoke_employee_session','bootstrap_store'))) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
grant execute on function public.permission_admin_create(jsonb),public.permission_admin_update(jsonb),public.permission_admin_reset_pin(jsonb),
 public.permission_admin_list(),public.permission_admin_get(uuid),public.permission_admin_audit(jsonb) to authenticated;
