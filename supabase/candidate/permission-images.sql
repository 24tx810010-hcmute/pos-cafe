-- PERM-T09 candidate fragment. Apply after permission-changes.sql.
-- Storage bytes are outside the DB transaction; these registries are the authority for staging/publication.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('menu-item-image-staging','menu-item-image-staging',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- No storage.objects policy is created for the staging bucket. Store JWTs cannot
-- list/read/write/copy/delete it; Edge service credentials operate on exact derived keys.
drop policy if exists permission_image_staging_select on storage.objects;
drop policy if exists permission_image_staging_insert on storage.objects;
drop policy if exists permission_image_staging_update on storage.objects;
drop policy if exists permission_image_staging_delete on storage.objects;
-- Retain legacy public object GET through the public bucket flag, but remove its
-- broad object SELECT/list policy and every store-JWT mutation policy.
drop policy if exists menu_item_images_public_read on storage.objects;
drop policy if exists menu_item_images_store_insert on storage.objects;
drop policy if exists menu_item_images_store_update on storage.objects;
drop policy if exists menu_item_images_store_delete on storage.objects;

create table private.menu_image_uploads(
 upload_handle uuid primary key,
 store_id uuid not null references public.stores(id),
 item_id uuid not null,
 object_key text not null unique,
 mime_type text not null check(mime_type in('image/jpeg','image/png','image/webp')),
 byte_size bigint not null check(byte_size between 1 and 5242880),
 created_by_employee_id uuid not null,
 state text not null check(state in('uploading','ready','published','discarded')),
 created_at timestamptz not null default now(),
 ready_at timestamptz,
 published_at timestamptz,
 discarded_at timestamptz,
 unique(store_id,item_id,upload_handle),
 -- Draft item IDs need not exist until the atomic menu transaction publishes.
 -- The published asset registry below retains the same-store item foreign key.
 foreign key(store_id,created_by_employee_id) references public.employees(store_id,id)
);
create table private.menu_image_assets(
 asset_key uuid primary key,
 store_id uuid not null references public.stores(id),
 item_id uuid not null,
 upload_handle uuid not null unique references private.menu_image_uploads(upload_handle),
 object_key text not null unique,
 mime_type text not null check(mime_type in('image/jpeg','image/png','image/webp')),
 byte_size bigint not null check(byte_size between 1 and 5242880),
 published boolean not null default true,
 published_at timestamptz not null,
 unpublished_at timestamptz,
 foreign key(store_id,item_id) references public.menu_items(store_id,id)
);
revoke all on private.menu_image_uploads,private.menu_image_assets from public,anon,authenticated,service_role;

create function public.permission_menu_image_begin_upload(p_item_id uuid,p_upload_handle uuid,p_mime_type text,p_byte_size bigint) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); actor public.employees; ext text; object_key text;
begin
 if p_item_id is null or p_upload_handle is null or p_mime_type is null or p_mime_type not in('image/jpeg','image/png','image/webp') or p_byte_size is null or p_byte_size<1 or p_byte_size>5242880 then
  return private.permission_changes_failure('INVALID_WRITE_REQUEST');
 end if;
 perform private.permission_current_employee(false);
 perform private.permission_store_mutex(sid);
 actor:=private.permission_changes_checkpoint('menu.manage');
 -- Private staging binds the proposed ID without revealing whether another
 -- store owns it. apply_menu_changes verifies an active same-store row (created
 -- in that transaction if necessary) before finalizing the handle.
 ext:=case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'webp' end;
 object_key:=sid::text||'/menu-items/'||p_item_id::text||'/'||p_upload_handle::text||'.'||ext;
 insert into private.menu_image_uploads(upload_handle,store_id,item_id,object_key,mime_type,byte_size,created_by_employee_id,state)
 values(p_upload_handle,sid,p_item_id,object_key,p_mime_type,p_byte_size,actor.id,'uploading');
 return jsonb_build_object('ok',true,'data',jsonb_build_object('uploadHandle',p_upload_handle,'objectKey',object_key));
exception when unique_violation then return private.permission_changes_failure('INVALID_WRITE_REQUEST');
 when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_menu_image_mark_ready(p_upload_handle uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); actor public.employees; upload private.menu_image_uploads;
begin
 perform private.permission_current_employee(false);
 perform private.permission_store_mutex(sid);
 select * into upload from private.menu_image_uploads where store_id=sid and upload_handle=p_upload_handle for update;
 actor:=private.permission_changes_checkpoint('menu.manage');
 if upload.upload_handle is null then return private.permission_changes_failure('NOT_FOUND'); end if;
 if upload.state<>'uploading' then return private.permission_changes_failure('INVALID_WRITE_REQUEST'); end if;
 update private.menu_image_uploads set state='ready',ready_at=now() where upload_handle=p_upload_handle;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('uploadHandle',p_upload_handle));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_menu_image_read_staging(p_upload_handle uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); actor public.employees; upload private.menu_image_uploads;
begin
 perform private.permission_current_employee(false);
 perform private.permission_store_mutex(sid);
 select * into upload from private.menu_image_uploads where store_id=sid and upload_handle=p_upload_handle for share;
 actor:=private.permission_changes_checkpoint('menu.manage');
 if upload.upload_handle is null or upload.state not in('ready','published') then return private.permission_changes_failure('NOT_FOUND'); end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('objectKey',upload.object_key,'mimeType',upload.mime_type,'byteSize',upload.byte_size));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

create function public.permission_menu_image_discard_upload(p_upload_handle uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare sid uuid:=auth.uid(); actor public.employees; upload private.menu_image_uploads;
begin
 perform private.permission_current_employee(false);
 perform private.permission_store_mutex(sid);
 select * into upload from private.menu_image_uploads where store_id=sid and upload_handle=p_upload_handle for update;
 actor:=private.permission_changes_checkpoint('menu.manage');
 if upload.upload_handle is null then return private.permission_changes_failure('NOT_FOUND'); end if;
 if upload.state='published' then return private.permission_changes_failure('INVALID_WRITE_REQUEST'); end if;
 update private.menu_image_uploads set state='discarded',discarded_at=now() where upload_handle=p_upload_handle;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('objectKey',upload.object_key));
exception when sqlstate 'P0401' then return private.permission_failure(sqlerrm);
end $$;

-- apply_menu_changes calls this after its business/parent locks and before its
-- final authority checkpoint. Subsequent finalize/unpublish helpers therefore do
-- not wait on mutable image authority state after authorization.
create function private.permission_lock_menu_image_changes(p_store_id uuid,p_image_changes jsonb) returns void
language plpgsql volatile security definer set search_path=pg_catalog as $$
begin
 if p_store_id is distinct from auth.uid() or jsonb_typeof(p_image_changes)<>'array' then
  raise exception 'INVALID_WRITE_REQUEST' using errcode='P0001';
 end if;
 perform 1 from private.menu_image_uploads u join jsonb_array_elements(p_image_changes) x
  on x->>'uploadHandle' is not null and u.upload_handle=(x->>'uploadHandle')::uuid
 where u.store_id=p_store_id order by u.item_id,u.upload_handle for update of u;
 perform 1 from private.menu_image_assets a join jsonb_array_elements(p_image_changes) x
  on a.item_id=(x->>'itemId')::uuid
 where a.store_id=p_store_id and a.published order by a.item_id,a.asset_key for update of a;
end $$;

-- Called only inside apply_menu_changes after its final current-authority checkpoint.
create function private.permission_finalize_menu_image(p_store_id uuid,p_item_id uuid,p_upload_handle uuid) returns text
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare upload private.menu_image_uploads; asset uuid:=p_upload_handle;
begin
 if p_store_id is distinct from auth.uid() then raise exception 'FORBIDDEN' using errcode='P0401'; end if;
 select * into upload from private.menu_image_uploads where store_id=p_store_id and item_id=p_item_id and upload_handle=p_upload_handle for update;
 if upload.upload_handle is null then raise exception 'NOT_FOUND' using errcode='P0404'; end if;
 if upload.state<>'ready' then raise exception 'INVALID_WRITE_REQUEST' using errcode='P0001'; end if;
 update private.menu_image_assets set published=false,unpublished_at=now()
  where store_id=p_store_id and item_id=p_item_id and published;
 insert into private.menu_image_assets(asset_key,store_id,item_id,upload_handle,object_key,mime_type,byte_size,published,published_at)
 values(asset,p_store_id,p_item_id,p_upload_handle,upload.object_key,upload.mime_type,upload.byte_size,true,now());
 update private.menu_image_uploads set state='published',published_at=now() where upload_handle=p_upload_handle;
 return asset::text;
end $$;

create function private.permission_unpublish_menu_image(p_store_id uuid,p_item_id uuid,p_asset_key text) returns void
language plpgsql volatile security definer set search_path=pg_catalog as $$
begin
 if p_store_id is distinct from auth.uid() then raise exception 'FORBIDDEN' using errcode='P0401'; end if;
 update private.menu_image_assets set published=false,unpublished_at=now()
 where store_id=p_store_id and item_id=p_item_id and asset_key::text=p_asset_key and published;
end $$;

-- Every removal path (including clear-demo) withdraws the previous asset in the
-- same DB transaction. Bytes may remain privately stored for later cleanup.
create function private.permission_unpublish_changed_menu_image() returns trigger
language plpgsql volatile security definer set search_path=pg_catalog as $$
begin
 if old.image_asset_key is distinct from new.image_asset_key or new.deleted_at is not null then
  update private.menu_image_assets set published=false,unpublished_at=now()
   where store_id=old.store_id and item_id=old.id and asset_key::text=old.image_asset_key and published;
 end if;
 return new;
end $$;
revoke all on function private.permission_unpublish_changed_menu_image() from public,anon,authenticated,service_role;
create trigger permission_menu_image_withdrawal after update of image_asset_key,deleted_at on public.menu_items
 for each row execute function private.permission_unpublish_changed_menu_image();

-- Public Edge function calls this with service_role. It returns only an exact active binding.
create function public.permission_menu_image_public_lookup(p_asset_key uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select case when a.asset_key is null then null else jsonb_build_object(
  'assetKey',a.asset_key,'objectKey',a.object_key,'mimeType',a.mime_type,'byteSize',a.byte_size)
 end from (select p_asset_key asset_key) requested left join private.menu_image_assets a
 on a.asset_key=requested.asset_key and a.published and exists(
  select 1 from public.menu_items m where m.store_id=a.store_id and m.id=a.item_id
   and m.deleted_at is null and m.image_asset_key=a.asset_key::text)
$$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='public' and p.proname like 'permission_menu_image_%') or (n.nspname='private' and p.proname in('permission_lock_menu_image_changes','permission_finalize_menu_image','permission_unpublish_menu_image'))
 loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature); end loop;
 grant execute on function public.permission_menu_image_begin_upload(uuid,uuid,text,bigint),public.permission_menu_image_mark_ready(uuid),
  public.permission_menu_image_read_staging(uuid),public.permission_menu_image_discard_upload(uuid) to authenticated;
 grant execute on function public.permission_menu_image_public_lookup(uuid) to service_role;
end $$;
