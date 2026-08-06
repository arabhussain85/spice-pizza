create table if not exists shifts (
  id         uuid primary key default gen_random_uuid(),
  opened_at  timestamptz not null default now(),
  closed_at  timestamptz,
  opened_by  text,
  closed_by  text,
  created_at timestamptz not null default now()
);
alter table shifts enable row level security;
drop policy if exists dev_read on shifts;
create policy dev_read on shifts for select using (true);

alter table orders   add column if not exists token_number integer;
alter table orders   add column if not exists shift_id uuid references shifts(id);
alter table payments add column if not exists tendered numeric(10,2);
create index if not exists idx_orders_shift on orders(shift_id);
