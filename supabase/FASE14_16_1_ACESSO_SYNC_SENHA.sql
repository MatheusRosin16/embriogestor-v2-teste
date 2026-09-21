-- EMBRIOGESTOR FASE 14.16.1 — ACESSO + SINCRONIZAÇÃO SEGURA
-- Execute UMA VEZ. NÃO desativa usuários e NÃO altera owner_id em massa.

alter table public.embrio_profiles
add column if not exists profissional_id text;

-- Permite ao administrador atualizar o novo vínculo profissional_id pela policy já existente.
-- RPC usa exatamente o owner_id já salvo no perfil: não reclassifica usuários.
create or replace function public.embrio_get_state()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare p public.embrio_profiles;
declare raw jsonb; declare upd timestamptz; declare rev bigint;
declare cid text; declare scoped jsonb;
begin
  select * into p from public.embrio_profiles where user_id=auth.uid() and ativo=true;
  if p.user_id is null then return null; end if;
  select payload,updated_at,revision into raw,upd,rev from public.embrio_app_state where user_id=p.owner_id;
  if raw is null then return null; end if;

  if p.role in ('ADMIN','VETERINARIO') then
    return jsonb_build_object('payload',raw,'updated_at',upd,'revision',rev,'profissional_id',p.profissional_id);
  end if;

  cid:=p.cliente_id;
  if cid is null then
    return jsonb_build_object('payload',jsonb_build_object(
      'versao',2,'identidadeEmpresa',coalesce(raw->'identidadeEmpresa','{}'::jsonb)
    ),'updated_at',upd,'revision',rev);
  end if;

  scoped:=jsonb_build_object(
    'versao',coalesce(raw->'versao','2'::jsonb),
    'clientes',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'clientes','[]'::jsonb)) x where x->>'id'=cid),'[]'::jsonb),
    'fazendas',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'fazendas','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'doadoras',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'doadoras','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'touros',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'touros','[]'::jsonb)) x where x->>'clienteId'=cid or coalesce(x->>'clienteId','')=''),'[]'::jsonb),
    'racas',coalesce(raw->'racas','[]'::jsonb),
    'profissionais','[]'::jsonb,'usuarios','[]'::jsonb,
    'estoque',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'estoque','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'movimentacoes',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'movimentacoes','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'estoqueEmbrioes',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'estoqueEmbrioes','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'aspiracoes',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'aspiracoes','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'producoes',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'producoes','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'transferencias',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'transferencias','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'congelamentos',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'congelamentos','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'servicosSemen',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(raw->'servicosSemen','[]'::jsonb)) x where x->>'clienteId'=cid),'[]'::jsonb),
    'custosProducao','[]'::jsonb,
    'identidadeEmpresa',coalesce(raw->'identidadeEmpresa','{}'::jsonb)
  );
  return jsonb_build_object('payload',scoped,'updated_at',upd,'revision',rev);
end;
$$;
grant execute on function public.embrio_get_state() to authenticated;
