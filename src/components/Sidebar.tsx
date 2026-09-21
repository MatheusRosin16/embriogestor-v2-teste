import { useState } from 'react'
import type { IdentidadeEmpresa, NivelAcesso } from '../types/domain'

export type PageId =
  | 'dashboard'
  | 'clientes'
  | 'doadoras'
  | 'touros'
  | 'racas'
  | 'profissionais'
  | 'estoque'
  | 'estoqueEmbrioes'
  | 'movimentacoes'
  | 'aspiracoes'
  | 'producoes'
  | 'transferencias'
  | 'digitalizarFicha'
  | 'analiseTouros'
  | 'custos'
  | 'relatorioTransferenciaEditavel'
  | 'relatorios'
  | 'mapa'
  | 'importar'
  | 'nuvem'
  | 'acessos'
  | 'identidadeEmpresa'
  | 'portalCliente'

const itens: {id: PageId; nome: string; icone: string}[] = [
  {id:'dashboard', nome:'Dashboard', icone:'⌂'},
  {id:'clientes', nome:'Clientes', icone:'C'},
  {id:'doadoras', nome:'Doadoras', icone:'D'},
  {id:'racas', nome:'Raças', icone:'R'},
  {id:'profissionais', nome:'Profissionais', icone:'P'},
  {id:'estoque', nome:'Estoque de Sêmen', icone:'S'},
  {id:'estoqueEmbrioes', nome:'Estoque de Embriões', icone:'E'},
  {id:'movimentacoes', nome:'Movimentações', icone:'↔'},
  {id:'aspiracoes', nome:'Aspiração de Oócitos', icone:'O'},
  {id:'producoes', nome:'Produção de Embriões', icone:'◎'},
  {id:'transferencias', nome:'Transferência de Embriões', icone:'→'},
  {id:'digitalizarFicha', nome:'Digitalizar Ficha de TE', icone:'▣'},
  {id:'analiseTouros', nome:'Análise de Touros', icone:'A'},
  {id:'custos', nome:'Gestão Econômica', icone:'$'},
  {id:'relatorioTransferenciaEditavel', nome:'Relatório Transferência Editável', icone:'▤'},
  {id:'relatorios', nome:'Relatórios por Cliente', icone:'≡'},
  {id:'mapa', nome:'Relatório Semestral MAPA', icone:'M'},
  {id:'importar', nome:'Importar Dados Antigos', icone:'↑'},
  {id:'nuvem', nome:'Nuvem & Backup', icone:'☁'},
  {id:'acessos', nome:'Usuários & Acessos', icone:'U'},
  {id:'identidadeEmpresa', nome:'Identidade da Empresa', icone:'ID'},
  {id:'portalCliente', nome:'Portal do Cliente', icone:'◉'}
]

export function Sidebar({
  page,
  onChange,
  role,
  onLogout,
  identidade
}: {
  page: PageId
  onChange: (page: PageId) => void
  role: NivelAcesso
  onLogout: () => void
  identidade?: IdentidadeEmpresa
}) {
  const [aberto,setAberto] = useState(false)

  const permitidos:Record<NivelAcesso,PageId[]>={
    ADMIN:['dashboard','clientes','doadoras','touros','racas','profissionais','estoque','estoqueEmbrioes','movimentacoes','aspiracoes','producoes','transferencias','digitalizarFicha','analiseTouros','custos','relatorioTransferenciaEditavel','relatorios','mapa','importar','nuvem','acessos','identidadeEmpresa'],
    VETERINARIO:['dashboard','clientes','doadoras','touros','racas','profissionais','estoque','estoqueEmbrioes','movimentacoes','aspiracoes','producoes','transferencias','digitalizarFicha','analiseTouros','relatorioTransferenciaEditavel','relatorios'],
    CLIENTE:['portalCliente']
  }
  const visiveis=itens.filter(i=>permitidos[role].includes(i.id))

  return (
    <>
      <header className="mobile-app-header">
        <button className="mobile-menu" onClick={()=>setAberto(true)} aria-label="Abrir menu">☰</button>
        <div className="mobile-app-logo">{identidade?.logoDataUrl?<img src={identidade.logoDataUrl} alt="Logo"/>:'EG'}</div>
        <div className="mobile-app-brand">
          <strong>EmbrioGestor</strong>
          <small>{identidade?.nomeFantasia||identidade?.nome|| (role==='ADMIN'?'Administrador':role==='VETERINARIO'?'Veterinário':'Cliente')}</small>
        </div>
      </header>

      {aberto && <div className="overlay" onClick={()=>setAberto(false)} />}

      <aside className={`sidebar ${aberto ? 'show' : ''}`}>
        <div className="brand">
          <div className="brand-logo">{identidade?.logoDataUrl?<img src={identidade.logoDataUrl} alt="Logo da empresa"/>:'EG'}</div>
          <div className="brand-text">
            <strong>EmbrioGestor</strong>
            <small>{identidade?.nomeFantasia||identidade?.nome|| (role==='ADMIN'?'Administrador':role==='VETERINARIO'?'Veterinário':'Cliente')}</small>
          </div>
          <button className="close-menu" onClick={()=>setAberto(false)} aria-label="Fechar menu">×</button>
        </div>

        <nav>
          {visiveis.map(item=>(
            <button
              key={item.id}
              className={page===item.id ? 'active' : ''}
              onClick={()=>{
                onChange(item.id)
                setAberto(false)
              }}
            >
              <span className="menu-icon">{item.icone}</span>
              <span>{item.nome}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-logout">
          <button
            className="logout-button"
            onClick={()=>{
              setAberto(false)
              onLogout()
            }}
          >
            <span className="menu-icon">↪</span>
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  )
}
