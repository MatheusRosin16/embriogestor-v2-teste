-- EMBRIOGESTOR FASE 12.2
-- Permite que o usuário solicite Administrador, Veterinário ou Cliente,
-- mas NÃO concede o nível automaticamente. O Administrador continua aprovando.

alter table public.embrio_profiles
add column if not exists requested_role text
check (requested_role in ('ADMIN','VETERINARIO','CLIENTE'));

update public.embrio_profiles
set requested_role=role
where requested_role is null;

create or replace function public.embrio_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  admin_id uuid;
  solicitado text;
begin
  select user_id into admin_id
  from public.embrio_profiles
  where role='ADMIN' and ativo=true
  order by created_at asc
  limit 1;

  if admin_id is null then
    admin_id:=new.id;
  end if;

  solicitado:=upper(coalesce(new.raw_user_meta_data->>'requested_role','CLIENTE'));
  if solicitado not in ('ADMIN','VETERINARIO','CLIENTE') then
    solicitado:='CLIENTE';
  end if;

  insert into public.embrio_profiles(
    user_id,owner_id,email,nome,role,requested_role,cliente_id,ativo
  )
  values(
    new.id,
    admin_id,
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'nome',
             new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',''),
    case when new.id=admin_id then 'ADMIN' else 'CLIENTE' end,
    case when new.id=admin_id then 'ADMIN' else solicitado end,
    null,
    new.id=admin_id
  )
  on conflict (user_id) do update
    set nome=coalesce(nullif(excluded.nome,''),embrio_profiles.nome),
        requested_role=excluded.requested_role;

  return new;
end;
$$;

drop trigger if exists embrio_auth_user_created on auth.users;
create trigger embrio_auth_user_created
after insert on auth.users
for each row execute procedure public.embrio_novo_usuario();
