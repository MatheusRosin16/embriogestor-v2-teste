import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor, Cliente } from '../types/domain'
import { Field, Modal } from '../components/CrudUI'
import { handleEnterFlow } from '../components/EnterFlow'
import { clientesDoTouro, touroDoCliente } from '../services/tourosClientes'

const vazio:Cliente={id:'',nome:'',cpf:'',propriedade:'',municipio:'',uf:'',telefone:'',email:''}
const id=()=> 'CLI_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)

function iniciais(nome:string){
  const partes=nome.trim().split(/\s+/).filter(Boolean)
  if(!partes.length)return 'CL'
  return ((partes[0]?.[0]||'')+(partes.length>1?(partes[partes.length-1]?.[0]||''):'')).toUpperCase()
}

export function Clientes({db,onChange}:{db:BancoEmbrioGestor,onChange:(db:BancoEmbrioGestor)=>void}){
  const[busca,setBusca]=useState('')
  const[edit,setEdit]=useState<Cliente|null>(null)

  const doadorasPorCliente=useMemo(()=>{
    const mapa=new Map<string,number>()
    db.doadoras.forEach(d=>mapa.set(d.clienteId,(mapa.get(d.clienteId)||0)+1))
    return mapa
  },[db.doadoras])

  const tourosPorCliente=useMemo(()=>{
    const mapa=new Map<string,number>()
    db.clientes.forEach(c=>mapa.set(c.id,0))
    db.touros.forEach(t=>clientesDoTouro(t).forEach(cid=>mapa.set(cid,(mapa.get(cid)||0)+1)))
    return mapa
  },[db.touros,db.clientes])

  const lista=useMemo(()=>db.clientes.filter(c=>{
    const t=busca.trim().toLowerCase()
    return !t||[c.nome,c.cpf,c.propriedade,c.municipio,c.uf,c.telefone,c.email].some(v=>String(v||'').toLowerCase().includes(t))
  }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')),[db.clientes,busca])

  function salvar(c:Cliente){
    if(!c.nome.trim()) return alert('Informe o nome do cliente.')
    const clientes=c.id?db.clientes.map(x=>x.id===c.id?c:x):[...db.clientes,{...c,id:id()}]
    onChange({...db,clientes})
    setEdit(null)
  }

  function excluir(cid:string){
    if(!confirm('Excluir este cliente e os cadastros vinculados de doadoras/touros?'))return
    onChange({
      ...db,
      clientes:db.clientes.filter(x=>x.id!==cid),
      doadoras:db.doadoras.filter(x=>x.clienteId!==cid),
      touros:db.touros.map(x=>{
        if(!touroDoCliente(x,cid))return x
        const ids=clientesDoTouro(x).filter(id=>id!==cid)
        return {...x,clienteIds:ids,clienteId:ids[0]||''}
      })
    })
  }

  return <section className="panel clients-page">
    <div className="clients-hero">
      <div>
        <div className="clients-eyebrow">CADASTRO E CARTEIRA</div>
        <h2>Clientes</h2>
        <p>Consulte os dados cadastrais e acompanhe a carteira de animais de cada cliente.</p>
      </div>
      <button className="btn primary clients-new-btn" onClick={()=>setEdit({...vazio})}>+ Novo cliente</button>
    </div>

    <div className="clients-kpis" aria-label="Resumo de clientes">
      <div className="clients-kpi"><span>Clientes cadastrados</span><strong>{db.clientes.length}</strong><small>Total no sistema</small></div>
      <div className="clients-kpi"><span>Doadoras vinculadas</span><strong>{db.doadoras.length}</strong><small>Em todas as carteiras</small></div>
      <div className="clients-kpi"><span>Touros cadastrados</span><strong>{db.touros.length}</strong><small>Cadastro genético único</small></div>
      <div className="clients-kpi"><span>Resultados</span><strong>{lista.length}</strong><small>{busca?'Conforme a pesquisa':'Clientes exibidos'}</small></div>
    </div>

    <div className="clients-toolbar">
      <div className="clients-search-wrap">
        <span className="clients-search-icon" aria-hidden="true">⌕</span>
        <input
          className="clients-search"
          value={busca}
          onChange={e=>setBusca(e.target.value)}
          placeholder="Buscar por cliente, propriedade, município, CPF/CNPJ ou contato"
          aria-label="Buscar clientes"
        />
        {busca&&<button className="clients-clear-search" onClick={()=>setBusca('')} title="Limpar busca" aria-label="Limpar busca">×</button>}
      </div>
      <span className="clients-result-count">{lista.length} {lista.length===1?'cliente':'clientes'}</span>
    </div>

    {lista.length===0 ? <div className="clients-empty">
      <div className="clients-empty-icon">C</div>
      <strong>Nenhum cliente encontrado</strong>
      <span>Altere os termos da pesquisa ou cadastre um novo cliente.</span>
    </div> : <>
      <div className="clients-desktop-list">
        <div className="table-wrap clients-table-wrap"><table className="clients-table">
          <thead><tr><th>Cliente</th><th>Propriedade e localização</th><th>Contato</th><th>Carteira</th><th className="clients-actions-th">Ações</th></tr></thead>
          <tbody>{lista.map(c=>{
            const nd=doadorasPorCliente.get(c.id)||0
            const nt=tourosPorCliente.get(c.id)||0
            const local=[c.municipio,c.uf].filter(Boolean).join(' / ')
            return <tr key={c.id}>
              <td>
                <div className="client-identity">
                  <div className="client-avatar">{iniciais(c.nome)}</div>
                  <div className="client-main-info"><strong>{c.nome}</strong><span>{c.cpf||'CPF/CNPJ não informado'}</span></div>
                </div>
              </td>
              <td><div className="client-stack"><strong>{c.propriedade||'Propriedade não informada'}</strong><span>{local||'Localização não informada'}</span></div></td>
              <td><div className="client-stack"><span className={c.telefone?'':'muted-info'}>{c.telefone||'Telefone não informado'}</span><span className={c.email?'':'muted-info'}>{c.email||'E-mail não informado'}</span></div></td>
              <td><div className="client-portfolio"><span className="client-badge donor"><b>{nd}</b> Doadoras</span><span className="client-badge bull"><b>{nt}</b> Touros</span></div></td>
              <td><div className="client-actions"><button className="btn small" onClick={()=>setEdit({...c})}>Editar</button><button className="btn small danger" onClick={()=>excluir(c.id)}>Excluir</button></div></td>
            </tr>
          })}</tbody>
        </table></div>
      </div>

      <div className="clients-mobile-list">
        {lista.map(c=>{
          const nd=doadorasPorCliente.get(c.id)||0
          const nt=tourosPorCliente.get(c.id)||0
          const local=[c.municipio,c.uf].filter(Boolean).join(' / ')
          return <article className="client-mobile-card" key={c.id}>
            <div className="client-mobile-head">
              <div className="client-avatar">{iniciais(c.nome)}</div>
              <div className="client-main-info"><strong>{c.nome}</strong><span>{c.propriedade||'Propriedade não informada'}</span></div>
            </div>
            <div className="client-mobile-meta">
              <div><span>Localização</span><strong>{local||'Não informada'}</strong></div>
              <div><span>CPF/CNPJ</span><strong>{c.cpf||'Não informado'}</strong></div>
              <div><span>Telefone</span><strong>{c.telefone||'Não informado'}</strong></div>
            </div>
            <div className="client-mobile-footer">
              <div className="client-portfolio"><span className="client-badge donor"><b>{nd}</b> Doadoras</span><span className="client-badge bull"><b>{nt}</b> Touros</span></div>
              <div className="client-actions"><button className="btn small" onClick={()=>setEdit({...c})}>Editar</button><button className="btn small danger" onClick={()=>excluir(c.id)}>Excluir</button></div>
            </div>
          </article>
        })}
      </div>
    </>}

    {edit&&<Modal title={edit.id?'Editar cliente':'Novo cliente'} onClose={()=>setEdit(null)}>
      <div className="form-grid" onKeyDown={handleEnterFlow}>
        <Field label="Nome / Razão Social"><input value={edit.nome} onChange={e=>setEdit({...edit,nome:e.target.value})}/></Field>
        <Field label="CPF / CNPJ"><input value={edit.cpf||''} onChange={e=>setEdit({...edit,cpf:e.target.value})}/></Field>
        <Field label="Propriedade"><input value={edit.propriedade||''} onChange={e=>setEdit({...edit,propriedade:e.target.value})}/></Field>
        <Field label="Município"><input value={edit.municipio||''} onChange={e=>setEdit({...edit,municipio:e.target.value})}/></Field>
        <Field label="UF"><input value={edit.uf||''} onChange={e=>setEdit({...edit,uf:e.target.value})}/></Field>
        <Field label="Telefone"><input value={edit.telefone||''} onChange={e=>setEdit({...edit,telefone:e.target.value})}/></Field>
        <Field label="E-mail"><input value={edit.email||''} onChange={e=>setEdit({...edit,email:e.target.value})}/></Field>
      </div>
      <div className="modal-actions"><button className="btn" onClick={()=>setEdit(null)}>Cancelar</button><button className="btn primary" data-enter-final="true" onClick={()=>salvar(edit)}>Salvar</button></div>
    </Modal>}
  </section>
}
