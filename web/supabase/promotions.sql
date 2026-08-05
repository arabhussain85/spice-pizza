create table if not exists promotions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'percent' check (type in ('percent','fixed')),
  value       numeric(10,2) not null,
  scope       text not null default 'all' check (scope in ('all','category','item')),
  category_id uuid references menu_categories(id) on delete cascade,
  group_key   text,                       -- product key when scope = 'item'
  is_active   boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);
alter table promotions enable row level security;
drop policy if exists dev_read on promotions;
create policy dev_read on promotions for select using (true);
