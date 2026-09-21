-- EmbrioGestor Fase 14.2 — habilita Realtime no estado compartilhado.
-- Execute uma única vez no SQL Editor do Supabase.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='embrio_app_state'
  ) then
    alter publication supabase_realtime add table public.embrio_app_state;
  end if;
end $$;
