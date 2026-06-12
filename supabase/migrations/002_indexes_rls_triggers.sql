create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger employees_set_updated_at before update on public.employees
for each row execute function public.set_updated_at();

create trigger stores_set_updated_at before update on public.stores
for each row execute function public.set_updated_at();

create trigger store_settings_set_updated_at before update on public.store_settings
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();

create trigger menu_items_set_updated_at before update on public.menu_items
for each row execute function public.set_updated_at();

create trigger option_groups_set_updated_at before update on public.option_groups
for each row execute function public.set_updated_at();

create trigger option_values_set_updated_at before update on public.option_values
for each row execute function public.set_updated_at();

create trigger floor_areas_set_updated_at before update on public.floor_areas
for each row execute function public.set_updated_at();

create trigger tables_set_updated_at before update on public.tables
for each row execute function public.set_updated_at();

create trigger floor_decor_items_set_updated_at before update on public.floor_decor_items
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

create trigger order_items_set_updated_at before update on public.order_items
for each row execute function public.set_updated_at();

create trigger order_item_options_set_updated_at before update on public.order_item_options
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();

create index employees_store_active_idx on public.employees (store_id, is_active);
create unique index employees_store_seed_key_idx on public.employees (store_id, seed_key) where seed_key is not null;
create index categories_store_active_idx on public.categories (store_id, sort_order) where deleted_at is null;
create unique index categories_store_seed_key_idx on public.categories (store_id, seed_key) where seed_key is not null;
create index menu_items_store_category_active_idx on public.menu_items (store_id, category_id, sort_order) where deleted_at is null;
create unique index menu_items_store_seed_key_idx on public.menu_items (store_id, seed_key) where seed_key is not null;
create index option_groups_store_item_active_idx on public.option_groups (store_id, menu_item_id, sort_order) where deleted_at is null;
create unique index option_groups_store_seed_key_idx on public.option_groups (store_id, seed_key) where seed_key is not null;
create index option_values_store_group_active_idx on public.option_values (store_id, option_group_id, sort_order) where deleted_at is null;
create unique index option_values_store_seed_key_idx on public.option_values (store_id, seed_key) where seed_key is not null;
create index floor_areas_store_active_idx on public.floor_areas (store_id, sort_order) where deleted_at is null;
create unique index floor_areas_store_seed_key_idx on public.floor_areas (store_id, seed_key) where seed_key is not null;
create index tables_store_area_active_idx on public.tables (store_id, area_id, sort_order) where deleted_at is null;
create unique index tables_store_seed_key_idx on public.tables (store_id, seed_key) where seed_key is not null;
create index floor_decor_items_store_area_active_idx on public.floor_decor_items (store_id, area_id, z_index) where deleted_at is null;
create unique index floor_decor_items_store_seed_key_idx on public.floor_decor_items (store_id, seed_key) where seed_key is not null;
create index orders_store_status_idx on public.orders (store_id, status, business_date desc);
create unique index orders_store_table_open_idx on public.orders (store_id, table_id) where status = 'open' and table_id is not null;
create index order_items_store_order_idx on public.order_items (store_id, order_id, sort_order);
create index payments_store_paid_at_idx on public.payments (store_id, paid_at desc);

alter table public.stores enable row level security;
alter table public.employees enable row level security;
alter table public.store_settings enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.option_groups enable row level security;
alter table public.option_values enable row level security;
alter table public.floor_areas enable row level security;
alter table public.tables enable row level security;
alter table public.floor_decor_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_options enable row level security;
alter table public.payments enable row level security;

create policy stores_is_current_auth_user on public.stores
for all using (id = auth.uid()) with check (id = auth.uid());

create policy employees_store_is_auth_user on public.employees
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy store_settings_store_is_auth_user on public.store_settings
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy categories_store_is_auth_user on public.categories
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy menu_items_store_is_auth_user on public.menu_items
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy option_groups_store_is_auth_user on public.option_groups
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy option_values_store_is_auth_user on public.option_values
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy floor_areas_store_is_auth_user on public.floor_areas
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy tables_store_is_auth_user on public.tables
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy floor_decor_items_store_is_auth_user on public.floor_decor_items
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy orders_store_is_auth_user on public.orders
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy order_items_store_is_auth_user on public.order_items
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy order_item_options_store_is_auth_user on public.order_item_options
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy payments_store_is_auth_user on public.payments
for all using (store_id = auth.uid()) with check (store_id = auth.uid());
