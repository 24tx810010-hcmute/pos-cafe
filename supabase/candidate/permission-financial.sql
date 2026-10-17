-- PERM-T06 staged financial fragment after T04/T05. Not an activation launcher.
-- Protocol payload, planners, effects, receipt/R1 schema, K identity and TTL stay
-- unchanged. Every authority lock is acquired AFTER the business wait region.

create function private.permission_financial_checkpoint(p_references uuid[] default array[]::uuid[]) returns public.employees
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); eid uuid;
begin
 if sid is null then raise exception 'AUTH_REQUIRED' using errcode='P0401'; end if;
 select employee_id into eid from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash();
 -- Register writes a store FK too. Execute already holds this lock in its
 -- business prelock; never allow a fresh FK wait after session/clock validation.
 perform 1 from public.stores where id=sid for share;
 perform 1 from public.employees where store_id=sid and id=any(coalesce(p_references,array[]::uuid[])||array[eid]) order by id for share;
 perform 1 from private.employee_sessions where store_id=sid and token_hash=private.employee_token_hash() for share;
 perform private.permission_catalog_share();
 return private.permission_current_employee(false);
end $$;

create function private.permission_financial_allowed(e public.employees,p_permission text) returns boolean
language sql volatile set search_path=pg_catalog as $$
 select p_permission=any(private.configured_employee_permissions(e.role,e.permission_overrides))
$$;

create or replace function public.get_write_capabilities() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
begin
 perform private.permission_financial_checkpoint();
 return jsonb_build_object('writeProtocolVersion',1,'maxPayloadBytes',262144,'pendingTtlSeconds',86400,'permissionContractVersion',2);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create or replace function public.register_write_operation(p_operation_id uuid,p_payload jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; w public.write_operations; at_time timestamptz; permission text;
begin
 e:=private.permission_current_employee(false);
 if not private.valid_write_payload(p_operation_id,p_payload) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 permission:=private.write_permission(p_payload);
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||':pos-write'));
 select * into w from public.write_operations where store_id=auth.uid() and operation_id=p_operation_id for update;
 e:=private.permission_financial_checkpoint();
 if not private.permission_financial_allowed(e,coalesce(w.required_permission,permission)) then return private.write_failure('FORBIDDEN'); end if;
 if w.operation_id is not null then
  if w.payload<>p_payload then return private.write_failure('IDEMPOTENCY_KEY_REUSED'); end if;
 else
  at_time:=private.write_clock();
  if exists(select 1 from private.employee_sessions where store_id=auth.uid() and token_hash=private.employee_token_hash() and expires_at<=at_time) then return private.write_failure('EMPLOYEE_SESSION_REQUIRED'); end if;
  insert into public.write_operations(store_id,operation_id,schema_version,kind,action,required_permission,payload,registered_at,expires_at,initiated_by_employee_id)
  values(auth.uid(),p_operation_id,1,p_payload->>'kind',p_payload->>'action',permission,p_payload,at_time,at_time+interval '24 hours',e.id) returning * into w;
 end if;
 return jsonb_build_object('ok',true,'operation',private.operation_view(w));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

-- Replace the private dispatcher signature so printGrantId stays outside payload/R1.
drop function if exists public.execute_write_operation(uuid,jsonb);
drop function if exists public.get_write_operation(uuid);
drop function if exists public.cancel_write_operation(uuid);
drop function if exists private.write_operation_request(text,uuid,jsonb);
create function private.write_operation_request(p_mode text,p_operation_id uuid,p_payload jsonb default null,p_print_grant_id uuid default null) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; w public.write_operations; plan jsonb; business_result jsonb; business_error jsonb; initial_print_grant jsonb;
 at_time timestamptz; before_version integer; after_version integer;
begin
 e:=private.permission_current_employee(false);
 if p_operation_id is null or p_operation_id='00000000-0000-0000-0000-000000000000'::uuid or
    (p_mode='execute' and not private.valid_write_payload(p_operation_id,p_payload)) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||':pos-write'));
 select * into w from public.write_operations where store_id=auth.uid() and operation_id=p_operation_id for update;
 if not found then
  perform private.permission_financial_checkpoint();
  return private.write_failure('OPERATION_NOT_FOUND');
 end if;
 if p_print_grant_id is not null and (p_mode<>'execute' or w.kind not in('pay_order','pay_order_items')) then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 e:=private.permission_current_employee(false);
 if not private.permission_financial_allowed(e,w.required_permission) then return private.write_failure('FORBIDDEN'); end if;
 if p_mode='execute' and w.payload<>p_payload then return private.write_failure('IDEMPOTENCY_KEY_REUSED'); end if;
 if w.status<>'pending' then
  e:=private.permission_financial_checkpoint();
  if not private.permission_financial_allowed(e,w.required_permission) then return private.write_failure('FORBIDDEN'); end if;
  if p_mode='execute' then update public.write_operations set replay_count=replay_count+1 where store_id=w.store_id and operation_id=w.operation_id returning * into w; end if;
  return jsonb_build_object('ok',true,'operation',private.operation_view(w));
 end if;
 if p_mode='execute' then perform private.lock_write_input(w.payload); end if;
 -- Both actor and immutable K initiator are FK parents of the event. Lock
 -- the complete UUID-ordered set, never actor first in a separate helper.
 e:=private.permission_financial_checkpoint(case when p_mode='execute' then array[w.initiated_by_employee_id] else array[]::uuid[] end);
 if not private.permission_financial_allowed(e,w.required_permission) then return private.write_failure('FORBIDDEN'); end if;
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
    if p_print_grant_id is not null then
     execute 'select private.permission_create_initial_receipt_print_grant($1,$2,$3,$4,$5,$6)'
      into initial_print_grant using p_print_grant_id,w.store_id,w.operation_id,
      case when w.kind='pay_order_items' then (w.payload->>'newOrderId')::uuid else w.order_id end,e.id,at_time;
    end if;
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
 return jsonb_build_object('ok',true,'operation',private.operation_view(w))||
  case when initial_print_grant is null then '{}'::jsonb else jsonb_build_object('initialReceiptPrintGrant',initial_print_grant) end;
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create or replace function public.execute_write_operation(p_operation_id uuid,p_payload jsonb) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $$ select private.write_operation_request('execute',p_operation_id,p_payload,null) $$;
create function public.execute_write_operation(p_operation_id uuid,p_payload jsonb,p_print_grant_id uuid) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $$ select private.write_operation_request('execute',p_operation_id,p_payload,p_print_grant_id) $$;
create or replace function public.get_write_operation(p_operation_id uuid) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $$ select private.write_operation_request('get',p_operation_id,null,null) $$;
create or replace function public.cancel_write_operation(p_operation_id uuid) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $$ select private.write_operation_request('cancel',p_operation_id,null,null) $$;

create or replace function public.list_write_operations(p_order_id uuid default null,p_kinds text[] default null,p_statuses text[] default null,
 p_registered_from timestamptz default null,p_registered_to timestamptz default null,p_cursor text default null,p_limit integer default 50) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare e public.employees; w public.write_operations; at_time timestamptz; cursor_value jsonb; scope text;
 cursor_at timestamptz; cursor_id uuid; next_cursor text; items jsonb:='[]'; item_count integer:=0; last_at timestamptz; last_id uuid;
begin
 e:=private.permission_current_employee(false);
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
 e:=private.permission_financial_checkpoint(); at_time:=private.write_clock();
 if exists(select 1 from private.employee_sessions where store_id=auth.uid() and token_hash=private.employee_token_hash() and expires_at<=at_time) then return private.write_failure('EMPLOYEE_SESSION_REQUIRED'); end if;
 update public.write_operations x set status='expired',decided_at=at_time where x.store_id=auth.uid() and x.status='pending' and x.expires_at<=at_time and private.permission_financial_allowed(e,x.required_permission);
 for w in select x.* from public.write_operations x where x.store_id=auth.uid()
  and private.permission_financial_allowed(e,x.required_permission)
  and (p_order_id is null or x.order_id=p_order_id) and (p_kinds is null or x.kind=any(p_kinds))
  and (p_statuses is null or x.status::text=any(p_statuses)) and (p_registered_from is null or x.registered_at>=p_registered_from)
  and (p_registered_to is null or x.registered_at<=p_registered_to)
  and (cursor_at is null or (x.registered_at,x.operation_id)<(cursor_at,cursor_id))
  order by x.registered_at desc,x.operation_id desc limit p_limit+1 loop
  -- No new locks here: employee/session/catalog are already held. Recheck
  -- session time and the stored action for each result, including page lookahead.
  e:=private.permission_current_employee(false);
  if not private.permission_financial_allowed(e,w.required_permission) then continue; end if;
  item_count:=item_count+1;
  if item_count>p_limit then
   next_cursor:=replace(encode(convert_to(jsonb_build_object('at',last_at,'id',last_id,'scope',scope)::text,'UTF8'),'base64'),E'\n',''); exit;
  end if;
  items:=items||jsonb_build_array(private.operation_view(w)); last_at:=w.registered_at; last_id:=w.operation_id;
 end loop;
 return jsonb_build_object('ok',true,'page',jsonb_build_object('items',items,'nextCursor',next_cursor,'serverTime',at_time));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

-- Preserve the protocol's public auth-error envelope without granting anonymous
-- business access. Each entry point still requires store JWT + employee session.
revoke all on function private.permission_financial_checkpoint(uuid[]),private.permission_financial_allowed(public.employees,text),
 private.write_operation_request(text,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_write_capabilities(),public.register_write_operation(uuid,jsonb),public.execute_write_operation(uuid,jsonb),
 public.execute_write_operation(uuid,jsonb,uuid),public.get_write_operation(uuid),public.cancel_write_operation(uuid),public.list_write_operations(uuid,text[],text[],timestamptz,timestamptz,text,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.get_write_capabilities(),public.register_write_operation(uuid,jsonb),public.execute_write_operation(uuid,jsonb),
 public.execute_write_operation(uuid,jsonb,uuid),public.get_write_operation(uuid),public.cancel_write_operation(uuid),public.list_write_operations(uuid,text[],text[],timestamptz,timestamptz,text,integer)
 to anon,authenticated;

-- CREATE OR REPLACE replaces proconfig too. Preserve migration 016's UTC wire
-- contract even when the caller changes its own session timezone.
alter function public.get_write_capabilities() set timezone='UTC';
alter function public.register_write_operation(uuid,jsonb) set timezone='UTC';
alter function public.execute_write_operation(uuid,jsonb) set timezone='UTC';
alter function public.execute_write_operation(uuid,jsonb,uuid) set timezone='UTC';
alter function public.get_write_operation(uuid) set timezone='UTC';
alter function public.cancel_write_operation(uuid) set timezone='UTC';
alter function public.list_write_operations(uuid,text[],text[],timestamptz,timestamptz,text,integer) set timezone='UTC';

-- Own the write boundary, including any column grants inherited by a deployment.
-- Sensitive business SELECT/projections are completed separately by T07.
revoke all on public.write_operations,public.order_events from public,anon,authenticated,service_role;
do $$ declare t text; c record; f record; begin
 foreach t in array array['orders','order_items','order_item_options','payments','write_operations','order_events'] loop
  execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from public,anon,authenticated,service_role',t);
  for c in select attname from pg_attribute where attrelid=format('public.%I',t)::regclass and attnum>0 and not attisdropped loop
   execute format('revoke insert(%1$I),update(%1$I),references(%1$I) on public.%2$I from public,anon,authenticated,service_role',c.attname,t);
   if t in ('write_operations','order_events') then execute format('revoke select(%I) on public.%I from public,anon,authenticated,service_role',c.attname,t); end if;
  end loop;
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('submit_order_changes','pay_order','pay_order_items','void_order') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
