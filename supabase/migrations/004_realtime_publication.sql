do $$
declare
  realtime_table text;
  realtime_tables text[] := array[
    'orders',
    'payments',
    'tables',
    'categories',
    'menu_items',
    'option_groups',
    'option_values',
    'floor_areas',
    'floor_decor_items'
  ];
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    foreach realtime_table in array realtime_tables loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = realtime_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', realtime_table);
      end if;
    end loop;
  end if;
end;
$$;
