create or replace function public.get_next_store_no()
returns integer
language sql
security definer
set search_path = public
as $$
  select nextval('public.store_no_seq')::integer;
$$;

create or replace function public.hash_employee_pin(p_pin text)
returns text
language sql
security definer
set search_path = public
as $$
  select crypt(p_pin, gen_salt('bf'));
$$;

create or replace function public.verify_employee_pin(
  p_employee_id uuid,
  p_pin text
) returns table (
  id uuid,
  name text,
  role public.employee_role
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select e.id, e.name, e.role
  from public.employees e
  where e.store_id = auth.uid()
    and e.id = p_employee_id
    and e.is_active = true
    and e.passcode_hash = crypt(p_pin, e.passcode_hash);

  if not found then
    raise exception 'INVALID_PIN'
      using errcode = 'P0001',
            hint = 'Employee must be active and PIN must match.';
  end if;
end;
$$;

create or replace function public.submit_order_changes(
  p_order_id uuid,
  p_table_id uuid,
  p_order_type public.order_type,
  p_employee_id uuid,
  p_expected_lock_version integer,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.employees e
    where e.store_id = auth.uid()
      and e.id = p_employee_id
      and e.is_active = true
  ) then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Employee must be active and belong to the current store.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ORDER_ITEMS'
      using errcode = 'P0001',
            hint = 'p_items must be a jsonb array.';
  end if;

  raise exception 'RPC_NOT_IMPLEMENTED: submit_order_changes'
    using errcode = 'P0001',
          hint = 'Track A must implement transaction boundary, DB-source pricing, replace snapshot, table status, and lock_version conflict handling.';
end;
$$;

create or replace function public.pay_order(
  p_payment_id uuid,
  p_order_id uuid,
  p_employee_id uuid,
  p_method public.payment_method,
  p_expected_lock_version integer,
  p_received_amount integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.employees e
    where e.store_id = auth.uid()
      and e.id = p_employee_id
      and e.is_active = true
  ) then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Employee must be active and belong to the current store.';
  end if;

  if p_received_amount < 0 then
    raise exception 'PAYMENT_AMOUNT_TOO_LOW'
      using errcode = 'P0001',
            hint = 'received amount must be non-negative.';
  end if;

  raise exception 'RPC_NOT_IMPLEMENTED: pay_order'
    using errcode = 'P0001',
          hint = 'Track A must implement payment transaction, lock_version conflict handling, and table release.';
end;
$$;

create or replace function public.clear_demo_data(
  p_employee_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.employee_role;
begin
  select e.role
  into v_role
  from public.employees e
  where e.store_id = auth.uid()
    and e.id = p_employee_id
    and e.is_active = true;

  if v_role is distinct from 'admin'::public.employee_role then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only admin can clear demo data.';
  end if;

  if exists (
    select 1
    from public.orders o
    where o.store_id = auth.uid()
      and o.status = 'open'
  ) then
    raise exception 'OPEN_ORDERS_BLOCK_CLEAR_DEMO'
      using errcode = 'P0001',
            hint = 'Close or void all open orders before clearing demo data.';
  end if;

  raise exception 'RPC_NOT_IMPLEMENTED: clear_demo_data'
    using errcode = 'P0001',
          hint = 'Track A must implement tombstone of demo menu/floor data while keeping one admin employee.';
end;
$$;

create or replace function public.void_order(
  p_order_id uuid,
  p_employee_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'VOID_ORDER_RESERVED'
    using errcode = 'P0001',
          hint = 'MVP cancellation of open orders goes through submit_order_changes with all quantities set to zero.';
end;
$$;
