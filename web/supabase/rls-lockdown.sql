-- Hide the discount PIN + terminal/dev codes from the public anon key,
-- without changing anything the counter (anon) actually reads.

-- staff: readable only by a logged-in owner (authenticated), never anon.
drop policy if exists dev_read on staff;
create policy staff_auth_read on staff for select to authenticated using (true);

-- settings: still readable by anon, but hide the secret columns.
revoke select on settings from anon;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
  from information_schema.columns
  where table_schema='public' and table_name='settings'
    and column_name not in ('counter_pin','dev_code');
  execute 'grant select ('||cols||') on settings to anon';
end $$;
