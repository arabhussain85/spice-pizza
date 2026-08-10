alter table orders add column if not exists delivery_charge numeric(10,2) not null default 0;
