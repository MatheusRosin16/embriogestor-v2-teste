import { useEffect, useRef, useState } from 'react'
import { Sidebar, type PageId } from './components/Sidebar'
import { Dashboard, type DashboardFilterState } from './pages/Dashboard'
import { Placeholder } from './pages/Placeholder'
import { Importar } from './pages/Importar'
import { Clientes } from './pages/Clientes'
import { Doadoras } from './pages/Doadoras'
import { Touros } from './pages/Touros'
import { Racas } from './pages/Racas'
import { Aspiracoes } from './pages/Aspiracoes'
import { Producoes, type FiltroDashboardProducoes } from './pages/Producoes'
import { EstoqueSemen } from './pages/EstoqueSemen'
import { EstoqueEmbrioes } from './pages/EstoqueEmbrioes'
import { Movimentacoes } from './pages/Movimentacoes'
import { Transferencias } from './pages/Transferencias'
import { DigitalizarFichaTransferencia } from './pages/DigitalizarFichaTransferencia'
import { Profissionais } from './pages/Profissionais'
import { Relatorios } from './pages/Relatorios'
import { RelatorioTransferenciaEditavel } from './pages/RelatorioTransferenciaEditavel'
import { RelatorioMapa } from './pages/RelatorioMapa'
import { CustosProducao } from './pages/CustosProducao'
import { AnaliseTouros } from './pages/AnaliseTouros'
import { IdentidadeEmpresaPage } from './pages/IdentidadeEmpresa'
import { NuvemBackup } from './pages/NuvemBackup'
import { Acessos } from './pages/Acessos'
import { PortalCliente } from './pages/PortalCliente'
import { AuthGate } from './components/AuthGate'
import { CloudSyncBadge } from './components/CloudSyncBadge'
import { PwaInstallHint } from './components/PwaInstallHint'
import { ativarArmazenamentoUsuario, carregarBanco, salvarBanco } from './store/database'
import type { BancoEmbrioGestor, PerfilAcesso } from './types/domain'
import { checkForRemoteUpdates, resolveInitialSync, scheduleAutoSync, signOutLocal, subscribeRealtimeState, fetchRemoteCompanyIdentity, syncNowSafely } from './services/supabaseCloud'

const meta:Record<PageId,{titulo:string,descricao:string}>={
  dashboard:{titulo:'Dashboard',descricao:'Visão geral do laboratório'},
  clientes:{titulo:'Clientes',descricao:'Pastas individuais e dados cadastrais'},
  doadoras:{titulo:'Doadoras',descricao:'Doadoras organizadas por cliente'},
  touros:{titulo:'Touros',descricao:'Touros, genética e tipo de sêmen'},
  racas:{titulo:'Raças',descricao:'Cadastro e abreviaturas'},
  profissionais:{titulo:'Profissionais',descricao:'Equipe e responsáveis'},
  estoque:{titulo:'Estoque de Sêmen',descricao:'Cadastro de touros e estoque organizados por cliente'},
  estoqueEmbrioes:{titulo:'Estoque de Embriões',descricao:'Embriões DT e VT por cliente'},
  movimentacoes:{titulo:'Movimentações',descricao:'Entradas, saídas e histórico de estoque'},
  aspiracoes:{titulo:'Aspiração de Oócitos',descricao:'OPUs agrupadas por cliente e data'},
  producoes:{titulo:'Produção de Embriões',descricao:'Produções agrupadas por cliente e data'},
  digitalizarFicha:{titulo:'Digitalizar Ficha de TE',descricao:'Foto ou PDF para rascunho editável de transferência'},
  transferencias:{titulo:'Transferência de Embriões',descricao:'Transferências e diagnóstico de gestação'},
  analiseTouros:{titulo:'Análise de Touros',descricao:'Desempenho dos touros na produção'},
  custos:{titulo:'Gestão Econômica da PIVE',descricao:'Custos, eficiência e resultado por embrião'},
  relatorioTransferenciaEditavel:{titulo:'Relatório Transferência Editável',descricao:'Monte a prévia, revise os dados e gere o PDF'},
  relatorios:{titulo:'Relatórios por Cliente',descricao:'Produção, congelamento e transferência'},
  mapa:{titulo:'Relatório Semestral MAPA',descricao:'Relatório oficial semestral'},
  importar:{titulo:'Importar Dados Antigos',descricao:'Migração segura do banco atual'},
  nuvem:{titulo:'Nuvem & Backup',descricao:'Sincronização, backup e funcionamento offline'},
  acessos:{titulo:'Usuários & Níveis de Acesso',descricao:'Administrador, veterinário e cliente'},
  identidadeEmpresa:{titulo:'Identidade da Empresa',descricao:'Logo e dados institucionais usados no sistema e nos relatórios'},
  portalCliente:{titulo:'Portal do Cliente',descricao:'Seus animais, produções e transferências'}
}

function Sistema({perfil}:{perfil:PerfilAcesso}){
  ativarArmazenamentoUsuario(perfil.user_id,perfil.role==='ADMIN')
  const inicial:PageId=perfil.role==='CLIENTE'?'portalCliente':'dashboard'
  const[page,setPage]=useState<PageId>(inicial)
  const[filtroProducoes,setFiltroProducoes]=useState<FiltroDashboardProducoes|null>(null)
  const[db,setDb]=useState<BancoEmbrioGestor>(()=>carregarBanco())
  const[dashboardFilter,setDashboardFilter]=useState<DashboardFilterState>(()=>{
    const mes=String(new Date().getMonth()+1).padStart(2,'0')
    return {periodoRascunho:'ANO',anoRascunho:'',mesRascunho:mes,profissionalRascunho:'TODOS',filtro:{periodo:'ANO',ano:'',mes,profissionalId:'TODOS'}}
  })
  const dbRef=useRef(db)
  const atual=meta[page]

  useEffect(()=>{
    const selecionarZero=(ev:FocusEvent)=>{
      const el=ev.target as HTMLInputElement
      if(el?.tagName==='INPUT' && el.type==='number' && Number(el.value)===0) el.select()
    }
    document.addEventListener('focusin',selecionarZero)
    return()=>document.removeEventListener('focusin',selecionarZero)
  },[])

  function atualizar(novo:BancoEmbrioGestor){
    dbRef.current=novo
    setDb(novo)
    salvarBanco(novo,true)
  }

  function completarAspiracoesAntigas(banco:BancoEmbrioGestor){
    let alterado=false
    const aspiracoes=[...banco.aspiracoes]
    for(const prod of banco.producoes){
      const existe=aspiracoes.some(a=>a.clienteId===prod.clienteId&&a.doadoraId===prod.doadoraId&&a.data===prod.data)
      if(existe)continue
      aspiracoes.push({
        id:`ASP_MIG_${prod.id}`,
        data:prod.data,
        clienteId:prod.clienteId,
        doadoraId:prod.doadoraId,
        grau1:0,grau2:0,grau3:0,grau4:0,grau5:0,
        oocitosTotaisInformados:Number(prod.oocitos)||0,
        oocitosViaveisInformados:Number(prod.oocitosViaveis)||0,
        geradaPelaProducao:true,
        touroId:prod.touroId||'',
        obs:'Aspiração gerada automaticamente a partir de produção já existente.'
      })
      alterado=true
    }
    return alterado?{...banco,aspiracoes}:banco
  }

  function aplicarRemoto(novo:BancoEmbrioGestor){
    if(novo.identidadeEmpresa){
      localStorage.setItem('embriogestor2_identidade_publica',JSON.stringify(novo.identidadeEmpresa))
      window.dispatchEvent(new CustomEvent('embrio-company-identity',{detail:novo.identidadeEmpresa}))
    }
    const completo=completarAspiracoesAntigas(novo)
    dbRef.current=completo
    setDb(completo)
    // Se a migração criou OPUs, marca como alteração local para sincronizar com a nuvem.
    salvarBanco(completo,completo!==novo)
  }

  useEffect(()=>{
    const completo=completarAspiracoesAntigas(dbRef.current)
    if(completo!==dbRef.current){
      dbRef.current=completo
      setDb(completo)
      salvarBanco(completo,true)
    }
    // executa uma vez para regularizar produções antigas sem OPU
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  function navegar(pageId:PageId){
    setFiltroProducoes(null)
    setPage(pageId)
  }

  function abrirProducaoDashboard(clienteId:string,data:string){
    setFiltroProducoes({modo:'SERVICO',clienteId,data:String(data||'').slice(0,10)})
    setPage('producoes')
  }

  function abrirMesDashboard(ano:string,mes:string){
    setFiltroProducoes({modo:'MES',ano,mes})
    setPage('producoes')
  }

  useEffect(()=>{
    resolveInitialSync(db,aplicarRemoto).then(()=>fetchRemoteCompanyIdentity())
    const onOnline=()=>resolveInitialSync(dbRef.current,aplicarRemoto).then(()=>fetchRemoteCompanyIdentity())
    window.addEventListener('online',onOnline)
    return()=>window.removeEventListener('online',onOnline)
    // inicializa uma vez; alterações subsequentes entram no autosync abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  useEffect(()=>{
    dbRef.current=db
    scheduleAutoSync(db)
  },[db])

  // Mantém os outros dispositivos atualizados sem precisar recarregar a página.
  // Quando não existem alterações locais pendentes, consulta a nuvem a cada 20 s.
  useEffect(()=>{
    const conferir=()=>checkForRemoteUpdates(dbRef.current,aplicarRemoto)
    const timer=window.setInterval(conferir,5000)
    const onFocus=()=>conferir()
    const onVisibility=()=>{if(document.visibilityState==='visible')conferir()}
    window.addEventListener('focus',onFocus)
    document.addEventListener('visibilitychange',onVisibility)
    return()=>{
      window.clearInterval(timer)
      window.removeEventListener('focus',onFocus)
      document.removeEventListener('visibilitychange',onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  useEffect(()=>{
    let stop:(()=>void)|undefined
    subscribeRealtimeState(()=>checkForRemoteUpdates(dbRef.current,aplicarRemoto)).then(fn=>{stop=fn})
    const onOnline=()=>subscribeRealtimeState(()=>checkForRemoteUpdates(dbRef.current,aplicarRemoto)).then(fn=>{stop?.();stop=fn})
    window.addEventListener('online',onOnline)
    return()=>{window.removeEventListener('online',onOnline);stop?.()}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  let body
  if(page==='dashboard') body=<Dashboard db={db} onNavigate={navegar} onOpenProduction={abrirProducaoDashboard} onOpenMonth={abrirMesDashboard} filterState={dashboardFilter} onFilterStateChange={setDashboardFilter}/>
  else if(page==='clientes') body=<Clientes db={db} onChange={atualizar}/>
  else if(page==='doadoras') body=<Doadoras db={db} onChange={atualizar}/>
  else if(page==='touros') body=<Touros db={db} onChange={atualizar}/>
  else if(page==='racas') body=<Racas db={db} onChange={atualizar}/>
  else if(page==='aspiracoes') body=<Aspiracoes db={db} onChange={atualizar}/>
  else if(page==='producoes') body=<Producoes db={db} onChange={atualizar} filtroInicial={filtroProducoes}/>
  else if(page==='estoque') body=<EstoqueSemen db={db} onChange={atualizar}/>
  else if(page==='estoqueEmbrioes') body=<EstoqueEmbrioes db={db} onChange={atualizar}/>
  else if(page==='movimentacoes') body=<Movimentacoes db={db}/>
  else if(page==='transferencias') body=<Transferencias db={db} onChange={atualizar}/>
  else if(page==='digitalizarFicha') body=<DigitalizarFichaTransferencia db={db} onChange={atualizar} onAbrirRelatorio={()=>navegar('relatorioTransferenciaEditavel')}/>
  else if(page==='profissionais') body=<Profissionais db={db} onChange={atualizar}/>
  else if(page==='relatorioTransferenciaEditavel') body=<RelatorioTransferenciaEditavel db={db} onChange={atualizar}/>
  else if(page==='relatorios') body=<Relatorios db={db}/>
  else if(page==='mapa') body=<RelatorioMapa db={db}/>
  else if(page==='custos') body=<CustosProducao db={db} onChange={atualizar}/>
  else if(page==='analiseTouros') body=<AnaliseTouros db={db}/>
  else if(page==='importar') body=<Importar onImportar={atualizar}/>
  else if(page==='nuvem'&&perfil.role==='ADMIN') body=<NuvemBackup db={db} onChange={atualizar} onCloudChange={aplicarRemoto}/>
  else if(page==='acessos'&&perfil.role==='ADMIN') body=<Acessos db={db}/>
  else if(page==='identidadeEmpresa'&&perfil.role==='ADMIN') body=<IdentidadeEmpresaPage db={db} onChange={atualizar}/>
  else if(page==='portalCliente'&&perfil.role==='CLIENTE') body=<PortalCliente db={db} perfil={perfil}/>
  else body=<Placeholder titulo={atual.titulo} descricao={atual.descricao}/>

  function sair(){
    signOutLocal()
    window.location.reload()
  }

  return <div className="app">
    <PwaInstallHint/>
    <Sidebar page={page} onChange={navegar} role={perfil.role} onLogout={sair} identidade={db.identidadeEmpresa}/>
    <main className="main">
      <header className="topbar">
        <div><h1>{atual.titulo}</h1><p>{atual.descricao}</p></div>
        <div className="topbar-sync"><CloudSyncBadge role={perfil.role} db={db} onSync={async()=>{try{const msg=await syncNowSafely(dbRef.current,aplicarRemoto); if(msg)alert(msg)}catch(e:any){alert(e?.message||'Não foi possível sincronizar.')}}}/><span className="status">EmbrioGestor 2.0 — Fase 14.16.2</span></div>
      </header>
      <div className="content">{body}</div>
    </main>
  </div>
}


export default function App(){
  if(typeof window!=='undefined' && window.location.search.includes('error=')){
    window.history.replaceState({},document.title,window.location.pathname)
  }
  return <AuthGate>{perfil=><Sistema perfil={perfil}/>}</AuthGate>
}
