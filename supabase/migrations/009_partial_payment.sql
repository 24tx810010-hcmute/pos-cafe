-- 009_partial_payment.sql
-- Instant pay: thanh toán theo từng món trong một đơn (nhiều payment/đơn).
--   * orders.paid_amount: tiền đã thu cộng dồn; còn phải thu = total - paid_amount.
--   * order_items.payment_id: dòng món đã được trả bởi payment nào (null = chưa trả).
--     Trả một phần số lượng -> TÁCH DÒNG: dòng mới (UUID client cấp) mang phần đã trả.
--   * RPC pay_order_items: thanh toán một phần; đơn vẫn 'open' tới khi hết món chưa trả.
--   * submit_order_changes: dòng đã trả bị ĐÓNG BĂNG (không replace); chặn huỷ đơn đã thu tiền.
--   * pay_order: thu PHẦN CÒN LẠI (total - paid_amount); bill chỉ in các món của lần trả này.
--   * View history_entries: lịch sử theo LẦN THANH TOÁN (mỗi payment một dòng) + đơn huỷ.
-- Chạy SAU 008_modifier_rework.sql.

-- ----- 1. Cột mới -----
alter table public.orders
  add column if not exists paid_amount integer not null default 0
  check (paid_amount >= 0);

alter table public.order_items
  add column if not exists payment_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'order_items_payment_fk'
  ) then
    alter table public.order_items
      add constraint order_items_payment_fk
      foreign key (store_id, payment_id) references public.payments (store_id, id);
  end if;
end;
$$;

create index if not exists order_items_store_payment_idx
  on public.order_items (store_id, payment_id) where payment_id is not null;
create index if not exists payments_store_order_idx
  on public.payments (store_id, order_id, paid_at);

-- ----- 2. View lịch sử theo lần thanh toán -----
-- security_invoker: RLS của payments/orders áp theo phiên gọi (lọc theo store).
create or replace view public.history_entries
with (security_invoker = on)
as
select
  p.id,
  'payment'::text as kind,
  p.store_id,
  o.id as order_id,
  o.order_no,
  (row_number() over (partition by p.store_id, p.order_id order by p.paid_at, p.created_at))::integer as payment_seq,
  (count(*) over (partition by p.store_id, p.order_id))::integer as payment_count,
  o.table_id,
  o.order_type,
  o.business_date,
  p.paid_at as occurred_at,
  p.employee_id,
  p.amount
from public.payments p
join public.orders o
  on o.store_id = p.store_id
 and o.id = p.order_id
union all
select
  o.id,
  'void'::text as kind,
  o.store_id,
  o.id as order_id,
  o.order_no,
  0 as payment_seq,
  0 as payment_count,
  o.table_id,
  o.order_type,
  o.business_date,
  null::timestamptz as occurred_at,
  null::uuid as employee_id,
  0 as amount
from public.orders o
where o.status = 'void'::public.order_status;

grant select on public.history_entries to anon, authenticated, service_role;

-- ----- 3. RPC pay_order_items: thanh toán một phần theo món -----
create or replace function public.pay_order_items(
  p_payment_id uuid,
  p_order_id uuid,
  p_employee_id uuid,
  p_method public.payment_method,
  p_expected_lock_version integer,
  p_received_amount integer,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid := auth.uid();
  v_employee_role public.employee_role;
  v_order public.orders%rowtype;
  v_order_item public.order_items%rowtype;
  v_line record;
  v_table_name text;
  v_unit_total integer;
  v_amount integer := 0;
  v_change_amount integer;
  v_paid_at timestamptz;
  v_remaining integer;
  v_status text := 'open';
  v_lines jsonb := '[]'::jsonb;
  v_receipt jsonb;
begin
  if v_store_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = 'P0001',
            hint = 'A store session is required.';
  end if;

  select e.role
  into v_employee_role
  from public.employees e
  where e.store_id = v_store_id
    and e.id = p_employee_id
    and e.is_active = true;

  if not found then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Employee must be active and belong to the current store.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_store_id::text || ':pos-write'));

  if p_payment_id is null then
    raise exception 'INVALID_PAYMENT_ID'
      using errcode = 'P0001',
            hint = 'Payment must pass a client-generated UUID.';
  end if;

  if p_received_amount < 0 then
    raise exception 'PAYMENT_AMOUNT_TOO_LOW'
      using errcode = 'P0001',
            hint = 'received amount must be non-negative.';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_ORDER_ITEMS'
      using errcode = 'P0001',
            hint = 'p_items must be a non-empty jsonb array.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as line("orderItemId" uuid)
    group by line."orderItemId"
    having count(*) > 1
  ) then
    raise exception 'INVALID_ORDER_ITEMS'
      using errcode = 'P0001',
            hint = 'Duplicate order item in payment selection.';
  end if;

  select *
  into v_order
  from public.orders o
  where o.store_id = v_store_id
    and o.id = p_order_id
  for update;

  if not found
    or v_order.status <> 'open'::public.order_status
    or v_order.lock_version <> p_expected_lock_version then
    raise exception 'ORDER_VERSION_CONFLICT'
      using errcode = 'P0001',
            hint = 'Order status or lock_version changed before payment.';
  end if;

  if v_order.table_id is not null then
    select t.name
    into v_table_name
    from public.tables t
    where t.store_id = v_store_id
      and t.id = v_order.table_id
    for update;
  end if;

  -- Lượt 1: khoá dòng, validate và tính tiền phía server (DB là nguồn giá).
  for v_line in
    select *
    from jsonb_to_recordset(p_items) as line(
      "orderItemId" uuid,
      quantity integer,
      "splitItemId" uuid
    )
  loop
    if v_line."orderItemId" is null or coalesce(v_line.quantity, 0) < 1 then
      raise exception 'INVALID_ORDER_ITEMS'
        using errcode = 'P0001',
              hint = 'Each line must include orderItemId and a positive quantity.';
    end if;

    select *
    into v_order_item
    from public.order_items oi
    where oi.store_id = v_store_id
      and oi.order_id = p_order_id
      and oi.id = v_line."orderItemId"
      and oi.status <> 'removed'::public.order_item_status
    for update;

    if not found or v_order_item.payment_id is not null then
      raise exception 'INVALID_ORDER_ITEMS'
        using errcode = 'P0001',
              hint = 'Order item is missing, removed, or already paid.';
    end if;

    if v_line.quantity > v_order_item.quantity then
      raise exception 'INVALID_ORDER_ITEMS'
        using errcode = 'P0001',
              hint = 'Line quantity exceeds the remaining quantity.';
    end if;

    if v_line.quantity < v_order_item.quantity and v_line."splitItemId" is null then
      raise exception 'INVALID_ORDER_ITEMS'
        using errcode = 'P0001',
              hint = 'Partial-quantity lines must pass a client-generated splitItemId.';
    end if;

    select v_order_item.unit_price + coalesce(sum(oio.price_delta * oio.quantity), 0)
    into v_unit_total
    from public.order_item_options oio
    where oio.store_id = v_store_id
      and oio.order_item_id = v_order_item.id;

    v_amount := v_amount + (v_unit_total * v_line.quantity);
  end loop;

  if p_received_amount < v_amount then
    raise exception 'PAYMENT_AMOUNT_TOO_LOW'
      using errcode = 'P0001',
            hint = 'received amount must be greater than or equal to the selected amount.';
  end if;

  v_change_amount := p_received_amount - v_amount;
  v_paid_at := now();

  insert into public.payments (
    id,
    store_id,
    order_id,
    employee_id,
    method,
    amount,
    received_amount,
    change_amount,
    paid_at
  ) values (
    p_payment_id,
    v_store_id,
    p_order_id,
    p_employee_id,
    p_method,
    v_amount,
    p_received_amount,
    v_change_amount,
    v_paid_at
  );

  -- Lượt 2: gắn payment_id; trả một phần số lượng thì tách dòng đã trả ra riêng.
  for v_line in
    select *
    from jsonb_to_recordset(p_items) as line(
      "orderItemId" uuid,
      quantity integer,
      "splitItemId" uuid
    )
  loop
    select *
    into v_order_item
    from public.order_items oi
    where oi.store_id = v_store_id
      and oi.id = v_line."orderItemId";

    if v_line.quantity = v_order_item.quantity then
      update public.order_items oi
      set payment_id = p_payment_id
      where oi.store_id = v_store_id
        and oi.id = v_order_item.id;
    else
      update public.order_items oi
      set quantity = oi.quantity - v_line.quantity
      where oi.store_id = v_store_id
        and oi.id = v_order_item.id;

      insert into public.order_items (
        id,
        store_id,
        order_id,
        menu_item_id,
        item_name,
        quantity,
        unit_price,
        note,
        status,
        sort_order,
        payment_id
      ) values (
        v_line."splitItemId",
        v_store_id,
        p_order_id,
        v_order_item.menu_item_id,
        v_order_item.item_name,
        v_line.quantity,
        v_order_item.unit_price,
        v_order_item.note,
        v_order_item.status,
        v_order_item.sort_order,
        p_payment_id
      );

      -- Snapshot option của dòng tách (id server cấp: dòng snapshot, client không sửa).
      insert into public.order_item_options (
        id,
        store_id,
        order_item_id,
        option_value_id,
        option_name,
        price_delta,
        quantity
      )
      select
        gen_random_uuid(),
        oio.store_id,
        v_line."splitItemId",
        oio.option_value_id,
        oio.option_name,
        oio.price_delta,
        oio.quantity
      from public.order_item_options oio
      where oio.store_id = v_store_id
        and oio.order_item_id = v_order_item.id;
    end if;
  end loop;

  update public.orders o
  set paid_amount = o.paid_amount + v_amount,
      lock_version = o.lock_version + 1
  where o.store_id = v_store_id
    and o.id = p_order_id
  returning * into v_order;

  -- Hết món chưa trả -> đơn đóng, bàn trống.
  if not exists (
    select 1
    from public.order_items oi
    where oi.store_id = v_store_id
      and oi.order_id = p_order_id
      and oi.status <> 'removed'::public.order_item_status
      and oi.payment_id is null
  ) then
    v_status := 'paid';

    update public.orders o
    set status = 'paid'::public.order_status,
        paid_at = v_paid_at
    where o.store_id = v_store_id
      and o.id = p_order_id
    returning * into v_order;

    if v_order.table_id is not null then
      update public.tables t
      set status = 'empty'::public.table_status
      where t.store_id = v_store_id
        and t.id = v_order.table_id;
    end if;
  end if;

  v_remaining := v_order.total - v_order.paid_amount;

  -- Bill chỉ gồm các món của lần trả này.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', oi.item_name,
        'quantity', oi.quantity,
        'unitPrice', oi.unit_price,
        'options', coalesce(
          (
            select jsonb_agg(
              case when oio.quantity > 1 then oio.option_name || ' ×' || oio.quantity else oio.option_name end
              order by oio.created_at
            )
            from public.order_item_options oio
            where oio.store_id = oi.store_id
              and oio.order_item_id = oi.id
          ),
          '[]'::jsonb
        )
      )
      order by oi.sort_order
    ),
    '[]'::jsonb
  )
  into v_lines
  from public.order_items oi
  where oi.store_id = v_store_id
    and oi.order_id = p_order_id
    and oi.payment_id = p_payment_id;

  v_receipt := jsonb_build_object(
    'orderNo', v_order.order_no,
    'tableName', v_table_name,
    'orderType', v_order.order_type,
    'lines', v_lines,
    'total', v_amount,
    'receivedAmount', p_received_amount,
    'changeAmount', v_change_amount,
    'paidAt', v_paid_at::text
  );

  return jsonb_build_object(
    'orderId', p_order_id,
    'paymentId', p_payment_id,
    'status', v_status,
    'amount', v_amount,
    'receivedAmount', p_received_amount,
    'changeAmount', v_change_amount,
    'paidAmount', v_order.paid_amount,
    'remainingAmount', v_remaining,
    'lockVersion', v_order.lock_version,
    'receipt', v_receipt
  );
end;
$$;

-- ----- 4. submit_order_changes: đóng băng dòng đã trả, chặn huỷ đơn đã thu tiền -----
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
declare
  v_store_id uuid := auth.uid();
  v_employee_role public.employee_role;
  v_existing_order public.orders%rowtype;
  v_has_existing_order boolean := false;
  v_table public.tables%rowtype;
  v_table_name text;
  v_timezone text;
  v_business_date date;
  v_order_no integer;
  v_order_type public.order_type;
  v_lock_version integer := 0;
  v_active_count integer := 0;
  v_subtotal integer := 0;
  v_paid_subtotal integer := 0;
  v_total integer := 0;
  v_sort_order integer := 0;
  v_item record;
  v_option record;
  v_menu_item public.menu_items%rowtype;
  v_option_value record;
  v_option_total integer;
  v_option_qty integer;
  v_lines jsonb := '[]'::jsonb;
  v_ticket jsonb;
begin
  if v_store_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = 'P0001',
            hint = 'A store session is required.';
  end if;

  select e.role
  into v_employee_role
  from public.employees e
  where e.store_id = v_store_id
    and e.id = p_employee_id
    and e.is_active = true;

  if not found then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Employee must be active and belong to the current store.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ORDER_ITEMS'
      using errcode = 'P0001',
            hint = 'p_items must be a jsonb array.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_store_id::text || ':pos-write'));

  if p_order_type = 'takeaway'::public.order_type then
    p_table_id := null;
  end if;

  select count(*)
  into v_active_count
  from jsonb_to_recordset(p_items) as item(
    id uuid,
    "menuItemId" uuid,
    quantity integer,
    note text,
    options jsonb
  )
  where coalesce(item.quantity, 0) > 0;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      id uuid,
      "menuItemId" uuid,
      quantity integer,
      note text,
      options jsonb
    )
    where coalesce(item.quantity, 0) < 0
  ) then
    raise exception 'INVALID_ORDER_ITEMS'
      using errcode = 'P0001',
            hint = 'Item quantity must be non-negative.';
  end if;

  if p_order_id is null then
    if v_active_count = 0 then
      return jsonb_build_object(
        'orderId', null,
        'status', 'void',
        'tableId', p_table_id,
        'tableStatus', null,
        'orderNo', 0,
        'businessDate', null,
        'lockVersion', 0,
        'ticket', null
      );
    end if;

    raise exception 'INVALID_ORDER_ID'
      using errcode = 'P0001',
            hint = 'New orders must pass a client-generated p_order_id UUID.';
  end if;

  if p_table_id is not null then
    select *
    into v_table
    from public.tables t
    where t.store_id = v_store_id
      and t.id = p_table_id
      and t.deleted_at is null
    for update;

    if not found then
      raise exception 'TABLE_NOT_FOUND'
        using errcode = 'P0001',
              hint = 'Table must exist, be active, and belong to the current store.';
    end if;

    v_table_name := v_table.name;
  end if;

  select *
  into v_existing_order
  from public.orders o
  where o.store_id = v_store_id
    and o.id = p_order_id
  for update;

  v_has_existing_order := found;

  if v_has_existing_order then
    v_order_type := v_existing_order.order_type;

    if v_existing_order.status <> 'open'::public.order_status
      or v_existing_order.lock_version <> p_expected_lock_version then
      raise exception 'ORDER_VERSION_CONFLICT'
        using errcode = 'P0001',
              hint = 'Order status or lock_version changed before submit.';
    end if;

    if v_existing_order.table_id is not null and p_table_id is distinct from v_existing_order.table_id then
      p_table_id := v_existing_order.table_id;
      select *
      into v_table
      from public.tables t
      where t.store_id = v_store_id
        and t.id = p_table_id
      for update;
      v_table_name := v_table.name;
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_items) as item(
        id uuid,
        "menuItemId" uuid,
        quantity integer,
        note text,
        options jsonb
      )
      join public.order_items oi
        on oi.store_id = v_store_id
       and oi.order_id = p_order_id
       and oi.id = item.id
      where coalesce(item.quantity, 0) > 0
    ) then
      raise exception 'INVALID_ORDER_ITEMS'
        using errcode = 'P0001',
              hint = 'Replace-submit must use fresh client UUIDs for active order_items.';
    end if;

    -- Instant pay: dòng đã trả bị đóng băng — chỉ replace phần chưa thanh toán.
    update public.order_items oi
    set status = 'removed'::public.order_item_status
    where oi.store_id = v_store_id
      and oi.order_id = p_order_id
      and oi.status <> 'removed'::public.order_item_status
      and oi.payment_id is null;

    if v_active_count = 0 then
      if v_existing_order.paid_amount > 0 then
        raise exception 'ORDER_PARTIALLY_PAID'
          using errcode = 'P0001',
                hint = 'Orders with collected payments cannot be voided.';
      end if;

      update public.orders o
      set status = 'void'::public.order_status,
          subtotal = 0,
          discount_type = 'none'::public.discount_type,
          discount_value = 0,
          total = 0,
          lock_version = o.lock_version + 1
      where o.store_id = v_store_id
        and o.id = p_order_id
      returning o.lock_version into v_lock_version;

      if p_table_id is not null then
        update public.tables t
        set status = 'empty'::public.table_status
        where t.store_id = v_store_id
          and t.id = p_table_id;
      end if;

      return jsonb_build_object(
        'orderId', p_order_id,
        'status', 'void',
        'tableId', p_table_id,
        'tableStatus', case when p_table_id is null then null else 'empty' end,
        'orderNo', v_existing_order.order_no,
        'businessDate', v_existing_order.business_date::text,
        'lockVersion', v_lock_version,
        'ticket', null
      );
    end if;

    -- Dòng mới xếp sau các dòng đã trả để bill giữ thứ tự ổn định.
    select coalesce(max(oi.sort_order), 0)
    into v_sort_order
    from public.order_items oi
    where oi.store_id = v_store_id
      and oi.order_id = p_order_id
      and oi.status <> 'removed'::public.order_item_status
      and oi.payment_id is not null;
  else
    v_order_type := p_order_type;

    if p_expected_lock_version is not null then
      raise exception 'ORDER_VERSION_CONFLICT'
        using errcode = 'P0001',
              hint = 'New orders must not pass an expected lock_version.';
    end if;

    if v_active_count = 0 then
      return jsonb_build_object(
        'orderId', null,
        'status', 'void',
        'tableId', p_table_id,
        'tableStatus', null,
        'orderNo', 0,
        'businessDate', null,
        'lockVersion', 0,
        'ticket', null
      );
    end if;

    if p_table_id is not null and exists (
      select 1
      from public.orders o
      where o.store_id = v_store_id
        and o.table_id = p_table_id
        and o.status = 'open'::public.order_status
    ) then
      raise exception 'ORDER_VERSION_CONFLICT'
        using errcode = 'P0001',
              hint = 'Table already has an open order.';
    end if;

    if v_order_type is null then
      raise exception 'INVALID_ORDER_ITEMS'
        using errcode = 'P0001',
              hint = 'New orders must include order_type.';
    end if;

    select coalesce(ss.timezone, 'Asia/Saigon')
    into v_timezone
    from public.store_settings ss
    where ss.store_id = v_store_id;

    v_timezone := coalesce(v_timezone, 'Asia/Saigon');
    v_business_date := (now() at time zone v_timezone)::date;

    perform pg_advisory_xact_lock(hashtext(v_store_id::text || ':' || v_business_date::text));

    select coalesce(max(o.order_no), 0) + 1
    into v_order_no
    from public.orders o
    where o.store_id = v_store_id
      and o.business_date = v_business_date;

    insert into public.orders (
      id,
      store_id,
      table_id,
      order_type,
      order_no,
      business_date,
      status,
      subtotal,
      discount_type,
      discount_value,
      total,
      employee_id,
      lock_version
    ) values (
      p_order_id,
      v_store_id,
      p_table_id,
      v_order_type,
      v_order_no,
      v_business_date,
      'open'::public.order_status,
      0,
      'none'::public.discount_type,
      0,
      0,
      p_employee_id,
      0
    );
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(
      id uuid,
      "menuItemId" uuid,
      quantity integer,
      note text,
      options jsonb
    )
    where coalesce(item.quantity, 0) > 0
  loop
    if v_item.id is null or v_item."menuItemId" is null then
      raise exception 'INVALID_ORDER_ITEMS'
        using errcode = 'P0001',
              hint = 'Active items must include id and menuItemId.';
    end if;

    select *
    into v_menu_item
    from public.menu_items mi
    where mi.store_id = v_store_id
      and mi.id = v_item."menuItemId"
      and mi.deleted_at is null
      and mi.is_available = true;

    if not found then
      raise exception 'MENU_ITEM_UNAVAILABLE'
        using errcode = 'P0001',
              hint = 'Menu item is missing, deleted, unavailable, or outside the current store.';
    end if;

    v_sort_order := v_sort_order + 1;
    v_option_total := 0;

    insert into public.order_items (
      id,
      store_id,
      order_id,
      menu_item_id,
      item_name,
      quantity,
      unit_price,
      note,
      status,
      sort_order
    ) values (
      v_item.id,
      v_store_id,
      p_order_id,
      v_menu_item.id,
      v_menu_item.name,
      v_item.quantity,
      v_menu_item.price,
      nullif(v_item.note, ''),
      'waiting'::public.order_item_status,
      v_sort_order
    );

    for v_option in
      select *
      from jsonb_to_recordset(
        case
          when jsonb_typeof(v_item.options) = 'array' then v_item.options
          else '[]'::jsonb
        end
      ) as opt(
        id uuid,
        "optionValueId" uuid,
        quantity integer
      )
    loop
      if v_option.id is null or v_option."optionValueId" is null then
        raise exception 'INVALID_ORDER_ITEMS'
          using errcode = 'P0001',
                hint = 'Options must include id and optionValueId.';
      end if;

      -- Tuỳ chọn hợp lệ khi nhóm của nó được liên kết với đúng món qua menu_item_option_groups.
      select ov.id, ov.name, ov.price_delta
      into v_option_value
      from public.option_values ov
      join public.option_groups og
        on og.store_id = ov.store_id
       and og.id = ov.option_group_id
      join public.menu_item_option_groups miog
        on miog.store_id = og.store_id
       and miog.option_group_id = og.id
      where ov.store_id = v_store_id
        and ov.id = v_option."optionValueId"
        and ov.deleted_at is null
        and og.deleted_at is null
        and miog.deleted_at is null
        and miog.menu_item_id = v_menu_item.id;

      if not found then
        raise exception 'OPTION_VALUE_UNAVAILABLE'
          using errcode = 'P0001',
                hint = 'Option value is missing, deleted, or not attached to the submitted menu item.';
      end if;

      v_option_qty := greatest(coalesce(v_option.quantity, 1), 1);

      insert into public.order_item_options (
        id,
        store_id,
        order_item_id,
        option_value_id,
        option_name,
        price_delta,
        quantity
      ) values (
        v_option.id,
        v_store_id,
        v_item.id,
        v_option_value.id,
        v_option_value.name,
        v_option_value.price_delta,
        v_option_qty
      );

      v_option_total := v_option_total + (v_option_value.price_delta * v_option_qty);
    end loop;

    v_subtotal := v_subtotal + ((v_menu_item.price + v_option_total) * v_item.quantity);
  end loop;

  -- Tổng đơn = phần đã trả (đóng băng) + phần draft mới.
  select coalesce(sum((oi.unit_price + coalesce(opt.option_total, 0)) * oi.quantity), 0)
  into v_paid_subtotal
  from public.order_items oi
  left join lateral (
    select sum(oio.price_delta * oio.quantity) as option_total
    from public.order_item_options oio
    where oio.store_id = oi.store_id
      and oio.order_item_id = oi.id
  ) opt on true
  where oi.store_id = v_store_id
    and oi.order_id = p_order_id
    and oi.status <> 'removed'::public.order_item_status
    and oi.payment_id is not null;

  v_total := v_subtotal + v_paid_subtotal;

  update public.orders o
  set subtotal = v_total,
      discount_type = 'none'::public.discount_type,
      discount_value = 0,
      total = v_total,
      employee_id = p_employee_id,
      lock_version = case when v_has_existing_order then o.lock_version + 1 else o.lock_version end
  where o.store_id = v_store_id
    and o.id = p_order_id
  returning o.order_no, o.business_date, o.lock_version
  into v_order_no, v_business_date, v_lock_version;

  if p_table_id is not null then
    update public.tables t
    set status = 'occupied'::public.table_status
    where t.store_id = v_store_id
      and t.id = p_table_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', oi.item_name,
        'quantity', oi.quantity,
        'unitPrice', oi.unit_price,
        'options', coalesce(
          (
            select jsonb_agg(
              case when oio.quantity > 1 then oio.option_name || ' ×' || oio.quantity else oio.option_name end
              order by oio.created_at
            )
            from public.order_item_options oio
            where oio.store_id = oi.store_id
              and oio.order_item_id = oi.id
          ),
          '[]'::jsonb
        )
      )
      order by oi.sort_order
    ),
    '[]'::jsonb
  )
  into v_lines
  from public.order_items oi
  where oi.store_id = v_store_id
    and oi.order_id = p_order_id
    and oi.status <> 'removed'::public.order_item_status;

  v_ticket := jsonb_build_object(
    'orderNo', v_order_no,
    'tableName', v_table_name,
    'orderType', v_order_type,
    'lines', v_lines,
    'total', v_total
  );

  return jsonb_build_object(
    'orderId', p_order_id,
    'status', 'open',
    'tableId', p_table_id,
    'tableStatus', case when p_table_id is null then null else 'occupied' end,
    'orderNo', v_order_no,
    'businessDate', v_business_date::text,
    'lockVersion', v_lock_version,
    'ticket', v_ticket
  );
end;
$$;

-- ----- 5. pay_order: thu PHẦN CÒN LẠI; bill chỉ in các món của lần trả này -----
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
declare
  v_store_id uuid := auth.uid();
  v_employee_role public.employee_role;
  v_order public.orders%rowtype;
  v_table_name text;
  v_amount integer;
  v_change_amount integer;
  v_paid_at timestamptz;
  v_lines jsonb := '[]'::jsonb;
  v_receipt jsonb;
begin
  if v_store_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = 'P0001',
            hint = 'A store session is required.';
  end if;

  select e.role
  into v_employee_role
  from public.employees e
  where e.store_id = v_store_id
    and e.id = p_employee_id
    and e.is_active = true;

  if not found then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Employee must be active and belong to the current store.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_store_id::text || ':pos-write'));

  if p_payment_id is null then
    raise exception 'INVALID_PAYMENT_ID'
      using errcode = 'P0001',
            hint = 'Payment must pass a client-generated UUID.';
  end if;

  if p_received_amount < 0 then
    raise exception 'PAYMENT_AMOUNT_TOO_LOW'
      using errcode = 'P0001',
            hint = 'received amount must be non-negative.';
  end if;

  select *
  into v_order
  from public.orders o
  where o.store_id = v_store_id
    and o.id = p_order_id
  for update;

  if not found
    or v_order.status <> 'open'::public.order_status
    or v_order.lock_version <> p_expected_lock_version then
    raise exception 'ORDER_VERSION_CONFLICT'
      using errcode = 'P0001',
            hint = 'Order status or lock_version changed before payment.';
  end if;

  -- Instant pay: số phải thu = phần còn lại sau các lần trả từng phần.
  v_amount := v_order.total - v_order.paid_amount;

  if p_received_amount < v_amount then
    raise exception 'PAYMENT_AMOUNT_TOO_LOW'
      using errcode = 'P0001',
            hint = 'received amount must be greater than or equal to the remaining amount.';
  end if;

  if v_order.table_id is not null then
    select t.name
    into v_table_name
    from public.tables t
    where t.store_id = v_store_id
      and t.id = v_order.table_id
    for update;
  end if;

  v_change_amount := p_received_amount - v_amount;
  v_paid_at := now();

  insert into public.payments (
    id,
    store_id,
    order_id,
    employee_id,
    method,
    amount,
    received_amount,
    change_amount,
    paid_at
  ) values (
    p_payment_id,
    v_store_id,
    p_order_id,
    p_employee_id,
    p_method,
    v_amount,
    p_received_amount,
    v_change_amount,
    v_paid_at
  );

  -- Các món chưa trả thuộc về lần trả cuối này.
  update public.order_items oi
  set payment_id = p_payment_id
  where oi.store_id = v_store_id
    and oi.order_id = p_order_id
    and oi.status <> 'removed'::public.order_item_status
    and oi.payment_id is null;

  update public.orders o
  set status = 'paid'::public.order_status,
      paid_at = v_paid_at,
      paid_amount = o.total,
      lock_version = o.lock_version + 1
  where o.store_id = v_store_id
    and o.id = p_order_id
  returning * into v_order;

  if v_order.table_id is not null then
    update public.tables t
    set status = 'empty'::public.table_status
    where t.store_id = v_store_id
      and t.id = v_order.table_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', oi.item_name,
        'quantity', oi.quantity,
        'unitPrice', oi.unit_price,
        'options', coalesce(
          (
            select jsonb_agg(
              case when oio.quantity > 1 then oio.option_name || ' ×' || oio.quantity else oio.option_name end
              order by oio.created_at
            )
            from public.order_item_options oio
            where oio.store_id = oi.store_id
              and oio.order_item_id = oi.id
          ),
          '[]'::jsonb
        )
      )
      order by oi.sort_order
    ),
    '[]'::jsonb
  )
  into v_lines
  from public.order_items oi
  where oi.store_id = v_store_id
    and oi.order_id = p_order_id
    and oi.payment_id = p_payment_id;

  v_receipt := jsonb_build_object(
    'orderNo', v_order.order_no,
    'tableName', v_table_name,
    'orderType', v_order.order_type,
    'lines', v_lines,
    'total', v_amount,
    'receivedAmount', p_received_amount,
    'changeAmount', v_change_amount,
    'paidAt', v_paid_at::text
  );

  return jsonb_build_object(
    'orderId', p_order_id,
    'paymentId', p_payment_id,
    'status', 'paid',
    'total', v_amount,
    'receivedAmount', p_received_amount,
    'changeAmount', v_change_amount,
    'lockVersion', v_order.lock_version,
    'receipt', v_receipt
  );
end;
$$;
