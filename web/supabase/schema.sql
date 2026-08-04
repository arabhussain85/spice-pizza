-- Spice Pizza — database schema
-- Apply ONCE via the Supabase SQL editor (or psql/pooler). Idempotent where practical.
-- Seed data is loaded separately by scripts/seed.mjs over HTTPS (service role).

-- ---------------------------------------------------------------------------
-- Sequences
-- ---------------------------------------------------------------------------
create sequence if not exists order_no_seq start 1042;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Staff (attribution; linked to auth.users by email in Phase 5)
-- ---------------------------------------------------------------------------
create table if not exists staff (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text unique,
  role        text not null default 'counter_staff' check (role in ('owner','counter_staff')),
  pin         text,                       -- owner PIN for restricted actions (discounts)
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Settings (singleton row id=1)
-- ---------------------------------------------------------------------------
create table if not exists settings (
  id                  smallint primary key default 1 check (id = 1),
  brand_name          text not null default 'Spice Pizza',
  service_charge_pct  numeric(5,2) not null default 5,
  discounts_role      text not null default 'owner' check (discounts_role in ('owner','any')),
  retention_days      integer not null default 30,
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Restaurant tables (dine-in tables)
-- ---------------------------------------------------------------------------
create table if not exists restaurant_tables (
  id          uuid primary key default gen_random_uuid(),
  number      integer not null unique,
  seats       integer,
  status      text not null default 'free' check (status in ('free','occupied')),
  opened_at   timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table if not exists menu_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  tab_group   text,                       -- optional grouping for counter tabs
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists menu_items (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references menu_categories(id) on delete cascade,
  group_key    text,                      -- links size variants of one product
  name         text not null,
  size_label   text,
  price        numeric(10,2) not null,
  description  text,                       -- e.g. deal contents / toppings
  photo_url    text,
  is_live      boolean not null default true,
  is_placeholder boolean not null default false, -- flag auto-sourced/placeholder items
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz                 -- soft delete
);

create table if not exists menu_item_modifiers (
  id            uuid primary key default gen_random_uuid(),
  menu_item_id  uuid references menu_items(id) on delete cascade, -- null => group/global
  group_key     text,                      -- applies to a product's variants
  label         text not null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text not null unique default ('SP-' || nextval('order_no_seq')),
  table_id           uuid references restaurant_tables(id),
  server_id          uuid references staff(id),
  server_name        text,
  status             text not null default 'open' check (status in ('open','closed','void')),
  service_charge_pct numeric(5,2) not null default 5,
  opened_at          timestamptz not null default now(),
  closed_at          timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists order_rounds (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders(id) on delete cascade,
  round_number       integer not null,
  sent_to_kitchen_at timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists order_line_items (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references order_rounds(id) on delete cascade,
  menu_item_id   uuid references menu_items(id),
  name_snapshot  text not null,
  size_snapshot  text,
  quantity       integer not null default 1 check (quantity > 0),
  unit_price     numeric(10,2) not null,
  note           text,
  modifiers      text[] not null default '{}',
  is_voided      boolean not null default false,
  void_reason    text,
  voided_by      uuid references staff(id),
  voided_at      timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists discounts (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  type        text not null check (type in ('percent','fixed')),
  value       numeric(10,2) not null,
  applied_by  uuid references staff(id),
  reason      text,
  created_at  timestamptz not null default now()
);

create table if not exists payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  method        text not null check (method in ('cash','card','jazzcash','easypaisa','other')),
  amount        numeric(10,2) not null,
  status        text not null default 'confirmed' check (status in ('pending','confirmed')),
  screenshot_url text,
  confirmed_by  uuid references staff(id),
  confirmed_at  timestamptz,
  paid_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Daily summaries (retention rollup — powers old reports)
-- ---------------------------------------------------------------------------
create table if not exists daily_summaries (
  day                   date primary key,
  revenue               numeric(12,2) not null default 0,
  order_count           integer not null default 0,
  avg_order             numeric(12,2) not null default 0,
  service_charge_total  numeric(12,2) not null default 0,
  discount_total        numeric(12,2) not null default 0,
  top_items             jsonb not null default '[]',
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_menu_items_category on menu_items(category_id);
create index if not exists idx_menu_items_group    on menu_items(group_key);
create index if not exists idx_menu_items_live     on menu_items(is_live) where deleted_at is null;
create index if not exists idx_orders_status       on orders(status);
create index if not exists idx_orders_table        on orders(table_id);
create index if not exists idx_orders_opened       on orders(opened_at);
create index if not exists idx_rounds_order        on order_rounds(order_id);
create index if not exists idx_items_round         on order_line_items(round_id);
create index if not exists idx_payments_order      on payments(order_id);
create index if not exists idx_payments_status     on payments(status);
create index if not exists idx_discounts_order     on discounts(order_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_menu_items_updated on menu_items;
create trigger trg_menu_items_updated before update on menu_items
  for each row execute function set_updated_at();

drop trigger if exists trg_settings_updated on settings;
create trigger trg_settings_updated before update on settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (dev-permissive: anon can read for live UI/Realtime; writes go through the
-- service role which bypasses RLS. Phase 5 replaces these with role-based policies.)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'staff','settings','restaurant_tables','menu_categories','menu_items',
    'menu_item_modifiers','orders','order_rounds','order_line_items',
    'discounts','payments','daily_summaries'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists dev_read on %I;', t);
    execute format('create policy dev_read on %I for select using (true);', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime: publish the tables the counter/admin subscribe to
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'restaurant_tables','orders','order_rounds','order_line_items','payments','menu_items'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null; when others then null;
    end;
  end loop;
end $$;
