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
  select extensions.crypt(p_pin, extensions.gen_salt('bf'));
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
    and e.passcode_hash = extensions.crypt(p_pin, e.passcode_hash);

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
  v_total integer := 0;
  v_sort_order integer := 0;
  v_item record;
  v_option record;
  v_menu_item public.menu_items%rowtype;
  v_option_value record;
  v_option_total integer;
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

    update public.order_items oi
    set status = 'removed'::public.order_item_status
    where oi.store_id = v_store_id
      and oi.order_id = p_order_id
      and oi.status <> 'removed'::public.order_item_status;

    if v_active_count = 0 then
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
        "optionValueId" uuid
      )
    loop
      if v_option.id is null or v_option."optionValueId" is null then
        raise exception 'INVALID_ORDER_ITEMS'
          using errcode = 'P0001',
                hint = 'Options must include id and optionValueId.';
      end if;

      select ov.id, ov.name, ov.price_delta
      into v_option_value
      from public.option_values ov
      join public.option_groups og
        on og.store_id = ov.store_id
       and og.id = ov.option_group_id
      where ov.store_id = v_store_id
        and ov.id = v_option."optionValueId"
        and ov.deleted_at is null
        and og.deleted_at is null
        and og.menu_item_id = v_menu_item.id;

      if not found then
        raise exception 'OPTION_VALUE_UNAVAILABLE'
          using errcode = 'P0001',
                hint = 'Option value is missing, deleted, or not attached to the submitted menu item.';
      end if;

      insert into public.order_item_options (
        id,
        store_id,
        order_item_id,
        option_value_id,
        option_name,
        price_delta
      ) values (
        v_option.id,
        v_store_id,
        v_item.id,
        v_option_value.id,
        v_option_value.name,
        v_option_value.price_delta
      );

      v_option_total := v_option_total + v_option_value.price_delta;
    end loop;

    v_subtotal := v_subtotal + ((v_menu_item.price + v_option_total) * v_item.quantity);
  end loop;

  v_total := v_subtotal;

  update public.orders o
  set subtotal = v_subtotal,
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
            select jsonb_agg(oio.option_name order by oio.created_at)
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

  if p_received_amount < v_order.total then
    raise exception 'PAYMENT_AMOUNT_TOO_LOW'
      using errcode = 'P0001',
            hint = 'received amount must be greater than or equal to order total.';
  end if;

  if v_order.table_id is not null then
    select t.name
    into v_table_name
    from public.tables t
    where t.store_id = v_store_id
      and t.id = v_order.table_id
    for update;
  end if;

  v_change_amount := p_received_amount - v_order.total;
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
    v_order.total,
    p_received_amount,
    v_change_amount,
    v_paid_at
  );

  update public.orders o
  set status = 'paid'::public.order_status,
      paid_at = v_paid_at,
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
            select jsonb_agg(oio.option_name order by oio.created_at)
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

  v_receipt := jsonb_build_object(
    'orderNo', v_order.order_no,
    'tableName', v_table_name,
    'orderType', v_order.order_type,
    'lines', v_lines,
    'total', v_order.total,
    'receivedAmount', p_received_amount,
    'changeAmount', v_change_amount,
    'paidAt', v_paid_at::text
  );

  return jsonb_build_object(
    'orderId', p_order_id,
    'paymentId', p_payment_id,
    'status', 'paid',
    'total', v_order.total,
    'receivedAmount', p_received_amount,
    'changeAmount', v_change_amount,
    'lockVersion', v_order.lock_version,
    'receipt', v_receipt
  );
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
  v_store_id uuid := auth.uid();
  v_role public.employee_role;
  v_categories integer := 0;
  v_menu_items integer := 0;
  v_option_groups integer := 0;
  v_option_values integer := 0;
  v_floor_areas integer := 0;
  v_tables integer := 0;
  v_decor_items integer := 0;
  v_deactivated_employees integer := 0;
begin
  if v_store_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = 'P0001',
            hint = 'A store session is required.';
  end if;

  select e.role
  into v_role
  from public.employees e
  where e.store_id = v_store_id
    and e.id = p_employee_id
    and e.is_active = true;

  if v_role is distinct from 'admin'::public.employee_role then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only admin can clear demo data.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_store_id::text || ':pos-write'));

  if exists (
    select 1
    from public.orders o
    where o.store_id = v_store_id
      and o.status = 'open'
  ) then
    raise exception 'OPEN_ORDERS_BLOCK_CLEAR_DEMO'
      using errcode = 'P0001',
            hint = 'Close or void all open orders before clearing demo data.';
  end if;

  update public.option_values ov
  set deleted_at = coalesce(ov.deleted_at, now()),
      deleted_by_employee_id = coalesce(ov.deleted_by_employee_id, p_employee_id)
  where ov.store_id = v_store_id
    and ov.seed_key is not null
    and ov.deleted_at is null;
  get diagnostics v_option_values = row_count;

  update public.option_groups og
  set deleted_at = coalesce(og.deleted_at, now()),
      deleted_by_employee_id = coalesce(og.deleted_by_employee_id, p_employee_id)
  where og.store_id = v_store_id
    and og.seed_key is not null
    and og.deleted_at is null;
  get diagnostics v_option_groups = row_count;

  update public.menu_items mi
  set deleted_at = coalesce(mi.deleted_at, now()),
      deleted_by_employee_id = coalesce(mi.deleted_by_employee_id, p_employee_id)
  where mi.store_id = v_store_id
    and mi.seed_key is not null
    and mi.deleted_at is null;
  get diagnostics v_menu_items = row_count;

  update public.categories c
  set deleted_at = coalesce(c.deleted_at, now()),
      deleted_by_employee_id = coalesce(c.deleted_by_employee_id, p_employee_id)
  where c.store_id = v_store_id
    and c.seed_key is not null
    and c.deleted_at is null;
  get diagnostics v_categories = row_count;

  update public.floor_decor_items fdi
  set deleted_at = coalesce(fdi.deleted_at, now()),
      deleted_by_employee_id = coalesce(fdi.deleted_by_employee_id, p_employee_id)
  where fdi.store_id = v_store_id
    and fdi.seed_key is not null
    and fdi.deleted_at is null;
  get diagnostics v_decor_items = row_count;

  update public.tables t
  set deleted_at = coalesce(t.deleted_at, now()),
      deleted_by_employee_id = coalesce(t.deleted_by_employee_id, p_employee_id),
      status = 'empty'::public.table_status
  where t.store_id = v_store_id
    and t.seed_key is not null
    and t.deleted_at is null;
  get diagnostics v_tables = row_count;

  update public.floor_areas fa
  set deleted_at = coalesce(fa.deleted_at, now()),
      deleted_by_employee_id = coalesce(fa.deleted_by_employee_id, p_employee_id)
  where fa.store_id = v_store_id
    and fa.seed_key is not null
    and fa.deleted_at is null;
  get diagnostics v_floor_areas = row_count;

  update public.employees e
  set is_active = false
  where e.store_id = v_store_id
    and e.seed_key is not null
    and e.role <> 'admin'::public.employee_role
    and e.is_active = true;
  get diagnostics v_deactivated_employees = row_count;

  return jsonb_build_object(
    'cleared', true,
    'categories', v_categories,
    'menuItems', v_menu_items,
    'optionGroups', v_option_groups,
    'optionValues', v_option_values,
    'floorAreas', v_floor_areas,
    'tables', v_tables,
    'decorItems', v_decor_items,
    'deactivatedEmployees', v_deactivated_employees
  );
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
