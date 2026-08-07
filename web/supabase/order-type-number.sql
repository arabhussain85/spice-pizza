-- Per-type sequence within a shift (Takeaway #1, Delivery #1, …), shown beside the token.
alter table orders add column if not exists type_number integer;
