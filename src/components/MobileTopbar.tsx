import { useState } from 'react'

export function MobileTopbar({onNavigate,onLogout}:{onNavigate:(id:string)=>void;onLogout:()=>void}){
  const[open,setOpen]=useState(false)
  const items=[
    ['dashboard','Dashboard'],['clientes','Clientes'],['doadoras','Doadoras'],['touros','Touros'],
    ['racas','Raças'],['profissionais','Profissionais'],['estoque','Estoque de Sêmen'],
    ['estoqueEmbrioes','Estoque de Embriões'],['movimentacoes','Movimentações'],
    ['aspiracoes','Aspiração de Oócitos'],['producoes','Produção de Embriões'],
    ['transferencias','Transferência de Embriões'],['analiseTouros','Análise de Touros'],
    ['relatorios','Relatórios'],['custos','Gestão Econômica'],['mapa','Relatório MAPA'],
    ['importar','Importar Dados'],['nuvem','Nuvem / Backup'],['acessos','Usuários & Acessos'],
    ['portalCliente','Portal do Cliente']
  ]
  return <>
    <div className="mobile-bar">
      <button onClick={()=>setOpen(true)} aria-label="Abrir menu">☰</button>
      <div><strong>EmbrioGestor</strong><span>Versão 2.0</span></div>
    </div>
    {open&&<div className="mobile-drawer-backdrop" onClick={()=>setOpen(false)}>
      <aside className="mobile-drawer" onClick={e=>e.stopPropagation()}>
        <div className="mobile-drawer-head">
          <div><strong>EmbrioGestor</strong><span>Menu</span></div>
          <button onClick={()=>setOpen(false)}>✕</button>
        </div>
        <nav>{items.map(([id,label])=><button key={id} onClick={()=>{onNavigate(id);setOpen(false)}}>{label}</button>)}</nav>
        <button className="mobile-logout" onClick={onLogout}>Sair</button>
      </aside>
    </div>}
  </>
}
