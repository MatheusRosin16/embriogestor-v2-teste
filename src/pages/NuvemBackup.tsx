import { useEffect, useRef, useState } from 'react'
import type { BancoEmbrioGestor } from '../types/domain'
import { normalizar } from '../store/database'
import { CLOUD_CONFIG } from '../config/cloud'
import {
  CLOUD_CONFLICT_KEY, cloudStatus, createDailyBackup, forceUseCloud, forceUseLocal,
  getSupabaseConfig, listBackups, pullDatabase, pushDatabase, restoreBackup,
  saveSupabaseConfig, signIn, signOutLocal, signUp
} from '../services/supabaseCloud'

declare global { interface Window { google?: any } }

type DriveFile={id:string,name:string,modifiedTime?:string,size?:string}
type BackupRow={id:string|number,created_at:string,source?:string}
const DRIVE_TOKEN_KEY='embriogestor2_drive_token_session'
const DRIVE_LAST_BACKUP='embriogestor2_drive_ultimo_backup'
const DRIVE_AUTO_DAY='embriogestor2_drive_auto_day'

function agoraArquivo(){
  const d=new Date(),p=(n:number)=>String(n).padStart(2,'0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}
function pacoteBackup(db:BancoEmbrioGestor){
  return {formato:'EmbrioGestorBackup',versaoPacote:2,exportadoEm:new Date().toISOString(),banco:db}
}
function formatarData(v:string|null|undefined){
  if(!v)return 'Nenhuma'
  try{return new Date(v).toLocaleString('pt-BR')}catch{return v}
}

export function NuvemBackup({
  db,onChange,onCloudChange
}:{
  db:BancoEmbrioGestor
  onChange:(db:BancoEmbrioGestor)=>void
  onCloudChange:(db:BancoEmbrioGestor)=>void
}){
  const[cloud,setCloud]=useState(cloudStatus())
  const[cfg,setCfg]=useState(()=>getSupabaseConfig()||{url:'',anonKey:''})
  const[email,setEmail]=useState('')
  const[senha,setSenha]=useState('')
  const[msg,setMsg]=useState('O sistema salva localmente imediatamente e sincroniza automaticamente quando a nuvem estiver configurada.')
  const[busy,setBusy]=useState(false)
  const[backups,setBackups]=useState<BackupRow[]>([])
  const[driveToken,setDriveToken]=useState(sessionStorage.getItem(DRIVE_TOKEN_KEY)||'')
  const[driveFiles,setDriveFiles]=useState<DriveFile[]>([])
  const tokenClient=useRef<any>(null)
  const fileInput=useRef<HTMLInputElement>(null)

  function refresh(){setCloud(cloudStatus())}
  useEffect(()=>{
    const h=()=>refresh()
    window.addEventListener('embrio-cloud-status',h)
    window.addEventListener('embrio-local-change',h)
    return()=>{window.removeEventListener('embrio-cloud-status',h);window.removeEventListener('embrio-local-change',h)}
  },[])

  useEffect(()=>{
    if(window.google?.accounts?.oauth2||document.getElementById('eg-google-gsi'))return
    const s=document.createElement('script');s.id='eg-google-gsi';s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true
    document.head.appendChild(s)
  },[])

  // Backup automático diário no Drive, enquanto a sessão Google estiver válida.
  useEffect(()=>{
    if(!driveToken||!navigator.onLine)return
    const today=new Date().toISOString().slice(0,10)
    if(sessionStorage.getItem(DRIVE_AUTO_DAY)===today)return
    const t=window.setTimeout(()=>criarBackupDrive(true).catch(()=>{}),8000)
    return()=>window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[driveToken,cloud.lastSync])

  function salvarConfig(){
    if(!cfg.url.trim()||!cfg.anonKey.trim())return setMsg('Informe a Project URL e a chave pública/anon do Supabase.')
    saveSupabaseConfig(cfg)
    setMsg('Configuração do Supabase salva neste aparelho.')
    refresh()
  }
  async function entrar(){
    setBusy(true)
    try{
      await signIn(email.trim(),senha)
      setSenha('');setMsg('Nuvem conectada. A sincronização automática está ativa.');refresh()
      const p=await pullDatabase().catch(()=>null)
      if(p&&confirm('Existe um banco salvo na nuvem. Deseja carregar os dados da nuvem neste aparelho agora?'))onCloudChange(p.db)
    }catch(e:any){setMsg(e?.message||'Erro ao entrar.')}
    finally{setBusy(false)}
  }
  async function criarConta(){
    setBusy(true)
    try{
      const s=await signUp(email.trim(),senha)
      setSenha('')
      setMsg(s?'Conta criada e conectada.':'Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.')
      refresh()
    }catch(e:any){setMsg(e?.message||'Erro ao criar conta.')}
    finally{setBusy(false)}
  }
  async function enviarAgora(){
    setBusy(true)
    try{await pushDatabase(db,{backup:true});setMsg('Dados sincronizados com o Supabase.');refresh()}
    catch(e:any){setMsg(e?.message||'Falha ao sincronizar.')}
    finally{setBusy(false)}
  }
  async function carregarAgora(){
    if(!confirm('Carregar a nuvem substituirá os dados locais atuais. Continuar?'))return
    setBusy(true)
    try{
      const p=await pullDatabase()
      if(!p)throw new Error('Ainda não existe banco salvo na nuvem.')
      onCloudChange(p.db);setMsg('Dados da nuvem carregados.');refresh()
    }catch(e:any){setMsg(e?.message||'Falha ao carregar.')}
    finally{setBusy(false)}
  }
  async function carregarBackups(){
    try{setBackups(await listBackups())}catch(e:any){setMsg(e?.message||'Não foi possível listar backups.')}
  }
  async function restaurarSupabase(id:string|number){
    if(!confirm('Restaurar este backup? Os dados locais atuais serão substituídos.'))return
    try{
      const novo=await restoreBackup(id)
      onCloudChange(novo)
      await pushDatabase(novo,{backup:false})
      setMsg('Backup restaurado e sincronizado.');refresh()
    }catch(e:any){setMsg(e?.message||'Falha ao restaurar.')}
  }
  async function backupAgora(){
    try{await createDailyBackup(db,true);setMsg('Backup extra criado no Supabase.');await carregarBackups()}
    catch(e:any){setMsg(e?.message||'Falha ao criar backup.')}
  }
  async function resolverConflito(usar:'local'|'cloud'){
    if(usar==='local'){
      if(!confirm('Usar os dados deste aparelho e substituir a versão da nuvem?'))return
      await forceUseLocal(db);setMsg('Versão local enviada para a nuvem.')
    }else{
      if(!confirm('Usar os dados da nuvem e substituir os dados deste aparelho?'))return
      const p=await forceUseCloud();if(p)onCloudChange(p.db);setMsg('Versão da nuvem carregada.')
    }
    refresh()
  }

  async function conectarDrive(){
    try{
      if(!window.google?.accounts?.oauth2)throw new Error('O login do Google ainda não carregou.')
      tokenClient.current=window.google.accounts.oauth2.initTokenClient({
        client_id:CLOUD_CONFIG.GOOGLE_CLIENT_ID,
        scope:'https://www.googleapis.com/auth/drive.file',
        callback:(resp:any)=>{
          if(resp?.access_token){
            sessionStorage.setItem(DRIVE_TOKEN_KEY,resp.access_token);setDriveToken(resp.access_token)
            setMsg('Google Drive conectado para backup adicional.')
          }else setMsg('Não foi possível conectar ao Google Drive.')
        }
      })
      tokenClient.current.requestAccessToken({prompt:'consent'})
    }catch(e:any){setMsg(e?.message||'Erro ao conectar Google Drive.')}
  }
  async function driveFetch(url:string,options:RequestInit={}){
    if(!driveToken)throw new Error('Conecte o Google Drive primeiro.')
    const h=new Headers(options.headers||{});h.set('Authorization',`Bearer ${driveToken}`)
    const r=await fetch(url,{...options,headers:h})
    if(r.status===401){
      sessionStorage.removeItem(DRIVE_TOKEN_KEY);setDriveToken('')
      throw new Error('A sessão do Google Drive expirou. Conecte novamente.')
    }
    if(!r.ok)throw new Error(`Google Drive: erro ${r.status}`)
    return r
  }
  async function obterPasta(){
    const q=`mimeType='application/vnd.google-apps.folder' and name='${CLOUD_CONFIG.DRIVE_FOLDER_NAME}' and trashed=false`
    const data=await (await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)&pageSize=10`)).json()
    if(data.files?.length)return data.files[0].id
    const c=await (await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:CLOUD_CONFIG.DRIVE_FOLDER_NAME,mimeType:'application/vnd.google-apps.folder'})
    })).json()
    return c.id
  }
  async function uploadDrive(nome:string,conteudo:string,pastaId:string){
    const boundary='eg_'+Math.random().toString(36).slice(2)
    const blob=new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name:nome,parents:[pastaId]})}\r\n`,
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${conteudo}\r\n--${boundary}--`
    ],{type:`multipart/related; boundary=${boundary}`})
    return (await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',{
      method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body:blob
    })).json()
  }
  async function criarBackupDrive(auto=false){
    const pasta=await obterPasta()
    const nome=`${CLOUD_CONFIG.BACKUP_PREFIX}${agoraArquivo()}.json`
    await uploadDrive(nome,JSON.stringify(pacoteBackup(db),null,2),pasta)
    localStorage.setItem(DRIVE_LAST_BACKUP,new Date().toISOString())
    if(auto)sessionStorage.setItem(DRIVE_AUTO_DAY,new Date().toISOString().slice(0,10))
    setMsg(auto?'Backup diário adicional salvo no Google Drive.':`Backup salvo no Google Drive: ${nome}`)
  }
  async function listarDrive(){
    try{
      const pasta=await obterPasta()
      const q=`name contains '${CLOUD_CONFIG.BACKUP_PREFIX}' and '${pasta}' in parents and trashed=false`
      const d=await (await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=20`)).json()
      setDriveFiles(d.files||[])
    }catch(e:any){setMsg(e?.message||'Falha ao listar Drive.')}
  }
  async function restaurarDrive(f:DriveFile){
    if(!confirm(`Restaurar ${f.name}?`))return
    try{
      const data=await (await driveFetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).json()
      const novo=normalizar(data?.banco||data)
      onChange(novo);setMsg('Backup do Google Drive importado. A sincronização automática enviará esta versão ao Supabase.')
    }catch(e:any){setMsg(e?.message||'Falha ao restaurar Drive.')}
  }

  function baixarLocal(){
    const blob=new Blob([JSON.stringify(pacoteBackup(db),null,2)],{type:'application/json'})
    const u=URL.createObjectURL(blob),a=document.createElement('a')
    a.href=u;a.download=`EmbrioGestor_Backup_${agoraArquivo()}.json`;a.click();URL.revokeObjectURL(u)
  }
  async function importarLocal(file:File){
    try{
      const data=JSON.parse(await file.text()),novo=normalizar(data?.banco||data)
      if(confirm('Importar este arquivo e substituir os dados locais?')){onChange(novo);setMsg('Arquivo importado. A nuvem será atualizada automaticamente.')}
    }catch{setMsg('Arquivo de backup inválido.')}
  }

  return <section>
    <div className="page-title-block">
      <h2>Nuvem & Backup</h2>
      <p>Supabase como nuvem principal + Google Drive como cópia adicional de segurança.</p>
    </div>

    <div className={`cloud-status ${cloud.conflict?'erro':cloud.signedIn?'ok':'info'}`}>
      <strong>{cloud.conflict?'Conflito de sincronização':cloud.signedIn?'Sincronização automática ativa':'Modo local ativo'}</strong>
      <span>{msg}</span>
    </div>

    {cloud.conflict&&<div className="panel cloud-conflict">
      <h3>Existem alterações diferentes neste aparelho e na nuvem</h3>
      <p>Para sua segurança, o EmbrioGestor não sobrescreveu nenhum dos dois automaticamente.</p>
      <div className="cloud-actions">
        <button className="btn primary" onClick={()=>resolverConflito('local')}>Manter este aparelho</button>
        <button className="btn" onClick={()=>resolverConflito('cloud')}>Usar versão da nuvem</button>
      </div>
    </div>}

    <div className="cloud-grid">
      <div className="panel">
        <div className="panel-head"><div><h3>1. Supabase — nuvem principal</h3><p>Salvamento automático após cada alteração.</p></div><span className={`cloud-pill ${cloud.signedIn?'ok':''}`}>{cloud.signedIn?'● Conectado':'○ Desconectado'}</span></div>

        {!cloud.configured&&<div className="cloud-setup">
          <label><span>Project URL</span><input placeholder="https://xxxx.supabase.co" value={cfg.url} onChange={e=>setCfg({...cfg,url:e.target.value})}/></label>
          <label><span>Chave pública / anon</span><input type="password" placeholder="sb_publishable_... ou anon key" value={cfg.anonKey} onChange={e=>setCfg({...cfg,anonKey:e.target.value})}/></label>
          <button className="btn primary" onClick={salvarConfig}>Salvar configuração</button>
        </div>}

        {cloud.configured&&!cloud.signedIn&&<div className="cloud-setup">
          <label><span>E-mail do administrador</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
          <label><span>Senha</span><input type="password" value={senha} onChange={e=>setSenha(e.target.value)}/></label>
          <div className="cloud-actions"><button className="btn primary" disabled={busy} onClick={entrar}>Entrar</button><button className="btn" disabled={busy} onClick={criarConta}>Criar conta</button></div>
        </div>}

        {cloud.signedIn&&<>
          <div className="cloud-kv"><span>Administrador</span><strong>{cloud.email||'Conectado'}</strong></div>
          <div className="cloud-kv"><span>Estado local</span><strong>{cloud.dirty?'Aguardando sincronização':'Sincronizado'}</strong></div>
          <div className="cloud-kv"><span>Última sincronização</span><strong>{formatarData(cloud.lastSync)}</strong></div>
          <div className="cloud-actions">
            <button className="btn primary" disabled={busy} onClick={enviarAgora}>Sincronizar agora</button>
            <button className="btn" disabled={busy} onClick={carregarAgora}>Carregar da nuvem</button>
            <button className="btn" onClick={()=>{signOutLocal();refresh();setMsg('Sessão da nuvem encerrada. Os dados locais continuam disponíveis.')}}>Sair da nuvem</button>
          </div>
          <div className="note-box">Depois de uma alteração, o EmbrioGestor salva localmente na hora e tenta sincronizar com o Supabase em aproximadamente 5 segundos.</div>
        </>}
      </div>

      <div className="panel">
        <div className="panel-head"><div><h3>2. Backups automáticos no Supabase</h3><p>Uma cópia histórica diária, além do banco principal.</p></div></div>
        <div className="cloud-kv"><span>Política</span><strong>1 backup/dia</strong></div>
        <div className="cloud-kv"><span>Offline</span><strong>Continua salvando local</strong></div>
        <div className="cloud-actions"><button className="btn primary" disabled={!cloud.signedIn} onClick={backupAgora}>Criar backup extra agora</button><button className="btn" disabled={!cloud.signedIn} onClick={carregarBackups}>Ver backups</button></div>
        <div className="cloud-backup-list">{backups.map(b=><div className="cloud-backup-row" key={String(b.id)}><div><strong>Backup {b.source||'AUTO'}</strong><small>{formatarData(b.created_at)}</small></div><button className="btn small" onClick={()=>restaurarSupabase(b.id)}>Restaurar</button></div>)}</div>
      </div>
    </div>

    <div className="panel">
      <div className="panel-head"><div><h3>3. Google Drive — backup adicional</h3><p>Segunda cópia fora do Supabase. O backup diário é tentado automaticamente enquanto a sessão Google estiver válida.</p></div><span className={`cloud-pill ${driveToken?'ok':''}`}>{driveToken?'● Conectado':'○ Desconectado'}</span></div>
      <div className="cloud-kv"><span>Último backup Drive</span><strong>{formatarData(localStorage.getItem(DRIVE_LAST_BACKUP))}</strong></div>
      <div className="cloud-actions">
        <button className="btn primary" onClick={conectarDrive}>{driveToken?'Reconectar Google Drive':'Conectar Google Drive'}</button>
        <button className="btn" disabled={!driveToken} onClick={()=>criarBackupDrive(false)}>Backup Drive agora</button>
        <button className="btn" disabled={!driveToken} onClick={listarDrive}>Listar backups</button>
      </div>
      {!driveToken&&<div className="cloud-warning">O Google exige autorização OAuth. Se aparecer “origin_mismatch”, será necessário cadastrar a origem do EmbrioGestor no Google Cloud. Isso não afeta o Supabase nem o salvamento local.</div>}
      <div className="cloud-backup-list">{driveFiles.map(f=><div className="cloud-backup-row" key={f.id}><div><strong>{f.name}</strong><small>{formatarData(f.modifiedTime)}</small></div><button className="btn small" onClick={()=>restaurarDrive(f)}>Restaurar</button></div>)}</div>
    </div>

    <div className="panel">
      <div className="panel-head"><div><h3>4. Cópia local manual</h3><p>Última camada de segurança em arquivo JSON.</p></div></div>
      <div className="cloud-actions">
        <button className="btn primary" onClick={baixarLocal}>Baixar backup local</button>
        <button className="btn" onClick={()=>fileInput.current?.click()}>Importar backup local</button>
        <input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)importarLocal(f);e.currentTarget.value=''}}/>
      </div>
    </div>
  </section>
}
