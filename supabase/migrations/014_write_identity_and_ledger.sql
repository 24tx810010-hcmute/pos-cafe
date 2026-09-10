-- Protocol v1 foundation. Activation/grants are completed atomically by 016.
-- Never rewrite historical prices or infer a legacy creator from employee_id.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;

create function private.write_clock() returns timestamptz
language sql volatile set search_path = pg_catalog as $$ select clock_timestamp() $$;

create function private.write_error(p_code text, p_details jsonb default null) returns jsonb
language sql immutable set search_path = pg_catalog as $$
select jsonb_build_object('code', p_code, 'message', case p_code
 when 'AUTH_REQUIRED' then 'Chưa ghép cửa hàng. Vui lòng đăng nhập lại.'
 when 'EMPLOYEE_SESSION_REQUIRED' then 'Phiên nhân viên đã hết hiệu lực. Vui lòng nhập lại PIN.'
 when 'INVALID_PIN' then 'PIN không đúng hoặc nhân viên không còn hoạt động.'
 when 'FORBIDDEN' then 'Bạn không có quyền thực hiện thao tác này.'
 when 'INVALID_WRITE_REQUEST' then 'Dữ liệu thao tác không hợp lệ. Vui lòng tải lại và kiểm tra.'
 when 'IDEMPOTENCY_KEY_REUSED' then 'Mã thao tác đã gắn với nội dung khác. Hãy mở lại thao tác đã lưu.'
 when 'OPERATION_NOT_FOUND' then 'Server chưa tìm thấy thao tác này. Chưa thể xác nhận đã thực hiện hay đã hủy.'
 when 'OPERATION_EXPIRED' then 'Lệnh đã hết hạn thực hiện. Đơn vẫn được giữ; hãy kiểm tra và xác nhận một thao tác mới.'
 when 'OPERATION_CANCELLED' then 'Lệnh đã được hủy trước khi thực hiện.'
 when 'ORDER_VERSION_CONFLICT' then 'Đơn đã thay đổi. Hãy tải lại, kiểm tra rồi xác nhận một thao tác mới.'
 when 'TABLE_OCCUPIED' then 'Bàn đã có đơn mở. Hãy mở đơn hiện tại của bàn.'
 when 'NOT_FOUND' then 'Không tìm thấy đơn trong cửa hàng này.'
 when 'TABLE_NOT_FOUND' then 'Bàn không còn khả dụng. Vui lòng chọn lại bàn.'
 when 'ENTITY_ID_CONFLICT' then 'Mã dữ liệu đã được sử dụng. Hãy tải lại trước khi tạo thao tác mới.'
 when 'MENU_ITEM_UNAVAILABLE' then 'Món không còn khả dụng. Vui lòng chọn lại.'
 when 'OPTION_VALUE_UNAVAILABLE' then 'Tùy chọn không còn phù hợp với món. Vui lòng chọn lại.'
 when 'INVALID_ORDER_ITEMS' then 'Các món được chọn không hợp lệ. Vui lòng kiểm tra lại đơn.'
 when 'PAYMENT_AMOUNT_TOO_LOW' then 'Tiền nhận chưa đủ để thanh toán phần đã chọn.'
 when 'VOID_REASON_REQUIRED' then 'Vui lòng chọn lý do hủy và nhập ghi chú nếu chọn lý do khác.'
 when 'PRICE_CHANGED' then 'Giá phần gọi thêm đã thay đổi. Hãy kiểm tra giá mới trước khi xác nhận lại.'
 when 'WRITE_RESULT_UNKNOWN' then 'Chưa xác định kết quả trên server. Hãy tra cứu thao tác trước khi tiếp tục.'
 when 'WRITE_TEMPORARILY_UNAVAILABLE' then 'Chưa thể hoàn tất yêu cầu. Hãy tra cứu và chỉ thử lại cùng thao tác.'
 when 'WRITE_PROTOCOL_UNSUPPORTED' then 'Phiên bản ứng dụng và server chưa tương thích. Tạm dừng ghi và tải lại ứng dụng.'
 when 'RECEIPT_UNAVAILABLE' then 'Đơn chưa thanh toán hoặc đã hủy nên không thể in hóa đơn.'
 else 'Dữ liệu thao tác không hợp lệ. Vui lòng tải lại và kiểm tra.' end, 'details', p_details)
$$;

create function private.write_failure(p_code text, p_details jsonb default null) returns jsonb
language sql immutable set search_path = pg_catalog as $$
 select jsonb_build_object('ok',false,'error',private.write_error(p_code,p_details))
$$;

-- P0400 is reserved for known, durable business rejection. Never catch arbitrary
-- SQL exceptions as a business outcome: deadlocks/faults must roll back the request.
create function private.reject_write(p_code text, p_details jsonb default null) returns void
language plpgsql set search_path = pg_catalog as $$
begin raise exception using errcode='P0400', message=private.write_error(p_code,p_details)::text; end
$$;

create function private.valid_uuid(p_value jsonb) returns boolean
language sql immutable set search_path = pg_catalog as $$
 select coalesce(jsonb_typeof(p_value)='string'
 and (p_value#>>'{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and (p_value#>>'{}') <> '00000000-0000-0000-0000-000000000000',false)
$$;
create function private.valid_integer(p_value jsonb,p_min numeric,p_max numeric) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare n numeric;
begin
 if jsonb_typeof(p_value) is distinct from 'number' then return false; end if;
 n := (p_value#>>'{}')::numeric;
 return n=trunc(n) and n between p_min and p_max;
end $$;
create function private.valid_note(p_value jsonb) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select p_value is null or p_value='null'::jsonb or
 (jsonb_typeof(p_value)='string' and char_length(p_value#>>'{}')<=500)
$$;
-- Match ECMAScript String.trim used by core/UI; PostgreSQL btrim(text) alone
-- removes only U+0020 and would accept a tab/NBSP-only "other" reason.
create function private.trim_whitespace(p_value text) returns text
language sql immutable set search_path=pg_catalog as $$
 select btrim(p_value, (select string_agg(chr(code),'') from unnest(array[
 9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,
 8200,8201,8202,8232,8233,8239,8287,12288,65279]) as x(code)))
$$;
create function private.exact_fields(p_value jsonb,p_required text[],p_optional text[] default '{}') returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
begin
 if jsonb_typeof(p_value) is distinct from 'object' then return false; end if;
 return p_value ?& p_required and not exists(select 1 from jsonb_object_keys(p_value) k where not k=any(p_required||p_optional));
end $$;

create function private.valid_write_payload(p_id uuid,p jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare required text[]; line jsonb; opt jsonb; kind text; action text;
begin
 if p_id is null or p_id='00000000-0000-0000-0000-000000000000'::uuid or
    p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>262144 or
    p->'schemaVersion' is distinct from '1'::jsonb or not private.valid_uuid(p->'orderId') then return false; end if;
 kind:=p->>'kind'; action:=p->>'action';
 required:=array['schemaVersion','kind','orderId','expectedVersion'];
 if kind='submit_order_changes' then
  required:=required||'action'::text;
  if action='create' then
   if not private.exact_fields(p,required||array['orderType','tableId','newLines']) or
      p->'expectedVersion' is distinct from 'null'::jsonb or
      coalesce(p->>'orderType','') not in ('dine_in','takeaway') or
      (p->>'orderType'='dine_in' and not private.valid_uuid(p->'tableId')) or
      (p->>'orderType'='takeaway' and p->'tableId' is distinct from 'null'::jsonb) then return false; end if;
  elsif action='update' then
   if not private.exact_fields(p,required||array['retainedLines','newLines']) or
      not private.valid_integer(p->'expectedVersion',0,2147483647) or
      jsonb_typeof(p->'retainedLines') is distinct from 'array' then return false; end if;
   if jsonb_array_length(p->'retainedLines') not between 1 and 200 then return false; end if;
   for line in select value from jsonb_array_elements(p->'retainedLines') loop
    if not private.exact_fields(line,array['sourceItemId','quantity'],array['note']) or
       not private.valid_uuid(line->'sourceItemId') or not private.valid_integer(line->'quantity',0,999) or not private.valid_note(line->'note') then return false; end if;
   end loop;
  elsif action='void_open' then
   return private.exact_fields(p,required) and private.valid_integer(p->'expectedVersion',0,2147483647);
  else return false;
  end if;
  if jsonb_typeof(p->'newLines') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p->'newLines') not between (case when action='create' then 1 else 0 end) and 200 then return false; end if;
  for line in select value from jsonb_array_elements(p->'newLines') loop
   if not private.exact_fields(line,array['id','menuItemId','quantity','quotedBasePrice','options'],array['note']) or
      not private.valid_uuid(line->'id') or not private.valid_uuid(line->'menuItemId') or
      not private.valid_integer(line->'quantity',1,999) or not private.valid_integer(line->'quotedBasePrice',0,2147483647) or
      not private.valid_note(line->'note') or jsonb_typeof(line->'options') is distinct from 'array' then return false; end if;
   if jsonb_array_length(line->'options')>20 then return false; end if;
   for opt in select value from jsonb_array_elements(line->'options') loop
    if not private.exact_fields(opt,array['id','optionValueId','quantity','quotedPriceDelta']) or
       not private.valid_uuid(opt->'id') or not private.valid_uuid(opt->'optionValueId') or
       not private.valid_integer(opt->'quantity',1,99) or not private.valid_integer(opt->'quotedPriceDelta',0,2147483647) then return false; end if;
   end loop;
  end loop;
 elsif kind in ('pay_order','pay_order_items') then
  required:=required||array['paymentId','method','receivedAmount'];
  if kind='pay_order_items' then required:=required||array['newOrderId','lines']; end if;
  if not private.exact_fields(p,required) or not private.valid_integer(p->'expectedVersion',0,2147483647) or
     not private.valid_uuid(p->'paymentId') or p->>'method' is distinct from 'cash' or
     not private.valid_integer(p->'receivedAmount',0,2147483647) then return false; end if;
  if kind='pay_order_items' then
   if not private.valid_uuid(p->'newOrderId') or jsonb_typeof(p->'lines') is distinct from 'array' then return false; end if;
   if jsonb_array_length(p->'lines') not between 1 and 200 then return false; end if;
   for line in select value from jsonb_array_elements(p->'lines') loop
    if not private.exact_fields(line,array['orderItemId','quantity','splitItemId']) or
       not private.valid_uuid(line->'orderItemId') or not private.valid_uuid(line->'splitItemId') or
       not private.valid_integer(line->'quantity',1,999) then return false; end if;
   end loop;
  end if;
 elsif kind='void_order' then
  if not private.exact_fields(p,required||'reason'::text,array['reasonNote']) or
     not private.valid_integer(p->'expectedVersion',0,2147483647) or
     coalesce(p->>'reason','') not in ('wrong_order','customer_request','out_of_stock','duplicate','other') or
     not private.valid_note(p->'reasonNote') then return false; end if;
 else return false;
 end if;
 -- Duplicate freshly allocated IDs are malformed before registration. Duplicate
 -- retained/source IDs are business provenance errors and remain execute-time.
 if exists(select 1 from jsonb_array_elements(coalesce(p->'newLines','[]')) x group by (x->>'id')::uuid having count(*)>1) or
    exists(select 1 from jsonb_array_elements(coalesce(p->'newLines','[]')) x cross join lateral jsonb_array_elements(x->'options') v group by (v->>'id')::uuid having count(*)>1) or
    exists(select 1 from jsonb_array_elements(coalesce(p->'lines','[]')) x group by (x->>'splitItemId')::uuid having count(*)>1) then return false; end if;
 return true;
end $$;

create table private.employee_sessions (
 token_hash bytea primary key,
 store_id uuid not null references public.stores(id),
 employee_id uuid not null,
 issued_at timestamptz not null,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 foreign key(store_id,employee_id) references public.employees(store_id,id),
 check (expires_at=issued_at+interval '12 hours')
);
create index employee_sessions_employee_idx on private.employee_sessions(store_id,employee_id);
revoke all on private.employee_sessions from public,anon,authenticated;

create function private.employee_token_hash() returns bytea
language sql stable set search_path=pg_catalog as $$
 select extensions.digest(convert_to(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-pos-employee-token',''),'UTF8'),'sha256')
$$;
create function private.current_employee(p_lock boolean default false) returns public.employees
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; s private.employee_sessions; sid uuid:=auth.uid();
begin
 if sid is null then raise exception 'AUTH_REQUIRED' using errcode='P0401'; end if;
 select * into s from private.employee_sessions where token_hash=private.employee_token_hash() and store_id=sid;
 if not found then raise exception 'EMPLOYEE_SESSION_REQUIRED' using errcode='P0401'; end if;
 if p_lock then
  select * into e from public.employees where store_id=sid and id=s.employee_id for share;
  select * into s from private.employee_sessions where token_hash=s.token_hash and store_id=sid for share;
 else select * into e from public.employees where store_id=sid and id=s.employee_id;
 end if;
 if e.id is null or not e.is_active or s.revoked_at is not null or s.expires_at<=private.write_clock() then
  raise exception 'EMPLOYEE_SESSION_REQUIRED' using errcode='P0401';
 end if;
 return e;
end $$;

create function private.require_admin() returns uuid
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees;
begin
 e:=private.current_employee(true);
 if e.role<>'admin'::public.employee_role then raise exception 'FORBIDDEN' using errcode='P0401'; end if;
 return e.id;
end $$;

create function private.safe_employee(e public.employees) returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_object('id',e.id,'name',e.name,'role',e.role,'isActive',e.is_active,'permissionOverrides',e.permission_overrides)
$$;

create function public.start_employee_session(p_employee_id uuid,p_pin text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; token text; issued timestamptz;
begin
 if auth.uid() is null then return private.write_failure('AUTH_REQUIRED'); end if;
 if p_pin is null or p_pin !~ '^[0-9]{6}$' then return private.write_failure('INVALID_PIN'); end if;
 select * into e from public.employees where store_id=auth.uid() and id=p_employee_id for share;
 if not found or not e.is_active or e.passcode_hash<>extensions.crypt(p_pin,e.passcode_hash) then return private.write_failure('INVALID_PIN'); end if;
 token:=rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
 issued:=private.write_clock();
 insert into private.employee_sessions(token_hash,store_id,employee_id,issued_at,expires_at)
 values(extensions.digest(convert_to(token,'UTF8'),'sha256'),auth.uid(),e.id,issued,issued+interval '12 hours');
 return jsonb_build_object('ok',true,'employee',private.safe_employee(e),'token',token,'issuedAt',issued,'expiresAt',issued+interval '12 hours');
end $$;

create function public.revoke_employee_session() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare eid uuid;
begin
 if auth.uid() is null then return private.write_failure('AUTH_REQUIRED'); end if;
 select employee_id into eid from private.employee_sessions where store_id=auth.uid() and token_hash=private.employee_token_hash();
 perform 1 from public.employees where store_id=auth.uid() and id=eid for share;
 update private.employee_sessions set revoked_at=coalesce(revoked_at,private.write_clock()) where store_id=auth.uid() and token_hash=private.employee_token_hash();
 return jsonb_build_object('ok',true);
end $$;

create function private.revoke_changed_employee_sessions() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.passcode_hash is distinct from old.passcode_hash or (old.is_active and not new.is_active) then
  update private.employee_sessions set revoked_at=coalesce(revoked_at,private.write_clock()) where store_id=new.store_id and employee_id=new.id;
 end if;
 return new;
end $$;
create trigger employees_revoke_sessions after update on public.employees for each row execute function private.revoke_changed_employee_sessions();

create function public.bootstrap_store(p_admin_id uuid,p_store_no integer,p_display_name text,p_address text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); email text;
begin
 if sid is null then return private.write_failure('AUTH_REQUIRED'); end if;
 if not private.valid_uuid(to_jsonb(p_admin_id)) or p_store_no is null or p_store_no<=0 or
    p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 120 or
    p_address is null or char_length(btrim(p_address))>500 then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 select u.email into email from auth.users u where u.id=sid;
 if email is distinct from 'store'||p_store_no::text||'@store.pos.local' then return private.write_failure('FORBIDDEN'); end if;
 perform pg_advisory_xact_lock(hashtext(sid::text||':bootstrap'));
 if exists(select 1 from public.stores where id=sid or store_no=p_store_no) or exists(select 1 from public.employees where id=p_admin_id) then
  return private.write_failure('ENTITY_ID_CONFLICT');
 end if;
 insert into public.stores(id,store_no,name,email,seed_status) values(sid,p_store_no,btrim(p_display_name),null,'pending');
 insert into public.store_settings(store_id,display_name,address) values(sid,btrim(p_display_name),btrim(p_address));
 insert into public.employees(id,store_id,name,role,passcode_hash) values(p_admin_id,sid,'Quản lý','admin',extensions.crypt('123456',extensions.gen_salt('bf')));
 return jsonb_build_object('ok',true,'storeId',sid,'storeNo',p_store_no,'adminId',p_admin_id,'adminPin','123456');
end $$;

create function public.create_employee(p_employee_id uuid,p_name text,p_role public.employee_role,p_pin text,p_seed_key text default null) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees;
begin
 perform private.require_admin();
 if not private.valid_uuid(to_jsonb(p_employee_id)) or p_name is null or char_length(btrim(p_name)) not between 1 and 120 or
    p_role is null or p_pin is null or p_pin !~ '^[0-9]{6}$' then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 if exists(select 1 from public.employees where id=p_employee_id) then return private.write_failure('ENTITY_ID_CONFLICT'); end if;
 insert into public.employees(id,store_id,name,role,passcode_hash,seed_key) values(p_employee_id,auth.uid(),btrim(p_name),p_role,extensions.crypt(p_pin,extensions.gen_salt('bf')),p_seed_key) returning * into e;
 return jsonb_build_object('ok',true,'employee',private.safe_employee(e));
exception when sqlstate 'P0401' then return private.write_failure(sqlerrm);
end $$;

create function public.seed_employee(p_employee_id uuid,p_name text,p_role public.employee_role,p_pin text,p_seed_key text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees;
begin
 perform private.require_admin();
 if p_seed_key is null or p_seed_key not like 'demo.%' or p_role='admin' then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 select * into e from public.employees where id=p_employee_id for update;
 if not found then return public.create_employee(p_employee_id,p_name,p_role,p_pin,p_seed_key); end if;
 if e.store_id<>auth.uid() or e.seed_key is distinct from p_seed_key or e.role='admin' then return private.write_failure('ENTITY_ID_CONFLICT'); end if;
 if p_pin is null or p_pin !~ '^[0-9]{6}$' or p_name is null or char_length(btrim(p_name)) not between 1 and 120 or p_role is null then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 update public.employees set name=btrim(p_name),role=p_role,is_active=true,passcode_hash=extensions.crypt(p_pin,extensions.gen_salt('bf')) where id=e.id returning * into e;
 return jsonb_build_object('ok',true,'employee',private.safe_employee(e));
exception when sqlstate 'P0401' then return private.write_failure(sqlerrm);
end $$;

create function public.reset_employee_pin(p_employee_id uuid,p_pin text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
begin
 perform private.require_admin();
 if p_pin is null or p_pin !~ '^[0-9]{6}$' then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 update public.employees set passcode_hash=extensions.crypt(p_pin,extensions.gen_salt('bf')) where store_id=auth.uid() and id=p_employee_id;
 if not found then return private.write_failure('NOT_FOUND'); end if;
 return jsonb_build_object('ok',true);
exception when sqlstate 'P0401' then return private.write_failure(sqlerrm);
end $$;

-- Fail rather than silently repairing historical financial data.
do $$ begin
 if exists(select 1 from public.option_values where price_delta<0) or
    exists(select 1 from public.order_item_options where price_delta<0 or quantity<1) or
    exists(select 1 from public.orders where lock_version<0 or order_no<1) or
    exists(select 1 from public.order_items i where i.unit_price::bigint+coalesce((select sum(o.price_delta::bigint*o.quantity) from public.order_item_options o where o.store_id=i.store_id and o.order_item_id=i.id),0)>2147483647) or
    exists(select 1 from public.order_items i where i.quantity::bigint*(i.unit_price::bigint+coalesce((select sum(o.price_delta::bigint*o.quantity) from public.order_item_options o where o.store_id=i.store_id and o.order_item_id=i.id),0))>2147483647) or
    exists(select 1 from public.order_items i where i.status<>'removed' and (i.quantity not between 1 and 999 or i.menu_item_id is null)) or
    exists(select 1 from public.order_items i where i.status<>'removed' group by i.store_id,i.order_id having count(*)>200) or
    exists(select 1 from public.order_items i where i.status<>'removed' group by i.store_id,i.order_id having
      sum(i.quantity::bigint*(i.unit_price::bigint+coalesce((select sum(o.price_delta::bigint*o.quantity) from public.order_item_options o where o.store_id=i.store_id and o.order_item_id=i.id),0)))>2147483647) then
  raise exception 'IDEMPOTENCY_MIGRATION_PREFLIGHT: invalid legacy money/version/number; inspect raw rows before migration';
 end if;
end $$;
alter table public.option_values add constraint option_values_nonnegative_delta check(price_delta>=0);
alter table public.order_item_options add constraint order_item_options_nonnegative_delta check(price_delta>=0);
alter table public.orders add column created_by_employee_id uuid,
 add column last_modified_by_employee_id uuid,
 add foreign key(store_id,created_by_employee_id) references public.employees(store_id,id),
 add foreign key(store_id,last_modified_by_employee_id) references public.employees(store_id,id),
 add constraint orders_valid_version check(lock_version>=0);
alter table public.payments add column receipt_snapshot jsonb;

create type public.write_operation_status as enum('pending','applied','rejected','cancelled','expired');
create table public.write_operations (
 store_id uuid not null references public.stores(id), operation_id uuid not null,
 schema_version integer not null check(schema_version=1), kind text not null,
 action text, required_permission text not null, payload jsonb not null,
 order_id uuid generated always as ((payload->>'orderId')::uuid) stored,
 registered_at timestamptz not null, expires_at timestamptz not null,
 initiated_by_employee_id uuid not null, status public.write_operation_status not null default 'pending',
 result jsonb, error jsonb, executed_by_employee_id uuid, decided_at timestamptz,
 cancelled_by_employee_id uuid, replay_count bigint not null default 0 check(replay_count>=0),
 primary key(store_id,operation_id),
 foreign key(store_id,initiated_by_employee_id) references public.employees(store_id,id),
 foreign key(store_id,executed_by_employee_id) references public.employees(store_id,id),
 foreign key(store_id,cancelled_by_employee_id) references public.employees(store_id,id),
 check(expires_at=registered_at+interval '24 hours'),
 check(private.valid_write_payload(operation_id,payload)),
 check(kind=payload->>'kind' and action is not distinct from payload->>'action'),
 check((status='pending' and result is null and error is null and decided_at is null and executed_by_employee_id is null and cancelled_by_employee_id is null)
 or (status='applied' and result is not null and error is null and decided_at is not null and executed_by_employee_id is not null and cancelled_by_employee_id is null)
 or (status='rejected' and result is null and error is not null and decided_at is not null and executed_by_employee_id is null and cancelled_by_employee_id is null)
 or (status='cancelled' and result is null and error is null and decided_at is not null and executed_by_employee_id is null and cancelled_by_employee_id is not null)
 or (status='expired' and result is null and error is null and decided_at is not null and executed_by_employee_id is null and cancelled_by_employee_id is null))
);
create index write_operations_recent_idx on public.write_operations(store_id,registered_at desc,operation_id desc);
create index write_operations_order_idx on public.write_operations(store_id,order_id,registered_at desc,operation_id desc);
create index write_operations_expiry_idx on public.write_operations(store_id,status,expires_at);
create table public.order_events (
 id uuid primary key,store_id uuid not null references public.stores(id),operation_id uuid not null,
 action text not null,source_order_id uuid not null,result_order_id uuid,payment_id uuid,
 initiated_by uuid not null,executed_by uuid not null,occurred_at timestamptz not null,
 before_version integer,after_version integer not null,summary jsonb not null,
 unique(store_id,operation_id),
 foreign key(store_id,operation_id) references public.write_operations(store_id,operation_id),
 foreign key(store_id,source_order_id) references public.orders(store_id,id),
 foreign key(store_id,result_order_id) references public.orders(store_id,id),
 foreign key(store_id,payment_id) references public.payments(store_id,id),
 foreign key(store_id,initiated_by) references public.employees(store_id,id),
 foreign key(store_id,executed_by) references public.employees(store_id,id)
);
alter table public.write_operations enable row level security;
alter table public.order_events enable row level security;
revoke all on public.write_operations,public.order_events from public,anon,authenticated;

create function private.immutable_operation() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception 'IMMUTABLE_OPERATION'; end if;
 if (to_jsonb(new)-array['order_id','status','result','error','executed_by_employee_id','decided_at','cancelled_by_employee_id','replay_count'])
 is distinct from (to_jsonb(old)-array['order_id','status','result','error','executed_by_employee_id','decided_at','cancelled_by_employee_id','replay_count']) then raise exception 'IMMUTABLE_OPERATION'; end if;
 if old.status<>'pending' and (to_jsonb(new)-array['order_id','replay_count']) is distinct from (to_jsonb(old)-array['order_id','replay_count']) then raise exception 'IMMUTABLE_OPERATION'; end if;
 return new;
end $$;
create trigger write_operations_immutable before update or delete on public.write_operations for each row execute function private.immutable_operation();
create function private.immutable_event() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'IMMUTABLE_ORDER_EVENT'; end $$;
create trigger order_events_immutable before update or delete on public.order_events for each row execute function private.immutable_event();

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.start_employee_session(uuid,text),public.revoke_employee_session(),public.bootstrap_store(uuid,integer,text,text),public.create_employee(uuid,text,public.employee_role,text,text),public.seed_employee(uuid,text,public.employee_role,text,text),public.reset_employee_pin(uuid,text) from public,anon,authenticated;
commit;
