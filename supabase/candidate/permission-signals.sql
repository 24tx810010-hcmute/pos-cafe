-- PERM-T10 candidate fragment. Apply after permission-identity.sql.
-- Signals are lossy invalidation hints; protected data is re-read through current-authority RPCs.

create table public.permission_catalog_signals (
 singleton boolean primary key default true check(singleton),
 revision bigint not null check(revision>=0),
 event_id uuid not null
);

alter table public.store_change_signals replica identity full;
alter table public.permission_catalog_signals replica identity full;
alter table public.permission_catalog_signals enable row level security;

revoke all on public.store_change_signals,public.permission_catalog_signals from public,anon,authenticated,service_role;
grant select on public.store_change_signals,public.permission_catalog_signals to authenticated;

create policy store_change_signals_same_store on public.store_change_signals
 for select to authenticated using(store_id=auth.uid());
create policy permission_catalog_signals_authenticated on public.permission_catalog_signals
 for select to authenticated using(singleton);

create function private.emit_store_change_signal() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare
 row_data jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 sid uuid:=(row_data->>'store_id')::uuid;
 signal_topic text:=tg_argv[0];
begin
 if sid is null or signal_topic not in ('menu','floor','orders','report','settings') then
  raise exception 'INVALID_STORE_SIGNAL' using errcode='23514';
 end if;
 insert into public.store_change_signals(store_id,topic,revision,event_id,target_id)
 values(sid,signal_topic,1,gen_random_uuid(),null)
 on conflict(store_id,topic) do update
 set revision=public.store_change_signals.revision+1,event_id=excluded.event_id,target_id=null;
 return case when tg_op='DELETE' then old else new end;
end $$;

-- Keep the baseline invalidation surface. The join table intentionally has no trigger:
-- join-only modifier changes retain the documented manual refresh/reconnect limitation.
create trigger permission_signal_orders after insert or update or delete on public.orders
 for each row execute function private.emit_store_change_signal('orders');
create trigger permission_signal_payments after insert or update or delete on public.payments
 for each row execute function private.emit_store_change_signal('orders');
create trigger permission_signal_tables after insert or update or delete on public.tables
 for each row execute function private.emit_store_change_signal('orders');
create trigger permission_signal_categories after insert or update or delete on public.categories
 for each row execute function private.emit_store_change_signal('menu');
create trigger permission_signal_menu_items after insert or update or delete on public.menu_items
 for each row execute function private.emit_store_change_signal('menu');
create trigger permission_signal_option_groups after insert or update or delete on public.option_groups
 for each row execute function private.emit_store_change_signal('menu');
create trigger permission_signal_option_values after insert or update or delete on public.option_values
 for each row execute function private.emit_store_change_signal('menu');
create trigger permission_signal_floor_areas after insert or update or delete on public.floor_areas
 for each row execute function private.emit_store_change_signal('floor');
create trigger permission_signal_floor_decor after insert or update or delete on public.floor_decor_items
 for each row execute function private.emit_store_change_signal('floor');
create trigger permission_signal_store_settings after insert or update or delete on public.store_settings
 for each row execute function private.emit_store_change_signal('settings');

create function private.emit_permission_catalog_signal() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.revision is distinct from old.revision then
  insert into public.permission_catalog_signals(singleton,revision,event_id)
  values(true,new.revision,gen_random_uuid())
  on conflict(singleton) do update set revision=excluded.revision,event_id=excluded.event_id;
 end if;
 return new;
end $$;
create trigger permission_catalog_signal after update of revision on public.permission_catalog_state
 for each row execute function private.emit_permission_catalog_signal();

-- Remove every raw public-table route, including employee/audit/financial/menu joins,
-- then publish only the two minimal signal relations.
do $$
declare published record;
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  for published in
   select schemaname,tablename from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
     and tablename not in ('store_change_signals','permission_catalog_signals')
  loop
   execute format('alter publication supabase_realtime drop table %I.%I',published.schemaname,published.tablename);
  end loop;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='store_change_signals') then
   alter publication supabase_realtime add table public.store_change_signals;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='permission_catalog_signals') then
   alter publication supabase_realtime add table public.permission_catalog_signals;
  end if;
 end if;
end $$;
