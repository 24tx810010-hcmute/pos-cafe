-- PERM-T07 projection fragment, staged after T04-T06. Not an activation launcher.
-- Each public entry verifies current authority after any target-row wait. Raw
-- relations are closed below, including inherited per-column grants and views.

create function private.permission_read_guard(required text[]) returns void
language plpgsql volatile set search_path=pg_catalog as $$
declare e public.employees;
begin
 e:=private.permission_current_employee(true);
 if cardinality(required)>0 and not(required && private.configured_employee_permissions(e.role,e.permission_overrides)) then
  raise exception 'FORBIDDEN' using errcode='P0401';
 end if;
end $$;

-- Stored business_date remains the accounting key. Hour buckets are display
-- groupings in the store's configured IANA timezone, never the device timezone.
create function private.permission_read_report(sid uuid,business_day date) returns jsonb
language sql stable set search_path=pg_catalog as $$
 with paid as materialized (select * from public.orders where store_id=sid and business_date=business_day and status='paid'),
 totals as (select coalesce(sum(total),0) revenue,count(*) n from paid),
 hours as (select coalesce(to_char(coalesce(p.paid_at,p.created_at) at time zone s.timezone,'HH24'),'--') label,sum(p.total) revenue
   from paid p join public.store_settings s on s.store_id=sid group by 1),
 top_item as (select i.item_name,sum(i.quantity) quantity from public.order_items i join paid p on p.id=i.order_id
   where i.store_id=sid and i.status<>'removed' group by i.item_name order by quantity desc,i.item_name collate "C" limit 1),
 voided as (select count(*) n,coalesce(sum(total),0) amount from public.orders
   where store_id=sid and business_date=business_day and status='void' and paid_at is not null)
 select jsonb_build_object('businessDate',business_day,'revenue',t.revenue,'paidOrders',t.n,
  'averageTicket',case when t.n=0 then 0 else round(t.revenue::numeric/t.n) end,'topItemName',coalesce((select item_name from top_item),'-'),
  'hourlyRevenue',coalesce((select jsonb_agg(jsonb_build_object('label',label,'revenue',revenue) order by label) from hours),'[]'),
  'voidCount',v.n,'voidAmount',v.amount) from totals t cross join voided v
$$;

create function public.permission_get_sales_report(p_filter jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 if not private.exact_fields(p_filter,array['businessDate'],array[]::text[]) or not private.permission_read_date(p_filter->'businessDate') then
  return private.write_failure('INVALID_WRITE_REQUEST');
 end if;
 perform private.permission_read_guard(array['report.view']);
 result:=private.permission_read_report(auth.uid(),(p_filter->>'businessDate')::date);
 perform private.permission_current_employee(false);
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;
create function private.permission_read_missing() returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_object('ok',false,'error',jsonb_build_object('code','NOT_FOUND','message','Không tìm thấy dữ liệu được phép truy cập.','details',null))
$$;
create function private.permission_read_date(v jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
begin
 if jsonb_typeof(v) is distinct from 'string' or (v#>>'{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
 return to_char((v#>>'{}')::date,'YYYY-MM-DD')=(v#>>'{}');
exception when invalid_datetime_format or datetime_field_overflow then return false;
end $$;
create function private.permission_read_history_filter(p jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
begin
 if not private.exact_fields(p,array['page','pageSize'],array['fromDate','toDate','status','orderType','search','tableIds'])
  or not private.valid_integer(p->'page',1,9007199254740991) or not private.valid_integer(p->'pageSize',1,100) then return false; end if;
 if (p?'fromDate' and not private.permission_read_date(p->'fromDate')) or (p?'toDate' and not private.permission_read_date(p->'toDate'))
  or (p->>'fromDate')>(p->>'toDate') then return false; end if;
 if (p?'status' and (jsonb_typeof(p->'status')<>'string' or p->>'status' not in ('paid','void')))
  or (p?'orderType' and (jsonb_typeof(p->'orderType')<>'string' or p->>'orderType' not in ('dine_in','takeaway')))
  or (p?'search' and jsonb_typeof(p->'search')<>'string') then return false; end if;
 if p?'tableIds' then
  if jsonb_typeof(p->'tableIds')<>'array' then return false; end if;
  if exists(select 1 from jsonb_array_elements(p->'tableIds') v where not private.valid_uuid(v)) then return false; end if;
 end if;
 return true;
end $$;

create function private.permission_read_floor(sid uuid) returns jsonb
language sql stable set search_path=pg_catalog as $$
 with a as (select * from public.floor_areas where store_id=sid and deleted_at is null),
 t as (select t.* from public.tables t join a on a.id=t.area_id where t.store_id=sid and t.deleted_at is null),
 d as (select d.* from public.floor_decor_items d join a on a.id=d.area_id where d.store_id=sid and d.deleted_at is null)
 select jsonb_build_object(
  'areas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'sortOrder',sort_order) order by sort_order,id) from a),'[]'),
  'tables',coalesce((select jsonb_agg(jsonb_build_object('id',id,'areaId',area_id,'name',name,'backgroundAssetKey',background_asset_key,
    'posX',pos_x,'posY',pos_y,'width',width,'height',height,'shape',shape,'rotation',rotation,'seats',seats,'sortOrder',sort_order,'status',status) order by sort_order,id) from t),'[]'),
  'decorItems',coalesce((select jsonb_agg(jsonb_build_object('id',id,'areaId',area_id,'kind',kind,'label',label,'assetKey',asset_key,
    'posX',pos_x,'posY',pos_y,'width',width,'height',height,'rotation',rotation,'zIndex',z_index,'isLocked',is_locked) order by z_index,id) from d),'[]'))
$$;
create function private.permission_read_menu(sid uuid,operational boolean) returns jsonb
language sql stable set search_path=pg_catalog as $$
 with c as (select * from public.categories where store_id=sid and deleted_at is null),
 m as (select m.* from public.menu_items m join c on c.id=m.category_id where m.store_id=sid and m.deleted_at is null and (not operational or m.is_available)),
 l as (select l.* from public.menu_item_option_groups l join m on m.id=l.menu_item_id join public.option_groups g on g.store_id=l.store_id and g.id=l.option_group_id and g.deleted_at is null where l.store_id=sid and l.deleted_at is null),
 g as (select g.* from public.option_groups g where g.store_id=sid and g.deleted_at is null and (not operational or exists(select 1 from l where l.option_group_id=g.id))),
 v as (select v.* from public.option_values v join g on g.id=v.option_group_id where v.store_id=sid and v.deleted_at is null)
 select jsonb_build_object(
  'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'sortOrder',c.sort_order) order by c.sort_order,c.id) from c where not operational or exists(select 1 from m where m.category_id=c.id)),'[]'),
  'menuItems',coalesce((select jsonb_agg(jsonb_build_object('id',id,'categoryId',category_id,'name',name,'price',price,'imageAssetKey',image_asset_key,'sortOrder',sort_order,'isAvailable',is_available) order by sort_order,id) from m),'[]'),
  'optionGroups',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'selectType',select_type,'isRequired',is_required,'sortOrder',sort_order) order by sort_order,id) from g),'[]'),
  'optionValues',coalesce((select jsonb_agg(jsonb_build_object('id',id,'optionGroupId',option_group_id,'name',name,'priceDelta',price_delta,'sortOrder',sort_order) order by sort_order,id) from v),'[]'),
  'menuItemOptionGroups',coalesce((select jsonb_agg(jsonb_build_object('id',id,'menuItemId',menu_item_id,'optionGroupId',option_group_id,'sortOrder',sort_order) order by sort_order,id) from l),'[]'))
$$;
create function private.permission_read_items(sid uuid,oid uuid) returns jsonb
language sql stable set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'menuItemId',i.menu_item_id,'itemName',i.item_name,'quantity',i.quantity,'unitPrice',i.unit_price,'note',i.note,
  'options',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'optionValueId',v.option_value_id,'optionName',v.option_name,'priceDelta',v.price_delta,'quantity',v.quantity)
    order by v.snapshot_sort_order,v.created_at,v.id) from public.order_item_options v where v.store_id=sid and v.order_item_id=i.id),'[]')) order by i.sort_order,i.created_at,i.id),'[]')
 from public.order_items i where i.store_id=sid and i.order_id=oid and i.status<>'removed'
$$;
create function private.permission_read_summary(o public.orders) returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_object('id',o.id,'orderNo',o.order_no,'status',o.status,'total',o.total,'lockVersion',o.lock_version,'tableId',o.table_id,'orderType',o.order_type,'businessDate',o.business_date)
$$;
-- Whitelist nested JSON before it crosses REST. Projection never rewrites the
-- immutable receipt or terminal R1; every supported v1 value remains unchanged.
create function private.permission_read_receipt(v jsonb) returns jsonb
language sql immutable strict set search_path=pg_catalog as $$
 select (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(v) where key=any(array[
  'schemaVersion','orderId','paymentId','orderNo','businessDate','storeName','address','footer','tableName','paidAt','employeeName','total','receivedAmount','changeAmount']))
 ||jsonb_build_object('lines',coalesce((select jsonb_agg(
   (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(line) where key=any(array[
    'orderItemId','menuItemId','name','quantity','baseUnitPrice','unitTotal','lineTotal','note']))
   ||jsonb_build_object('options',coalesce((select jsonb_agg(
      (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(opt) where key=any(array['optionValueId','name','priceDelta','quantity']))
      order by oi) from jsonb_array_elements(line->'options') with ordinality o(opt,oi)),'[]'))
   order by li) from jsonb_array_elements(v->'lines') with ordinality l(line,li)),'[]'))
$$;
create function private.permission_read_order(sid uuid,oid uuid,purpose text) returns jsonb
language sql stable set search_path=pg_catalog as $$
 select case purpose when 'open' then jsonb_build_object('id',o.id,'orderNo',o.order_no,'orderType',o.order_type,'tableId',o.table_id,
   'status',o.status,'total',o.total,'lockVersion',o.lock_version,'items',private.permission_read_items(sid,o.id))
  when 'void' then jsonb_build_object('id',o.id,'orderNo',o.order_no,'status',o.status,'total',o.total,'lockVersion',o.lock_version)
  when 'history' then private.permission_read_summary(o)||jsonb_build_object(
   'createdAt',o.created_at,'updatedAt',o.updated_at,'createdByEmployeeId',o.created_by_employee_id,'lastModifiedByEmployeeId',o.last_modified_by_employee_id,
   'items',private.permission_read_items(sid,o.id),'paidAt',o.paid_at,'voidedAt',o.voided_at,'voidedByEmployeeId',o.voided_by_employee_id,
   'voidReasonCode',o.void_reason_code,'voidReasonNote',o.void_reason_note,'receiptSnapshot',private.permission_read_receipt(p.receipt_snapshot),
   'payment',case when p.id is null then null else jsonb_build_object('id',p.id,'employeeId',p.employee_id,'method',p.method,'amount',p.amount,'receivedAmount',p.received_amount,'changeAmount',p.change_amount,'paidAt',p.paid_at) end,
   'cashierName',(select e.name from public.employees e where e.store_id=sid and e.id=p.employee_id),
   'voidedByName',(select e.name from public.employees e where e.store_id=sid and e.id=o.voided_by_employee_id)) end
 from public.orders o left join lateral (select * from public.payments p where p.store_id=sid and p.order_id=o.id order by p.paid_at desc,p.id desc limit 1) p on true
 where o.store_id=sid and o.id=oid and ((purpose='open' and o.status='open') or (purpose='void' and o.status='paid') or (purpose='history' and o.status in ('paid','void')))
$$;
create function private.permission_read_history(sid uuid,p jsonb) returns jsonb
language sql stable set search_path=pg_catalog as $$
 with f as (select private.permission_trim(regexp_replace(coalesce(p->>'search',''),'[%,()]','','g')) search),
 candidates as materialized (select o.* from public.orders o cross join f where o.store_id=sid and o.status in ('paid','void')
  and (not(p?'fromDate') or o.business_date>=(p->>'fromDate')::date) and (not(p?'toDate') or o.business_date<=(p->>'toDate')::date)
  and (not(p?'status') or o.status::text=p->>'status') and (not(p?'orderType') or o.order_type::text=p->>'orderType')
  and ((f.search='' and jsonb_array_length(coalesce(p->'tableIds','[]'))=0)
    or (f.search<>'' and ((regexp_replace(f.search,'^#','') ~ '^[0-9]+$' and o.order_no::text=coalesce(nullif(ltrim(regexp_replace(f.search,'^#',''),'0'),''),'0'))
       or position(lower(f.search) in o.id::text)>0 or position(lower(f.search) in coalesce(o.table_id::text,''))>0))
    or exists(select 1 from jsonb_array_elements_text(coalesce(p->'tableIds','[]')) x where x::uuid=o.table_id))),
 page as (select * from candidates order by business_date desc,order_no desc,id desc limit (p->>'pageSize')::numeric::int offset (((p->>'page')::numeric-1)*(p->>'pageSize')::numeric)::bigint)
 select jsonb_build_object('total',(select count(*) from candidates),'items',coalesce((select jsonb_agg(private.permission_read_summary(row(page.*)::public.orders) order by business_date desc,order_no desc,id desc) from page),'[]'))
$$;

-- Public read entry points and grant closure follow. Each query is a fresh
-- statement after the authority locks; projection builders share one snapshot.

-- T07 PUBLIC READ ENTRIES

create function public.permission_list_report_orders(p_filter jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 if not private.exact_fields(p_filter,array['fromDate','toDate'],array[]::text[])
   or not private.permission_read_date(p_filter->'fromDate') or not private.permission_read_date(p_filter->'toDate')
   or (p_filter->>'fromDate')>(p_filter->>'toDate') then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 perform private.permission_read_guard(array['report.view']);
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'orderNo',o.order_no,'businessDate',o.business_date,'orderType',o.order_type,
  'total',o.total,'status','paid','tableName',t.name) order by o.business_date desc,o.order_no desc,o.id desc),'[]') into result
 from (select id,order_no,business_date,order_type,total,table_id from public.orders where store_id=auth.uid() and status='paid'
  and business_date between (p_filter->>'fromDate')::date and (p_filter->>'toDate')::date
  order by business_date desc,order_no desc,id desc limit 20) o
 left join public.tables t on t.store_id=auth.uid() and t.id=o.table_id and t.deleted_at is null;
 perform private.permission_current_employee(false);
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_get_floor_operational() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 
 
 
 perform private.permission_read_guard(array['floor.view']::text[]);
 result:=(select jsonb_build_object('floorPlan',private.permission_read_floor(auth.uid()),'openOrders',coalesce((select jsonb_agg(
 jsonb_build_object('id',o.id,'tableId',o.table_id,'orderType',o.order_type,'orderNo',o.order_no,'total',o.total,'createdAt',o.created_at) order by o.order_no,o.id)
 from public.orders o where o.store_id=auth.uid() and o.status='open'),'[]')));
 perform private.permission_current_employee(false);
 if result is null then return private.permission_read_missing(); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_get_floor_admin() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 
 
 
 perform private.permission_read_guard(array['floor.manage']::text[]);
 result:=private.permission_read_floor(auth.uid());
 perform private.permission_current_employee(false);
 if result is null then return private.permission_read_missing(); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_get_pos_menu() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 
 
 
 perform private.permission_read_guard(array['order.create','order.update']::text[]);
 result:=private.permission_read_menu(auth.uid(),true);
 perform private.permission_current_employee(false);
 if result is null then return private.permission_read_missing(); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_get_menu_admin() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 
 
 
 perform private.permission_read_guard(array['menu.manage']::text[]);
 result:=private.permission_read_menu(auth.uid(),false);
 perform private.permission_current_employee(false);
 if result is null then return private.permission_read_missing(); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_get_open_order_detail(p_order_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 if not private.valid_uuid(to_jsonb(p_order_id)) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 
 perform 1 from public.orders where store_id=auth.uid() and id=p_order_id for share;
 perform private.permission_read_guard(array['order.update','order.voidOpen','payment.take']::text[]);
 result:=private.permission_read_order(auth.uid(),p_order_id,'open');
 perform private.permission_current_employee(false);
 if result is null then return private.permission_read_missing(); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_get_paid_order_for_void(p_order_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 if not private.valid_uuid(to_jsonb(p_order_id)) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 
 perform 1 from public.orders where store_id=auth.uid() and id=p_order_id for share;
 perform private.permission_read_guard(array['order.voidPaid']::text[]);
 result:=private.permission_read_order(auth.uid(),p_order_id,'void');
 perform private.permission_current_employee(false);
 if result is null then return private.permission_read_missing(); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_get_order_history_detail(p_order_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 if not private.valid_uuid(to_jsonb(p_order_id)) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 
 perform 1 from public.orders where store_id=auth.uid() and id=p_order_id for share;
 perform private.permission_read_guard(array['orderHistory.view']::text[]);
 result:=private.permission_read_order(auth.uid(),p_order_id,'history');
 perform private.permission_current_employee(false);
 if result is null then return private.permission_read_missing(); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_list_order_history(p_filter jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 
 if not private.permission_read_history_filter(p_filter) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 
 perform private.permission_read_guard(array['orderHistory.view']::text[]);
 result:=private.permission_read_history(auth.uid(),p_filter);
 perform private.permission_current_employee(false);
 if result is null then return private.permission_read_missing(); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_get_store_display() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 
 
 
 perform private.permission_read_guard(array[]::text[]);
 result:=(select jsonb_build_object('displayName',display_name,'address',address,'currency',currency,'timezone',timezone,'billFooter',bill_footer) from public.store_settings where store_id=auth.uid());
 perform private.permission_current_employee(false);
 if result is null then return private.permission_read_missing(); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_get_settings_admin() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 
 
 
 perform private.permission_read_guard(array['settings.manage']::text[]);
 result:=(select jsonb_build_object('storeId',store_id,'displayName',display_name,'address',address,'currency',currency,'timezone',timezone,'billFooter',bill_footer) from public.store_settings where store_id=auth.uid());
 perform private.permission_current_employee(false);
 if result is null then return private.permission_read_missing(); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create or replace function public.get_payment_receipt(p_order_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare result jsonb;
begin
 perform private.permission_current_employee(false);
 if not private.valid_uuid(to_jsonb(p_order_id)) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 perform 1 from public.orders where store_id=auth.uid() and id=p_order_id for share;
 perform private.permission_read_guard(array['orderHistory.view','payment.take']);
 select jsonb_build_object('ok',true,'receipt',private.permission_read_receipt(coalesce(p.receipt_snapshot,private.receipt_snapshot(auth.uid(),p.id))),'legacyMetadata',p.receipt_snapshot is null)
 into result from public.orders o join lateral (select p.* from public.payments p where p.store_id=o.store_id and p.order_id=o.id order by p.paid_at desc,p.id desc limit 1) p on true
 where o.store_id=auth.uid() and o.id=p_order_id and o.status='paid';
 perform private.permission_current_employee(false);
 return coalesce(result,private.write_failure('RECEIPT_UNAVAILABLE'));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

-- RPC projections are the only employee read path. Table-level REVOKE alone
-- does not remove old column grants. Include the legacy history view explicitly.
do $$
declare t record; a record; f record;
begin
 for t in select c.oid,c.relname from pg_class c where c.relnamespace='public'::regnamespace and c.relname=any(array[
  'stores','store_settings','employees','categories','menu_items','option_groups','option_values','menu_item_option_groups',
  'floor_areas','tables','floor_decor_items','orders','order_items','order_item_options','payments','write_operations','order_events',
  'employee_admin_audit','permission_catalog','permission_catalog_state','permission_roles','role_permission_defaults','history_entries']) loop
  execute format('revoke select on public.%I from public,anon,authenticated,service_role',t.relname);
  for a in select attname from pg_attribute where attrelid=t.oid and attnum>0 and not attisdropped loop
   execute format('revoke select(%I) on public.%I from public,anon,authenticated,service_role',a.attname,t.relname);
  end loop;
 end loop;
 for f in select p.oid::regprocedure signature,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='private' and p.proname like 'permission_read_%')
     or (n.nspname='public' and (p.proname in ('permission_get_floor_operational','permission_get_pos_menu','permission_get_open_order_detail',
       'permission_get_paid_order_for_void','permission_list_order_history','permission_get_order_history_detail','get_payment_receipt',
       'permission_get_sales_report','permission_list_report_orders','permission_get_menu_admin','permission_get_floor_admin','permission_get_settings_admin','permission_get_store_display'))) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.nspname='public' then execute format('grant execute on function %s to anon,authenticated',f.signature); end if;
 end loop;
end $$;
