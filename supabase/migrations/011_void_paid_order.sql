-- 011_void_paid_order.sql
-- Hủy (void) một đơn ĐÃ THANH TOÁN từ màn Lịch sử đơn.
--
-- Void đơn paid GIỮ NGUYÊN total/subtotal/order_no/business_date/paid_at và payment row
-- (audit + để report tính đúng), chỉ đổi status -> 'void', ghi metadata hủy, tăng lock_version;
-- KHÔNG đụng tables.status (đơn paid đã trả bàn từ trước).
--
-- Report tính trực tiếp từ orders.status='paid' theo business_date nên void là doanh thu tự đúng;
-- 'paid_at is not null' phân biệt đơn hủy-sau-thanh-toán (tính vào tổng hợp đơn hủy) với đơn open
-- bị hủy trước thanh toán (paid_at null, total 0, không tính).
--
-- Đợt này cũng thêm seam phân quyền theo hành động: employees.permission_overrides (jsonb, nullable)
-- shape {"grants":[...],"denies":[...]}. Quyền hiệu lực = (default_theo_role ∪ grants) − denies.
-- Đây là guardrail app-layer; RPC check chỉ để phòng thủ/audit (spoof được với session hợp lệ),
-- KHÔNG phải DB-secured.

-- 1a. Cột metadata hủy trên orders --------------------------------------------------------------

alter table public.orders
  add column voided_at timestamptz,
  add column voided_by_employee_id uuid,
  add column void_reason_code text,
  add column void_reason_note text;

alter table public.orders
  add constraint orders_voided_by_employee_fk
    foreign key (store_id, voided_by_employee_id)
    references public.employees (store_id, id);

alter table public.orders
  add constraint orders_void_reason_code_check
    check (void_reason_code is null or void_reason_code in
      ('wrong_order', 'customer_request', 'out_of_stock', 'duplicate', 'other'));

-- 1b. Seam phân quyền theo hành động (null = không override) -------------------------------------

alter table public.employees
  add column permission_overrides jsonb;

-- 1c. verify_employee_pin trả thêm permission_overrides -----------------------------------------
-- Đổi return table -> phải drop trước khi tạo lại (create or replace không đổi được signature).

drop function if exists public.verify_employee_pin(uuid, text);

create function public.verify_employee_pin(
  p_employee_id uuid,
  p_pin text
) returns table (
  id uuid,
  name text,
  role public.employee_role,
  permission_overrides jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select e.id, e.name, e.role, e.permission_overrides
  from public.employees e
  where e.store_id = auth.uid()
    and e.id = p_employee_id
    and e.is_active = true
    and e.passcode_hash = extensions.crypt(p_pin, e.passcode_hash);

  if not found then
    raise exception 'INVALID_PIN'
      using errcode = 'P0001',
            hint = 'Employee must be active and PIN must match.';
  end if;
end;
$$;

-- 1d. void_order — thay stub reserved bằng bản thật ---------------------------------------------
-- Stub cũ có signature (uuid, uuid); bản mới 5 tham số -> phải drop signature cũ (tránh overload).

drop function if exists public.void_order(uuid, uuid);

create function public.void_order(
  p_order_id uuid,
  p_employee_id uuid,
  p_expected_lock_version integer,
  p_reason_code text,
  p_reason_note text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid := auth.uid();
  v_role public.employee_role;
  v_overrides jsonb;
  v_order public.orders%rowtype;
  v_lock_version integer;
  v_voided_at timestamptz;
begin
  if v_store_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = 'P0001',
            hint = 'A store session is required.';
  end if;

  select e.role, coalesce(e.permission_overrides, '{}'::jsonb)
  into v_role, v_overrides
  from public.employees e
  where e.store_id = v_store_id
    and e.id = p_employee_id
    and e.is_active = true;

  if not found then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Employee must be active and belong to the current store.';
  end if;

  -- Quyền hiệu lực = (default_theo_role ∪ grants) − denies. denies luôn thắng.
  if jsonb_exists(coalesce(v_overrides->'denies', '[]'::jsonb), 'order.voidPaid')
     or not (
       v_role = 'admin'::public.employee_role
       or jsonb_exists(coalesce(v_overrides->'grants', '[]'::jsonb), 'order.voidPaid')
     )
  then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Employee lacks order.voidPaid permission.';
  end if;

  if p_reason_code is null or p_reason_code not in
    ('wrong_order', 'customer_request', 'out_of_stock', 'duplicate', 'other')
  then
    raise exception 'VOID_REASON_REQUIRED'
      using errcode = 'P0001',
            hint = 'A valid void reason code is required.';
  end if;

  if p_reason_code = 'other' and coalesce(btrim(p_reason_note), '') = '' then
    raise exception 'VOID_REASON_REQUIRED'
      using errcode = 'P0001',
            hint = 'A note is required when reason code is other.';
  end if;

  select *
  into v_order
  from public.orders o
  where o.store_id = v_store_id
    and o.id = p_order_id
  for update;

  if not found then
    raise exception 'NOT_FOUND'
      using errcode = 'P0001',
            hint = 'Order not found in the current store.';
  end if;

  if v_order.status <> 'paid'::public.order_status
    or v_order.lock_version <> p_expected_lock_version then
    raise exception 'ORDER_VERSION_CONFLICT'
      using errcode = 'P0001',
            hint = 'Only a paid order at the expected lock_version can be voided.';
  end if;

  update public.orders o
  set status = 'void'::public.order_status,
      voided_at = now(),
      voided_by_employee_id = p_employee_id,
      void_reason_code = p_reason_code,
      void_reason_note = nullif(btrim(coalesce(p_reason_note, '')), ''),
      lock_version = o.lock_version + 1
  where o.store_id = v_store_id
    and o.id = p_order_id
  returning o.lock_version, o.voided_at into v_lock_version, v_voided_at;

  return jsonb_build_object(
    'orderId', p_order_id,
    'status', 'void',
    'lockVersion', v_lock_version,
    'voidedAt', v_voided_at::text
  );
end;
$$;
