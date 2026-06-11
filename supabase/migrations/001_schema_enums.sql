create extension if not exists pgcrypto;

create sequence if not exists public.store_no_seq;

create type public.employee_role as enum ('admin', 'cashier', 'kitchen');
create type public.seed_status as enum ('pending', 'seeded', 'failed');
create type public.option_select_type as enum ('single', 'multi');
create type public.table_shape as enum ('round', 'square', 'rectangle');
create type public.table_status as enum ('empty', 'occupied');
create type public.decor_kind as enum ('wall', 'plant', 'counter', 'door', 'decor', 'image');
create type public.order_type as enum ('dine_in', 'takeaway');
create type public.order_status as enum ('open', 'paid', 'void');
create type public.order_item_status as enum ('waiting', 'done', 'removed');
create type public.discount_type as enum ('none', 'percent', 'amount');
create type public.payment_method as enum ('cash', 'bank_transfer', 'qr', 'other');

create table public.stores (
  id uuid primary key references auth.users (id) on delete cascade,
  store_no integer not null unique,
  name text,
  email text,
  seed_status public.seed_status not null default 'pending',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  role public.employee_role not null,
  passcode_hash text not null,
  is_active boolean not null default true,
  seed_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id)
);

create table public.store_settings (
  store_id uuid primary key references public.stores (id) on delete cascade,
  display_name text not null default 'POS Demo',
  address text not null default '',
  currency text not null default 'VND',
  timezone text not null default 'Asia/Saigon',
  bill_footer text not null default '',
  qr_info jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_settings_currency_vnd check (currency = 'VND')
);

create table public.categories (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  seed_key text,
  deleted_at timestamptz,
  deleted_by_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, deleted_by_employee_id) references public.employees (store_id, id)
);

create table public.menu_items (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid not null,
  name text not null,
  price integer not null check (price >= 0),
  image_asset_key text,
  sort_order integer not null default 0,
  is_available boolean not null default true,
  seed_key text,
  deleted_at timestamptz,
  deleted_by_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, category_id) references public.categories (store_id, id),
  foreign key (store_id, deleted_by_employee_id) references public.employees (store_id, id)
);

create table public.option_groups (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  menu_item_id uuid not null,
  name text not null,
  select_type public.option_select_type not null,
  is_required boolean not null default false,
  min_select integer not null default 0,
  max_select integer not null default 1,
  sort_order integer not null default 0,
  seed_key text,
  deleted_at timestamptz,
  deleted_by_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, menu_item_id) references public.menu_items (store_id, id),
  foreign key (store_id, deleted_by_employee_id) references public.employees (store_id, id),
  constraint option_group_select_bounds check (min_select >= 0 and max_select >= min_select)
);

create table public.option_values (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  option_group_id uuid not null,
  name text not null,
  price_delta integer not null default 0,
  sort_order integer not null default 0,
  seed_key text,
  deleted_at timestamptz,
  deleted_by_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, option_group_id) references public.option_groups (store_id, id),
  foreign key (store_id, deleted_by_employee_id) references public.employees (store_id, id)
);

create table public.floor_areas (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  seed_key text,
  deleted_at timestamptz,
  deleted_by_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, deleted_by_employee_id) references public.employees (store_id, id)
);

create table public.tables (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  area_id uuid not null,
  name text not null,
  pos_x integer not null,
  pos_y integer not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  shape public.table_shape not null,
  rotation integer not null default 0,
  seats integer not null default 2,
  sort_order integer not null default 0,
  status public.table_status not null default 'empty',
  seed_key text,
  deleted_at timestamptz,
  deleted_by_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, area_id) references public.floor_areas (store_id, id),
  foreign key (store_id, deleted_by_employee_id) references public.employees (store_id, id)
);

create table public.floor_decor_items (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  area_id uuid not null,
  kind public.decor_kind not null,
  label text,
  asset_key text not null,
  pos_x integer not null,
  pos_y integer not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  rotation integer not null default 0,
  z_index integer not null default 0,
  is_locked boolean not null default false,
  seed_key text,
  deleted_at timestamptz,
  deleted_by_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, area_id) references public.floor_areas (store_id, id),
  foreign key (store_id, deleted_by_employee_id) references public.employees (store_id, id)
);

create table public.orders (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  table_id uuid,
  order_type public.order_type not null,
  order_no integer not null,
  business_date date not null,
  status public.order_status not null default 'open',
  subtotal integer not null default 0,
  discount_type public.discount_type not null default 'none',
  discount_value integer not null default 0,
  total integer not null default 0,
  employee_id uuid not null,
  paid_at timestamptz,
  lock_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  unique (store_id, business_date, order_no),
  foreign key (store_id, table_id) references public.tables (store_id, id),
  foreign key (store_id, employee_id) references public.employees (store_id, id),
  constraint order_money_nonnegative check (subtotal >= 0 and discount_value >= 0 and total >= 0)
);

create table public.order_items (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  order_id uuid not null,
  menu_item_id uuid,
  item_name text not null,
  quantity integer not null check (quantity >= 0),
  unit_price integer not null check (unit_price >= 0),
  note text,
  status public.order_item_status not null default 'waiting',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, order_id) references public.orders (store_id, id) on delete cascade,
  foreign key (store_id, menu_item_id) references public.menu_items (store_id, id)
);

create table public.order_item_options (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  order_item_id uuid not null,
  option_value_id uuid,
  option_name text not null,
  price_delta integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, order_item_id) references public.order_items (store_id, id) on delete cascade,
  foreign key (store_id, option_value_id) references public.option_values (store_id, id)
);

create table public.payments (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  order_id uuid not null,
  employee_id uuid not null,
  method public.payment_method not null,
  amount integer not null check (amount >= 0),
  received_amount integer not null check (received_amount >= 0),
  change_amount integer not null check (change_amount >= 0),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, order_id) references public.orders (store_id, id),
  foreign key (store_id, employee_id) references public.employees (store_id, id)
);
