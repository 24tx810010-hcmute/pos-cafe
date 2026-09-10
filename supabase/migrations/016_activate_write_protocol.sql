-- One activation transaction: no old financial RPC or direct DML stays callable.
begin;

create function public.get_write_capabilities() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
begin
 perform private.current_employee(false);
 return jsonb_build_object('writeProtocolVersion',1,'maxPayloadBytes',262144,'pendingTtlSeconds',86400);
exception when sqlstate 'P0401' then return private.write_failure(sqlerrm);
end $$;

create function public.register_write_operation(p_operation_id uuid,p_payload jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; w public.write_operations; at_time timestamptz; permission text;
begin
 e:=private.current_employee(false);
 if not private.valid_write_payload(p_operation_id,p_payload) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 permission:=private.write_permission(p_payload);
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||':pos-write'));
 select * into w from public.write_operations where store_id=auth.uid() and operation_id=p_operation_id for update;
 e:=private.current_employee(true);
 if not public.has_employee_permission(e.role,e.permission_overrides,coalesce(w.required_permission,permission)) then return private.write_failure('FORBIDDEN'); end if;
 if w.operation_id is not null then
  if w.payload<>p_payload then return private.write_failure('IDEMPOTENCY_KEY_REUSED'); end if;
 else
  at_time:=private.write_clock();
  if exists(select 1 from private.employee_sessions where store_id=auth.uid() and token_hash=private.employee_token_hash() and expires_at<=at_time) then return private.write_failure('EMPLOYEE_SESSION_REQUIRED'); end if;
  insert into public.write_operations(store_id,operation_id,schema_version,kind,action,required_permission,payload,registered_at,expires_at,initiated_by_employee_id)
  values(auth.uid(),p_operation_id,1,p_payload->>'kind',p_payload->>'action',permission,p_payload,at_time,at_time+interval '24 hours',e.id) returning * into w;
 end if;
 return jsonb_build_object('ok',true,'operation',private.operation_view(w));
exception when sqlstate 'P0401' then return private.write_failure(sqlerrm);
end $$;

create function private.write_operation_request(p_mode text,p_operation_id uuid,p_payload jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; w public.write_operations; plan jsonb; business_result jsonb; business_error jsonb;
 at_time timestamptz; before_version integer; after_version integer;
begin
 e:=private.current_employee(false);
 if p_operation_id is null or p_operation_id='00000000-0000-0000-0000-000000000000'::uuid or
    (p_mode='execute' and not private.valid_write_payload(p_operation_id,p_payload)) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||':pos-write'));
 select * into w from public.write_operations where store_id=auth.uid() and operation_id=p_operation_id for update;
 if not found then return private.write_failure('OPERATION_NOT_FOUND'); end if;
 e:=private.current_employee(false);
 if not public.has_employee_permission(e.role,e.permission_overrides,w.required_permission) then return private.write_failure('FORBIDDEN'); end if;
 if p_mode='execute' and w.payload<>p_payload then return private.write_failure('IDEMPOTENCY_KEY_REUSED'); end if;
 if w.status<>'pending' then
  e:=private.current_employee(true);
  if not public.has_employee_permission(e.role,e.permission_overrides,w.required_permission) then return private.write_failure('FORBIDDEN'); end if;
  if p_mode='execute' then update public.write_operations set replay_count=replay_count+1 where store_id=w.store_id and operation_id=w.operation_id returning * into w; end if;
  return jsonb_build_object('ok',true,'operation',private.operation_view(w));
 end if;
 if p_mode='execute' then perform private.lock_write_input(w.payload); end if;
 e:=private.current_employee(true);
 if not public.has_employee_permission(e.role,e.permission_overrides,w.required_permission) then return private.write_failure('FORBIDDEN'); end if;
 if p_mode='execute' then
  -- Validation may be long. Record its known error, but expiry/auth at the final
  -- checkpoint take precedence. Nothing in this region writes business tables.
  begin plan:=private.prepare_write(w.payload);
  exception when sqlstate 'P0400' then business_error:=sqlerrm::jsonb;
  end;
 end if;
 at_time:=private.write_clock();
 -- A request can validate across midnight. Refresh its read-only create plan
 -- under the already-held store/catalog/numbering locks, then take a new final
 -- checkpoint. No numbering/financial effect or additional lock occurs here.
 while p_mode='execute' and w.action='create' and business_error is null and
       (plan->>'businessDate')::date is distinct from (at_time at time zone (plan->>'timezone'))::date loop
  begin plan:=private.prepare_write(w.payload);
  exception when sqlstate 'P0400' then business_error:=sqlerrm::jsonb;
  end;
  at_time:=private.write_clock();
 end loop;
 if exists(select 1 from private.employee_sessions where store_id=auth.uid() and token_hash=private.employee_token_hash() and expires_at<=at_time) then return private.write_failure('EMPLOYEE_SESSION_REQUIRED'); end if;
 if at_time>=w.expires_at then
  update public.write_operations set status='expired',decided_at=at_time where store_id=w.store_id and operation_id=w.operation_id returning * into w;
 elsif p_mode='cancel' then
  update public.write_operations set status='cancelled',decided_at=at_time,cancelled_by_employee_id=e.id where store_id=w.store_id and operation_id=w.operation_id returning * into w;
 elsif p_mode='execute' then
  if business_error is null then
   select lock_version into before_version from public.orders where store_id=w.store_id and id=w.order_id;
   begin
    business_result:=private.apply_write(w.payload,plan,e.id,at_time);
    select lock_version into after_version from public.orders where store_id=w.store_id and id=w.order_id;
    insert into public.order_events(id,store_id,operation_id,action,source_order_id,result_order_id,payment_id,initiated_by,executed_by,occurred_at,before_version,after_version,summary)
    values(gen_random_uuid(),w.store_id,w.operation_id,coalesce(w.action,w.kind),w.order_id,(w.payload->>'newOrderId')::uuid,(w.payload->>'paymentId')::uuid,
     w.initiated_by_employee_id,e.id,at_time,before_version,after_version,
     jsonb_build_object('kind',w.kind,'orderId',w.order_id,'resultOrderId',w.payload->>'newOrderId','paymentId',w.payload->>'paymentId',
      'total',coalesce(business_result#>'{order,total}',business_result#>'{paidOrder,total}')));
    update public.write_operations set status='applied',result=business_result,executed_by_employee_id=e.id,decided_at=at_time where store_id=w.store_id and operation_id=w.operation_id returning * into w;
   exception
    when sqlstate 'P0400' then business_error:=sqlerrm::jsonb;
    when unique_violation then business_error:=private.write_error('ENTITY_ID_CONFLICT');
   end;
  end if;
  if business_error is not null then
   -- This update is OUTSIDE the subtransaction, so a known rejection is durable
   -- while every earlier financial effect from that subtransaction rolled back.
   update public.write_operations set status='rejected',error=business_error,decided_at=at_time where store_id=w.store_id and operation_id=w.operation_id returning * into w;
  end if;
 end if;
 return jsonb_build_object('ok',true,'operation',private.operation_view(w));
exception when sqlstate 'P0401' then return private.write_failure(sqlerrm);
end $$;

create function public.execute_write_operation(p_operation_id uuid,p_payload jsonb) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $$ select private.write_operation_request('execute',p_operation_id,p_payload) $$;
create function public.get_write_operation(p_operation_id uuid) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $$ select private.write_operation_request('get',p_operation_id) $$;
create function public.cancel_write_operation(p_operation_id uuid) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $$ select private.write_operation_request('cancel',p_operation_id) $$;

create function public.list_write_operations(p_order_id uuid default null,p_kinds text[] default null,p_statuses text[] default null,
 p_registered_from timestamptz default null,p_registered_to timestamptz default null,p_cursor text default null,p_limit integer default 50) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; w public.write_operations; at_time timestamptz; cursor_value jsonb; scope text;
 cursor_at timestamptz; cursor_id uuid; next_cursor text; items jsonb:='[]'; item_count integer:=0; last_at timestamptz; last_id uuid;
begin
 e:=private.current_employee(false);
 if p_limit is null or p_limit not between 1 and 100 or char_length(p_cursor)>512 or
    (p_order_id is not null and not private.valid_uuid(to_jsonb(p_order_id))) or
    (p_registered_from is not null and not isfinite(p_registered_from)) or (p_registered_to is not null and not isfinite(p_registered_to)) or
    p_registered_from>p_registered_to or
    exists(select 1 from unnest(p_kinds) k where k is null or k not in('submit_order_changes','pay_order','pay_order_items','void_order')) or
    exists(select 1 from unnest(p_statuses) s where s is null or s not in('pending','applied','rejected','cancelled','expired')) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 scope:=encode(extensions.digest(jsonb_build_object('store',auth.uid(),'order',p_order_id,'kinds',p_kinds,'statuses',p_statuses,'from',p_registered_from,'to',p_registered_to)::text,'sha256'),'hex');
 if p_cursor is not null then
  begin
   cursor_value:=convert_from(decode(p_cursor,'base64'),'UTF8')::jsonb;
   if not private.exact_fields(cursor_value,array['at','id','scope']) or cursor_value->>'scope' is distinct from scope or
      not private.valid_uuid(cursor_value->'id') or jsonb_typeof(cursor_value->'at') is distinct from 'string' then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
   cursor_at:=(cursor_value->>'at')::timestamptz; cursor_id:=(cursor_value->>'id')::uuid;
   if not isfinite(cursor_at) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
  exception when invalid_text_representation or invalid_parameter_value or invalid_datetime_format or datetime_field_overflow or character_not_in_repertoire then return private.write_failure('INVALID_WRITE_REQUEST');
  end;
 end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||':pos-write'));
 -- Lock pending rows before reading final permissions. A grant committed while
 -- waiting may make another kind visible; it must not introduce a new row wait
 -- after the clock checkpoint. Results/expiry still filter by current permission.
 for w in select x.* from public.write_operations x where x.store_id=auth.uid() and x.status='pending' order by x.operation_id for update loop null; end loop;
 e:=private.current_employee(true); at_time:=private.write_clock();
 if exists(select 1 from private.employee_sessions where store_id=auth.uid() and token_hash=private.employee_token_hash() and expires_at<=at_time) then return private.write_failure('EMPLOYEE_SESSION_REQUIRED'); end if;
 update public.write_operations x set status='expired',decided_at=at_time where x.store_id=auth.uid() and x.status='pending' and x.expires_at<=at_time and public.has_employee_permission(e.role,e.permission_overrides,x.required_permission);
 for w in select x.* from public.write_operations x where x.store_id=auth.uid()
  and public.has_employee_permission(e.role,e.permission_overrides,x.required_permission)
  and (p_order_id is null or x.order_id=p_order_id) and (p_kinds is null or x.kind=any(p_kinds))
  and (p_statuses is null or x.status::text=any(p_statuses)) and (p_registered_from is null or x.registered_at>=p_registered_from)
  and (p_registered_to is null or x.registered_at<=p_registered_to)
  and (cursor_at is null or (x.registered_at,x.operation_id)<(cursor_at,cursor_id))
  order by x.registered_at desc,x.operation_id desc limit p_limit+1 loop
  item_count:=item_count+1;
  if item_count>p_limit then
   next_cursor:=replace(encode(convert_to(jsonb_build_object('at',last_at,'id',last_id,'scope',scope)::text,'UTF8'),'base64'),E'\n',''); exit;
  end if;
  items:=items||jsonb_build_array(private.operation_view(w)); last_at:=w.registered_at; last_id:=w.operation_id;
 end loop;
 return jsonb_build_object('ok',true,'page',jsonb_build_object('items',items,'nextCursor',next_cursor,'serverTime',at_time));
exception when sqlstate 'P0401' then return private.write_failure(sqlerrm);
end $$;

-- Explicit history print lookup checks CURRENT paid state. The saved receipt is
-- returned unchanged; legacy metadata is visibly identified as reconstruction.
create function public.get_payment_receipt(p_order_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; o public.orders; p public.payments;
begin
 e:=private.current_employee(false);
 if not public.has_employee_permission(e.role,e.permission_overrides,'payment.take') then return private.write_failure('FORBIDDEN'); end if;
 select * into o from public.orders where store_id=auth.uid() and id=p_order_id;
 if not found or o.status<>'paid' then return private.write_failure('RECEIPT_UNAVAILABLE'); end if;
 select * into p from public.payments where store_id=auth.uid() and order_id=o.id order by paid_at desc,id desc limit 1;
 if not found then return private.write_failure('RECEIPT_UNAVAILABLE'); end if;
 return jsonb_build_object('ok',true,'receipt',coalesce(p.receipt_snapshot,private.receipt_snapshot(auth.uid(),p.id)),
 'legacyMetadata',p.receipt_snapshot is null);
exception when sqlstate 'P0401' then return private.write_failure(sqlerrm);
end $$;

-- RLS helper only answers whether the current token is an active administrator.
-- It has no caller-controlled employee ID and never returns credential material.
create function private.is_verified_admin() returns boolean
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees;
begin e:=private.current_employee(false); return e.role='admin';
exception when sqlstate 'P0401' then return false;
end $$;

create function private.catalog_statement_lock() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is not null then perform pg_advisory_xact_lock(hashtext(auth.uid()::text||':catalog-write')); end if;
 return null;
end $$;
do $$ declare relation text; pol record;
begin
 foreach relation in array array['categories','menu_items','option_groups','option_values','menu_item_option_groups','floor_areas','tables','floor_decor_items','employees','store_settings','stores'] loop
  for pol in select policyname from pg_policies where schemaname='public' and tablename=relation loop execute format('drop policy %I on public.%I',pol.policyname,relation); end loop;
  execute format('create policy tenant_select on public.%I for select to authenticated using (%I=auth.uid())',relation,case when relation='stores' then 'id' else 'store_id' end);
  execute format('create policy admin_insert on public.%I for insert to authenticated with check (%I=auth.uid() and private.is_verified_admin())',relation,case when relation='stores' then 'id' else 'store_id' end);
  execute format('create policy admin_update on public.%I for update to authenticated using (%I=auth.uid() and private.is_verified_admin()) with check (%I=auth.uid() and private.is_verified_admin())',relation,case when relation='stores' then 'id' else 'store_id' end,case when relation='stores' then 'id' else 'store_id' end);
  execute format('revoke all on public.%I from public,anon,authenticated',relation);
  if relation not in ('employees','stores','store_settings','tables') then
   execute format('grant select,insert,update on public.%I to authenticated',relation);
  end if;
 end loop;
 foreach relation in array array['categories','menu_items','option_groups','option_values','menu_item_option_groups'] loop
  execute format('create trigger catalog_lock_before_statement before insert or update or delete on public.%I for each statement execute function private.catalog_statement_lock()',relation);
 end loop;
end $$;

-- Immutable identity, including config entities. Column grants alone cannot
-- protect IDs when a generic admin editor/upsert supplies identity columns.
create function private.preserve_tenant_identity() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if new.id is distinct from old.id or new.store_id is distinct from old.store_id then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return new;
end $$;
do $$ declare relation text; begin
 foreach relation in array array['categories','menu_items','option_groups','option_values','menu_item_option_groups','floor_areas','tables','floor_decor_items','employees'] loop
  execute format('create trigger identity_immutable before update on public.%I for each row execute function private.preserve_tenant_identity()',relation);
 end loop;
end $$;

grant select(id,store_id,name,role,is_active,seed_key,created_at,updated_at,permission_overrides) on public.employees to authenticated;
grant update(name,role,is_active,permission_overrides) on public.employees to authenticated;
grant select on public.stores,public.store_settings,public.tables to authenticated;
grant update(name,seed_status,is_active) on public.stores to authenticated;
grant update(display_name,address,currency,timezone,bill_footer,qr_info) on public.store_settings to authenticated;
grant insert(id,store_id,area_id,name,background_asset_key,pos_x,pos_y,width,height,shape,rotation,seats,sort_order,seed_key,deleted_at,deleted_by_employee_id) on public.tables to authenticated;
grant update(area_id,name,background_asset_key,pos_x,pos_y,width,height,shape,rotation,seats,sort_order,seed_key,deleted_at,deleted_by_employee_id) on public.tables to authenticated;

-- The legacy clear endpoint keeps its signature so existing admin flows can
-- migrate without relying on an employee ID as authentication.
create or replace function public.clear_demo_data(p_employee_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare actor uuid; relation text; affected integer; result jsonb:=jsonb_build_object('cleared',true);
begin
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||':pos-write'));
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||':catalog-write'));
 actor:=private.require_admin();
 if actor is distinct from p_employee_id then return private.write_failure('FORBIDDEN'); end if;
 if exists(select 1 from public.orders where store_id=auth.uid() and status='open') then raise exception 'OPEN_ORDERS_EXIST' using errcode='P0001'; end if;
 foreach relation in array array['menu_item_option_groups','option_values','option_groups','menu_items','categories','floor_decor_items','tables','floor_areas'] loop
  execute format('update public.%I set deleted_at=private.write_clock(),deleted_by_employee_id=$1 where store_id=$2 and seed_key is not null and deleted_at is null',relation) using actor,auth.uid();
  get diagnostics affected=row_count;
  result:=result||jsonb_build_object(case relation when 'menu_item_option_groups' then 'menuItemOptionGroups' when 'option_values' then 'optionValues' when 'option_groups' then 'optionGroups' when 'menu_items' then 'menuItems' when 'floor_decor_items' then 'decorItems' when 'floor_areas' then 'floorAreas' else relation end,affected);
 end loop;
 update public.employees set is_active=false where store_id=auth.uid() and seed_key is not null and role<>'admin' and is_active;
 get diagnostics affected=row_count;
 return result||jsonb_build_object('deactivatedEmployees',affected);
exception when sqlstate 'P0401' then return private.write_failure(sqlerrm);
end $$;

-- Financial SELECT remains store-scoped, but every mutation is private.
revoke insert,update,delete,truncate,references,trigger on public.orders,public.order_items,public.order_item_options,public.payments from public,anon,authenticated;
revoke all on public.write_operations,public.order_events from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_verified_admin() to authenticated;
-- Keep every historical overload blocked, not just the newest SQL signatures.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('submit_order_changes','pay_order','pay_order_items','void_order','verify_employee_pin','hash_employee_pin') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('get_write_capabilities','register_write_operation','execute_write_operation','get_write_operation','list_write_operations','cancel_write_operation','start_employee_session','revoke_employee_session','bootstrap_store','create_employee','seed_employee','reset_employee_pin','get_payment_receipt','clear_demo_data') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
  -- Wire timestamps are always UTC even if a request changes its DB timezone.
  execute format('alter function %s set timezone = %L',f.signature,'UTC');
 end loop;
end $$;
-- Auth-less calls can obtain a structured AUTH_REQUIRED, never business data.
grant execute on function public.get_write_capabilities(),public.start_employee_session(uuid,text),public.register_write_operation(uuid,jsonb),public.execute_write_operation(uuid,jsonb),public.get_write_operation(uuid),public.cancel_write_operation(uuid),public.list_write_operations(uuid,text[],text[],timestamptz,timestamptz,text,integer) to anon;

notify pgrst,'reload schema';
commit;
