-- Developer-control gate code (owner can change it in Admin → Settings → Access & Security).
alter table settings add column if not exists dev_code text not null default 'spice-dev-2468';
