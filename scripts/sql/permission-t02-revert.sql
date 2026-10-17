-- Rehearsal only, before activation. Caller must prove the dedicated fixture.
-- RESTRICT is intentional: later consumers make this revert refuse, not cascade.
begin;
lock table public.employees in access exclusive mode;
do $$ begin
 if (select udt_name from information_schema.columns where table_schema='public' and table_name='employees' and column_name='role')<>'employee_role'
 or exists(select from public.employees where permission_revision<>0)
 or exists(select from private.employee_admin_requests)
 or exists(select from private.bootstrap_requests) then
  raise exception 'PERMISSION_REVERT_AFTER_USE_REFUSED';
 end if;
end $$;
-- Original 012 implementation; CREATE OR REPLACE preserves the original ACL.
create or replace function public.has_employee_permission(p_role public.employee_role,p_overrides jsonb,p_permission text)
returns boolean language sql immutable security invoker as $$
  select case
    when jsonb_exists(coalesce(p_overrides->'denies', '[]'::jsonb), p_permission) then false
    when jsonb_exists(coalesce(p_overrides->'grants', '[]'::jsonb), p_permission) then true
    when p_role = 'admin'::public.employee_role
      then p_permission in (
        'order.create',
        'order.update',
        'order.voidOpen',
        'payment.take',
        'order.voidPaid'
      )
    when p_role = 'cashier'::public.employee_role
      then p_permission in (
        'order.create',
        'order.update',
        'order.voidOpen',
        'payment.take'
      )
    else false
  end
$$;
alter function public.has_employee_permission(public.employee_role,jsonb,text) reset all;
drop function private.legacy_permission_snapshot(public.employee_role,jsonb,boolean);
drop function private.legacy_has_employee_permission(public.employee_role,jsonb,text);
drop function private.configured_employee_permissions(text,jsonb);
drop function private.normalize_permission_overrides(text,jsonb);
drop table private.legacy_permission_defaults;
drop table private.legacy_permission_catalog;
drop table private.legacy_permission_roles;
drop table private.employee_admin_requests;
drop table private.bootstrap_requests;
drop table private.permission_request_mac_keys;
drop table public.role_permission_defaults;
drop table public.permission_catalog;
drop table public.permission_roles;
drop table public.permission_catalog_state;
drop function private.permission_catalog_changed();
drop function private.permission_catalog_lock();
drop function private.permission_catalog_validate();
drop function private.permission_catalog_no_truncate();
alter table public.employees drop column permission_revision;
commit;
