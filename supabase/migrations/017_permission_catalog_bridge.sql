-- PERM-T02: additive catalog and legacy bridge. No candidate activation.
begin;

create table public.permission_roles (
 code text primary key check(code in ('owner','manager','cashier','waiter','kitchen')),
 label_vi text not null check(length(label_vi)>0),
 enabled boolean not null,
 selectable boolean not null,
 check(enabled = (code <> 'kitchen')),
 check(selectable = (code in ('manager','cashier','waiter')))
);
create table public.permission_catalog (
 code text primary key check(code in ('floor.view','order.create','order.update','order.voidOpen',
  'payment.take','orderHistory.view','order.voidPaid','menu.manage','floor.manage','employee.manage',
  'employee.permission.edit','report.view','settings.manage','data.clearDemo','receipt.reprint')),
 label_vi text not null check(length(label_vi)>0),
 module text not null,
 owner_only boolean not null default false check(owner_only = (code='data.clearDemo')),
 baseline boolean not null default false check(baseline = (code='floor.view'))
);
create table public.role_permission_defaults (
 role_code text not null references public.permission_roles(code),
 permission_code text not null references public.permission_catalog(code),
 primary key(role_code,permission_code),
 check(role_code <> 'kitchen'),
 check(permission_code <> 'data.clearDemo' or role_code='owner')
);
create table public.permission_catalog_state (
 singleton boolean primary key default true check(singleton),
 revision bigint not null default 0 check(revision>=0),
 changed_in_transaction xid8
);
alter table public.employees add column permission_revision bigint not null default 0 check(permission_revision>=0);

insert into public.permission_roles values
 ('owner','Chủ quán',true,false), ('manager','Quản lý',true,true),
 ('cashier','Thu ngân',true,true), ('waiter','Phục vụ',true,true), ('kitchen','Bếp',false,false);
insert into public.permission_catalog(code,label_vi,module,owner_only,baseline) values
 ('floor.view','Xem sơ đồ bàn','floor',false,true),
 ('order.create','Tạo đơn','order',false,false),
 ('order.update','Sửa đơn mở','order',false,false),
 ('order.voidOpen','Hủy đơn mở','order',false,false),
 ('payment.take','Thu tiền','payment',false,false),
 ('orderHistory.view','Xem lịch sử đơn','orderHistory',false,false),
 ('order.voidPaid','Hủy đơn đã thanh toán','orderHistory',false,false),
 ('menu.manage','Quản lý thực đơn','menuEditor',false,false),
 ('floor.manage','Điều chỉnh sơ đồ bàn','floorEditor',false,false),
 ('employee.manage','Quản lý nhân viên','employees',false,false),
 ('employee.permission.edit','Chỉnh quyền nhân viên','employees',false,false),
 ('report.view','Xem báo cáo','report',false,false),
 ('settings.manage','Quản lý thiết lập','settings',false,false),
 ('data.clearDemo','Xóa dữ liệu mẫu','clearDemo',true,false),
 ('receipt.reprint','In lại hóa đơn','receipt',false,false);
insert into public.role_permission_defaults select 'owner',code from public.permission_catalog;
insert into public.role_permission_defaults select 'manager',code from public.permission_catalog
 where code not in ('employee.permission.edit','settings.manage','data.clearDemo');
insert into public.role_permission_defaults values
 ('cashier','floor.view'),('cashier','order.create'),('cashier','order.update'),('cashier','order.voidOpen'),
 ('cashier','payment.take'),('cashier','orderHistory.view'),('cashier','receipt.reprint'),
 ('waiter','floor.view'),('waiter','order.create'),('waiter','order.update');
insert into public.permission_catalog_state(singleton) values(true);

-- Rows serialize catalog maintenance. A transaction with actual row changes
-- increments once; a no-op UPDATE leaves the revision untouched.
create function private.permission_catalog_lock() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform 1 from public.permission_catalog_state where singleton for update;
 if not found then raise exception 'PERMISSION_CATALOG_INVALID' using errcode='23514'; end if;
 return null;
end $$;
create function private.permission_catalog_changed() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if tg_op='UPDATE' and new is not distinct from old then return null; end if;
 update public.permission_catalog_state set revision=revision+1,changed_in_transaction=pg_current_xact_id()
 where singleton and changed_in_transaction is distinct from pg_current_xact_id();
 if not exists(select from public.permission_catalog_state where singleton) then
  raise exception 'PERMISSION_CATALOG_INVALID' using errcode='23514';
 end if;
 return null;
end $$;
create function private.permission_catalog_validate() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if (select count(*) from public.permission_roles)<>5 or (select count(*) from public.permission_catalog)<>15
 or (select count(*) from public.permission_catalog_state)<>1
 or (select count(*) from public.role_permission_defaults where role_code='owner')<>15
 or (select count(*) from public.role_permission_defaults where permission_code='floor.view')<>4 then
  raise exception 'PERMISSION_CATALOG_INVALID' using errcode='23514';
 end if;
 return null;
end $$;
create function private.permission_catalog_no_truncate() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin raise exception 'PERMISSION_CATALOG_INVALID' using errcode='23514'; end $$;
do $$ declare t text; begin
 foreach t in array array['permission_roles','permission_catalog','role_permission_defaults'] loop
  execute format('create trigger catalog_lock before insert or update or delete on public.%I for each statement execute function private.permission_catalog_lock()',t);
  execute format('create trigger catalog_revision after insert or update or delete on public.%I for each row execute function private.permission_catalog_changed()',t);
  execute format('create constraint trigger catalog_invariant after insert or update or delete on public.%I deferrable initially deferred for each row execute function private.permission_catalog_validate()',t);
  execute format('create trigger catalog_no_truncate before truncate on public.%I execute function private.permission_catalog_no_truncate()',t);
 end loop;
end $$;
create constraint trigger catalog_state_invariant after insert or update or delete on public.permission_catalog_state
 deferrable initially deferred for each row execute function private.permission_catalog_validate();
create trigger catalog_no_truncate before truncate on public.permission_catalog_state
 for each statement execute function private.permission_catalog_no_truncate();

-- T05 will consume these registries through authenticated, audited RPCs.
-- No client, service wrapper or publication gets direct registry/key access.
create table private.permission_request_mac_keys (
 key_version integer primary key check(key_version>0),
 secret_bytes bytea not null check(octet_length(secret_bytes)>=32)
);
insert into private.permission_request_mac_keys values(1,extensions.gen_random_bytes(32));
create table private.employee_admin_requests (
 store_id uuid not null references public.stores(id),
 actor_type text not null check(actor_type in ('employee','recovery')),
 actor_key text not null check(length(actor_key)>0),
 request_id uuid not null,
 kind text not null,
 payload_mac bytea not null check(octet_length(payload_mac)=32),
 mac_key_version integer not null references private.permission_request_mac_keys(key_version),
 terminal_outcome jsonb not null,
 audit_keys jsonb not null default '[]' check(jsonb_typeof(audit_keys)='array'),
 primary key(store_id,actor_type,actor_key,request_id)
);
create table private.bootstrap_requests (
 store_id uuid not null references public.stores(id), request_id uuid not null, owner_id uuid not null,
 canonical_input jsonb not null check(jsonb_typeof(canonical_input)='object'),
 outcome jsonb not null,
 primary key(store_id,request_id)
);

-- Internal legacy catalog is intentionally separate from the five candidate roles.
-- Removing admin, denying kitchen overrides or activating new defaults here would
-- change phase-27 semantics. T16 removes this bridge after consumer migration.
create table private.legacy_permission_roles (
 code public.employee_role primary key, modules text[] not null, enabled_in_ui boolean not null
);
create table private.legacy_permission_catalog (code text primary key);
create table private.legacy_permission_defaults (
 role_code public.employee_role references private.legacy_permission_roles(code),
 permission_code text references private.legacy_permission_catalog(code),
 primary key(role_code,permission_code)
);
insert into private.legacy_permission_roles values
 ('admin',array['floor','order','payment','orderHistory','menuEditor','floorEditor','employees','report','settings','clearDemo','kitchen'],true),
 ('cashier',array['floor','order','payment','orderHistory'],true),('kitchen',array['kitchen'],false);
insert into private.legacy_permission_catalog values
 ('order.create'),('order.update'),('order.voidOpen'),('payment.take'),('order.voidPaid');
insert into private.legacy_permission_defaults select 'admin',code from private.legacy_permission_catalog;
insert into private.legacy_permission_defaults select 'cashier',code from private.legacy_permission_catalog where code<>'order.voidPaid';

create function private.legacy_has_employee_permission(p_role public.employee_role,p_overrides jsonb,p_permission text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select case
  when jsonb_exists(coalesce(p_overrides->'denies','[]'::jsonb),p_permission) then false
  when jsonb_exists(coalesce(p_overrides->'grants','[]'::jsonb),p_permission) then true
  when p_permission is null and p_role in ('admin','cashier') then null
  else exists(select from private.legacy_permission_defaults where role_code=p_role and permission_code=p_permission)
 end
$$;
create or replace function public.has_employee_permission(p_role public.employee_role,p_overrides jsonb,p_permission text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select private.legacy_has_employee_permission(p_role,p_overrides,p_permission)
$$;
create function private.legacy_permission_snapshot(p_role public.employee_role,p_overrides jsonb,p_active boolean)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 with rights as (select coalesce(jsonb_agg(code order by code),'[]'::jsonb) codes from private.legacy_permission_catalog
 where private.legacy_has_employee_permission(p_role,p_overrides,code))
 select jsonb_build_object('configuredEffective',rights.codes,'activeGuard',coalesce(p_active,false),
 'actionPermissions',case when p_active then rights.codes else '[]'::jsonb end,
 'accessibleModules',case when p_active then to_jsonb(r.modules) else '[]'::jsonb end,
 'roleEnabledInUi',r.enabled_in_ui) from rights cross join private.legacy_permission_roles r where r.code=p_role
$$;

create function private.normalize_permission_overrides(p_role text,p_overrides jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare grants text[]; denies text[]; defaults text[]; normalized_grants text[]; normalized_denies text[];
begin
 if not exists(select from public.permission_roles where code=p_role) then
  raise exception 'INVALID_EMPLOYEE_REQUEST' using errcode='22023';
 end if;
 if p_overrides is null or p_overrides='null'::jsonb then return null; end if;
 if jsonb_typeof(p_overrides)<>'object' then raise exception 'INVALID_EMPLOYEE_REQUEST' using errcode='22023'; end if;
 if not(p_overrides ?& array['grants','denies']) or (p_overrides-array['grants','denies'])<>'{}'::jsonb
 or jsonb_typeof(p_overrides->'grants')<>'array' or jsonb_typeof(p_overrides->'denies')<>'array' then
  raise exception 'INVALID_EMPLOYEE_REQUEST' using errcode='22023';
 end if;
 if jsonb_array_length(p_overrides->'grants')>100 or jsonb_array_length(p_overrides->'denies')>100 then
  raise exception 'INVALID_EMPLOYEE_REQUEST' using errcode='22023';
 end if;
 if exists(select from jsonb_array_elements((p_overrides->'grants')||(p_overrides->'denies')) x
  where jsonb_typeof(x)<>'string' or not exists(select from public.permission_catalog c where c.code=x#>>'{}')) then
  raise exception 'INVALID_EMPLOYEE_REQUEST' using errcode='22023';
 end if;
 select coalesce(array_agg(distinct x order by x),'{}') into grants from jsonb_array_elements_text(p_overrides->'grants') x;
 select coalesce(array_agg(distinct x order by x),'{}') into denies from jsonb_array_elements_text(p_overrides->'denies') x;
 if exists(select from public.permission_catalog where baseline and code=any(denies)) then
  raise exception 'PERMISSION_BASELINE_REQUIRED' using errcode='22023';
 end if;
 if p_role<>'owner' and exists(select from public.permission_catalog where owner_only and code=any(grants)) then
  raise exception 'OWNER_ONLY_PERMISSION' using errcode='22023';
 end if;
 select coalesce(array_agg(permission_code),'{}') into defaults from public.role_permission_defaults where role_code=p_role;
 select coalesce(array_agg(x order by x),'{}') into normalized_grants from unnest(grants) x where not(x=any(defaults) or x=any(denies));
 select coalesce(array_agg(x order by x),'{}') into normalized_denies from unnest(denies) x where x=any(defaults);
 if cardinality(normalized_grants)+cardinality(normalized_denies)=0 then return null; end if;
 return jsonb_build_object('grants',to_jsonb(normalized_grants),'denies',to_jsonb(normalized_denies));
end $$;
create function private.configured_employee_permissions(p_role text,p_overrides jsonb)
returns text[] language plpgsql stable security definer set search_path=pg_catalog as $$
declare normalized jsonb; result text[];
begin
 normalized:=private.normalize_permission_overrides(p_role,p_overrides);
 select coalesce(array_agg(c.code order by c.code),'{}') into result from public.permission_catalog c
 where (exists(select from public.role_permission_defaults d where d.role_code=p_role and d.permission_code=c.code)
 or coalesce(normalized->'grants','[]'::jsonb) ? c.code)
 and not(coalesce(normalized->'denies','[]'::jsonb) ? c.code);
 return result;
end $$;

-- Harden only new objects; existing grants and employee policies remain intact.
do $$ declare t text; f regprocedure; begin
 foreach t in array array['permission_roles','permission_catalog','role_permission_defaults','permission_catalog_state'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
 foreach t in array array['permission_request_mac_keys','employee_admin_requests','bootstrap_requests',
  'legacy_permission_roles','legacy_permission_catalog','legacy_permission_defaults'] loop
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('permission_catalog_lock','permission_catalog_changed','permission_catalog_validate','permission_catalog_no_truncate',
  'legacy_has_employee_permission','legacy_permission_snapshot','normalize_permission_overrides','configured_employee_permissions') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 end loop;
end $$;
commit;
