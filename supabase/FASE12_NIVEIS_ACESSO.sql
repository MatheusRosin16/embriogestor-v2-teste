-- EMBRIOGESTOR FASE 12 — NÍVEIS DE ACESSO
-- Execute no SQL Editor do Supabase APÓS a estrutura das fases anteriores.

create table if not exists public.embrio_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  role text not null default 'CLIENTE' check (role in ('ADMIN','VETERINARIO','CLIENTE')),
  cliente_id text,
  ativo boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.embrio_profiles enable row level security;

-- Usuário atual pode ler o próprio perfil.
drop policy if exists "profiles_self_select" on public.embrio_profiles;
create policy "profiles_self_select"
on public.embrio_profiles for select to authenticated
using (user_id=auth.uid());

-- Administrador pode ver usuários do próprio laboratório.
drop policy if exists "profiles_admin_select" on public.embrio_profiles;
create policy "profiles_admin_select"
on public.embrio_profiles for select to authenticated
using (
  exists (
    select 1 from public.embrio_profiles me
    where me.user_id=auth.uid()
      and me.role='ADMIN'
      and me.ativo=true
      and me.owner_id=embrio_profiles.owner_id
  )
);

-- Administrador pode alterar níveis e vínculos.
drop policy if exists "profiles_admin_update" on public.embrio_profiles;
create policy "profiles_admin_update"
on public.embrio_profiles for update to authenticated
using (
  exists (
    select 1 from public.embrio_profiles me
    where me.user_id=auth.uid()
      and me.role='ADMIN'
      and me.ativo=true
      and me.owner_id=embrio_profiles.owner_id
  )
)
with check (
  exists (
    select 1 from public.embrio_profiles me
    where me.user_id=auth.uid()
      and me.role='ADMIN'
      and me.ativo=true
      and me.owner_id=embrio_profiles.owner_id
  )
);

-- Primeiro usuário existente vira Administrador.
insert into public.embrio_profiles(user_id,owner_id,email,nome,role,cliente_id,ativo)
select id,id,email,coalesce(raw_user_meta_data->>'full_name','Administrador'),'ADMIN',null,true
from auth.users
where id=(select id from auth.users order by created_at asc limit 1)
on conflict (user_id) do update set role='ADMIN',owner_id=excluded.owner_id,ativo=true;

-- Novos cadastros entram pendentes como Cliente e aguardam aprovação.
create or replace function public.embrio_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare admin_id uuid;
begin
  select user_id into admin_id
  from public.embrio_profiles
  where role='ADMIN' and ativo=true
  order by created_at asc
  limit 1;

  if admin_id is null then
    admin_id:=new.id;
  end if;

  insert into public.embrio_profiles(user_id,owner_id,email,nome,role,ativo)
  values(
    new.id,
    admin_id,
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),
    case when new.id=admin_id then 'ADMIN' else 'CLIENTE' end,
    new.id=admin_id
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists embrio_auth_user_created on auth.users;
create trigger embrio_auth_user_created
after insert on auth.users
for each row execute procedure public.embrio_novo_usuario();

-- Estado principal: Admin e Veterinário do mesmo laboratório podem ler.
drop policy if exists "embrio_state_select_own" on public.embrio_app_state;
drop policy if exists "embrio_state_insert_own" on public.embrio_app_state;
drop policy if exists "embrio_state_update_own" on public.embrio_app_state;

create policy "embrio_state_select_team"
on public.embrio_app_state for select to authenticated
using (
  exists (
    select 1 from public.embrio_profiles p
    where p.user_id=auth.uid() and p.ativo=true and p.owner_id=embrio_app_state.user_id
      and p.role in ('ADMIN','VETERINARIO')
  )
);

create policy "embrio_state_insert_team"
on public.embrio_app_state for insert to authenticated
with check (
  exists (
    select 1 from public.embrio_profiles p
    where p.user_id=auth.uid() and p.ativo=true and p.owner_id=embrio_app_state.user_id
      and p.role in ('ADMIN','VETERINARIO')
  )
);

create policy "embrio_state_update_team"
on public.embrio_app_state for update to authenticated
using (
  exists (
    select 1 from public.embrio_profiles p
    where p.user_id=auth.uid() and p.ativo=true and p.owner_id=embrio_app_state.user_id
      and p.role in ('ADMIN','VETERINARIO')
  )
)
with check (
  exists (
    select 1 from public.embrio_profiles p
    where p.user_id=auth.uid() and p.ativo=true and p.owner_id=embrio_app_state.user_id
      and p.role in ('ADMIN','VETERINARIO')
  )
);

-- Backups: somente Administrador.
drop policy if exists "embrio_backups_select_own" on public.embrio_backups;
drop policy if exists "embrio_backups_insert_own" on public.embrio_backups;
drop policy if exists "embrio_backups_delete_own" on public.embrio_backups;

create policy "embrio_backups_admin_select"
on public.embrio_backups for select to authenticated
using (
  exists(select 1 from public.embrio_profiles p where p.user_id=auth.uid() and p.role='ADMIN' and p.ativo=true and p.owner_id=embrio_backups.user_id)
);
create policy "embrio_backups_admin_insert"
on public.embrio_backups for insert to authenticated
with check (
  exists(select 1 from public.embrio_profiles p where p.user_id=auth.uid() and p.role='ADMIN' and p.ativo=true and p.owner_id=embrio_backups.user_id)
);
create policy "embrio_backups_admin_delete"
on public.embrio_backups for delete to authenticated
using (
  exists(select 1 from public.embrio_profiles p where p.user_id=auth.uid() and p.role='ADMIN' and p.ativo=true and p.owner_id=embrio_backups.user_id)
);

-- RPC: devolve banco completo para Admin/Vet e banco filtrado para Cliente.
create or replace function public.embrio_get_state()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare p public.embrio_profiles;
declare raw jsonb;
declare upd timestamptz;
declare rev bigint;
declare cid text;
declare scoped jsonb;
begin
  select * into p from public.embrio_profiles where user_id=auth.uid() and ativo=true;
  if p.user_id is null then return null; end if;

  select payload,updated_at,revision into raw,upd,rev
  from public.embrio_app_state where user_id=p.owner_id;

  if raw is null then return null; end if;

  if p.role in ('ADMIN','VETERINARIO') then
    return jsonb_build_object('payload',raw,'updated_at',upd,'revision',rev);
  end if;

  cid:=p.cliente_id;
  if cid is null then
    return jsonb_build_object('payload',jsonb_build_object('versao',2),'updated_at',upd,'revision',rev);
  end if;

  scoped:=jsonb_build_object(
    'versao',coalesce(raw->'versao','2'::jsonb),
    'clientes',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'clientes','[]'::jsonb)) x where x->>'id'=cid),'[]'::jsonb),
    'fazendas',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'fazendas','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'doadoras',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'doadoras','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'touros',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'touros','[]'::jsonb)) x where x->>'clienteId'=cid or coalesce(x->>'clienteId','')=''),'[]'::jsonb),
    'racas',coalesce(raw->'racas','[]'::jsonb),
    'profissionais','[]'::jsonb,
    'usuarios','[]'::jsonb,
    'estoque',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'estoque','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'movimentacoes',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'movimentacoes','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'estoqueEmbrioes',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'estoqueEmbrioes','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'aspiracoes',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'aspiracoes','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'producoes',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'producoes','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'transferencias',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'transferencias','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'congelamentos',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'congelamentos','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'servicosSemen',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'servicosSemen','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'custosProducao','[]'::jsonb
  );

  return jsonb_build_object('payload',scoped,'updated_at',upd,'revision',rev);
end;
$$;

grant execute on function public.embrio_get_state() to authenticated;
