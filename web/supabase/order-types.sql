alter table orders add column if not exists order_type text not null default 'dine_in';
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists customer_phone text;
alter table orders add column if not exists customer_address text;
alter table orders add column if not exists delivery_charge numeric(10,2) not null default 0;
create index if not exists idx_orders_type_status on orders(order_type, status);
