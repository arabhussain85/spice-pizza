-- ── Expenses (money out) ────────────────────────────────────────────────────
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'Other',
  amount      numeric(12,2) not null,
  description text,
  paid_to     text,
  spent_at    date not null default current_date,
  created_at  timestamptz not null default now()
);
alter table expenses enable row level security;
drop policy if exists exp_auth on expenses;
create policy exp_auth on expenses for select to authenticated using (true);
create index if not exists idx_expenses_date on expenses(spent_at);

-- ── Udhaar / credit ledger (buy now, pay later) ─────────────────────────────
-- kind='charge' = customer took credit; kind='payment' = customer repaid.
create table if not exists credit_ledger (
  id             uuid primary key default gen_random_uuid(),
  customer_name  text not null,
  customer_phone text,
  order_id       uuid references orders(id) on delete set null,
  amount         numeric(12,2) not null,
  kind           text not null check (kind in ('charge','payment')),
  note           text,
  created_at     timestamptz not null default now()
);
alter table credit_ledger enable row level security;
drop policy if exists credit_auth on credit_ledger;
create policy credit_auth on credit_ledger for select to authenticated using (true);
create index if not exists idx_credit_phone on credit_ledger(customer_phone);

-- ── Allow "udhaar" as a payment method ──────────────────────────────────────
alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('cash','card','jazzcash','easypaisa','udhaar','other'));
