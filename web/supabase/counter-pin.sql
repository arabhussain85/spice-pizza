-- Counter terminal PIN (was added ad-hoc to the original Spice DB; captured here
-- so a fresh setup includes it). Referenced by the counter login + admin settings.
alter table settings add column if not exists counter_pin text not null default '1234';
