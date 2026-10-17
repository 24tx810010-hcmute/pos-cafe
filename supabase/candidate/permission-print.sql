-- PERM-T14 candidate fragment. Apply after permission-financial.sql and permission-read.sql.
-- Grants are private capability evidence outside immutable write payload/result R1.

create table private.initial_receipt_print_grants(
 grant_id uuid primary key,
 store_id uuid not null,
 operation_id uuid not null,
 order_id uuid not null,
 executor_employee_id uuid not null,
 employee_session_hash bytea not null,
 created_at timestamptz not null,
 unique(store_id,operation_id),
 foreign key(store_id,operation_id) references public.write_operations(store_id,operation_id),
 foreign key(store_id,order_id) references public.orders(store_id,id),
 foreign key(store_id,executor_employee_id) references public.employees(store_id,id)
);
revoke all on private.initial_receipt_print_grants from public,anon,authenticated,service_role;

create function private.initial_receipt_print_grant_immutable() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$ begin
 raise exception 'INITIAL_PRINT_GRANT_IMMUTABLE' using errcode='23514';
end $$;
create trigger initial_receipt_print_grant_immutable before update or delete on private.initial_receipt_print_grants
 for each row execute function private.initial_receipt_print_grant_immutable();

-- Financial execute calls this only after its pending operation has transitioned
-- to applied inside the same transaction. It never mutates operation payload/R1.
create function private.permission_create_initial_receipt_print_grant(
 p_grant_id uuid,p_store_id uuid,p_operation_id uuid,p_order_id uuid,p_executor_employee_id uuid,p_created_at timestamptz
) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare w public.write_operations; current_session private.employee_sessions;
begin
 if p_grant_id is null or p_grant_id='00000000-0000-0000-0000-000000000000'::uuid or p_store_id is distinct from auth.uid() then
  raise exception 'INVALID_WRITE_REQUEST' using errcode='P0001';
 end if;
 select * into w from public.write_operations where store_id=p_store_id and operation_id=p_operation_id;
 select * into current_session from private.employee_sessions where store_id=p_store_id and token_hash=private.employee_token_hash();
 if w.operation_id is null or w.status<>'applied' or w.kind not in('pay_order','pay_order_items')
  or w.executed_by_employee_id is distinct from p_executor_employee_id or current_session.employee_id is distinct from p_executor_employee_id
  or current_session.revoked_at is not null or current_session.expires_at<=p_created_at
  or not exists(select 1 from public.orders where store_id=p_store_id and id=p_order_id and status='paid') then
  raise exception 'INVALID_WRITE_REQUEST' using errcode='P0001';
 end if;
 insert into private.initial_receipt_print_grants(grant_id,store_id,operation_id,order_id,executor_employee_id,employee_session_hash,created_at)
 values(p_grant_id,p_store_id,p_operation_id,p_order_id,p_executor_employee_id,current_session.token_hash,p_created_at);
 return jsonb_build_object('grantId',p_grant_id,'orderId',p_order_id);
end $$;

create function public.authorize_initial_receipt_print(p_grant_id uuid,p_print_request_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare actor public.employees; grant_row private.initial_receipt_print_grants; sid uuid:=auth.uid(); session_hash bytea:=private.employee_token_hash();
begin
 perform private.permission_current_employee(false);
 if p_grant_id is null or p_print_request_id is null or p_grant_id='00000000-0000-0000-0000-000000000000'::uuid or p_print_request_id='00000000-0000-0000-0000-000000000000'::uuid then
  return private.write_failure('INVALID_WRITE_REQUEST');
 end if;
 select * into grant_row from private.initial_receipt_print_grants where store_id=sid and grant_id=p_grant_id;
 if grant_row.grant_id is not null then
  perform 1 from public.orders where store_id=sid and id=grant_row.order_id for share;
  perform 1 from private.initial_receipt_print_grants where store_id=sid and grant_id=p_grant_id for share;
 end if;
 actor:=private.permission_financial_checkpoint();
 if grant_row.grant_id is null or grant_row.executor_employee_id is distinct from actor.id or grant_row.employee_session_hash is distinct from session_hash
  or not private.permission_financial_allowed(actor,'payment.take') then return private.write_failure('FORBIDDEN'); end if;
 if not exists(select 1 from public.write_operations w where w.store_id=sid and w.operation_id=grant_row.operation_id and w.status='applied'
   and w.kind in('pay_order','pay_order_items') and w.executed_by_employee_id=actor.id and w.result is not null)
  or not exists(select 1 from public.orders o join public.payments p on p.store_id=o.store_id and p.order_id=o.id
   where o.store_id=sid and o.id=grant_row.order_id and o.status='paid') then return private.write_failure('RECEIPT_UNAVAILABLE'); end if;
 perform private.permission_current_employee(false);
 return jsonb_build_object('ok',true,'data',jsonb_build_object('authorized',true,'grantId',p_grant_id,'printRequestId',p_print_request_id));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.prepare_receipt_reprint(p_order_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog set timezone='UTC' as $$
declare actor public.employees; sid uuid:=auth.uid(); result jsonb;
begin
 perform private.permission_current_employee(false);
 if p_order_id is null or p_order_id='00000000-0000-0000-0000-000000000000'::uuid then return private.write_failure('INVALID_WRITE_REQUEST'); end if;
 perform 1 from public.orders where store_id=sid and id=p_order_id for share;
 actor:=private.permission_financial_checkpoint();
 if not private.permission_financial_allowed(actor,'receipt.reprint')
  or not (private.permission_financial_allowed(actor,'payment.take') or private.permission_financial_allowed(actor,'orderHistory.view'))
  then return private.write_failure('FORBIDDEN'); end if;
 select jsonb_build_object('receipt',private.permission_read_receipt(coalesce(p.receipt_snapshot,private.receipt_snapshot(sid,p.id))),
  'legacyMetadata',p.receipt_snapshot is null) into result
 from public.orders o join lateral (select p.* from public.payments p where p.store_id=o.store_id and p.order_id=o.id order by p.paid_at desc,p.id desc limit 1) p on true
 where o.store_id=sid and o.id=p_order_id and o.status='paid';
 perform private.permission_current_employee(false);
 if result is null then return private.write_failure('RECEIPT_UNAVAILABLE'); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

revoke all on function private.initial_receipt_print_grant_immutable(),private.permission_create_initial_receipt_print_grant(uuid,uuid,uuid,uuid,uuid,timestamptz),
 public.authorize_initial_receipt_print(uuid,uuid),public.prepare_receipt_reprint(uuid) from public,anon,authenticated,service_role;
grant execute on function public.authorize_initial_receipt_print(uuid,uuid),public.prepare_receipt_reprint(uuid) to authenticated;

