-- Durable initial-demo workflow. Installed after identity, administration and changes.
-- Standalone seed routes are closed; only the workflow runner invokes these helpers.
create function private.permission_seed_uuid(p_store uuid,p_seed_key text) returns uuid
language sql immutable strict set search_path=pg_catalog as $$ select private.permission_stable_uuid(p_store,p_seed_key) $$;

create function private.permission_initial_seed_status_json(p_store uuid) returns jsonb
language sql stable set search_path=pg_catalog as $$
 select jsonb_build_object('workflowId',w.workflow_id,'status',w.status,'workflowRevision',w.workflow_revision,
  'autoEligible',(w.status='pending' and w.auto_claimed_at is null),'runGeneration',w.run_generation,
  'lastErrorCode',w.last_error_code,'stages',coalesce((select jsonb_agg(jsonb_build_object('stage',s.stage,
   'stageId',s.stage_id,'status',s.status,'committedAt',s.committed_at)
   order by case s.stage when 'employee' then 1 when 'menu' then 2 else 3 end)
   from private.initial_seed_stages s where s.workflow_id=w.workflow_id),'[]'::jsonb))
 from private.initial_seed_workflows w where w.store_id=p_store
$$;

create function private.permission_seed_employee_insert(p_store uuid,p_actor public.employees,p_event uuid) returns void
language plpgsql volatile set search_path=pg_catalog as $$
declare tid uuid:=private.permission_seed_uuid(p_store,'demo.employee.demo-emp-cashier'); sk text:='demo.employee.demo-emp-cashier';
 target public.employees; rights text[];
begin
 if exists(select 1 from public.employees where id=tid or (store_id=p_store and seed_key=sk)) then raise exception 'ENTITY_ID_CONFLICT' using errcode='P0001'; end if;
 insert into public.employees(id,store_id,name,role,passcode_hash,is_active,seed_key,permission_revision,permission_overrides,pin_change_required)
 values(tid,p_store,'Thu ngân demo','cashier',extensions.crypt('111111',extensions.gen_salt('bf')),true,sk,0,null,false) returning * into target;
 rights:=private.configured_employee_permissions(p_actor.role,p_actor.permission_overrides);
 insert into public.employee_admin_audit(store_id,actor_type,actor_key,request_id,target_id,kind,outcome,proposed_after,actual_after,
  actor_effective,catalog_revision,credential_changed,occurred_at)
 values(p_store,'employee',p_actor.id::text,p_event,target.id,'initial_seed_employee','applied',private.permission_employee_snapshot(target),
  private.permission_employee_snapshot(target),rights,(select revision from public.permission_catalog_state where singleton),true,private.write_clock());
 insert into public.store_change_signals values(p_store,'permission',1,p_event,target.id)
 on conflict(store_id,topic) do update set revision=public.store_change_signals.revision+1,event_id=p_event,target_id=target.id;
end $$;

create function private.permission_seed_menu_insert(p_store uuid) returns void
language plpgsql volatile set search_path=pg_catalog as $$
declare r record; id_value uuid; seed_value text;
begin
 for r in select * from jsonb_to_recordset('[{"k":"cat-coffee","n":"Cà phê","s":1},{"k":"cat-tea","n":"Trà & trà sữa","s":2}]') as x(k text,n text,s int) loop
  seed_value:='demo.category.'||r.k; id_value:=private.permission_seed_uuid(p_store,seed_value);
  if exists(select 1 from public.categories where id=id_value or (store_id=p_store and seed_key=seed_value)) then raise exception 'ENTITY_ID_CONFLICT' using errcode='P0001'; end if;
  insert into public.categories(id,store_id,name,sort_order,seed_key,deleted_at,deleted_by_employee_id) values(id_value,p_store,r.n,r.s,seed_value,null,null);
 end loop;
 for r in select * from jsonb_to_recordset('[{"k":"mi-ca-phe-sua","c":"cat-coffee","n":"Cà phê sữa","p":29000,"s":1},{"k":"mi-bac-xiu","c":"cat-coffee","n":"Bạc xỉu","p":32000,"s":2},{"k":"mi-latte","c":"cat-coffee","n":"Latte","p":45000,"s":3},{"k":"mi-tra-dao","c":"cat-tea","n":"Trà đào","p":42000,"s":4},{"k":"mi-tra-sua-truyen-thong","c":"cat-tea","n":"Trà sữa truyền thống","p":39000,"s":5},{"k":"mi-tra-chanh","c":"cat-tea","n":"Trà chanh","p":29000,"s":6}]') as x(k text,c text,n text,p int,s int) loop
  seed_value:='demo.menu_item.'||r.k; id_value:=private.permission_seed_uuid(p_store,seed_value);
  if exists(select 1 from public.menu_items where id=id_value or (store_id=p_store and seed_key=seed_value)) then raise exception 'ENTITY_ID_CONFLICT' using errcode='P0001'; end if;
  insert into public.menu_items(id,store_id,category_id,name,price,image_asset_key,sort_order,is_available,seed_key,deleted_at,deleted_by_employee_id)
  values(id_value,p_store,private.permission_seed_uuid(p_store,'demo.category.'||r.c),r.n,r.p,null,r.s,true,seed_value,null,null);
 end loop;
 for r in select * from jsonb_to_recordset('[{"k":"og-coffee-size","n":"Size","t":"single","s":1},{"k":"og-tea-topping","n":"Topping","t":"multi","s":2}]') as x(k text,n text,t text,s int) loop
  seed_value:='demo.option_group.'||r.k; id_value:=private.permission_seed_uuid(p_store,seed_value);
  if exists(select 1 from public.option_groups where id=id_value or (store_id=p_store and seed_key=seed_value)) then raise exception 'ENTITY_ID_CONFLICT' using errcode='P0001'; end if;
  insert into public.option_groups(id,store_id,name,select_type,is_required,sort_order,seed_key,deleted_at,deleted_by_employee_id)
  values(id_value,p_store,r.n,r.t::public.option_select_type,false,r.s,seed_value,null,null);
 end loop;
 for r in select * from jsonb_to_recordset('[{"k":"ov-size-m","g":"og-coffee-size","n":"Size M","p":0,"s":1},{"k":"ov-size-l","g":"og-coffee-size","n":"Size L","p":7000,"s":2},{"k":"ov-tran-chau","g":"og-tea-topping","n":"Trân châu","p":7000,"s":1},{"k":"ov-kem-pho-mai","g":"og-tea-topping","n":"Kem phô mai","p":10000,"s":2}]') as x(k text,g text,n text,p int,s int) loop
  seed_value:='demo.option_value.'||r.k; id_value:=private.permission_seed_uuid(p_store,seed_value);
  if exists(select 1 from public.option_values where id=id_value or (store_id=p_store and seed_key=seed_value)) then raise exception 'ENTITY_ID_CONFLICT' using errcode='P0001'; end if;
  insert into public.option_values(id,store_id,option_group_id,name,price_delta,sort_order,seed_key,deleted_at,deleted_by_employee_id)
  values(id_value,p_store,private.permission_seed_uuid(p_store,'demo.option_group.'||r.g),r.n,r.p,r.s,seed_value,null,null);
 end loop;
 for r in select * from jsonb_to_recordset('[{"k":"miog-size-ca-phe-sua","m":"mi-ca-phe-sua","g":"og-coffee-size","s":1},{"k":"miog-size-bac-xiu","m":"mi-bac-xiu","g":"og-coffee-size","s":1},{"k":"miog-topping-tra-sua","m":"mi-tra-sua-truyen-thong","g":"og-tea-topping","s":1}]') as x(k text,m text,g text,s int) loop
  seed_value:='demo.menu_item_option_group.'||r.k; id_value:=private.permission_seed_uuid(p_store,seed_value);
  if exists(select 1 from public.menu_item_option_groups where id=id_value or (store_id=p_store and seed_key=seed_value)) then raise exception 'ENTITY_ID_CONFLICT' using errcode='P0001'; end if;
  insert into public.menu_item_option_groups(id,store_id,menu_item_id,option_group_id,sort_order,seed_key,deleted_at,deleted_by_employee_id)
  values(id_value,p_store,private.permission_seed_uuid(p_store,'demo.menu_item.'||r.m),private.permission_seed_uuid(p_store,'demo.option_group.'||r.g),r.s,seed_value,null,null);
 end loop;
end $$;

create function private.permission_seed_floor_insert(p_store uuid) returns void
language plpgsql volatile set search_path=pg_catalog as $$
declare r record; aid uuid:=private.permission_seed_uuid(p_store,'demo.area.area-ground'); id_value uuid; seed_value text;
begin
 if exists(select 1 from public.floor_areas where id=aid or (store_id=p_store and seed_key='demo.area.area-ground')) then raise exception 'ENTITY_ID_CONFLICT' using errcode='P0001'; end if;
 insert into public.floor_areas(id,store_id,name,sort_order,seed_key,deleted_at,deleted_by_employee_id) values(aid,p_store,'Tầng trệt',1,'demo.area.area-ground',null,null);
 for r in select * from jsonb_to_recordset('[{"k":"tbl-b01","n":"B01","x":260,"s":1},{"k":"tbl-b02","n":"B02","x":500,"s":2},{"k":"tbl-b03","n":"B03","x":750,"s":3},{"k":"tbl-b04","n":"B04","x":1040,"s":4}]') as x(k text,n text,x int,s int) loop
  seed_value:='demo.table.'||r.k; id_value:=private.permission_seed_uuid(p_store,seed_value);
  if exists(select 1 from public.tables where id=id_value or (store_id=p_store and seed_key=seed_value)) then raise exception 'ENTITY_ID_CONFLICT' using errcode='P0001'; end if;
  insert into public.tables(id,store_id,area_id,name,background_asset_key,pos_x,pos_y,width,height,shape,rotation,seats,sort_order,seed_key,deleted_at,deleted_by_employee_id)
  values(id_value,p_store,aid,r.n,null,r.x,190,case when r.k='tbl-b03' then 126 else 120 end,76,'rectangle',0,4,r.s,seed_value,null,null);
 end loop;
 for r in select * from jsonb_to_recordset('[{"k":"decor-wall-ground","kind":"wall","n":"Tường gạch","a":"/floor-assets/walls/img-color-cell3.webp","x":800,"y":40,"w":1500,"h":36,"z":0,"l":true},{"k":"decor-counter","kind":"image","n":"Quầy pha chế","a":"/floor-assets/decor/deco-fixtures-03.png","x":1370,"y":300,"w":220,"h":160,"z":1,"l":true},{"k":"decor-door","kind":"image","n":"Lối vào","a":"/floor-assets/decor/deco-other-15.png","x":1480,"y":88,"w":110,"h":70,"z":1,"l":true},{"k":"decor-plant","kind":"plant","n":"Cây lá xanh","a":"/floor-assets/decor/deco-tree-05.png","x":220,"y":700,"w":120,"h":120,"z":1,"l":false},{"k":"decor-seat-ground","kind":"image","n":"Ghế thư giãn","a":"/floor-assets/decor/deco-seat-08.png","x":500,"y":620,"w":100,"h":130,"z":1,"l":false},{"k":"decor-reception-ground","kind":"image","n":"Quầy đón khách","a":"/floor-assets/decor/deco-other-10.png","x":800,"y":720,"w":210,"h":70,"z":1,"l":true},{"k":"decor-game-ground","kind":"image","n":"Bàn bi-a","a":"/floor-assets/decor/deco-other-01.png","x":1200,"y":650,"w":210,"h":130,"z":1,"l":false}]') as x(k text,kind text,n text,a text,x int,y int,w int,h int,z int,l boolean) loop
  seed_value:='demo.decor.'||r.k; id_value:=private.permission_seed_uuid(p_store,seed_value);
  if exists(select 1 from public.floor_decor_items where id=id_value or (store_id=p_store and seed_key=seed_value)) then raise exception 'ENTITY_ID_CONFLICT' using errcode='P0001'; end if;
  insert into public.floor_decor_items(id,store_id,area_id,kind,label,asset_key,pos_x,pos_y,width,height,rotation,z_index,is_locked,seed_key,deleted_at,deleted_by_employee_id)
  values(id_value,p_store,aid,r.kind::public.decor_kind,r.n,r.a,r.x,r.y,r.w,r.h,0,r.z,r.l,seed_value,null,null);
 end loop;
end $$;

create function public.permission_get_initial_seed_status() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); actor public.employees; result jsonb;
begin
 actor:=private.permission_current_employee();
 if actor.role<>'owner' then return private.permission_failure('FORBIDDEN'); end if;
 result:=private.permission_initial_seed_status_json(sid);
 if result is null then return private.permission_failure('NOT_FOUND'); end if;
 return jsonb_build_object('ok',true,'data',result);
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
 when others then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end $$;

create function public.permission_begin_initial_seed(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); actor public.employees; workflow private.initial_seed_workflows; mode text; expected bigint;
begin
 if sid is null then return private.permission_failure('AUTH_REQUIRED'); end if;
 if jsonb_typeof(p_request) is distinct from 'object' or not p_request ?& array['mode','expectedWorkflowRevision']
  or p_request-array['mode','expectedWorkflowRevision']<>'{}' or jsonb_typeof(p_request->'mode') is distinct from 'string'
  or p_request->>'mode' not in ('initial','retry') or jsonb_typeof(p_request->'expectedWorkflowRevision') is distinct from 'number'
  or (p_request->>'expectedWorkflowRevision') !~ '^[0-9]+$' or (p_request->>'expectedWorkflowRevision')::numeric>9007199254740991
 then return private.permission_failure('INVALID_WRITE_REQUEST'); end if;
 mode:=p_request->>'mode'; expected:=(p_request->>'expectedWorkflowRevision')::bigint;
 perform private.permission_store_mutex(sid);
 select * into workflow from private.initial_seed_workflows where store_id=sid for update;
 actor:=private.permission_current_employee();
 if actor.role<>'owner' then return private.permission_failure('FORBIDDEN'); end if;
 if workflow.workflow_id is null then return private.permission_failure('NOT_FOUND'); end if;
 if mode='initial' and not(workflow.status='pending' and workflow.auto_claimed_at is null) then
  return jsonb_build_object('ok',true,'data',jsonb_build_object('acquired',false,'runGeneration',workflow.run_generation,'workflowRevision',workflow.workflow_revision,'status',workflow.status));
 end if;
 if expected<>workflow.workflow_revision then return private.permission_failure('INITIAL_SEED_ATTEMPT_STALE'); end if;
 if mode='retry' and workflow.status not in ('in_progress','needs_retry') then return private.permission_failure('INITIAL_SEED_ATTEMPT_STALE'); end if;
 update private.initial_seed_workflows set status='in_progress',auto_claimed_at=case when mode='initial' then private.write_clock() else auto_claimed_at end,
  run_generation=run_generation+1,workflow_revision=workflow_revision+1,last_error_code=null,updated_at=private.write_clock()
 where workflow_id=workflow.workflow_id returning * into workflow;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('acquired',true,'runGeneration',workflow.run_generation,'workflowRevision',workflow.workflow_revision,'status',workflow.status));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
 when others then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end $$;

create function public.permission_run_initial_seed_stage(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); actor public.employees; workflow private.initial_seed_workflows; stage_row private.initial_seed_stages;
 stage_name text; generation bigint; stage_order integer; committed_before integer; happened timestamptz; failure_code text;
 eid uuid; target_id uuid; row_id uuid; session_row record;
begin
 if sid is null then return private.permission_failure('AUTH_REQUIRED'); end if;
 if jsonb_typeof(p_request) is distinct from 'object' or not p_request ?& array['runGeneration','stage']
  or p_request-array['runGeneration','stage']<>'{}' or jsonb_typeof(p_request->'stage') is distinct from 'string'
  or p_request->>'stage' not in ('employee','menu','floor') or jsonb_typeof(p_request->'runGeneration') is distinct from 'number'
  or (p_request->>'runGeneration') !~ '^[0-9]+$' or (p_request->>'runGeneration')::numeric>9007199254740991
 then return private.permission_failure('INVALID_WRITE_REQUEST'); end if;
 stage_name:=p_request->>'stage'; generation:=(p_request->>'runGeneration')::bigint;
 stage_order:=case stage_name when 'employee' then 1 when 'menu' then 2 else 3 end;
 actor:=private.permission_current_employee(false);
 if actor.role<>'owner' then return private.permission_failure('FORBIDDEN'); end if;
 eid:=actor.id;
 target_id:=case when stage_name='employee' then private.permission_seed_uuid(sid,'demo.employee.demo-emp-cashier') end;
 perform private.permission_store_mutex(sid);
 -- Bulk seed shares the same outer order as clear and financial writes. The
 -- menu/business advisory must be held before any employee or session row.
 perform pg_advisory_xact_lock(hashtext(sid::text||':pos-write'));
 perform pg_advisory_xact_lock(hashtext(sid::text||':catalog-write'));
 select * into workflow from private.initial_seed_workflows where store_id=sid for update;
 select * into stage_row from private.initial_seed_stages where workflow_id=workflow.workflow_id and stage=stage_name for update;
 if target_id is not null then
  perform pg_advisory_xact_lock(hashtextextended('employee-create:'||target_id::text,0));
 end if;
 for row_id in select id from public.employees where store_id=sid and id=any(array_remove(array[eid,target_id],null)) order by id loop
  if row_id=target_id then perform 1 from public.employees where store_id=sid and id=row_id for update;
  else perform 1 from public.employees where store_id=sid and id=row_id for share; end if;
 end loop;
 for session_row in select token_hash,employee_id from private.employee_sessions
  where store_id=sid and (token_hash=private.employee_token_hash() or employee_id=target_id) order by token_hash loop
  if session_row.employee_id=target_id then perform 1 from private.employee_sessions where token_hash=session_row.token_hash for update;
  else perform 1 from private.employee_sessions where token_hash=session_row.token_hash for share; end if;
 end loop;
 perform private.permission_catalog_share();
 -- Re-read session, role and clock only after every lock that can wait.
 actor:=private.permission_current_employee(false);
 if actor.id<>eid or actor.role<>'owner' then return private.permission_failure('FORBIDDEN'); end if;
 if workflow.workflow_id is null then return private.permission_failure('NOT_FOUND'); end if;
 if generation<>workflow.run_generation then return private.permission_failure('INITIAL_SEED_ATTEMPT_STALE'); end if;
 if stage_row.stage_id is null then return private.permission_failure('INITIAL_SEED_ATTEMPT_STALE'); end if;
 if stage_row.status='committed' then return jsonb_build_object('ok',true,'data',private.permission_initial_seed_status_json(sid)); end if;
 if workflow.status<>'in_progress' then return private.permission_failure('INITIAL_SEED_ATTEMPT_STALE'); end if;
 select count(*)::integer into committed_before from private.initial_seed_stages where workflow_id=workflow.workflow_id and status='committed'
  and case stage when 'employee' then 1 when 'menu' then 2 else 3 end<stage_order;
 if committed_before<>stage_order-1 or exists(select 1 from private.initial_seed_stages where workflow_id=workflow.workflow_id and status='committed'
  and case stage when 'employee' then 1 when 'menu' then 2 else 3 end>stage_order) then return private.permission_failure('INITIAL_SEED_ATTEMPT_STALE'); end if;
 begin
  if stage_name='employee' then perform private.permission_seed_employee_insert(sid,actor,stage_row.stage_id);
  elsif stage_name='menu' then perform private.permission_seed_menu_insert(sid);
  else perform private.permission_seed_floor_insert(sid); end if;
  happened:=private.write_clock();
  update private.initial_seed_stages set status='committed',committed_at=happened,
   receipt=jsonb_build_object('stage',stage_name,'stageId',stage_row.stage_id,'runGeneration',generation,'committedAt',happened)
   where workflow_id=workflow.workflow_id and stage=stage_name;
  update private.initial_seed_workflows set status=case when stage_name='floor' then 'completed' else 'in_progress' end,
   workflow_revision=workflow_revision+1,last_error_code=null,updated_at=happened where workflow_id=workflow.workflow_id;
  if stage_name='floor' then update public.stores set seed_status='seeded' where id=sid; end if;
 exception when sqlstate 'P0401' then raise;
  when others then
  failure_code:=case when sqlstate='23505' or sqlerrm='ENTITY_ID_CONFLICT' then 'ENTITY_ID_CONFLICT' else 'PERMISSION_UPDATE_UNAVAILABLE' end;
  update private.initial_seed_workflows set status='needs_retry',workflow_revision=workflow_revision+1,last_error_code=failure_code,updated_at=private.write_clock()
   where workflow_id=workflow.workflow_id;
  update public.stores set seed_status='failed' where id=sid;
  return private.permission_failure(failure_code);
 end;
 return jsonb_build_object('ok',true,'data',private.permission_initial_seed_status_json(sid));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
 when others then return private.permission_failure('PERMISSION_UPDATE_UNAVAILABLE'); end $$;

drop function if exists public.seed_demo_employee(uuid);
drop function if exists public.seed_demo_menu();
drop function if exists public.seed_demo_floor();
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='private' and (p.proname like 'permission_seed_%' or p.proname='permission_initial_seed_status_json'))
   or (n.nspname='public' and p.proname in ('permission_get_initial_seed_status','permission_begin_initial_seed','permission_run_initial_seed_stage')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
grant execute on function public.permission_get_initial_seed_status(),public.permission_begin_initial_seed(jsonb),public.permission_run_initial_seed_stage(jsonb) to authenticated;
alter function public.permission_get_initial_seed_status() set timezone='UTC';
alter function public.permission_begin_initial_seed(jsonb) set timezone='UTC';
alter function public.permission_run_initial_seed_stage(jsonb) set timezone='UTC';
notify pgrst,'reload schema';
