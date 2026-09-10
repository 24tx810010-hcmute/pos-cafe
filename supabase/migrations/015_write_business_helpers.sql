-- Private, transaction-local planning and application. Only protocol v1 calls
-- these helpers after schema/auth, locks and the final server clock checkpoint.
begin;
alter table public.order_item_options add column snapshot_sort_order integer not null default 0;

create function private.write_permission(p jsonb) returns text
language sql immutable set search_path=pg_catalog as $$
 select case p->>'kind' when 'submit_order_changes' then case p->>'action'
 when 'create' then 'order.create' when 'update' then 'order.update' when 'void_open' then 'order.voidOpen' end
 when 'pay_order' then 'payment.take' when 'pay_order_items' then 'payment.take' when 'void_order' then 'order.voidPaid' end
$$;

create function private.operation_view(w public.write_operations) returns jsonb
language sql stable set search_path=pg_catalog as $$
 select jsonb_build_object('operationId',w.operation_id,'schemaVersion',w.schema_version,'kind',w.kind,'action',w.action,
 'status',w.status,'payload',w.payload,'registeredAt',w.registered_at,'expiresAt',w.expires_at,
 'initiatedByEmployeeId',w.initiated_by_employee_id,'decidedAt',w.decided_at,'executedByEmployeeId',w.executed_by_employee_id,
 'cancelledByEmployeeId',w.cancelled_by_employee_id,'result',w.result,'error',w.error,'replayCount',w.replay_count::text)
$$;

create function private.item_unit_total(p_store uuid,p_item uuid) returns bigint
language sql stable set search_path=pg_catalog as $$
 select i.unit_price::bigint+coalesce((select sum(o.price_delta::bigint*o.quantity) from public.order_item_options o
 where o.store_id=i.store_id and o.order_item_id=i.id),0) from public.order_items i where i.store_id=p_store and i.id=p_item
$$;
create function private.item_snapshot(i public.order_items) returns jsonb
language sql stable set search_path=pg_catalog as $$
 select jsonb_build_object('id',i.id,'menuItemId',i.menu_item_id,'name',i.item_name,'quantity',i.quantity,
 'baseUnitPrice',i.unit_price,'note',i.note,'status','active','unitTotal',private.item_unit_total(i.store_id,i.id),
 'lineTotal',private.item_unit_total(i.store_id,i.id)*i.quantity,'options',coalesce((select jsonb_agg(
 jsonb_build_object('id',o.id,'optionValueId',o.option_value_id,'name',o.option_name,'priceDelta',o.price_delta,'quantity',o.quantity)
 order by o.snapshot_sort_order,o.created_at,o.id) from public.order_item_options o where o.store_id=i.store_id and o.order_item_id=i.id),'[]'::jsonb))
$$;
create function private.order_snapshot(p_store uuid,p_order uuid) returns jsonb
language sql stable set search_path=pg_catalog as $$
 select jsonb_build_object('id',o.id,'storeId',o.store_id,'orderNo',o.order_no,'businessDate',o.business_date,
 'orderType',o.order_type,'tableId',o.table_id,'status',o.status,'lockVersion',o.lock_version,'subtotal',o.subtotal,'total',o.total,
 'createdAt',o.created_at,'updatedAt',o.updated_at,'paidAt',o.paid_at,'createdByEmployeeId',o.created_by_employee_id,
 'lastModifiedByEmployeeId',o.last_modified_by_employee_id,'voidedAt',o.voided_at,'voidedByEmployeeId',o.voided_by_employee_id,
 'voidReasonCode',o.void_reason_code,'voidReasonNote',o.void_reason_note,'items',coalesce((select jsonb_agg(private.item_snapshot(i) order by i.sort_order,i.created_at,i.id)
 from public.order_items i where i.store_id=o.store_id and i.order_id=o.id and i.status<>'removed'),'[]'::jsonb))
 from public.orders o where o.store_id=p_store and o.id=p_order
$$;
create function private.payment_snapshot(p_store uuid,p_payment uuid) returns jsonb
language sql stable set search_path=pg_catalog as $$
 select jsonb_build_object('id',p.id,'orderId',p.order_id,'employeeId',p.employee_id,'method',p.method,'amount',p.amount,
 'receivedAmount',p.received_amount,'changeAmount',p.change_amount,'createdAt',p.created_at)
 from public.payments p where p.store_id=p_store and p.id=p_payment
$$;
create function private.receipt_snapshot(p_store uuid,p_payment uuid) returns jsonb
language sql stable set search_path=pg_catalog as $$
 select jsonb_build_object('schemaVersion',1,'orderId',o.id,'paymentId',p.id,'orderNo',o.order_no,'businessDate',o.business_date,
 'storeName',s.display_name,'address',s.address,'footer',s.bill_footer,'tableName',t.name,'paidAt',p.paid_at,
 'employeeName',e.name,'total',p.amount,'receivedAmount',p.received_amount,'changeAmount',p.change_amount,
 'lines',coalesce((select jsonb_agg((private.item_snapshot(i)-array['id','status','options'])||jsonb_build_object('orderItemId',i.id,
 'options',coalesce((select jsonb_agg(jsonb_build_object('optionValueId',v.option_value_id,'name',v.option_name,'quantity',v.quantity,'priceDelta',v.price_delta)
 order by v.snapshot_sort_order,v.created_at,v.id) from public.order_item_options v where v.store_id=i.store_id and v.order_item_id=i.id),'[]'::jsonb))
 order by i.sort_order,i.created_at,i.id) from public.order_items i where i.store_id=o.store_id and i.order_id=o.id and i.status<>'removed'),'[]'::jsonb))
 from public.payments p join public.orders o on o.store_id=p.store_id and o.id=p.order_id
 join public.store_settings s on s.store_id=p.store_id join public.employees e on e.store_id=p.store_id and e.id=p.employee_id
 left join public.tables t on t.store_id=o.store_id and t.id=o.table_id where p.store_id=p_store and p.id=p_payment
$$;

-- Every row/advisory lock that can delay the first financial effect is acquired
-- here, before locking the acting employee and checking the final clock.
create function private.lock_write_input(p jsonb) returns void
language plpgsql volatile set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); oid uuid:=(p->>'orderId')::uuid; tid uuid; day date; ident uuid;
begin
 perform 1 from public.orders where store_id=sid and id=oid order by id for update;
 select table_id,business_date into tid,day from public.orders where store_id=sid and id=oid;
 if p->>'action'='create' then tid:=(p->>'tableId')::uuid; end if;
 perform 1 from public.tables where store_id=sid and id=tid order by id for update;
 perform 1 from public.order_items where store_id=sid and order_id=oid order by id for update;
 perform 1 from public.order_item_options where store_id=sid and order_item_id in(select id from public.order_items where store_id=sid and order_id=oid) order by id for update;
 if p->>'action'='create' or p->>'kind'='pay_order_items' then
  -- A store-wide numbering lock also covers a create validation that crosses
  -- midnight. Its plan may refresh to a new businessDate without a later wait.
  perform pg_advisory_xact_lock(hashtext(sid::text||':order-number'));
  if day is null then select (private.write_clock() at time zone timezone)::date into day from public.store_settings where store_id=sid; end if;
  perform pg_advisory_xact_lock(hashtext(sid::text||':'||day::text));
 end if;
 if coalesce(jsonb_array_length(p->'newLines'),0)>0 then perform pg_advisory_xact_lock(hashtext(sid::text||':catalog-write')); end if;
 -- Cross-store calls with the same client UUID serialize before INSERT/unique checks.
 for ident in select distinct id from (
  select oid id where p->>'action'='create'
  union all select (p->>'newOrderId')::uuid where p ? 'newOrderId'
  union all select (p->>'paymentId')::uuid where p ? 'paymentId'
  union all select (x->>'id')::uuid from jsonb_array_elements(coalesce(p->'newLines','[]')) x
  union all select (v->>'id')::uuid from jsonb_array_elements(coalesce(p->'newLines','[]')) x cross join lateral jsonb_array_elements(x->'options') v
  union all select (x->>'splitItemId')::uuid from jsonb_array_elements(coalesce(p->'lines','[]')) x
 ) ids order by id loop perform pg_advisory_xact_lock(hashtextextended(ident::text,1)); end loop;
 perform 1 from public.store_settings where store_id=sid for share;
 perform 1 from public.stores where id=sid for share;
end $$;

create function private.prepare_write(p jsonb) returns jsonb
language plpgsql volatile set search_path=pg_catalog as $$
#variable_conflict use_column
declare sid uuid:=auth.uid(); oid uuid:=(p->>'orderId')::uuid; o public.orders; item public.order_items;
 menu public.menu_items; ov public.option_values; grp record; line jsonb; opt jsonb;
 prepared jsonb:='[]'; prepared_options jsonb; changed_lines jsonb:='[]'; changed_options jsonb;
new_total bigint:=0; quoted_new_total bigint:=0; retained_total bigint:=0; amount bigint:=0; unit bigint; line_total bigint; quote_unit bigint;
changed boolean:=false; any_changed boolean:=false; count_active integer:=0; count_selected integer; next_no bigint; day date; zone text;
 ids uuid[]:='{}'; opt_ids uuid[]:='{}'; sources uuid[]:='{}'; option_values uuid[]; id uuid;
begin
 select * into o from public.orders where store_id=sid and id=oid;
 if p->>'action'='create' then
  if exists(select 1 from public.orders where id=oid) then perform private.reject_write('ENTITY_ID_CONFLICT'); end if;
  if p->>'orderType'='dine_in' then
   if not exists(select 1 from public.tables where store_id=sid and id=(p->>'tableId')::uuid and deleted_at is null) then perform private.reject_write('TABLE_NOT_FOUND'); end if;
   if exists(select 1 from public.orders where store_id=sid and table_id=(p->>'tableId')::uuid and status='open') then perform private.reject_write('TABLE_OCCUPIED'); end if;
  end if;
 else
  if o.id is null then perform private.reject_write('NOT_FOUND'); end if;
  if o.lock_version<>(p->>'expectedVersion')::integer or
     (p->>'kind'='void_order' and o.status<>'paid') or (p->>'kind'<>'void_order' and o.status<>'open') then perform private.reject_write('ORDER_VERSION_CONFLICT'); end if;
  if o.lock_version=2147483647 then perform private.reject_write('INVALID_WRITE_REQUEST'); end if;
 end if;

 -- Provenance and fresh IDs are checked before looking up menu/price data.
 if p->>'action'='update' then
  for line in select value from jsonb_array_elements(p->'retainedLines') loop
   id:=(line->>'sourceItemId')::uuid;
   -- Qualify identifiers explicitly: PL/pgSQL variables are never column aliases.
   select i.* into item from public.order_items i where i.store_id=sid and i.order_id=oid and i.id=(line->>'sourceItemId')::uuid and i.status<>'removed';
   if item.id is null or id=any(sources) or (line->>'quantity')::integer>item.quantity then perform private.reject_write('INVALID_ORDER_ITEMS'); end if;
   sources:=array_append(sources,id);
   if (line->>'quantity')::integer>0 then
    count_active:=count_active+1;
    unit:=private.item_unit_total(sid,item.id); line_total:=unit*(line->>'quantity')::integer;
    if unit not between 0 and 2147483647 or line_total not between 0 and 2147483647 then perform private.reject_write('INVALID_WRITE_REQUEST'); end if;
    retained_total:=retained_total+line_total;
   end if;
  end loop;
  if exists(select 1 from public.order_items i where i.store_id=sid and i.order_id=oid and i.status<>'removed' and not i.id=any(sources)) then perform private.reject_write('INVALID_ORDER_ITEMS'); end if;
 end if;
 if p->>'kind' in ('pay_order','pay_order_items') and exists(select 1 from public.payments where id=(p->>'paymentId')::uuid) then perform private.reject_write('ENTITY_ID_CONFLICT'); end if;
 if p->>'kind'='pay_order_items' then
  if (p->>'newOrderId')::uuid=oid or exists(select 1 from public.orders where id=(p->>'newOrderId')::uuid) then perform private.reject_write('ENTITY_ID_CONFLICT'); end if;
  for line in select value from jsonb_array_elements(p->'lines') loop
   id:=(line->>'orderItemId')::uuid;
   select i.* into item from public.order_items i where i.store_id=sid and i.order_id=oid and i.id=(line->>'orderItemId')::uuid and i.status<>'removed';
   if item.id is null or id=any(sources) or (line->>'quantity')::integer>item.quantity then perform private.reject_write('INVALID_ORDER_ITEMS'); end if;
   sources:=array_append(sources,id);
   id:=(line->>'splitItemId')::uuid;
   if id=any(ids) or exists(select 1 from public.order_items i where i.id=(line->>'splitItemId')::uuid) then perform private.reject_write('ENTITY_ID_CONFLICT'); end if;
   ids:=array_append(ids,id);
  end loop;
  if not exists(select 1 from public.order_items i left join jsonb_to_recordset(p->'lines') x("orderItemId" uuid,quantity integer) on x."orderItemId"=i.id
    where i.store_id=sid and i.order_id=oid and i.status<>'removed' and coalesce(x.quantity,0)<i.quantity) then perform private.reject_write('INVALID_ORDER_ITEMS'); end if;
 end if;
 for line in select value from jsonb_array_elements(coalesce(p->'newLines','[]')) loop
  id:=(line->>'id')::uuid;
  if id=any(ids) or exists(select 1 from public.order_items i where i.id=(line->>'id')::uuid) then perform private.reject_write('ENTITY_ID_CONFLICT'); end if;
  ids:=array_append(ids,id);
  for opt in select value from jsonb_array_elements(line->'options') loop
   id:=(opt->>'id')::uuid;
   if id=any(opt_ids) or exists(select 1 from public.order_item_options i where i.id=(opt->>'id')::uuid) then perform private.reject_write('ENTITY_ID_CONFLICT'); end if;
   opt_ids:=array_append(opt_ids,id);
  end loop;
 end loop;

 -- Build a private immutable plan from catalog snapshots while holding its lock.
 for line in select value from jsonb_array_elements(coalesce(p->'newLines','[]')) loop
  select m.* into menu from public.menu_items m join public.categories c on c.store_id=m.store_id and c.id=m.category_id
  where m.store_id=sid and m.id=(line->>'menuItemId')::uuid and m.is_available and m.deleted_at is null and c.deleted_at is null;
  if menu.id is null then perform private.reject_write('MENU_ITEM_UNAVAILABLE'); end if;
  unit:=menu.price; quote_unit:=(line->>'quotedBasePrice')::bigint; prepared_options:='[]'; changed_options:='[]'; option_values:='{}';
  changed:=menu.price<>(line->>'quotedBasePrice')::integer;
  for opt in select value from jsonb_array_elements(line->'options') loop
   select v.* into ov from public.option_values v join public.option_groups g on g.store_id=v.store_id and g.id=v.option_group_id
   where v.store_id=sid and v.id=(opt->>'optionValueId')::uuid and v.deleted_at is null and g.deleted_at is null
   and exists(select 1 from public.menu_item_option_groups l where l.store_id=sid and l.menu_item_id=menu.id and l.option_group_id=g.id and l.deleted_at is null);
   if ov.id is null or ov.id=any(option_values) then perform private.reject_write('OPTION_VALUE_UNAVAILABLE'); end if;
   option_values:=array_append(option_values,ov.id);
   unit:=unit+ov.price_delta::bigint*(opt->>'quantity')::integer;
   quote_unit:=quote_unit+(opt->>'quotedPriceDelta')::bigint*(opt->>'quantity')::integer;
   changed:=changed or ov.price_delta<>(opt->>'quotedPriceDelta')::integer;
   changed_options:=changed_options||jsonb_build_array(jsonb_build_object('optionValueId',ov.id,'quoted',(opt->>'quotedPriceDelta')::integer,'current',ov.price_delta));
   prepared_options:=prepared_options||jsonb_build_array(jsonb_build_object('id',opt->>'id','optionValueId',ov.id,'name',ov.name,'priceDelta',ov.price_delta,'quantity',(opt->>'quantity')::integer));
  end loop;
  for grp in select g.* from public.option_groups g where g.store_id=sid and g.deleted_at is null and exists
   (select 1 from public.menu_item_option_groups l where l.store_id=sid and l.menu_item_id=menu.id and l.option_group_id=g.id and l.deleted_at is null) loop
   select count(*) into count_selected from public.option_values v where v.store_id=sid and v.option_group_id=grp.id and v.id=any(option_values);
   if (grp.is_required and count_selected=0) or (grp.select_type='single' and count_selected>1) then perform private.reject_write('OPTION_VALUE_UNAVAILABLE'); end if;
  end loop;
  line_total:=unit*(line->>'quantity')::integer;
  if unit not between 0 and 2147483647 or quote_unit not between 0 and 2147483647 or line_total not between 0 and 2147483647 or
     quote_unit*(line->>'quantity')::integer>2147483647 then perform private.reject_write('INVALID_WRITE_REQUEST'); end if;
  new_total:=new_total+line_total;
  quoted_new_total:=quoted_new_total+quote_unit*(line->>'quantity')::integer;
  count_active:=count_active+1;
  any_changed:=any_changed or changed;
  if changed then changed_lines:=changed_lines||jsonb_build_array(jsonb_build_object('lineId',line->>'id','base',jsonb_build_object('quoted',(line->>'quotedBasePrice')::integer,'current',menu.price),'options',changed_options)); end if;
  prepared:=prepared||jsonb_build_array(jsonb_build_object('id',line->>'id','menuItemId',menu.id,'name',menu.name,'quantity',(line->>'quantity')::integer,
  'baseUnitPrice',menu.price,'note',line->>'note','options',prepared_options));
 end loop;
 if p->>'action' in ('create','update') then
  if count_active not between 1 and 200 then perform private.reject_write('INVALID_ORDER_ITEMS'); end if;
  if new_total>2147483647 or retained_total+new_total>2147483647 or
     quoted_new_total>2147483647 or retained_total+quoted_new_total>2147483647 then perform private.reject_write('INVALID_WRITE_REQUEST'); end if;
  if any_changed then perform private.reject_write('PRICE_CHANGED',jsonb_build_object('lines',changed_lines,'proposedNewLinesTotal',new_total)); end if;
 end if;
 if p->>'kind' in ('pay_order','pay_order_items') then
  for item in select i.* from public.order_items i where i.store_id=sid and i.order_id=oid and i.status<>'removed' loop
   unit:=private.item_unit_total(sid,item.id);
   if unit not between 0 and 2147483647 or unit*item.quantity not between 0 and 2147483647 then perform private.reject_write('INVALID_WRITE_REQUEST'); end if;
   if p->>'kind'='pay_order' then amount:=amount+unit*item.quantity;
   else select coalesce(sum((x->>'quantity')::integer),0) into count_selected from jsonb_array_elements(p->'lines') x where (x->>'orderItemId')::uuid=item.id;
    amount:=amount+unit*count_selected;
   end if;
  end loop;
  if amount>2147483647 then perform private.reject_write('INVALID_WRITE_REQUEST'); end if;
  if amount<=0 then perform private.reject_write('INVALID_ORDER_ITEMS'); end if;
  if p->>'kind'='pay_order' and amount<>o.total then perform private.reject_write('INVALID_ORDER_ITEMS'); end if;
  if p->>'kind'='pay_order_items' and o.total-amount<0 then perform private.reject_write('INVALID_ORDER_ITEMS'); end if;
  if (p->>'receivedAmount')::integer<amount then perform private.reject_write('PAYMENT_AMOUNT_TOO_LOW'); end if;
 end if;
 if p->>'kind'='void_order' and p->>'reason'='other' and coalesce(private.trim_whitespace(p->>'reasonNote'),'')='' then perform private.reject_write('VOID_REASON_REQUIRED'); end if;
 if p->>'action'='create' then
  select timezone into zone from public.store_settings where store_id=sid;
  day:=(private.write_clock() at time zone zone)::date;
 elsif p->>'kind'='pay_order_items' then day:=o.business_date;
 end if;
 if day is not null then
  select coalesce(max(order_no)::bigint,0)+1 into next_no from public.orders where store_id=sid and business_date=day;
  if next_no>2147483647 then perform private.reject_write('INVALID_WRITE_REQUEST'); end if;
 end if;
 return jsonb_build_object('newLines',prepared,'total',new_total+retained_total,'amount',amount,'nextNo',next_no,'businessDate',day,'timezone',zone);
end $$;

create function private.apply_write(p jsonb,plan jsonb,p_actor uuid,p_at timestamptz) returns jsonb
language plpgsql volatile set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); oid uuid:=(p->>'orderId')::uuid; payment_id uuid:=(p->>'paymentId')::uuid;
 paid_oid uuid:=coalesce((p->>'newOrderId')::uuid,oid); o public.orders; item public.order_items;
 line jsonb; opt jsonb; idx integer; opt_idx integer; amount integer:=(plan->>'amount')::integer; receipt jsonb;
begin
 select * into o from public.orders where store_id=sid and id=oid;
 if p->>'kind'='submit_order_changes' then
  if p->>'action'='create' then
   insert into public.orders(id,store_id,table_id,order_type,order_no,business_date,status,subtotal,total,employee_id,created_by_employee_id,last_modified_by_employee_id,created_at,updated_at)
   values(oid,sid,(p->>'tableId')::uuid,(p->>'orderType')::public.order_type,(plan->>'nextNo')::integer,(plan->>'businessDate')::date,'open',(plan->>'total')::integer,(plan->>'total')::integer,p_actor,p_actor,p_actor,p_at,p_at);
  elsif p->>'action'='update' then
   for line in select value from jsonb_array_elements(p->'retainedLines') loop
    if (line->>'quantity')::integer=0 then
     update public.order_items set status='removed' where store_id=sid and id=(line->>'sourceItemId')::uuid;
    else update public.order_items set quantity=(line->>'quantity')::integer,note=line->>'note' where store_id=sid and id=(line->>'sourceItemId')::uuid;
    end if;
   end loop;
   update public.orders set subtotal=(plan->>'total')::integer,total=(plan->>'total')::integer,lock_version=lock_version+1,last_modified_by_employee_id=p_actor where store_id=sid and id=oid;
  else
   update public.order_items set status='removed' where store_id=sid and order_id=oid and status<>'removed';
   update public.orders set status='void',subtotal=0,total=0,lock_version=lock_version+1,last_modified_by_employee_id=p_actor where store_id=sid and id=oid;
   if o.table_id is not null then update public.tables set status='empty' where store_id=sid and id=o.table_id; end if;
  end if;
  select coalesce(max(sort_order),-1)+1 into idx from public.order_items where store_id=sid and order_id=oid;
  for line in select value from jsonb_array_elements(plan->'newLines') loop
   insert into public.order_items(id,store_id,order_id,menu_item_id,item_name,quantity,unit_price,note,sort_order,created_at,updated_at)
   values((line->>'id')::uuid,sid,oid,(line->>'menuItemId')::uuid,line->>'name',(line->>'quantity')::integer,(line->>'baseUnitPrice')::integer,line->>'note',idx,p_at,p_at);
   idx:=idx+1; opt_idx:=0;
   for opt in select value from jsonb_array_elements(line->'options') loop
    insert into public.order_item_options(id,store_id,order_item_id,option_value_id,option_name,price_delta,quantity,snapshot_sort_order,created_at,updated_at)
    values((opt->>'id')::uuid,sid,(line->>'id')::uuid,(opt->>'optionValueId')::uuid,opt->>'name',(opt->>'priceDelta')::integer,(opt->>'quantity')::integer,opt_idx,p_at,p_at);
    opt_idx:=opt_idx+1;
   end loop;
  end loop;
  if p->>'action'='create' and p->>'tableId' is not null then update public.tables set status='occupied' where store_id=sid and id=(p->>'tableId')::uuid; end if;
  return jsonb_build_object('kind',p->>'kind','action',p->>'action','order',private.order_snapshot(sid,oid));
 elsif p->>'kind'='void_order' then
  update public.orders set status='void',voided_at=p_at,voided_by_employee_id=p_actor,void_reason_code=p->>'reason',void_reason_note=nullif(private.trim_whitespace(p->>'reasonNote'),''),lock_version=lock_version+1 where store_id=sid and id=oid;
  return jsonb_build_object('kind',p->>'kind','order',private.order_snapshot(sid,oid));
 elsif p->>'kind'='pay_order_items' then
  update public.orders set order_no=(plan->>'nextNo')::integer where store_id=sid and id=oid;
  insert into public.orders(id,store_id,table_id,order_type,order_no,business_date,status,subtotal,total,employee_id,paid_at,created_by_employee_id,last_modified_by_employee_id,created_at,updated_at)
  values(paid_oid,sid,o.table_id,o.order_type,o.order_no,o.business_date,'paid',amount,amount,p_actor,p_at,p_actor,null,p_at,p_at);
  for line in select value from jsonb_array_elements(p->'lines') loop
   select i.* into item from public.order_items i where i.store_id=sid and i.id=(line->>'orderItemId')::uuid;
   if (line->>'quantity')::integer=item.quantity then
    update public.order_items set order_id=paid_oid where store_id=sid and id=item.id;
   else
    update public.order_items set quantity=quantity-(line->>'quantity')::integer where store_id=sid and id=item.id;
    insert into public.order_items(id,store_id,order_id,menu_item_id,item_name,quantity,unit_price,note,status,sort_order,created_at,updated_at)
    values((line->>'splitItemId')::uuid,sid,paid_oid,item.menu_item_id,item.item_name,(line->>'quantity')::integer,item.unit_price,item.note,item.status,item.sort_order,p_at,p_at);
    insert into public.order_item_options(id,store_id,order_item_id,option_value_id,option_name,price_delta,quantity,snapshot_sort_order,created_at,updated_at)
    select gen_random_uuid(),sid,(line->>'splitItemId')::uuid,v.option_value_id,v.option_name,v.price_delta,v.quantity,v.snapshot_sort_order,p_at,p_at from public.order_item_options v where v.store_id=sid and v.order_item_id=item.id;
   end if;
  end loop;
  update public.orders set subtotal=subtotal-amount,total=total-amount,lock_version=lock_version+1 where store_id=sid and id=oid;
 end if;
 insert into public.payments(id,store_id,order_id,employee_id,method,amount,received_amount,change_amount,paid_at,created_at,updated_at)
 values(payment_id,sid,paid_oid,p_actor,'cash',amount,(p->>'receivedAmount')::integer,(p->>'receivedAmount')::integer-amount,p_at,p_at,p_at);
 if p->>'kind'='pay_order' then
  update public.orders set status='paid',paid_at=p_at,lock_version=lock_version+1 where store_id=sid and id=oid;
  if o.table_id is not null then update public.tables set status='empty' where store_id=sid and id=o.table_id; end if;
 end if;
 receipt:=private.receipt_snapshot(sid,payment_id);
 update public.payments set receipt_snapshot=receipt where store_id=sid and id=payment_id;
 if p->>'kind'='pay_order' then
  return jsonb_build_object('kind',p->>'kind','order',private.order_snapshot(sid,oid),'payment',private.payment_snapshot(sid,payment_id),'receipt',receipt);
 end if;
 return jsonb_build_object('kind',p->>'kind','sourceOrder',private.order_snapshot(sid,oid),'paidOrder',private.order_snapshot(sid,paid_oid),'payment',private.payment_snapshot(sid,payment_id),'receipt',receipt);
end $$;

revoke all on all functions in schema private from public,anon,authenticated;
commit;
