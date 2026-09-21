import { useEffect, useState } from 'react'
import type { IdentidadeEmpresa, NivelAcesso, PerfilAcesso } from '../types/domain'
import {
  consumeOAuthSessionFromUrl, fetchRemoteCompanyIdentity,getMyProfile,getSession,getSupabaseConfig,
  signIn,signInWithGoogle,signOutLocal,signUp,oauthDisponivelNesteEndereco,requestPasswordReset,updatePassword
} from '../services/supabaseCloud'

const niveis:{id:NivelAcesso;titulo:string;descricao:string}[]=[
  {id:'ADMIN',titulo:'Administrador',descricao:'Gestão completa do laboratório'},
  {id:'VETERINARIO',titulo:'Veterinário',descricao:'Rotina técnica e reprodutiva'},
  {id:'CLIENTE',titulo:'Cliente',descricao:'Acompanhamento dos próprios animais e resultados'}
]

const identidadePadrao:IdentidadeEmpresa={nome:'SÊMINNA – Laboratório de Reprodução Animal',nomeFantasia:'SÊMINNA'}

function carregarIdentidadePublica():IdentidadeEmpresa{
  try{
    const raw=localStorage.getItem('embriogestor2_identidade_publica')
    if(raw)return {...identidadePadrao,...JSON.parse(raw)}

    // Migração automática: versões 14.13.6/14.13.7 já podem ter a logo
    // dentro do banco do Administrador, mas ainda sem a cópia pública do login.
    const chaves:string[]=[]
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i)||''
      if(k==='embriogestor2_novo'||k.startsWith('embriogestor2_novo_'))chaves.push(k)
    }
    for(const k of chaves){
      try{
        const banco=JSON.parse(localStorage.getItem(k)||'{}')
        const id=banco?.identidadeEmpresa
        if(id&&(id.logoDataUrl||id.nome||id.nomeFantasia)){
          const identidade={...identidadePadrao,...id}
          localStorage.setItem('embriogestor2_identidade_publica',JSON.stringify(identidade))
          return identidade
        }
      }catch{}
    }
    return identidadePadrao
  }catch{return identidadePadrao}
}

export function AuthGate({children}:{children:(perfil:PerfilAcesso)=>React.ReactNode}){
  const[identidade,setIdentidade]=useState<IdentidadeEmpresa>(()=>carregarIdentidadePublica())
  useEffect(()=>{
    const atualizarIdentidade=(ev:Event)=>{
      const detail=(ev as CustomEvent<IdentidadeEmpresa>).detail
      setIdentidade(detail||carregarIdentidadePublica())
    }
    window.addEventListener('embrio-company-identity',atualizarIdentidade)
    return()=>window.removeEventListener('embrio-company-identity',atualizarIdentidade)
  },[])
  const nomeEmpresa=identidade.nomeFantasia||identidade.nome||'SÊMINNA'
  const marca=<>{identidade.logoDataUrl?<img className="access-company-logo" src={identidade.logoDataUrl} alt={`Logo ${nomeEmpresa}`}/>:<div className="access-logo">EG</div>}<div className="access-company-name">{nomeEmpresa}</div></>
  const[perfil,setPerfil]=useState<PerfilAcesso|null>(null)
  const[loading,setLoading]=useState(true)
  const[email,setEmail]=useState('')
  const[senha,setSenha]=useState('')
  const[msg,setMsg]=useState('')
  const[nivelSelecionado,setNivelSelecionado]=useState<NivelAcesso>('ADMIN')
  const[modo,setModo]=useState<'login'|'cadastro'>('login')
  const[nome,setNome]=useState('')
  const[confirmar,setConfirmar]=useState('')
  const[recuperandoSenha,setRecuperandoSenha]=useState(false)
  const[novaSenha,setNovaSenha]=useState('')
  const[confirmarNovaSenha,setConfirmarNovaSenha]=useState('')
  
  async function carregar(){
    setLoading(true)
    try{
      const retorno=await consumeOAuthSessionFromUrl()
      if(retorno?.recovery){
        setPerfil(null)
        setRecuperandoSenha(true)
        return
      }
      await fetchRemoteCompanyIdentity()
      if(getSession()){
        const p=await getMyProfile()
        setPerfil(p)
        if(p?.ativo)fetchRemoteCompanyIdentity().catch(()=>{})
      }
    }catch(e:any){setMsg(e?.message||'Falha ao carregar acesso.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{carregar()},[])

  async function entrar(){
    setMsg('')
    if(!email.trim()||!senha){setMsg('Informe e-mail e senha.');return}
    setLoading(true)
    try{
      await signIn(email.trim(),senha)
      const p=await getMyProfile()
      if(!p){
        setPerfil(null)
        setMsg('Usuário autenticado, mas o perfil de acesso ainda não foi criado.')
        return
      }
      if(!p.ativo){
        setPerfil(p)
        return
      }
      if(p.role!==nivelSelecionado){
        signOutLocal()
        setPerfil(null)
        setMsg(`Este usuário está liberado como ${nomeNivel(p.role)}. Selecione esse nível para entrar.`)
        return
      }
      setPerfil(p)
    }catch(e:any){setMsg(e?.message||'Não foi possível entrar.')}
    finally{setLoading(false)}
  }

  async function esqueciSenha(){
    setMsg('')
    if(!email.trim()){setMsg('Informe seu e-mail acima para recuperar a senha.');return}
    setLoading(true)
    try{
      await requestPasswordReset(email.trim())
      setMsg('Enviamos um link de recuperação para o seu e-mail. Verifique também a caixa de spam.')
    }catch(e:any){setMsg(e?.message||'Não foi possível enviar a recuperação de senha.')}
    finally{setLoading(false)}
  }

  async function salvarNovaSenha(){
    setMsg('')
    if(novaSenha.length<6){setMsg('A nova senha precisa ter pelo menos 6 caracteres.');return}
    if(novaSenha!==confirmarNovaSenha){setMsg('As senhas não conferem.');return}
    setLoading(true)
    try{
      await updatePassword(novaSenha)
      signOutLocal()
      setPerfil(null)
      setRecuperandoSenha(false)
      setNovaSenha('')
      setConfirmarNovaSenha('')
      setMsg('Senha alterada com sucesso. Entre novamente com a nova senha.')
    }catch(e:any){setMsg(e?.message||'Não foi possível alterar a senha.')}
    finally{setLoading(false)}
  }

  async function criar(){
    setMsg('')
    if(!nome.trim()){setMsg('Informe seu nome.');return}
    if(!email.trim()){setMsg('Informe seu e-mail.');return}
    if(senha.length<6){setMsg('A senha precisa ter pelo menos 6 caracteres.');return}
    if(senha!==confirmar){setMsg('As senhas não conferem.');return}
    setLoading(true)
    try{
      const sessao=await signUp(email.trim(),senha,{
        nome:nome.trim(),
        requested_role:nivelSelecionado
      })
      if(sessao){
        const p=await getMyProfile()
        setPerfil(p)
        setMsg('Cadastro enviado. Aguarde a aprovação do administrador.')
      }else{
        setMsg('Cadastro criado. Confirme o e-mail recebido e depois aguarde a aprovação do administrador.')
      }
    }catch(e:any){setMsg(e?.message||'Não foi possível criar a conta.')}
    finally{setLoading(false)}
  }

  function nomeNivel(n:NivelAcesso){
    return niveis.find(x=>x.id===n)?.titulo||n
  }

  if(loading)return <div className="access-screen"><div className="access-card access-loading-brand">{marca}<h1>EmbrioGestor</h1><p>Carregando acesso...</p></div></div>


  if(recuperandoSenha)return <div className="access-screen">
    <div className="access-card">
      <div className="access-company-identity compact">{marca}</div>
      <div className="access-login-kicker">RECUPERAÇÃO DE SENHA</div>
      <h2>Definir nova senha</h2>
      <p>Crie uma nova senha para continuar usando o EmbrioGestor.</p>
      <label>Nova senha<input type="password" value={novaSenha} onChange={e=>setNovaSenha(e.target.value)} /></label>
      <label>Confirmar nova senha<input type="password" value={confirmarNovaSenha} onChange={e=>setConfirmarNovaSenha(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')salvarNovaSenha()}} /></label>
      {msg&&<div className="access-msg">{msg}</div>}
      <button className="access-primary" onClick={salvarNovaSenha}>Salvar nova senha</button>
    </div>
  </div>

  if(!getSession())return <div className="access-screen">
    <div className="access-shell">
      <div className="access-hero">
        <div className="access-company-identity">{marca}</div>
        <div className="access-product-badge">Sistema de gestão reprodutiva</div>
        <h1>EmbrioGestor</h1>
        <p className="access-hero-subtitle">Produção in vitro, estoques, transferências e relatórios em um só lugar.</p>
        <p className="access-mode-hint">{modo==='login'?'Selecione seu nível de acesso.':'Escolha o perfil que deseja solicitar.'}</p>
        <div className="access-levels selectable">
          {niveis.map(n=><button
            type="button"
            key={n.id}
            className={nivelSelecionado===n.id?'selected':''}
            onClick={()=>setNivelSelecionado(n.id)}
          >
            <strong>{n.titulo}</strong>
            <span>{n.descricao}</span>
            {nivelSelecionado===n.id&&<b>Selecionado</b>}
          </button>)}
        </div>
        <div className="access-security-note">
          O nível selecionado não concede permissão automaticamente. Todo novo cadastro precisa ser liberado pelo Administrador.
        </div>
      </div>

      <div className="access-card">
        {modo==='login'?<>
          <div className="access-login-kicker">ACESSO SEGURO</div>
          <h2>Bem-vindo</h2>
          <p>Entrando como <strong>{nomeNivel(nivelSelecionado)}</strong>.</p>
          <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
          <label>Senha<input type="password" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')entrar()}}/></label>
          <button type="button" className="access-link forgot-password" onClick={esqueciSenha}>Esqueci minha senha</button>
          {msg&&<div className="access-msg">{msg}</div>}
          <button className="access-primary" onClick={entrar}>Entrar como {nomeNivel(nivelSelecionado)}</button>
          <button className="access-google" disabled={!oauthDisponivelNesteEndereco()} onClick={async()=>{try{await signInWithGoogle()}catch(e:any){setMsg(e?.message||'Não foi possível entrar com Google.')}}}>Entrar com Google</button>
          {!oauthDisponivelNesteEndereco()&&<small className="oauth-mobile-note">No acesso local pelo celular, entre com e-mail e senha. Google ficará disponível no endereço HTTPS publicado.</small>}
          <button className="access-link" onClick={()=>{setModo('cadastro');setMsg('')}}>Criar novo cadastro</button>
        </>:<>
          <div className="access-login-kicker">NOVO ACESSO</div>
          <h2>Criar cadastro</h2>
          <p>Solicitação para perfil <strong>{nomeNivel(nivelSelecionado)}</strong>.</p>
          <label>Nome completo<input value={nome} onChange={e=>setNome(e.target.value)} /></label>
          <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
          <label>Senha<input type="password" value={senha} onChange={e=>setSenha(e.target.value)} /></label>
          <label>Confirmar senha<input type="password" value={confirmar} onChange={e=>setConfirmar(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')criar()}}/></label>
          {msg&&<div className="access-msg">{msg}</div>}
          <button className="access-primary" onClick={criar}>Solicitar cadastro como {nomeNivel(nivelSelecionado)}</button>
          <button className="access-link" onClick={()=>{setModo('login');setMsg('')}}>Voltar para o login</button>
        </>}
      </div>
    </div>
  </div>

  if(!perfil||!perfil.ativo)return <div className="access-screen"><div className="access-card">
    <div className="access-company-identity compact">{marca}</div>
    <h2>Acesso aguardando liberação</h2>
    <p>Seu cadastro existe, mas ainda precisa ser aprovado pelo administrador do EmbrioGestor.</p>
    {perfil?.requested_role&&<div className="access-msg">Perfil solicitado: <strong>{nomeNivel(perfil.requested_role)}</strong></div>}
    <button className="access-primary" onClick={()=>{signOutLocal();location.reload()}}>Sair</button>
  </div></div>

  return <>{children(perfil)}</>
}
