import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import type { BancoEmbrioGestor, PerfilAcesso, NivelAcesso } from '../types/domain'
import { normalizar, salvarBanco, CLOUD_DIRTY, LOCAL_CHANGED_AT, getSyncMeta, setSyncMeta, removeSyncMeta } from '../store/database'

export const SUPABASE_CONFIG_KEY='embriogestor2_supabase_config'
export const SUPABASE_SESSION_KEY='embriogestor2_supabase_session'
export const LAST_SYNC_KEY='embriogestor2_supabase_last_sync'
export const LAST_REMOTE_KEY='embriogestor2_supabase_last_remote'
export const LAST_DAILY_BACKUP_KEY='embriogestor2_supabase_last_daily_backup'
export const CLOUD_CONFLICT_KEY='embriogestor2_supabase_conflict'
export const SYNC_USER_KEY='embriogestor2_supabase_sync_user'

export type SupabaseConfig={url:string;anonKey:string}
export const DEFAULT_SUPABASE_CONFIG:SupabaseConfig={
  url:'https://zbfuumsfkvjropighghb.supabase.co',
  anonKey:'sb_publishable_ko_zDWSanvk_7HB_BgzGOg_Lc3JZgtB'
}
export type CloudSession={
  access_token:string
  refresh_token:string
  expires_at:number
  user:{id:string;email?:string}
}

export type CloudStatus={
  configured:boolean
  signedIn:boolean
  email?:string
  dirty:boolean
  lastSync?:string|null
  conflict:boolean
}

function cleanUrl(v:string){return v.trim().replace(/\/+$/,'')}
export function getSupabaseConfig():SupabaseConfig|null{
  try{
    const raw=localStorage.getItem(SUPABASE_CONFIG_KEY)
    if(raw){
      const c=JSON.parse(raw)
      if(c?.url&&c?.anonKey){
        return {url:cleanUrl(c.url),anonKey:String(c.anonKey).trim()}
      }
    }
  }catch{}
  const cfg={url:cleanUrl(DEFAULT_SUPABASE_CONFIG.url),anonKey:DEFAULT_SUPABASE_CONFIG.anonKey.trim()}
  localStorage.setItem(SUPABASE_CONFIG_KEY,JSON.stringify(cfg))
  return cfg
}
export function saveSupabaseConfig(c:SupabaseConfig){
  localStorage.setItem(SUPABASE_CONFIG_KEY,JSON.stringify({url:cleanUrl(c.url),anonKey:c.anonKey.trim()}))
}
export function clearSupabaseConfig(){
  localStorage.removeItem(SUPABASE_CONFIG_KEY)
}
export function getSession():CloudSession|null{
  try{
    const raw=localStorage.getItem(SUPABASE_SESSION_KEY)
    return raw?JSON.parse(raw):null
  }catch{return null}
}
function resetSyncContextForUser(userId:string){
  const anterior=localStorage.getItem(SYNC_USER_KEY)
  if(anterior===userId)return false
  // Metadados de sincronização nunca podem ser herdados de outro login no mesmo navegador.
  removeSyncMeta(CLOUD_CONFLICT_KEY)
  removeSyncMeta(LAST_SYNC_KEY)
  removeSyncMeta(LAST_REMOTE_KEY)
  setSyncMeta(CLOUD_DIRTY,'0')
  localStorage.setItem(SYNC_USER_KEY,userId)
  window.dispatchEvent(new CustomEvent('embrio-cloud-status'))
  return true
}

function saveSessionFromResponse(data:any){
  const s:CloudSession={
    access_token:data.access_token,
    refresh_token:data.refresh_token,
    expires_at:Math.floor(Date.now()/1000)+(Number(data.expires_in)||3600)-30,
    user:{id:data.user?.id,email:data.user?.email}
  }
  localStorage.setItem(SUPABASE_SESSION_KEY,JSON.stringify(s))
  resetSyncContextForUser(s.user.id)
  window.dispatchEvent(new CustomEvent('embrio-cloud-status'))
  return s
}
export function signOutLocal(){
  localStorage.removeItem(SUPABASE_SESSION_KEY)
  window.dispatchEvent(new CustomEvent('embrio-cloud-status'))
}

async function jsonOrText(r:Response){
  const txt=await r.text()
  try{return txt?JSON.parse(txt):{}}catch{return {message:txt}}
}
function errorMessage(data:any,fallback:string){
  return data?.msg||data?.message||data?.error_description||data?.error||fallback
}
export async function signUp(email:string,password:string,metadata?:{nome?:string;requested_role?:NivelAcesso}){
  const c=getSupabaseConfig()
  if(!c)throw new Error('Configure o Supabase primeiro.')
  const r=await fetch(`${c.url}/auth/v1/signup`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':c.anonKey},
    body:JSON.stringify({email,password,data:metadata||{}})
  })
  const data=await jsonOrText(r)
  if(!r.ok)throw new Error(errorMessage(data,'Não foi possível criar o usuário.'))
  if(data.access_token)return saveSessionFromResponse(data)
  return null
}
export async function requestPasswordReset(email:string){
  const c=getSupabaseConfig()
  if(!c)throw new Error('Supabase não configurado.')
  const redirect=appReturnUrl()
  const r=await fetch(`${c.url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':c.anonKey},
    body:JSON.stringify({email})
  })
  const data=await jsonOrText(r)
  if(!r.ok)throw new Error(errorMessage(data,'Não foi possível enviar a recuperação de senha.'))
  return true
}

export async function signIn(email:string,password:string){
  const c=getSupabaseConfig()
  if(!c)throw new Error('Configure o Supabase primeiro.')
  const r=await fetch(`${c.url}/auth/v1/token?grant_type=password`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':c.anonKey},
    body:JSON.stringify({email,password})
  })
  const data=await jsonOrText(r)
  if(!r.ok)throw new Error(errorMessage(data,'Não foi possível entrar.'))
  return saveSessionFromResponse(data)
}

async function refreshSession(){
  const c=getSupabaseConfig(),s=getSession()
  if(!c||!s?.refresh_token)throw new Error('Sessão da nuvem não disponível.')
  const r=await fetch(`${c.url}/auth/v1/token?grant_type=refresh_token`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':c.anonKey},
    body:JSON.stringify({refresh_token:s.refresh_token})
  })
  const data=await jsonOrText(r)
  if(!r.ok){
    signOutLocal()
    throw new Error(errorMessage(data,'Sua sessão expirou. Entre novamente.'))
  }
  return saveSessionFromResponse(data)
}
async function validSession(){
  let s=getSession()
  if(!s)throw new Error('Entre na nuvem primeiro.')
  if(s.expires_at<=Math.floor(Date.now()/1000))s=await refreshSession()
  return s
}
async function api(path:string,options:RequestInit={}){
  const c=getSupabaseConfig()
  if(!c)throw new Error('Supabase não configurado.')
  const s=await validSession()
  const h=new Headers(options.headers||{})
  h.set('apikey',c.anonKey)
  h.set('Authorization',`Bearer ${s.access_token}`)
  if(!h.has('Content-Type')&&options.body)h.set('Content-Type','application/json')
  const r=await fetch(`${c.url}${path}`,{...options,headers:h})
  if(r.status===401){
    await refreshSession()
    return api(path,options)
  }
  if(!r.ok){
    const data=await jsonOrText(r)
    throw new Error(errorMessage(data,`Erro Supabase ${r.status}`))
  }
  return r
}


export async function consumeOAuthSessionFromUrl(){
  const hash=window.location.hash.startsWith('#')?window.location.hash.slice(1):''
  if(!hash)return null
  const p=new URLSearchParams(hash)
  const recovery=p.get('type')==='recovery'
  const access=p.get('access_token'),refresh=p.get('refresh_token')
  if(!access||!refresh)return null
  const expiresIn=Number(p.get('expires_in')||3600)
  const c=getSupabaseConfig()
  if(!c)return null
  const ur=await fetch(`${c.url}/auth/v1/user`,{headers:{apikey:c.anonKey,Authorization:`Bearer ${access}`}})
  if(!ur.ok)return null
  const user=await ur.json()
  const s:CloudSession={
    access_token:access,refresh_token:refresh,
    expires_at:Math.floor(Date.now()/1000)+expiresIn-30,
    user:{id:user.id,email:user.email}
  }
  localStorage.setItem(SUPABASE_SESSION_KEY,JSON.stringify(s))
  resetSyncContextForUser(s.user.id)
  history.replaceState({},document.title,window.location.pathname+window.location.search)
  window.dispatchEvent(new CustomEvent('embrio-cloud-status'))
  return {session:s,recovery}
}

export async function updatePassword(password:string){
  if(password.length<6)throw new Error('A nova senha precisa ter pelo menos 6 caracteres.')
  const c=getSupabaseConfig()
  if(!c)throw new Error('Supabase não configurado.')
  const s=await validSession()
  const r=await fetch(`${c.url}/auth/v1/user`,{
    method:'PUT',
    headers:{'Content-Type':'application/json','apikey':c.anonKey,Authorization:`Bearer ${s.access_token}`},
    body:JSON.stringify({password})
  })
  const data=await jsonOrText(r)
  if(!r.ok)throw new Error(errorMessage(data,'Não foi possível alterar a senha.'))
  return true
}

export function appReturnUrl(){
  return `${window.location.origin}${window.location.pathname}`
}
export function oauthDisponivelNesteEndereco(){
  return window.location.protocol==='https:' || ['localhost','127.0.0.1'].includes(window.location.hostname)
}
export async function signInWithGoogle(){
  const c=getSupabaseConfig()
  if(!c)throw new Error('Configure o Supabase primeiro.')
  if(!oauthDisponivelNesteEndereco()){
    throw new Error('No teste pelo IP local, use e-mail e senha. O login Google será habilitado no endereço HTTPS publicado.')
  }
  const redirect=appReturnUrl()
  sessionStorage.setItem('embriogestor_oauth_return',redirect)
  window.location.href=`${c.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`
}

export async function getMyProfile():Promise<PerfilAcesso|null>{
  const s=await validSession()
  const q=new URLSearchParams({user_id:`eq.${s.user.id}`,select:'user_id,owner_id,email,nome,role,requested_role,cliente_id,profissional_id,ativo,created_at',limit:'1'})
  const rows=await (await api(`/rest/v1/embrio_profiles?${q.toString()}`)).json()
  return rows?.[0]||null
}

export async function listProfiles():Promise<PerfilAcesso[]>{
  const rows=await (await api('/rest/v1/embrio_profiles?select=user_id,owner_id,email,nome,role,requested_role,cliente_id,profissional_id,ativo,created_at&order=created_at.asc')).json()
  return rows||[]
}

export async function updateProfile(userId:string,data:{role?:NivelAcesso;cliente_id?:string|null;profissional_id?:string|null;ativo?:boolean;nome?:string}){
  const r=await api(`/rest/v1/embrio_profiles?user_id=eq.${encodeURIComponent(userId)}`,{
    method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(data)
  })
  const rows=await r.json()
  return rows?.[0]||null
}

export async function getScopedRemoteState(){
  const r=await api('/rest/v1/rpc/embrio_get_state',{
    method:'POST',body:JSON.stringify({})
  })
  return await r.json()
}

export async function getRemoteState(){
  const data=await getScopedRemoteState()
  if(!data)return null
  return data
}

export async function pushDatabase(db:BancoEmbrioGestor,{backup=true}:{backup?:boolean}={}){
  // Guarda a versão local correspondente exatamente ao banco que está sendo enviado.
  // Se o usuário editar novamente enquanto a requisição estiver em andamento,
  // o retorno deste envio antigo não poderá marcar a edição nova como sincronizada.
  const localChangedAtAtStart=getSyncMeta(LOCAL_CHANGED_AT)
  await validSession()
  const perfil=await getMyProfile()
  if(!perfil)throw new Error('Perfil de acesso não encontrado.')
  if(perfil.role==='CLIENTE')throw new Error('Acesso de cliente é somente leitura.')
  const revision=Date.now()
  let remote:any
  if(perfil.role==='VETERINARIO'){
    if(!perfil.profissional_id)throw new Error('Seu acesso veterinário ainda não foi vinculado a um profissional pelo administrador.')
    const r=await api('/rest/v1/rpc/embrio_save_vet_state',{method:'POST',body:JSON.stringify({new_payload:db})})
    remote=await r.json()
  }else{
    const payload={user_id:perfil.owner_id,payload:db,revision,updated_at:new Date().toISOString()}
    const r=await api('/rest/v1/embrio_app_state?on_conflict=user_id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)})
    const rows=await r.json();remote=rows?.[0]
  }
  const syncedAt=remote?.updated_at||new Date().toISOString()
  const localChangedAtNow=getSyncMeta(LOCAL_CHANGED_AT)
  const houveNovaEdicaoDuranteEnvio=localChangedAtNow!==localChangedAtAtStart
  if(!houveNovaEdicaoDuranteEnvio){
    setSyncMeta(CLOUD_DIRTY,'0')
    removeSyncMeta(CLOUD_CONFLICT_KEY)
  }else{
    setSyncMeta(CLOUD_DIRTY,'1')
  }
  setSyncMeta(LAST_SYNC_KEY,syncedAt)
  setSyncMeta(LAST_REMOTE_KEY,syncedAt)
  if(backup&&!houveNovaEdicaoDuranteEnvio)await createDailyBackup(db).catch(()=>{})
  window.dispatchEvent(new CustomEvent('embrio-cloud-status'))
  return remote
}

export async function pullDatabase(){
  const remote=await getRemoteState()
  if(!remote?.payload)return null
  const db=normalizar(remote.payload)
  salvarBanco(db,false)
  const syncedAt=remote.updated_at||new Date().toISOString()
  setSyncMeta(CLOUD_DIRTY,'0')
  setSyncMeta(LAST_SYNC_KEY,syncedAt)
  setSyncMeta(LAST_REMOTE_KEY,syncedAt)
  removeSyncMeta(CLOUD_CONFLICT_KEY)
  window.dispatchEvent(new CustomEvent('embrio-cloud-status'))
  return {db,updated_at:syncedAt}
}

export async function createDailyBackup(db:BancoEmbrioGestor,force=false){
  const today=new Date().toISOString().slice(0,10)
  if(!force&&getSyncMeta(LAST_DAILY_BACKUP_KEY)===today)return false
  await validSession()
  const perfil=await getMyProfile()
  if(!perfil||perfil.role!=='ADMIN')return false
  await api('/rest/v1/embrio_backups',{
    method:'POST',
    headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({
      user_id:perfil.owner_id,
      payload:db,
      source:'AUTO',
      created_at:new Date().toISOString()
    })
  })
  setSyncMeta(LAST_DAILY_BACKUP_KEY,today)
  return true
}

export async function listBackups(){
  await validSession()
  const perfil=await getMyProfile()
  if(!perfil||perfil.role!=='ADMIN')return []
  const q=new URLSearchParams({
    user_id:`eq.${perfil.owner_id}`,
    select:'id,created_at,source',
    order:'created_at.desc',
    limit:'30'
  })
  return await (await api(`/rest/v1/embrio_backups?${q.toString()}`)).json()
}
export async function restoreBackup(id:string|number){
  await validSession()
  const perfil=await getMyProfile()
  if(!perfil||perfil.role!=='ADMIN')throw new Error('Somente o administrador pode restaurar backups.')
  const q=new URLSearchParams({
    user_id:`eq.${perfil.owner_id}`,
    id:`eq.${id}`,
    select:'payload,created_at',
    limit:'1'
  })
  const rows=await (await api(`/rest/v1/embrio_backups?${q.toString()}`)).json()
  if(!rows?.[0]?.payload)throw new Error('Backup não encontrado.')
  const db=normalizar(rows[0].payload)
  salvarBanco(db,false)
  setSyncMeta(CLOUD_DIRTY,'1')
  return db
}

export function cloudStatus():CloudStatus{
  const c=getSupabaseConfig(),s=getSession()
  return {
    configured:!!c,
    signedIn:!!s,
    email:s?.user?.email,
    dirty:getSyncMeta(CLOUD_DIRTY)==='1',
    lastSync:getSyncMeta(LAST_SYNC_KEY),
    conflict:getSyncMeta(CLOUD_CONFLICT_KEY)==='1'
  }
}
function toMs(v:string|null|undefined){const n=v?Date.parse(v):0;return Number.isFinite(n)?n:0}

function isMeaningfulLocalData(db:BancoEmbrioGestor){
  return !!(
    db.clientes.length||db.doadoras.length||db.touros.length||db.aspiracoes.length||
    db.producoes.length||db.transferencias.length||db.estoque.length||db.estoqueEmbrioes.length||
    db.movimentacoes.length||db.profissionais.length||db.racas.length||db.servicosSemen.length||
    db.custosProducao.length||(db.relatoriosTransferenciaEditaveis?.length||0)>0
  )
}
const SYNC_SKEW_MS=5000
function hasRealConcurrentChange(dirty:boolean,lastSync:number,remoteTime:number,localChanged:number){
  if(!dirty||!lastSync)return false
  return remoteTime>lastSync+SYNC_SKEW_MS && localChanged>lastSync+SYNC_SKEW_MS
}

export async function resolveInitialSync(localDb:BancoEmbrioGestor,onRemote:(db:BancoEmbrioGestor)=>void){
  if(!navigator.onLine||!getSupabaseConfig()||!getSession())return
  try{
    const perfil=await getMyProfile()
    if(!perfil)return
    const remote=await getRemoteState()
    if(!remote?.payload)return

    // Cliente é somente leitura: a nuvem é sempre a fonte de verdade.
    if(perfil.role==='CLIENTE'){
      removeSyncMeta(CLOUD_CONFLICT_KEY)
      setSyncMeta(CLOUD_DIRTY,'0')
      const pulled=await pullDatabase()
      if(pulled)onRemote(pulled.db)
      return
    }

    const dirty=getSyncMeta(CLOUD_DIRTY)==='1'
    const lastSync=toMs(getSyncMeta(LAST_SYNC_KEY))
    const remoteTime=toMs(remote.updated_at)
    const localChanged=toMs(getSyncMeta(LOCAL_CHANGED_AT))

    if(hasRealConcurrentChange(dirty,lastSync,remoteTime,localChanged)){
      setSyncMeta(CLOUD_CONFLICT_KEY,'1')
      window.dispatchEvent(new CustomEvent('embrio-cloud-status'))
      return
    }
    if(dirty){await pushDatabase(localDb);return}
    if(remoteTime>lastSync){
      const pulled=await pullDatabase()
      if(pulled)onRemote(pulled.db)
    }
  }catch{
    // Falha de rede não impede o uso local.
  }
}

let syncTimer:number|undefined
let autoSyncRunning=false
let latestAutoSyncDb:BancoEmbrioGestor|null=null

async function flushAutoSync(onSynced?:(when:string)=>void){
  if(autoSyncRunning)return
  if(!navigator.onLine||!getSupabaseConfig()||!getSession())return
  if(getSyncMeta(CLOUD_DIRTY)!=='1')return
  if(getSyncMeta(CLOUD_CONFLICT_KEY)==='1')return

  autoSyncRunning=true
  try{
    while(navigator.onLine && getSyncMeta(CLOUD_DIRTY)==='1' && getSyncMeta(CLOUD_CONFLICT_KEY)!=='1'){
      const db=latestAutoSyncDb
      if(!db)break
      await pushDatabase(db)
      onSynced?.(new Date().toISOString())
      // Se houve uma edição durante o envio, pushDatabase mantém dirty=1.
      // O laço então envia imediatamente a versão mais recente.
    }
  }catch{
    // Mantém dirty=1. Uma nova edição, reconexão, foco ou verificação periódica tentará novamente.
  }finally{
    autoSyncRunning=false
  }
}

export function scheduleAutoSync(db:BancoEmbrioGestor,onSynced?:(when:string)=>void){
  latestAutoSyncDb=db
  if(syncTimer)window.clearTimeout(syncTimer)
  if(!navigator.onLine||!getSupabaseConfig()||!getSession())return
  if(getSyncMeta(CLOUD_DIRTY)!=='1')return
  syncTimer=window.setTimeout(()=>{void flushAutoSync(onSynced)},1200)
}

export async function forceUseLocal(db:BancoEmbrioGestor){
  removeSyncMeta(CLOUD_CONFLICT_KEY)
  setSyncMeta(CLOUD_DIRTY,'1')
  return pushDatabase(db)
}
export async function forceUseCloud(){
  removeSyncMeta(CLOUD_CONFLICT_KEY)
  return pullDatabase()
}


export async function checkForRemoteUpdates(
  localDb:BancoEmbrioGestor,
  onRemote:(db:BancoEmbrioGestor)=>void
){
  if(!navigator.onLine||!getSupabaseConfig()||!getSession())return {changed:false}
  try{
    const perfil=await getMyProfile()
    if(!perfil)return {changed:false}
    const remote=await getRemoteState()
    if(!remote?.payload)return {changed:false}

    // Cliente nunca cria conflito: servidor é somente leitura/fonte de verdade.
    if(perfil.role==='CLIENTE'){
      removeSyncMeta(CLOUD_CONFLICT_KEY)
      setSyncMeta(CLOUD_DIRTY,'0')
      const lastSync=toMs(getSyncMeta(LAST_SYNC_KEY))
      if(toMs(remote.updated_at)>lastSync){
        const pulled=await pullDatabase()
        if(pulled){onRemote(pulled.db);return {changed:true}}
      }
      return {changed:false}
    }

    // Conflito antigo no Veterinário não deve bloquear indefinidamente o celular.
    // Se não há alteração local pendente, baixa a nuvem e limpa o conflito.
    const dirty=getSyncMeta(CLOUD_DIRTY)==='1'
    const conflict=getSyncMeta(CLOUD_CONFLICT_KEY)==='1'
    if(perfil.role==='VETERINARIO' && conflict && !dirty){
      removeSyncMeta(CLOUD_CONFLICT_KEY)
      const pulled=await pullDatabase()
      if(pulled){onRemote(pulled.db);return {changed:true}}
    }
    if(conflict)return {changed:false,conflict:true}

    const lastSync=toMs(getSyncMeta(LAST_SYNC_KEY))
    const remoteTime=toMs(remote.updated_at)
    const localChanged=toMs(getSyncMeta(LOCAL_CHANGED_AT))
    if(dirty){
      // Um evento Realtime pode chegar enquanto o próprio aparelho ainda está
      // concluindo um envio anterior. Isso não é conflito entre dispositivos.
      if(autoSyncRunning){
        scheduleAutoSync(localDb)
        return {changed:false}
      }
      if(hasRealConcurrentChange(dirty,lastSync,remoteTime,localChanged)){
        setSyncMeta(CLOUD_CONFLICT_KEY,'1')
        window.dispatchEvent(new CustomEvent('embrio-cloud-status'))
        return {changed:false,conflict:true}
      }
      // Não fica esperando uma nova edição para tentar de novo. Isso é essencial
      // após reconexão, troca de aba ou falha temporária de rede.
      scheduleAutoSync(localDb)
      return {changed:false}
    }
    if(remoteTime>lastSync){
      const pulled=await pullDatabase()
      if(pulled){onRemote(pulled.db);return {changed:true}}
    }
    return {changed:false}
  }catch{return {changed:false}}
}


let realtimeClient:ReturnType<typeof createClient>|null=null
let realtimeChannel:RealtimeChannel|null=null

export async function subscribeRealtimeState(onChange:()=>void){
  if(!navigator.onLine)return ()=>{}
  const c=getSupabaseConfig(), sess=await validSession(), perfil=await getMyProfile()
  if(!c||!sess||!perfil)return ()=>{}
  try{
    if(realtimeChannel&&realtimeClient){
      await realtimeClient.removeChannel(realtimeChannel)
      realtimeChannel=null
    }
    realtimeClient=createClient(c.url,c.anonKey,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      realtime:{params:{eventsPerSecond:10}}
    })
    realtimeClient.realtime.setAuth(sess.access_token)
    realtimeChannel=realtimeClient
      .channel(`embrio-state-${perfil.owner_id}`)
      .on('postgres_changes',{
        event:'*',schema:'public',table:'embrio_app_state',filter:`user_id=eq.${perfil.owner_id}`
      },()=>onChange())
      .subscribe()
    return async()=>{
      try{if(realtimeClient&&realtimeChannel)await realtimeClient.removeChannel(realtimeChannel)}catch{}
      realtimeChannel=null
    }
  }catch{
    return ()=>{}
  }
}


export async function fetchRemoteCompanyIdentity(){
  if(!navigator.onLine||!getSupabaseConfig()||!getSession())return null
  try{
    const remote=await getRemoteState()
    const identidade=remote?.payload?.identidadeEmpresa
    if(identidade&&(identidade.nome||identidade.nomeFantasia||identidade.logoDataUrl)){
      localStorage.setItem('embriogestor2_identidade_publica',JSON.stringify(identidade))
      window.dispatchEvent(new CustomEvent('embrio-company-identity',{detail:identidade}))
      return identidade
    }
  }catch{}
  return null
}

export async function syncNowSafely(localDb:BancoEmbrioGestor,onRemote:(db:BancoEmbrioGestor)=>void){
  if(!navigator.onLine)throw new Error('Sem conexão com a internet.')
  const perfil=await getMyProfile()
  if(!perfil)throw new Error('Perfil de acesso não encontrado.')

  if(perfil.role==='CLIENTE'){
    removeSyncMeta(CLOUD_CONFLICT_KEY);setSyncMeta(CLOUD_DIRTY,'0')
    const pulled=await pullDatabase()
    if(pulled){onRemote(pulled.db);return 'Dados do cliente atualizados da nuvem.'}
    return 'Nenhum dado disponível para este cliente.'
  }

  const st=cloudStatus()
  if(perfil.role==='VETERINARIO' && st.conflict && !st.dirty){
    // No botão manual do celular, a intenção é recuperar o banco mestre.
    // Descarta somente a cópia local conflitante deste login; não toca no banco remoto.
    removeSyncMeta(CLOUD_CONFLICT_KEY);setSyncMeta(CLOUD_DIRTY,'0')
    const pulled=await pullDatabase()
    if(pulled){onRemote(pulled.db);return 'Banco do laboratório atualizado neste aparelho.'}
    throw new Error('Não foi possível baixar o banco do laboratório.')
  }

  if(st.conflict)throw new Error('Há alterações concorrentes. Revise a sincronização no Administrador.')
  if(st.dirty){
    await pushDatabase(localDb,{backup:false})
    return 'Alterações enviadas para a nuvem.'
  }
  const pulled=await pullDatabase()
  if(pulled){onRemote(pulled.db);return 'Banco do laboratório atualizado.'}
  return 'Sincronização conferida.'
}

export async function saveSharedCompanyIdentity(identidade:any,localDb:BancoEmbrioGestor){
  await validSession()
  const perfil=await getMyProfile()
  if(!perfil||perfil.role!=='ADMIN')throw new Error('Somente o administrador pode alterar a identidade da empresa.')
  const remote=await getRemoteState()
  const base=remote?.payload ? normalizar(remote.payload) : localDb
  const merged={...base,identidadeEmpresa:identidade}
  await pushDatabase(merged,{backup:false})
  localStorage.setItem('embriogestor2_identidade_publica',JSON.stringify(identidade))
  window.dispatchEvent(new CustomEvent('embrio-company-identity',{detail:identidade}))
  return merged
}
