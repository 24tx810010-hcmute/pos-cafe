-- PERM-T08 staged non-financial write fragment. Apply after T01-T07 candidates.
-- This file is a candidate, not an activation migration.

create function private.permission_changes_failure(code text, details jsonb default null) returns jsonb
language sql volatile set search_path=pg_catalog as $$
 select case when details is null then private.permission_failure(code)
 else jsonb_build_object('ok',false,'error',(private.permission_failure(code)->'error')||jsonb_build_object('details',details)) end
$$;

create function private.permission_changes_checkpoint(required_permission text) returns public.employees
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); eid uuid; actor public.employees;
begin
 if sid is null then raise exception 'AUTH_REQUIRED' using errcode='P0401'; end if;
 select employee_id into eid from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash();
 perform 1 from public.stores where id=sid for share;
 perform 1 from public.employees where store_id=sid and id=eid for share;
 perform 1 from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash() for share;
 perform private.permission_catalog_share();
 actor:=private.permission_current_employee(false);
 if not required_permission=any(private.configured_employee_permissions(actor.role,actor.permission_overrides)) then
  raise exception 'FORBIDDEN' using errcode='P0401';
 end if;
 return actor;
end $$;

create function private.permission_changes_valid_uuid_array(values_json jsonb) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select jsonb_typeof(values_json)='array' and not exists(
  select 1 from jsonb_array_elements(values_json) x where jsonb_typeof(x)<>'object' or not private.valid_uuid(x->'id'))
$$;

create function private.permission_changes_valid_set(set_json jsonb, create_fields text[], update_fields text[], optional_create_fields text[] default array[]::text[]) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select jsonb_typeof(set_json)='object' and set_json ?& array['created','updated','deleted']
 and set_json-array['created','updated','deleted']='{}'::jsonb
 and jsonb_typeof(set_json->'created')='array' and jsonb_typeof(set_json->'updated')='array' and jsonb_typeof(set_json->'deleted')='array'
 and not exists(select 1 from jsonb_array_elements(set_json->'created') x where jsonb_typeof(x)<>'object' or not x ?& create_fields or x-(create_fields||optional_create_fields)<>'{}'::jsonb or not private.valid_uuid(x->'id'))
 and not exists(select 1 from jsonb_array_elements(set_json->'updated') x where jsonb_typeof(x)<>'object' or not x ? 'id' or x-(update_fields||array['id'])<>'{}'::jsonb or (select count(*) from jsonb_object_keys(x))<2 or not private.valid_uuid(x->'id'))
 and not exists(select 1 from jsonb_array_elements(set_json->'deleted') x where jsonb_typeof(x)<>'object' or not x ? 'id' or x-array['id','deletedByEmployeeId']<>'{}'::jsonb or not private.valid_uuid(x->'id')
  or (x ? 'deletedByEmployeeId' and x->'deletedByEmployeeId'<>'null'::jsonb))
$$;

create function private.permission_changes_text(v jsonb, max_len int default 120, nullable boolean default false) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select case when v is null then false when v='null'::jsonb then nullable
 else jsonb_typeof(v)='string' and char_length(btrim(v#>>'{}')) between 1 and max_len end
$$;
create function private.permission_changes_int(v jsonb, min_value int, max_value int) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select jsonb_typeof(v)='number' and v::text~'^-?[0-9]+$' and v::text::numeric between min_value and max_value
$$;
create function private.permission_changes_bool(v jsonb) returns boolean language sql immutable set search_path=pg_catalog as $$ select jsonb_typeof(v)='boolean' $$;
create function private.permission_floor_asset(v jsonb, table_background boolean) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare key text; n int;
begin
 if v='null'::jsonb then return table_background; end if;
 if jsonb_typeof(v)<>'string' then return false; end if; key:=v#>>'{}';
 if table_background then
  if key !~ '^/floor-assets/tables/table-bg-[0-9]{2}\.png$' then return false; end if;
  n:=substring(key from '([0-9]{2})\.png$')::int; return n between 1 and 11;
 end if;
 if key='/floor-assets/walls/img-color-cell.png' then return true; end if;
 if key~'^/floor-assets/walls/img-color-cell[1-8]\.webp$' then return true; end if;
 if key !~ '^/floor-assets/decor/deco-(tree|seat|fixtures|other)-[0-9]{2}\.png$' then return false; end if;
 n:=substring(key from '([0-9]{2})\.png$')::int;
 return case substring(key from 'deco-([a-z]+)-') when 'tree' then n between 1 and 57 when 'seat' then n between 1 and 29 when 'fixtures' then n between 1 and 30 when 'other' then n between 1 and 15 else false end;
end $$;

create function private.permission_menu_valid(p jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare x jsonb;
begin
 if jsonb_typeof(p)<>'object' or not p ?& array['categories','menuItems','optionGroups','optionValues','menuItemOptionGroups']
 or p-array['categories','menuItems','optionGroups','optionValues','menuItemOptionGroups','imageChanges']<>'{}' then return false; end if;
 if not private.permission_changes_valid_set(p->'categories',array['id','name','sortOrder'],array['name','sortOrder'])
 or not private.permission_changes_valid_set(p->'menuItems',array['id','categoryId','name','price','sortOrder','isAvailable'],array['categoryId','name','price','imageAssetKey','sortOrder','isAvailable'],array['imageAssetKey'])
 or not private.permission_changes_valid_set(p->'optionGroups',array['id','name','selectType','isRequired','sortOrder'],array['name','selectType','isRequired','sortOrder'])
 or not private.permission_changes_valid_set(p->'optionValues',array['id','optionGroupId','name','priceDelta','sortOrder'],array['optionGroupId','name','priceDelta','sortOrder'])
 or not private.permission_changes_valid_set(p->'menuItemOptionGroups',array['id','menuItemId','optionGroupId','sortOrder'],array['menuItemId','optionGroupId','sortOrder']) then return false; end if;
 if p?'imageChanges' and (jsonb_typeof(p->'imageChanges')<>'array' or exists(select 1 from jsonb_array_elements(p->'imageChanges') j
  where jsonb_typeof(j)<>'object' or not j?&array['itemId','uploadHandle'] or j-array['itemId','uploadHandle']<>'{}'
  or not private.valid_uuid(j->'itemId') or (j->'uploadHandle'<>'null'::jsonb and not private.valid_uuid(j->'uploadHandle')))
  or (select count(*)<>count(distinct j->>'itemId') from jsonb_array_elements(p->'imageChanges') j)) then return false; end if;
 for x in select value from jsonb_array_elements((p->'categories'->'created')||(p->'categories'->'updated')) loop
  if (x?'name' and not private.permission_changes_text(x->'name')) or (x?'sortOrder' and not private.permission_changes_int(x->'sortOrder',0,2147483647)) then return false; end if; end loop;
 for x in select value from jsonb_array_elements((p->'menuItems'->'created')||(p->'menuItems'->'updated')) loop
  if (x?'categoryId' and not private.valid_uuid(x->'categoryId')) or (x?'name' and not private.permission_changes_text(x->'name'))
   or (x?'price' and not private.permission_changes_int(x->'price',0,2147483647)) or (x?'sortOrder' and not private.permission_changes_int(x->'sortOrder',0,2147483647))
   or (x?'isAvailable' and not private.permission_changes_bool(x->'isAvailable')) then return false; end if;
  -- T09 owns new private upload handles. T08 accepts no image on create and only
  -- an unchanged legacy reference on update (checked under the row lock below).
  if x ? 'imageAssetKey' and x->'imageAssetKey'<>'null'::jsonb and not private.permission_changes_text(x->'imageAssetKey',512) then return false; end if;
 end loop;
 for x in select value from jsonb_array_elements((p->'optionGroups'->'created')||(p->'optionGroups'->'updated')) loop
  if (x?'name' and not private.permission_changes_text(x->'name')) or (x?'selectType' and x->>'selectType' not in ('single','multi'))
   or (x?'isRequired' and not private.permission_changes_bool(x->'isRequired')) or (x?'sortOrder' and not private.permission_changes_int(x->'sortOrder',0,2147483647)) then return false; end if; end loop;
 for x in select value from jsonb_array_elements((p->'optionValues'->'created')||(p->'optionValues'->'updated')) loop
  if (x?'optionGroupId' and not private.valid_uuid(x->'optionGroupId')) or (x?'name' and not private.permission_changes_text(x->'name'))
   or (x?'priceDelta' and not private.permission_changes_int(x->'priceDelta',0,2147483647)) or (x?'sortOrder' and not private.permission_changes_int(x->'sortOrder',0,2147483647)) then return false; end if; end loop;
 for x in select value from jsonb_array_elements((p->'menuItemOptionGroups'->'created')||(p->'menuItemOptionGroups'->'updated')) loop
  if (x?'menuItemId' and not private.valid_uuid(x->'menuItemId')) or (x?'optionGroupId' and not private.valid_uuid(x->'optionGroupId'))
   or (x?'sortOrder' and not private.permission_changes_int(x->'sortOrder',0,2147483647)) then return false; end if; end loop;
 return true;
end $$;

create function private.permission_lock_changes(p jsonb, keys text[], tables text[]) returns void
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare i int; rid uuid;
begin
 perform private.permission_store_mutex(auth.uid());
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||':pos-write'));
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||':catalog-write'));
 for i in 1..cardinality(keys) loop
  for rid in select distinct (j->>'id')::uuid from jsonb_array_elements((p->keys[i]->'updated')||(p->keys[i]->'deleted')) j order by 1 loop
   execute format('select 1 from public.%I where store_id=$1 and id=$2 for update',tables[i]) using auth.uid(),rid;
  end loop;
 end loop;
end $$;

create function public.apply_menu_changes(p_changes jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare actor public.employees; x jsonb; current_key text; affected int:=0; sid uuid:=auth.uid();
begin
 perform private.permission_current_employee(false);
 if not private.permission_menu_valid(p_changes) then return private.permission_changes_failure('INVALID_WRITE_REQUEST'); end if;
 perform private.permission_lock_changes(p_changes,array['categories','menuItems','optionGroups','optionValues','menuItemOptionGroups'],array['categories','menu_items','option_groups','option_values','menu_item_option_groups']);
 -- Lock referenced parents after mutable targets and before the final checkpoint.
 perform 1 from public.categories where store_id=sid and id in (select (j->>'categoryId')::uuid from jsonb_array_elements((p_changes->'menuItems'->'created')||(p_changes->'menuItems'->'updated')) j where j?'categoryId') order by id for share;
 perform 1 from public.option_groups where store_id=sid and id in (select (j->>'optionGroupId')::uuid from jsonb_array_elements((p_changes->'optionValues'->'created')||(p_changes->'optionValues'->'updated')||(p_changes->'menuItemOptionGroups'->'created')||(p_changes->'menuItemOptionGroups'->'updated')) j where j?'optionGroupId') order by id for share;
 perform 1 from public.menu_items where store_id=sid and id in (select (j->>'menuItemId')::uuid from jsonb_array_elements((p_changes->'menuItemOptionGroups'->'created')||(p_changes->'menuItemOptionGroups'->'updated')) j where j?'menuItemId') order by id for share;
 perform 1 from public.menu_items where store_id=sid and id in (select (j->>'itemId')::uuid from jsonb_array_elements(coalesce(p_changes->'imageChanges','[]'::jsonb)) j) order by id for update;
 -- T09 supplies this helper. Dynamic dispatch keeps this T08 fragment stageable
 -- before the private image registry is installed; activation installs both.
 if p_changes?'imageChanges' then execute 'select private.permission_lock_menu_image_changes($1,$2)' using sid,p_changes->'imageChanges'; end if;
 actor:=private.permission_changes_checkpoint('menu.manage');
 -- Every update/delete id must resolve inside the current tenant.
 if exists(select 1 from (values ('categories','categories'),('menuItems','menu_items'),('optionGroups','option_groups'),('optionValues','option_values'),('menuItemOptionGroups','menu_item_option_groups')) v(k,t)
  cross join lateral jsonb_array_elements((p_changes->v.k->'updated')||(p_changes->v.k->'deleted')) j
  where case v.t when 'categories' then not exists(select 1 from public.categories q where q.store_id=sid and q.id=(j->>'id')::uuid)
   when 'menu_items' then not exists(select 1 from public.menu_items q where q.store_id=sid and q.id=(j->>'id')::uuid)
   when 'option_groups' then not exists(select 1 from public.option_groups q where q.store_id=sid and q.id=(j->>'id')::uuid)
   when 'option_values' then not exists(select 1 from public.option_values q where q.store_id=sid and q.id=(j->>'id')::uuid)
   else not exists(select 1 from public.menu_item_option_groups q where q.store_id=sid and q.id=(j->>'id')::uuid) end) then return private.permission_changes_failure('NOT_FOUND'); end if;
 if exists(select 1 from jsonb_array_elements(p_changes->'menuItems'->'created') j where j?'imageAssetKey' and j->'imageAssetKey'<>'null'::jsonb)
 or exists(select 1 from jsonb_array_elements(p_changes->'menuItems'->'updated') j join public.menu_items m on m.store_id=sid and m.id=(j->>'id')::uuid where j?'imageAssetKey' and j->>'imageAssetKey' is distinct from m.image_asset_key) then
  return private.permission_changes_failure('INVALID_WRITE_REQUEST');
 end if;
 -- Create parents before children.
 for x in select value from jsonb_array_elements(p_changes->'categories'->'created') loop insert into public.categories(id,store_id,name,sort_order) values((x->>'id')::uuid,sid,btrim(x->>'name'),(x->>'sortOrder')::int); affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'menuItems'->'created') loop insert into public.menu_items(id,store_id,category_id,name,price,sort_order,is_available) values((x->>'id')::uuid,sid,(x->>'categoryId')::uuid,btrim(x->>'name'),(x->>'price')::int,(x->>'sortOrder')::int,(x->>'isAvailable')::boolean); affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'optionGroups'->'created') loop insert into public.option_groups(id,store_id,name,select_type,is_required,sort_order) values((x->>'id')::uuid,sid,btrim(x->>'name'),(x->>'selectType')::public.option_select_type,(x->>'isRequired')::boolean,(x->>'sortOrder')::int); affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'optionValues'->'created') loop insert into public.option_values(id,store_id,option_group_id,name,price_delta,sort_order) values((x->>'id')::uuid,sid,(x->>'optionGroupId')::uuid,btrim(x->>'name'),(x->>'priceDelta')::int,(x->>'sortOrder')::int); affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'menuItemOptionGroups'->'created') loop insert into public.menu_item_option_groups(id,store_id,menu_item_id,option_group_id,sort_order) values((x->>'id')::uuid,sid,(x->>'menuItemId')::uuid,(x->>'optionGroupId')::uuid,(x->>'sortOrder')::int); affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(coalesce(p_changes->'imageChanges','[]'::jsonb)) loop
  -- Draft IDs may be staged before creation, but only an active item in this
  -- transaction can publish. Raise (rather than return) to roll back earlier inserts.
  perform 1 from public.menu_items where store_id=sid and id=(x->>'itemId')::uuid and deleted_at is null;
  if not found or exists(select 1 from jsonb_array_elements(p_changes->'menuItems'->'deleted') d where d->>'id'=x->>'itemId') then
   raise exception 'NOT_FOUND' using errcode='P0404';
  end if;
  if x->'uploadHandle'='null'::jsonb then
   select image_asset_key into current_key from public.menu_items where store_id=sid and id=(x->>'itemId')::uuid;
   if current_key is not null then execute 'select private.permission_unpublish_menu_image($1,$2,$3)' using sid,(x->>'itemId')::uuid,current_key; end if;
   update public.menu_items set image_asset_key=null where store_id=sid and id=(x->>'itemId')::uuid;
  else
   execute 'select private.permission_finalize_menu_image($1,$2,$3)' into current_key using sid,(x->>'itemId')::uuid,(x->>'uploadHandle')::uuid;
   update public.menu_items set image_asset_key=current_key where store_id=sid and id=(x->>'itemId')::uuid;
  end if; affected:=affected+1;
 end loop;
 -- JSON populate_record limits updates to the explicit whitelist without dynamic SQL.
 for x in select value from jsonb_array_elements(p_changes->'categories'->'updated') loop update public.categories q set name=coalesce(btrim(x->>'name'),q.name),sort_order=coalesce((x->>'sortOrder')::int,q.sort_order) where q.store_id=sid and q.id=(x->>'id')::uuid; affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'menuItems'->'updated') loop update public.menu_items q set category_id=coalesce((x->>'categoryId')::uuid,q.category_id),name=coalesce(btrim(x->>'name'),q.name),price=coalesce((x->>'price')::int,q.price),sort_order=coalesce((x->>'sortOrder')::int,q.sort_order),is_available=coalesce((x->>'isAvailable')::boolean,q.is_available) where q.store_id=sid and q.id=(x->>'id')::uuid; affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'optionGroups'->'updated') loop update public.option_groups q set name=coalesce(btrim(x->>'name'),q.name),select_type=coalesce((x->>'selectType')::public.option_select_type,q.select_type),is_required=coalesce((x->>'isRequired')::boolean,q.is_required),sort_order=coalesce((x->>'sortOrder')::int,q.sort_order) where q.store_id=sid and q.id=(x->>'id')::uuid; affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'optionValues'->'updated') loop update public.option_values q set option_group_id=coalesce((x->>'optionGroupId')::uuid,q.option_group_id),name=coalesce(btrim(x->>'name'),q.name),price_delta=coalesce((x->>'priceDelta')::int,q.price_delta),sort_order=coalesce((x->>'sortOrder')::int,q.sort_order) where q.store_id=sid and q.id=(x->>'id')::uuid; affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'menuItemOptionGroups'->'updated') loop update public.menu_item_option_groups q set menu_item_id=coalesce((x->>'menuItemId')::uuid,q.menu_item_id),option_group_id=coalesce((x->>'optionGroupId')::uuid,q.option_group_id),sort_order=coalesce((x->>'sortOrder')::int,q.sort_order) where q.store_id=sid and q.id=(x->>'id')::uuid; affected:=affected+1; end loop;
 -- Tombstone children before parents; actor comes only from the authenticated session.
 for current_key in select unnest(array['menuItemOptionGroups','optionValues','optionGroups','menuItems','categories']) loop
  for x in select value from jsonb_array_elements(p_changes->current_key->'deleted') loop
   case current_key
    when 'menuItemOptionGroups' then update public.menu_item_option_groups set deleted_at=coalesce(deleted_at,now()),deleted_by_employee_id=actor.id where store_id=sid and id=(x->>'id')::uuid;
    when 'optionValues' then update public.option_values set deleted_at=coalesce(deleted_at,now()),deleted_by_employee_id=actor.id where store_id=sid and id=(x->>'id')::uuid;
    when 'optionGroups' then update public.option_groups set deleted_at=coalesce(deleted_at,now()),deleted_by_employee_id=actor.id where store_id=sid and id=(x->>'id')::uuid;
    when 'menuItems' then update public.menu_items set deleted_at=coalesce(deleted_at,now()),deleted_by_employee_id=actor.id where store_id=sid and id=(x->>'id')::uuid;
    else update public.categories set deleted_at=coalesce(deleted_at,now()),deleted_by_employee_id=actor.id where store_id=sid and id=(x->>'id')::uuid; end case; affected:=affected+1;
  end loop;
 end loop;
 return jsonb_build_object('ok',true,'data',null);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm); when sqlstate 'P0404' then return private.permission_changes_failure('NOT_FOUND'); when unique_violation or foreign_key_violation or check_violation then return private.permission_changes_failure('INVALID_WRITE_REQUEST');
end $$;

create function private.permission_floor_valid(p jsonb) returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare x jsonb;
begin
 if jsonb_typeof(p)<>'object' or not p?&array['areas','tables','decorItems'] or p-array['areas','tables','decorItems']<>'{}' then return false; end if;
 if not private.permission_changes_valid_set(p->'areas',array['id','name','sortOrder'],array['name','sortOrder'])
 or not private.permission_changes_valid_set(p->'tables',array['id','areaId','name','backgroundAssetKey','posX','posY','width','height','shape','rotation','seats','sortOrder'],array['areaId','name','backgroundAssetKey','posX','posY','width','height','shape','rotation','seats','sortOrder'])
 or not private.permission_changes_valid_set(p->'decorItems',array['id','areaId','kind','label','assetKey','posX','posY','width','height','rotation','zIndex','isLocked'],array['areaId','kind','label','assetKey','posX','posY','width','height','rotation','zIndex','isLocked']) then return false; end if;
 for x in select value from jsonb_array_elements((p->'areas'->'created')||(p->'areas'->'updated')) loop if (x?'name' and not private.permission_changes_text(x->'name')) or (x?'sortOrder' and not private.permission_changes_int(x->'sortOrder',0,2147483647)) then return false; end if; end loop;
 for x in select value from jsonb_array_elements((p->'tables'->'created')||(p->'tables'->'updated')) loop
  if (x?'areaId' and not private.valid_uuid(x->'areaId')) or (x?'name' and not private.permission_changes_text(x->'name')) or (x?'shape' and x->>'shape' not in('round','square','rectangle'))
   or (x?'backgroundAssetKey' and not private.permission_floor_asset(x->'backgroundAssetKey',true))
   or exists(select 1 from jsonb_each(x) e where e.key=any(array['posX','posY','rotation']) and not private.permission_changes_int(e.value,-100000,100000))
   or exists(select 1 from jsonb_each(x) e where e.key=any(array['width','height','seats']) and not private.permission_changes_int(e.value,1,100000))
   or (x?'sortOrder' and not private.permission_changes_int(x->'sortOrder',0,2147483647)) then return false; end if; end loop;
 for x in select value from jsonb_array_elements((p->'decorItems'->'created')||(p->'decorItems'->'updated')) loop
  if (x?'areaId' and not private.valid_uuid(x->'areaId')) or (x?'kind' and x->>'kind' not in('wall','plant','counter','door','decor','image'))
   or (x?'label' and not private.permission_changes_text(x->'label',120,true)) or (x?'assetKey' and not private.permission_floor_asset(x->'assetKey',false))
   or exists(select 1 from jsonb_each(x) e where e.key=any(array['posX','posY','rotation','zIndex']) and not private.permission_changes_int(e.value,-100000,100000))
   or exists(select 1 from jsonb_each(x) e where e.key=any(array['width','height']) and not private.permission_changes_int(e.value,1,100000))
   or (x?'isLocked' and not private.permission_changes_bool(x->'isLocked')) then return false; end if; end loop;
 return true;
end $$;

create function public.apply_floor_changes(p_changes jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare actor public.employees; x jsonb; sid uuid:=auth.uid(); affected int:=0;
begin
 perform private.permission_current_employee(false);
 if not private.permission_floor_valid(p_changes) then return private.permission_changes_failure('INVALID_WRITE_REQUEST'); end if;
 perform private.permission_lock_changes(p_changes,array['areas','tables','decorItems'],array['floor_areas','tables','floor_decor_items']);
 perform 1 from public.floor_areas where store_id=sid and id in (select (j->>'areaId')::uuid from jsonb_array_elements((p_changes->'tables'->'created')||(p_changes->'tables'->'updated')||(p_changes->'decorItems'->'created')||(p_changes->'decorItems'->'updated')) j where j?'areaId') order by id for share;
 actor:=private.permission_changes_checkpoint('floor.manage');
 if exists(select 1 from jsonb_array_elements((p_changes->'areas'->'updated')||(p_changes->'areas'->'deleted')) j
   where not exists(select 1 from public.floor_areas q where q.store_id=sid and q.id=(j->>'id')::uuid))
 or exists(select 1 from jsonb_array_elements((p_changes->'tables'->'updated')||(p_changes->'tables'->'deleted')) j
   where not exists(select 1 from public.tables q where q.store_id=sid and q.id=(j->>'id')::uuid))
 or exists(select 1 from jsonb_array_elements((p_changes->'decorItems'->'updated')||(p_changes->'decorItems'->'deleted')) j
   where not exists(select 1 from public.floor_decor_items q where q.store_id=sid and q.id=(j->>'id')::uuid)) then return private.permission_changes_failure('NOT_FOUND'); end if;
  -- All target rows are locked above. Reject the whole request before its first
  -- mutation when any requested table deletion is no longer allowed.
  if exists(select 1 from jsonb_array_elements(p_changes->'tables'->'deleted') j
    join public.tables q on q.store_id=sid and q.id=(j->>'id')::uuid where q.status<>'empty') then
   return private.permission_changes_failure('INVALID_WRITE_REQUEST');
  end if;
 for x in select value from jsonb_array_elements(p_changes->'areas'->'created') loop insert into public.floor_areas(id,store_id,name,sort_order) values((x->>'id')::uuid,sid,btrim(x->>'name'),(x->>'sortOrder')::int); affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'tables'->'created') loop insert into public.tables(id,store_id,area_id,name,background_asset_key,pos_x,pos_y,width,height,shape,rotation,seats,sort_order) values((x->>'id')::uuid,sid,(x->>'areaId')::uuid,btrim(x->>'name'),x->>'backgroundAssetKey',(x->>'posX')::int,(x->>'posY')::int,(x->>'width')::int,(x->>'height')::int,(x->>'shape')::public.table_shape,(x->>'rotation')::int,(x->>'seats')::int,(x->>'sortOrder')::int); affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'decorItems'->'created') loop insert into public.floor_decor_items(id,store_id,area_id,kind,label,asset_key,pos_x,pos_y,width,height,rotation,z_index,is_locked) values((x->>'id')::uuid,sid,(x->>'areaId')::uuid,(x->>'kind')::public.decor_kind,nullif(x->>'label',''),x->>'assetKey',(x->>'posX')::int,(x->>'posY')::int,(x->>'width')::int,(x->>'height')::int,(x->>'rotation')::int,(x->>'zIndex')::int,(x->>'isLocked')::boolean); affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'areas'->'updated') loop update public.floor_areas q set name=coalesce(btrim(x->>'name'),q.name),sort_order=coalesce((x->>'sortOrder')::int,q.sort_order) where store_id=sid and id=(x->>'id')::uuid; affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'tables'->'updated') loop update public.tables q set area_id=coalesce((x->>'areaId')::uuid,q.area_id),name=coalesce(btrim(x->>'name'),q.name),background_asset_key=case when x?'backgroundAssetKey' then x->>'backgroundAssetKey' else q.background_asset_key end,pos_x=coalesce((x->>'posX')::int,q.pos_x),pos_y=coalesce((x->>'posY')::int,q.pos_y),width=coalesce((x->>'width')::int,q.width),height=coalesce((x->>'height')::int,q.height),shape=coalesce((x->>'shape')::public.table_shape,q.shape),rotation=coalesce((x->>'rotation')::int,q.rotation),seats=coalesce((x->>'seats')::int,q.seats),sort_order=coalesce((x->>'sortOrder')::int,q.sort_order) where store_id=sid and id=(x->>'id')::uuid; affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'decorItems'->'updated') loop update public.floor_decor_items q set area_id=coalesce((x->>'areaId')::uuid,q.area_id),kind=coalesce((x->>'kind')::public.decor_kind,q.kind),label=case when x?'label' then nullif(x->>'label','') else q.label end,asset_key=coalesce(x->>'assetKey',q.asset_key),pos_x=coalesce((x->>'posX')::int,q.pos_x),pos_y=coalesce((x->>'posY')::int,q.pos_y),width=coalesce((x->>'width')::int,q.width),height=coalesce((x->>'height')::int,q.height),rotation=coalesce((x->>'rotation')::int,q.rotation),z_index=coalesce((x->>'zIndex')::int,q.z_index),is_locked=coalesce((x->>'isLocked')::boolean,q.is_locked) where store_id=sid and id=(x->>'id')::uuid; affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'decorItems'->'deleted') loop update public.floor_decor_items set deleted_at=coalesce(deleted_at,now()),deleted_by_employee_id=actor.id where store_id=sid and id=(x->>'id')::uuid; affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'tables'->'deleted') loop update public.tables set deleted_at=coalesce(deleted_at,now()),deleted_by_employee_id=actor.id where store_id=sid and id=(x->>'id')::uuid and status='empty'; if not found then return private.permission_changes_failure('INVALID_WRITE_REQUEST'); end if; affected:=affected+1; end loop;
 for x in select value from jsonb_array_elements(p_changes->'areas'->'deleted') loop update public.floor_areas set deleted_at=coalesce(deleted_at,now()),deleted_by_employee_id=actor.id where store_id=sid and id=(x->>'id')::uuid; affected:=affected+1; end loop;
 return jsonb_build_object('ok',true,'data',null);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm); when unique_violation or foreign_key_violation or check_violation then return private.permission_changes_failure('INVALID_WRITE_REQUEST');
end $$;

create function public.update_store_settings(p_input jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare actor public.employees; before_row public.store_settings; after_row public.store_settings; sid uuid:=auth.uid();
begin
 perform private.permission_current_employee(false);
 if jsonb_typeof(p_input)<>'object' or p_input='{}'::jsonb or p_input-array['displayName','address','billFooter','timezone']<>'{}'
 or (p_input?'displayName' and not private.permission_changes_text(p_input->'displayName',120))
 or (p_input?'address' and (jsonb_typeof(p_input->'address')<>'string' or char_length(p_input->>'address')>500))
 or (p_input?'billFooter' and (jsonb_typeof(p_input->'billFooter')<>'string' or char_length(p_input->>'billFooter')>500))
 or (p_input?'timezone' and (jsonb_typeof(p_input->'timezone')<>'string' or not exists(select 1 from pg_timezone_names where name=p_input->>'timezone'))) then return private.permission_changes_failure('INVALID_WRITE_REQUEST'); end if;
 perform private.permission_store_mutex(sid);
 select * into before_row from public.store_settings where store_id=sid for update;
 actor:=private.permission_changes_checkpoint('settings.manage');
 if before_row.store_id is null then return private.permission_changes_failure('NOT_FOUND'); end if;
 if p_input?'timezone' and p_input->>'timezone' is distinct from before_row.timezone and actor.role<>'owner' then return private.permission_changes_failure('FORBIDDEN'); end if;
 update public.store_settings set display_name=case when p_input?'displayName' then btrim(p_input->>'displayName') else display_name end,address=case when p_input?'address' then p_input->>'address' else address end,bill_footer=case when p_input?'billFooter' then p_input->>'billFooter' else bill_footer end,timezone=case when p_input?'timezone' then p_input->>'timezone' else timezone end where store_id=sid returning * into after_row;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('storeId',after_row.store_id,'displayName',after_row.display_name,'address',after_row.address,'currency',after_row.currency,'timezone',after_row.timezone,'billFooter',after_row.bill_footer));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm); end $$;

create or replace function public.clear_demo_data(p_request_id uuid,p_confirmation boolean) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); actor public.employees; demo public.employees; prior private.employee_admin_requests;
 mac_key private.permission_request_mac_keys; payload_mac bytea; actor_rights text[]; catrev bigint;
 before_json jsonb; after_json jsonb; result jsonb; audit_keys jsonb:='[]'::jsonb;
 why text; outcome text; n int:=0; menu_changed boolean:=false; floor_changed boolean:=false;
 employee_changed boolean:=false;
begin
 -- This preliminary read rejects missing/revoked sessions before any request
 -- registry or audit work. Authority is checked again after every bulk lock.
 actor:=private.permission_current_employee(false);
 if p_request_id is null then return private.permission_changes_failure('INVALID_WRITE_REQUEST'); end if;
 perform private.permission_store_mutex(sid);
 perform pg_advisory_xact_lock(hashtext(sid::text||':pos-write'));
 perform pg_advisory_xact_lock(hashtext(sid::text||':catalog-write'));
 perform 1 from public.orders where store_id=sid and status='open' order by id for share;
 -- Seed rows only. Finance, K/R1, prior audit, custom rows and owner survive.
 perform 1 from public.menu_item_option_groups where store_id=sid and seed_key is not null order by id for update;
 perform 1 from public.option_values where store_id=sid and seed_key is not null order by id for update;
 perform 1 from public.option_groups where store_id=sid and seed_key is not null order by id for update;
 perform 1 from public.menu_items where store_id=sid and seed_key is not null order by id for update;
 perform 1 from public.categories where store_id=sid and seed_key is not null order by id for update;
 perform 1 from public.floor_decor_items where store_id=sid and seed_key is not null order by id for update;
 perform 1 from public.tables where store_id=sid and seed_key is not null order by id for update;
 perform 1 from public.floor_areas where store_id=sid and seed_key is not null order by id for update;
 perform 1 from public.employees where store_id=sid and seed_key is not null and role<>'owner' order by id for update;
 perform 1 from private.employee_sessions s where s.store_id=sid and exists(
  select 1 from public.employees e where e.store_id=sid and e.id=s.employee_id and e.seed_key is not null and e.role<>'owner'
 ) order by s.token_hash for update;

 select * into prior from private.employee_admin_requests r where r.store_id=sid and r.actor_type='employee'
  and r.actor_key=actor.id::text and r.request_id=p_request_id;
 select * into mac_key from private.permission_request_mac_keys where key_version=coalesce(
  prior.mac_key_version,(select max(key_version) from private.permission_request_mac_keys)) for share;
 if mac_key.key_version is null then return private.permission_changes_failure('PERMISSION_UPDATE_UNAVAILABLE'); end if;
 payload_mac:=extensions.hmac(convert_to(jsonb_build_object('kind','clear_demo_data','requestId',p_request_id,
  'confirmation',p_confirmation)::text,'UTF8'),mac_key.secret_bytes,'sha256');

 -- Recheck the live session/catalog after waiting. floor.view is the baseline
 -- checkpoint; owner-only clear authority is evaluated below so verified
 -- denials can be persisted instead of being raised and rolled back.
 actor:=private.permission_changes_checkpoint('floor.view');
 actor_rights:=private.configured_employee_permissions(actor.role,actor.permission_overrides);
 catrev:=(select revision from public.permission_catalog_state where singleton);
 if prior.request_id is not null then
  if prior.payload_mac<>payload_mac then return private.permission_changes_failure('ADMIN_REQUEST_REUSED'); end if;
  if actor.role<>'owner' or not 'data.clearDemo'=any(actor_rights) then return private.permission_changes_failure('FORBIDDEN'); end if;
  return prior.terminal_outcome;
 end if;

 if actor.role<>'owner' or not 'data.clearDemo'=any(actor_rights) then why:='FORBIDDEN';
 elsif p_confirmation is distinct from true then why:='INVALID_WRITE_REQUEST';
 elsif exists(select 1 from public.orders where store_id=sid and status='open') then why:='OPEN_ORDERS_BLOCK_CLEAR_DEMO';
 end if;

 if why is null then
  update public.menu_item_option_groups set deleted_at=coalesce(deleted_at,private.write_clock()),deleted_by_employee_id=actor.id where store_id=sid and seed_key is not null and deleted_at is null; get diagnostics n=row_count; menu_changed:=menu_changed or n>0;
  update public.option_values set deleted_at=coalesce(deleted_at,private.write_clock()),deleted_by_employee_id=actor.id where store_id=sid and seed_key is not null and deleted_at is null; get diagnostics n=row_count; menu_changed:=menu_changed or n>0;
  update public.option_groups set deleted_at=coalesce(deleted_at,private.write_clock()),deleted_by_employee_id=actor.id where store_id=sid and seed_key is not null and deleted_at is null; get diagnostics n=row_count; menu_changed:=menu_changed or n>0;
  update public.menu_items set deleted_at=coalesce(deleted_at,private.write_clock()),deleted_by_employee_id=actor.id where store_id=sid and seed_key is not null and deleted_at is null; get diagnostics n=row_count; menu_changed:=menu_changed or n>0;
  update public.categories set deleted_at=coalesce(deleted_at,private.write_clock()),deleted_by_employee_id=actor.id where store_id=sid and seed_key is not null and deleted_at is null; get diagnostics n=row_count; menu_changed:=menu_changed or n>0;
  update public.floor_decor_items set deleted_at=coalesce(deleted_at,private.write_clock()),deleted_by_employee_id=actor.id where store_id=sid and seed_key is not null and deleted_at is null; get diagnostics n=row_count; floor_changed:=floor_changed or n>0;
  update public.tables set deleted_at=coalesce(deleted_at,private.write_clock()),deleted_by_employee_id=actor.id where store_id=sid and seed_key is not null and deleted_at is null; get diagnostics n=row_count; floor_changed:=floor_changed or n>0;
  update public.floor_areas set deleted_at=coalesce(deleted_at,private.write_clock()),deleted_by_employee_id=actor.id where store_id=sid and seed_key is not null and deleted_at is null; get diagnostics n=row_count; floor_changed:=floor_changed or n>0;
 end if;

 -- A verified denial is audited against each concrete same-store demo identity.
 -- A successful request audits only identities actually deactivated.
 for demo in select * from public.employees where store_id=sid and seed_key is not null and role<>'owner' order by id loop
  if why is not null or demo.is_active then
   before_json:=private.permission_employee_snapshot(demo); after_json:=before_json;
   outcome:=case when why is null then 'applied' else 'denied' end;
   if why is null then
    update public.employees set is_active=false,permission_revision=permission_revision+1 where store_id=sid and id=demo.id returning * into demo;
    update private.employee_sessions set revoked_at=coalesce(revoked_at,private.write_clock())
     where store_id=sid and employee_id=demo.id and revoked_at is null;
    after_json:=private.permission_employee_snapshot(demo); employee_changed:=true;
   end if;
   insert into public.employee_admin_audit(store_id,actor_type,actor_key,request_id,target_id,kind,outcome,reason,
    before_snapshot,proposed_after,actual_after,actor_effective,catalog_revision,credential_changed,occurred_at,details)
   values(sid,'employee',actor.id::text,p_request_id,demo.id,'clear_demo_data',outcome,why,before_json,
    case when why is null then after_json else null end,after_json,actor_rights,catrev,false,private.write_clock(),
    jsonb_build_object('seedKey',demo.seed_key));
   audit_keys:=audit_keys||jsonb_build_array(jsonb_build_array(sid,'employee',actor.id,p_request_id,demo.id));
  end if;
 end loop;

 if why is null then
  if menu_changed then insert into public.store_change_signals values(sid,'menu',1,p_request_id,null)
   on conflict(store_id,topic) do update set revision=public.store_change_signals.revision+1,event_id=p_request_id,target_id=null; end if;
  if floor_changed then insert into public.store_change_signals values(sid,'floor',1,p_request_id,null)
   on conflict(store_id,topic) do update set revision=public.store_change_signals.revision+1,event_id=p_request_id,target_id=null; end if;
  if employee_changed then insert into public.store_change_signals values(sid,'permission',1,p_request_id,null)
   on conflict(store_id,topic) do update set revision=public.store_change_signals.revision+1,event_id=p_request_id,target_id=null; end if;
  outcome:=case when menu_changed or floor_changed or employee_changed then 'applied' else 'noop' end;
  result:=jsonb_build_object('ok',true,'outcome',outcome,'data',null);
 else result:=private.permission_changes_failure(why);
 end if;
 insert into private.employee_admin_requests(store_id,actor_type,actor_key,request_id,kind,payload_mac,mac_key_version,terminal_outcome,audit_keys)
 values(sid,'employee',actor.id::text,p_request_id,'clear_demo_data',payload_mac,mac_key.key_version,result,audit_keys);
 return result;
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
 when others then return private.permission_changes_failure('PERMISSION_UPDATE_UNAVAILABLE'); end $$;

-- Close every direct write path, including column ACLs, and retire all legacy
-- overloads. Seed/provisioning must use a separately privileged internal path.
do $$ declare t record; a record; f record; begin
 for t in select c.oid,c.relname from pg_class c where c.relnamespace='public'::regnamespace and c.relname=any(array['store_settings','categories','menu_items','option_groups','option_values','menu_item_option_groups','floor_areas','tables','floor_decor_items']) loop
  execute format('revoke insert,update,delete,truncate on public.%I from public,anon,authenticated,service_role',t.relname);
  for a in select attname from pg_attribute where attrelid=t.oid and attnum>0 and not attisdropped loop execute format('revoke insert(%I),update(%I) on public.%I from public,anon,authenticated,service_role',a.attname,a.attname,t.relname); end loop;
 end loop;
 for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
  (n.nspname='private' and (p.proname like 'permission_changes_%' or p.proname in('permission_floor_asset','permission_floor_valid','permission_lock_changes','permission_menu_valid')))
  or (n.nspname='public' and p.proname in('apply_menu_changes','apply_floor_changes','update_store_settings','clear_demo_data','seed_employee')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.nspname='public' and (f.proname in('apply_menu_changes','apply_floor_changes','update_store_settings')
   or f.signature::text='clear_demo_data(uuid,boolean)') then execute format('grant execute on function %s to anon,authenticated',f.signature); end if;
 end loop;
end $$;
