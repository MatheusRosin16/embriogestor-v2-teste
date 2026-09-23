import { queueLocalChange } from '../services/offlineQueue'
import type { BancoEmbrioGestor, Raca } from '../types/domain'

const KEY='embriogestor2_novo'
let ACTIVE_KEY=KEY
let ACTIVE_USER_ID=''

export function ativarArmazenamentoUsuario(userId:string,migrarLegado=false){
  ACTIVE_USER_ID=userId
  ACTIVE_KEY=`${KEY}_${userId}`
  if(migrarLegado&&!localStorage.getItem(ACTIVE_KEY)){
    const legado=localStorage.getItem(KEY)
    if(legado)localStorage.setItem(ACTIVE_KEY,legado)
  }
  // Só o Administrador migra os metadados globais da versão anterior.
  // Veterinário e Cliente começam com metadados próprios, evitando herdar
  // horário de sync/dirty de outra conta usada no mesmo navegador.
  if(migrarLegado){
    for(const base of [LOCAL_CHANGED_AT,CLOUD_DIRTY,'embriogestor2_supabase_last_sync','embriogestor2_supabase_last_remote','embriogestor2_supabase_last_daily_backup','embriogestor2_supabase_conflict']){
      const scoped=`${base}_${userId}`
      if(localStorage.getItem(scoped)===null&&localStorage.getItem(base)!==null){
        localStorage.setItem(scoped,localStorage.getItem(base) as string)
      }
    }
  }
}

export function limparArmazenamentoAtivo(){
  ACTIVE_KEY=KEY
  ACTIVE_USER_ID=''
}
export const LOCAL_CHANGED_AT='embriogestor2_local_changed_at'
export const CLOUD_DIRTY='embriogestor2_cloud_dirty'
export const IDENTIDADE_PUBLICA_KEY='embriogestor2_identidade_publica'

export function syncMetaKey(base:string){
  return ACTIVE_USER_ID?`${base}_${ACTIVE_USER_ID}`:base
}
export function getSyncMeta(base:string){
  return localStorage.getItem(syncMetaKey(base))
}
export function setSyncMeta(base:string,value:string){
  localStorage.setItem(syncMetaKey(base),value)
}
export function removeSyncMeta(base:string){
  localStorage.removeItem(syncMetaKey(base))
}

const RACAS_PADRAO: Raca[] = [
  {id:'RAC_BRANGUS',nome:'Brangus',abreviatura:'BN'},
  {id:'RAC_NELORE',nome:'Nelore',abreviatura:'NE'},
  {id:'RAC_BRAFORD',nome:'Braford',abreviatura:'BF'},
  {id:'RAC_HOLANDES',nome:'Holandês',abreviatura:'HO'},
  {id:'RAC_JERSEY',nome:'Jersey',abreviatura:'JE'},
  {id:'RAC_ANGUS',nome:'Angus',abreviatura:'AN'},
  {id:'RAC_HEREFORD',nome:'Hereford',abreviatura:'HE'},
  {id:'RAC_SENEPOL',nome:'Senepol',abreviatura:'SE'},
  {id:'RAC_GIR',nome:'Gir',abreviatura:'GI'},
  {id:'RAC_GIROLANDO',nome:'Girolando',abreviatura:'GL'}
]

export function bancoVazio():BancoEmbrioGestor{
  return {
    versao:2,clientes:[],fazendas:[],doadoras:[],touros:[],
    racas:[...RACAS_PADRAO],profissionais:[],usuarios:[],estoque:[],
    movimentacoes:[],estoqueEmbrioes:[],aspiracoes:[],producoes:[],
    transferencias:[],congelamentos:[],servicosSemen:[],custosProducao:[],relatoriosTransferenciaEditaveis:[],
    identidadeEmpresa:{nome:'SÊMINNA – Laboratório de Reprodução Animal',nomeFantasia:'SÊMINNA',endereco:'AV. General Osório, 797, sala 01, Francisco Beltrão - PR'}
  }
}

function idRaca(nome:string){
  return 'RAC_'+nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'').toUpperCase()
}

function migrarRacas(data:any):Raca[]{
  const orig=Array.isArray(data?.racas)?data.racas:[]
  const map=new Map<string,Raca>()
  for(const r of RACAS_PADRAO) map.set(r.nome.toLowerCase(),{...r})

  for(const r of orig){
    if(typeof r==='string'){
      const nome=r.trim()
      if(nome&&!map.has(nome.toLowerCase())){
        map.set(nome.toLowerCase(),{id:idRaca(nome),nome,abreviatura:nome.slice(0,2).toUpperCase()})
      }
    }else if(r&&typeof r==='object'){
      const nome=String(r.nome||'').trim()
      if(nome){
        map.set(nome.toLowerCase(),{
          id:String(r.id||idRaca(nome)),
          nome,
          abreviatura:String(r.abreviatura||r.abreviação||r.sigla||nome.slice(0,2)).toUpperCase()
        })
      }
    }
  }
  return [...map.values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
}

export function normalizar(data:any):BancoEmbrioGestor{
  const base=bancoVazio()
  const listas=[
    'clientes','fazendas','doadoras','touros','profissionais','usuarios','estoque',
    'movimentacoes','estoqueEmbrioes','aspiracoes','producoes','transferencias',
    'congelamentos','servicosSemen','custosProducao','relatoriosTransferenciaEditaveis'
  ]
  for(const k of listas){
    if(Array.isArray(data?.[k])) (base as any)[k]=data[k]
  }
  base.racas=migrarRacas(data)
  if(data?.identidadeEmpresa&&typeof data.identidadeEmpresa==='object'){
    base.identidadeEmpresa={...base.identidadeEmpresa,...data.identidadeEmpresa}
  }

  // vincula racaId quando o legado tem somente nome
  base.doadoras=base.doadoras.map(d=>{
    const r=base.racas.find(x=>x.nome===d.raca||x.id===d.racaId)
    return {...d,racaId:r?.id||d.racaId||'',raca:r?.nome||d.raca||''}
  })
  const vinculos=new Map<string,Set<string>>()
  const vincular=(touroId?:string,clienteId?:string)=>{
    if(!touroId||!clienteId)return
    if(!vinculos.has(touroId))vinculos.set(touroId,new Set())
    vinculos.get(touroId)!.add(clienteId)
  }

  // Recupera a carteira do touro a partir de tudo que já registra touro + cliente.
  for(const e of base.estoque)vincular(e.touroId,e.clienteId)
  for(const e of base.estoqueEmbrioes)vincular(e.touroId,e.clienteId)
  for(const e of base.producoes)vincular(e.touroId,e.clienteId)
  for(const e of base.transferencias)vincular(e.touroId,e.clienteId)
  for(const e of base.servicosSemen)vincular(e.touroId,e.clienteId)
  for(const e of base.movimentacoes)vincular(e.touroId,e.clienteId)

  base.touros=base.touros.map(t=>{
    const r=base.racas.find(x=>x.nome===t.raca||x.id===t.racaId)
    const ids=new Set<string>([...(Array.isArray((t as any).clienteIds)?(t as any).clienteIds:[])])
    if(t.clienteId)ids.add(t.clienteId)
    for(const cid of vinculos.get(t.id)||[])ids.add(cid)
    const clienteIds=[...ids]
    return {...t,clienteIds,clienteId:t.clienteId||clienteIds[0]||'',racaId:r?.id||t.racaId||'',raca:r?.nome||t.raca||''}
  })
  return base
}

export function carregarBanco():BancoEmbrioGestor{
  try{
    const raw=localStorage.getItem(ACTIVE_KEY)
    const banco=raw?normalizar(JSON.parse(raw)):bancoVazio()
    if(banco.identidadeEmpresa)localStorage.setItem(IDENTIDADE_PUBLICA_KEY,JSON.stringify(banco.identidadeEmpresa))
    return banco
  }catch{return bancoVazio()}
}

export function salvarBanco(db:BancoEmbrioGestor, marcarAlteracao=true){
  localStorage.setItem(ACTIVE_KEY,JSON.stringify(db))
  if(db.identidadeEmpresa)localStorage.setItem(IDENTIDADE_PUBLICA_KEY,JSON.stringify(db.identidadeEmpresa))
  if(marcarAlteracao){
    setSyncMeta(LOCAL_CHANGED_AT,new Date().toISOString())
    setSyncMeta(CLOUD_DIRTY,'1')
    queueLocalChange()
    window.dispatchEvent(new CustomEvent('embrio-local-change'))
  }
}
