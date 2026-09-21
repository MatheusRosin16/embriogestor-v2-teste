import { useState } from 'react'
import type { BancoEmbrioGestor } from '../types/domain'
import { SearchBar } from '../components/CrudUI'

export function Carteiras({db}:{db:BancoEmbrioGestor}){
  const[busca,setBusca]=useState('')
  const profissionais=[...db.profissionais].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))

  return <section className="panel">
    <div className="panel-head"><div><h2>Carteiras por Profissional</h2><p>Resumo de atendimentos por profissional.</p></div></div>
    <div className="toolbar"><SearchBar value={busca} onChange={setBusca} placeholder="Pesquisar profissional ou cliente"/></div>

    <div className="folders">
      {profissionais.map(p=>{
        const trans=db.transferencias.filter(t=>t.profissionalId===p.id)
        const clientesIds=[...new Set(trans.map(t=>t.clienteId))]
        const clientes=clientesIds.map(id=>db.clientes.find(c=>c.id===id)).filter(Boolean)
        const q=busca.toLowerCase()
        const vis=!q||String(p.nome+' '+clientes.map(c=>c?.nome).join(' ')).toLowerCase().includes(q)
        if(!vis)return null
        return <details className="folder" key={p.id}>
          <summary>📁 <strong>{p.nome}</strong><span>{clientes.length} cliente(s) • {trans.length} transferência(s)</span></summary>
          <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Transferências</th><th>Última data</th></tr></thead><tbody>
            {clientes.map(c=>{
              const itens=trans.filter(t=>t.clienteId===c!.id)
              const ultima=[...itens].sort((a,b)=>b.data.localeCompare(a.data))[0]
              return <tr key={c!.id}><td><strong>{c!.nome}</strong></td><td>{itens.length}</td><td>{ultima?.data?.split('-').reverse().join('/')||'—'}</td></tr>
            })}
          </tbody></table></div>
        </details>
      })}
      {!profissionais.length&&<div className="note-box">Cadastre profissionais primeiro.</div>}
    </div>
  </section>
}
